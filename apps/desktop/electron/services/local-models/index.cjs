const path = require("node:path");
const crypto = require("node:crypto");
const { createTransport, modelName, fail, BASE } = require("./transport.cjs");
const { readJson, writeJson } = require("./storage.cjs");
const { createCatalogue } = require("./catalogue.cjs");
const installer = require("./installer.cjs");
function createLocalModelService({
  dataDir,
  fetch: fetcher,
  emit = () => {},
  installedProbe = installer.probeInstalled,
  maxParallel = 2,
} = {}) {
  if (!dataDir || !path.isAbsolute(dataDir))
    fail(
      "INVALID_STORAGE",
      "An absolute application-owned data directory is required",
    );
  if (!Number.isInteger(maxParallel) || maxParallel < 1 || maxParallel > 2)
    fail("INVALID_PARALLELISM", "At most two pulls may run in parallel");
  const root = path.join(dataDir, "local-models");
  const transport = createTransport(fetcher);
  const catalogue = createCatalogue({ root, fetch: fetcher, emit });
  const jobs = new Map();
  const controllers = new Map();
  const active = new Set();
  const admitted = new Set();
  let persistQueue = Promise.resolve();
  let closing = false;
  let ready;
  function publicJob(job) {
    const { controller, promise, ...value } = job;
    return { ...value };
  }
  function persist() {
    const snapshot = [...jobs.values()].map(publicJob).slice(-100);
    persistQueue = persistQueue.then(() =>
      writeJson(root, "jobs.json", { version: 1, jobs: snapshot }),
    );
    return persistQueue;
  }
  async function initialize() {
    const retained = await readJson(root, "jobs.json", {
      version: 1,
      jobs: [],
    });
    if (!Array.isArray(retained.jobs) || retained.jobs.length > 100)
      fail("INVALID_JOB_STORE", "Stored pull inventory is invalid");
    for (const record of retained.jobs) {
      if (typeof record.id !== "string" || typeof record.model !== "string")
        fail("INVALID_JOB_STORE", "Stored pull identity is invalid");
      modelName(record.model);
      jobs.set(record.id, {
        ...record,
        state: ["queued", "pulling"].includes(record.state)
          ? "interrupted"
          : record.state,
      });
    }
  }
  ready = initialize();
  async function installed() {
    const value = await transport.request("/api/tags");
    if (!Array.isArray(value.models) || value.models.length > 10000)
      fail("INVALID_RESPONSE", "Installed model inventory is malformed");
    return {
      models: value.models.map((item) => {
        if (
          typeof (item.name || item.model) !== "string" ||
          !Number.isSafeInteger(item.size) ||
          item.size < 0 ||
          typeof item.digest !== "string"
        )
          fail("INVALID_RESPONSE", "Installed model metadata is malformed");
        const localAvailable =
          !item.remote_host &&
          !item.remote_model &&
          !/(?:^|[-:])cloud(?:$|-)/i.test(item.name || item.model);
        return {
          name: item.name || item.model,
          model: item.model || item.name,
          size: item.size,
          digest: item.digest,
          details: item.details || {},
          modifiedAt: item.modified_at || null,
          localAvailable,
          reason: localAvailable
            ? null
            : "This record refers to a remote/cloud model; only local operations are admitted",
        };
      }),
      checkedAt: new Date().toISOString(),
    };
  }
  async function requireInstalled(name) {
    modelName(name);
    const list = await installed();
    const selected = list.models.find(
      (model) => model.name === name || model.model === name,
    );
    if (!selected) fail("MODEL_NOT_INSTALLED", "Select an installed model");
    if (!selected.localAvailable)
      fail(
        "CLOUD_MODEL_UNAVAILABLE",
        "Only installed local models are supported",
      );
    return selected;
  }
  function update(job, patch) {
    Object.assign(job, patch, { updatedAt: new Date().toISOString() });
    emit({ type: "local-models.job", job: publicJob(job) });
  }
  async function run(job) {
    const controller = new AbortController();
    controllers.set(job.id, controller);
    update(job, { state: "pulling", startedAt: new Date().toISOString() });
    await persist();
    let lastPersist = 0;
    try {
      const last = await transport.request("/api/pull", {
        method: "POST",
        body: { model: job.model, stream: true },
        signal: controller.signal,
        stream: true,
        maxBytes: 16 * 1024 ** 2,
        onFrame: async (frame) => {
          if (
            typeof frame.status !== "string" ||
            frame.status.length > 200 ||
            (frame.digest !== undefined && typeof frame.digest !== "string")
          )
            fail("INVALID_RESPONSE", "Pull progress is malformed");
          for (const key of ["total", "completed"])
            if (
              frame[key] !== undefined &&
              (!Number.isSafeInteger(frame[key]) || frame[key] < 0)
            )
              fail("INVALID_RESPONSE", "Pull byte count is malformed");
          if (
            frame.total !== undefined &&
            frame.completed !== undefined &&
            frame.completed > frame.total
          )
            fail("INVALID_RESPONSE", "Pull progress exceeds its total");
          update(job, {
            progress: {
              status: frame.status,
              digest: frame.digest || null,
              total: frame.total ?? null,
              completed: frame.completed ?? null,
            },
          });
          if (Date.now() - lastPersist > 500) {
            lastPersist = Date.now();
            await persist();
          }
        },
      });
      if (last?.status !== "success")
        fail("PULL_INCOMPLETE", "Pull stream ended before success");
      await requireInstalled(job.model);
      update(job, { state: "completed", errorCode: null });
    } catch (error) {
      update(job, {
        state: controller.signal.aborted ? "cancelled" : "failed",
        errorCode: controller.signal.aborted
          ? "CANCELLED"
          : error.code || "API_UNAVAILABLE",
      });
    } finally {
      controllers.delete(job.id);
      await persist();
    }
  }
  function pump() {
    if (closing) return;
    while (active.size < maxParallel) {
      const job = [...jobs.values()].find((item) => item.state === "queued");
      if (!job) break;
      job.state = "pulling";
      const operation = run(job)
        .catch((error) => {
          update(job, {
            state: "failed",
            errorCode: error.code || "STORAGE_FAILED",
          });
        })
        .finally(() => {
          active.delete(operation);
          pump();
        });
      active.add(operation);
    }
  }
  async function pull(p) {
    const model = modelName(p.model);
    if (!model.includes(":"))
      fail(
        "EXACT_TAG_REQUIRED",
        "Select an exact published model tag before pulling",
      );
    if (
      [...jobs.values()].some(
        (job) =>
          job.model === model && ["queued", "pulling"].includes(job.state),
      )
    )
      fail("MODEL_ALREADY_QUEUED", "This exact tag already has a pending pull");
    const id = p.operationId || crypto.randomUUID();
    if (!/^[A-Za-z0-9-]{1,80}$/.test(id) || jobs.has(id))
      fail(
        "INVALID_OPERATION",
        "Pull operation identity is invalid or already used",
      );
    if (jobs.size >= 100) {
      const terminal = [...jobs.values()].find(
        (job) => !["queued", "pulling"].includes(job.state),
      );
      if (!terminal) fail("QUEUE_FULL", "Pull queue is full");
      jobs.delete(terminal.id);
    }
    const job = {
      id,
      model,
      state: "queued",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      progress: null,
    };
    jobs.set(id, job);
    await persist();
    const result = publicJob(job);
    pump();
    return result;
  }
  async function dispatch({ action, params: p = {} } = {}) {
    await ready;
    if (closing) fail("SERVICE_CLOSING", "Local model service is closing");
    switch (action) {
      case "capabilities":
        return {
          actions: [
            "capabilities",
            "status",
            "list",
            "running",
            "show",
            "pull",
            "jobs",
            "cancel",
            "remove",
            "copy",
            "catalogue",
            "refreshCatalogue",
            "installerPlan",
            "install",
            "reconcile",
          ],
          endpoint: BASE,
          reasons: {
            install:
              "Pinned payload member inventory and native publisher/file admission are incomplete",
            start: "Owned runtime lifetime is not integrated",
            stop: "Existing runtime is not owned",
            chat: "Bounded local chat/history is incomplete",
            generate: "Bounded inference is incomplete",
            harness: "Allowlisted launch and rollback are incomplete",
            hardware: "GPU/driver/disk/context evidence is incomplete",
          },
          localOnly: true,
          maxParallel,
          installer: {
            available: false,
            reason: "Pinned payload admission is incomplete",
          },
          start: {
            available: false,
            reason:
              "Owned runtime lifetime and listener verification are not integrated",
          },
          stop: {
            available: false,
            reason: "This service does not own the existing runtime",
          },
          chat: {
            available: false,
            reason:
              "Chat session and bounded inference consumer are incomplete",
          },
          generate: {
            available: false,
            reason: "Bounded generation is incomplete",
          },
          harness: {
            available: false,
            reason: "Allowlisted profile launch is incomplete",
          },
          hardware: {
            available: false,
            reason: "GPU, driver, storage and context evidence are incomplete",
          },
          catalogue: {
            source: "https://ollama.com/library",
            method: "Official HTML model and tag enumeration",
            scope: "Official library only; no community completeness claim",
          },
        };
      case "status": {
        const installation = await installedProbe();
        try {
          const version = await transport.request("/api/version");
          if (
            typeof version.version !== "string" ||
            version.version.length > 80
          )
            fail("INVALID_RESPONSE", "Version response is malformed");
          return {
            state: "healthy",
            version: version.version,
            endpoint: BASE,
            installed: installation,
            checkedAt: new Date().toISOString(),
            listenerOwnership: "external-unverified",
          };
        } catch (error) {
          return {
            state: error.code === "SERVICE_STOPPED" ? "stopped" : "unhealthy",
            endpoint: BASE,
            installed: installation,
            reason: error.code || "API_UNAVAILABLE",
            checkedAt: new Date().toISOString(),
          };
        }
      }
      case "list":
        return installed();
      case "running": {
        const value = await transport.request("/api/ps");
        if (!Array.isArray(value.models) || value.models.length > 1000)
          fail("INVALID_RESPONSE", "Running model inventory is malformed");
        return { models: value.models, checkedAt: new Date().toISOString() };
      }
      case "show": {
        await requireInstalled(p.model);
        const value = await transport.request("/api/show", {
          method: "POST",
          body: { model: p.model, verbose: false },
        });
        return {
          model: p.model,
          details: value.details || {},
          capabilities: Array.isArray(value.capabilities)
            ? value.capabilities
            : [],
          modelInfo: value.model_info || {},
          parameters:
            typeof value.parameters === "string" ? value.parameters : null,
          licence: typeof value.license === "string" ? value.license : null,
        };
      }
      case "pull":
        return pull(p);
      case "jobs":
        return [...jobs.values()].map(publicJob);
      case "cancel": {
        if (p.id === "catalogue") {
          controllers.get("catalogue")?.abort();
          return { id: "catalogue", state: "cancelled" };
        }
        const job = jobs.get(p.id);
        if (!job) fail("UNKNOWN_OPERATION", "Pull operation does not exist");
        if (job.state === "queued") {
          update(job, { state: "cancelled", errorCode: "CANCELLED" });
          await persist();
        } else {
          controllers.get(p.id)?.abort();
          update(job, { cancellationRequested: true });
          await persist();
        }
        return publicJob(job);
      }
      case "reconcile": {
        const value = await installed();
        for (const job of jobs.values())
          if (
            ["interrupted", "failed", "cancelled"].includes(job.state) &&
            value.models.some(
              (model) => model.name === job.model && model.localAvailable,
            )
          )
            update(job, { state: "reconciled", errorCode: null });
        await persist();
        return [...jobs.values()].map(publicJob);
      }
      case "remove": {
        if (p.confirmed !== true)
          fail(
            "CONFIRMATION_REQUIRED",
            "Confirm removal of the exact selected model",
          );
        await requireInstalled(p.model);
        if (
          [...jobs.values()].some(
            (job) =>
              job.model === p.model &&
              ["queued", "pulling"].includes(job.state),
          )
        )
          fail("MODEL_BUSY", "Cancel the active pull before removal");
        await transport.request("/api/delete", {
          method: "DELETE",
          body: { model: p.model },
        });
        if (
          (await installed()).models.some(
            (model) => model.name === p.model || model.model === p.model,
          )
        )
          fail(
            "REMOVE_UNVERIFIED",
            "The local API still lists the selected model after removal",
          );
        return { removed: true, model: p.model };
      }
      case "copy": {
        if (p.confirmed !== true)
          fail("CONFIRMATION_REQUIRED", "Confirm copying the selected model");
        await requireInstalled(p.source);
        modelName(p.destination);
        const value = await installed();
        if (value.models.some((model) => model.name === p.destination))
          fail("MODEL_EXISTS", "Destination model already exists");
        await transport.request("/api/copy", {
          method: "POST",
          body: { source: p.source, destination: p.destination },
        });
        return { copied: true, source: p.source, destination: p.destination };
      }
      case "catalogue":
        return catalogue.snapshot();
      case "refreshCatalogue": {
        if (controllers.has("catalogue"))
          fail("CATALOGUE_BUSY", "A catalogue refresh is already active");
        const controller = new AbortController();
        controllers.set("catalogue", controller);
        try {
          return await catalogue.refresh(controller.signal);
        } finally {
          controllers.delete("catalogue");
        }
      }
      case "installerPlan":
        return installer.installerPlan();
      case "install":
        return installer.install();
      default:
        fail(
          "UNSUPPORTED_ACTION",
          "This local model operation is not implemented",
        );
    }
  }
  return {
    request(input) {
      if (closing)
        return Promise.reject(
          Object.assign(new Error("Local model service is closing"), {
            code: "SERVICE_CLOSING",
          }),
        );
      const pending = dispatch(input);
      admitted.add(pending);
      pending.finally(() => admitted.delete(pending)).catch(() => {});
      return pending;
    },
    async dispose() {
      closing = true;
      await ready;
      for (const controller of controllers.values()) controller.abort();
      for (const job of jobs.values())
        if (job.state === "queued") update(job, { state: "interrupted" });
      await Promise.allSettled([...admitted]);
      await Promise.allSettled([...active]);
      await persistQueue;
    },
  };
}
module.exports = { createLocalModelService };

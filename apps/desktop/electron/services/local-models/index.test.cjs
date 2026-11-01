const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs/promises");
const path = require("node:path");
const os = require("node:os");
const { createLocalModelService } = require("./index.cjs");
const { createTransport } = require("./transport.cjs");
const { createCatalogue } = require("./catalogue.cjs");
async function fixture(t, fetch) {
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), "material-models-"));
  t.after(() => fs.rm(dataDir, { recursive: true, force: true }));
  return {
    dataDir,
    service: createLocalModelService({
      dataDir,
      fetch,
      installedProbe: async () => ({
        found: true,
        version: null,
        executionVerified: false,
      }),
    }),
  };
}
const installed = (name) => ({
  name,
  model: name,
  size: 100,
  digest: "a".repeat(64),
  details: {
    family: "test",
    parameter_size: "1B",
    quantization_level: "Q4_K_M",
  },
});
test("transport admits only fixed loopback routes, rejects redirects and bounds responses", async () => {
  const calls = [];
  const transport = createTransport(async (url, options) => {
    calls.push({ url, options });
    return new Response('{"version":"1"}');
  });
  assert.equal((await transport.request("/api/version")).version, "1");
  assert.equal(calls[0].url, "http://127.0.0.1:11434/api/version");
  assert.equal(calls[0].options.redirect, "error");
  await assert.rejects(transport.request("https://example.com/api/version"), {
    code: "API_ROUTE_UNAVAILABLE",
  });
  const oversized = createTransport(async () => new Response("x".repeat(20)));
  await assert.rejects(oversized.request("/api/version", { maxBytes: 10 }), {
    code: "RESPONSE_TOO_LARGE",
  });
});
test("status distinguishes stopped runtime from detected installation without starting anything", async (t) => {
  let calls = 0;
  const { service } = await fixture(t, async () => {
    calls++;
    throw Object.assign(new Error("connect"), {
      cause: { code: "ECONNREFUSED" },
    });
  });
  const result = await service.request({ action: "status" });
  assert.equal(result.state, "stopped");
  assert.equal(result.installed.found, true);
  assert.equal(calls, 1);
  await service.dispose();
});
test("pull consumes bounded progress, verifies installed membership and persists terminal result", async (t) => {
  let pulled = false;
  const calls = [];
  const { dataDir, service } = await fixture(t, async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith("/api/tags"))
      return Response.json({ models: pulled ? [installed("test:1b")] : [] });
    if (url.endsWith("/api/pull")) {
      pulled = true;
      return new Response(
        '{"status":"downloading","digest":"sha256:a","total":100,"completed":50}\n{"status":"success"}\n',
      );
    }
    throw new Error("unexpected");
  });
  const job = await service.request({
    action: "pull",
    params: { model: "test:1b" },
  });
  assert.equal(job.state, "queued");
  let terminal;
  for (let i = 0; i < 50; i++) {
    terminal = (await service.request({ action: "jobs" }))[0];
    if (terminal.state === "completed") break;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(terminal.state, "completed");
  await service.dispose();
  const persisted = JSON.parse(
    await fs.readFile(path.join(dataDir, "local-models", "jobs.json"), "utf8"),
  );
  assert.equal(persisted.jobs[0].state, "completed");
  assert.equal(
    JSON.parse(calls.find((x) => x.url.endsWith("/api/pull")).options.body)
      .model,
    "test:1b",
  );
});
test("pull never claims completion from an incomplete stream or unlisted model", async (t) => {
  const { service } = await fixture(t, async (url) =>
    url.endsWith("/api/pull")
      ? new Response('{"status":"downloading"}\n')
      : Response.json({ models: [] }),
  );
  await service.request({ action: "pull", params: { model: "test:tag" } });
  let state;
  for (let i = 0; i < 50; i++) {
    state = (await service.request({ action: "jobs" }))[0];
    if (state.state === "failed") break;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(state.state, "failed");
  assert.equal(state.errorCode, "PULL_INCOMPLETE");
  await service.dispose();
});
test("destructive actions require exact consent and local installed membership", async (t) => {
  const calls = [];
  const { service } = await fixture(t, async (url, options) => {
    calls.push({ url, options });
    return Response.json({ models: [installed("test:tag")] });
  });
  await assert.rejects(
    service.request({ action: "remove", params: { model: "test:tag" } }),
    { code: "CONFIRMATION_REQUIRED" },
  );
  await assert.rejects(
    service.request({
      action: "remove",
      params: { model: "missing:tag", confirmed: true },
    }),
    { code: "MODEL_NOT_INSTALLED" },
  );
  await assert.rejects(
    service.request({ action: "pull", params: { model: "test:cloud" } }),
    { code: "CLOUD_MODEL_UNAVAILABLE" },
  );
  assert.ok(calls.every((call) => !call.url.endsWith("/api/delete")));
  await service.dispose();
});
test("catalogue follows model and tag pagination and retains every discovered tag", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "material-catalogue-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const pages = {
    "https://ollama.com/library":
      '<html><a href="/library/one">One</a><a rel="next" href="/library?page=2">Next</a></html>',
    "https://ollama.com/library?page=2":
      '<html><a href="/library/two">Two</a></html>',
    "https://ollama.com/library/one/tags":
      '<html><a href="/library/one:1b">1b</a><a href="/library/one/tags?page=2" rel="next">Next</a></html>',
    "https://ollama.com/library/one/tags?page=2":
      '<html><a href="/library/one:2b">2b</a></html>',
    "https://ollama.com/library/two/tags":
      '<html><a href="/library/two:latest">Latest</a></html>',
  };
  const catalogue = createCatalogue({
    root,
    fetch: async (url) => {
      assert.ok(Object.hasOwn(pages, url), url);
      return new Response(pages[url]);
    },
  });
  const result = await catalogue.refresh();
  assert.equal(result.complete, true);
  assert.equal(result.models.length, 2);
  assert.equal(result.tagCount, 3);
  assert.equal(result.pageCount, 5);
  assert.ok(result.sourceRevision);
  assert.equal((await catalogue.snapshot()).stale, true);
});
test("a missing tag page preserves the prior catalogue and marks refresh incomplete", async (t) => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "material-catalogue-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const catalogue = createCatalogue({
    root,
    fetch: async (url) =>
      new Response(
        url.endsWith("/library")
          ? '<html><a href="/library/one">One</a></html>'
          : "<html>No parsed tags</html>",
      ),
  });
  const result = await catalogue.refresh();
  assert.equal(result.complete, false);
  assert.equal(result.stale, true);
  assert.equal(result.refreshError, "CATALOGUE_INCOMPLETE");
  assert.deepEqual(result.models, []);
});
test("installer plan pins exact official bytes but does not claim incomplete admission is installable", async (t) => {
  const { service } = await fixture(t, async () => Response.json({}));
  const plan = await service.request({ action: "installerPlan" });
  assert.equal(plan.available, false);
  assert.equal(plan.version, "0.40.13");
  assert.match(plan.sha256, /^[a-f0-9]{64}$/);
  assert.ok(plan.bytes > 0);
  await assert.rejects(service.request({ action: "install" }), {
    code: "INSTALLER_ADMISSION_INCOMPLETE",
  });
  await service.dispose();
});
test("pull concurrency is bounded and queued cancellation never starts another request", async (t) => {
  let active = 0,
    maxActive = 0,
    pulls = 0;
  const { service } = await fixture(t, async (url, options) => {
    if (url.endsWith("/api/tags")) return Response.json({ models: [] });
    if (url.endsWith("/api/pull")) {
      pulls++;
      active++;
      maxActive = Math.max(maxActive, active);
      return new Response(
        new ReadableStream({
          start(controller) {
            options.signal.addEventListener(
              "abort",
              () => {
                active--;
                controller.error(new DOMException("Aborted", "AbortError"));
              },
              { once: true },
            );
          },
        }),
      );
    }
    throw new Error("unexpected");
  });
  const first = await service.request({
    action: "pull",
    params: { model: "one:tag" },
  });
  await service.request({ action: "pull", params: { model: "two:tag" } });
  const third = await service.request({
    action: "pull",
    params: { model: "three:tag" },
  });
  assert.equal(third.state, "queued");
  const cancelled = await service.request({
    action: "cancel",
    params: { id: third.id },
  });
  assert.equal(cancelled.state, "cancelled");
  await service.request({ action: "cancel", params: { id: first.id } });
  await service.dispose();
  assert.equal(maxActive, 2);
  assert.equal(pulls, 2);
  assert.equal(active, 0);
  await assert.rejects(service.request({ action: "list" }), {
    code: "SERVICE_CLOSING",
  });
});
test("malformed progress counts never become successful pulls", async (t) => {
  const { service } = await fixture(
    t,
    async () =>
      new Response('{"status":"downloading","total":1,"completed":2}\n'),
  );
  await service.request({ action: "pull", params: { model: "bad:tag" } });
  let result;
  for (let i = 0; i < 50; i++) {
    result = (await service.request({ action: "jobs" }))[0];
    if (result.state === "failed") break;
    await new Promise((r) => setTimeout(r, 5));
  }
  assert.equal(result.errorCode, "INVALID_RESPONSE");
  assert.equal(result.state, "failed");
  await service.dispose();
});

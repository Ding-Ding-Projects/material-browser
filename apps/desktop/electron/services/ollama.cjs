// Local Ollama suite: status, installer, catalogue, hardware fit, pull queue and chat.
// Talks only to Ollama's documented local HTTP API at 127.0.0.1:11434, the official
// GitHub releases API for ollama/ollama and the public https://ollama.com/library pages.
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");
const childProcess = require("node:child_process");
const { Readable, Transform } = require("node:stream");
const { pipeline } = require("node:stream/promises");
function awaitSpawn(child) {
  return new Promise((resolve, reject) => {
    child.once("error", reject);
    child.once("spawn", resolve);
  });
}

const BASE = "http://127.0.0.1:11434";
const RELEASE_API = "https://api.github.com/repos/ollama/ollama/releases/latest";
const RELEASE_DOWNLOAD_PREFIX = "https://github.com/ollama/ollama/releases/download/";
const LIBRARY_URL = "https://ollama.com/library";
const INSTALLER_NAME = "OllamaSetup.exe";

const LIMITS = Object.freeze({
  params: 512 * 1024,
  json: 4 * 1024 * 1024,
  release: 2 * 1024 * 1024,
  libraryPage: 8 * 1024 * 1024,
  ndjsonLine: 256 * 1024,
  cache: 16 * 1024 * 1024,
  installer: 2 * 1024 * 1024 * 1024,
  chatMessages: 200,
  chatMessageChars: 32000,
  chatTotalChars: 256 * 1024,
  queueItems: 50,
  catalogueModels: 1000,
  tagsPerModel: 500,
  cataloguePages: 600,
  parallelismMax: 3,
});

// Lowercase model name, optional single namespace, optional tag. Matches what Ollama accepts
// for library models and rejects anything that could change the URL or request shape.
const MODEL_RE = /^(?:[a-z0-9][a-z0-9._-]{0,79}\/)?[a-z0-9][a-z0-9._-]{0,79}(?::[A-Za-z0-9][A-Za-z0-9._-]{0,127})?$/;

function validModelName(name) {
  return typeof name === "string" && MODEL_RE.test(name) && !name.includes("..");
}

function requireModel(name) {
  if (!validModelName(name)) throw new Error("INVALID_MODEL_NAME");
  return name;
}

function boundParams(params) {
  if (params === undefined || params === null) return {};
  if (typeof params !== "object" || Array.isArray(params)) throw new Error("INVALID_REQUEST");
  let text;
  try {
    text = JSON.stringify(params);
  } catch {
    throw new Error("INVALID_REQUEST");
  }
  if (Buffer.byteLength(text) > LIMITS.params) throw new Error("REQUEST_TOO_LARGE");
  return params;
}

function validateChatMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > LIMITS.chatMessages)
    throw new Error("INVALID_CHAT");
  let total = 0;
  return messages.map((message) => {
    if (!message || typeof message !== "object") throw new Error("INVALID_CHAT");
    const { role, content } = message;
    if (!["system", "user", "assistant"].includes(role)) throw new Error("INVALID_CHAT");
    if (typeof content !== "string" || content.length > LIMITS.chatMessageChars)
      throw new Error("INVALID_CHAT");
    total += content.length;
    if (total > LIMITS.chatTotalChars) throw new Error("REQUEST_TOO_LARGE");
    return { role, content };
  });
}

// ---------- bounded HTTP helpers ----------

async function readBounded(response, limit) {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new Error("RESPONSE_TOO_LARGE");
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel().catch(() => {});
      throw new Error("RESPONSE_TOO_LARGE");
    }
    chunks.push(Buffer.from(value));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function withTimeout(ms, outer) {
  const controller = new AbortController();
  const timer = ms ? setTimeout(() => controller.abort(new Error("TIMEOUT")), ms) : null;
  const relay = () => controller.abort(outer.reason);
  if (outer) {
    if (outer.aborted) controller.abort(outer.reason);
    else outer.addEventListener("abort", relay, { once: true });
  }
  return {
    signal: controller.signal,
    done() {
      if (timer) clearTimeout(timer);
      if (outer) outer.removeEventListener("abort", relay);
    },
  };
}

/** Reads a newline-delimited JSON stream, each line bounded, calling onLine for every object. */
async function readNdjson(response, onLine) {
  if (!response.body) return;
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    if (buffer.length > LIMITS.ndjsonLine && !buffer.includes("\n")) {
      await reader.cancel().catch(() => {});
      throw new Error("RESPONSE_TOO_LARGE");
    }
    let index;
    while ((index = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, index).trim();
      buffer = buffer.slice(index + 1);
      if (!line) continue;
      if (line.length > LIMITS.ndjsonLine) throw new Error("RESPONSE_TOO_LARGE");
      let parsed;
      try {
        parsed = JSON.parse(line);
      } catch {
        throw new Error("INVALID_RESPONSE");
      }
      onLine(parsed);
    }
  }
  const rest = buffer.trim();
  if (rest) {
    if (rest.length > LIMITS.ndjsonLine) throw new Error("RESPONSE_TOO_LARGE");
    try {
      onLine(JSON.parse(rest));
    } catch {
      throw new Error("INVALID_RESPONSE");
    }
  }
}

// ---------- catalogue parsing (isolated from fetching) ----------

const decodeEntities = (text) =>
  text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&amp;/g, "&");

const UNITS = { B: 1, KB: 1e3, MB: 1e6, GB: 1e9, TB: 1e12 };
function parseSize(text) {
  const match = /^([\d.]+)\s*(B|KB|MB|GB|TB)$/i.exec(String(text || "").trim());
  if (!match) return null;
  const value = Number(match[1]) * UNITS[match[2].toUpperCase()];
  return Number.isFinite(value) && value > 0 ? Math.round(value) : null;
}

/** Parses the library index. Throws CATALOGUE_UNPARSEABLE rather than guessing. */
function parseLibraryIndex(html) {
  if (typeof html !== "string" || !html) throw new Error("CATALOGUE_UNPARSEABLE");
  const models = new Map();
  const anchor = /<a\s+href="\/library\/([a-z0-9][a-z0-9._-]{0,79})"[^>]*>([\s\S]*?)<\/a>/g;
  let match;
  while ((match = anchor.exec(html)) && models.size < LIMITS.catalogueModels) {
    const name = match[1];
    if (!validModelName(name) || models.has(name)) continue;
    const body = match[2];
    const description = /<p[^>]*class="[^"]*max-w-lg[^"]*"[^>]*>([\s\S]*?)<\/p>/.exec(body);
    const capabilities = [...body.matchAll(/<span[^>]*>\s*(tools|vision|thinking|embedding|audio|cloud)\s*<\/span>/g)].map((m) => m[1]);
    models.set(name, {
      name,
      description: description ? decodeEntities(description[1].replace(/<[^>]*>/g, "").trim()).slice(0, 400) : "",
      capabilities: [...new Set(capabilities)],
    });
  }
  if (models.size === 0) throw new Error("CATALOGUE_UNPARSEABLE");
  return [...models.values()];
}

/** Parses one model's tags page. Returns tags; size is null when it cannot be read. */
function parseTagsPage(name, html) {
  if (!validModelName(name) || typeof html !== "string") throw new Error("CATALOGUE_UNPARSEABLE");
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const anchor = new RegExp(`href="/library/${escaped}:([A-Za-z0-9][A-Za-z0-9._-]{0,127})"`, "g");
  const tags = new Map();
  let match;
  while ((match = anchor.exec(html)) && tags.size < LIMITS.tagsPerModel) {
    const tag = match[1];
    const window = html.slice(match.index, match.index + 2000);
    const info = /([0-9a-f]{12})\s*<\/span>\s*•\s*([\d.]+\s*(?:B|KB|MB|GB|TB))\s*•\s*(?:([\d.]+[KM]?)\s+context window)?/i.exec(window);
    const prior = tags.get(tag);
    const entry = {
      tag,
      digest: info ? info[1] : prior?.digest || null,
      size: info ? parseSize(info[2]) : prior?.size ?? null,
      context: info && info[3] ? info[3] : prior?.context || null,
    };
    if (!prior || (!prior.size && entry.size)) tags.set(tag, entry);
  }
  if (tags.size === 0) throw new Error("CATALOGUE_UNPARSEABLE");
  return [...tags.values()];
}

function quantOf(tag) {
  const match = /(q\d(?:_[0-9A-Za-z]+)*|fp16|fp32|bf16|int4|int8|mxfp4)$/i.exec(tag || "");
  return match ? match[1] : null;
}

// ---------- hardware and fit ----------

/** Pure verdict. Uses blob size and measured hardware only, never the model name. */
function fitVerdict({ sizeBytes, ramBytes, vramBytes, freeDiskBytes, installed }) {
  const reasons = [];
  const known = (v) => typeof v === "number" && Number.isFinite(v) && v >= 0;
  if (!known(sizeBytes) || sizeBytes <= 0) return { verdict: "unknown", reasons: ["Model size is not known"] };
  if (!known(ramBytes) || ramBytes <= 0) return { verdict: "unknown", reasons: ["Memory size is not known"] };
  if (!known(vramBytes)) return { verdict: "unknown", reasons: ["Graphics memory is not known"] };
  if (!installed) {
    if (!known(freeDiskBytes)) return { verdict: "unknown", reasons: ["Free disk space is not known"] };
    if (sizeBytes > freeDiskBytes) {
      return { verdict: "unlikely", reasons: ["Not enough free disk space for the download"], needBytes: sizeBytes };
    }
  }
  // Weights plus a conservative allowance for context cache and runtime.
  const need = Math.ceil(sizeBytes * 1.2 + 1024 ** 3);
  if (need <= vramBytes) {
    reasons.push("Fits in graphics memory");
    return { verdict: "well", reasons, needBytes: need };
  }
  if (need <= vramBytes + ramBytes * 0.5) {
    reasons.push(vramBytes > 0 ? "Needs part of system memory as well as graphics memory" : "Runs on the processor from system memory");
    return { verdict: "limits", reasons, needBytes: need };
  }
  reasons.push("Needs more memory than this PC can spare");
  return { verdict: "unlikely", reasons, needBytes: need };
}

function modelsDirectory(env) {
  if (env.OLLAMA_MODELS) return env.OLLAMA_MODELS;
  return path.join(os.homedir(), ".ollama", "models");
}

function freeDiskOf(target) {
  let current = path.resolve(target);
  for (let i = 0; i < 64; i++) {
    try {
      const stats = fs.statfsSync(current);
      return { path: current, free: Number(stats.bavail) * Number(stats.bsize) };
    } catch {
      const parent = path.dirname(current);
      if (parent === current) break;
      current = parent;
    }
  }
  return { path: target, free: null };
}

const UINT32_MAX = 4294967295;
function parseGpuJson(text) {
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    return null;
  }
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return list
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const ram = Number(x.AdapterRAM);
      return {
        name: String(x.Name || "").slice(0, 120),
        vram: Number.isFinite(ram) && ram > 0 ? ram : null,
        // AdapterRAM is a 32-bit value, so 4 GB or more reads as a lower bound.
        capped: Number.isFinite(ram) && ram >= UINT32_MAX - 1024 * 1024,
      };
    });
}

function parseWmic(text) {
  const lines = String(text).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length < 2 || !/AdapterRAM/i.test(lines[0])) return null;
  return lines.slice(1).map((line) => {
    const match = /^(\d+)?\s+(.*)$/.exec(line);
    const ram = match && match[1] ? Number(match[1]) : NaN;
    return {
      name: (match ? match[2] : line).slice(0, 120),
      vram: Number.isFinite(ram) && ram > 0 ? ram : null,
      capped: Number.isFinite(ram) && ram >= UINT32_MAX - 1024 * 1024,
    };
  });
}

function run(execFileImpl, file, args) {
  return new Promise((resolve) => {
    execFileImpl(file, args, { timeout: 6000, windowsHide: true, maxBuffer: 64 * 1024 }, (error, stdout) =>
      resolve(error ? null : String(stdout)),
    );
  });
}

async function detectGpus(platform, execFileImpl) {
  if (platform !== "win32") return { gpus: null, method: "not available on this platform" };
  const ps = await run(execFileImpl, "powershell.exe", [
    "-NoProfile",
    "-NonInteractive",
    "-Command",
    "Get-CimInstance Win32_VideoController | Select-Object Name,AdapterRAM | ConvertTo-Json -Compress",
  ]);
  const fromPs = ps ? parseGpuJson(ps) : null;
  if (fromPs) return { gpus: fromPs, method: "Get-CimInstance Win32_VideoController" };
  const wmic = await run(execFileImpl, "wmic", ["path", "win32_VideoController", "get", "AdapterRAM,Name"]);
  const fromWmic = wmic ? parseWmic(wmic) : null;
  if (fromWmic) return { gpus: fromWmic, method: "wmic win32_VideoController" };
  return { gpus: null, method: "detection failed" };
}

/** Flattens catalogue tags into rows, merges installed models and attaches fit verdicts. */
function buildStore(catalogue, hw, installed) {
  const rows = new Map();
  const installedByName = new Map(installed.map((m) => [m.name, m]));
  const verdict = (size, isInstalled) =>
    fitVerdict({ sizeBytes: size, ramBytes: hw.ramBytes, vramBytes: hw.vramBytes, freeDiskBytes: hw.freeDiskBytes, installed: isInstalled });
  for (const model of catalogue.available ? catalogue.models || [] : []) {
    for (const tag of model.tags || []) {
      const full = `${model.name}:${tag.tag}`;
      const local = installedByName.get(full);
      const size = tag.size ?? local?.size ?? null;
      rows.set(full, {
        name: full,
        model: model.name,
        tag: tag.tag,
        size,
        quant: quantOf(tag.tag) || local?.quantization || null,
        context: tag.context,
        capabilities: model.capabilities || [],
        installed: Boolean(local),
        source: "catalogue",
        fit: verdict(size, Boolean(local)),
      });
    }
  }
  for (const local of installed) {
    if (rows.has(local.name)) continue;
    const [model, tag = "latest"] = local.name.split(":");
    rows.set(local.name, {
      name: local.name,
      model,
      tag,
      size: local.size,
      quant: local.quantization,
      context: null,
      capabilities: [],
      installed: true,
      source: "installed",
      fit: verdict(local.size, true),
    });
  }
  const { models, ...meta } = catalogue;
  return { catalogue: meta, hardware: hw, rows: [...rows.values()] };
}

// ---------- service ----------

function createOllamaService({
  userData,
  emit = () => {},
  fetchImpl = globalThis.fetch,
  platform = process.platform,
  env = process.env,
  execFileImpl = childProcess.execFile,
  spawnImpl = childProcess.spawn,
  now = () => Date.now(),
}) {
  const folder = path.join(userData, "ollama");
  const cacheFile = path.join(folder, "catalogue.json");
  const state = {
    queue: [],
    parallelism: 1,
    running: false,
    chats: new Map(),
    installer: null,
    download: null,
    hardware: null,
    refreshing: null,
    sequence: 0,
  };

  async function local(pathname, { method = "GET", body, timeout = 5000, signal } = {}) {
    const scope = withTimeout(timeout, signal);
    try {
      const response = await fetchImpl(`${BASE}${pathname}`, {
        method,
        redirect: "error",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
        signal: scope.signal,
      });
      const text = await readBounded(response, LIMITS.json);
      if (!response.ok) {
        let message = `HTTP_${response.status}`;
        try {
          const parsed = JSON.parse(text);
          if (parsed && typeof parsed.error === "string") message = parsed.error.slice(0, 300);
        } catch {}
        const error = new Error(message);
        error.status = response.status;
        throw error;
      }
      return text ? JSON.parse(text) : {};
    } finally {
      scope.done();
    }
  }

  function installCandidates() {
    if (platform === "win32") {
      const base = env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
      return [path.join(base, "Programs", "Ollama", "ollama.exe")];
    }
    if (platform === "darwin") return ["/Applications/Ollama.app/Contents/Resources/ollama", "/usr/local/bin/ollama"];
    return ["/usr/local/bin/ollama", "/usr/bin/ollama"];
  }
  const findInstalled = () => installCandidates().find((file) => fs.existsSync(file)) || null;

  async function status() {
    const executable = findInstalled();
    try {
      const value = await local("/api/version", { timeout: 2000 });
      if (!value || typeof value.version !== "string") {
        return { state: "unhealthy", executable, reason: "The version answer was not understood" };
      }
      return { state: "running", version: value.version.slice(0, 40), executable };
    } catch (error) {
      const code = error?.cause?.code || error?.code;
      const refused = code === "ECONNREFUSED" || /ECONNREFUSED|fetch failed/i.test(String(error?.message));
      if (refused && !error.status) {
        return executable ? { state: "stopped", executable } : { state: "missing", executable: null };
      }
      return { state: "unhealthy", executable, reason: String(error?.message || "No answer").slice(0, 200) };
    }
  }

  async function start() {
    const current = await status();
    if (current.state === "running") return current;
    if (!current.executable) throw new Error("OLLAMA_NOT_INSTALLED");
    const child = spawnImpl(current.executable, ["serve"], { detached: true, stdio: "ignore", windowsHide: true });
    await awaitSpawn(child);
    child.unref?.();
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 500));
      const next = await status();
      if (next.state === "running") return next;
    }
    return { ...(await status()), startTimedOut: true };
  }

  // ----- installer -----

  async function installerCheck() {
    if (platform !== "win32") throw new Error("UNSUPPORTED_PLATFORM");
    const scope = withTimeout(15000);
    let release;
    try {
      const response = await fetchImpl(RELEASE_API, {
        headers: { accept: "application/vnd.github+json", "user-agent": "MaterialBrowser" },
        signal: scope.signal,
      });
      if (!response.ok) throw new Error(`RELEASE_HTTP_${response.status}`);
      release = JSON.parse(await readBounded(response, LIMITS.release));
    } finally {
      scope.done();
    }
    const assets = Array.isArray(release?.assets) ? release.assets : [];
    const asset = assets.find((a) => a && a.name === INSTALLER_NAME);
    if (!asset) throw new Error("INSTALLER_NOT_IN_RELEASE");
    const url = String(asset.browser_download_url || "");
    if (!url.startsWith(RELEASE_DOWNLOAD_PREFIX) || !url.endsWith(`/${INSTALLER_NAME}`)) throw new Error("INSTALLER_URL_UNEXPECTED");
    const size = Number(asset.size);
    if (!Number.isSafeInteger(size) || size <= 0 || size > LIMITS.installer) throw new Error("INSTALLER_SIZE_UNEXPECTED");
    let sha256 = null;
    let hashSource = null;
    if (typeof asset.digest === "string" && /^sha256:[0-9a-f]{64}$/i.test(asset.digest)) {
      sha256 = asset.digest.slice(7).toLowerCase();
      hashSource = "release asset digest";
    } else {
      const sums = assets.find((a) => a && a.name === "sha256sum.txt");
      const sumsUrl = String(sums?.browser_download_url || "");
      if (sumsUrl.startsWith(RELEASE_DOWNLOAD_PREFIX)) {
        const sumScope = withTimeout(15000);
        try {
          const response = await fetchImpl(sumsUrl, { signal: sumScope.signal, headers: { "user-agent": "MaterialBrowser" } });
          if (response.ok) {
            const text = await readBounded(response, 64 * 1024);
            const line = text.split(/\r?\n/).find((l) => /\s\*?(?:\.\/)?OllamaSetup\.exe$/.test(l.trim()));
            const hash = line && /^([0-9a-f]{64})\s/i.exec(line.trim());
            if (hash) {
              sha256 = hash[1].toLowerCase();
              hashSource = "sha256sum.txt";
            }
          }
        } catch {
        } finally {
          sumScope.done();
        }
      }
    }
    state.installer = {
      version: String(release.tag_name || "").slice(0, 40),
      url,
      size,
      sha256,
      hashSource,
      file: null,
      integrity: null,
      admission: "INSTALLER_ADMISSION_INCOMPLETE",
    };
    const { file, ...visible } = state.installer;
    return visible;
  }

  async function installerDownload() {
    const plan = state.installer;
    if (!plan) throw new Error("INSTALLER_NOT_CHECKED");
    if (state.download) throw new Error("DOWNLOAD_IN_PROGRESS");
    const target = path.join(folder, "installer");
    fs.mkdirSync(target, { recursive: true });
    const final = path.join(target, INSTALLER_NAME);
    const partial = `${final}.part`;
    const controller = new AbortController();
    state.download = controller;
    const hash = crypto.createHash("sha256");
    let received = 0;
    let lastEmit = 0;
    try {
      const response = await fetchImpl(plan.url, { signal: controller.signal, headers: { "user-agent": "MaterialBrowser" } });
      if (!response.ok || !response.body) throw new Error(`DOWNLOAD_HTTP_${response.status}`);
      const progress = new Transform({
        transform(chunk, encoding, callback) {
          received += chunk.length;
          if (received > plan.size) return callback(new Error("INSTALLER_SIZE_MISMATCH"));
          hash.update(chunk);
          if (now() - lastEmit > 250) {
            lastEmit = now();
            emit({ type: "ollama.installer", phase: "downloading", received, total: plan.size });
          }
          callback(null, chunk);
        },
      });
      await pipeline(Readable.fromWeb(response.body), progress,
        fs.createWriteStream(partial, { mode: 0o600, flags: "wx" }), { signal: controller.signal });
      if (received !== plan.size) throw new Error("INSTALLER_SIZE_MISMATCH");
      const digest = hash.digest("hex");
      if (plan.sha256 && digest !== plan.sha256) throw new Error("INSTALLER_HASH_MISMATCH");
      fs.renameSync(partial, final);
      plan.file = final;
      plan.integrity = plan.sha256 ? "verified" : "unverified";
      plan.actualSha256 = digest;
      emit({ type: "ollama.installer", phase: "ready", received, total: plan.size, integrity: plan.integrity });
      return { ready: false, admission: "INSTALLER_ADMISSION_INCOMPLETE", size: received, sha256: digest, integrity: plan.integrity, version: plan.version };
    } catch (error) {
      fs.rmSync(partial, { force: true });
      const cancelled = controller.signal.aborted;
      emit({ type: "ollama.installer", phase: cancelled ? "cancelled" : "failed", error: cancelled ? "CANCELLED" : String(error.message) });
      throw cancelled ? new Error("CANCELLED") : error;
    } finally {
      state.download = null;
    }
  }

  async function installerRun(params) {
    if (params.confirmed !== true) throw new Error("CONFIRMATION_REQUIRED");
    // A release digest proves downloaded bytes, not native publisher admission.
    // No native publisher/final-file admission implementation is bundled yet.
    throw new Error("INSTALLER_ADMISSION_INCOMPLETE");
  }

  // ----- catalogue -----

  function readCache() {
    try {
      const stat = fs.statSync(cacheFile);
      if (stat.size > LIMITS.cache) return null;
      const value = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
      return value && Array.isArray(value.models) && typeof value.retrievedAt === "number" ? value : null;
    } catch {
      return null;
    }
  }

  function writeCache(value) {
    const text = JSON.stringify(value);
    if (Buffer.byteLength(text) > LIMITS.cache) return false;
    fs.mkdirSync(folder, { recursive: true });
    const temporary = `${cacheFile}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, text, { mode: 0o600 });
    fs.renameSync(temporary, cacheFile);
    return true;
  }

  async function fetchPage(url) {
    const scope = withTimeout(20000);
    try {
      const response = await fetchImpl(url, { signal: scope.signal, headers: { accept: "text/html", "user-agent": "MaterialBrowser" } });
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      return await readBounded(response, LIMITS.libraryPage);
    } finally {
      scope.done();
    }
  }

  /** Builds a catalogue from the website. Throws CATALOGUE_UNPARSEABLE or a network error. */
  async function buildCatalogue() {
    const index = await fetchPage(LIBRARY_URL);
    const models = parseLibraryIndex(index);
    let pageCount = 1;
    const failures = [];
    const list = models.slice(0, LIMITS.cataloguePages - 1);
    let cursor = 0;
    const worker = async () => {
      while (cursor < list.length) {
        const model = list[cursor++];
        try {
          const html = await fetchPage(`${LIBRARY_URL}/${model.name}/tags`);
          pageCount++;
          model.tags = parseTagsPage(model.name, html);
        } catch (error) {
          model.tags = [];
          failures.push({ name: model.name, error: String(error.message).slice(0, 80) });
        }
        emit({ type: "ollama.catalogue", phase: "fetching", done: cursor, total: list.length });
      }
    };
    await Promise.all(Array.from({ length: 4 }, worker));
    const tagCount = models.reduce((n, m) => n + (m.tags?.length || 0), 0);
    return {
      version: 1,
      source: LIBRARY_URL,
      retrievedAt: now(),
      pageCount,
      modelCount: models.length,
      tagCount,
      complete: failures.length === 0 && list.length === models.length,
      failures: failures.slice(0, 50),
      models: models.map((m) => ({ ...m, tags: m.tags || [] })),
    };
  }

  function describeCache(cache, extra) {
    if (!cache) return { available: false, ...extra };
    return { available: true, ...cache, ageMs: Math.max(0, now() - cache.retrievedAt), ...extra };
  }

  async function catalogueRefresh() {
    if (!state.refreshing) {
      state.refreshing = (async () => {
        try {
          const fresh = await buildCatalogue();
          writeCache(fresh);
          return describeCache(fresh, { origin: "network" });
        } catch (error) {
          const reason = error.message === "CATALOGUE_UNPARSEABLE" ? "unparseable" : "offline";
          return describeCache(readCache(), { origin: "cache", refreshFailed: reason });
        } finally {
          state.refreshing = null;
        }
      })();
    }
    return state.refreshing;
  }

  // ----- hardware -----

  async function hardware(force) {
    if (!force && state.hardware && now() - state.hardware.at < 60000) return state.hardware.value;
    const disk = freeDiskOf(modelsDirectory(env));
    const gpu = await detectGpus(platform, execFileImpl);
    const vrams = (gpu.gpus || []).map((g) => g.vram).filter((v) => typeof v === "number");
    const value = {
      ramBytes: os.totalmem(),
      freeRamBytes: os.freemem(),
      modelsPath: disk.path,
      freeDiskBytes: disk.free,
      gpus: gpu.gpus,
      gpuMethod: gpu.method,
      // Missing GPU data stays null so every verdict that depends on it is Unknown.
      vramBytes: gpu.gpus === null ? null : gpu.gpus.length === 0 ? 0 : vrams.length ? Math.max(...vrams) : null,
      vramLowerBound: (gpu.gpus || []).some((g) => g.capped),
    };
    state.hardware = { at: now(), value };
    return value;
  }

  // ----- pull queue -----

  const snapshot = () => ({
    parallelism: state.parallelism,
    running: state.running,
    items: state.queue.map(({ controller, ...item }) => item),
  });
  let lastQueueEmit = 0;
  function emitQueue(force) {
    if (!force && now() - lastQueueEmit < 200) return;
    lastQueueEmit = now();
    emit({ type: "ollama.queue", ...snapshot() });
  }

  function queueAdd(params) {
    const names = Array.isArray(params.names) ? params.names : [params.name];
    for (const name of names) requireModel(name);
    for (const name of names) {
      if (state.queue.some((item) => item.name === name && ["queued", "pulling"].includes(item.state))) continue;
      if (state.queue.length >= LIMITS.queueItems) throw new Error("QUEUE_FULL");
      state.queue.push({ id: `p${++state.sequence}`, name, state: "queued", completed: 0, total: 0, status: "", error: null, sizeHint: Number(params.sizes?.[name]) || null });
    }
    emitQueue(true);
    return snapshot();
  }

  async function pullOne(item) {
    item.state = "pulling";
    item.controller = new AbortController();
    emitQueue(true);
    const digests = {};
    try {
      const response = await fetchImpl(`${BASE}/api/pull`, {
        method: "POST",
        redirect: "error",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ model: item.name, stream: true }),
        signal: item.controller.signal,
      });
      if (!response.ok) {
        const text = await readBounded(response, 64 * 1024).catch(() => "");
        let message = `HTTP_${response.status}`;
        try { message = JSON.parse(text).error || message; } catch {}
        throw new Error(String(message).slice(0, 300));
      }
      let succeeded = false;
      await readNdjson(response, (line) => {
        if (line.error) throw new Error(String(line.error).slice(0, 300));
        if (typeof line.status === "string") item.status = line.status.slice(0, 120);
        if (typeof line.digest === "string" && Number.isFinite(line.total)) {
          digests[line.digest] = { total: line.total, completed: Number(line.completed) || 0 };
          const parts = Object.values(digests);
          item.total = parts.reduce((n, p) => n + p.total, 0);
          item.completed = parts.reduce((n, p) => n + Math.min(p.completed, p.total), 0);
        }
        if (line.status === "success") succeeded = true;
        emitQueue(false);
      });
      if (!succeeded) throw new Error("The pull ended before Ollama reported success");
      item.state = "done";
    } catch (error) {
      if (item.controller.signal.aborted) {
        item.state = "cancelled";
        item.error = "Stopped. Parts already downloaded may stay on disk and are reused by the next pull.";
      } else {
        item.state = "failed";
        item.error = String(error.message || "Pull failed").slice(0, 300);
      }
    } finally {
      delete item.controller;
      emitQueue(true);
    }
  }

  async function pump() {
    if (state.running) return;
    state.running = true;
    emitQueue(true);
    const active = new Set();
    try {
      for (;;) {
        while (active.size < state.parallelism) {
          const next = state.queue.find((item) => item.state === "queued");
          if (!next) break;
          const task = pullOne(next).finally(() => active.delete(task));
          active.add(task);
        }
        if (active.size === 0) break;
        await Promise.race(active);
      }
    } finally {
      state.running = false;
      emitQueue(true);
    }
  }

  function queueCancel(params) {
    const item = state.queue.find((x) => x.id === params.id);
    if (!item) throw new Error("NOT_FOUND");
    if (item.state === "queued") {
      item.state = "cancelled";
      item.error = null;
    } else if (item.state === "pulling") item.controller?.abort();
    emitQueue(true);
    return snapshot();
  }

  function queueRemove(params) {
    const index = state.queue.findIndex((x) => x.id === params.id);
    if (index < 0) throw new Error("NOT_FOUND");
    if (state.queue[index].state === "pulling") throw new Error("PULL_ACTIVE");
    state.queue.splice(index, 1);
    emitQueue(true);
    return snapshot();
  }

  // ----- chat -----

  async function chatSend(params) {
    const model = requireModel(params.model);
    const messages = validateChatMessages(params.messages);
    const chatId = typeof params.chatId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(params.chatId) ? params.chatId : null;
    if (!chatId) throw new Error("INVALID_CHAT");
    if (state.chats.has(chatId)) throw new Error("CHAT_BUSY");
    if (state.chats.size >= LIMITS.parallelismMax) throw new Error("CHAT_LIMIT");
    const controller = new AbortController();
    state.chats.set(chatId, controller);
    (async () => {
      let chars = 0;
      try {
        const response = await fetchImpl(`${BASE}/api/chat`, {
          method: "POST",
          redirect: "error",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ model, messages, stream: true }),
          signal: controller.signal,
        });
        if (!response.ok) {
          const text = await readBounded(response, 64 * 1024).catch(() => "");
          let message = `HTTP_${response.status}`;
          try { message = JSON.parse(text).error || message; } catch {}
          throw new Error(String(message).slice(0, 300));
        }
        let stats = null;
        await readNdjson(response, (line) => {
          if (line.error) throw new Error(String(line.error).slice(0, 300));
          const delta = typeof line.message?.content === "string" ? line.message.content : "";
          if (delta) {
            chars += delta.length;
            if (chars > LIMITS.chatTotalChars) throw new Error("RESPONSE_TOO_LARGE");
            emit({ type: "ollama.chat", chatId, delta });
          }
          if (line.done) stats = { evalCount: Number(line.eval_count) || 0, totalDuration: Number(line.total_duration) || 0 };
        });
        emit({ type: "ollama.chat", chatId, done: true, stats });
      } catch (error) {
        const stopped = controller.signal.aborted;
        emit({ type: "ollama.chat", chatId, done: true, stopped, error: stopped ? null : String(error.message || "Chat failed").slice(0, 300) });
      } finally {
        state.chats.delete(chatId);
      }
    })();
    return { chatId, started: true };
  }

  async function handle(operation, rawParams) {
    const params = boundParams(rawParams);
    switch (operation) {
      case "status":
        return status();
      case "start":
        return start();
      case "installed": {
        const [tags, ps] = await Promise.all([local("/api/tags"), local("/api/ps").catch(() => ({ models: [] }))]);
        const loaded = new Set((Array.isArray(ps.models) ? ps.models : []).map((m) => m?.name));
        const models = (Array.isArray(tags.models) ? tags.models : [])
          .filter((m) => m && validModelName(m.name))
          .slice(0, 500)
          .map((m) => ({
            name: m.name,
            size: Number(m.size) || null,
            digest: typeof m.digest === "string" ? m.digest.slice(0, 80) : null,
            modifiedAt: typeof m.modified_at === "string" ? m.modified_at : null,
            family: typeof m.details?.family === "string" ? m.details.family.slice(0, 40) : null,
            parameterSize: typeof m.details?.parameter_size === "string" ? m.details.parameter_size.slice(0, 20) : null,
            quantization: typeof m.details?.quantization_level === "string" ? m.details.quantization_level.slice(0, 20) : null,
            loaded: loaded.has(m.name),
          }));
        return { models };
      }
      case "show": {
        const value = await local("/api/show", { method: "POST", body: { model: requireModel(params.name) } });
        return {
          details: value.details || null,
          capabilities: Array.isArray(value.capabilities) ? value.capabilities.slice(0, 20) : [],
          license: typeof value.license === "string" ? value.license.slice(0, 4000) : null,
        };
      }
      case "delete":
        if (params.confirmed !== true) throw new Error("CONFIRMATION_REQUIRED");
        await local("/api/delete", { method: "DELETE", body: { model: requireModel(params.name) } });
        return { ok: true };
      case "hardware":
        return hardware(params.force === true);
      case "fit": {
        const hw = await hardware(false);
        return fitVerdict({ sizeBytes: Number(params.size), ramBytes: hw.ramBytes, vramBytes: hw.vramBytes, freeDiskBytes: hw.freeDiskBytes, installed: params.installed === true });
      }
      case "catalogue.get":
        return describeCache(readCache(), { origin: "cache" });
      case "catalogue.refresh":
        return catalogueRefresh();
      case "store": {
        const catalogue = params.refresh === true ? await catalogueRefresh() : describeCache(readCache(), { origin: "cache" });
        const hw = await hardware(false);
        let installed = [];
        try {
          installed = (await handle("installed", {})).models;
        } catch {}
        return buildStore(catalogue, hw, installed);
      }
      case "installer.check":
        return installerCheck();
      case "installer.download":
        return installerDownload();
      case "installer.cancel":
        state.download?.abort();
        return { ok: true };
      case "installer.run":
        return installerRun(params);
      case "queue.list":
        return snapshot();
      case "queue.add":
        return queueAdd(params);
      case "queue.start":
        void pump();
        return snapshot();
      case "queue.cancel":
        return queueCancel(params);
      case "queue.remove":
        return queueRemove(params);
      case "queue.clear":
        state.queue = state.queue.filter((x) => ["queued", "pulling"].includes(x.state));
        emitQueue(true);
        return snapshot();
      case "queue.configure": {
        const value = Number(params.parallelism);
        if (!Number.isInteger(value) || value < 1 || value > LIMITS.parallelismMax) throw new Error("INVALID_REQUEST");
        state.parallelism = value;
        emitQueue(true);
        void (state.queue.some((x) => x.state === "queued") && state.running ? pump() : null);
        return snapshot();
      }
      case "chat.send":
        return chatSend(params);
      case "chat.stop": {
        state.chats.get(params.chatId)?.abort();
        return { ok: true };
      }
      default:
        throw new Error("INVALID_REQUEST");
    }
  }

  return { handle, state };
}

function registerOllamaIpc({ ipcMain, app, trusted, getWindow }) {
  const emit = (event) => {
    const window = getWindow?.();
    if (window && !window.isDestroyed() && !window.webContents.isDestroyed()) window.webContents.send("material:event", event);
  };
  let service = null;
  ipcMain.handle("material:ollama", async (event, operation, params = {}) => {
    if (!trusted(event) || typeof operation !== "string" || operation.length > 40) throw new Error("INVALID_REQUEST");
    service ||= createOllamaService({ userData: app.getPath("userData"), emit });
    return service.handle(operation, params);
  });
}

module.exports = {
  registerOllamaIpc,
  createOllamaService,
  validModelName,
  boundParams,
  validateChatMessages,
  parseLibraryIndex,
  parseTagsPage,
  parseSize,
  parseGpuJson,
  parseWmic,
  fitVerdict,
  buildStore,
  quantOf,
  LIMITS,
};

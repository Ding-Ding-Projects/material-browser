const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const {
  createOllamaService,
  validModelName,
  boundParams,
  validateChatMessages,
  parseLibraryIndex,
  parseTagsPage,
  parseGpuJson,
  parseWmic,
  fitVerdict,
  buildStore,
  LIMITS,
} = require("./ollama.cjs");

const GB = 1e9;
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "ollama-"));
const responseOf = (body, status = 200) => new Response(body, { status, headers: { "content-type": "text/html" } });

test("model names accept library forms and reject anything that could reshape a request", () => {
  for (const name of ["llama3.2", "llama3.2:1b", "qwen2.5:7b-instruct-q4_K_M", "library/mistral:latest", "nomic-embed-text"])
    assert.equal(validModelName(name), true, name);
  for (const name of ["", "Llama3", "../etc", "a/../b", "a b", "a:b:c", "a/b/c", "llama?x=1", "http://x", "-bad", "a:", ":tag", "x".repeat(81), 42, null, "a\nb", "a;rm"])
    assert.equal(validModelName(name), false, String(name));
});

test("payloads are bounded", async () => {
  assert.deepEqual(boundParams(undefined), {});
  assert.throws(() => boundParams([]), /INVALID_REQUEST/);
  assert.throws(() => boundParams("x"), /INVALID_REQUEST/);
  assert.throws(() => boundParams({ big: "x".repeat(LIMITS.params + 1) }), /REQUEST_TOO_LARGE/);
  assert.throws(() => validateChatMessages([]), /INVALID_CHAT/);
  assert.throws(() => validateChatMessages([{ role: "tool", content: "x" }]), /INVALID_CHAT/);
  assert.throws(() => validateChatMessages([{ role: "user", content: "x".repeat(LIMITS.chatMessageChars + 1) }]), /INVALID_CHAT/);
  assert.throws(() => validateChatMessages(Array.from({ length: LIMITS.chatMessages + 1 }, () => ({ role: "user", content: "x" }))), /INVALID_CHAT/);
  const many = Array.from({ length: 10 }, () => ({ role: "user", content: "x".repeat(LIMITS.chatMessageChars) }));
  assert.throws(() => validateChatMessages(many), /REQUEST_TOO_LARGE/);
  assert.deepEqual(validateChatMessages([{ role: "user", content: "hi", extra: 1 }]), [{ role: "user", content: "hi" }]);

  const service = createOllamaService({ userData: tmp(), fetchImpl: async () => { throw new Error("no network in tests"); } });
  await assert.rejects(service.handle("status", { pad: "x".repeat(LIMITS.params + 10) }), /REQUEST_TOO_LARGE/);
  await assert.rejects(service.handle("show", { name: "../../x" }), /INVALID_MODEL_NAME/);
  await assert.rejects(service.handle("queue.add", { names: ["ok", "Bad Name"] }), /INVALID_MODEL_NAME/);
  await assert.rejects(service.handle("unknown-op", {}), /INVALID_REQUEST/);
  await assert.rejects(service.handle("delete", { name: "llama3.2" }), /CONFIRMATION_REQUIRED/);
  await assert.rejects(service.handle("installer.run", {}), /CONFIRMATION_REQUIRED/);
});

test("oversized local API answers are refused", async () => {
  const service = createOllamaService({
    userData: tmp(),
    fetchImpl: async () => new Response("x".repeat(LIMITS.json + 1), { status: 200 }),
  });
  await assert.rejects(service.handle("installed", {}), /RESPONSE_TOO_LARGE/);
});

test("fit verdict is Unknown when any measurement is missing", () => {
  const hw = { ramBytes: 32 * GB, vramBytes: 12 * GB, freeDiskBytes: 500 * GB };
  assert.equal(fitVerdict({ ...hw, sizeBytes: null }).verdict, "unknown");
  assert.equal(fitVerdict({ ...hw, sizeBytes: undefined }).verdict, "unknown");
  assert.equal(fitVerdict({ ...hw, sizeBytes: 0 }).verdict, "unknown");
  assert.equal(fitVerdict({ ...hw, sizeBytes: 4 * GB, ramBytes: null }).verdict, "unknown");
  assert.equal(fitVerdict({ ...hw, sizeBytes: 4 * GB, vramBytes: null }).verdict, "unknown");
  assert.equal(fitVerdict({ ...hw, sizeBytes: 4 * GB, freeDiskBytes: null }).verdict, "unknown");
  // Installed models do not need disk space for a download.
  assert.equal(fitVerdict({ ...hw, sizeBytes: 4 * GB, freeDiskBytes: null, installed: true }).verdict, "well");
});

test("fit verdict rules are conservative and use size and hardware only", () => {
  const hw = { ramBytes: 16 * GB, vramBytes: 8 * GB, freeDiskBytes: 100 * GB };
  assert.equal(fitVerdict({ ...hw, sizeBytes: 4 * GB }).verdict, "well");
  assert.equal(fitVerdict({ ...hw, sizeBytes: 8 * GB }).verdict, "limits");
  assert.equal(fitVerdict({ ...hw, sizeBytes: 40 * GB }).verdict, "unlikely");
  assert.equal(fitVerdict({ ...hw, freeDiskBytes: 1 * GB, sizeBytes: 2 * GB }).verdict, "unlikely");
  assert.equal(fitVerdict({ ...hw, vramBytes: 0, sizeBytes: 2 * GB }).verdict, "limits");
  // The function has no name input at all; extra fields are ignored.
  assert.deepEqual(fitVerdict({ ...hw, sizeBytes: 4 * GB, name: "tiny:0.5b" }), fitVerdict({ ...hw, sizeBytes: 4 * GB, name: "huge:405b" }));
});

test("store rows never derive fit from the model name", () => {
  const hw = { ramBytes: 64 * GB, vramBytes: 24 * GB, freeDiskBytes: 900 * GB };
  const catalogue = {
    available: true,
    models: [{ name: "tiny", description: "", capabilities: [], tags: [{ tag: "0.5b", size: null, digest: null, context: null }] }],
  };
  const store = buildStore(catalogue, hw, []);
  assert.equal(store.rows[0].fit.verdict, "unknown");
  const withSize = buildStore(catalogue, hw, [{ name: "tiny:0.5b", size: 400e6, quantization: "Q4_0" }]);
  assert.equal(withSize.rows[0].fit.verdict, "well");
  assert.equal(withSize.rows[0].installed, true);
});

test("installed models are merged even when the catalogue is unavailable", () => {
  const hw = { ramBytes: 16 * GB, vramBytes: null, freeDiskBytes: 10 * GB };
  const store = buildStore({ available: false }, hw, [{ name: "mine:latest", size: 2 * GB, quantization: "Q4_K_M" }]);
  assert.equal(store.rows.length, 1);
  assert.equal(store.rows[0].source, "installed");
  assert.equal(store.rows[0].fit.verdict, "unknown");
});

test("catalogue parse failure reports unavailable and never invents models", async () => {
  assert.throws(() => parseLibraryIndex("<html><body>Changed layout</body></html>"), /CATALOGUE_UNPARSEABLE/);
  assert.throws(() => parseLibraryIndex(""), /CATALOGUE_UNPARSEABLE/);
  assert.throws(() => parseTagsPage("llama3.2", "<html></html>"), /CATALOGUE_UNPARSEABLE/);
  const service = createOllamaService({
    userData: tmp(),
    fetchImpl: async (url) => {
      if (String(url).startsWith("http://127.0.0.1")) throw Object.assign(new Error("fetch failed"), { cause: { code: "ECONNREFUSED" } });
      return responseOf("<html><body>A redesigned page</body></html>");
    },
  });
  const result = await service.handle("catalogue.refresh", {});
  assert.equal(result.available, false);
  assert.equal(result.refreshFailed, "unparseable");
  assert.equal(result.models, undefined);
  const store = await service.handle("store", {});
  assert.equal(store.rows.length, 0);
});

test("catalogue parses names and tags defensively and caches with retrieval time", async () => {
  const index = `<li><a href="/library/llama3.2" class="g"><p class="max-w-lg x">Meta&#39;s small model</p><span class="b">tools</span></a></li>
    <li><a href="/library/BAD NAME">x</a></li><li><a href="/library/qwen3" class="g"><p class="max-w-lg">Q</p></a></li>`;
  const tags = (name) => `<a href="/library/${name}:latest" class="md:hidden"><span class="font-mono">
    a80c4f17acd5</span> • 2.0GB • 128K context window  •</a><a href="/library/${name}:1b">x</a>`;
  const userData = tmp();
  let online = true;
  const service = createOllamaService({
    userData,
    now: () => 1_000_000,
    fetchImpl: async (url) => {
      if (!online) throw new Error("fetch failed");
      const u = String(url);
      if (u === "https://ollama.com/library") return responseOf(index);
      if (u.endsWith("/llama3.2/tags")) return responseOf(tags("llama3.2"));
      return responseOf("nothing", 500);
    },
  });
  const fresh = await service.handle("catalogue.refresh", {});
  assert.equal(fresh.available, true);
  assert.equal(fresh.modelCount, 2);
  assert.equal(fresh.retrievedAt, 1_000_000);
  assert.equal(fresh.pageCount, 2);
  assert.equal(fresh.complete, false);
  assert.deepEqual(fresh.failures.map((f) => f.name), ["qwen3"]);
  const llama = fresh.models.find((m) => m.name === "llama3.2");
  assert.equal(llama.description, "Meta's small model");
  assert.deepEqual(llama.tags[0], { tag: "latest", digest: "a80c4f17acd5", size: 2e9, context: "128K" });
  assert.equal(llama.tags[1].size, null);
  assert.ok(fs.existsSync(path.join(userData, "ollama", "catalogue.json")));
  online = false;
  const offline = await service.handle("catalogue.refresh", {});
  assert.equal(offline.available, true);
  assert.equal(offline.origin, "cache");
  assert.equal(offline.refreshFailed, "offline");
  assert.equal(typeof offline.ageMs, "number");
});

test("graphics detection output is parsed and 32-bit adapter memory is flagged as a lower bound", () => {
  assert.deepEqual(parseGpuJson('{"Name":"GPU A","AdapterRAM":4293918720}'), [{ name: "GPU A", vram: 4293918720, capped: true }]);
  assert.deepEqual(parseGpuJson('[{"Name":"GPU B","AdapterRAM":null}]'), [{ name: "GPU B", vram: null, capped: false }]);
  assert.equal(parseGpuJson("not json"), null);
  assert.deepEqual(parseWmic("AdapterRAM  Name\r\n2147483648  GPU C\r\n"), [{ name: "GPU C", vram: 2147483648, capped: false }]);
  assert.equal(parseWmic("garbage"), null);
});

test("status keeps missing, stopped and unhealthy distinct", async () => {
  const refused = async () => { throw Object.assign(new TypeError("fetch failed"), { cause: { code: "ECONNREFUSED" } }); };
  const missing = createOllamaService({ userData: tmp(), platform: "linux", fetchImpl: refused });
  const s1 = await missing.handle("status", {});
  assert.ok(["missing", "stopped"].includes(s1.state));
  const wrong = createOllamaService({ userData: tmp(), fetchImpl: async () => new Response("{}", { status: 200 }) });
  assert.equal((await wrong.handle("status", {})).state, "unhealthy");
  const ok = createOllamaService({ userData: tmp(), fetchImpl: async () => new Response('{"version":"0.12.0"}', { status: 200 }) });
  assert.deepEqual((await ok.handle("status", {})).state, "running");
});

test("installer only accepts the official asset and reports unverified integrity when no hash is published", async () => {
  const installer = Buffer.from("installer-bytes");
  const release = (asset) => JSON.stringify({ tag_name: "v1.0.0", assets: [asset] });
  const official = { name: "OllamaSetup.exe", size: installer.length, browser_download_url: "https://github.com/ollama/ollama/releases/download/v1.0.0/OllamaSetup.exe" };
  let spawned = null;
  const make = (asset) =>
    createOllamaService({
      userData: tmp(),
      platform: "win32",
      spawnImpl: (file, args) => { spawned = { file, args }; return { on() {}, unref() {} }; },
      fetchImpl: async (url) => (String(url).includes("api.github.com") ? new Response(release(asset)) : new Response(installer)),
    });
  await assert.rejects(make({ ...official, browser_download_url: "https://example.com/OllamaSetup.exe" }).handle("installer.check", {}), /INSTALLER_URL_UNEXPECTED/);
  const plain = make(official);
  const plan = await plain.handle("installer.check", {});
  assert.equal(plan.sha256, null);
  const done = await plain.handle("installer.download", {});
  assert.equal(done.integrity, "unverified");
  await assert.rejects(plain.handle("installer.run", {}), /CONFIRMATION_REQUIRED/);
  assert.equal(spawned, null);
  await plain.handle("installer.run", { confirmed: true });
  assert.deepEqual(spawned.args, []);

  const bad = make({ ...official, digest: `sha256:${"0".repeat(64)}` });
  await bad.handle("installer.check", {});
  await assert.rejects(bad.handle("installer.download", {}), /INSTALLER_HASH_MISMATCH/);
});

test("pull queue copy contains no payment wording", () => {
  const page = fs.readFileSync(path.join(__dirname, "../../src/app/Ollama.tsx"), "utf8");
  const match = /export const QUEUE_COPY = \[([\s\S]*?)\];/.exec(page);
  assert.ok(match, "QUEUE_COPY is exported from the page");
  const copy = match[1] + JSON.stringify(Object.values(require("./ollama.cjs")).filter((v) => typeof v === "string"));
  const service = fs.readFileSync(path.join(__dirname, "ollama.cjs"), "utf8");
  const queueSource = service.slice(service.indexOf("// ----- pull queue -----"), service.indexOf("// ----- chat -----"));
  const banned = /\b(price|prices|pricing|paid|pay|payment|purchase|buy|checkout|cart|subscribe|subscription|credit card|billing|\$\d|USD|HKD)\b/i;
  const allowed = copy.replace("Nothing here costs money", "");
  assert.doesNotMatch(allowed, banned);
  assert.doesNotMatch(queueSource, banned);
});

test("queue has bounded parallelism, cancels and reports honest outcomes", async () => {
  const events = [];
  let releasePull;
  const hold = new Promise((r) => (releasePull = r));
  const service = createOllamaService({
    userData: tmp(),
    emit: (e) => events.push(e),
    fetchImpl: async (url, init) => {
      const body = JSON.parse(init.body);
      if (body.model === "fails") return new Response('{"status":"pulling manifest"}\n{"error":"file does not exist"}\n');
      if (body.model === "partial") return new Response('{"status":"pulling manifest"}\n');
      if (body.model === "slow") {
        return new Response(new ReadableStream({
          async start(controller) {
            controller.enqueue(new TextEncoder().encode('{"status":"pulling","digest":"d","total":100,"completed":40}\n'));
            init.signal.addEventListener("abort", () => controller.error(new Error("aborted")));
            await hold;
          },
        }));
      }
      return new Response('{"status":"pulling","digest":"d","total":10,"completed":10}\n{"status":"success"}\n');
    },
  });
  await assert.rejects(service.handle("queue.configure", { parallelism: 9 }), /INVALID_REQUEST/);
  await service.handle("queue.add", { names: ["ok", "fails", "partial", "slow", "later"] });
  assert.equal((await service.handle("queue.list", {})).parallelism, 1);
  await service.handle("queue.cancel", { id: "p5" });
  await service.handle("queue.start", {});
  for (let i = 0; i < 50 && !service.state.queue.find((x) => x.name === "slow" && x.completed === 40); i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(service.state.queue.filter((x) => x.state === "pulling").length, 1);
  await service.handle("queue.cancel", { id: "p4" });
  releasePull();
  for (let i = 0; i < 50 && service.state.running; i++) await new Promise((r) => setTimeout(r, 10));
  const states = Object.fromEntries((await service.handle("queue.list", {})).items.map((x) => [x.name, x.state]));
  assert.deepEqual(states, { ok: "done", fails: "failed", partial: "failed", slow: "cancelled", later: "cancelled" });
  assert.ok(events.some((e) => e.type === "ollama.queue"));
});

test("chat streams tokens as events and can be stopped", async () => {
  const events = [];
  const service = createOllamaService({
    userData: tmp(),
    emit: (e) => events.push(e),
    fetchImpl: async () => new Response('{"message":{"content":"Hel"}}\n{"message":{"content":"lo"}}\n{"done":true,"eval_count":2}\n'),
  });
  await assert.rejects(service.handle("chat.send", { chatId: "a", model: "BAD", messages: [{ role: "user", content: "hi" }] }), /INVALID_MODEL_NAME/);
  await service.handle("chat.send", { chatId: "a", model: "llama3.2", messages: [{ role: "user", content: "hi" }] });
  for (let i = 0; i < 50 && !events.some((e) => e.done); i++) await new Promise((r) => setTimeout(r, 10));
  assert.equal(events.filter((e) => e.delta).map((e) => e.delta).join(""), "Hello");
  assert.equal(events.at(-1).done, true);

  const stopEvents = [];
  const stoppable = createOllamaService({
    userData: tmp(),
    emit: (e) => stopEvents.push(e),
    fetchImpl: async (_url, init) =>
      new Response(new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('{"message":{"content":"partial"}}\n'));
          init.signal.addEventListener("abort", () => controller.error(new Error("aborted")));
        },
      })),
  });
  await stoppable.handle("chat.send", { chatId: "b", model: "llama3.2", messages: [{ role: "user", content: "hi" }] });
  for (let i = 0; i < 50 && !stopEvents.some((e) => e.delta); i++) await new Promise((r) => setTimeout(r, 10));
  await stoppable.handle("chat.stop", { chatId: "b" });
  for (let i = 0; i < 50 && !stopEvents.some((e) => e.done); i++) await new Promise((r) => setTimeout(r, 10));
  assert.deepEqual(stopEvents.at(-1), { type: "ollama.chat", chatId: "b", done: true, stopped: true, error: null });
});

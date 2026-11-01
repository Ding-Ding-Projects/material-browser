function fail(code, message) {
  throw Object.assign(new Error(message), { code });
}
const BASE = "http://127.0.0.1:11434";
const ROUTES = new Set([
  "/api/version",
  "/api/tags",
  "/api/ps",
  "/api/show",
  "/api/pull",
  "/api/delete",
  "/api/copy",
]);
function modelName(value) {
  if (
    typeof value !== "string" ||
    value.length > 200 ||
    !/^(?:[A-Za-z0-9][A-Za-z0-9._-]*\/)?[A-Za-z0-9][A-Za-z0-9._-]*(?::[A-Za-z0-9][A-Za-z0-9._+-]*)?$/.test(
      value,
    )
  )
    fail("INVALID_MODEL", "Select an exact valid model tag");
  if (/(?:^|[-:])cloud(?:$|-)/i.test(value))
    fail(
      "CLOUD_MODEL_UNAVAILABLE",
      "Only local model operations are supported",
    );
  return value;
}
function createTransport(fetcher = globalThis.fetch) {
  async function request(
    route,
    {
      method = "GET",
      body,
      signal,
      stream = false,
      maxBytes = 8 * 1024 ** 2,
      onFrame,
    } = {},
  ) {
    if (!ROUTES.has(route))
      fail("API_ROUTE_UNAVAILABLE", "This local API route is not admitted");
    const payload = body === undefined ? undefined : JSON.stringify(body);
    if (payload && Buffer.byteLength(payload) > 1024 ** 2)
      fail("REQUEST_TOO_LARGE", "API request exceeds its bound");
    let response;
    try {
      response = await fetcher(BASE + route, {
        method,
        body: payload,
        headers: payload ? { "content-type": "application/json" } : undefined,
        redirect: "error",
        signal: signal
          ? AbortSignal.any([
              signal,
              AbortSignal.timeout(stream ? 3600000 : 10000),
            ])
          : AbortSignal.timeout(10000),
      });
    } catch (error) {
      if (signal?.aborted) fail("CANCELLED", "Local operation cancelled");
      fail(
        error.cause?.code === "ECONNREFUSED"
          ? "SERVICE_STOPPED"
          : "API_UNAVAILABLE",
        "The fixed local Ollama endpoint did not answer",
      );
    }
    if (!response.ok)
      fail(
        response.status === 404 ? "MODEL_NOT_FOUND" : "API_REQUEST_FAILED",
        `Local Ollama returned HTTP ${response.status}`,
      );
    const decoder = new TextDecoder("utf-8", { fatal: true });
    let text = "";
    let bytes = 0;
    let frames = 0;
    let last;
    for await (const chunk of response.body || []) {
      bytes += chunk.length;
      if (bytes > maxBytes)
        fail("RESPONSE_TOO_LARGE", "Local response exceeds its bound");
      text += decoder.decode(chunk, { stream: true });
      if (stream) {
        let newline;
        while ((newline = text.indexOf("\n")) >= 0) {
          const line = text.slice(0, newline).trim();
          text = text.slice(newline + 1);
          if (!line) continue;
          if (line.length > 65536 || ++frames > 50000)
            fail("INVALID_RESPONSE", "Stream exceeds its frame bound");
          let frame;
          try {
            frame = JSON.parse(line);
          } catch {
            fail("INVALID_RESPONSE", "Local stream contains malformed JSON");
          }
          if (frame.error)
            fail("PULL_FAILED", "Ollama reported an unsuccessful pull");
          last = frame;
          await onFrame?.(frame);
        }
      }
      if (text.length > (stream ? 65536 : maxBytes))
        fail("RESPONSE_TOO_LARGE", "Local response buffer exceeds its bound");
    }
    text += decoder.decode();
    if (stream) {
      if (text.trim()) {
        let frame;
        try {
          frame = JSON.parse(text);
        } catch {
          fail("INVALID_RESPONSE", "Local stream ended with malformed JSON");
        }
        if (frame.error)
          fail("PULL_FAILED", "Ollama reported an unsuccessful pull");
        last = frame;
        await onFrame?.(frame);
      }
      return last;
    }
    if (!text.trim()) return {};
    try {
      return JSON.parse(text);
    } catch {
      fail("INVALID_RESPONSE", "Local API returned malformed JSON");
    }
  }
  return { request };
}
module.exports = { createTransport, modelName, fail, BASE };

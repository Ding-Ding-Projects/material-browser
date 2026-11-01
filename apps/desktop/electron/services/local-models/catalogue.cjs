const crypto = require("node:crypto");
const { fail } = require("./transport.cjs");
const { readJson, writeJson } = require("./storage.cjs");
const HOME = "https://ollama.com/library";
function createCatalogue({
  root,
  fetch: fetcher = globalThis.fetch,
  emit = () => {},
}) {
  async function get(url, signal) {
    const parsed = new URL(url);
    if (
      parsed.origin !== "https://ollama.com" ||
      !/^\/library(?:\/[A-Za-z0-9._:-]+)?(?:\/tags)?$/.test(parsed.pathname) ||
      [...parsed.searchParams.keys()].some((key) => key !== "page")
    )
      fail(
        "CATALOGUE_SOURCE_INVALID",
        "Only official library and tag pages are admitted",
      );
    const response = await fetcher(url, {
      redirect: "error",
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
    });
    if (!response.ok)
      fail(
        "CATALOGUE_UNAVAILABLE",
        `Official catalogue returned ${response.status}`,
      );
    const chunks = [];
    let size = 0;
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > 8 * 1024 ** 2)
        fail("CATALOGUE_TOO_LARGE", "Catalogue page exceeds 8 MiB");
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    const html = bytes.toString("utf8");
    if (!/<\/html>/i.test(html))
      fail(
        "CATALOGUE_INCOMPLETE",
        "Official page ended without its document boundary",
      );
    return {
      html,
      size,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      url,
    };
  }
  function links(html) {
    return [...html.matchAll(/href=["']([^"']+)["']/g)].map((match) =>
      match[1].replaceAll("&amp;", "&"),
    );
  }
  function nextPage(html, current) {
    const match =
      /<a\b[^>]*rel=["']next["'][^>]*href=["']([^"']+)["']/i.exec(html) ||
      /<a\b[^>]*href=["']([^"']+)["'][^>]*rel=["']next["']/i.exec(html);
    if (!match) return null;
    const next = new URL(match[1].replaceAll("&amp;", "&"), current);
    return next.href;
  }
  async function snapshot() {
    const value = await readJson(root, "catalogue.json", null);
    return value
      ? { ...value, stale: true }
      : {
          models: [],
          source: HOME,
          retrievedAt: null,
          complete: false,
          stale: true,
          reason: "No complete official catalogue has been retained yet",
        };
  }
  async function refresh(signal) {
    const controller = new AbortController();
    const requestSignal = signal
      ? AbortSignal.any([signal, controller.signal])
      : controller.signal;
    const pages = [];
    let bytes = 0;
    const visited = new Set();
    async function page(url) {
      if (visited.has(url) || visited.size >= 2048)
        fail(
          "CATALOGUE_INCOMPLETE",
          "Catalogue pagination loops or exceeds its bound",
        );
      visited.add(url);
      const result = await get(url, requestSignal);
      bytes += result.size;
      if (bytes > 256 * 1024 ** 2)
        fail("CATALOGUE_TOO_LARGE", "Catalogue refresh exceeds 256 MiB");
      pages.push({ url, sha256: result.sha256 });
      emit({
        type: "local-models.catalogue-progress",
        pages: pages.length,
        bytes,
      });
      return result.html;
    }
    try {
      const names = new Set();
      let url = HOME;
      while (url) {
        const html = await page(url);
        for (const link of links(html)) {
          const match = /^\/library\/([A-Za-z0-9][A-Za-z0-9._-]*)$/.exec(link);
          if (match) names.add(match[1]);
        }
        url = nextPage(html, url);
      }
      if (!names.size || names.size > 2000)
        fail(
          "CATALOGUE_INCOMPLETE",
          "No complete bounded model inventory could be parsed",
        );
      const models = [];
      const pending = [...names];
      async function worker() {
        while (pending.length) {
          const name = pending.shift();
          const tags = new Set();
          let url = `${HOME}/${name}/tags`;
          while (url) {
            const html = await page(url);
            for (const link of links(html)) {
              const match =
                /^\/library\/([A-Za-z0-9][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._+-]*)$/.exec(
                  link,
                );
              if (match && match[1].startsWith(name + ":")) tags.add(match[1]);
            }
            url = nextPage(html, url);
          }
          if (!tags.size)
            fail(
              "CATALOGUE_INCOMPLETE",
              "A model tag inventory is absent or the official markup changed",
            );
          models.push({
            name,
            model: name,
            source: `${HOME}/${name}`,
            tags: [...tags].sort().map((tag) => ({
              name: tag,
              model: tag,
              size: null,
              details: {},
              capabilities: [],
              localAvailable: !/(?:^|[-:])cloud(?:$|-)/i.test(tag),
              fit: {
                verdict: "Unknown",
                reason:
                  "Hardware, context and exact blob metadata are not yet verified",
              },
            })),
          });
        }
      }
      const settled = await Promise.allSettled([
        worker().catch((e) => {
          controller.abort();
          throw e;
        }),
        worker().catch((e) => {
          controller.abort();
          throw e;
        }),
      ]);
      const rejected = settled.find((result) => result.status === "rejected");
      if (rejected) throw rejected.reason;
      models.sort((a, b) => a.name.localeCompare(b.name));
      const record = {
        models,
        variants: models.flatMap((family) =>
          family.tags.map((tag) => ({
            ...tag,
            family: family.name,
            source: family.source,
          })),
        ),
        source: HOME,
        retrievedAt: new Date().toISOString(),
        lastSuccessfulRefresh: new Date().toISOString(),
        complete: true,
        stale: false,
        completeness:
          "All discovered official library pages and their tag pages read to terminal pagination; no community catalogue completeness claim",
        pageCount: pages.length,
        tagCount: models.reduce((sum, m) => sum + m.tags.length, 0),
        pages,
        sourceRevision: crypto
          .createHash("sha256")
          .update(JSON.stringify(pages))
          .digest("hex"),
      };
      await writeJson(root, "catalogue.json", record);
      return record;
    } catch (error) {
      const prior = await snapshot();
      return {
        ...prior,
        stale: true,
        refreshError: error.code || "CATALOGUE_UNAVAILABLE",
        reason: "Refresh did not complete; retained data is unchanged",
      };
    }
  }
  return { snapshot, refresh };
}
module.exports = { createCatalogue };

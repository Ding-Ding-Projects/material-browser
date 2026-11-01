const test = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { createCatalogue } = require("./catalogue.cjs");
const MANIFEST =
  "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const META = "https://piston-meta.mojang.com/version.json";
const PAPER = "https://fill.papermc.io/v3/projects/paper";
const FABRIC = "https://meta.fabricmc.net/v2/versions";
function fixture(extra = {}) {
  const jar = Buffer.from("test server");
  const metadata = Buffer.from(
    JSON.stringify({
      id: "1.21.4",
      javaVersion: { majorVersion: 21 },
      downloads: {
        server: {
          url: "https://piston-data.mojang.com/server.jar",
          sha1: crypto.createHash("sha1").update(jar).digest("hex"),
          size: jar.length,
        },
      },
    }),
  );
  const routes = {
    [MANIFEST]: JSON.stringify({
      latest: { release: "1.21.4" },
      versions: [
        {
          id: "1.21.4",
          type: "release",
          url: META,
          sha1: crypto.createHash("sha1").update(metadata).digest("hex"),
        },
      ],
    }),
    [META]: metadata,
    ...extra,
  };
  return createCatalogue(async (url) => {
    if (!Object.hasOwn(routes, url)) return new Response("", { status: 404 });
    const body = routes[url];
    return new Response(
      Buffer.isBuffer(body) || typeof body === "string"
        ? body
        : JSON.stringify(body),
    );
  });
}
test("Paper resolution binds exact stable build and published SHA-256", async () => {
  const bytes = Buffer.from("paper distribution");
  const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const url = "https://fill-data.papermc.io/paper.jar";
  const catalogue = fixture({
    [PAPER]: { versions: { 1.21: ["1.21.4"] } },
    [`${PAPER}/versions/1.21.4/builds`]: [
      {
        id: 42,
        channel: "STABLE",
        downloads: {
          "server:default": { url, size: bytes.length, checksums: { sha256 } },
        },
      },
    ],
    [url]: bytes,
  });
  const list = await catalogue.discover(undefined, { flavour: "paper" });
  assert.equal(list.versions.length, 1);
  const resolved = await catalogue.resolve("1.21.4", undefined, {
    flavour: "paper",
  });
  assert.equal(resolved.buildId, 42);
  assert.equal(resolved.integrityKnown, true);
  assert.equal(resolved.download.sha256, sha256);
  assert.deepEqual(await catalogue.download(resolved.download), bytes);
});
test("Paper never silently falls back to an experimental build", async () => {
  const catalogue = fixture({
    [`${PAPER}/versions/1.21.4/builds`]: [{ id: 1, channel: "ALPHA" }],
  });
  const result = await catalogue.resolve("1.21.4", undefined, {
    flavour: "paper",
  });
  assert.equal(result.available, false);
  assert.match(result.reason, /explicit selection/);
});
test("Fabric binds compatible loader and installer and discloses missing publisher integrity", async () => {
  const catalogue = fixture({
    [`${FABRIC}/loader/1.21.4`]: [
      { loader: { version: "0.16.10", stable: true } },
    ],
    [`${FABRIC}/installer`]: [{ version: "1.0.1", stable: true }],
  });
  const result = await catalogue.resolve("1.21.4", undefined, {
    flavour: "fabric",
  });
  assert.equal(result.integrityKnown, false);
  assert.equal(result.loaderVersion, "0.16.10");
  assert.match(
    result.download.url,
    /1\.21\.4\/0\.16\.10\/1\.0\.1\/server\/jar$/,
  );
  assert.match(result.integrityNote, /not publisher integrity proof/);
});
test("selected incompatible Fabric loader is unavailable, never replaced silently", async () => {
  const catalogue = fixture({
    [`${FABRIC}/loader/1.21.4`]: [
      { loader: { version: "0.16.10", stable: true } },
    ],
    [`${FABRIC}/installer`]: [{ version: "1.0.1", stable: true }],
  });
  assert.equal(
    (
      await catalogue.resolve("1.21.4", undefined, {
        flavour: "fabric",
        loaderVersion: "wrong",
      })
    ).available,
    false,
  );
});
test("duplicate version identities fail complete Java catalogue refresh", async () => {
  const source = {
    id: "same",
    type: "release",
    url: META,
    sha1: "a".repeat(40),
  };
  const catalogue = createCatalogue(
    async () => new Response(JSON.stringify({ versions: [source, source] })),
  );
  await assert.rejects(catalogue.discover(), { code: "INVALID_CATALOGUE" });
});

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readStore, writeStore, folderFor } = require("./element-locks.cjs");

test("element locks live in their own folder apart from the vault", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "locks-"));
  assert.deepEqual(readStore(root, "locks"), {});
  writeStore(root, "locks", { a: { method: "pin" } });
  assert.deepEqual(readStore(root, "locks"), { a: { method: "pin" } });
  assert.equal(folderFor(root), path.join(root, "element-locks"));
  assert.equal(fs.existsSync(path.join(root, "vault")), false);
  fs.rmSync(folderFor(root), { recursive: true });
  assert.deepEqual(readStore(root, "locks"), {});
});

test("element lock store rejects unknown kinds, arrays and oversized records", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "locks-"));
  assert.throws(() => writeStore(root, "../vault", {}), /INVALID_REQUEST/);
  assert.throws(() => writeStore(root, "locks", []), /INVALID_REQUEST/);
  assert.throws(() => writeStore(root, "locks", { big: "x".repeat(300 * 1024) }), /REQUEST_TOO_LARGE/);
  assert.throws(() => readStore(root, "constructor"), /INVALID_REQUEST/);
});

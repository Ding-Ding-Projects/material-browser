import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PASSWORD_MANAGER_FORM,
  buildPasswordManager,
  databaseBasename,
  describePasswordManager,
  recommendedSource,
  sourceOptions,
} from "./password-manager-model.mjs";

test("disabled form sends no password manager and defaults keep extension and passkeys on", () => {
  assert.equal(buildPasswordManager(DEFAULT_PASSWORD_MANAGER_FORM), null);
  assert.equal(buildPasswordManager(null), null);
  const built = buildPasswordManager({
    ...DEFAULT_PASSWORD_MANAGER_FORM,
    enabled: true,
    databasePath: " C:\\Users\\demo\\Vault.KDBX ",
  });
  assert.deepEqual(built, {
    provider: "keepassxc",
    source: "installed",
    database: { mode: "existing", path: "C:\\Users\\demo\\Vault.KDBX" },
    extension: true,
    passkeys: true,
  });
  assert.equal(Object.hasOwn(built, "password"), false);
});

test("invalid paths and sources are rejected before any native request", () => {
  const base = { ...DEFAULT_PASSWORD_MANAGER_FORM, enabled: true };
  assert.throws(() => buildPasswordManager(base), /DATABASE_PATH_REQUIRED/);
  assert.throws(
    () => buildPasswordManager({ ...base, databasePath: "/x/vault.kdb" }),
    /DATABASE_PATH_INVALID/,
  );
  assert.throws(
    () => buildPasswordManager({ ...base, databasePath: "/x/v\u0001.kdbx" }),
    /DATABASE_PATH_INVALID/,
  );
  assert.throws(
    () =>
      buildPasswordManager({ ...base, databasePath: "/x/v.kdbx", source: "cloud" }),
    /PASSWORD_MANAGER_SOURCE_INVALID/,
  );
  const created = buildPasswordManager({
    ...base,
    databasePath: "/x/new.kdbx",
    databaseMode: "create",
    source: "wsl",
    extension: false,
    passkeys: false,
  });
  assert.equal(created.database.mode, "create");
  assert.equal(created.extension, false);
  assert.equal(created.passkeys, false);
});

test("recommended source prefers an installed KeePassXC, then WSL, then none", () => {
  assert.equal(recommendedSource({ installed: { proxy: "x" }, wslAvailable: true }), "installed");
  assert.equal(recommendedSource({ installed: null, wslAvailable: true }), "wsl");
  assert.equal(recommendedSource({ installed: null, wslAvailable: false }), "none");
  assert.equal(recommendedSource(undefined), "none");
  const options = sourceOptions({ installed: null, wslAvailable: false });
  assert.equal(options.every((o) => o.available === false && o.reason), true);
  assert.equal(sourceOptions({ installed: { proxy: "x" } })[0].available, true);
});

test("inspector facts redact the database path to its file name", () => {
  assert.equal(databaseBasename("C:\\Users\\demo\\Vault.kdbx"), "Vault.kdbx");
  assert.equal(databaseBasename("/home/demo/vault.kdbx"), "vault.kdbx");
  const facts = describePasswordManager({
    provider: "keepassxc",
    source: "wsl",
    database: { mode: "existing", path: "/home/demo/secret-folder/vault.kdbx" },
    extension: true,
    passkeys: false,
  });
  assert.deepEqual(facts.map(([k]) => k), [
    "Password manager",
    "Password manager source",
    "Database",
    "Browser extension",
    "Passkeys",
  ]);
  assert.equal(JSON.stringify(facts).includes("secret-folder"), false);
  assert.equal(facts[1][1], "WSL guest");
  assert.equal(facts[4][1], "Disabled");
  assert.deepEqual(describePasswordManager(null), []);
});

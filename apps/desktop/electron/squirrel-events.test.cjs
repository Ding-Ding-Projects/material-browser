const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { handleSquirrelEvent } = require("./squirrel-events.cjs");

function fixture(event, overrides = {}) {
  const exits = [], calls = [], reports = [], cleared = [];
  const child = new EventEmitter();
  let killed = 0, timeout;
  child.kill = () => { killed++; };
  const handled = handleSquirrelEvent({
    app: { exit: code => exits.push(code) },
    argv: ["MaterialBrowser.exe", event, "untrusted version ignored"],
    execPath: "C:\\Programs\\MaterialBrowser\\app-0.1.12\\MaterialBrowser.exe",
    platform: "win32",
    statFile: () => ({ isFile: () => true }),
    spawnProcess: (...args) => { calls.push(args); return child; },
    setTimer: (fn, ms) => { assert.equal(ms, 10000); timeout = fn; return 17; },
    clearTimer: id => cleared.push(id),
    report: code => reports.push(code),
    ...overrides,
  });
  return { handled, exits, calls, reports, cleared, child,
    timeout: () => timeout(), killed: () => killed };
}

test("install, update and uninstall invoke only the adjacent updater", () => {
  for (const [event, action] of [
    ["--squirrel-install", "--createShortcut"],
    ["--squirrel-updated", "--createShortcut"],
    ["--squirrel-uninstall", "--removeShortcut"],
  ]) {
    const f = fixture(event);
    assert.equal(f.handled, true);
    assert.deepEqual(f.calls, [["C:\\Programs\\MaterialBrowser\\Update.exe",
      [`${action}=MaterialBrowser.exe`],
      { shell: false, windowsHide: true, stdio: "ignore" }]]);
    assert.deepEqual(f.exits, []);
    f.child.emit("close", 0, null);
    assert.deepEqual(f.exits, [0]);
    assert.deepEqual(f.cleared, [17]);
  }
});

test("obsolete exits without invoking the updater", () => {
  const f = fixture("--squirrel-obsolete");
  assert.equal(f.handled, true);
  assert.deepEqual(f.calls, []);
  assert.deepEqual(f.exits, [0]);
});

test("normal launch, first run, misplaced flags and other platforms stay productive", () => {
  for (const [event, overrides] of [
    [undefined, {}], ["--squirrel-firstrun", {}],
    ["--other", { argv: ["MaterialBrowser.exe", "--other", "--squirrel-install"] }],
    ["--squirrel-install", { platform: "linux" }],
  ]) {
    const f = fixture(event, overrides);
    assert.equal(f.handled, false);
    assert.deepEqual(f.calls, []);
    assert.deepEqual(f.exits, []);
  }
});

test("invalid layout, missing updater and spawn errors fail without opening the workspace", () => {
  for (const overrides of [
    { execPath: "C:\\Programs\\MaterialBrowser.exe" },
    { execPath: "relative\\app-1.2.3\\MaterialBrowser.exe" },
    { execPath: "C:\\Programs\\app-1.2.3\\other.exe" },
    { statFile: () => ({ isFile: () => false }) },
    { statFile: () => { throw new Error("missing"); } },
    { spawnProcess: () => { throw new Error("spawn failed"); } },
  ]) {
    const f = fixture("--squirrel-install", overrides);
    assert.deepEqual(f.exits, [1]);
    assert.deepEqual(f.reports, ["SHORTCUT_MAINTENANCE_FAILED"]);
  }
});

test("nonzero, signal and asynchronous error outcomes exit exactly once", () => {
  for (const outcome of ["nonzero", "signal", "error"]) {
    const f = fixture("--squirrel-updated");
    if (outcome === "error") f.child.emit("error", new Error("spawn failed"));
    else f.child.emit("close", outcome === "nonzero" ? 2 : 0, outcome === "signal" ? "SIGTERM" : null);
    f.child.emit("close", 0, null);
    f.timeout();
    assert.deepEqual(f.exits, [1]);
    assert.deepEqual(f.reports, ["SHORTCUT_MAINTENANCE_FAILED"]);
    assert.equal(f.killed(), 0);
  }
});

test("timeout stops only its own updater and ignores late completion", () => {
  const f = fixture("--squirrel-install");
  f.timeout();
  f.timeout();
  f.child.emit("close", 0, null);
  assert.equal(f.killed(), 1);
  assert.deepEqual(f.exits, [1]);
});

test("timeout records failure before synchronous child closure and stops before exit", () => {
  const child = new EventEmitter();
  const order = [];
  child.kill = () => { order.push("kill"); child.emit("close", 0, null); };
  const f = fixture("--squirrel-install", {
    spawnProcess: () => child,
    app: { exit: code => order.push(`exit:${code}`) },
  });
  f.timeout();
  assert.deepEqual(order, ["kill", "exit:1"]);
  assert.deepEqual(f.reports, ["SHORTCUT_MAINTENANCE_FAILED"]);
});

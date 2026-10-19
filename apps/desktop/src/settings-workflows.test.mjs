import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as model from "./settings/model.mjs";
import * as history from "./settings/history-model.mjs";
import * as interaction from "./settings/interaction-model.mjs";
import * as recordModel from "./settings/record.mjs";
import * as nativeModel from "./settings/native-preferences.mjs";

// Execute the production TSX handlers with deterministic hook state. These are
// component transition tests, not DOM, keyboard, focus, or built-runtime proof.
function component(relative, name, state = {}, props = {}) {
  let index = 0;
  const changes = [];
  const React = {
    createElement: (type, attributes, ...children) => ({
      type,
      props: attributes || {},
      children: children.flat(Infinity),
    }),
    useState: (initial) => {
      const key = index++,
        value = Object.hasOwn(state, key) ? state[key] : initial;
      return [
        value,
        (next) => {
          changes.push({ key, value: next });
        },
      ];
    },
    useRef: (initial) => ({ current: initial }),
  };
  const exports = {};
  const source = ts.transpileModule(
    readFileSync(new URL(relative, import.meta.url), "utf8"),
    {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.React,
        esModuleInterop: true,
      },
    },
  ).outputText;
  vm.runInNewContext(source, {
    exports,
    require: (id) =>
      id === "react"
        ? { __esModule: true, default: React, ...React }
        : id.endsWith("model.mjs") &&
            !id.endsWith("history-model.mjs") &&
            !id.endsWith("interaction-model.mjs")
          ? model
          : id.endsWith("history-model.mjs")
            ? history
            : id.endsWith("interaction-model.mjs")
              ? interaction
              : {
                  Button: "Button",
                  Field: "Field",
                  Modal: "Modal",
                  Search: "Search",
                  Choice: "Choice",
                  SettingInput: "SettingInput",
                  ConfirmAction: "ConfirmAction",
                },
    crypto: { randomUUID: () => "fixture-schedule" },
    requestAnimationFrame: (fn) => fn(),
    Intl,
    Date,
    Set,
    Map,
  });
  const tree = exports[name]({ t: (text) => text, ...props });
  const nodes = [];
  function walk(node) {
    if (!node || typeof node !== "object") return;
    nodes.push(node);
    for (const child of node.children || []) walk(child);
  }
  walk(tree);
  return {
    changes,
    find: (label) =>
      nodes.find(
        (node) => node.type === "Button" && node.children.includes(label),
      ),
    nodes,
  };
}
function deferred() {
  let resolve;
  const promise = new Promise((done) => {
    resolve = done;
  });
  return { promise, resolve };
}
const baseController = () => ({
  record: {
    preferences: { ...model.defaults },
    schedules: [],
    revisions: [],
    undoStack: [],
    redoStack: [],
  },
  activeSchedules: [],
});

test("production schedule save retains its label and edit identity until durable success", async () => {
  for (const ok of [false, true]) {
    const wait = deferred(),
      c = baseController();
    c.transact = () => wait.promise;
    const view = component(
      "./settings/sections/Schedules.tsx",
      "Schedules",
      { 0: "Unsaved schedule", 11: "existing-id" },
      { controller: c },
    );
    const saving = view.find("Save changes").props.onClick();
    assert.equal(
      view.changes.some((change) => change.key === 0 || change.key === 11),
      false,
    );
    wait.resolve(ok ? { ok: true } : { ok: false, message: "Save rejected" });
    await saving;
    assert.equal(
      view.changes.some((change) => change.key === 0 && change.value === ""),
      ok,
    );
    assert.equal(
      view.changes.some((change) => change.key === 11 && change.value === null),
      ok,
    );
    if (!ok)
      assert.equal(
        view.changes.some(
          (change) => change.key === 9 && change.value === "Save rejected",
        ),
        true,
      );
  }
});

test("production import preview stays open on rejected asynchronous persistence", async () => {
  for (const ok of [false, true]) {
    const wait = deferred(),
      c = baseController();
    c.transact = () => wait.promise;
    const pending = {
      preferences: c.record.preferences,
      schedules: [],
      action: "Imported preferences",
    };
    const view = component(
      "./settings/sections/HistoryTransfer.tsx",
      "HistoryTransfer",
      { 1: pending },
      { controller: c },
    );
    const saving = view.find("Apply import").props.onClick();
    assert.equal(
      view.changes.some((change) => change.key === 1),
      false,
    );
    wait.resolve(ok ? { ok: true } : { ok: false, message: "Save rejected" });
    await saving;
    assert.equal(
      view.changes.some((change) => change.key === 1 && change.value === null),
      ok,
    );
  }
});

test("production reset confirmation closes only after its transaction succeeds", async () => {
  for (const ok of [false, true]) {
    const wait = deferred(),
      c = baseController();
    c.transact = () => wait.promise;
    const view = component(
      "./settings/sections/HistoryTransfer.tsx",
      "HistoryTransfer",
      { 3: true },
      { controller: c },
    );
    const confirm = view.nodes.find((node) => node.type === "ConfirmAction");
    const saving = confirm.props.onConfirm();
    assert.equal(
      view.changes.some((change) => change.key === 3),
      false,
    );
    wait.resolve(ok ? { ok: true } : { ok: false, message: "Save rejected" });
    const result = await saving;
    assert.equal(result.ok, ok);
    assert.equal(
      view.changes.some((change) => change.key === 3 && change.value === false),
      ok,
    );
  }
});

test("production confirmation prevents duplicate submission and keeps authorization after rejection", async () => {
  const wait = deferred();
  let calls = 0,
    closes = 0;
  const view = component(
    "./settings/ConfirmAction.tsx",
    "ConfirmAction",
    { 0: true, 1: true, 2: 100 },
    {
      title: "Reset",
      description: "Fixture",
      onCancel: () => {
        closes++;
      },
      onConfirm: () => {
        calls++;
        return wait.promise;
      },
    },
  );
  const first = view.find("Confirm").props.onClick();
  await view.find("Confirm").props.onClick();
  assert.equal(calls, 1);
  wait.resolve({ ok: false, message: "Save rejected" });
  await first;
  assert.equal(closes, 0);
  assert.equal(
    view.changes.some((change) => [0, 1, 2].includes(change.key)),
    false,
  );
  assert.equal(
    view.changes.some((change) => change.value === "Save rejected"),
    true,
  );
});

test("production persistence returns rejected save results without publishing unsaved values", async () => {
  const effects = [],
    errors = [],
    initial = recordModel.readPresentationRecord(null);
  let stateIndex = 0;
  const React = {
    useState: (initializer) => {
      const index = stateIndex++;
      return [
        typeof initializer === "function" ? initializer() : initializer,
        (value) => {
          if (index === 1) errors.push(value);
        },
      ];
    },
    useRef: (value) => ({ current: value }),
    useCallback: (fn) => fn,
    useEffect: (fn) => effects.push(fn),
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(
        new URL("./settings/useSettingsPersistence.ts", import.meta.url),
        "utf8",
      ),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    {
      exports,
      require: (id) =>
        id === "react"
          ? React
          : id === "./record.mjs"
            ? recordModel
            : nativeModel,
      localStorage: {
        getItem: () => null,
        setItem: () => {
          throw Error("Must not cache rejected values");
        },
      },
      window: {
        materialBrowser: {
          settingsService: async (operation) =>
            operation === "preferences-read"
              ? { ok: true, initialized: true, record: initial }
              : { ok: false, error: { message: "Native save rejected" } },
        },
        addEventListener() {},
        removeEventListener() {},
      },
      crypto: { randomUUID: () => "fixture" },
    },
  );
  const persistence = exports.useSettingsPersistence();
  for (const effect of effects) effect();
  await new Promise((resolve) => setImmediate(resolve));
  const before = persistence.current.current;
  const result = await persistence.persist((old) => ({
    ...old,
    preferences: { ...old.preferences, theme: "dark" },
  }));
  assert.equal(result.ok, false);
  assert.equal(result.message, "Native save rejected");
  assert.equal(persistence.current.current, before);
  assert.equal(errors.includes("Native save rejected"), true);
});

test("production settings actions propagate the persistence promise to their callers", () => {
  const waiting = deferred(),
    record = recordModel.readPresentationRecord(null);
  const persistence = {
    record,
    current: { current: record },
    persist: () => waiting.promise,
  };
  const React = {
    useState: (fn) => [fn(), () => {}],
    useMemo: (fn) => fn(),
    useCallback: (fn) => fn,
    useEffect() {},
  };
  const exports = {};
  vm.runInNewContext(
    ts.transpileModule(
      readFileSync(new URL("./settings/store.ts", import.meta.url), "utf8"),
      { compilerOptions: { module: ts.ModuleKind.CommonJS } },
    ).outputText,
    {
      exports,
      require: (id) =>
        id === "react"
          ? React
          : id === "./model.mjs"
            ? model
            : id === "./history-model.mjs"
              ? history
              : { useSettingsPersistence: () => persistence },
      Date,
      JSON,
    },
  );
  const c = exports.useSettings();
  assert.equal(
    c.transact("Imported preferences", record.preferences, []),
    waiting.promise,
  );
  assert.equal(c.update("theme", "dark"), waiting.promise);
  assert.equal(c.undo(), waiting.promise);
  assert.equal(c.redo(), waiting.promise);
});

test("production single notification rejection retains the previous undo target", async () => {
  const wait = deferred(),
    c = baseController();
  c.record.notices = [
    {
      id: "a",
      at: "2026-01-01T00:00:00Z",
      kind: "info",
      message: "First",
      dismissed: true,
    },
    {
      id: "b",
      at: "2026-01-01T00:01:00Z",
      kind: "info",
      message: "Second",
      dismissed: false,
    },
  ];
  c.dismiss = () => wait.promise;
  let restored;
  c.persist = async (change) => {
    restored = change(c.record);
    return { ok: true };
  };
  const view = component(
    "./settings/sections/NotificationCenter.tsx",
    "NotificationCenter",
    { 0: ["b"], 2: ["a"], 3: true },
    { controller: c },
  );
  const dismissal = view.find("Dismiss").props.onClick();
  assert.equal(
    view.changes.some((change) => change.key === 2),
    false,
  );
  wait.resolve({ ok: false, message: "Cache save rejected" });
  await dismissal;
  assert.equal(
    view.changes.some((change) => change.key === 2),
    false,
  );
  await view.find("Undo dismissal").props.onClick();
  assert.equal(restored.notices.find((row) => row.id === "a").dismissed, false);
  assert.equal(restored.notices.find((row) => row.id === "b").dismissed, false);
});

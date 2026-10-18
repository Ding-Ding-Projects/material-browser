import test from "node:test";
import assert from "node:assert/strict";
import {
  defaults,
  validateValue,
  validateSchedule,
} from "./settings/model.mjs";
import {
  readPresentationRecord,
  readStoredPresentation,
} from "./settings/record.mjs";
import {
  historyTransition,
  preserveScheduleEdit,
} from "./settings/history-model.mjs";
import {
  resolveSearchRecords,
  revealSettingKeys,
  settingInstanceId,
  choiceAccessibleName,
  parseNumericDraft,
} from "./settings/interaction-model.mjs";
import {
  enqueueSpeechGroups,
  takeSpeechPart,
} from "./settings/speech-queue.mjs";
const rule = {
  id: "rule",
  label: "Disabled multi-value",
  enabled: false,
  priority: 1,
  startDate: "",
  endDate: "",
  startTime: "00:00",
  endTime: "00:00",
  weekdays: [0, 1, 2, 3, 4, 5, 6],
  source: "local",
  values: { theme: "dark", density: "compact" },
};
test("R1 stale search snapshots never address replacement rows after three shrinking transitions", () => {
  const schedule = { id: "schedule-a" },
    historyA = { id: "history-a" },
    historyB = { id: "history-b" },
    notice = { id: "notice-a" };
  assert.deepEqual(resolveSearchRecords(["schedule-a"], []), []);
  assert.deepEqual(
    resolveSearchRecords(["history-a", "history-b"], [historyB]),
    [historyB],
  );
  assert.deepEqual(resolveSearchRecords(["notice-a"], []), []);
  assert.deepEqual(
    resolveSearchRecords(["schedule-a"], [{ id: "replacement" }]),
    [],
  );
  assert.deepEqual(resolveSearchRecords(["history-a"], [historyB, historyA]), [
    historyA,
  ]);
});
test("R2 undo and redo traverse A B C and a new edit invalidates redo without rewriting audit", () => {
  let r = readPresentationRecord(null),
    n = 0;
  const change = (value, mode = "edit") => {
    r = historyTransition(
      r,
      {
        preferences: { ...r.preferences, funnyEnglish: value },
        schedules: r.schedules,
      },
      { id: String(++n), at: "2026-10-18T00:00:00.000Z", action: mode, mode },
    );
  };
  assert.equal(r.redoStack.length, 0);
  change(1);
  change(2);
  change(3);
  const before = r.revisions.map((x) => x.id);
  change(0, "undo");
  assert.equal(r.preferences.funnyEnglish, 2);
  change(0, "undo");
  assert.equal(r.preferences.funnyEnglish, 1);
  change(0, "redo");
  assert.equal(r.preferences.funnyEnglish, 2);
  change(0, "redo");
  assert.equal(r.preferences.funnyEnglish, 3);
  assert.deepEqual(
    r.revisions.slice(0, before.length).map((x) => x.id),
    before,
  );
  change(0, "undo");
  change(4);
  assert.equal(r.redoStack.length, 0);
  const stable = r;
  change(0, "redo");
  assert.equal(r, stable);
});
test("R3 editing imported disabled multi-value schedule preserves activation and untouched values", () => {
  const updated = validateSchedule(
    preserveScheduleEdit(rule, { label: "Renamed", values: { theme: "dark" } }),
  );
  assert.equal(updated.enabled, false);
  assert.deepEqual(updated.values, { theme: "dark", density: "compact" });
  assert.deepEqual(rule.values, { theme: "dark", density: "compact" });
});
test("R4 valid current settings ignore a malformed leftover legacy record", () => {
  const current = readPresentationRecord(null);
  current.preferences.theme = "dark";
  current.writtenKeys = ["theme"];
  const loaded = readStoredPresentation(JSON.stringify(current), "{invalid");
  assert.equal(loaded.preferences.theme, "dark");
  assert.deepEqual(loaded.writtenKeys, ["theme"]);
  assert.throws(() =>
    readStoredPresentation("{invalid", JSON.stringify({ theme: "light" })),
  );
});
test("R5 explicit reveal adds the intended target without clearing the local filter", () => {
  const list = [{ key: "voiceEnglish" }, { key: "funnyEnglish" }],
    matched = ["voiceEnglish"];
  assert.deepEqual(revealSettingKeys(matched, list, "funnyEnglish"), [
    "voiceEnglish",
    "funnyEnglish",
  ]);
  assert.deepEqual(matched, ["voiceEnglish"]);
  assert.deepEqual(revealSettingKeys(matched, list, "unknown"), [
    "voiceEnglish",
  ]);
});
test("R6 identical option values retain distinct accessible owning labels", () => {
  const options = [["", "Choose automatically"]];
  assert.equal(
    choiceAccessibleName("English voice", "", options, "Automatic"),
    "English voice: Choose automatically",
  );
  assert.equal(
    choiceAccessibleName("Cantonese voice", "", options, "Automatic"),
    "Cantonese voice: Choose automatically",
  );
  assert.notEqual(
    choiceAccessibleName("Theme", "same", [["same", "Same"]], "Automatic"),
    choiceAccessibleName("Language", "same", [["same", "Same"]], "Automatic"),
  );
});
test("R7 blank numeric and partial color drafts cannot overwrite the last valid setting", () => {
  let saved = 1;
  const draft = "";
  const proposed = parseNumericDraft(draft);
  assert.equal(draft, "");
  assert.throws(() => validateValue("speechRate", proposed));
  assert.equal(saved, 1);
  assert.throws(() => validateValue("accent", "#f"));
  assert.equal(validateValue("speechRate", parseNumericDraft("1.1")), 1.1);
});
test("R8 independent setting instances receive distinct target and help identities", () => {
  const workspace = settingInstanceId("textScale", ":r1:"),
    dialog = settingInstanceId("textScale", ":r2:");
  assert.notEqual(workspace, dialog);
  assert.notEqual(workspace + "-help", dialog + "-help");
  assert.match(workspace, /^[A-Za-z0-9_-]+$/);
});
test("R9 routine messages preserve queued critical and bilingual groups in order", () => {
  const group = (id, critical) => ({
    id,
    critical,
    parts: [
      { language: "en", text: id + " en" },
      { language: "yue", text: id + " yue" },
    ],
  });
  let q = enqueueSpeechGroups([], group("active", false), null).queue;
  const first = takeSpeechPart(q);
  q = first.queue;
  assert.equal(first.part.text, "active en");
  q = enqueueSpeechGroups(q, group("error", true), "active").queue;
  q = enqueueSpeechGroups(
    q,
    {
      id: "routine",
      critical: false,
      parts: [{ language: "en", text: "routine" }],
    },
    "active",
  ).queue;
  const order = [];
  while (q.length) {
    const next = takeSpeechPart(q);
    q = next.queue;
    order.push(next.part.text);
  }
  assert.deepEqual(order, ["active yue", "error en", "error yue", "routine"]);
  const critical = group("critical", true);
  const bounded = enqueueSpeechGroups(
    [critical],
    group("later", true),
    null,
    1,
  );
  assert.equal(bounded.accepted, false);
  assert.equal(bounded.queue[0].id, "critical");
});
import { bindTabChanges } from "./settings/interaction-model.mjs";
test("R10 explicit custom-element change binding selects the workspace and detaches safely", () => {
  const element = new EventTarget();
  element.activeTabIndex = 1;
  const selected = [];
  const detach = bindTabChanges(element, ["language", "history"], (id) =>
    selected.push(id),
  );
  element.dispatchEvent(new Event("change"));
  assert.deepEqual(selected, ["history"]);
  element.activeTabIndex = 99;
  element.dispatchEvent(new Event("change"));
  assert.deepEqual(selected, ["history"]);
  detach();
  element.activeTabIndex = 0;
  element.dispatchEvent(new Event("change"));
  assert.deepEqual(selected, ["history"]);
});
import { initializeTabSelection } from "./settings/interaction-model.mjs";
test("R11 deferred tab children receive the selected value before the first change", async () => {
  const element = { activeTabIndex: -1, updateComplete: Promise.resolve() };
  assert.equal(
    await initializeTabSelection(element, ["language", "history"], "language"),
    true,
  );
  assert.equal(element.activeTabIndex, 0);
  assert.equal(
    await initializeTabSelection(
      element,
      ["language", "history"],
      "history",
      () => false,
    ),
    false,
  );
  assert.equal(element.activeTabIndex, 0);
});

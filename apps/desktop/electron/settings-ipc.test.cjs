const test = require("node:test");
const assert = require("node:assert/strict");
const { registerSettingsIpc } = require("./settings-ipc.cjs");
function fixture() {
  let handler;
  registerSettingsIpc({
    ipcMain: {
      handle: (_name, fn) => {
        handler = fn;
      },
    },
    app: {
      getPath: () => {
        throw Error("No filesystem access expected");
      },
    },
    dialog: {
      showOpenDialog: () => {
        throw Error("No dialog expected");
      },
    },
    trusted: (event) => event?.trusted === true,
    getWindow: () => null,
  });
  return handler;
}
test("settings bridge rejects untrusted callers and unregistered operations before native work", async () => {
  const call = fixture();
  assert.equal((await call({}, "fonts")).error.code, "INVALID_REQUEST");
  assert.equal(
    (await call({ trusted: true }, "execute", { command: "ignored" })).error
      .code,
    "INVALID_REQUEST",
  );
});
test("settings bridge excludes renderer-controlled paths, trust flags and commands", async () => {
  const call = fixture();
  for (const [operation, params] of [
    ["fonts", { path: "outside" }],
    ["editors", { command: "outside" }],
    ["choose-editor", { executable: "outside" }],
    [
      "open-export",
      {
        editorId: "code",
        format: "json",
        preferences: {},
        schedules: [],
        fileId: "outside",
        trustedRequest: true,
      },
    ],
  ])
    assert.equal(
      (await call({ trusted: true }, operation, params)).error.code,
      "INVALID_REQUEST",
    );
});
test("settings bridge bounds payloads and rejects malformed structures", async () => {
  const call = fixture();
  assert.equal(
    (await call({ trusted: true }, "fonts", [])).error.code,
    "INVALID_REQUEST",
  );
  assert.equal(
    (await call({ trusted: true }, "fonts", { text: "x".repeat(262145) })).error
      .code,
    "REQUEST_TOO_LARGE",
  );
  const circular = {};
  circular.circular = circular;
  assert.equal(
    (await call({ trusted: true }, "fonts", circular)).error.code,
    "INVALID_REQUEST",
  );
});

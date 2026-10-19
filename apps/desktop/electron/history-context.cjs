"use strict";
const path = require("node:path");
const { createHash } = require("node:crypto");
function historyContext({ app, resourcesPath, explicitDataDirectory }) {
  const appDataRoot = path.resolve(app.getPath("userData"));
  let namespace = "primary";
  if (explicitDataDirectory) {
    const hex = createHash("sha256")
      .update(appDataRoot.toLowerCase())
      .digest("hex")
      .slice(0, 32);
    namespace = `test-${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }
  const developmentRoot = path.resolve(__dirname, "../../..");
  return {
    appDataRoot,
    namespace,
    manifestPath: app.isPackaged
      ? path.join(resourcesPath, "history-git.lock.json")
      : path.join(developmentRoot, "engines/runtime/history-git.lock.json"),
    payloadParent: app.isPackaged
      ? resourcesPath
      : path.join(developmentRoot, ".cache/history-git"),
  };
}
module.exports = { historyContext };

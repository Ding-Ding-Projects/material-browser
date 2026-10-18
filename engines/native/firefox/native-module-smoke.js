/* Run with the source-built xpcshell and its matching Firefox application directory.
 * This tests the packaged privileged module, not native datastore quiescence. */
const { MaterialSnapshotBarrier, REQUIRED_BARRIERS } = ChromeUtils.importESModule(
  "moz-src:///browser/components/MaterialSnapshotBarrier.sys.mjs"
);
const control = new MaterialSnapshotBarrier({
  profileId: "synthetic-owned-profile",
  engineSha256: "a".repeat(64),
});
if (control.status.available || control.status.active || control.status.poisoned ||
    control.status.missingStores.length !== REQUIRED_BARRIERS.length) {
  throw new Error("Native snapshot module advertised unsupported readiness");
}
let finished = false;
let failure = null;
const deadline = Cc["@mozilla.org/timer;1"].createInstance(Ci.nsITimer);
deadline.initWithCallback(() => {
  failure = new Error("Native snapshot default command exceeded its smoke-check deadline");
  finished = true;
}, 10000, Ci.nsITimer.TYPE_ONE_SHOT);
control.dispatch({ command: "begin", protocol: 1, requestId: "synthetic-request",
  profileId: "synthetic-owned-profile" }).then(result => {
  if (result.status !== "unavailable" || result.storageWritersFrozen !== undefined ||
      result.missingStores.length !== REQUIRED_BARRIERS.length) {
    failure = new Error("Native snapshot module emitted an unsupported receipt");
  }
  finished = true;
}, error => {
  failure = error;
  finished = true;
});
try {
  Cc["@mozilla.org/thread-manager;1"].getService(Ci.nsIThreadManager)
    .spinEventLoopUntil("MaterialSnapshotModuleSmoke", () => finished);
} finally {
  deadline.cancel();
}
if (failure) {
  throw failure;
}
print("PASS: packaged privileged snapshot module remains fail-closed");

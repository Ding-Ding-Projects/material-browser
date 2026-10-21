// Project observed native lifecycle changes without exposing guest paths or output.
function createSessionEvents(emit) {
  const observed = new Map();
  return (method, result) => {
    if (!method?.startsWith("superProfiles.sessions.")) return;
    for (const session of Array.isArray(result) ? result : [result]) {
      if (!session || !/^[a-f0-9]{64}$/.test(session.id) || typeof session.state !== "string") continue;
      const events = Array.isArray(session.events) ? session.events.slice(-128)
        .filter(e => Number.isSafeInteger(e.sequence) && typeof e.phase === "string")
        .map(e => ({ sequence: e.sequence, phase: e.phase.slice(0, 80), timestampMs: e.timestampMs })) : [];
      const event = { type: "super-profile-session", sessionId: session.id,
        operationId: typeof session.operationId === "string" ? session.operationId : undefined,
        state: session.state.slice(0, 80), phase: typeof session.phase === "string" ? session.phase.slice(0, 80) : undefined,
        events };
      const signature = JSON.stringify(event);
      if (observed.get(session.id) === signature) continue;
      observed.set(session.id, signature);
      if (observed.size > 512) observed.delete(observed.keys().next().value);
      try { emit(event); } catch { /* Event delivery does not change the native result. */ }
    }
  };
}
module.exports = { createSessionEvents };

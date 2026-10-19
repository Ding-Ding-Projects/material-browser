import { useCallback, useEffect, useState, useRef } from "react";
const explanations: Record<string, string> = {
  HISTORY_RUNTIME_UNAVAILABLE:
    "Protected history is unavailable in this installation. Repair or update the installation, then retry.",
  HISTORY_AUTH_FAILED: "The history password or PIN did not match.",
  HISTORY_LOCKED: "History is locked. Unlock it to continue.",
  HISTORY_SESSION_REVOKED:
    "This history session expired or was revoked. Unlock it again.",
  HISTORY_STATE_CONFLICT:
    "Saved values changed after this operation began. Review the current values before retrying recovery.",
  HISTORY_RECOVERY_REQUIRED:
    "An unfinished history operation needs recovery. Review it before making another protected change.",
  HISTORY_RECOVERY_EXPECTATION_REQUIRED:
    "This older recovery record lacks the information needed for a safe retry. Discard the pending operation explicitly; existing history is retained.",
  HISTORY_KEY_MISSING:
    "The local history key is unavailable. Existing history was preserved and no replacement key was created.",
};
export function historyError(result: any) {
  return (
    explanations[result?.error?.code] ||
    "Protected history could not complete this operation. Existing records were preserved."
  );
}
export async function historyRequest(
  operation: string,
  params: Record<string, unknown> = {},
) {
  if (!window.materialBrowser)
    return { ok: false, error: { code: "HISTORY_RUNTIME_UNAVAILABLE" } };
  try {
    return await window.materialBrowser.settingsService(operation, params);
  } catch {
    return { ok: false, error: { code: "HISTORY_UNAVAILABLE" } };
  }
}
export function useProtectedHistory() {
  const pending = useRef(false),
    generation = useRef(0);
  const [status, setStatus] = useState<any>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [rows, setRows] = useState<any[]>([]);
  const [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [action, setAction] = useState("");
  const refresh = useCallback(async () => {
    const attempt = ++generation.current;
    const result = await historyRequest("history-status");
    if (attempt !== generation.current) return;
    setStatus(result);
    if (!result.ok) {
      setRows([]);
      setError(historyError(result));
      return;
    }
    setError("");
    if (!result.unlocked) {
      setRows([]);
      return;
    }
    const list = await historyRequest("history-list", {
      from,
      to,
      actions: action ? [action] : [],
      limit: 500,
    });
    if (attempt !== generation.current) return;
    if (list.ok) setRows(list.revisions);
    else {
      setRows([]);
      setError(historyError(list));
    }
  }, [from, to, action]);
  useEffect(() => {
    void refresh();
  }, [refresh]);
  const run = useCallback(
    async (operation: string, params: Record<string, unknown> = {}) => {
      if (pending.current)
        return { ok: false, error: { code: "OPERATION_IN_PROGRESS" } };
      pending.current = true;
      setBusy(true);
      setError("");
      try {
        const result = await historyRequest(operation, params);
        await refresh();
        if (!result.ok) setError(historyError(result));
        else if (result.warning)
          setError(
            "The operation completed, but its history record could not be saved.",
          );
        return result;
      } finally {
        pending.current = false;
        setBusy(false);
      }
    },
    [refresh],
  );
  return {
    status,
    error,
    setError,
    busy,
    rows,
    from,
    setFrom,
    to,
    setTo,
    action,
    setAction,
    refresh,
    run,
  };
}
export type ProtectedHistoryController = ReturnType<typeof useProtectedHistory>;

/* Local Ollama suite. Layout follows design/remaining-features/Ollama.dc.html:
   header with status chip, not-installed card, Store/Installed/Chat pane and the pull queue. */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Btn, Chip, Dialog, Dropdown, IconBtn, LinearProgress, Loading, Ms, Tabs, cx } from "../m3";
import { SearchBar, useSearch } from "../m3/search";
import { useApp } from "./context";
import {
  ollama,
  ollamaAvailable,
  onOllamaEvent,
  errorText,
  type ChatMessage,
  type FitVerdict,
  type InstalledModel,
  type InstallerPlan,
  type InstallerResult,
  type OllamaStatus,
  type Queue,
  type QueueItem,
  type Store,
  type StoreRow,
} from "../ollama-api";

const ROW_LIMIT = 100;

export function formatBytes(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "?";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let n = Math.abs(value);
  let i = 0;
  while (n >= 1000 && i < units.length - 1) {
    n /= 1000;
    i++;
  }
  return `${value < 0 ? "-" : ""}${n >= 100 || i === 0 ? Math.round(n) : n.toFixed(1)} ${units[i]}`;
}

const FITS: [FitVerdict, string, string][] = [
  ["well", "Runs well", "check_circle"],
  ["limits", "Runs with limits", "warning"],
  ["unlikely", "Unlikely", "block"],
  ["unknown", "Unknown", "help"],
];

// Chat history lives in memory for the session only; it survives leaving and returning to the page.
const chatMemory: { model: string; messages: ChatMessage[] } = { model: "", messages: [] };

function useAge() {
  const { t } = useApp();
  return (ms: number | undefined) => {
    if (ms === undefined) return t("Unavailable");
    const minutes = Math.floor(ms / 60000);
    if (minutes < 1) return t("just now");
    if (minutes < 60) return `${minutes} ${t("min ago")}`;
    if (minutes < 60 * 24) return `${Math.floor(minutes / 60)} ${t("h ago")}`;
    return `${Math.floor(minutes / (60 * 24))} ${t("days ago")}`;
  };
}

export function OllamaPage() {
  const { t, snack } = useApp();
  const [status, setStatus] = useState<OllamaStatus | null>(null);
  const [checking, setChecking] = useState(false);
  const [starting, setStarting] = useState(false);
  const [queue, setQueue] = useState<Queue>({ parallelism: 1, running: false, items: [] });
  const [store, setStore] = useState<Store | null>(null);
  const [installed, setInstalled] = useState<InstalledModel[]>([]);
  const available = ollamaAvailable();

  const refreshStatus = useCallback(async () => {
    if (!available) return;
    setChecking(true);
    try {
      setStatus(await ollama("status"));
    } catch (error) {
      setStatus({ state: "unhealthy", executable: null, reason: errorText(error) });
    } finally {
      setChecking(false);
    }
  }, [available]);

  const refreshInstalled = useCallback(async () => {
    try {
      setInstalled((await ollama("installed")).models);
    } catch {
      setInstalled([]);
    }
  }, []);

  const loadStore = useCallback(async (refresh: boolean) => {
    try {
      setStore(await ollama("store", { refresh }));
    } catch (error) {
      snack(`${t("The store could not be loaded")}: ${errorText(error)}`);
    }
  }, [snack, t]);

  useEffect(() => {
    void refreshStatus();
    if (available) void ollama("queue.list").then(setQueue).catch(() => {});
    return onOllamaEvent((event) => {
      if (event.type === "ollama.queue") {
        setQueue({ parallelism: event.parallelism, running: event.running, items: event.items });
        if (event.items.some((item) => item.state === "done")) void refreshInstalled();
      }
    });
  }, [available, refreshStatus, refreshInstalled]);

  const running = status?.state === "running";
  useEffect(() => {
    if (!running) return;
    void refreshInstalled();
    void loadStore(false).then(() => loadStore(true));
  }, [running, refreshInstalled, loadStore]);

  const start = async () => {
    setStarting(true);
    try {
      const next = await ollama("start");
      setStatus(next);
      if (next.state !== "running") snack(t("Ollama did not answer after starting. Try again or check its log."));
    } catch (error) {
      snack(`${t("Ollama could not be started")}: ${errorText(error)}`);
    } finally {
      setStarting(false);
    }
  };

  const chip = !available
    ? { icon: "error", text: t("Unavailable in this window") }
    : !status
      ? { icon: "hourglass_empty", text: t("Checking") }
      : status.state === "running"
        ? { icon: "check_circle", text: `${t("Ollama")} ${status.version} ${t("running")}` }
        : status.state === "missing"
          ? { icon: "error", text: t("Not installed") }
          : status.state === "stopped"
            ? { icon: "pause_circle", text: t("Installed, not running") }
            : { icon: "warning", text: t("Not responding") };

  return (
    <section className="pane scroll" aria-labelledby="ollama-h" style={{ flex: 1, minWidth: 0, padding: 24, display: "flex", flexDirection: "column", gap: 16, background: "var(--surface-container)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <Ms name="neurology" size={32} className="c-primary" />
        <h1 id="ollama-h" className="headline-s" style={{ margin: 0, flex: 1 }}>{t("Local models")}</h1>
        <span className="chip" style={{ pointerEvents: "none" }} role="status"><Ms name={chip.icon} fill />{chip.text}</span>
        {available && <IconBtn icon="refresh" label={t("Check again")} disabled={checking} onClick={() => void refreshStatus()} />}
      </div>

      {!available && (
        <section className="card tint-e" style={{ padding: 24, borderRadius: 28 }}>
          <p className="body-m" style={{ margin: 0 }}>{t("The local model service is only available in the desktop app.")}</p>
        </section>
      )}

      {status?.state === "missing" && <InstallCard onDone={() => void refreshStatus()} />}

      {(status?.state === "stopped" || status?.state === "unhealthy") && (
        <section className={cx("card", status.state === "stopped" ? "tint" : "tint-e")} style={{ padding: 24, borderRadius: 28, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
          <Ms name={status.state === "stopped" ? "pause_circle" : "warning"} size={32} />
          <div style={{ flex: "1 1 320px" }}>
            <h2 className="title-l" style={{ margin: 0 }}>{status.state === "stopped" ? t("Ollama is installed but not running") : t("Ollama is not responding")}</h2>
            <p className="body-m" style={{ margin: "4px 0 0" }}>
              {status.state === "stopped"
                ? t("Material Browser does not start Ollama by itself. Start it when you want to use local models.")
                : `${t("Something answers on port 11434 but not as expected.")} ${status.reason || ""}`}
            </p>
          </div>
          {status.state === "stopped" ? (
            <Btn icon="play_arrow" disabled={starting} onClick={() => void start()}>{starting ? t("Starting") : t("Start Ollama")}</Btn>
          ) : (
            <Btn variant="tonal" icon="refresh" disabled={checking} onClick={() => void refreshStatus()}>{t("Check again")}</Btn>
          )}
        </section>
      )}

      {running && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
          <ModelsPane store={store} installed={installed} queue={queue} onQueue={setQueue} onReload={() => void loadStore(true)} onInstalledChanged={() => { void refreshInstalled(); void loadStore(false); }} />
          <QueuePane queue={queue} setQueue={setQueue} freeDisk={store?.hardware.freeDiskBytes ?? null} />
        </div>
      )}
    </section>
  );
}

function InstallCard({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const [plan, setPlan] = useState<InstallerPlan | null>(null);
  const [result, setResult] = useState<InstallerResult | null>(null);
  const [progress, setProgress] = useState<{ received: number; total: number } | null>(null);
  const [phase, setPhase] = useState<"idle" | "checking" | "downloading" | "confirm" | "launched">("idle");
  const [error, setError] = useState("");

  useEffect(
    () =>
      onOllamaEvent((event) => {
        if (event.type === "ollama.installer" && event.phase === "downloading") setProgress({ received: event.received || 0, total: event.total || 0 });
      }),
    [],
  );

  const install = async () => {
    setError("");
    setPhase("checking");
    try {
      const checked = await ollama("installer.check");
      setPlan(checked);
      if (checked.admission) {
        setError(t("Installation is unavailable until publisher and final-file verification are implemented."));
        setPhase("idle");
        return;
      }
      setPhase("downloading");
      setProgress({ received: 0, total: checked.size });
      setResult(await ollama("installer.download"));
      setPhase("confirm");
    } catch (error) {
      const text = errorText(error);
      setError(text === "CANCELLED" ? t("Download stopped.") : `${t("The installer could not be prepared")}: ${text}`);
      setPhase("idle");
    }
  };

  const runInstaller = async () => {
    if (!result?.ready) return;
    try {
      await ollama("installer.run", { confirmed: true });
      setPhase("launched");
    } catch (error) {
      setError(`${t("The installer could not be started")}: ${errorText(error)}`);
      setPhase("idle");
    }
  };

  return (
    <section className="card tint" style={{ padding: 24, borderRadius: 28, display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
      <Ms name="download" size={32} />
      <div style={{ flex: "1 1 320px", display: "flex", flexDirection: "column", gap: 8 }}>
        <h2 className="title-l" style={{ margin: 0 }}>{t("Ollama is not installed")}</h2>
        <p className="body-m" style={{ margin: 0 }}>{t("Installation is unavailable until publisher and final-file verification are implemented.")}</p>
        {phase === "downloading" && progress && (
          <>
            <LinearProgress value={progress.total ? progress.received / progress.total : 0} label={t("Downloading the installer")} />
            <span className="body-s">{formatBytes(progress.received)} / {formatBytes(progress.total)}</span>
          </>
        )}
        {phase === "launched" && <p className="body-m" style={{ margin: 0 }} role="status">{t("The Ollama installer is open. When it finishes, check again.")}</p>}
        {error && <p role="alert" className="body-m c-error" style={{ margin: 0 }}>{error}</p>}
      </div>
      {phase === "downloading" ? (
        <Btn variant="tonal" icon="close" onClick={() => void ollama("installer.cancel")}>{t("Cancel")}</Btn>
      ) : phase === "launched" ? (
        <Btn variant="tonal" icon="refresh" onClick={onDone}>{t("Check again")}</Btn>
      ) : (
        <Btn icon="install_desktop" disabled={phase === "checking"} onClick={() => void install()}>{t("Check installer availability")}</Btn>
      )}
      {phase === "confirm" && plan && result && (
        <Dialog
          title={t("Run the Ollama installer?")}
          icon="install_desktop"
          width={460}
          onClose={() => setPhase("idle")}
          actions={
            <>
              <Btn variant="text" onClick={() => setPhase("idle")}>{t("Cancel")}</Btn>
              <Btn disabled={!result.ready} onClick={() => void runInstaller()}>{t("Run installer")}</Btn>
            </>
          }
        >
          <p>{t("The official installer opens with its own window. Material Browser does not change your PATH and does not start Ollama afterwards.")}</p>
          <div className="seglist">
            <div className="li"><Ms name="sell" /><div className="txt"><span className="sup">{t("Version")}</span><span>{plan.version}</span></div></div>
            <div className="li"><Ms name="straighten" /><div className="txt"><span className="sup">{t("Size")}</span><span>{formatBytes(result.size)} · {t("matches the release")}</span></div></div>
            <div className="li">
              <Ms name={result.integrity === "verified" ? "verified" : "gpp_maybe"} />
              <div className="txt">
                <span className="sup">{t("Integrity")}</span>
                <span>{result.integrity === "verified" ? `${t("SHA-256 matches")} ${plan.hashSource}` : t("Integrity unverified: the release publishes no SHA-256 for this file")}</span>
                <span className="mono body-s" style={{ overflowWrap: "anywhere" }}>{result.sha256}</span>
              </div>
            </div>
          </div>
        </Dialog>
      )}
    </section>
  );
}

type Tab = "store" | "installed" | "chat";

function ModelsPane({ store, installed, queue, onQueue, onReload, onInstalledChanged }: {
  store: Store | null;
  installed: InstalledModel[];
  queue: Queue;
  onQueue: (queue: Queue) => void;
  onReload: () => void;
  onInstalledChanged: () => void;
}) {
  const { t } = useApp();
  const [tab, setTab] = useState<Tab>("store");
  return (
    <section className="pane" aria-label={t("Local models")} style={{ flex: "999 1 560px", minWidth: 0, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <Tabs label={t("Model sections")} idPrefix="ollama" value={tab} onChange={setTab} tabs={[["store", t("Store")], ["installed", t("Installed")], ["chat", t("Chat")]]} />
      <div role="tabpanel" id={`ollama-panel-${tab}`} aria-labelledby={`ollama-tab-${tab}`} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {tab === "store" && <StoreTab store={store} queue={queue} onQueue={onQueue} onReload={onReload} />}
        {tab === "installed" && <InstalledTab installed={installed} store={store} onChanged={onInstalledChanged} />}
        {tab === "chat" && <ChatTab installed={installed} />}
      </div>
    </section>
  );
}

function FitChip({ verdict }: { verdict: FitVerdict }) {
  const { t } = useApp();
  const [, label, icon] = FITS.find(([v]) => v === verdict)!;
  return (
    <span className="chip" style={{ pointerEvents: "none" }}>
      <Ms name={icon} fill={verdict === "well"} className={verdict === "well" ? "c-primary" : verdict === "unlikely" ? "c-error" : undefined} />
      {t(label)}
    </span>
  );
}

function StoreTab({ store, queue, onQueue, onReload }: { store: Store | null; queue: Queue; onQueue: (q: Queue) => void; onReload: () => void }) {
  const { t, snack } = useApp();
  const age = useAge();
  const [fits, setFits] = useState<FitVerdict[]>(["well"]);
  const rows = store?.rows || [];
  const names = useMemo(() => rows.map((row) => row.name), [rows]);
  const search = useSearch(names);
  const visible = search.indices.map((i) => rows[i]).filter((row) => row && fits.includes(row.fit.verdict));
  const pending = new Set(queue.items.filter((x) => x.state === "queued" || x.state === "pulling").map((x) => x.name));
  const add = async (row: StoreRow) => {
    try {
      onQueue(await ollama("queue.add", { names: [row.name], sizes: { [row.name]: row.size } }));
    } catch (error) {
      snack(`${t("Could not add to the queue")}: ${errorText(error)}`);
    }
  };
  const catalogue = store?.catalogue;
  const hw = store?.hardware;
  const gpu = hw?.gpus?.length ? hw.gpus.map((g) => g.name).join(", ") : hw?.gpus ? t("no graphics adapter") : t("graphics adapter unknown");
  const vram = hw?.vramBytes === null || hw?.vramBytes === undefined ? t("unknown graphics memory") : `${hw.vramLowerBound ? t("at least") + " " : ""}${formatBytes(hw.vramBytes)}`;
  return (
    <>
      <SearchBar small label={t("Search models")} placeholder={t("Search every model and tag")} {...search} t={t} />
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }} role="group" aria-label={t("Fit filter")}>
        {FITS.map(([verdict, label]) => (
          <Chip key={verdict} on={fits.includes(verdict)} onClick={() => setFits(fits.includes(verdict) ? fits.filter((f) => f !== verdict) : [...fits, verdict])}>{t(label)}</Chip>
        ))}
      </div>
      {!store ? (
        <Loading label={t("Loading the store")} />
      ) : !catalogue?.available && rows.length === 0 ? (
        <div className="card tint-e" style={{ padding: 16, borderRadius: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <Ms name="cloud_off" />
          <p className="body-m" style={{ margin: 0, flex: 1 }}>
            {catalogue?.refreshFailed === "unparseable"
              ? t("The catalogue is unavailable: the Ollama library page could not be read. No models are shown rather than guessed ones.")
              : t("The catalogue is unavailable: it could not be retrieved and no earlier copy is saved.")}
          </p>
          <Btn variant="tonal" size="xs" icon="refresh" onClick={onReload}>{t("Try again")}</Btn>
        </div>
      ) : (
        <div className="seglist" aria-label={t("Models")}>
          {visible.slice(0, ROW_LIMIT).map((row) => (
            <div key={row.name} className="li tall">
              <span className="av s"><Ms name={row.capabilities.includes("vision") ? "image" : row.capabilities.includes("embedding") ? "data_array" : "chat"} /></span>
              <div className="txt">
                <span className="title-s" style={{ overflowWrap: "anywhere" }}>{row.name}</span>
                <span className="body-s on-sv" title={row.fit.reasons.map(t).join(". ")}>
                  {[formatBytes(row.size), row.quant, row.context ? `${row.context} ${t("context")}` : null, row.fit.needBytes && row.fit.verdict !== "unknown" ? `${t("needs about")} ${formatBytes(row.fit.needBytes)} ${t("of memory")}` : null, row.installed ? t("installed") : null].filter(Boolean).join(" · ")}
                </span>
              </div>
              <FitChip verdict={row.fit.verdict} />
              {row.installed ? null : (
                <Btn variant="tonal" size="xs" icon="add_shopping_cart" disabled={pending.has(row.name)} onClick={() => void add(row)}>{pending.has(row.name) ? t("Queued") : t("Queue pull")}</Btn>
              )}
            </div>
          ))}
          {visible.length === 0 && <div className="li"><span className="on-sv">{t("No matches")}</span></div>}
        </div>
      )}
      {visible.length > ROW_LIMIT && <p className="body-s on-sv" style={{ margin: 0 }}>{t("Showing")} {ROW_LIMIT} {t("of")} {visible.length}. {t("Search to narrow the list.")}</p>}
      {catalogue?.available && (
        <p className="body-s on-sv" style={{ margin: 0 }}>
          {t("Catalogue refreshed")} {age(catalogue.ageMs)} · {catalogue.modelCount} {t("models")}, {catalogue.tagCount} {t("tags")} · {catalogue.complete ? t("complete") : t("incomplete")} · {catalogue.pageCount} {t("pages read")}
          {catalogue.origin === "cache" && catalogue.refreshFailed ? ` · ${t("offline, showing the last verified copy")}` : ""}
          {hw ? `. ${t("Fit uses this PC")}: ${formatBytes(hw.ramBytes)} ${t("memory")}, ${gpu} ${t("with")} ${vram}, ${hw.freeDiskBytes === null ? t("free disk unknown") : `${formatBytes(hw.freeDiskBytes)} ${t("free on the models drive")}`}.` : ""}
        </p>
      )}
      {catalogue?.available && !catalogue.complete && catalogue.failures?.length ? (
        <p className="body-s on-sv" style={{ margin: 0 }}>{t("Some model pages could not be read")}: {catalogue.failures.slice(0, 5).map((f) => f.name).join(", ")}{catalogue.failures.length > 5 ? "…" : ""}</p>
      ) : null}
      {hw && <p className="body-s on-sv" style={{ margin: 0 }}>{t("Graphics detection")}: {hw.gpuMethod}. {t("Verdicts use download size and measured memory only, never the model name.")}</p>}
    </>
  );
}

function InstalledTab({ installed, store, onChanged }: { installed: InstalledModel[]; store: Store | null; onChanged: () => void }) {
  const { t, snack } = useApp();
  const [removing, setRemoving] = useState<string | null>(null);
  const fitOf = (name: string) => store?.rows.find((row) => row.name === name)?.fit.verdict || "unknown";
  const remove = async (name: string) => {
    try {
      await ollama("delete", { name, confirmed: true });
      snack(`${name} ${t("removed")}`);
      onChanged();
    } catch (error) {
      snack(`${t("Could not remove")} ${name}: ${errorText(error)}`);
    } finally {
      setRemoving(null);
    }
  };
  return (
    <>
      <div className="seglist" aria-label={t("Installed models")}>
        {installed.map((model) => (
          <div key={model.name} className="li tall">
            <span className="av s"><Ms name={model.loaded ? "memory" : "deployed_code"} /></span>
            <div className="txt">
              <span className="title-s" style={{ overflowWrap: "anywhere" }}>{model.name}</span>
              <span className="body-s on-sv">{[formatBytes(model.size), model.parameterSize, model.quantization, model.loaded ? t("loaded in memory") : null].filter(Boolean).join(" · ")}</span>
            </div>
            <FitChip verdict={fitOf(model.name)} />
            <IconBtn icon="delete" label={`${t("Remove")} ${model.name}`} onClick={() => setRemoving(model.name)} />
          </div>
        ))}
        {installed.length === 0 && <div className="li"><span className="on-sv">{t("No models are installed yet. Queue one from the store.")}</span></div>}
      </div>
      {removing && (
        <Dialog title={`${t("Remove")} ${removing}?`} icon="delete" onClose={() => setRemoving(null)} actions={<><Btn variant="text" onClick={() => setRemoving(null)}>{t("Cancel")}</Btn><Btn variant="error" onClick={() => void remove(removing)}>{t("Remove")}</Btn></>}>
          <p>{t("Ollama deletes this model from disk. You can pull it again later.")}</p>
        </Dialog>
      )}
    </>
  );
}

function ChatTab({ installed }: { installed: InstalledModel[] }) {
  const { t } = useApp();
  const [model, setModel] = useState(chatMemory.model && installed.some((m) => m.name === chatMemory.model) ? chatMemory.model : installed[0]?.name || "");
  const [messages, setMessages] = useState<ChatMessage[]>(chatMemory.messages);
  const [draft, setDraft] = useState("");
  const [chatId, setChatId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const log = useRef<HTMLDivElement>(null);
  useEffect(() => {
    chatMemory.model = model;
    chatMemory.messages = messages;
    log.current?.scrollTo({ top: log.current.scrollHeight });
  }, [model, messages]);
  useEffect(() => {
    if (!model && installed[0]) setModel(installed[0].name);
  }, [installed, model]);
  useEffect(
    () =>
      onOllamaEvent((event) => {
        if (event.type !== "ollama.chat" || event.chatId !== chatId) return;
        if (event.delta) {
          setMessages((list) => {
            const last = list[list.length - 1];
            return [...list.slice(0, -1), { ...last, content: last.content + event.delta }];
          });
        }
        if (event.done) {
          setChatId(null);
          if (event.error) setError(event.error);
        }
      }),
    [chatId],
  );
  // Stop a reply that is still streaming when the page goes away.
  useEffect(() => () => { if (chatId) void ollama("chat.stop", { chatId }); }, [chatId]);
  const send = async () => {
    const text = draft.trim();
    if (!text || !model || chatId) return;
    setError("");
    const history: ChatMessage[] = [...messages, { role: "user", content: text }];
    const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
    setMessages([...history, { role: "assistant", content: "" }]);
    setDraft("");
    setChatId(id);
    try {
      await ollama("chat.send", { chatId: id, model, messages: history.slice(-100) });
    } catch (error) {
      setChatId(null);
      setError(errorText(error));
    }
  };
  if (!installed.length) return <p className="body-m on-sv" style={{ margin: 0 }}>{t("Install a model to start a chat.")}</p>;
  return (
    <>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 240px" }}>
          <Dropdown label={t("Model")} value={model} options={installed.map((m) => [m.name, m.name] as [string, string])} onChange={setModel} disabled={Boolean(chatId)} />
        </div>
        <Btn variant="text" icon="delete_sweep" disabled={Boolean(chatId) || !messages.length} onClick={() => setMessages([])}>{t("Clear chat")}</Btn>
      </div>
      <div ref={log} className="seglist" aria-live="polite" aria-label={t("Conversation")} style={{ maxHeight: 420, overflow: "auto" }}>
        {messages.map((message, index) => (
          <div key={index} className={cx("li", message.role === "user" && "sel")} style={{ alignItems: "flex-start" }}>
            <Ms name={message.role === "user" ? "person" : "neurology"} />
            <div className="txt"><span className="body-m" style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{message.content || (chatId && index === messages.length - 1 ? "…" : "")}</span></div>
          </div>
        ))}
        {messages.length === 0 && <div className="li"><span className="on-sv">{t("Messages stay in memory for this session only.")}</span></div>}
      </div>
      {error && <p role="alert" className="body-m c-error" style={{ margin: 0 }}>{error}</p>}
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
        <label className="tf" style={{ height: "auto", minHeight: 56, padding: "8px 16px", ["--tf-bg" as string]: "var(--surface-container-low)" }}>
          <span className="lab">{t("Message")}</span>
          <textarea
            aria-label={t("Message")}
            value={draft}
            maxLength={32000}
            rows={2}
            style={{ flex: 1, border: 0, background: "transparent", color: "inherit", font: "inherit", resize: "vertical", outline: "none" }}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
        </label>
        {chatId ? (
          <Btn variant="tonal" icon="stop" onClick={() => void ollama("chat.stop", { chatId })}>{t("Stop")}</Btn>
        ) : (
          <Btn icon="send" disabled={!draft.trim() || !model} onClick={() => void send()}>{t("Send")}</Btn>
        )}
      </div>
    </>
  );
}

const QUEUE_ICONS: Record<QueueItem["state"], string> = { queued: "schedule", pulling: "download", done: "check_circle", failed: "error", cancelled: "cancel" };
const QUEUE_LABELS: Record<QueueItem["state"], string> = { queued: "Waiting", pulling: "Pulling", done: "Done", failed: "Failed", cancelled: "Stopped" };

/** Queue copy is checked by tests for wording about money. */
export const QUEUE_COPY = ["Pull queue", "Free downloads only. Nothing here costs money.", "Start pulls", "Pulls at once", "Clear finished", "Nothing queued. Pick models in the store."];

function QueuePane({ queue, setQueue, freeDisk }: { queue: Queue; setQueue: (q: Queue) => void; freeDisk: number | null }) {
  const { t, snack } = useApp();
  const act = async (run: () => Promise<Queue>) => {
    try {
      setQueue(await run());
    } catch (error) {
      snack(errorText(error));
    }
  };
  const open = queue.items.filter((x) => x.state === "queued" || x.state === "pulling");
  const total = open.reduce((n, x) => n + (x.total || x.sizeHint || 0), 0);
  const remaining = open.reduce((n, x) => n + Math.max(0, (x.total || x.sizeHint || 0) - x.completed), 0);
  const unknownSize = open.some((x) => !x.total && !x.sizeHint);
  const finished = queue.items.filter((x) => !["queued", "pulling"].includes(x.state));
  const failed = finished.filter((x) => x.state === "failed").length;
  const done = finished.filter((x) => x.state === "done").length;
  return (
    <section className="pane low" aria-labelledby="q-h" style={{ flex: "1 1 340px", minWidth: 0, padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <h2 id="q-h" className="title-l" style={{ margin: 0 }}>{t(QUEUE_COPY[0])}</h2>
      <p className="body-s on-sv" style={{ margin: 0 }}>{t(QUEUE_COPY[1])}</p>
      {queue.items.map((item) => (
        <div key={item.id} className="li">
          <Ms name={QUEUE_ICONS[item.state]} />
          <div className="txt" style={{ gap: 4 }}>
            <span style={{ overflowWrap: "anywhere" }}>{item.name}</span>
            {item.state === "pulling" && <LinearProgress value={item.total ? item.completed / item.total : 0} label={`${t("Pulling")} ${item.name}`} />}
            <span className="sup">
              {t(QUEUE_LABELS[item.state])}
              {item.state === "pulling" ? ` · ${item.status}${item.total ? ` · ${formatBytes(item.completed)} / ${formatBytes(item.total)}` : ""}` : ""}
              {item.error ? ` · ${t(item.error)}` : ""}
            </span>
          </div>
          {item.state === "queued" || item.state === "pulling" ? (
            <IconBtn size="sm" icon="close" label={`${t("Cancel pull")} ${item.name}`} onClick={() => void act(() => ollama("queue.cancel", { id: item.id }))} />
          ) : (
            <IconBtn size="sm" icon="delete" label={`${t("Remove from list")} ${item.name}`} onClick={() => void act(() => ollama("queue.remove", { id: item.id }))} />
          )}
        </div>
      ))}
      {queue.items.length === 0 && <p className="body-m on-sv" style={{ margin: 0 }}>{t(QUEUE_COPY[5])}</p>}
      <p className="body-m" style={{ margin: 0 }}>
        {t("Total")} {formatBytes(total)}{unknownSize ? ` ${t("plus items of unknown size")}` : ""} · {t("free space after")} {freeDisk === null ? t("unknown") : formatBytes(freeDisk - remaining)}
      </p>
      {finished.length > 0 && (
        <p className="body-s on-sv" style={{ margin: 0 }} role="status">
          {done} {t("finished")}, {failed} {t("failed")}, {finished.length - done - failed} {t("stopped")}. {failed || finished.length - done ? t("Unfinished pulls installed nothing; partly downloaded parts may stay on disk.") : ""}
        </p>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <Btn icon="play_arrow" disabled={queue.running || !queue.items.some((x) => x.state === "queued")} onClick={() => void act(() => ollama("queue.start"))}>{t(QUEUE_COPY[2])}</Btn>
        {finished.length > 0 && <Btn variant="text" onClick={() => void act(() => ollama("queue.clear"))}>{t(QUEUE_COPY[4])}</Btn>}
        <span style={{ flex: 1 }} />
        <div style={{ width: 150 }}>
          <Dropdown label={t(QUEUE_COPY[3])} value={String(queue.parallelism) as "1" | "2" | "3"} options={[["1", "1"], ["2", "2"], ["3", "3"]]} onChange={(v) => void act(() => ollama("queue.configure", { parallelism: Number(v) }))} />
        </div>
      </div>
    </section>
  );
}

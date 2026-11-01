import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Btn, ButtonGroup, Chip, Dialog, IconBtn, Item, Ms, SegList, Slider, Switch, Tabs, TextField, cx } from "../m3";
import { SearchBar, useSearch } from "../m3/search";
import { useApp } from "./context";
import { CreateServerDialog } from "./ServerCreate";
import {
  explain,
  minecraft,
  onMinecraftEvent,
  type Backup,
  type ConfigView,
  type Descriptor,
  type Player,
  type Plugin,
  type PluginHit,
  type Server,
  type TargetId,
} from "../minecraft-api";

export const TARGET_META: Record<TargetId, { label: string; icon: string }> = {
  local: { label: "This PC", icon: "desktop_windows" },
  docker: { label: "Docker here", icon: "deployed_code" },
  ssh: { label: "SSH host", icon: "terminal" },
  "ssh-docker": { label: "Docker over SSH", icon: "cloud" },
};

const STATE_META: Record<string, { label: string; icon: string }> = {
  running: { label: "Running", icon: "play_circle" },
  stopped: { label: "Stopped", icon: "stop_circle" },
  disconnected: { label: "Disconnected", icon: "link_off" },
  "not-owned": { label: "Not managed here", icon: "block" },
};

type Section = "overview" | "config" | "players" | "content";

/** Servers destination: list on the left, the selected server's detail on the right. */
export function ServersPage() {
  const { t, snack } = useApp();
  const [servers, setServers] = useState<Server[] | null>(null);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<TargetId | "all">("all");
  const [picked, setPicked] = useState("");
  const [creating, setCreating] = useState(false);
  const load = useCallback(async () => {
    try {
      const list = await minecraft<Server[]>("list");
      setServers(list);
      setError("");
      setPicked((p) => (p && list.some((s) => s.id === p) ? p : list[0]?.id || ""));
    } catch (e) {
      setError(explain(e));
      setServers([]);
    }
  }, []);
  useEffect(() => {
    void load();
    const off = onMinecraftEvent((event) => {
      if (event.type === "minecraft.state") void load();
    });
    const create = () => setCreating(true);
    window.addEventListener("servers-create", create);
    return () => {
      off();
      window.removeEventListener("servers-create", create);
    };
  }, [load]);
  const shown = (servers || []).filter((s) => filter === "all" || s.target === filter);
  const selected = servers?.find((s) => s.id === picked) || null;
  const running = (servers || []).filter((s) => s.status.state === "running").length;
  return (
    <>
      <section className="pane scroll" aria-labelledby="servers-h" style={{ flex: "1 1 420px", minWidth: 0, padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h1 id="servers-h" className="headline-s" style={{ margin: 0, flex: 1 }}>{t("Minecraft servers")}</h1>
          <Btn size="m" icon="add" onClick={() => setCreating(true)}>{t("New server")}</Btn>
          <Btn size="m" variant="tonal" icon="refresh" onClick={() => void load()}>{t("Refresh")}</Btn>
        </div>
        <div role="group" aria-label={t("Filter by target")} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Chip on={filter === "all"} onClick={() => setFilter("all")}>{t("All targets")}</Chip>
          {(Object.keys(TARGET_META) as TargetId[]).map((id) => (
            <Chip key={id} on={filter === id ? true : undefined} icon={filter === id ? undefined : TARGET_META[id].icon} onClick={() => setFilter(id)}>
              {t(TARGET_META[id].label)}
            </Chip>
          ))}
        </div>
        {error && <div className="card tint" style={{ padding: 16, borderRadius: 20, display: "flex", gap: 12 }}><Ms name="error" /><p className="body-m" style={{ margin: 0 }}>{t(error)}</p></div>}
        {servers === null ? (
          <p className="body-m on-sv">{t("Loading servers…")}</p>
        ) : shown.length === 0 ? (
          <div className="card outlined" style={{ padding: 24, borderRadius: 24, display: "flex", flexDirection: "column", gap: 8, alignItems: "flex-start" }}>
            <Ms name="dns" size={32} />
            <p className="title-m" style={{ margin: 0 }}>{t("No servers yet")}</p>
            <p className="body-m on-sv" style={{ margin: 0 }}>{t("Create a server on this PC, in Docker or on an SSH host.")}</p>
            <Btn icon="add" onClick={() => setCreating(true)}>{t("New server")}</Btn>
          </div>
        ) : (
          <div className="seglist" role="listbox" aria-label={t("Servers")}>
            {shown.map((s) => {
              const st = STATE_META[s.status.state] || STATE_META.stopped;
              return (
                <button key={s.id} type="button" role="option" aria-selected={s.id === picked} className={cx("li tall sl", s.id === picked && "sel")} onClick={() => setPicked(s.id)}>
                  <span className="av s"><Ms name={TARGET_META[s.target].icon} /></span>
                  <span className="txt">
                    <span className="ov">{t(TARGET_META[s.target].label)}</span>
                    <span className="title-s">{s.name}</span>
                    <span className="sup">{flavourName(s.flavour)} · Java {s.version} · {s.ssh ? `${s.ssh.hostname}:` : ""}{s.folder}</span>
                  </span>
                  <span className="chip" style={{ pointerEvents: "none" }}><Ms name={st.icon} fill />{t(st.label)}</span>
                </button>
              );
            })}
          </div>
        )}
        <p className="body-s on-sv" style={{ margin: 0 }}>{t("A lost SSH connection shows as Disconnected, never as Stopped.")}</p>
        <p className="label-m on-sv" style={{ margin: 0 }}>{running} {t(running === 1 ? "server running" : "servers running")}</p>
      </section>
      {selected && <ServerDetail key={selected.id} server={selected} onChanged={load} />}
      {creating && (
        <CreateServerDialog
          onClose={() => setCreating(false)}
          onCreated={(id) => {
            setCreating(false);
            setPicked(id);
            void load();
            snack(t("Server created"));
          }}
        />
      )}
    </>
  );
}

export function flavourName(f: string) {
  return f === "paper" ? "Paper" : f === "fabric" ? "Fabric" : "Vanilla";
}

function ServerDetail({ server, onChanged }: { server: Server; onChanged: () => void }) {
  const { t, snack } = useApp();
  const [section, setSection] = useState<Section>("overview");
  const [busy, setBusy] = useState("");
  const [eula, setEula] = useState(false);
  const state = server.status.state;
  const act = async (label: string, op: string, done: string) => {
    setBusy(label);
    try {
      await minecraft(op, { id: server.id });
      snack(t(done));
    } catch (e) {
      snack(t(explain(e)));
    } finally {
      setBusy("");
      onChanged();
    }
  };
  return (
    <section className="pane low scroll" aria-labelledby="server-h" style={{ flex: "1.4 1 520px", minWidth: 0, padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
        <span className="av l shape-cookie"><Ms name="landscape" fill /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h2 id="server-h" className="headline-s" style={{ margin: 0 }}>{server.name}</h2>
          <p className="body-m on-sv" style={{ margin: "4px 0 0" }}>{flavourName(server.flavour)} · Java {server.version} · {t(TARGET_META[server.target].label)}</p>
        </div>
        {state === "running" ? (
          <div style={{ display: "flex", gap: 8 }}>
            <Btn size="m" variant="tonal" icon="stop" disabled={!!busy} onClick={() => void act("stop", "stop", "Server stopped")}>{busy === "stop" ? t("Stopping…") : t("Stop gracefully")}</Btn>
            <Btn size="m" variant="outlined" icon="restart_alt" disabled={!!busy} onClick={() => void act("restart", "restart", "Server restarted")}>{t("Restart")}</Btn>
          </div>
        ) : state === "stopped" ? (
          server.eulaAccepted ? (
            <Btn size="m" icon="play_arrow" disabled={!!busy} onClick={() => void act("start", "start", "Server started")}>{busy === "start" ? t("Starting…") : t("Start")}</Btn>
          ) : (
            <Btn size="m" icon="gavel" onClick={() => setEula(true)}>{t("Accept EULA to start")}</Btn>
          )
        ) : (
          <span className="chip" style={{ pointerEvents: "none" }}><Ms name={STATE_META[state]?.icon || "help"} fill />{t(STATE_META[state]?.label || state)}</span>
        )}
      </div>
      <Tabs
        label={t("Server sections")}
        idPrefix={`srv-${server.id}`}
        value={section}
        onChange={setSection}
        tabs={[["overview", t("Overview")], ["config", t("Configuration")], ["players", t("Players")], ["content", t("Plugins and worlds")]]}
      />
      {section === "overview" && <Overview server={server} />}
      {section === "config" && <Configuration server={server} />}
      {section === "players" && <Players server={server} />}
      {section === "content" && <Content server={server} onChanged={onChanged} />}
      {eula && (
        <Dialog
          title={t("Minecraft End User License Agreement")}
          icon="gavel"
          onClose={() => setEula(false)}
          actions={
            <>
              <Btn variant="text" onClick={() => setEula(false)}>{t("Cancel")}</Btn>
              <Btn
                onClick={() =>
                  void minecraft("acceptEula", { id: server.id, accepted: true })
                    .then(() => {
                      setEula(false);
                      onChanged();
                    })
                    .catch((e) => snack(t(explain(e))))
                }
              >
                {t("I accept the EULA")}
              </Btn>
            </>
          }
        >
          <p className="body-m">{t("The server will not start until you accept the Minecraft EULA. Material Browser writes eula=true only after you choose I accept.")}</p>
          <p className="body-m"><a href="https://www.minecraft.net/en-us/eula" target="_blank" rel="noreferrer">minecraft.net/eula</a></p>
        </Dialog>
      )}
    </section>
  );
}

function Overview({ server }: { server: Server }) {
  const { t, snack } = useApp();
  const [logs, setLogs] = useState<string[]>([]);
  const [line, setLine] = useState("");
  const running = server.status.state === "running";
  useEffect(() => {
    let live = true;
    void minecraft<string[]>("logs", { id: server.id }).then((l) => live && setLogs(l)).catch(() => {});
    const off = onMinecraftEvent((e) => {
      if (e.type === "minecraft.log" && e.id === server.id) setLogs((l) => [...l.slice(-399), e.line]);
    });
    return () => {
      live = false;
      off();
    };
  }, [server.id]);
  const send = async () => {
    try {
      await minecraft("command", { id: server.id, line });
      setLine("");
    } catch (e) {
      snack(t(explain(e)));
    }
  };
  const verified = server.jar?.integrityKnown ? `${t("verified by")} ${server.jar.verifiedBy.join(", ").toUpperCase()}` : t("no published checksum to verify against");
  return (
    <>
      <SegList>
        <Item icon="fingerprint" overline={t("Server file")} title={<span className="mono">server.jar · SHA-256 {server.jar?.sha256.slice(0, 16)}… · {verified}</span>} support={server.jar?.source} />
        <Item icon="coffee" overline={t("Runtime")} title={server.runtime ? `${server.runtime.image}${server.runtime.exact ? "" : ` · ${t("closest available")}`}` : server.javaMajor ? `Java ${server.javaMajor} ${t("required by this version")}` : t("Runtime unresolved for this version")} support={server.runtime?.digest || undefined} />
        <Item icon="lan" overline={t("Listening")} title={`TCP ${server.port}`} />
        <Item icon="badge" overline={t("Owned by Material Browser")} title={server.status.pid ? `PID ${server.status.pid}` : server.status.container || t("Not running")} />
        {server.ssh && <Item icon="terminal" overline={t("SSH host")} title={`${server.ssh.user}@${server.ssh.hostname}:${server.ssh.port}`} support={t("Uses your known hosts and SSH agent. No password is stored.")} />}
      </SegList>
      <div className="card outlined" style={{ padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Ms name="terminal" /><h3 className="title-m" style={{ margin: 0, flex: 1 }}>{t("Run a command")}</h3><span className="label-s on-sv">{t("Sent to this server only")} · Java {server.version}</span></div>
        <CommandBuilder version={server.version} value={line} onChange={setLine} disabled={!running} onSend={() => void send()} />
        <pre className="mono body-s" aria-label={t("Server log")} style={{ margin: 0, padding: 12, borderRadius: 12, background: "var(--surface-container-highest)", whiteSpace: "pre-wrap", maxHeight: 260, overflow: "auto" }}>
          {logs.length ? logs.slice(-120).join("\n") : t("No log yet. Start the server to see its output.")}
        </pre>
      </div>
    </>
  );
}

/** Typed command builder: pick a command, fill its arguments. No free shell line. */
const COMMANDS: { id: string; label: string; args: { name: string; kind: "player" | "text" | "choice"; choices?: string[] }[] }[] = [
  { id: "say", label: "say", args: [{ name: "Message", kind: "text" }] },
  { id: "list", label: "list", args: [] },
  { id: "save-all", label: "save-all", args: [] },
  { id: "kick", label: "kick", args: [{ name: "Player", kind: "player" }] },
  { id: "time set", label: "time set", args: [{ name: "Time", kind: "choice", choices: ["day", "noon", "night", "midnight"] }] },
  { id: "weather", label: "weather", args: [{ name: "Weather", kind: "choice", choices: ["clear", "rain", "thunder"] }] },
  { id: "difficulty", label: "difficulty", args: [{ name: "Difficulty", kind: "choice", choices: ["peaceful", "easy", "normal", "hard"] }] },
];

function CommandBuilder({ value, onChange, disabled, onSend }: { version: string; value: string; onChange: (v: string) => void; disabled: boolean; onSend: () => void }) {
  const { t } = useApp();
  const [cmd, setCmd] = useState("say");
  const [args, setArgs] = useState<string[]>([]);
  const def = COMMANDS.find((c) => c.id === cmd)!;
  useEffect(() => {
    const parts = [cmd, ...args.slice(0, def.args.length).map((a) => a.trim()).filter(Boolean)];
    onChange(parts.join(" "));
  }, [cmd, args]);
  const ready = def.args.every((a, i) => (args[i] || "").trim()) && !/[\r\n]/.test(value);
  return (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
      <div style={{ flex: "1 1 160px" }}>
        <ButtonGroup label={t("Command")} value={cmd as any} onChange={(v) => { setCmd(v); setArgs([]); }} options={COMMANDS.slice(0, 4).map((c) => [c.id, c.label])} />
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
          {COMMANDS.slice(4).map((c) => <Chip key={c.id} on={cmd === c.id ? true : undefined} onClick={() => { setCmd(c.id); setArgs([]); }}>{c.label}</Chip>)}
        </div>
      </div>
      {def.args.map((a, i) =>
        a.kind === "choice" ? (
          <div key={a.name} style={{ flex: "2 1 220px" }}>
            <ButtonGroup label={t(a.name)} value={(args[i] || "") as any} onChange={(v) => setArgs((x) => Object.assign([...x], { [i]: v }))} options={a.choices!.map((c) => [c, c])} />
          </div>
        ) : (
          <div key={a.name} style={{ flex: "2 1 220px" }}>
            <TextField label={t(a.name)} value={args[i] || ""} maxLength={a.kind === "player" ? 16 : 200} onChange={(v) => setArgs((x) => Object.assign([...x], { [i]: v.replace(/[\r\n]/g, "") }))} />
          </div>
        ),
      )}
      <Btn size="m" icon="send" disabled={disabled || !ready} onClick={onSend}>{t("Send")}</Btn>
    </div>
  );
}

function Configuration({ server }: { server: Server }) {
  const { t, snack } = useApp();
  const [view, setView] = useState<ConfigView | null>(null);
  const [changes, setChanges] = useState<Record<string, any>>({});
  const [help, setHelp] = useState<Descriptor | null>(null);
  const [error, setError] = useState("");
  const labels = useMemo(() => (view?.typed || []).map((d) => `${t(d.label)} ${d.key}`), [view, t]);
  const search = useSearch(labels);
  const load = () => minecraft<ConfigView>("config", { id: server.id }).then(setView).catch((e) => setError(explain(e)));
  useEffect(() => void load(), [server.id]);
  if (error) return <p className="body-m">{t(error)}</p>;
  if (!view) return <p className="body-m on-sv">{t("Reading server.properties…")}</p>;
  const value = (d: Descriptor) => (Object.hasOwn(changes, d.key) ? changes[d.key] : d.value);
  const set = (d: Descriptor, v: any) => setChanges((c) => ({ ...c, [d.key]: v }));
  const visible = view.typed.filter((_, i) => !search.query || search.indices.includes(i));
  const pending = Object.keys(changes);
  const restartCount = view.typed.filter((d) => pending.includes(d.key) && d.apply === "restart").length;
  const save = async () => {
    try {
      const r = await minecraft<{ needsRestart: string[] }>("setConfig", { id: server.id, changes });
      setChanges({});
      await load();
      snack(r.needsRestart.length ? t("Saved. Restart the server to apply every change.") : t("Saved"));
    } catch (e) {
      snack(t(explain(e)));
    }
  };
  return (
    <>
      <SearchBar small label={t("Search settings")} placeholder={t("Search the settings for this version")} query={search.query} setQuery={search.setQuery} state={search.state} setState={search.setState} status={search.status} t={t} />
      <SegList>
        {visible.map((d) => (
          <div key={d.key} className="li plain" style={{ gap: 12, flexWrap: "wrap" }}>
            <div className="txt" style={{ flex: "1 1 200px" }}>
              <span className="body-l">{t(d.label)}</span>
              <span className="sup mono">{d.key} · {t(d.apply === "live" ? "applies live" : "needs restart")}</span>
            </div>
            <IconBtn icon="info" size="sm" label={`${t("About")} ${t(d.label)}`} onClick={() => setHelp(d)} />
            <Control d={d} value={value(d)} onChange={(v) => set(d, v)} />
          </div>
        ))}
      </SegList>
      {view.unknown.length > 0 && (
        <div className="card outlined" style={{ padding: 16, borderRadius: 20 }}>
          <p className="title-s" style={{ margin: "0 0 8px" }}>{t("Other settings in your file")}</p>
          <SegList>{view.unknown.map((u) => <Item key={u.key} icon="help" title={<span className="mono">{u.key}={u.value}</span>} support={t(u.reason)} />)}</SegList>
        </div>
      )}
      <div className="card tint" style={{ padding: 14, borderRadius: 20, display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Ms name="history" />
        <p className="body-m" style={{ margin: 0, flex: 1 }}>
          {pending.length ? `${pending.length} ${t("changes")} · ${restartCount} ${t("need a restart")}` : t("Unknown keys in your file are kept as they are.")}
        </p>
        <Btn variant="text" disabled={!pending.length} onClick={() => setChanges({})}>{t("Undo")}</Btn>
        <Btn disabled={!pending.length} onClick={() => void save()}>{t("Save")}</Btn>
      </div>
      {help && (
        <Dialog title={t(help.label)} icon="info" onClose={() => setHelp(null)} actions={<Btn onClick={() => setHelp(null)}>{t("Done")}</Btn>}>
          <p className="body-m">{t(help.help)}</p>
          <p className="body-s on-sv mono">{help.key} · {t("default")} {String(help.default)}{help.min !== undefined ? ` · ${help.min}–${help.max}` : ""}{help.unit ? ` ${t(help.unit)}` : ""}</p>
        </Dialog>
      )}
    </>
  );
}

/** One rich control per descriptor type. A key with no matching control is never rendered as a free textbox. */
export function Control({ d, value, onChange }: { d: Descriptor; value: any; onChange: (v: any) => void }) {
  const { t } = useApp();
  if (d.control === "switch") return <Switch checked={!!value} onChange={onChange} label={t(d.label)} />;
  if (d.control === "choice")
    return d.choices!.length <= 4 ? (
      <ButtonGroup label={t(d.label)} value={value} onChange={onChange} options={d.choices!.map((c) => [c, t(c[0].toUpperCase() + c.slice(1))])} />
    ) : (
      <ButtonGroup label={t(d.label)} value={value} onChange={onChange} options={d.choices!.map((c) => [c, c.replace("minecraft:", "").replace(/_/g, " ")])} />
    );
  if (d.control === "number") {
    const sliderMax = d.max! - d.min! <= 64;
    const clamp = (n: number) => Math.min(d.max!, Math.max(d.min!, Math.round(n)));
    return (
      <div style={{ display: "flex", gap: 8, alignItems: "center", flex: "2 1 260px" }}>
        {sliderMax ? (
          <div style={{ flex: 1 }}><Slider label={t(d.label)} value={value} min={d.min!} max={d.max!} onChange={(v) => onChange(clamp(v))} valueText={`${value} ${t(d.unit || "")}`} /></div>
        ) : (
          <>
            <IconBtn icon="remove" variant="outlined" size="sm" label={`${t("Decrease")} ${t(d.label)}`} onClick={() => onChange(clamp(value - 1))} />
            <IconBtn icon="add" variant="outlined" size="sm" label={`${t("Increase")} ${t(d.label)}`} onClick={() => onChange(clamp(value + 1))} />
          </>
        )}
        <div style={{ width: 120 }}>
          <TextField label={t(d.unit || "Value")} inputMode="numeric" value={String(value)} onChange={(v) => /^\d{0,10}$/.test(v) && v && onChange(clamp(Number(v)))} />
        </div>
      </div>
    );
  }
  if (d.control === "text")
    return (
      <div style={{ flex: "2 1 240px" }}>
        <TextField label={t(d.label)} value={value} maxLength={d.maxLength} error={d.key === "level-name" && value && !/^[A-Za-z0-9 _-]+$/.test(value) ? t("Letters, numbers, spaces, dashes and underscores only") : undefined} onChange={(v) => onChange(v.replace(/[\r\n]/g, ""))} />
      </div>
    );
  return <span className="body-s c-error">{t("No control for this setting")}</span>;
}

function Players({ server }: { server: Server }) {
  const { t, snack } = useApp();
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [name, setName] = useState("");
  const [confirm, setConfirm] = useState<{ p: Player; changes: Partial<Player> } | null>(null);
  const load = () => minecraft<Player[]>("players", { id: server.id }).then(setPlayers).catch((e) => snack(t(explain(e))));
  useEffect(() => void load(), [server.id]);
  const change = async (p: Player, changes: Partial<Player>) => {
    try {
      await minecraft("setPlayer", { id: server.id, player: { uuid: p.uuid, name: p.name }, changes });
      await load();
    } catch (e) {
      snack(t(explain(e)));
    }
  };
  const add = async () => {
    try {
      const found = await minecraft<{ name: string; uuid: string }>("lookupPlayer", { name });
      await change({ ...found, allowlisted: false, operator: false, level: 0, banned: false }, { allowlisted: true });
      setName("");
    } catch (e) {
      snack(t(explain(e)));
    }
  };
  return (
    <>
      <div style={{ overflowX: "auto" }}>
        <div role="grid" aria-label={t("Player permissions")} style={{ display: "grid", gridTemplateColumns: "minmax(140px, 1.6fr) repeat(3, minmax(80px, 1fr))", gap: 6, alignItems: "center" }}>
          <span className="label-m on-sv" role="columnheader">{t("Player")}</span>
          <span className="label-m on-sv" role="columnheader">{t("Allowlist")}</span>
          <span className="label-m on-sv" role="columnheader">{t("Operator")}</span>
          <span className="label-m on-sv" role="columnheader">{t("Banned")}</span>
          {(players || []).map((p) => (
            <React.Fragment key={p.uuid}>
              <span role="gridcell" className="body-m" style={{ display: "flex", gap: 8, alignItems: "center" }}><span className="av s"><Ms name="person" /></span>{p.name}</span>
              <span role="gridcell"><Switch checked={p.allowlisted} label={`${p.name} ${t("on the allowlist")}`} onChange={(v) => void change(p, { allowlisted: v })} /></span>
              <span role="gridcell"><Switch checked={p.operator} label={`${p.name} ${t("is an operator")}`} onChange={(v) => setConfirm({ p, changes: { operator: v } })} /></span>
              <span role="gridcell"><Switch checked={p.banned} label={`${p.name} ${t("is banned")}`} onChange={(v) => setConfirm({ p, changes: { banned: v } })} /></span>
            </React.Fragment>
          ))}
        </div>
      </div>
      {players?.length === 0 && <p className="body-m on-sv">{t("No players on any list yet.")}</p>}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ flex: "1 1 180px" }}><TextField label={t("Add a player by name")} placeholder={t("Exact Minecraft name")} value={name} maxLength={16} onChange={(v) => setName(v.replace(/[^A-Za-z0-9_]/g, ""))} /></div>
        <Btn size="m" variant="tonal" icon="person_add" disabled={name.length < 3} onClick={() => void add()}>{t("Look up and add")}</Btn>
      </div>
      <p className="body-s on-sv" style={{ margin: 0 }}>{t("Names are checked against the official profile service before they are added. Running servers change through their own commands.")}</p>
      {confirm && (
        <Dialog
          title={`${t("Change")} ${confirm.p.name}?`}
          icon="admin_panel_settings"
          onClose={() => setConfirm(null)}
          actions={
            <>
              <Btn variant="text" onClick={() => setConfirm(null)}>{t("Cancel")}</Btn>
              <Btn variant="error" onClick={() => { const c = confirm; setConfirm(null); void change(c.p, c.changes); }}>{t("Confirm")}</Btn>
            </>
          }
        >
          <p className="body-m">{"operator" in confirm.changes ? t(confirm.changes.operator ? "Operators can run every command on this server, including stopping it." : "This player will lose operator commands.") : t(confirm.changes.banned ? "This player will be removed and cannot rejoin." : "This player will be able to join again.")}</p>
        </Dialog>
      )}
    </>
  );
}

function Content({ server, onChanged }: { server: Server; onChanged: () => void }) {
  const { t, snack } = useApp();
  const [plugins, setPlugins] = useState<{ supported: boolean; items: Plugin[] } | null>(null);
  const [backups, setBackups] = useState<Backup[]>([]);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<PluginHit[] | null>(null);
  const [busy, setBusy] = useState("");
  const load = () => {
    void minecraft("plugins", { id: server.id }).then(setPlugins).catch(() => setPlugins({ supported: false, items: [] }));
    void minecraft<Backup[]>("backups", { id: server.id }).then(setBackups).catch(() => setBackups([]));
  };
  useEffect(load, [server.id]);
  const run = async (key: string, op: string, params: Record<string, unknown>, done: string) => {
    setBusy(key);
    try {
      await minecraft(op, { id: server.id, ...params });
      snack(t(done));
      load();
      onChanged();
    } catch (e) {
      snack(t(explain(e)));
    } finally {
      setBusy("");
    }
  };
  const kind = server.flavour === "fabric" ? "Mods" : "Plugins";
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 16, alignItems: "flex-start" }}>
      <div style={{ flex: "999 1 340px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 className="title-l" style={{ margin: 0 }}>{t(kind)}</h3>
        {plugins && !plugins.supported ? (
          <p className="body-m on-sv">{t("Vanilla servers do not load plugins. Use Paper for plugins or Fabric for mods.")}</p>
        ) : (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "flex-start" }}>
              <div style={{ flex: "1 1 200px" }}><TextField label={`${t("Search Modrinth for")} ${flavourName(server.flavour)} ${server.version}`} icon="search" value={query} maxLength={100} onChange={setQuery} onKeyDown={(e) => e.key === "Enter" && void minecraft<PluginHit[]>("searchPlugins", { id: server.id, query }).then(setHits).catch((x) => snack(t(explain(x))))} /></div>
              <Btn size="m" icon="travel_explore" onClick={() => void minecraft<PluginHit[]>("searchPlugins", { id: server.id, query }).then(setHits).catch((x) => snack(t(explain(x))))}>{t("Browse catalogue")}</Btn>
            </div>
            {hits && (
              <SegList label={t("Catalogue results")}>
                {hits.length === 0 && <Item icon="search_off" title={t("Nothing compatible found for this version")} />}
                {hits.map((h) => (
                  <Item key={h.id} tall icon="extension" title={h.title} support={`${h.description} · ${h.license}`} trailing={<Btn variant="tonal" size="xs" disabled={!!busy} onClick={() => void run(h.id, "installPlugin", { project: h.id }, "Installed. Restart the server to load it.")}>{busy === h.id ? t("Installing…") : t("Install")}</Btn>} />
                ))}
              </SegList>
            )}
            <SegList label={t("Installed")}>
              {(plugins?.items || []).length === 0 && <Item icon="inventory_2" title={t("Nothing installed yet")} />}
              {(plugins?.items || []).map((p) => (
                <Item key={p.file} tall icon={p.managed ? "extension" : "help"} title={p.file} support={p.managed ? undefined : t("Added outside the catalogue · compatibility unknown · not fully managed")} trailing={<Switch checked={p.enabled} label={`${t("Enable")} ${p.file}`} onChange={(v) => void run(p.file, "setPluginEnabled", { file: p.file, enabled: v }, "Saved. Restart the server to apply.")} />} />
              ))}
            </SegList>
            <div className="card outlined" style={{ padding: 16, borderRadius: 20, display: "flex", gap: 12 }}><Ms name="inventory_2" /><p className="body-m" style={{ margin: 0 }}>{t("Every install makes a backup of the world first. Downloads are checked against the catalogue's SHA-512.")}</p></div>
          </>
        )}
      </div>
      <div style={{ flex: "1 1 300px", minWidth: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 className="title-l" style={{ margin: 0 }}>{t("Worlds and backups")}</h3>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <Btn size="m" icon="backup" disabled={!!busy} onClick={() => void run("backup", "backup", {}, "Backup saved")}>{busy === "backup" ? t("Backing up…") : t("Back up now")}</Btn>
        </div>
        <h4 className="title-s" style={{ margin: "4px 0 0" }}>{t("Restore points")}</h4>
        <SegList>
          {backups.length === 0 && <Item icon="schedule" title={t("No backups yet")} />}
          {backups.map((b) => (
            <Item key={b.folder} icon={b.label === "manual" ? "schedule" : "bolt"} title={`${new Date(b.createdAt).toLocaleString()} · ${t(b.label)}`} support={b.damaged ? t("Damaged backup record") : `${b.files} ${t("files")} · SHA-256 ${b.sha256.slice(0, 12)}…`} trailing={<Btn variant="text" size="xs" disabled={!!busy || b.damaged || server.status.state !== "stopped"} onClick={() => void run(b.folder, "restore", { folder: b.folder }, "World restored")}>{t("Restore")}</Btn>} />
          ))}
        </SegList>
        <p className="body-s on-sv" style={{ margin: 0 }}>{t("Restoring needs the server stopped and keeps the current world as a new restore point.")}</p>
      </div>
    </div>
  );
}

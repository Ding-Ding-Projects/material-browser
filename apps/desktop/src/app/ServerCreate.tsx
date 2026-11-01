import React, { useEffect, useMemo, useState } from "react";
import { Btn, ButtonGroup, Chip, Dialog, Ms, RadioList, Slider, Switch, TextField, WavyProgress } from "../m3";
import { SearchBar, useSearch } from "../m3/search";
import { useApp } from "./context";
import { TARGET_META } from "./Servers";
import { explain, minecraft, onMinecraftEvent, type Catalogue, type CreateStep, type Flavour, type TargetId, type VersionDetail } from "../minecraft-api";

const STEPS: [string, string][] = [["Where", "location_on"], ["Version", "history"], ["Software", "extension"], ["Agreement", "gavel"], ["Set up", "rocket_launch"]];
const TARGET_HELP: Record<TargetId, string> = {
  local: "Runs as a process Material Browser owns and stops gracefully.",
  docker: "Runs in a labelled container with a mounted server folder.",
  ssh: "Uses your approved host key and SSH agent. No passwords are stored.",
  "ssh-docker": "Checks the remote Docker engine before creating anything.",
};
const CHANNELS: [string, string][] = [["release", "Releases"], ["snapshot", "Snapshots"], ["old_beta", "Old beta"], ["old_alpha", "Old alpha"]];
const STEP_LABEL: Record<string, string> = { target: "Checked the target", download: "Downloaded and verified the server file", install: "Installed the server", runtime: "Prepared the Java container image", finish: "Ready", error: "Setup stopped" };

/** Guided five-step creation, following the server creation design. */
export function CreateServerDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void }) {
  const { t } = useApp();
  const [step, setStep] = useState(0);
  const [target, setTarget] = useState<TargetId>("local");
  const [ssh, setSsh] = useState({ hostname: "", user: "", port: "22" });
  const [probe, setProbe] = useState<{ ready: boolean; problem?: string; javaMajor?: number; docker?: string } | null>(null);
  const [checking, setChecking] = useState(false);
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null);
  const [catalogueError, setCatalogueError] = useState("");
  const [channels, setChannels] = useState<string[]>(["release"]);
  const [version, setVersion] = useState("");
  const [detail, setDetail] = useState<VersionDetail | null>(null);
  const [flavour, setFlavour] = useState<Flavour>("vanilla");
  const [name, setName] = useState("My server");
  const [folder, setFolder] = useState("");
  const [memory, setMemory] = useState(4);
  const [port, setPort] = useState(25565);
  const [eula, setEula] = useState(false);
  const [job, setJob] = useState<{ id: string; steps: CreateStep[]; state: string } | null>(null);
  const [progress, setProgress] = useState<{ bytes: number; total: number } | null>(null);
  const [error, setError] = useState("");
  const remote = target === "ssh" || target === "ssh-docker";
  const sshHost = { hostname: ssh.hostname.trim(), user: ssh.user.trim(), port: Number(ssh.port) || 22 };

  useEffect(() => {
    setCatalogue(null);
    minecraft<Catalogue>("catalogue", { flavour }).then(setCatalogue).catch((e) => setCatalogueError(explain(e)));
  }, [flavour]);
  useEffect(() => {
    if (catalogue && !version) setVersion(catalogue.latest.release);
  }, [catalogue]);
  useEffect(() => {
    setDetail(null);
    if (version) minecraft<VersionDetail>("versionDetail", { version }).then(setDetail).catch(() => setDetail(null));
  }, [version]);
  useEffect(
    () =>
      onMinecraftEvent((e) => {
        if (e.type === "minecraft.create") setJob((j) => (j && j.id === e.id ? { ...j, steps: e.steps, state: e.state } : j));
        if (e.type === "minecraft.progress") setProgress({ bytes: e.bytes, total: e.total });
      }),
    [],
  );

  const visible = useMemo(() => (catalogue?.versions || []).filter((v) => channels.includes(v.channel)), [catalogue, channels]);
  const search = useSearch(visible.map((v) => v.id));
  const listed = (search.query ? search.indices.map((i) => visible[i]) : visible).slice(0, 200);

  const check = async () => {
    setChecking(true);
    setProbe(null);
    try {
      setProbe(await minecraft("probe", { target, ssh: remote ? sshHost : undefined, folder: remote ? "/tmp" : folder || "C:\\" }));
    } catch (e) {
      setProbe({ ready: false, problem: explain(e) });
    } finally {
      setChecking(false);
    }
  };
  const chooseFolder = async () => {
    const chosen = await (window as any).materialBrowser?.chooseDirectory?.();
    if (chosen) setFolder(chosen);
  };
  const create = async () => {
    setError("");
    try {
      const r = await minecraft<{ id: string }>("create", {
        target, ssh: remote ? sshHost : undefined, edition: "java", flavour, name, version,
        port, memoryMb: memory * 1024, folder, eulaAccepted: eula,
      });
      setJob({ id: r.id, steps: [], state: "running" });
      setStep(4);
    } catch (e) {
      setError(explain(e));
    }
  };

  const canNext =
    step === 0 ? (!remote || (sshHost.hostname && sshHost.user)) && !!probe?.ready
    : step === 1 ? !!detail?.server
    : step === 2 ? !!name.trim() && !!folder && port >= 1024 && port <= 65535
    : step === 3 ? eula
    : job?.state === "done";
  const next = () => {
    if (step === 3) return void create();
    if (step === 4) return job && onCreated(job.id);
    setStep(step + 1);
  };

  return (
    <Dialog title={t("New Minecraft server")} icon="dns" onClose={onClose} width={920} dismissible={step < 4}
      actions={
        <>
          <Btn variant="text" disabled={step === 0 || step === 4} onClick={() => setStep(step - 1)}>{t("Back")}</Btn>
          {step === 4 && job?.state === "running" && <Btn variant="outlined" icon="close" onClick={() => void minecraft("cancelCreate", { id: job.id })}>{t("Cancel setup")}</Btn>}
          <Btn disabled={!canNext} onClick={next}>{t(step === 3 ? "Create server" : step === 4 ? "Open server" : "Next")}</Btn>
        </>
      }>
      <div className="cbg" aria-label={t("Steps")} style={{ flexWrap: "wrap", marginBottom: 16 }}>
        {STEPS.map(([label, icon], i) => (
          <button key={label} type="button" className={i === step ? "on" : ""} aria-current={i === step ? "step" : undefined} disabled={i > step || step === 4} onClick={() => setStep(i)} style={{ flex: "1 1 auto", padding: "0 12px" }}>
            <Ms name={i < step ? "check" : icon} />{t(label)}
          </button>
        ))}
      </div>

      {step === 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="body-l" style={{ margin: 0 }}>{t("Where should this server run?")}</p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            {(Object.keys(TARGET_META) as TargetId[]).map((id) => (
              <button key={id} type="button" className="card outlined sl" aria-pressed={id === target} onClick={() => { setTarget(id); setProbe(null); }}
                style={{ padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 6, textAlign: "left", alignItems: "flex-start", ...(id === target ? { background: "var(--secondary-container)", borderColor: "var(--primary)" } : {}) }}>
                <Ms name={TARGET_META[id].icon} size={32} />
                <span className="title-m">{t(id === "docker" ? "Docker on this PC" : id === "ssh" ? "Process on an SSH host" : id === "ssh-docker" ? "Docker on an SSH host" : "This PC")}</span>
                <span className="body-s on-sv">{t(TARGET_HELP[id])}</span>
              </button>
            ))}
          </div>
          {remote && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <div style={{ flex: "2 1 220px" }}><TextField label={t("Host name")} value={ssh.hostname} maxLength={253} onChange={(v) => setSsh({ ...ssh, hostname: v.replace(/[^A-Za-z0-9.-]/g, "") })} /></div>
              <div style={{ flex: "1 1 140px" }}><TextField label={t("User")} value={ssh.user} maxLength={32} onChange={(v) => setSsh({ ...ssh, user: v.replace(/[^A-Za-z0-9_.-]/g, "") })} /></div>
              <div style={{ width: 110 }}><TextField label={t("Port")} inputMode="numeric" value={ssh.port} maxLength={5} onChange={(v) => setSsh({ ...ssh, port: v.replace(/\D/g, "") })} /></div>
            </div>
          )}
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <Btn variant="tonal" icon="fact_check" disabled={checking || (remote && !(sshHost.hostname && sshHost.user))} onClick={() => void check()}>{checking ? t("Checking…") : t("Check this target")}</Btn>
            {probe && (
              <span className="chip" style={{ pointerEvents: "none" }}>
                <Ms name={probe.ready ? "check_circle" : "error"} fill />
                {probe.ready ? (probe.docker ? `Docker ${probe.docker}` : `Java ${probe.javaMajor} ${t("found")}`) : t(explain(probe.problem || ""))}
              </span>
            )}
          </div>
        </div>
      )}

      {step === 1 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <ButtonGroup label={t("Edition")} value={"java" as string} onChange={() => {}} options={[["java", t("Java Edition")]]} />
          <p className="body-s on-sv" style={{ margin: 0 }}><Ms name="info" size={16} /> {t("Bedrock Edition: Mojang publishes no machine-readable server catalogue, so Bedrock servers cannot be created in this build.")}</p>
          <div role="group" aria-label={t("Release channels")} style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {CHANNELS.map(([id, label]) => (
              <Chip key={id} on={channels.includes(id)} onClick={() => setChannels((c) => (c.includes(id) ? (c.length > 1 ? c.filter((x) => x !== id) : c) : [...c, id]))}>{t(label)}</Chip>
            ))}
          </div>
          <SearchBar small label={t("Search versions")} placeholder={t("Search every version")} query={search.query} setQuery={search.setQuery} state={search.state} setState={search.setState} status={search.status} t={t} />
          {catalogueError && !catalogue && <p className="body-m c-error">{t(catalogueError)}</p>}
          <div role="radiogroup" aria-label={t("Versions")} className="seglist" style={{ maxHeight: 280, overflow: "auto" }}>
            {listed.map((v) => (
              <button key={v.id} type="button" role="radio" aria-checked={v.id === version} className={`li sl${v.id === version ? " sel" : ""}`} onClick={() => setVersion(v.id)}>
                <Ms name={v.id === version ? "radio_button_checked" : "radio_button_unchecked"} fill={v.id === version} className={v.id === version ? "c-primary" : undefined} />
                <span className="txt"><span className="title-s">{v.id}</span><span className="sup">{t(CHANNELS.find((c) => c[0] === v.channel)![1])} · {v.releaseTime?.slice(0, 10)}</span></span>
              </button>
            ))}
          </div>
          {detail && (
            <div className="card tint" style={{ padding: 14, borderRadius: 20, display: "flex", gap: 12 }}>
              <Ms name={detail.server ? "check_circle" : "block"} />
              <p className="body-m" style={{ margin: 0 }}>
                {detail.server ? `${t("Server download available")} · ${(detail.server.size / 1048576).toFixed(1)} MB · ${detail.javaMajor ? `${t("needs Java")} ${detail.javaMajor}` : t(detail.javaNote || "")}` : t(detail.unavailableReason || "")}
              </p>
            </div>
          )}
          {catalogue && (
            <p className="body-s on-sv" style={{ margin: 0 }}>
              {t("Catalogue")}: {catalogue.count} {t("versions from the official manifest")}, {t("retrieved")} {new Date(catalogue.retrievedAt).toLocaleString()} · {catalogue.stale ? t("offline copy, may be out of date") : t("complete")}
              {visible.length > listed.length ? ` · ${t("showing")} ${listed.length} ${t("of")} ${search.query ? search.indices.length : visible.length}, ${t("search to narrow")}` : ""}
            </p>
          )}
        </div>
      )}

      {step === 2 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <p className="body-l" style={{ margin: 0 }}>{t("Server software")}</p>
          <RadioList
            label={t("Server software")}
            value={flavour}
            onChange={(f) => { setFlavour(f); setVersion(""); setStep(1); }}
            options={[
              { value: "vanilla", title: "Vanilla", support: t("The official server, verified by SHA-1 from the catalogue") },
              { value: "paper", title: "Paper", support: t("Plugins supported · builds from the Paper download service, verified by SHA-256") },
              { value: "fabric", title: "Fabric", support: t("Mods supported · loader from the Fabric meta service · no published checksum") },
            ]}
          />
          <p className="body-s on-sv" style={{ margin: 0 }}>{t("Changing software returns to the version step, because each one supports different versions.")}</p>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <div style={{ flex: "1 1 240px" }}><TextField label={t("Server name")} value={name} maxLength={60} onChange={setName} /></div>
            <div style={{ flex: "1 1 240px", display: "flex", gap: 6, alignItems: "flex-start" }}>
              <div style={{ flex: 1 }}><TextField label={t("Folder")} value={folder} mono supporting={remote ? t("An absolute path on the host, for example /srv/minecraft/family") : undefined} onChange={(v) => setFolder(remote ? v.replace(/[^A-Za-z0-9._/-]/g, "") : v)} /></div>
              {!remote && <Btn variant="tonal" icon="folder_open" onClick={() => void chooseFolder()}>{t("Choose")}</Btn>}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span className="label-l" style={{ minWidth: 120 }}>{t("Memory")}</span>
            <div style={{ flex: "1 1 240px" }}><Slider label={t("Maximum memory")} value={memory} min={1} max={32} onChange={setMemory} valueText={`${memory} GB`} stops /></div>
            <div style={{ width: 110 }}><TextField label="GB" inputMode="numeric" value={String(memory)} onChange={(v) => /^\d{1,2}$/.test(v) && setMemory(Math.min(32, Math.max(1, Number(v))))} /></div>
          </div>
          <div style={{ width: 160 }}><TextField label={t("Port")} inputMode="numeric" value={String(port)} error={port < 1024 || port > 65535 ? t("1024 to 65535") : undefined} onChange={(v) => /^\d{0,5}$/.test(v) && setPort(Number(v) || 0)} /></div>
        </div>
      )}

      {step === 3 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="card tint" style={{ padding: 16, borderRadius: 20, display: "flex", gap: 12 }}>
            <Ms name="gavel" />
            <div>
              <p className="title-s" style={{ margin: 0 }}>{t("Minecraft End User License Agreement")}</p>
              <p className="body-m" style={{ margin: "4px 0 0" }}>{t("The server will not start until you accept the EULA. Material Browser writes eula=true only after you switch this on.")} <a href="https://www.minecraft.net/en-us/eula" target="_blank" rel="noreferrer">minecraft.net/eula</a></p>
            </div>
          </div>
          <div className="li plain" style={{ gap: 12 }}><span className="txt body-l">{t("I have read and accept the Minecraft EULA")}</span><Switch checked={eula} onChange={setEula} label={t("Accept the Minecraft EULA")} /></div>
          {error && <p className="body-m c-error">{t(error)}</p>}
        </div>
      )}

      {step === 4 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {job?.state === "running" && <WavyProgress label={t("Setting up")} value={progress?.total ? progress.bytes / progress.total : 0} indeterminate={!progress?.total} />}
          <div className="seglist">
            {(job?.steps || []).map((s) => (
              <div key={s.key} className="li">
                <Ms name={s.state === "done" ? "check_circle" : s.state === "failed" ? "error" : "progress_activity"} fill={s.state !== "running"} className={s.state === "failed" ? "c-error" : s.state === "done" ? "c-primary" : undefined} />
                <div className="txt"><span>{t(STEP_LABEL[s.key] || s.key)}</span>{s.detail && <span className="sup">{t(explain(s.detail))}</span>}</div>
              </div>
            ))}
          </div>
          {job?.state === "failed" && <p className="body-m">{t("Nothing was left half-installed in the server list. You can go back and try again.")}</p>}
          {job?.state === "cancelled" && <p className="body-m">{t("Setup was cancelled.")}</p>}
        </div>
      )}
    </Dialog>
  );
}

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Btn, ButtonGroup, Dialog, IconBtn, Ms, PasswordField, Radio, TextField, cx } from "../m3";
import {
  METHODS,
  factors,
  createLock,
  attempt,
  waiting,
  newTotpSecret,
  otpauthUri,
  totpMatches,
  ladderRunsLeft,
  completeRung,
  sums,
  DIM_SUM,
  validPin,
  validPassword,
} from "./locks-model.mjs";
import { useApp } from "./context";
import type { LockRecord, Ticket } from "./locks";

export function LockDialog({ target, onClose }: { target: { id: string; label: string }; onClose: () => void }) {
  const { t, locks, snack } = useApp();
  const [method, setMethod] = useState("password");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [secret] = useState(() => newTotpSecret());
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const need = factors(method);
  const ready =
    (!need.includes("pin") || validPin(pin)) &&
    (!need.includes("password") || validPassword(password)) &&
    (!need.includes("code") || /^\d{6}$/.test(code));
  const save = async () => {
    setSaving(true);
    setError("");
    try {
      if (need.includes("code") && !(await totpMatches(secret, code))) {
        setError(t("That code does not match. Check the time on both devices."));
        return;
      }
      const record = await createLock({ id: target.id, label: target.label, method, pin, password, codeSecret: need.includes("code") ? secret : undefined });
      await locks.save(record as LockRecord, target.id);
      onClose();
      snack(`${target.label} ${t("locked")}`);
    } catch {
      setError(t("The lock could not be saved."));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Dialog
      title={`${t("Lock")} “${target.label}”`}
      icon="lock"
      width={420}
      onClose={onClose}
      actions={
        <>
          <Btn variant="text" onClick={onClose}>{t("Cancel")}</Btn>
          <Btn disabled={!ready || saving} onClick={() => void save()}>{t("Lock it")}</Btn>
        </>
      }
    >
      <p>{t("Choose exactly one way to unlock it.")}</p>
      <div role="radiogroup" aria-label={t("Unlock method")} style={{ display: "flex", flexDirection: "column", margin: "0 -8px" }}>
        {METHODS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={method === id}
            tabIndex={method === id ? 0 : -1}
            className="li plain sl"
            style={{ minHeight: 44, padding: "4px 8px" }}
            onClick={() => setMethod(id)}
            onKeyDown={(event) => {
              const ids = METHODS.map(([x]) => x);
              const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
              if (!step) return;
              event.preventDefault();
              const next = ids[(ids.indexOf(method) + step + ids.length) % ids.length];
              setMethod(next);
              (event.currentTarget.parentElement?.querySelectorAll<HTMLElement>("[role=radio]")[ids.indexOf(next)])?.focus();
            }}
          >
            <Radio on={method === id} />
            <span className="txt body-l">{t(label)}</span>
          </button>
        ))}
      </div>
      {need.includes("pin") && (
        <PasswordField label={t("New lock PIN")} value={pin} onChange={(v) => setPin(v.replace(/\D/g, "").slice(0, 12))} inputMode="numeric" supporting={t("4 to 12 digits")} showLabel={t("Show")} hideLabel={t("Hide")} />
      )}
      {need.includes("password") && (
        <PasswordField label={t("New lock password")} value={password} onChange={setPassword} supporting={t("At least 6 characters")} showLabel={t("Show")} hideLabel={t("Hide")} />
      )}
      {need.includes("code") && (
        <div className="card filled" style={{ padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 12, ["--tf-bg" as string]: "var(--surface-container-highest)" }}>
          <p className="label-l">{t("Add this key to your authenticator app")}</p>
          <p className="mono body-m" style={{ letterSpacing: 2, overflowWrap: "anywhere" }}>{secret.match(/.{1,4}/g)?.join(" ")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Btn variant="tonal" size="xs" icon="content_copy" onClick={() => void navigator.clipboard?.writeText(otpauthUri(secret, target.label)).then(() => snack(t("Setup link copied")))}>{t("Copy setup link")}</Btn>
          </div>
          <TextField label={t("Current six-digit code")} value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" mono />
        </div>
      )}
      {error && <p role="alert" className="body-m c-error">{error}</p>}
      <p className="body-s on-sv">{t("Just for fun, never security. Deleting the app data folder removes every lock.")}</p>
    </Dialog>
  );
}

export function UnlockDialog({ id, onClose, onOpen }: { id: string; onClose: () => void; onOpen: () => void }) {
  const { t, locks, now } = useApp();
  const record = locks.locks[id];
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ladder, setLadder] = useState(false);
  const [tickets, setTickets] = useState(false);
  if (!record) return null;
  const need = factors(record.method);
  const wait = waiting(record, now);
  const tryOpen = async () => {
    setBusy(true);
    setError("");
    const result = await attempt(record, { pin, password, code });
    await locks.save(result.record as LockRecord, id);
    setBusy(false);
    if (result.ok) {
      onOpen();
      return;
    }
    if (result.reason === "TOO_MANY") {
      setError(t("Too many tries. Wait, or play your way out."));
      setLadder(true);
    } else setError(t("That does not match."));
  };
  if (tickets) return <SupportTickets about={record.label} onClose={() => setTickets(false)} />;
  if (ladder || wait > 0)
    return <Ladder record={record} onClose={onClose} onCleared={() => setLadder(false)} onTickets={() => setTickets(true)} />;
  return (
    <Dialog
      title={`${t("Unlock")} “${record.label}”`}
      icon="lock_open"
      width={400}
      onClose={onClose}
      actions={
        <>
          <Btn variant="text" icon="confirmation_number" onClick={() => setTickets(true)}>{t("Locked out?")}</Btn>
          <span style={{ flex: 1 }} />
          <Btn variant="text" onClick={onClose}>{t("Cancel")}</Btn>
          <Btn disabled={busy} onClick={() => void tryOpen()}>{t("Unlock")}</Btn>
        </>
      }
    >
      <p>{t("This element has its own lock. It opens for this session.")}</p>
      {need.includes("pin") && <PasswordField label={t("PIN")} value={pin} onChange={(v) => setPin(v.replace(/\D/g, ""))} inputMode="numeric" autoFocus showLabel={t("Show")} hideLabel={t("Hide")} onKeyDown={(e) => e.key === "Enter" && void tryOpen()} />}
      {need.includes("password") && <PasswordField label={t("Password")} value={password} onChange={setPassword} autoFocus={!need.includes("pin")} showLabel={t("Show")} hideLabel={t("Hide")} onKeyDown={(e) => e.key === "Enter" && void tryOpen()} />}
      {need.includes("code") && <TextField label={t("Authenticator code")} value={code} onChange={(v) => setCode(v.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" mono onKeyDown={(e) => e.key === "Enter" && void tryOpen()} />}
      {error && <p role="alert" className="body-m c-error">{error}</p>}
      {record.failures > 0 && <p className="body-s on-sv">{5 - record.failures} {t("tries left before a short wait")}</p>}
    </Dialog>
  );
}

const RUNGS: [string, string][] = [
  ["dimsum", "Dim sum"],
  ["sums", "Sums"],
  ["moles", "Moles"],
  ["clock", "Clock"],
];

/** Unlock ladder: each finished rung clears the waiting time, never the lock. */
function Ladder({ record, onClose, onCleared, onTickets }: { record: LockRecord; onClose: () => void; onCleared: () => void; onTickets: () => void }) {
  const { t, locks, now, prefs } = useApp();
  const [rung, setRung] = useState("sums");
  const [done, setDone] = useState<string[]>([]);
  const runs = ladderRunsLeft(record, now);
  const minutes = Math.ceil(waiting(record, now) / 60000);
  const finish = async (name: string) => {
    setDone([...done, name]);
    const result = completeRung(record, Date.now());
    if (result.ok) {
      await locks.save(result.record as LockRecord, record.id);
      onCleared();
    }
  };
  return (
    <Dialog
      title={t("Play your way out")}
      icon="stairs"
      width={420}
      onClose={onClose}
      actions={
        <>
          <span className="body-s on-sv" style={{ flex: 1, alignSelf: "center" }}>
            {runs} {t(runs === 1 ? "run left this hour" : "runs left this hour")}
          </span>
          <Btn variant="text" onClick={onTickets}>{t("Support Tickets")}</Btn>
        </>
      }
    >
      <p>
        {minutes > 0 ? `${t("Locked for")} ${minutes} ${t(minutes === 1 ? "minute" : "minutes")} ${t("after too many tries.")} ` : ""}
        {t("Each rung clears waiting time, never the lock.")}
      </p>
      <div className="cbg" role="tablist" aria-label={t("Ladder progress")} style={{ flexWrap: "nowrap" }}>
        {RUNGS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={rung === id}
            className={cx("sl", rung === id && "on")}
            style={{ flex: "1 1 auto", padding: "0 10px", ...(done.includes(id) && rung !== id ? { background: "var(--secondary-container)", color: "var(--on-secondary-container)" } : {}) }}
            onClick={() => setRung(id)}
          >
            {done.includes(id) && <Ms name="check" />}
            {t(label)}
          </button>
        ))}
      </div>
      {runs <= 0 ? (
        <p className="body-m">{t("No runs left this hour. The wait ends on its own.")}</p>
      ) : rung === "sums" ? (
        <SumsRung onDone={() => void finish("sums")} />
      ) : rung === "dimsum" ? (
        <DimSumRung onDone={() => void finish("dimsum")} cantonese={prefs.language !== "en"} />
      ) : rung === "moles" ? (
        <MolesRung onDone={() => void finish("moles")} />
      ) : (
        <ClockRung onDone={() => void finish("clock")} />
      )}
    </Dialog>
  );
}

function SumsRung({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const list = useMemo(() => sums(Date.now()), []);
  const [index, setIndex] = useState(0);
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const item = list[index];
  const check = () => {
    if (Number(answer) !== item.answer) {
      setWrong(true);
      return;
    }
    setWrong(false);
    setAnswer("");
    if (index + 1 >= list.length) onDone();
    else setIndex(index + 1);
  };
  return (
    <>
      <p className="label-l on-sv">{t("Sum")} {index + 1} {t("of")} {list.length}</p>
      <p className="display-m em" style={{ textAlign: "center" }} aria-live="polite">{item.a} + {item.b}</p>
      <TextField label={t("Answer")} value={answer} onChange={(v) => setAnswer(v.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" autoFocus error={wrong ? t("Not quite. Try again.") : undefined} onKeyDown={(e) => e.key === "Enter" && check()} />
      <div className="acts" style={{ paddingTop: 0 }}><Btn disabled={!answer} onClick={check}>{t("Check")}</Btn></div>
    </>
  );
}

function DimSumRung({ onDone, cantonese }: { onDone: () => void; cantonese: boolean }) {
  const { t } = useApp();
  const rounds = useMemo(() => {
    const pick = [...DIM_SUM].sort(() => Math.random() - 0.5).slice(0, 4);
    return pick.map((item) => ({ item, options: [item, ...DIM_SUM.filter((x) => x !== item).sort(() => Math.random() - 0.5).slice(0, 2)].sort(() => Math.random() - 0.5) }));
  }, []);
  const [index, setIndex] = useState(0);
  const [wrong, setWrong] = useState(false);
  const round = rounds[index];
  return (
    <>
      <p className="label-l on-sv">{t("Which dish is this?")} {index + 1} {t("of")} {rounds.length}</p>
      <p className="title-l" style={{ textAlign: "center" }}>{round.item[2]}</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {round.options.map((option) => (
          <Btn key={option[0]} variant="tonal" onClick={() => {
            if (option !== round.item) return setWrong(true);
            setWrong(false);
            if (index + 1 >= rounds.length) onDone();
            else setIndex(index + 1);
          }}>
            {option[0]}{cantonese ? ` · ${option[1]}` : ""}
          </Btn>
        ))}
      </div>
      {wrong && <p role="alert" className="body-s c-error">{t("Not that one. Try again.")}</p>}
    </>
  );
}

function MolesRung({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const [hole, setHole] = useState(() => Math.floor(Math.random() * 9));
  const [hits, setHits] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setHole(Math.floor(Math.random() * 9)), 1400);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      <p className="label-l on-sv">{t("Tap the mole")} · {hits} {t("of")} 8</p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 8 }} role="group" aria-label={t("Mole holes")}>
        {Array.from({ length: 9 }, (_, i) => (
          <button
            key={i}
            type="button"
            className="sl"
            aria-label={i === hole ? t("Mole, tap it") : t("Empty hole")}
            style={{ height: 64, borderRadius: 20, border: 0, background: i === hole ? "var(--tertiary-container)" : "var(--surface-container-highest)", color: "var(--on-tertiary-container)" }}
            onClick={() => {
              if (i !== hole) return;
              const next = hits + 1;
              setHits(next);
              setHole(Math.floor(Math.random() * 9));
              if (next >= 8) onDone();
            }}
          >
            {i === hole && <Ms name="pest_control_rodent" size={32} />}
          </button>
        ))}
      </div>
    </>
  );
}

function ClockRung({ onDone }: { onDone: () => void }) {
  const { t } = useApp();
  const [time] = useState(() => ({ h: 1 + Math.floor(Math.random() * 12), m: Math.floor(Math.random() * 12) * 5 }));
  const [answer, setAnswer] = useState("");
  const [wrong, setWrong] = useState(false);
  const hourAngle = ((time.h % 12) + time.m / 60) * 30;
  const minuteAngle = time.m * 6;
  const check = () => {
    const match = answer.trim().match(/^(\d{1,2}):(\d{2})$/);
    if (match && Number(match[1]) % 12 === time.h % 12 && Number(match[2]) === time.m) onDone();
    else setWrong(true);
  };
  return (
    <>
      <p className="label-l on-sv">{t("What time does the clock show?")}</p>
      <svg viewBox="0 0 100 100" width="140" height="140" style={{ alignSelf: "center" }} role="img" aria-label={t("Analogue clock")}>
        <circle cx="50" cy="50" r="46" fill="var(--surface-container-highest)" />
        {Array.from({ length: 12 }, (_, i) => (
          <circle key={i} cx={50 + 38 * Math.sin((i * Math.PI) / 6)} cy={50 - 38 * Math.cos((i * Math.PI) / 6)} r={i % 3 === 0 ? 2.5 : 1.5} fill="var(--on-surface-variant)" />
        ))}
        <line x1="50" y1="50" x2={50 + 22 * Math.sin((hourAngle * Math.PI) / 180)} y2={50 - 22 * Math.cos((hourAngle * Math.PI) / 180)} stroke="var(--primary)" strokeWidth="5" strokeLinecap="round" />
        <line x1="50" y1="50" x2={50 + 34 * Math.sin((minuteAngle * Math.PI) / 180)} y2={50 - 34 * Math.cos((minuteAngle * Math.PI) / 180)} stroke="var(--tertiary)" strokeWidth="3" strokeLinecap="round" />
        <circle cx="50" cy="50" r="3" fill="var(--on-surface)" />
      </svg>
      <TextField label={t("Time, like 4:35")} value={answer} onChange={setAnswer} mono error={wrong ? t("Not quite. Try again.") : undefined} onKeyDown={(e) => e.key === "Enter" && check()} />
      <div className="acts" style={{ paddingTop: 0 }}><Btn disabled={!answer} onClick={check}>{t("Check")}</Btn></div>
    </>
  );
}

/** Support Tickets: a local desk of one. Nothing is sent anywhere. */
export function SupportTickets({ about, onClose }: { about?: string; onClose: () => void }) {
  const { t, locks, snack } = useApp();
  const list = Object.values(locks.tickets).sort((a, b) => b.at - a.at);
  const [writing, setWriting] = useState(list.length === 0);
  const [subject, setSubject] = useState(about ? `${t("Can’t open")} ${about}` : "");
  const [body, setBody] = useState("");
  const folder = locks.folder || t("Unavailable in this window");
  const submit = async () => {
    const number = String(list.length + 1).padStart(4, "0");
    const ticket: Ticket = { id: number, subject: subject.trim(), body: body.trim(), at: Date.now(), resolved: true };
    await locks.saveTicket(ticket);
    setWriting(false);
  };
  return (
    <Dialog
      title={t("Support Tickets")}
      icon="confirmation_number"
      width={440}
      onClose={onClose}
      actions={
        writing ? (
          <>
            <Btn variant="text" onClick={() => (list.length ? setWriting(false) : onClose())}>{t("Cancel")}</Btn>
            <Btn disabled={!subject.trim()} onClick={() => void submit()}>{t("Submit ticket")}</Btn>
          </>
        ) : (
          <>
            <Btn variant="text" onClick={() => setWriting(true)}>{t("New ticket")}</Btn>
            <Btn icon="folder_open" disabled={!locks.folder} onClick={() => void locks.openFolder().then((ok) => !ok && snack(t("The folder could not be opened")))}>{t("Open folder")}</Btn>
          </>
        )
      }
    >
      {writing ? (
        <>
          <TextField label={t("Subject")} value={subject} onChange={setSubject} autoFocus maxLength={120} />
          <TextField label={t("What happened?")} value={body} onChange={setBody} maxLength={2000} />
        </>
      ) : (
        list.slice(0, 5).map((ticket) => (
          <div key={ticket.id} className="card filled" style={{ padding: 16, borderRadius: 20, display: "flex", flexDirection: "column", gap: 10, ["--tf-bg" as string]: "var(--surface-container-highest)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span className="title-s" style={{ flex: 1 }}>#{ticket.id} · {ticket.subject}</span>
              <span className="stat c-primary"><Ms name="task_alt" fill />{t("Resolved")}</span>
            </div>
            <p className="body-m">{t("After lengthy deliberation, the desk of one recommends the folder below. Removing it resets every lock. Your vault is not in it.")}</p>
            <div className="tf">
              <span className="lab">{t("App data folder")}</span>
              <span className="val mono body-m" title={folder}>{folder}</span>
              <IconBtn icon="content_copy" label={t("Copy path")} disabled={!locks.folder} onClick={() => void navigator.clipboard?.writeText(locks.folder).then(() => snack(t("Path copied")))} />
            </div>
          </div>
        ))
      )}
      <p className="body-m">{t("Nothing is sent anywhere and nobody is reading these tickets.")}</p>
    </Dialog>
  );
}

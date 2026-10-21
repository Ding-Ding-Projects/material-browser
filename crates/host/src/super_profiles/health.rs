//! Guest observations are collected during authorized launch. Status never launches WSL.
use super::*;
use std::{
    io::BufRead,
    sync::{Arc, Mutex},
};
const MAX_RECORD: usize = 2048;
const STALE: Duration = Duration::from_secs(15);
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Snapshot {
    pub status: String,
    pub observed_at: Option<u128>,
    pub sequence: u64,
    pub source: String,
    pub visual_verified: bool,
    pub detail: String,
}
impl Snapshot {
    pub(super) fn unknown(detail: &str) -> Self {
        Self {
            status: "unknown".into(),
            observed_at: None,
            sequence: 0,
            source: "guest-observer".into(),
            visual_verified: false,
            detail: detail.into(),
        }
    }
}
#[derive(Clone, Deserialize, Serialize, PartialEq)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Record {
    version: u8,
    session_id: String,
    nonce: String,
    sequence: u64,
    mode: String,
    state: String,
    pid: u32,
    start_ticks: u64,
    boot_id: String,
}
struct Stream {
    last: Option<Record>,
    received: Option<Instant>,
    received_at: Option<u128>,
    invalid: bool,
    closed: bool,
    registration_absent: bool,
}
pub(super) struct Observer {
    child: Option<Child>,
    stream: Arc<Mutex<Stream>>,
    sandbox: bool,
}
fn now() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis()
}
fn accept(bytes: &[u8], session: &str, nonce: &str, mode: &str, stream: &mut Stream) -> bool {
    if bytes.len() > MAX_RECORD {
        return false;
    }
    let Ok(record) = serde_json::from_slice::<Record>(bytes) else {
        return false;
    };
    if record.version != 1
        || record.session_id != session
        || record.nonce != nonce
        || record.mode != mode
        || record.sequence == 0
        || stream
            .last
            .as_ref()
            .is_some_and(|r| record.sequence <= r.sequence)
        || !matches!(record.state.as_str(), "starting" | "ready" | "exited")
        || record.boot_id.is_empty()
        || record.boot_id.len() > 64
        || !record
            .boot_id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-')
        || (record.state == "ready" && (record.pid == 0 || record.start_ticks == 0))
    {
        return false;
    }
    stream.last = Some(record);
    stream.received = Some(Instant::now());
    stream.received_at = Some(now());
    stream.invalid = false;
    true
}
impl Observer {
    pub(super) fn sandbox() -> Self {
        Self {
            child: None,
            stream: Arc::new(Mutex::new(Stream {
                last: None,
                received: None,
                received_at: None,
                invalid: false,
                closed: false,
                registration_absent: false,
            })),
            sandbox: true,
        }
    }
    pub(super) fn stop(&mut self) -> Result<()> {
        if let Some(child) = self.child.as_mut() {
            if child.try_wait().map_err(io_error)?.is_none() {
                child.kill().map_err(io_error)?;
                child.wait().map_err(io_error)?;
            }
        }
        Ok(())
    }
}
pub(super) fn prepare_wsl(s: &mut Session, engine: &str) -> Result<()> {
    verify_registration(s)?;
    if !valid_id(&s.id) {
        return Err(error(
            "OWNERSHIP_MISMATCH",
            "Invalid observation session identity",
        ));
    }
    s.health_nonce = crate::random_hex();
    let browser = match engine {
        "chromium" => "chromium",
        "firefox" => "firefox",
        _ => {
            return Err(error(
                "ENGINE_UNSUPPORTED",
                "Unsupported guest observer engine",
            ));
        }
    };
    let script = GUEST_SETUP
        .replace("__SESSION__", &s.id)
        .replace("__NONCE__", &s.health_nonce)
        .replace("__MODE__", &s.mode)
        .replace("__ENGINE__", browser);
    let path = s.directory.join("input/health-bootstrap.sh");
    fs::write(&path, script).map_err(io_error)?;
    let child = Command::new("wsl.exe")
        .args(["-d", &s.distribution, "-u", "root", "--exec", "sh", "-s"])
        .stdin(Stdio::from(fs::File::open(path).map_err(io_error)?))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(io_error)?;
    wait_owned(child, Duration::from_secs(30))?;
    s.health = Some(Snapshot::unknown(
        "Waiting for a guest workspace observation",
    ));
    Ok(())
}
pub(super) fn start_wsl(s: &Session) -> Result<Observer> {
    verify_registration(s)?;
    asynchronous::check_cancel()?;
    let mut child = Command::new("wsl.exe")
        .args([
            "-d",
            &s.distribution,
            "-u",
            USER,
            "--exec",
            "/usr/local/lib/material-browser/observe-session.sh",
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(io_error)?;
    let pipe = child.stdout.take().ok_or_else(|| {
        error(
            "OBSERVER_UNAVAILABLE",
            "Cannot read owned guest observations",
        )
    })?;
    let stream = Arc::new(Mutex::new(Stream {
        last: None,
        received: None,
        received_at: None,
        invalid: false,
        closed: false,
        registration_absent: false,
    }));
    let shared = stream.clone();
    let id = s.id.clone();
    let nonce = s.health_nonce.clone();
    let mode = s.mode.clone();
    let owned_session = s.clone();
    thread::spawn(move || {
        let mut reader = std::io::BufReader::new(pipe);
        let mut line = Vec::new();
        let mut discard = false;
        loop {
            let buffer = match reader.fill_buf() {
                Ok(buffer) if !buffer.is_empty() => buffer,
                _ => break,
            };
            let size = buffer
                .iter()
                .position(|b| *b == b'\n')
                .map(|i| i + 1)
                .unwrap_or(buffer.len());
            if !discard {
                if line.len() + size > MAX_RECORD {
                    discard = true;
                    line.clear();
                } else {
                    line.extend_from_slice(&buffer[..size]);
                }
            }
            let ended = buffer[size - 1] == b'\n';
            reader.consume(size);
            if ended {
                if let Ok(mut stream) = shared.lock() {
                    if discard || !accept(&line, &id, &nonce, &mode, &mut stream) {
                        stream.invalid = true;
                    }
                }
                line.clear();
                discard = false;
            }
        }
        let absent = matches!(registration_present(&owned_session), Ok(false));
        if let Ok(mut stream) = shared.lock() {
            stream.closed = true;
            stream.registration_absent = absent;
        }
    });
    Ok(Observer {
        child: Some(child),
        stream,
        sandbox: false,
    })
}
fn protected(state: &str) -> bool {
    matches!(
        state,
        "stopped"
            | "saved"
            | "discarded"
            | "cleanup-required"
            | "save-ready"
            | "collecting"
            | "provisioning"
            | "staging"
    )
}
fn exported(s: &Session) -> bool {
    control_receipt(&s.directory.join("exchange/stopped"))
        && s.directory.join("exchange/data").is_dir()
}
fn apply(s: &mut Session, snapshot: Snapshot, ended: bool, absent: bool) {
    if protected(&s.state) {
        return;
    }
    let status = snapshot.status.clone();
    s.health = Some(snapshot);
    if absent || ended || status == "exited" {
        let target = if absent {
            "disposed-unexported"
        } else {
            "recovery-required"
        };
        if s.state != target {
            s.state = target.into();
            asynchronous::event(
                s,
                if absent {
                    "guest-registration-absent"
                } else {
                    "guest-workspace-exited"
                },
                if absent {
                    "Owned WSL registration is absent; encrypted revisions and host staging are retained"
                } else if exported(s) {
                    "Guest workspace ended; exported output is retained for recovery"
                } else {
                    "Guest workspace or observer ended; managed data is retained for recovery"
                },
            );
        }
    } else if status == "ready" && matches!(s.state.as_str(), "launched" | "starting") {
        s.state = "running".into();
        asynchronous::event(
            s,
            "guest-ready",
            "Guest workspace process readiness observed; visual readiness remains unverified",
        );
    }
}

impl Sessions {
    pub(super) fn refresh_health(&mut self) {
        let ids = self.observers.keys().cloned().collect::<Vec<_>>();
        for id in ids {
            if self.workers.contains_key(&id) {
                continue;
            }
            let Some(mut session) = self.entries.get(&id).cloned() else {
                continue;
            };
            if protected(&session.state) {
                continue;
            }
            let Some(observer) = self.observers.get_mut(&id) else {
                continue;
            };
            let mut launcher_ended = false;
            let mut browser_ownership_error = false;
            if !observer.sandbox && session.mode == "browser" {
                match self.children.get_mut(&id).map(Child::try_wait) {
                    Some(Ok(status)) => launcher_ended = status.is_some(),
                    Some(Err(_)) | None => {
                        launcher_ended = true;
                        browser_ownership_error = true;
                    }
                }
            }
            if observer.sandbox {
                if let Some(child) = self.children.get_mut(&id) {
                    launcher_ended = child.try_wait().ok().flatten().is_some();
                }
                let path = session.directory.join("exchange/health.json");
                if control_receipt_sized(&path, MAX_RECORD as u64) {
                    if let Ok(bytes) = fs::read(path) {
                        if let Ok(mut stream) = observer.stream.lock() {
                            let previous = stream.last.clone();
                            if !accept(
                                &bytes,
                                &session.id,
                                &session.health_nonce,
                                &session.mode,
                                &mut stream,
                            ) {
                                if serde_json::from_slice::<Record>(&bytes).ok() != previous {
                                    stream.invalid = true;
                                }
                            }
                        }
                    }
                }
            } else if let Some(child) = observer.child.as_mut() {
                launcher_ended |= child.try_wait().ok().flatten().is_some();
            }
            let (mut snapshot, closed, absent) = match observer.stream.lock() {
                Ok(stream) => {
                    let fresh = stream.received.is_some_and(|time| time.elapsed() <= STALE);
                    let status = if stream.invalid || !fresh {
                        "unknown"
                    } else {
                        stream
                            .last
                            .as_ref()
                            .map(|r| r.state.as_str())
                            .unwrap_or("unknown")
                    };
                    (
                        Snapshot {
                            status: status.into(),
                            observed_at: stream.received_at,
                            sequence: stream.last.as_ref().map(|r| r.sequence).unwrap_or(0),
                            source: if observer.sandbox {
                                "sandbox-heartbeat"
                            } else {
                                "guest-observer"
                            }
                            .into(),
                            visual_verified: false,
                            detail: if stream.invalid {
                                "Guest observation was invalid"
                            } else if !fresh {
                                "No fresh guest observation is available"
                            } else {
                                "Guest process observation only"
                            }
                            .into(),
                        },
                        stream.closed,
                        stream.registration_absent,
                    )
                }
                Err(_) => (
                    Snapshot::unknown("Observation state is unavailable"),
                    false,
                    false,
                ),
            };
            if !observer.sandbox && session.mode == "browser" && launcher_ended {
                snapshot.status = "exited".into();
                snapshot.detail = "Managed browser launcher or guest observer ended; explicit recovery is required".into();
            }
            if browser_ownership_error {
                snapshot.status = "unknown".into();
                snapshot.detail = "Managed browser process ownership is unavailable; explicit recovery is required".into();
            }
            // A live heartbeat after launcher exit means process ownership was lost, not guest disposal.
            if observer.sandbox && launcher_ended && snapshot.status == "ready" {
                snapshot.status = "unknown".into();
                snapshot.detail="Launcher exited while guest heartbeat remained live; explicit recovery is required".into();
            }
            let before = (session.state.clone(), session.phase.clone());
            apply(&mut session, snapshot, launcher_ended || closed, absent);
            if before != (session.state.clone(), session.phase.clone()) {
                let _ = self.persist(&session);
            }
            self.entries.insert(id, session);
        }
    }
    pub(super) fn stop_observer(&mut self, id: &str) -> Result<()> {
        if let Some(mut observer) = self.observers.remove(id) {
            observer.stop()?;
        }
        if let Some(session) = self.entries.get_mut(id) {
            session.health = Some(Snapshot::unknown(
                "Guest observation stopped for an explicit lifecycle operation",
            ));
        }
        Ok(())
    }
}
fn control_receipt_sized(path: &Path, max: u64) -> bool {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return false;
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > max {
        return false;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return false;
        }
    }
    true
}
const GUEST_SETUP: &str = r###"set -eu
mkdir -p /usr/local/lib/material-browser /home/materialbrowser/.material-browser/runtime
chown materialbrowser /home/materialbrowser/.material-browser/runtime
chmod 700 /home/materialbrowser/.material-browser/runtime
cat > /usr/local/lib/material-browser/terminal-ready.sh <<'TERMINAL'
if test -t 0; then
 ticks=$(awk '{print $22}' /proc/$$/stat)
 boot=$(cat /proc/sys/kernel/random/boot_id)
 printf '%s %s %s\n' "$$" "$ticks" "$boot" > /home/materialbrowser/.material-browser/runtime/terminal.ready
fi
TERMINAL
cat > /usr/local/lib/material-browser/terminal-entry.sh <<'TERMINAL'
#!/bin/sh
ENV=/usr/local/lib/material-browser/terminal-ready.sh
export ENV
exec /bin/sh -i
TERMINAL
cat > /usr/local/lib/material-browser/desktop-entry.sh <<'DESKTOP'
#!/bin/sh
set -eu
dbus-run-session startxfce4 &
workspace=$!
trap 'kill "$workspace" 2>/dev/null || true' HUP INT TERM
while kill -0 "$workspace" 2>/dev/null; do
 session=$(pgrep -u materialbrowser -x xfce4-session | head -n 1 || true)
 manager=$(pgrep -u materialbrowser -x xfwm4 | head -n 1 || true)
 if test -n "$session" && test -n "$manager" && test -n "${DISPLAY:-}"; then
  if tr '\000' '\n' < /proc/"$session"/environ | grep -Fx "DISPLAY=$DISPLAY" >/dev/null && tr '\000' '\n' < /proc/"$manager"/environ | grep -Fx "DISPLAY=$DISPLAY" >/dev/null; then
   ticks=$(awk '{print $22}' /proc/"$session"/stat)
   boot=$(cat /proc/sys/kernel/random/boot_id)
   printf '%s %s %s\n' "$session" "$ticks" "$boot" > /home/materialbrowser/.material-browser/runtime/desktop.ready
  fi
 fi
 sleep 1
done
wait "$workspace"
DESKTOP
cat > /usr/local/lib/material-browser/observe-session.sh <<'OBSERVER'
#!/bin/sh
set -eu
uid=$(id -u)
boot=$(cat /proc/sys/kernel/random/boot_id)
sequence=0
ever=0
runtime=/home/materialbrowser/.material-browser/runtime
mode=__MODE__
engine=__ENGINE__
if test "$mode" = browser; then ever=1; fi
while :; do
 sequence=$((sequence+1))
 state=starting
 pid=0
 ticks=0
 valid=0
 if test "$mode" = browser; then
  for candidate in $(pgrep -u "$uid" -f '/home/materialbrowser/.material-browser/browser' || true); do
   if tr '\000' '\n' < /proc/"$candidate"/cmdline 2>/dev/null | grep -Fx -- '--user-data-dir=/home/materialbrowser/.material-browser/browser' >/dev/null || { test "$engine" = firefox && tr '\000' '\n' < /proc/"$candidate"/cmdline 2>/dev/null | grep -Fx '/home/materialbrowser/.material-browser/browser' >/dev/null; }; then
    expected=$(readlink -f "$(command -v "$engine")")
    actual=$(readlink -f /proc/"$candidate"/exe 2>/dev/null || true)
    accepted=0
    if test "$actual" = "$expected"; then accepted=1; fi
    if test "$engine" = firefox && test "$actual" = "$(dirname "$expected")/firefox-bin"; then accepted=1; fi
    if test "$accepted" = 1; then pid=$candidate; valid=1; break; fi
   fi
  done
 elif test -r "$runtime/$mode.ready"; then
  read candidate expected_ticks receipt_boot < "$runtime/$mode.ready" || true
  case "${candidate:-}" in ''|*[!0-9]*) candidate=0;; esac
  case "${expected_ticks:-}" in ''|*[!0-9]*) expected_ticks=0;; esac
  if test "$candidate" -gt 0 && test "${receipt_boot:-}" = "$boot" && test -r /proc/"$candidate"/stat; then
   actual_ticks=$(awk '{print $22}' /proc/"$candidate"/stat)
   actual_uid=$(awk '/^Uid:/ {print $2}' /proc/"$candidate"/status)
   if test "$actual_ticks" = "$expected_ticks" && test "$actual_uid" = "$uid"; then
    if test "$mode" = desktop; then
     actual=$(readlink -f /proc/"$candidate"/exe 2>/dev/null || true)
     case "$actual" in */xfce4-session)
      display=$(tr '\000' '\n' < /proc/"$candidate"/environ | sed -n 's/^DISPLAY=//p' | head -n 1)
      if test -n "$display"; then
       for manager in $(pgrep -u "$uid" -x xfwm4 || true); do
        if tr '\000' '\n' < /proc/"$manager"/environ 2>/dev/null | grep -Fx -- "DISPLAY=$display" >/dev/null; then pid=$candidate; valid=1; break; fi
       done
      fi
     ;; esac
    else
     tty=$(readlink /proc/"$candidate"/fd/0 2>/dev/null || true)
     case "$tty" in /dev/pts/*) pid=$candidate; valid=1;; esac
    fi
   fi
  fi
 fi
 if test "$valid" = 1; then
  ticks=$(awk '{print $22}' /proc/"$pid"/stat)
  state=ready
  ever=1
 elif test "$ever" = 1; then state=exited; fi
 printf '{"version":1,"sessionId":"__SESSION__","nonce":"__NONCE__","sequence":%s,"mode":"__MODE__","state":"%s","pid":%s,"startTicks":%s,"bootId":"%s"}\n' "$sequence" "$state" "$pid" "$ticks" "$boot"
 if test "$state" = exited; then exit 0; fi
 sleep 1
done
OBSERVER
chmod 755 /usr/local/lib/material-browser/terminal-entry.sh /usr/local/lib/material-browser/desktop-entry.sh /usr/local/lib/material-browser/observe-session.sh
chmod 644 /usr/local/lib/material-browser/terminal-ready.sh
"###;
#[cfg(test)]
mod tests {
    use super::*;
    fn session(directory: &Path, state: &str, backend: &str) -> Session {
        serde_json::from_value(json!({"id":"a".repeat(64),"profileId":"p","revisionId":"r","distribution":format!("MaterialBrowser-{}","a".repeat(64)),"mode":"terminal","backend":backend,"state":state,"directory":directory,"message":"fixture","healthNonce":"b".repeat(64)})).unwrap()
    }
    fn record(sequence: u64) -> Value {
        json!({"version":1,"sessionId":"a".repeat(64),"nonce":"b".repeat(64),"sequence":sequence,"mode":"terminal","state":"ready","pid":42,"startTicks":123,"bootId":"test-boot"})
    }
    fn stream() -> Stream {
        Stream {
            last: None,
            received: None,
            received_at: None,
            invalid: false,
            closed: false,
            registration_absent: false,
        }
    }
    fn feed(value: &Value, stream: &mut Stream) -> bool {
        accept(
            &serde_json::to_vec(value).unwrap(),
            &"a".repeat(64),
            &"b".repeat(64),
            "terminal",
            stream,
        )
    }
    #[test]
    fn fresh_browser_heartbeat_cannot_mask_missing_launcher_ownership() {
        let root = std::env::temp_dir().join(format!("material-health-{}", crate::random_hex()));
        let mut sessions = Sessions::new(&root).unwrap();
        let mut session = session(&root, "running", "wsl2");
        session.mode = "browser".into();
        let id = session.id.clone();
        let mut observations = stream();
        let mut ready = record(1);
        ready["mode"] = json!("browser");
        assert!(accept(
            &serde_json::to_vec(&ready).unwrap(),
            &id,
            &session.health_nonce,
            "browser",
            &mut observations
        ));
        sessions.entries.insert(id.clone(), session);
        sessions.observers.insert(
            id.clone(),
            Observer {
                child: None,
                stream: Arc::new(Mutex::new(observations)),
                sandbox: false,
            },
        );
        sessions.refresh_health();
        assert_eq!(sessions.entries[&id].state, "recovery-required");
        assert_eq!(
            sessions.entries[&id].health.as_ref().unwrap().status,
            "unknown"
        );
        sessions.entries.get_mut(&id).unwrap().state = "stopped".into();
        sessions.refresh_health();
        assert_eq!(sessions.entries[&id].state, "stopped");
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn protocol_rejects_wrong_identity_replay_and_oversize_without_refresh() {
        let mut stream = stream();
        assert!(feed(&record(1), &mut stream));
        let at = stream.received;
        assert!(!feed(&record(1), &mut stream));
        assert_eq!(stream.received, at);
        let mut bad = record(2);
        bad["nonce"] = json!("c".repeat(64));
        assert!(!feed(&bad, &mut stream));
        bad = record(2);
        bad["sessionId"] = json!("d".repeat(64));
        assert!(!feed(&bad, &mut stream));
        bad = record(2);
        bad["pid"] = json!(0);
        assert!(!feed(&bad, &mut stream));
        assert!(!accept(
            &vec![b'x'; MAX_RECORD + 1],
            &"a".repeat(64),
            &"b".repeat(64),
            "terminal",
            &mut stream
        ));
        assert_eq!(stream.received, at);
        assert!(feed(&record(2), &mut stream));
    }
    #[test]
    fn lifecycle_operations_override_late_observer_exit() {
        for state in [
            "collecting",
            "save-ready",
            "stopped",
            "saved",
            "cleanup-required",
            "discarded",
        ] {
            let mut s = session(Path::new("unused"), state, "wsl2");
            let mut observation = Snapshot::unknown("fixture");
            observation.status = "exited".into();
            apply(&mut s, observation, true, true);
            assert_eq!(s.state, state);
            assert!(s.events.is_empty());
        }
    }
    #[test]
    fn launcher_exit_is_recovery_not_sandbox_disposal_and_outputs_survive() {
        let root = std::env::temp_dir().join(format!("material-health-{}", crate::random_hex()));
        fs::create_dir_all(root.join("exchange/data")).unwrap();
        fs::write(root.join("exchange/stopped"), b"exported").unwrap();
        fs::write(root.join("exchange/data/state"), b"retain").unwrap();
        let mut s = session(&root, "running", "windows-sandbox");
        let mut observation = Snapshot::unknown("launcher exited");
        observation.status = "ready".into();
        apply(&mut s, observation, true, false);
        assert_eq!(s.state, "recovery-required");
        assert!(root.join("exchange/data/state").exists());
        let count = s.events.len();
        apply(&mut s, Snapshot::unknown("still ended"), true, false);
        assert_eq!(s.events.len(), count);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn absent_owned_registration_is_distinguished_from_observer_failure() {
        let mut s = session(Path::new("unused"), "running", "wsl2");
        apply(&mut s, Snapshot::unknown("observer ended"), true, false);
        assert_eq!(s.state, "recovery-required");
        apply(&mut s, Snapshot::unknown("registration absent"), true, true);
        assert_eq!(s.state, "disposed-unexported");
    }
    #[test]
    fn status_uses_cached_observation_and_stale_records_never_refresh() {
        let root =
            std::env::temp_dir().join(format!("material-cached-health-{}", crate::random_hex()));
        fs::create_dir(&root).unwrap();
        let mut manager = Sessions::new(&root).unwrap();
        let s = session(&root, "launched", "wsl2");
        let id = s.id.clone();
        let mut observed = stream();
        assert!(feed(&record(1), &mut observed));
        let received = observed.received_at;
        observed.received = Some(Instant::now() - STALE - Duration::from_secs(1));
        manager.entries.insert(id.clone(), s);
        manager.observers.insert(
            id.clone(),
            Observer {
                child: None,
                stream: Arc::new(Mutex::new(observed)),
                sandbox: false,
            },
        );
        let status = manager.status();
        assert_eq!(status[0]["state"], "launched");
        assert_eq!(status[0]["health"]["status"], "unknown");
        assert_eq!(
            manager.observers[&id].stream.lock().unwrap().received_at,
            received
        );
        let mut cache = manager.observers[&id].stream.lock().unwrap();
        cache.received = Some(Instant::now());
        drop(cache);
        let status = manager.status();
        assert_eq!(status[0]["state"], "running");
        assert_eq!(status[0]["health"]["visualVerified"], false);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn readiness_script_requires_actual_pty_and_matching_desktop_display() {
        assert!(GUEST_SETUP.contains("if test -t 0"));
        assert!(GUEST_SETUP.contains("actual_ticks\" = \"$expected_ticks"));
        assert!(GUEST_SETUP.contains("pgrep -u \"$uid\" -x xfwm4"));
        assert!(GUEST_SETUP.contains("DISPLAY=$display"));
        assert!(GUEST_SETUP.contains("exec /bin/sh -i"));
    }
    #[cfg(unix)]
    #[test]
    fn linked_heartbeat_cannot_be_read() {
        use std::os::unix::fs::symlink;
        let root =
            std::env::temp_dir().join(format!("material-health-link-{}", crate::random_hex()));
        fs::create_dir(&root).unwrap();
        fs::write(root.join("actual"), b"{}").unwrap();
        symlink(root.join("actual"), root.join("health.json")).unwrap();
        assert!(!control_receipt_sized(
            &root.join("health.json"),
            MAX_RECORD as u64
        ));
        fs::remove_dir_all(root).unwrap();
    }
}

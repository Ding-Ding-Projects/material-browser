//! Owned disposable guests and encrypted, scoped state saves.
mod archive;
mod base_image;
#[cfg(test)]
use archive::safe_member;
use archive::validate_archive;
mod async_save;
mod asynchronous;
mod capabilities;
mod cleanup;
mod desktop_connection;
mod guest_installers;
mod health;
mod isolation;
mod linux_runtime;
mod payload;
mod portable_bookmarks;
mod provisioning;
mod sandbox;
use crate::{Result, error, io_error};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    collections::BTreeMap,
    fs,
    io::Read,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    thread,
    time::{Duration, Instant},
};
const USER: &str = "materialbrowser";
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Session {
    id: String,
    profile_id: String,
    revision_id: String,
    distribution: String,
    mode: String,
    backend: String,
    state: String,
    directory: PathBuf,
    message: String,
    #[serde(default)]
    operation_id: String,
    #[serde(default)]
    phase: String,
    #[serde(default)]
    events: Vec<asynchronous::Event>,
    #[serde(default)]
    guest_removed: bool,
    #[serde(default)]
    guest_created: bool,
    #[serde(default)]
    save_requested: bool,
    #[serde(default)]
    guest_action_attempts: u8,
    #[serde(default)]
    save_plan: Option<async_save::SavePlan>,
    #[serde(default)]
    saved_revision_id: Option<String>,
    #[serde(default)]
    save_confirmation_required: bool,
    #[serde(default)]
    health_nonce: String,
    #[serde(default)]
    health: Option<health::Snapshot>,
}
type WorkerOutput = (
    BTreeMap<String, Session>,
    BTreeMap<String, Child>,
    BTreeMap<String, health::Observer>,
);
pub struct Sessions {
    unlock_epoch: String,
    root: PathBuf,
    entries: BTreeMap<String, Session>,
    children: BTreeMap<String, Child>,
    observers: BTreeMap<String, health::Observer>,
    workers: BTreeMap<String, thread::JoinHandle<WorkerOutput>>,
}
fn command(program: &str, args: &[&str], timeout: Duration) -> Result<String> {
    asynchronous::check_cancel()?;
    let mut child = Command::new(program)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|_| error("BACKEND_UNAVAILABLE", "Guest command could not be started"))?;
    let mut stdout = child
        .stdout
        .take()
        .ok_or_else(|| error("IO", "Cannot read command output"))?;
    let (output_tx, output_rx) = std::sync::mpsc::channel();
    thread::spawn(move || {
        let mut kept = Vec::new();
        let mut buffer = [0; 8192];
        loop {
            match stdout.read(&mut buffer) {
                Ok(0) | Err(_) => break,
                Ok(n) => {
                    if kept.len() < 1048576 {
                        let remaining = 1048576 - kept.len();
                        kept.extend_from_slice(&buffer[..n.min(remaining)]);
                    }
                }
            }
        }
        let _ = output_tx.send(kept);
    });
    let start = Instant::now();
    loop {
        if let Err(e) = asynchronous::check_cancel() {
            let _ = child.kill();
            let _ = child.wait();
            return Err(e);
        }
        if let Some(status) = child.try_wait().map_err(io_error)? {
            let output = loop {
                asynchronous::check_cancel()?;
                match output_rx.recv_timeout(Duration::from_millis(50)) {
                    Ok(output) => break output,
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                        return Err(error("IO", "Command output reader failed"));
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout)
                        if start.elapsed() >= timeout =>
                    {
                        return Err(error(
                            "GUEST_TIMEOUT",
                            "Guest output did not close before the operation deadline; staging retained",
                        ));
                    }
                    Err(_) => {}
                }
            };
            if !status.success() {
                return Err(error(
                    "GUEST_COMMAND_FAILED",
                    "Guest command failed; session staging is retained",
                ));
            }
            if output.len() >= 1048576 {
                return Err(error(
                    "OUTPUT_LIMIT",
                    "Guest command output exceeded its bound",
                ));
            }
            return Ok(String::from_utf8_lossy(&output).replace('\0', ""));
        }
        if start.elapsed() > timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error(
                "GUEST_TIMEOUT",
                "Guest operation timed out; staging is retained for recovery",
            ));
        }
        thread::sleep(Duration::from_millis(100));
    }
}
fn run(args: &[&str], timeout: Duration) -> Result<String> {
    command("wsl.exe", args, timeout)
}
impl Sessions {
    pub fn new(data: &Path) -> Result<Self> {
        let root = data.join("super-sessions");
        fs::create_dir_all(&root).map_err(io_error)?;
        crate::private(&root)?;
        let mut entries = BTreeMap::new();
        for file in fs::read_dir(&root).map_err(io_error)? {
            let file = file.map_err(io_error)?;
            if file.file_type().map_err(io_error)?.is_dir() {
                let path = file.path().join("ownership.json");
                if path.is_file() {
                    let mut s: Session = serde_json::from_slice(&fs::read(path).map_err(io_error)?)
                        .map_err(|_| {
                            error(
                                "INVALID_SESSION_JOURNAL",
                                "Session ownership journal is invalid",
                            )
                        })?;
                    if s.directory != file.path()
                        || s.distribution != format!("MaterialBrowser-{}", s.id)
                        || !valid_id(&s.id)
                    {
                        return Err(error(
                            "INVALID_SESSION_JOURNAL",
                            "Session ownership does not match staging directory",
                        ));
                    }
                    if s.operation_id.is_empty() {
                        s.operation_id = s.id.clone();
                    }
                    if !matches!(
                        s.state.as_str(),
                        "stopped" | "saved" | "discarded" | "cleanup-required" | "save-ready"
                    ) {
                        s.state = "recovery-required".into();
                        s.message =
                            "Host restarted; stop and verify the owned guest before saving".into();
                        s.health = Some(health::Snapshot::unknown(
                            "Host restarted; guest observation ownership must be recovered explicitly",
                        ));
                    }
                    entries.insert(s.id.clone(), s);
                }
            }
        }
        Ok(Self {
            root,
            entries,
            children: BTreeMap::new(),
            observers: BTreeMap::new(),
            workers: BTreeMap::new(),
            unlock_epoch: crate::random_hex(),
        })
    }
    fn persist(&self, s: &Session) -> Result<()> {
        let temp = s.directory.join("ownership.tmp");
        fs::write(
            &temp,
            serde_json::to_vec_pretty(s)
                .map_err(|_| error("SERIALIZATION", "Cannot serialize session"))?,
        )
        .map_err(io_error)?;
        fs::rename(temp, s.directory.join("ownership.json")).map_err(io_error)
    }
    fn progress(&self, s: &mut Session, phase: &str, message: &str) -> Result<()> {
        asynchronous::check_cancel()?;
        asynchronous::event(s, phase, message);
        self.persist(s)
    }
    fn refresh_workers(&mut self) {
        let completed = self
            .workers
            .iter()
            .filter(|(_, worker)| worker.is_finished())
            .map(|(id, _)| id.clone())
            .collect::<Vec<_>>();
        for id in completed {
            if let Some(worker) = self.workers.remove(&id) {
                match worker.join() {
                    Ok((entries, children, observers)) => {
                        self.entries.extend(entries);
                        self.children.extend(children);
                        self.observers.extend(observers);
                    }
                    Err(_) => {
                        if let Some(s) = self.entries.get_mut(&id) {
                            s.state = "recovery-required".into();
                            asynchronous::event(
                                s,
                                "failed",
                                "Provisioning worker stopped unexpectedly; inspect retained staging",
                            );
                        }
                    }
                }
            }
        }
        for id in self.workers.keys() {
            if let Some(known) = self.entries.get(id) {
                let path = known.directory.join("ownership.json");
                if let Ok(bytes) = fs::read(path) {
                    if bytes.len() <= 1048576 {
                        if let Ok(updated) = serde_json::from_slice::<Session>(&bytes) {
                            if updated.id == known.id
                                && updated.directory == known.directory
                                && updated.distribution == known.distribution
                            {
                                self.entries.insert(id.clone(), updated);
                            }
                        }
                    }
                }
            }
        }
        self.refresh_health();
    }
    pub fn capabilities() -> Value {
        capabilities::detect()
    }
    pub fn launch(
        &mut self,
        core: &mut material_browser_core::Manager,
        p: &Value,
        browser_executable: Option<&Path>,
    ) -> Result<Value> {
        self.refresh_workers();
        if !cfg!(windows) {
            return Err(error(
                "PLATFORM_UNSUPPORTED",
                "Disposable guests require the supported Windows host",
            ));
        }
        if p["requireStableIdentity"] != false {
            return Err(error(
                "IDENTITY_CONFIRMATION_REQUIRED",
                "Explicitly confirm that stable external identity is not required",
            ));
        }
        let profile_id = text(p, "profileId")?;
        let profiles = core
            .execute("superProfiles.list", json!({}))
            .map_err(|e| error(&e.code, &e.message))?;
        let profile = profiles
            .as_array()
            .and_then(|a| a.iter().find(|v| v["id"] == profile_id))
            .ok_or_else(|| error("PROFILE_NOT_FOUND", "Super Profile not found"))?;
        require_setup_complete(&profile["settings"])?;
        if self.entries.values().any(|s| {
            s.profile_id == profile_id
                && !matches!(s.state.as_str(), "stopped" | "saved" | "discarded")
        }) {
            return Err(error(
                "SESSION_ACTIVE",
                "Stop the existing session before launching again",
            ));
        }
        let settings = &profile["settings"];
        let engine = profile["engine"].as_str().unwrap_or("chromium");
        if !matches!(engine, "chromium" | "firefox") {
            return Err(error("ENGINE_UNSUPPORTED", "Unknown guest browser engine"));
        }
        for key in ["clipboard", "memoryMb"] {
            if settings.get(key).is_some() {
                return Err(error(
                    "CONFIGURATION_UNSUPPORTED",
                    &format!("{key} is not supported by this backend yet"),
                ));
            }
        }
        let backend = text(settings, "backend")?;
        if backend == "windows-sandbox" && engine != "chromium" {
            return Err(error(
                "ENGINE_UNSUPPORTED",
                "Sandbox currently supports the verified managed Chromium bundle",
            ));
        }
        if settings.get("networking").is_some_and(|v| !v.is_boolean()) {
            return Err(error("INVALID_PARAMS", "networking must be a boolean"));
        }
        if backend == "wsl2" && settings.get("networking").is_some() {
            return Err(error(
                "CONFIGURATION_UNSUPPORTED",
                "Per-distribution WSL networking controls are not available without host settings changes",
            ));
        }
        let mode = settings["launchMode"].as_str().unwrap_or("terminal");
        if !["terminal", "browser", "desktop"].contains(&mode) {
            return Err(error("INVALID_MODE", "Unsupported guest mode"));
        }
        capabilities::require_mode(&capabilities::detect(), backend, mode)?;
        let id = crate::random_hex();
        let directory = self.root.join(&id);
        fs::create_dir(&directory).map_err(io_error)?;
        crate::private(&directory)?;
        let mut s = Session {
            id: id.clone(),
            profile_id: profile_id.into(),
            revision_id: text(profile, "revisionId")?.into(),
            distribution: format!("MaterialBrowser-{id}"),
            mode: mode.into(),
            backend: backend.into(),
            state: "staging".into(),
            directory,
            message: String::new(),
            operation_id: id.clone(),
            phase: "staging".into(),
            events: Vec::new(),
            guest_removed: false,
            guest_created: false,
            save_requested: false,
            guest_action_attempts: 0,
            save_plan: None,
            saved_revision_id: None,
            save_confirmation_required: false,
            health_nonce: String::new(),
            health: None,
        };
        self.persist(&s)?;
        self.entries.insert(id.clone(), s.clone());
        let archive = s.directory.join("state.tar");
        if let Err(e) = core.export_super_profile_state(profile_id, &archive) {
            if e.code != "NOT_FOUND" {
                s.state = "recovery-required".into();
                s.message = e.message.clone();
                self.persist(&s)?;
                self.entries.insert(id, s);
                return Err(error(&e.code, &e.message));
            }
        }
        s.state = "provisioning".into();
        s.phase = "queued".into();
        s.message = "Guest provisioning queued; observe status for durable progress".into();
        asynchronous::event(
            &mut s,
            "queued",
            "Guest provisioning queued; observe status for durable progress",
        );
        self.persist(&s)?;
        self.entries.insert(id.clone(), s.clone());
        let settings = settings.clone();
        let engine = engine.to_string();
        let browser = browser_executable.map(Path::to_path_buf);
        self.spawn_worker(s.clone(), move |runner, session| {
            runner.provision(&settings, session, archive, &engine, browser.as_deref())
        })?;
        Ok(json!(s))
    }
    pub fn status(&mut self) -> Value {
        self.refresh_workers();
        for s in self.entries.values_mut() {
            s.save_confirmation_required = s.state == "save-ready"
                && s.save_plan
                    .as_ref()
                    .is_some_and(|p| p.collection_epoch != self.unlock_epoch);
            if s.backend == "windows-sandbox" {
                s.save_requested = s.directory.join("exchange/save-requested").is_file();
            }
            if s.backend == "windows-sandbox"
                && matches!(s.state.as_str(), "starting" | "running" | "launched")
                && control_receipt(&s.directory.join("exchange/failed"))
            {
                s.state = "recovery-required".into();
                s.message =
                    "Sandbox guest bootstrap or graceful stop failed; staging retained".into();
            }
        }
        json!(self.entries.values().collect::<Vec<_>>())
    }
    pub fn reconcile_guest_requests(
        &mut self,
        core: &mut material_browser_core::Manager,
        unlocked: bool,
    ) {
        self.refresh_workers();
        let requests = self
            .entries
            .values()
            .filter(|s| {
                s.backend == "windows-sandbox"
                    && !matches!(
                        s.state.as_str(),
                        "discarded" | "saved" | "cleanup-required" | "save-ready" | "collecting"
                    )
                    && s.guest_action_attempts < 3
                    && control_receipt(&s.directory.join("exchange/stopped"))
            })
            .filter_map(|s| {
                let save = control_receipt(&s.directory.join("exchange/save-requested"));
                let discard = control_receipt(&s.directory.join("exchange/discard-requested"));
                if save == discard || (save && !unlocked) {
                    None
                } else {
                    Some((s.id.clone(), s.revision_id.clone(), save))
                }
            })
            .collect::<Vec<_>>();
        for (id, revision, save) in requests {
            if let Some(mut session) = self.entries.get(&id).cloned() {
                session.guest_action_attempts += 1;
                if self.persist(&session).is_err() {
                    continue;
                }
                self.entries.insert(id.clone(), session);
            }
            let result = if save {
                self.save(core,&json!({"sessionId":id,"expectedRevisionId":revision,"categories":["browser","workspace"],"closeAfterSave":true}))
            } else {
                self.discard(&id)
            };
            if let Err(e) = result {
                if let Some(mut session) = self.entries.get(&id).cloned() {
                    asynchronous::event(
                        &mut session,
                        "guest-action-failed",
                        &format!("Guest request could not complete: {}", e.message),
                    );
                    let _ = self.persist(&session);
                    self.entries.insert(id, session);
                }
            }
        }
    }
    pub fn guard_mutation(&self, profile: Option<&str>) -> Result<()> {
        if self
            .entries
            .values()
            .any(|s| s.state != "discarded" && profile.is_none_or(|id| s.profile_id == id))
        {
            return Err(error(
                "SESSION_RETAINED",
                "Save or discard retained sessions before changing their template or locking the vault",
            ));
        }
        Ok(())
    }
    pub fn stop(&mut self, id: &str) -> Result<Value> {
        self.refresh_workers();
        if self.workers.contains_key(id) {
            let s = self
                .entries
                .get(id)
                .ok_or_else(|| error("SESSION_NOT_FOUND", "Session not found"))?;
            fs::write(s.directory.join("cancel-requested"), b"cancel").map_err(io_error)?;
            let mut response = s.clone();
            response.state = "cancelling".into();
            response.message =
                "Cancellation requested; wait for acknowledgement before stopping the guest".into();
            return Ok(json!(response));
        }
        self.stop_observer(id)?;
        let mut s = self
            .entries
            .get(id)
            .cloned()
            .ok_or_else(|| error("SESSION_NOT_FOUND", "Session not found"))?;
        if !matches!(
            s.state.as_str(),
            "stopped" | "saved" | "discarded" | "cleanup-required"
        ) {
            if s.backend == "windows-sandbox" {
                if s.guest_created || self.children.contains_key(id) {
                    sandbox::stop(&s, self.children.get_mut(id))?;
                } else if s.phase == "launching-sandbox" {
                    return Err(error(
                        "SANDBOX_RECOVERY_REQUIRED",
                        "Sandbox creation was interrupted without a process ownership receipt; inspect retained staging before recovery",
                    ));
                }
            } else {
                if !registration_present(&s)? {
                    s.state = "stopped".into();
                    s.message =
                        "No owned WSL registration exists; staged input is ready for discard"
                            .into();
                    self.persist(&s)?;
                    self.entries.insert(id.into(), s.clone());
                    return Ok(json!(s));
                }
                s.guest_created = true;
                run(
                    &[
                        "-d",
                        &s.distribution,
                        "-u",
                        "root",
                        "--exec",
                        "sh",
                        "-lc",
                        "pkill -TERM -u materialbrowser || true; for i in 1 2 3 4 5 6 7 8 9 10; do if ! ps -u materialbrowser -o stat= | grep -v '^Z' | grep -q .; then exit 0; fi; sleep 1; done; exit 1",
                    ],
                    Duration::from_secs(20),
                )?;
                run(&["--terminate", &s.distribution], Duration::from_secs(30))?;
            }
            s.state = "stopped".into();
            s.message = "Owned guest stopped; managed state is retained for save or discard".into();
            self.persist(&s)?;
            self.entries.insert(id.into(), s.clone());
        }
        Ok(json!(s))
    }
    pub fn preview(&self, p: &Value) -> Result<Value> {
        let s = self
            .entries
            .get(text(p, "sessionId")?)
            .ok_or_else(|| error("SESSION_NOT_FOUND", "Session not found"))?;
        Ok(
            json!({"sessionId":s.id,"categories":[{"id":"browser","included":true,"description":"Backend-specific managed browser state"},{"id":"workspace","included":true,"description":"Managed guest workspace files"}],"excluded":["operating-system","external-folders","machine-identity"],"stopped":s.state=="stopped","requiresExpectedRevisionId":true}),
        )
    }
    pub fn discard(&mut self, id: &str) -> Result<Value> {
        self.refresh_workers();
        let mut s = self
            .entries
            .get(id)
            .cloned()
            .ok_or_else(|| error("SESSION_NOT_FOUND", "Session not found"))?;
        if s.state == "discarded" {
            return Ok(json!(s));
        }
        if !matches!(s.state.as_str(), "stopped" | "saved" | "cleanup-required") {
            let stopped = self.stop(id)?;
            if stopped["state"] == "cancelling" {
                return Ok(stopped);
            }
            s = self
                .entries
                .get(id)
                .cloned()
                .ok_or_else(|| error("SESSION_NOT_FOUND", "Session not found"))?;
        }
        if !matches!(s.state.as_str(), "stopped" | "saved" | "cleanup-required") {
            return Err(error(
                "SESSION_NOT_STOPPED",
                "Stop the guest before discarding",
            ));
        }
        if s.backend == "wsl2" && !s.guest_removed && registration_present(&s)? {
            run(&["--unregister", &s.distribution], Duration::from_secs(60))?;
        }
        if let Some(mut child) = self.children.remove(id) {
            if child.try_wait().map_err(io_error)?.is_none() {
                child.kill().map_err(io_error)?;
                child.wait().map_err(io_error)?;
            }
        }
        let connection = s.directory.join("desktop.rdp");
        if connection.is_file() {
            fs::remove_file(connection).map_err(io_error)?;
        }
        s.guest_removed = true;
        s.state = "cleanup-required".into();
        s.message = "Owned guest removed; removing decrypted session staging".into();
        self.persist(&s)?;
        self.entries.insert(id.into(), s.clone());
        if let Err(e) = cleanup::wipe(&s.directory) {
            s.message = e.message.clone();
            self.persist(&s)?;
            self.entries.insert(id.into(), s);
            return Err(e);
        }
        s.state = "discarded".into();
        s.message =
            "Owned guest and decrypted staging discarded; immutable template revisions retained"
                .into();
        self.persist(&s)?;
        self.entries.insert(id.into(), s.clone());
        Ok(json!(s))
    }
}
fn selected_categories(p: &Value) -> Result<Vec<&str>> {
    let Some(value) = p.get("categories") else {
        return Ok(vec!["browser", "workspace"]);
    };
    let values = value
        .as_array()
        .ok_or_else(|| error("INVALID_PARAMS", "categories must be an array"))?;
    let mut selected = Vec::new();
    for value in values {
        let category = value
            .as_str()
            .ok_or_else(|| error("INVALID_PARAMS", "Invalid save category"))?;
        if !matches!(category, "browser" | "workspace") || selected.contains(&category) {
            return Err(error(
                "INVALID_PARAMS",
                "Unknown or duplicate save category",
            ));
        }
        selected.push(category);
    }
    if selected.is_empty() {
        return Err(error("INVALID_PARAMS", "Select at least one save category"));
    }
    Ok(selected)
}
fn control_receipt(path: &Path) -> bool {
    let Ok(metadata) = fs::symlink_metadata(path) else {
        return false;
    };
    if !metadata.is_file() || metadata.file_type().is_symlink() || metadata.len() > 128 {
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
fn wait_owned(mut child: Child, timeout: Duration) -> Result<()> {
    let start = Instant::now();
    loop {
        if let Err(e) = asynchronous::check_cancel() {
            let _ = child.kill();
            let _ = child.wait();
            return Err(e);
        }
        if let Some(status) = child.try_wait().map_err(io_error)? {
            return if status.success() {
                Ok(())
            } else {
                Err(error(
                    "GUEST_COMMAND_FAILED",
                    "Managed guest transfer failed; staging retained",
                ))
            };
        }
        if start.elapsed() > timeout {
            let _ = child.kill();
            let _ = child.wait();
            return Err(error(
                "GUEST_TIMEOUT",
                "Managed guest transfer timed out; staging retained",
            ));
        }
        thread::sleep(Duration::from_millis(100));
    }
}
fn verify_registration(s: &Session) -> Result<()> {
    if !registration_present(s)? {
        return Err(error(
            "GUEST_NOT_REGISTERED",
            "No owned WSL distribution is registered",
        ));
    }
    Ok(())
}
fn registration_present(s: &Session) -> Result<bool> {
    let script = format!(
        "$ErrorActionPreference='Stop'; if (!(Test-Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss')) {{ exit 0 }}; $d=@(Get-ChildItem 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss' | Get-ItemProperty | Where-Object {{ $_.DistributionName -eq '{}' }}); if ($d.Count -eq 0) {{ exit 0 }}; if ($d.Count -ne 1) {{ exit 2 }}; [Console]::Write($d[0].BasePath)",
        s.distribution
    );
    let actual = command(
        "powershell.exe",
        &["-NoProfile", "-NonInteractive", "-Command", &script],
        Duration::from_secs(15),
    )?;
    if actual.trim().is_empty() {
        return Ok(false);
    }
    let actual = fs::canonicalize(actual.trim()).map_err(io_error)?;
    let expected = fs::canonicalize(s.directory.join("distribution")).map_err(io_error)?;
    if actual != expected {
        return Err(error(
            "OWNERSHIP_MISMATCH",
            "WSL registration path does not match the owned staging directory",
        ));
    }
    Ok(true)
}
fn unicode(path: &Path) -> Result<&str> {
    path.to_str()
        .ok_or_else(|| error("INVALID_PATH", "Guest path is not Unicode"))
}
fn text<'a>(v: &'a Value, key: &str) -> Result<&'a str> {
    v[key]
        .as_str()
        .filter(|s| !s.is_empty())
        .ok_or_else(|| error("INVALID_PARAMS", &format!("{key} is required")))
}
fn require_setup_complete(settings: &Value) -> Result<()> {
    match settings.get("setupDraft") {
        Some(Value::Bool(true)) => Err(error(
            "SETUP_INCOMPLETE",
            "Complete setup before launching this template",
        )),
        Some(Value::Bool(false)) | None => Ok(()),
        Some(_) => Err(error("INVALID_PARAMS", "setupDraft must be a boolean")),
    }
}
fn valid_id(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit())
}
fn verify_hash(path: &Path, expected: &str) -> Result<()> {
    use sha2::{Digest, Sha256};
    if expected.len() != 64 || !expected.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(error("INVALID_ROOTFS_HASH", "A SHA-256 digest is required"));
    }
    let mut f = fs::File::open(path).map_err(io_error)?;
    let mut hash = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        asynchronous::check_cancel()?;
        let n = f.read(&mut buf).map_err(io_error)?;
        if n == 0 {
            break;
        }
        hash.update(&buf[..n]);
    }
    if format!("{:x}", hash.finalize()) != expected.to_ascii_lowercase() {
        return Err(error(
            "ROOTFS_HASH_MISMATCH",
            "Root filesystem does not match the approved digest",
        ));
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    #[test]
    fn unfinished_setup_cannot_pass_launch_preflight() {
        assert_eq!(
            require_setup_complete(&json!({"setupDraft":true}))
                .unwrap_err()
                .code,
            "SETUP_INCOMPLETE"
        );
        assert_eq!(
            require_setup_complete(&json!({"setupDraft":"true"}))
                .unwrap_err()
                .code,
            "INVALID_PARAMS"
        );
        assert!(require_setup_complete(&json!({})).is_ok());
        assert!(require_setup_complete(&json!({"setupDraft":false,"configurations":{"windows-sandbox":{"setupDraft":true}}})).is_ok());
    }

    #[cfg(windows)]
    #[test]
    fn draft_launch_creates_no_journal_worker_or_guest_resources() {
        let root = std::env::temp_dir().join(format!("material-draft-{}", crate::random_hex()));
        let mut core = material_browser_core::Manager::new(root.join("vault")).unwrap();
        core.execute("vault.create", json!({"password":"test password"}))
            .unwrap();
        let draft = core.execute("superProfiles.create", json!({"name":"Draft","settings":{"backend":"wsl2","setupDraft":true,"draftStep":2}})).unwrap();
        let mut sessions = Sessions::new(&root).unwrap();
        assert_eq!(fs::read_dir(&sessions.root).unwrap().count(), 0);
        assert_eq!(
            sessions
                .launch(
                    &mut core,
                    &json!({"profileId":draft["id"],"requireStableIdentity":false}),
                    None
                )
                .unwrap_err()
                .code,
            "SETUP_INCOMPLETE"
        );
        assert_eq!(fs::read_dir(&sessions.root).unwrap().count(), 0);
        assert!(sessions.entries.is_empty());
        assert!(sessions.workers.is_empty());
        assert!(sessions.children.is_empty());
        drop(sessions);
        drop(core);
        fs::remove_dir_all(root).unwrap();
    }

    use super::*;
    #[test]
    fn ownership_ids_are_strict() {
        assert!(valid_id(&crate::random_hex()));
        assert!(!valid_id("0123456789abcdef0123456789abcdef"));
        assert!(valid_id(
            "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
        ));
        assert!(!valid_id("../real-distribution"));
    }
    #[test]
    fn real_session_identity_survives_journal_recovery() {
        let root =
            std::env::temp_dir().join(format!("material-session-recovery-{}", crate::random_hex()));
        fs::create_dir(&root).unwrap();
        let mut sessions = Sessions::new(&root).unwrap();
        let id = crate::random_hex();
        let directory = sessions.root.join(&id);
        fs::create_dir(&directory).unwrap();
        let session = Session {
            id: id.clone(),
            profile_id: "profile-a".into(),
            revision_id: "revision-a".into(),
            distribution: format!("MaterialBrowser-{id}"),
            mode: "terminal".into(),
            backend: "wsl2".into(),
            state: "provisioning".into(),
            directory,
            message: "pending".into(),
            operation_id: id.clone(),
            phase: "queued".into(),
            events: Vec::new(),
            guest_removed: false,
            guest_created: false,
            save_requested: false,
            guest_action_attempts: 0,
            save_plan: None,
            saved_revision_id: None,
            save_confirmation_required: false,
            health_nonce: String::new(),
            health: None,
        };
        sessions.persist(&session).unwrap();
        sessions.entries.insert(id.clone(), session);
        drop(sessions);
        let recovered = Sessions::new(&root).unwrap();
        assert_eq!(recovered.entries[&id].state, "recovery-required");
        assert_eq!(recovered.entries[&id].operation_id, id);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn archive_scope_rejects_escape_and_unsupported_categories() {
        for p in ["browser/a", "workspace/file"] {
            assert!(safe_member(p));
        }
        for p in [
            "../browser/a",
            "browser/../etc",
            "C:/browser",
            "browser\\x",
            "etc/passwd",
            "/browser/a",
        ] {
            assert!(!safe_member(p));
        }
    }
    #[test]
    fn retained_sessions_block_template_mutations_until_discarded() {
        let s = Session {
            id: "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef".into(),
            profile_id: "profile-a".into(),
            revision_id: "revision-a".into(),
            distribution:
                "MaterialBrowser-0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
                    .into(),
            mode: "browser".into(),
            backend: "wsl2".into(),
            state: "saved".into(),
            directory: PathBuf::from("unused"),
            message: String::new(),
            operation_id: "test-operation".into(),
            phase: "test".into(),
            events: Vec::new(),
            guest_removed: false,
            guest_created: false,
            save_requested: false,
            guest_action_attempts: 0,
            save_plan: None,
            saved_revision_id: None,
            save_confirmation_required: false,
            health_nonce: String::new(),
            health: None,
        };
        let mut sessions = Sessions {
            root: PathBuf::from("unused"),
            entries: BTreeMap::from([(s.id.clone(), s)]),
            children: BTreeMap::new(),
            observers: BTreeMap::new(),
            workers: BTreeMap::new(),
            unlock_epoch: crate::random_hex(),
        };
        assert!(sessions.guard_mutation(Some("profile-a")).is_err());
        assert!(sessions.guard_mutation(None).is_err());
        assert!(sessions.guard_mutation(Some("profile-b")).is_ok());
        sessions.entries.values_mut().next().unwrap().state = "discarded".into();
        assert!(sessions.guard_mutation(None).is_ok());
    }
    #[test]
    fn non_windows_capabilities_fail_closed() {
        if !cfg!(windows) {
            assert_eq!(Sessions::capabilities()["wsl2"]["available"], false);
        }
    }
}

//! Managed executables and application-owned browser profile lifecycle.
//! No advanced capability is inferred from command-line flags.
use fs2::FileExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::HashMap,
    fs::{self, File, OpenOptions},
    io::Read,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    time::{Duration, Instant},
};

#[derive(Debug)]
pub struct EngineError {
    pub code: String,
    pub message: String,
}
impl std::fmt::Display for EngineError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for EngineError {}
fn err(code: &str, message: &str) -> EngineError {
    EngineError {
        code: code.into(),
        message: message.into(),
    }
}
type Result<T> = std::result::Result<T, EngineError>;
fn io(_: std::io::Error) -> EngineError {
    err("ENGINE_IO", "Engine filesystem or process operation failed")
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq, Hash)]
#[serde(rename_all = "lowercase")]
pub enum EngineKind {
    Chromium,
    Firefox,
}
#[derive(Clone, Copy, Debug, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum AutomationMode {
    Off,
    Selenium,
    Puppeteer,
}
#[derive(Clone, Debug, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct Capabilities {
    pub portable_encryption: bool,
    pub live_snapshot: bool,
    pub stable_identity: bool,
    pub selenium: bool,
    pub puppeteer: bool,
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct EngineManifest {
    pub schema_version: u32,
    pub engine: EngineKind,
    pub version: String,
    pub executable: PathBuf,
    pub executable_sha256: String,
    pub upstream_revision: String,
    pub capabilities: Capabilities,
}
#[derive(Clone, Debug)]
pub struct VerifiedEngine {
    manifest: EngineManifest,
    executable: PathBuf,
}
impl VerifiedEngine {
    pub fn manifest(&self) -> &EngineManifest {
        &self.manifest
    }
}
#[derive(Default)]
pub struct EngineRegistry {
    engines: HashMap<EngineKind, VerifiedEngine>,
    adapters: HashMap<(EngineKind, u8), AdapterRuntime>,
}
impl EngineRegistry {
    pub fn new() -> Self {
        Self::default()
    }
    /// Manifest location is supplied by the native host, never renderer input.
    pub fn register(&mut self, bundle: &Path, manifest_path: &Path) -> Result<()> {
        let bytes = fs::read(manifest_path).map_err(io)?;
        if bytes.len() > 65536 {
            return Err(err("INVALID_MANIFEST", "Manifest exceeds size limit"));
        }
        let manifest: EngineManifest = serde_json::from_slice(&bytes)
            .map_err(|_| err("INVALID_MANIFEST", "Invalid engine manifest"))?;
        if manifest.schema_version != 1
            || manifest.version.is_empty()
            || manifest.upstream_revision.is_empty()
            || manifest.executable.is_absolute()
            || manifest
                .executable
                .components()
                .any(|c| !matches!(c, std::path::Component::Normal(_)))
        {
            return Err(err(
                "INVALID_MANIFEST",
                "Invalid engine pin or executable path",
            ));
        }
        // Until an engine integration verifier is available, declarations cannot enable features.
        if manifest.capabilities.portable_encryption
            || manifest.capabilities.live_snapshot
            || manifest.capabilities.stable_identity
        {
            return Err(err(
                "UNVERIFIED_CAPABILITY",
                "Advanced engine integration lacks accepted source and runtime evidence",
            ));
        }
        let root = bundle.canonicalize().map_err(io)?;
        let executable = root.join(&manifest.executable).canonicalize().map_err(io)?;
        if !executable.starts_with(&root) || !executable.is_file() {
            return Err(err(
                "INVALID_EXECUTABLE",
                "Executable is outside engine bundle",
            ));
        }
        verify_hash(&executable, &manifest.executable_sha256)?;
        self.engines.insert(
            manifest.engine,
            VerifiedEngine {
                manifest,
                executable,
            },
        );
        Ok(())
    }
    pub fn get(&self, kind: EngineKind) -> Result<&VerifiedEngine> {
        self.engines
            .get(&kind)
            .ok_or_else(|| err("ENGINE_UNAVAILABLE", "No verified engine installed"))
    }
}
fn verify_hash(path: &Path, expected: &str) -> Result<()> {
    if expected.len() != 64 || !expected.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(err("INVALID_HASH", "Expected SHA-256 is invalid"));
    }
    let mut file = File::open(path).map_err(io)?;
    let mut hash = Sha256::new();
    let mut buf = [0u8; 65536];
    loop {
        let n = file.read(&mut buf).map_err(io)?;
        if n == 0 {
            break;
        }
        hash.update(&buf[..n]);
    }
    if format!("{:x}", hash.finalize()) != expected.to_ascii_lowercase() {
        return Err(err("HASH_MISMATCH", "Engine executable hash mismatch"));
    }
    Ok(())
}
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchRequest {
    pub profile_id: String,
    pub engine: EngineKind,
    pub requested_mode: AutomationMode,
    #[serde(default)]
    pub require_stable_identity: bool,
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessStatus {
    pub profile_id: String,
    pub pid: u32,
    pub engine: EngineKind,
    pub effective_mode: AutomationMode,
    pub engine_version: String,
}
struct OwnedProcess {
    child: Option<Child>,
    status: ProcessStatus,
    _lock: File,
    adapter: bool,
    endpoint: Option<AutomationEndpoint>,
    _job: process_job::ProcessJob,
    identity: lifetime::ProcessIdentity,
}
impl OwnedProcess {
    fn helper_only(&mut self) -> Result<bool> {
        if let Some(child) = self.child.as_mut() {
            Ok(child.try_wait().map_err(io)?.is_none()
                && !lifetime::is_alive(&self.identity)?
                && self._job.process_ids()? == vec![child.id()])
        } else { Ok(false) }
    }
    fn reap_child(&mut self) -> Result<bool> {
        let exited = match self.child.as_mut() {
            Some(child) => child.try_wait().map_err(io)?.is_some(),
            None => true,
        };
        if exited {
            // Close only the exact owned child handle after its exit is proven.
            drop(self.child.take());
        }
        Ok(exited)
    }
}
/// Keep this lease alive for the entire snapshot, restore, or removal operation.
pub struct ProfileLease {
    _lock: File,
}
pub struct Supervisor {
    root: PathBuf,
    processes: HashMap<String, OwnedProcess>,
}
impl Supervisor {
    pub fn new(profile_root: PathBuf) -> Result<Self> {
        fs::create_dir_all(&profile_root).map_err(io)?;
        Ok(Self {
            root: profile_root.canonicalize().map_err(io)?,
            processes: HashMap::new(),
        })
    }
    pub fn launch(
        &mut self,
        registry: &EngineRegistry,
        request: LaunchRequest,
    ) -> Result<ProcessStatus> {
        validate_id(&request.profile_id)?;
        self.reap()?;
        if self.processes.contains_key(&request.profile_id) {
            return Err(err(
                "PROFILE_ACTIVE",
                "Profile already has an owned process",
            ));
        }
        if request.require_stable_identity {
            return Err(err(
                "IDENTITY_UNAVAILABLE",
                "Native engine identity integration is unverified",
            ));
        }
        let engine = registry.get(request.engine)?;
        verify_hash(&engine.executable, &engine.manifest.executable_sha256)?;
        let path = self.root.join(&request.profile_id);
        fs::create_dir_all(&path).map_err(io)?;
        let path = path.canonicalize().map_err(io)?;
        if path.parent() != Some(self.root.as_path()) {
            return Err(err(
                "INVALID_PROFILE_PATH",
                "Profile must be an application-owned direct child",
            ));
        }
        fs::create_dir_all(self.root.join(".material-browser-locks")).map_err(io)?;
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(
                self.root
                    .join(".material-browser-locks")
                    .join(format!("{}.lock", request.profile_id)),
            )
            .map_err(io)?;
        lock.try_lock_exclusive()
            .map_err(|_| err("PROFILE_LOCKED", "Profile is in use by another supervisor"))?;
        lifetime::assert_inactive(&self.root, &request.profile_id)?;
        let mut cmd = Command::new(&engine.executable);
        cmd.stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        cmd.args(off_arguments(request.engine, &path));
        let adapter = request.requested_mode != AutomationMode::Off;
        let runtime = if adapter {
            let runtime = registry
                .adapters
                .get(&(request.engine, mode_key(request.requested_mode)))
                .ok_or_else(|| {
                    err(
                        "AUTOMATION_UNAVAILABLE",
                        "No pinned adapter runtime is configured",
                    )
                })?;
            runtime.verify(request.requested_mode, &engine.manifest.version)?;
            Some(runtime)
        } else {
            None
        };
        // Persist intent before spawning. A crash at any later instruction cannot look idle.
        lifetime::persist(
            &self.root,
            &request.profile_id,
            &lifetime::Journal::Starting {
                profile: path.clone(),
            },
        )?;
        let (child, pid, endpoint, job) = if let Some(runtime) = runtime {
            runtime.spawn(engine, &path, request.requested_mode)?
        } else {
            #[cfg(windows)]
            {
                use std::os::windows::process::CommandExt;
                cmd.creation_flags(0x4); // CREATE_SUSPENDED, contain before any browser instruction.
            }
            let mut child = cmd.spawn().map_err(io)?;
            let job = process_job::ProcessJob::attach(&mut child, true)?;
            let pid = child.id();
            (child, pid, None, job)
        };
        let identity = lifetime::capture(pid, &engine.executable, &path)?;
        lifetime::persist(
            &self.root,
            &request.profile_id,
            &lifetime::Journal::Running {
                identity: identity.clone(),
            },
        )?;
        let status = ProcessStatus {
            profile_id: request.profile_id.clone(),
            pid,
            engine: request.engine,
            effective_mode: request.requested_mode,
            engine_version: engine.manifest.version.clone(),
        };
        self.processes.insert(
            request.profile_id,
            OwnedProcess {
                child: Some(child),
                status: status.clone(),
                _lock: lock,
                adapter,
                endpoint,
                _job: job,
                identity,
            },
        );
        Ok(status)
    }
    pub fn status(&mut self) -> Result<Vec<ProcessStatus>> {
        self.reap()?;
        Ok(self.processes.values().map(|p| p.status.clone()).collect())
    }
    fn reap(&mut self) -> Result<()> {
        let mut exited = Vec::new();
        for (id, p) in &mut self.processes {
            p.reap_child()?;
            if !lifetime::is_alive(&p.identity)? && p._job.is_empty()? {
                exited.push(id.clone());
            }
        }
        for id in exited {
            self.processes.remove(&id);
        }
        Ok(())
    }
    /// Request browser close without force-killing the browser or unrelated PIDs.
    pub fn stop(&mut self, id: &str, timeout: Duration) -> Result<()> {
        self.reap()?;
        let p = self
            .processes
            .get_mut(id)
            .ok_or_else(|| err("PROFILE_NOT_RUNNING", "No owned process"))?;
        let mut helper_settled = false;
        if p.adapter {
            use std::io::Write;
            let helper_only = p.helper_only()?;
            helper_settled = helper_only;
            let command: &[u8] = if helper_only {
                // This trusted stdin command is permitted only after native
                // browser exit and complete job membership prove no child remains.
                b"{\"command\":\"shutdown-browser-exited\"}\n"
            } else { b"{\"command\":\"shutdown\"}\n" };
            p.child
                .as_mut()
                .ok_or_else(|| err("ADAPTER_IO", "Adapter has already exited"))?
                .stdin
                .as_mut()
                .ok_or_else(|| err("ADAPTER_IO", "Adapter input is unavailable"))?
                .write_all(command)
                .map_err(io)?;
        }
        let until = Instant::now() + timeout.min(Duration::from_secs(30));
        while Instant::now() < until {
            if p.reap_child()? && !lifetime::is_alive(&p.identity)? && p._job.is_empty()? {
                self.processes.remove(id);
                return Ok(());
            }
            if p.adapter && !helper_settled && p.helper_only()? {
                use std::io::Write;
                let sent = p.child.as_mut().and_then(|child| child.stdin.as_mut())
                    .ok_or_else(|| err("ADAPTER_IO", "Adapter input is unavailable"))?
                    .write_all(b"{\"command\":\"shutdown-browser-exited\"}\n");
                match sent {
                    Ok(()) => helper_settled = true,
                    Err(error) => if !p.reap_child()? { return Err(io(error)); },
                }
            }
            if !p.adapter {
                // Launch can return before Chromium creates its first top-level window.
                // Keep requesting graceful close within the caller's bound rather than
                // treating the first empty enumeration as a terminal failure.
                match request_close(&p._job, &p.identity) {
                    Ok(()) => {}
                    Err(e) if e.code == "GRACEFUL_STOP_UNAVAILABLE" => {}
                    Err(e) => return Err(e),
                }
            }
            std::thread::sleep(Duration::from_millis(100));
        }
        Err(err(
            "GRACEFUL_STOP_UNAVAILABLE",
            &format!("Engine did not acknowledge native shutdown; owned process job members: {:?}", p._job.process_ids()?),
        ))
    }
    pub fn snapshot(&self, _id: &str) -> Result<()> {
        Err(err(
            "LIVE_SNAPSHOT_UNAVAILABLE",
            "No verified native quiescence barrier; live directories must not be copied",
        ))
    }
    pub fn assert_profile_inactive(&mut self, id: &str) -> Result<()> {
        validate_id(id)?;
        self.reap()?;
        if self.processes.contains_key(id) {
            return Err(err("PROFILE_ACTIVE", "Profile has a supervised process"));
        }
        lifetime::assert_inactive(&self.root, id)
    }
    pub fn acquire_profile_idle(&mut self, id: &str) -> Result<ProfileLease> {
        validate_id(id)?;
        let path = self.root.join(id);
        fs::create_dir_all(&path).map_err(io)?;
        let path = path.canonicalize().map_err(io)?;
        if path.parent() != Some(self.root.as_path()) {
            return Err(err(
                "INVALID_PROFILE_PATH",
                "Profile must be a direct child",
            ));
        }
        fs::create_dir_all(self.root.join(".material-browser-locks")).map_err(io)?;
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(
                self.root
                    .join(".material-browser-locks")
                    .join(format!("{id}.lock")),
            )
            .map_err(io)?;
        lock.try_lock_exclusive()
            .map_err(|_| err("PROFILE_LOCKED", "Profile is in use"))?;
        self.assert_profile_inactive(id)?;
        Ok(ProfileLease { _lock: lock })
    }
    pub fn automation_endpoint(&mut self, id: &str) -> Result<AutomationEndpoint> {
        validate_id(id)?;
        self.reap()?;
        let process = self
            .processes
            .get(id)
            .ok_or_else(|| err("PROFILE_NOT_RUNNING", "No supervised profile"))?;
        let mut endpoint = process.endpoint.clone().ok_or_else(|| {
            err(
                "AUTOMATION_DISABLED",
                "This profile has no automation endpoint",
            )
        })?;
        endpoint.profile_id = id.into();
        Ok(endpoint)
    }
}
fn validate_id(id: &str) -> Result<()> {
    if id.len() != 36
        || !id.bytes().enumerate().all(|(i, b)| {
            if [8, 13, 18, 23].contains(&i) {
                b == b'-'
            } else {
                b.is_ascii_hexdigit()
            }
        })
    {
        return Err(err("INVALID_PROFILE_ID", "Profile identity must be a UUID"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    #[cfg(windows)]
    fn adapter_exit_does_not_release_a_surviving_browser_or_profile_lock() {
        use std::os::windows::process::CommandExt;
        let root = std::env::temp_dir().join(format!("engine-adapter-exit-{}", std::process::id()));
        let id = "00000000-0000-0000-0000-000000000006";
        let profile = root.join(id);
        fs::create_dir_all(&profile).unwrap();
        let profile = profile.canonicalize().unwrap();
        let executable = PathBuf::from(std::env::var_os("SystemRoot").unwrap())
            .join("System32/WindowsPowerShell/v1.0/powershell.exe").canonicalize().unwrap();
        let script = root.join("browser-fixture.ps1");
        fs::write(&script, b"param([Parameter(ValueFromRemainingArguments=$true)][string[]]$Rest)\nStart-Sleep -Seconds 30\n").unwrap();
        let mut supervisor = Supervisor::new(root.clone()).unwrap();
        let lease = supervisor.acquire_profile_idle(id).unwrap();
        let mut native = Command::new(&executable).args(["-NoProfile", "-NonInteractive", "-File"])
            .arg(&script).arg(format!("--user-data-dir={}", profile.display()))
            .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
            .creation_flags(0x08000000).spawn().unwrap();
        let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let identity = lifetime::capture(native.id(), &executable, &profile).unwrap();
            let mut helper = Command::new(&executable).args(["-NoProfile", "-NonInteractive", "-Command", "$null = [Console]::ReadLine()"])
                .stdin(Stdio::piped()).stdout(Stdio::null()).stderr(Stdio::null())
                .creation_flags(0x08000004).spawn().unwrap();
            let job = process_job::ProcessJob::attach(&mut helper, true).unwrap();
            lifetime::persist(&root, id, &lifetime::Journal::Running { identity: identity.clone() }).unwrap();
            supervisor.processes.insert(id.into(), OwnedProcess {
                child: Some(helper), status: ProcessStatus { profile_id: id.into(), pid: native.id(), engine: EngineKind::Chromium,
                    effective_mode: AutomationMode::Puppeteer, engine_version: "synthetic".into() },
                _lock: lease._lock, adapter: true, endpoint: None, _job: job, identity,
            });
            assert_eq!(supervisor.stop(id, Duration::from_millis(500)).unwrap_err().code, "GRACEFUL_STOP_UNAVAILABLE");
            // The helper read shutdown and exited, while the native identity is still alive.
            let until = Instant::now() + Duration::from_secs(5);
            while !supervisor.processes.get_mut(id).unwrap().reap_child().unwrap() && Instant::now() < until {
                std::thread::sleep(Duration::from_millis(25));
            }
            assert!(supervisor.processes.get(id).unwrap().child.is_none());
            assert_eq!(supervisor.status().unwrap().len(), 1);
            assert!(supervisor.acquire_profile_idle(id).is_err());
        }));
        // This exact child handle belongs only to the synthetic test process.
        let _ = native.kill();
        let _ = native.wait();
        outcome.unwrap();
    }
    #[test]
    fn profile_identity_cannot_escape_root() {
        for id in ["../personal", "", "00000000-0000-0000-0000-00000000000/"] {
            assert!(validate_id(id).is_err());
        }
        assert!(validate_id("00000000-0000-0000-0000-000000000000").is_ok());
    }
    #[test]
    fn idle_lease_excludes_other_supervisors_for_entire_operation() {
        let root = std::env::temp_dir().join(format!("engine-lease-{}", std::process::id()));
        let id = "00000000-0000-0000-0000-000000000004";
        let mut first = Supervisor::new(root.clone()).unwrap();
        let mut second = Supervisor::new(root).unwrap();
        let lease = first.acquire_profile_idle(id).unwrap();
        assert!(second.acquire_profile_idle(id).is_err());
        drop(lease);
        assert!(second.acquire_profile_idle(id).is_ok());
    }
    #[test]
    fn advanced_capabilities_fail_closed() {
        let mut registry = EngineRegistry::new();
        assert!(registry.get(EngineKind::Chromium).is_err());
        let mut supervisor = Supervisor::new(
            std::env::temp_dir().join(format!("material-engine-test-{}", std::process::id())),
        )
        .unwrap();
        let request = LaunchRequest {
            profile_id: "00000000-0000-0000-0000-000000000000".into(),
            engine: EngineKind::Chromium,
            requested_mode: AutomationMode::Puppeteer,
            require_stable_identity: false,
        };
        assert_eq!(
            supervisor.launch(&registry, request).unwrap_err().code,
            "ENGINE_UNAVAILABLE"
        );
        assert!(supervisor.snapshot("x").is_err());
        registry.engines.clear();
    }
}

#[cfg(windows)]
fn request_close(job: &process_job::ProcessJob, identity: &lifetime::ProcessIdentity) -> Result<()> {
    use std::ffi::c_void;
    #[link(name = "user32")]
    unsafe extern "system" {
        fn EnumWindows(
            callback: unsafe extern "system" fn(*mut c_void, isize) -> i32,
            param: isize,
        ) -> i32;
        fn GetWindowThreadProcessId(hwnd: *mut c_void, pid: *mut u32) -> u32;
        fn PostMessageW(hwnd: *mut c_void, msg: u32, wparam: usize, lparam: isize) -> i32;
    }
    struct Close<'a> {
        job: &'a process_job::ProcessJob,
        identity: &'a lifetime::ProcessIdentity,
        members: Vec<u32>,
        sent: bool,
        error: Option<EngineError>,
    }
    unsafe extern "system" fn visit(hwnd: *mut c_void, param: isize) -> i32 {
        let close = unsafe { &mut *(param as *mut Close<'_>) };
        let mut owner = 0;
        unsafe { GetWindowThreadProcessId(hwnd, &mut owner) };
        if close.members.contains(&owner) {
            match close.job.with_live_member(owner, &close.identity.executable, close.identity.start_time, || {
                let mut current = 0;
                unsafe { GetWindowThreadProcessId(hwnd, &mut current) };
                current == owner && unsafe { PostMessageW(hwnd, 0x0010, 0, 0) } != 0
            }) {
                Ok(sent) => close.sent |= sent,
                Err(error) => { close.error = Some(error); return 0; },
            }
        }
        1
    }
    let mut close = Close { job, identity, members: job.process_ids()?, sent: false, error: None };
    unsafe { EnumWindows(visit, &mut close as *mut Close<'_> as isize) };
    if let Some(error) = close.error { return Err(error); }
    if close.sent {
        Ok(())
    } else {
        Err(err(
            "GRACEFUL_STOP_UNAVAILABLE",
            "No closeable window belonging to the owned browser process",
        ))
    }
}
#[cfg(not(windows))]
fn request_close(_job: &process_job::ProcessJob, _identity: &lifetime::ProcessIdentity) -> Result<()> {
    Err(err(
        "GRACEFUL_STOP_UNAVAILABLE",
        "Native graceful shutdown is not implemented on this platform",
    ))
}
pub mod snapshot_protocol;

pub mod automation;
mod lifetime;
mod process_job;
pub use automation::{AdapterRuntime, AutomationEndpoint};
fn mode_key(mode: AutomationMode) -> u8 {
    match mode {
        AutomationMode::Off => 0,
        AutomationMode::Selenium => 1,
        AutomationMode::Puppeteer => 2,
    }
}
#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineAvailability {
    pub manifest: EngineManifest,
    pub configured_selenium: bool,
    pub configured_puppeteer: bool,
    pub runtime_verified: bool,
}
impl EngineRegistry {
    pub fn register_adapter(
        &mut self,
        kind: EngineKind,
        mode: AutomationMode,
        runtime: AdapterRuntime,
    ) -> Result<()> {
        if mode == AutomationMode::Off {
            return Err(err("INVALID_ADAPTER", "Off mode never has an adapter"));
        }
        runtime.verify(mode, &self.get(kind)?.manifest.version)?;
        self.adapters.insert((kind, mode_key(mode)), runtime);
        Ok(())
    }
    pub fn list(&self) -> Vec<EngineAvailability> {
        self.engines
            .iter()
            .map(|(kind, engine)| EngineAvailability {
                manifest: engine.manifest.clone(),
                configured_selenium: self.adapters.contains_key(&(*kind, 1)),
                configured_puppeteer: self.adapters.contains_key(&(*kind, 2)),
                runtime_verified: false,
            })
            .collect()
    }
}

fn off_arguments(kind: EngineKind, path: &Path) -> Vec<std::ffi::OsString> {
    match kind {
        EngineKind::Chromium => vec![
            format!("--user-data-dir={}", path.display()).into(),
            "--no-first-run".into(),
            "--no-default-browser-check".into(),
        ],
        EngineKind::Firefox => vec![
            "-no-remote".into(),
            "-profile".into(),
            path.as_os_str().to_owned(),
        ],
    }
}
#[cfg(test)]
mod integrity_tests {
    use super::*;
    #[test]
    fn off_mode_contains_only_profile_and_first_run_options() {
        let path = Path::new("owned-profile");
        for kind in [EngineKind::Chromium, EngineKind::Firefox] {
            let args = off_arguments(kind, path);
            assert_eq!(args.len(), 3);
            let text = args
                .iter()
                .map(|s| s.to_string_lossy())
                .collect::<Vec<_>>()
                .join(" ");
            for forbidden in ["debug", "driver", "automation", "marionette", "9222"] {
                assert!(!text.contains(forbidden));
            }
        }
    }
    #[test]
    fn manifest_rejects_tampered_and_escaping_executable() {
        let root = std::env::temp_dir().join(format!("material-manifest-{}", std::process::id()));
        fs::create_dir_all(&root).unwrap();
        let exe = root.join("engine.exe");
        fs::write(&exe, b"fixture executable bytes, never executed").unwrap();
        let manifest_path = root.join("manifest.json");
        let mut manifest = EngineManifest {
            schema_version: 1,
            engine: EngineKind::Chromium,
            version: "1.2.3.4".into(),
            executable: "engine.exe".into(),
            executable_sha256: format!("{:x}", Sha256::digest(fs::read(&exe).unwrap())),
            upstream_revision: "pinned-test-revision".into(),
            capabilities: Capabilities::default(),
        };
        fs::write(&manifest_path, serde_json::to_vec(&manifest).unwrap()).unwrap();
        let mut registry = EngineRegistry::new();
        registry.register(&root, &manifest_path).unwrap();
        assert_eq!(registry.list().len(), 1);
        fs::write(&exe, b"modified").unwrap();
        assert_eq!(
            registry.register(&root, &manifest_path).unwrap_err().code,
            "HASH_MISMATCH"
        );
        manifest.executable = "../engine.exe".into();
        fs::write(&manifest_path, serde_json::to_vec(&manifest).unwrap()).unwrap();
        assert_eq!(
            registry.register(&root, &manifest_path).unwrap_err().code,
            "INVALID_MANIFEST"
        );
    }
}

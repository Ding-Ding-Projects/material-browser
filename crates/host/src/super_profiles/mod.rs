//! Owned disposable guests and encrypted, scoped state saves.
mod archive;
mod base_image;
#[cfg(test)]
use archive::safe_member;
use archive::validate_archive;
mod desktop_connection;
mod linux_runtime;
mod payload;
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
}
pub struct Sessions {
    root: PathBuf,
    entries: BTreeMap<String, Session>,
    children: BTreeMap<String, Child>,
}
fn command(program: &str, args: &[&str], timeout: Duration) -> Result<String> {
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
    let reader = thread::spawn(move || {
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
        kept
    });
    let start = Instant::now();
    loop {
        if let Some(status) = child.try_wait().map_err(io_error)? {
            let output = reader
                .join()
                .map_err(|_| error("IO", "Command output reader failed"))?;
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
                    if !matches!(s.state.as_str(), "stopped" | "saved" | "discarded") {
                        s.state = "recovery-required".into();
                        s.message =
                            "Host restarted; stop and verify the owned guest before saving".into();
                    }
                    entries.insert(s.id.clone(), s);
                }
            }
        }
        Ok(Self {
            root,
            entries,
            children: BTreeMap::new(),
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
    pub fn capabilities() -> Value {
        let windows = cfg!(windows);
        let wsl = windows && run(&["--status"], Duration::from_secs(10)).is_ok();
        let sandbox = windows && sandbox::available();
        json!({"wsl2":{"available":wsl,"requiresRootfs":false,"requiresRootfsSha256":false,"rootfsOverrideRequiresSha256":true,"modes":["terminal","browser","desktop"],"runtimeVerified":false,"reason":"Requires an approved root filesystem with useradd, tar and selected guest programs; WSLg is required for graphical modes"},"windowsSandbox":{"available":sandbox,"modes":["browser"],"runtimeVerified":false,"reason":"Requires Windows Sandbox already enabled; host settings are never changed"},"stableIdentity":false,"supportedConfiguration":["backend","rootfsPath","rootfsSha256","launchMode"],"saveCategories":["browser","workspace"]})
    }
    pub fn launch(
        &mut self,
        core: &mut material_browser_core::Manager,
        p: &Value,
        browser_executable: Option<&Path>,
    ) -> Result<Value> {
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
        };
        self.persist(&s)?;
        self.entries.insert(id.clone(), s.clone());
        let result = (|| {
            payload::stage(settings, &s.directory)?;
            let archive = s.directory.join("state.tar");
            if let Err(e) = core.export_super_profile_state(profile_id, &archive) {
                if e.code != "NOT_FOUND" {
                    return Err(error(&e.code, &e.message));
                }
            }
            if backend == "windows-sandbox" {
                let child = sandbox::launch(
                    &s,
                    &archive,
                    browser_executable,
                    settings["networking"].as_bool().unwrap_or(true),
                )?;
                self.children.insert(id.clone(), child);
                s.state = "starting".into();
                s.message = "Sandbox launcher started; waiting for guest readiness receipt".into();
                return Ok(());
            }
            if backend != "wsl2" {
                return Err(error("BACKEND_UNAVAILABLE", "Unknown guest backend"));
            }
            let rootfs = base_image::resolve(settings, &self.root.join("base-cache"))?;
            let install = s.directory.join("distribution");
            run(
                &[
                    "--import",
                    &s.distribution,
                    unicode(&install)?,
                    unicode(&rootfs)?,
                    "--version",
                    "2",
                ],
                Duration::from_secs(300),
            )?;
            // Host filesystem mounting and executable interop are disabled before guest user programs run.
            run(
                &[
                    "-d",
                    &s.distribution,
                    "-u",
                    "root",
                    "--exec",
                    "sh",
                    "-lc",
                    "printf '[automount]\nenabled=false\n[interop]\nenabled=false\nappendWindowsPath=false\n' > /etc/wsl.conf",
                ],
                Duration::from_secs(20),
            )?;
            run(&["--terminate", &s.distribution], Duration::from_secs(30))?;
            run(
                &[
                    "-d",
                    &s.distribution,
                    "-u",
                    "root",
                    "--exec",
                    "sh",
                    "-lc",
                    "set -eu; test ! -d /mnt/c/Windows; id -u materialbrowser >/dev/null 2>&1 || useradd -m -s /bin/sh materialbrowser; test \"$(id -u materialbrowser)\" != 0; mkdir -p /home/materialbrowser/.material-browser/browser /home/materialbrowser/.material-browser/workspace; chown -R materialbrowser /home/materialbrowser/.material-browser; chmod 700 /home/materialbrowser/.material-browser",
                ],
                Duration::from_secs(30),
            )?;
            linux_runtime::provision(
                &s.distribution,
                engine,
                mode,
                &self.root.join("runtime-cache"),
            )?;
            let staged = s.directory.join("input.tar");
            command(
                "tar.exe",
                &[
                    "-cf",
                    unicode(&staged)?,
                    "-C",
                    unicode(&s.directory.join("input"))?,
                    ".",
                ],
                Duration::from_secs(120),
            )?;
            run(
                &[
                    "-d",
                    &s.distribution,
                    "-u",
                    USER,
                    "--exec",
                    "mkdir",
                    "-p",
                    "/home/materialbrowser/.material-browser/input",
                ],
                Duration::from_secs(20),
            )?;
            let child = Command::new("wsl.exe")
                .args([
                    "-d",
                    &s.distribution,
                    "-u",
                    USER,
                    "--exec",
                    "tar",
                    "-xf",
                    "-",
                    "-C",
                    "/home/materialbrowser/.material-browser/input",
                    "--no-same-owner",
                    "--no-same-permissions",
                ])
                .stdin(Stdio::from(fs::File::open(&staged).map_err(io_error)?))
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(io_error)?;
            wait_owned(child, Duration::from_secs(300))?;
            run(
                &[
                    "-d",
                    &s.distribution,
                    "-u",
                    USER,
                    "--exec",
                    "sh",
                    "-lc",
                    "set -eu; cp -R /home/materialbrowser/.material-browser/input/state/workspace/. /home/materialbrowser/.material-browser/workspace/; cd /home/materialbrowser/.material-browser/workspace; sh /home/materialbrowser/.material-browser/input/setup.sh",
                ],
                Duration::from_secs(300),
            )?;
            if fs::read_dir(s.directory.join("input/installers"))
                .map_err(io_error)?
                .next()
                .is_some()
            {
                return Err(error(
                    "INSTALLER_UNSUPPORTED",
                    "WSL installer execution requires explicit supported package commands in setup; selected installer files remain staged",
                ));
            }
            if archive.is_file() {
                validate_archive(&archive)?;
                let child = Command::new("wsl.exe")
                    .args([
                        "-d",
                        &s.distribution,
                        "-u",
                        USER,
                        "--exec",
                        "tar",
                        "-xf",
                        "-",
                        "-C",
                        "/home/materialbrowser/.material-browser",
                        "--no-same-owner",
                        "--no-same-permissions",
                    ])
                    .stdin(Stdio::from(fs::File::open(&archive).map_err(io_error)?))
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
                    .map_err(io_error)?;
                wait_owned(child, Duration::from_secs(300))?;
            }
            let check = match mode {
                "browser" if engine == "firefox" => {
                    "test -n \"$DISPLAY$WAYLAND_DISPLAY\" && command -v firefox"
                }
                "browser" => "test -n \"$DISPLAY$WAYLAND_DISPLAY\" && command -v chromium",
                "desktop" => "command -v startxfce4 && command -v xrdp",
                _ => "command -v sh",
            };
            run(
                &[
                    "-d",
                    &s.distribution,
                    "-u",
                    USER,
                    "--exec",
                    "sh",
                    "-lc",
                    "set -eu; cd /home/materialbrowser/.material-browser/workspace; sh /home/materialbrowser/.material-browser/input/startup.sh",
                ],
                Duration::from_secs(300),
            )?;
            run(
                &[
                    "-d",
                    &s.distribution,
                    "-u",
                    USER,
                    "--exec",
                    "sh",
                    "-lc",
                    check,
                ],
                Duration::from_secs(20),
            )?;
            if mode == "terminal" {
                let child = Command::new("wt.exe")
                    .args([
                        "new-window",
                        "--title",
                        "Material Browser disposable terminal",
                        "wsl.exe",
                        "-d",
                        &s.distribution,
                        "-u",
                        USER,
                        "--exec",
                        "sh",
                    ])
                    .stdin(Stdio::null())
                    .stdout(Stdio::null())
                    .stderr(Stdio::null())
                    .spawn()
                    .map_err(|_| {
                        error(
                            "TERMINAL_UNAVAILABLE",
                            "Windows Terminal is required for interactive terminal launch",
                        )
                    })?;
                self.children.insert(id.clone(), child);
                s.state = "launched".into();
                s.message =
                    "Terminal launcher started; interactive window readiness remains unverified"
                        .into();
            } else if mode == "desktop" {
                let child = desktop_connection::launch(&s)?;
                self.children.insert(id.clone(), child);
                s.state = "launched".into();
                s.message = "Loopback desktop connection launched; full desktop readiness awaits guest session confirmation".into();
            } else {
                let script = if mode == "browser" && engine == "firefox" {
                    "nohup firefox --no-remote --profile /home/materialbrowser/.material-browser/browser about:blank >/home/materialbrowser/.material-browser/launch.log 2>&1 </dev/null &"
                } else if mode == "browser" {
                    "nohup chromium --user-data-dir=/home/materialbrowser/.material-browser/browser about:blank >/home/materialbrowser/.material-browser/launch.log 2>&1 </dev/null &"
                } else {
                    "nohup startxfce4 >/home/materialbrowser/.material-browser/launch.log 2>&1 </dev/null &"
                };
                run(
                    &[
                        "-d",
                        &s.distribution,
                        "-u",
                        USER,
                        "--exec",
                        "sh",
                        "-lc",
                        script,
                    ],
                    Duration::from_secs(20),
                )?;
                let probe = if mode == "browser" && engine == "firefox" {
                    "sleep 2; pgrep -f '[f]irefox.*material-browser' >/dev/null"
                } else if mode == "browser" {
                    "sleep 2; pgrep -f '[c]hromium.*material-browser' >/dev/null"
                } else {
                    "sleep 2; pgrep -x xfce4-session >/dev/null"
                };
                run(
                    &[
                        "-d",
                        &s.distribution,
                        "-u",
                        USER,
                        "--exec",
                        "sh",
                        "-lc",
                        probe,
                    ],
                    Duration::from_secs(15),
                )?;
                s.state = "running".into();
                s.message =
                    "Guest process readiness verified; visual readiness remains unverified".into();
            }
            Ok(())
        })();
        if let Err(e) = result {
            s.state = "recovery-required".into();
            s.message = e.message.clone();
            self.persist(&s)?;
            self.entries.insert(id, s);
            return Err(e);
        }
        self.persist(&s)?;
        self.entries.insert(id, s.clone());
        Ok(json!(s))
    }
    pub fn status(&mut self) -> Value {
        for s in self.entries.values_mut() {
            if s.backend == "windows-sandbox" && s.directory.join("exchange/failed").is_file() {
                s.state = "recovery-required".into();
                s.message =
                    "Sandbox guest bootstrap or graceful stop failed; staging retained".into();
            }
            if s.backend == "windows-sandbox"
                && s.state == "starting"
                && s.directory.join("exchange/ready").is_file()
            {
                s.state = "running".into();
                s.message="Sandbox guest reported browser process readiness; visual readiness remains unverified".into();
            }
        }
        json!(self.entries.values().collect::<Vec<_>>())
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
        let mut s = self
            .entries
            .get(id)
            .cloned()
            .ok_or_else(|| error("SESSION_NOT_FOUND", "Session not found"))?;
        if !matches!(s.state.as_str(), "stopped" | "saved" | "discarded") {
            if s.backend == "windows-sandbox" {
                sandbox::stop(&s, self.children.get_mut(id))?;
            } else {
                verify_registration(&s)?;
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
    pub fn save(&mut self, core: &mut material_browser_core::Manager, p: &Value) -> Result<Value> {
        let categories = selected_categories(p)?;
        let id = text(p, "sessionId")?;
        let mut s = self
            .entries
            .get(id)
            .cloned()
            .ok_or_else(|| error("SESSION_NOT_FOUND", "Session not found"))?;
        if s.state != "stopped" {
            return Err(error(
                "SESSION_NOT_STOPPED",
                "Stop the guest before saving a revision",
            ));
        }
        if text(p, "expectedRevisionId")? != s.revision_id {
            return Err(error(
                "REVISION_CONFLICT",
                "Save must target the exact template revision used to launch this guest",
            ));
        }
        let archive = s
            .directory
            .join(format!("export-{}.tar", crate::random_hex()));
        if s.backend == "windows-sandbox" {
            sandbox::archive(&s, &archive, &categories)?;
        } else {
            verify_registration(&s)?;
            let output = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&archive)
                .map_err(io_error)?;
            let mut arguments = vec![
                "-d",
                &s.distribution,
                "-u",
                USER,
                "--exec",
                "tar",
                "-cf",
                "-",
                "-C",
                "/home/materialbrowser/.material-browser",
            ];
            arguments.extend(categories.iter().copied());
            let child = Command::new("wsl.exe")
                .args(arguments)
                .stdin(Stdio::null())
                .stdout(Stdio::from(output))
                .stderr(Stdio::null())
                .spawn()
                .map_err(io_error)?;
            let result = wait_owned(child, Duration::from_secs(300));
            let terminated = run(&["--terminate", &s.distribution], Duration::from_secs(30));
            result?;
            terminated?;
        }
        validate_archive(&archive)?;
        let revision = core
            .import_super_profile_state(&s.profile_id, text(p, "expectedRevisionId")?, &archive)
            .map_err(|e| error(&e.code, &e.message))?;
        s.state = "saved".into();
        s.message="Managed browser and workspace state encrypted into an immutable revision; staging retained".into();
        self.persist(&s)?;
        self.entries.insert(id.into(), s);
        Ok(revision)
    }
    pub fn discard(&mut self, id: &str) -> Result<Value> {
        let mut s = self
            .entries
            .get(id)
            .cloned()
            .ok_or_else(|| error("SESSION_NOT_FOUND", "Session not found"))?;
        if !matches!(s.state.as_str(), "stopped" | "saved") {
            return Err(error(
                "SESSION_NOT_STOPPED",
                "Stop the guest before discarding",
            ));
        }
        if s.backend == "wsl2" {
            verify_registration(&s)?;
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
        s.state = "discarded".into();
        s.message =
            "Owned disposable guest discarded; template revisions and recovery staging retained"
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
fn wait_owned(mut child: Child, timeout: Duration) -> Result<()> {
    let start = Instant::now();
    loop {
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
    let script = format!(
        "$ErrorActionPreference='Stop'; $d=@(Get-ChildItem 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Lxss' | Get-ItemProperty | Where-Object {{ $_.DistributionName -eq '{}' }}); if ($d.Count -ne 1) {{ exit 2 }}; [Console]::Write($d[0].BasePath)",
        s.distribution
    );
    let actual = command(
        "powershell.exe",
        &["-NoProfile", "-NonInteractive", "-Command", &script],
        Duration::from_secs(15),
    )?;
    let actual = fs::canonicalize(actual.trim()).map_err(io_error)?;
    let expected = fs::canonicalize(s.directory.join("distribution")).map_err(io_error)?;
    if actual != expected {
        return Err(error(
            "OWNERSHIP_MISMATCH",
            "WSL registration path does not match the owned staging directory",
        ));
    }
    Ok(())
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
fn valid_id(s: &str) -> bool {
    s.len() == 32 && s.bytes().all(|b| b.is_ascii_hexdigit())
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
    use super::*;
    #[test]
    fn ownership_ids_are_strict() {
        assert!(valid_id("0123456789abcdef0123456789abcdef"));
        assert!(!valid_id("../real-distribution"));
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
    fn retained_sessions_block_template_and_vault_mutations() {
        let s = Session {
            id: "0123456789abcdef0123456789abcdef".into(),
            profile_id: "profile-a".into(),
            revision_id: "revision-a".into(),
            distribution: "MaterialBrowser-0123456789abcdef0123456789abcdef".into(),
            mode: "browser".into(),
            backend: "wsl2".into(),
            state: "saved".into(),
            directory: PathBuf::from("unused"),
            message: String::new(),
        };
        let mut sessions = Sessions {
            root: PathBuf::from("unused"),
            entries: BTreeMap::from([(s.id.clone(), s)]),
            children: BTreeMap::new(),
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

//! Background guest provisioning, independent of the unlocked vault manager.
use super::*;
impl Sessions {
    pub(super) fn provision(
        &mut self,
        settings: &Value,
        mut s: Session,
        archive: PathBuf,
        engine: &str,
        browser_executable: Option<&Path>,
    ) -> Result<Value> {
        let id = s.id.clone();
        let backend = s.backend.clone();
        let mode_owned = s.mode.clone();
        let mode = mode_owned.as_str();
        let result = (|| {
            self.progress(
                &mut s,
                "staging-inputs",
                "Copying selected inputs into owned staging",
            )?;
            payload::stage(settings, &s.directory)?;
            let has_installers = if backend == "wsl2" {
                guest_installers::prepare(&s.directory)?
            } else {
                false
            };
            if backend == "windows-sandbox" {
                self.progress(
                    &mut s,
                    "launching-sandbox",
                    "Preparing read-only mappings and launching the owned Sandbox",
                )?;
                let child = sandbox::launch(
                    &s,
                    &archive,
                    browser_executable,
                    settings["networking"].as_bool().unwrap_or(true),
                )?;
                self.children.insert(id.clone(), child);
                s.guest_created = true;
                self.persist(&s)?;
                s.state = "starting".into();
                s.message = "Sandbox launcher started; waiting for guest readiness receipt".into();
                return Ok(());
            }
            if backend != "wsl2" {
                return Err(error("BACKEND_UNAVAILABLE", "Unknown guest backend"));
            }
            self.progress(
                &mut s,
                "acquiring-base",
                "Resolving and verifying the pinned guest base image",
            )?;
            let rootfs = base_image::resolve(settings, &self.root.join("base-cache"))?;
            let install = s.directory.join("distribution");
            self.progress(
                &mut s,
                "importing-guest",
                "Importing the uniquely owned WSL2 distribution",
            )?;
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
            verify_registration(&s)?;
            s.guest_created = true;
            self.persist(&s)?;
            self.progress(
                &mut s,
                "configuring-isolation",
                "Disabling automatic host mounts and executable interop",
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
            self.progress(
                &mut s,
                "installing-runtime",
                "Installing and verifying guest browser and runtime packages",
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
            if has_installers {
                self.progress(
                    &mut s,
                    "installing-selected-inputs",
                    "Verifying and executing selected Linux installers inside the disposable guest",
                )?;
                guest_installers::install(&s.distribution)?;
            }
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
            self.progress(
                &mut s,
                "restoring-state",
                "Restoring managed browser and workspace data",
            )?;
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
            self.progress(
                &mut s,
                "starting-workspace",
                "Starting the selected guest workspace",
            )?;
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
            asynchronous::event(
                &mut s,
                if e.code == "OPERATION_CANCELLED" {
                    "cancelled"
                } else {
                    "failed"
                },
                &e.message,
            );
            self.persist(&s)?;
            self.entries.insert(id, s);
            return Err(e);
        }
        let message = s.message.clone();
        asynchronous::event(&mut s, "launch-complete", &message);
        self.persist(&s)?;
        self.entries.insert(id, s.clone());
        Ok(json!(s))
    }
}

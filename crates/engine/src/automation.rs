use super::*;
use std::io::{BufRead, BufReader, Write};
#[derive(Clone, Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct AdapterRuntime {
    pub node: PathBuf,
    pub node_sha256: String,
    pub helper: PathBuf,
    pub helper_sha256: String,
    pub driver: Option<PathBuf>,
    pub driver_sha256: Option<String>,
    pub driver_version: Option<String>,
    pub browser_version: String,
}
impl AdapterRuntime {
    pub(super) fn verify(&self, mode: AutomationMode, browser_version: &str) -> Result<()> {
        if self.browser_version != browser_version {
            return Err(err(
                "ADAPTER_VERSION_MISMATCH",
                "Adapter must pin this exact browser version",
            ));
        }
        verify_hash(&self.node, &self.node_sha256)?;
        verify_hash(&self.helper, &self.helper_sha256)?;
        if mode == AutomationMode::Selenium {
            let driver = self
                .driver
                .as_ref()
                .ok_or_else(|| err("DRIVER_UNAVAILABLE", "Pinned driver is required"))?;
            verify_hash(
                driver,
                self.driver_sha256
                    .as_deref()
                    .ok_or_else(|| err("INVALID_HASH", "Pinned driver hash is required"))?,
            )?;
            let expected = self
                .driver_version
                .as_deref()
                .filter(|v| !v.is_empty())
                .ok_or_else(|| err("DRIVER_UNAVAILABLE", "Exact driver version is required"))?;
            let mut probe = Command::new(driver)
                .arg("--version")
                .stdin(Stdio::null())
                .stdout(Stdio::piped())
                .stderr(Stdio::null())
                .spawn()
                .map_err(io)?;
            let until = Instant::now() + Duration::from_secs(5);
            loop {
                if probe.try_wait().map_err(io)?.is_some() {
                    break;
                }
                if Instant::now() >= until {
                    let _ = probe.kill();
                    let _ = probe.wait();
                    return Err(err(
                        "DRIVER_VERSION_TIMEOUT",
                        "Driver version probe timed out",
                    ));
                }
                std::thread::sleep(Duration::from_millis(25));
            }
            let output = probe.wait_with_output().map_err(io)?;
            if !output.status.success()
                || !String::from_utf8_lossy(&output.stdout)
                    .split_whitespace()
                    .any(|s| s == expected)
            {
                return Err(err(
                    "DRIVER_VERSION_MISMATCH",
                    "Driver does not match its version pin",
                ));
            }
        }
        Ok(())
    }
    pub(super) fn spawn(
        &self,
        engine: &VerifiedEngine,
        profile: &Path,
        mode: AutomationMode,
    ) -> Result<(Child, u32)> {
        self.verify(mode, &engine.manifest.version)?;
        let mut command = Command::new(&self.node);
        command
            .arg(&self.helper)
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::null());
        let mut child = command.spawn().map_err(io)?;
        let config = serde_json::json!({"engine":engine.manifest.engine,"mode":mode,"executable":engine.executable,"profile":profile,"version":engine.manifest.version,"driver":self.driver,"driverSha256":self.driver_sha256});
        let mut wire = serde_json::to_vec(&config)
            .map_err(|_| err("INVALID_ADAPTER", "Invalid adapter configuration"))?;
        wire.push(b'\n');
        if child
            .stdin
            .as_mut()
            .ok_or_else(|| err("ADAPTER_IO", "Adapter stdin missing"))?
            .write_all(&wire)
            .is_err()
        {
            let _ = child.kill();
            let _ = child.wait();
            return Err(err("ADAPTER_IO", "Could not configure adapter"));
        }
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| err("ADAPTER_IO", "Adapter stdout missing"))?;
        let (tx, rx) = std::sync::mpsc::channel();
        std::thread::spawn(move || {
            let mut line = String::new();
            let result = BufReader::new(stdout)
                .take(65537)
                .read_line(&mut line)
                .map(|_| line);
            let _ = tx.send(result);
        });
        let reply = rx.recv_timeout(Duration::from_secs(30));
        let accepted = (|| {
            let line = reply.ok()?.ok()?;
            if line.len() > 65536 {
                return None;
            }
            let value: serde_json::Value = serde_json::from_str(&line).ok()?;
            if value["version"] != engine.manifest.version
                || value["mode"] != serde_json::to_value(mode).ok()?
                || value["engine"] != serde_json::to_value(engine.manifest.engine).ok()?
            {
                return None;
            }
            let pid = u32::try_from(value["pid"].as_u64()?).ok()?;
            if pid == 0 {
                return None;
            }
            Some(pid)
        })();
        match accepted {
            Some(pid) => Ok((child, pid)),
            None => {
                drop(child.stdin.take());
                let until = Instant::now() + Duration::from_secs(3);
                while Instant::now() < until {
                    if child.try_wait().map_err(io)?.is_some() {
                        break;
                    }
                    std::thread::sleep(Duration::from_millis(25));
                }
                if child.try_wait().map_err(io)?.is_none() {
                    let _ = child.kill();
                    let _ = child.wait();
                }
                Err(err(
                    "ADAPTER_START_FAILED",
                    "Adapter did not provide an exact verified engine receipt",
                ))
            }
        }
    }
}

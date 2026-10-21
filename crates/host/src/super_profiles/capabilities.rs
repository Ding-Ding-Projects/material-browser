//! Host capability detection never starts an existing user distribution or changes features.
use super::*;
pub(super) fn detect() -> Value {
    let windows = cfg!(windows);
    let wsl = windows && run(&["--status"], Duration::from_secs(10)).is_ok();
    let version = if wsl {
        run(&["--version"], Duration::from_secs(10)).unwrap_or_default()
    } else {
        String::new()
    };
    let wslg = version
        .lines()
        .any(|line| line.contains("WSLg") && line.chars().any(|c| matches!(c, '1'..='9')));
    let terminal = windows && command("where.exe", &["wt.exe"], Duration::from_secs(3)).is_ok();
    let rdp = windows
        && std::env::var_os("WINDIR")
            .is_some_and(|p| PathBuf::from(p).join("System32/mstsc.exe").is_file());
    let sandbox=windows&&sandbox::available()&&command("powershell.exe",&["-NoProfile","-NonInteractive","-Command","$ErrorActionPreference='Stop'; $f=Get-CimInstance Win32_OptionalFeature -Filter \"Name='Containers-DisposableClientVM'\"; if ($f.InstallState -ne 1) { exit 2 }"],Duration::from_secs(15)).is_ok();
    let mut modes = Vec::new();
    if wsl && terminal {
        modes.push("terminal");
    }
    if wsl && wslg {
        modes.push("browser");
    }
    if wsl && rdp {
        modes.push("desktop");
    }
    json!({"wsl2":{"available":wsl,"wslCliAvailable":wsl,"wslgAvailable":wslg,"terminalClientAvailable":terminal,"rdpClientAvailable":rdp,"requiresGuestProvisioning":true,"requiresRootfs":false,"requiresRootfsSha256":false,"rootfsOverrideRequiresSha256":true,"modes":modes,"runtimeVerified":false,"reason":if wsl{"Host WSL detected. Browser mode requires WSLg, terminal mode requires Windows Terminal, and desktop mode requires the Remote Desktop client. Selected guest browser and desktop packages are verified during provisioning."}else{"WSL is unavailable or its status could not be verified. This application does not enable host features."}},"windowsSandbox":{"available":sandbox,"featureEnabled":sandbox,"requiresManagedBrowser":true,"modes":if sandbox{vec!["browser"]}else{Vec::<&str>::new()},"runtimeVerified":false,"reason":if sandbox{"Sandbox feature detected. Launch also requires a verified managed Chromium bundle; guest readiness is checked separately."}else{"Windows Sandbox is missing, disabled, or its feature state could not be verified. Host features are never enabled automatically."}},"stableIdentity":false,"supportedConfiguration":["backend","rootfsPath","rootfsSha256","launchMode","workspacePath","installers","setupCommands","startupCommands"],"saveCategories":["browser","workspace"]})
}

pub(super) fn require_mode(capabilities: &Value, backend: &str, mode: &str) -> Result<()> {
    let key = match backend {
        "wsl2" => "wsl2",
        "windows-sandbox" => "windowsSandbox",
        _ => return Err(error("BACKEND_UNAVAILABLE", "Unknown guest backend")),
    };
    let backend = capabilities
        .get(key)
        .ok_or_else(|| error("BACKEND_UNAVAILABLE", "Unknown guest backend"))?;
    if backend["available"] != true {
        return Err(error(
            "BACKEND_UNAVAILABLE",
            backend["reason"]
                .as_str()
                .unwrap_or("The selected backend is unavailable"),
        ));
    }
    if !backend["modes"]
        .as_array()
        .is_some_and(|modes| modes.iter().any(|item| item.as_str() == Some(mode)))
    {
        return Err(error(
            "MODE_UNAVAILABLE",
            "The selected mode requires host components that were not detected; no guest was created",
        ));
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn unavailable_modes_and_unknown_backends_fail_closed() {
        let caps = json!({"wsl2":{"available":true,"modes":["terminal"]},"windowsSandbox":{"available":false,"modes":[]}});
        assert!(require_mode(&caps, "wsl2", "terminal").is_ok());
        assert_eq!(
            require_mode(&caps, "wsl2", "desktop").unwrap_err().code,
            "MODE_UNAVAILABLE"
        );
        assert_eq!(
            require_mode(&caps, "windows-sandbox", "browser")
                .unwrap_err()
                .code,
            "BACKEND_UNAVAILABLE"
        );
        let enabled = json!({"windowsSandbox":{"available":true,"modes":["browser"]}});
        assert!(require_mode(&enabled, "windows-sandbox", "browser").is_ok());
        assert_eq!(
            require_mode(&enabled, "windows-sandbox", "terminal")
                .unwrap_err()
                .code,
            "MODE_UNAVAILABLE"
        );
        assert!(require_mode(&enabled, "windowsSandbox", "browser").is_err());
        assert!(require_mode(&caps, "unknown", "terminal").is_err());
    }
}

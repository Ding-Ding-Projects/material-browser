//! Provisions owned Linux guests from signed packages and verified browser archives.
use super::*;
const FIREFOX_URL: &str = "https://archive.mozilla.org/pub/firefox/releases/158.0/linux-x86_64/en-US/firefox-158.0.tar.xz";
const FIREFOX_SHA: &str = "9549b054ec4cf85f50f6a19d8c6fb79580312e71ebc4ec2cb217ec9af09dc12a";
const CHROMIUM_URL: &str =
    "https://storage.googleapis.com/chromium-browser-snapshots/Linux_x64/1721569/chrome-linux.zip";
// Filled only from independently verified bytes, never inferred from a URL.
const CHROMIUM_SHA: &str = "f04116c167e8f31ca7a2cf624a600469570bb587a8dc32ebce44c52bd434cb23";
fn packages(desktop: bool) -> &'static str {
    if desktop {
        "libnss3 libatk-bridge2.0-0 libx11-xcb1 libgbm1 libgtk-3-0 libasound2t64 unzip xz-utils procps xfce4 dbus-x11 xrdp xorgxrdp"
    } else {
        "libnss3 libatk-bridge2.0-0 libx11-xcb1 libgbm1 libgtk-3-0 libasound2t64 unzip xz-utils procps"
    }
}
fn acquire(cache: &Path, engine: &str) -> Result<PathBuf> {
    let (name, url, digest) = match engine {
        "firefox" => (
            "firefox-158.0-linux-x86_64.tar.xz",
            FIREFOX_URL,
            FIREFOX_SHA,
        ),
        "chromium" => ("chromium-linux-1721569.zip", CHROMIUM_URL, CHROMIUM_SHA),
        _ => return Err(error("INVALID_ENGINE", "Unsupported guest browser engine")),
    };
    if digest.len() != 64 || !digest.bytes().all(|b| b.is_ascii_hexdigit()) {
        return Err(error(
            "BROWSER_UNVERIFIED",
            "Browser archive digest is not yet verified",
        ));
    }
    fs::create_dir_all(cache).map_err(io_error)?;
    crate::private(cache)?;
    let path = cache.join(name);
    if path.exists() {
        verify_hash(&path, digest)?;
        return Ok(path);
    }
    let partial = cache.join(format!("browser-{}.partial", crate::random_hex()));
    let script = cache.join(format!("download-browser-{}.ps1", crate::random_hex()));
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&script)
        .map_err(io_error)?;
    use std::io::Write;
    file.write_all(format!("param([string]$Destination)\n$ErrorActionPreference = 'Stop'\n$ProgressPreference='SilentlyContinue'\n[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12\n$curl=Join-Path $env:SystemRoot 'System32\\curl.exe'\nif (Test-Path -LiteralPath $curl) {{ & $curl --fail --silent --show-error --location --max-redirs 3 --proto-redir '=https' --proto '=https' --tlsv1.2 --max-time 600 --output $Destination '{url}'; if ($LASTEXITCODE -ne 0) {{ throw 'Browser download failed' }} }} else {{ Invoke-WebRequest -UseBasicParsing -Uri '{url}' -OutFile $Destination -TimeoutSec 600 }}\n").as_bytes()).map_err(io_error)?;
    drop(file);
    let result = command(
        "powershell.exe",
        &[
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-File",
            unicode(&script)?,
            unicode(&partial)?,
        ],
        Duration::from_secs(620),
    )
    .and_then(|_| verify_hash(&partial, digest));
    let _ = fs::remove_file(script);
    if let Err(e) = result {
        let _ = fs::remove_file(partial);
        return Err(e);
    }
    fs::rename(&partial, &path).map_err(io_error)?;
    Ok(path)
}
fn apt_script(mode: &str) -> String {
    // A guest-local temporary service policy prevents package post-install scripts
    // from exposing listeners before the owning host configures their lifecycle.
    format!(
        r#"set -eu
export DEBIAN_FRONTEND=noninteractive
policy=/usr/sbin/policy-rc.d
backup=$(mktemp /tmp/material-service-policy.XXXXXX)
existed=0
if [ -e "$policy" ]; then cp -p "$policy" "$backup"; existed=1; fi
restore_policy() {{ if [ "$existed" = 1 ]; then cp -p "$backup" "$policy"; else rm -f "$policy"; fi; rm -f "$backup"; }}
trap restore_policy EXIT HUP INT TERM
printf '#!/bin/sh\nexit 101\n' > "$policy"
chmod 755 "$policy"
apt-get -o Acquire::AllowInsecureRepositories=false -o APT::Get::AllowUnauthenticated=false update
apt-get -o Acquire::AllowInsecureRepositories=false -o APT::Get::AllowUnauthenticated=false install -y --no-install-recommends {}
mkdir -p /opt/material-browser /usr/local/bin
"#,
        packages(mode == "desktop")
    )
}
/// Only the already-owned guest is mutated. No host packages or listeners are changed.
pub(super) fn provision(distribution: &str, engine: &str, mode: &str, cache: &Path) -> Result<()> {
    if !["terminal", "browser", "desktop"].contains(&mode) {
        return Err(error("INVALID_MODE", "Unsupported guest mode"));
    }
    if mode == "terminal" {
        return Ok(());
    }
    if !["chromium", "firefox"].contains(&engine) {
        return Err(error("INVALID_ENGINE", "Unsupported guest browser engine"));
    }
    let archive = acquire(cache, engine)?;
    run(
        &[
            "-d",
            distribution,
            "-u",
            "root",
            "--exec",
            "sh",
            "-lc",
            &apt_script(mode),
        ],
        Duration::from_secs(900),
    )?;
    let unpack = match engine {
        "firefox" => {
            r#"set -eu; archive=$(mktemp /tmp/material-firefox.XXXXXX.tar.xz); trap 'rm -f "$archive"' EXIT HUP INT TERM; cat > "$archive"; tar -xJf "$archive" -C /opt/material-browser; ln -sfn /opt/material-browser/firefox/firefox /usr/local/bin/firefox"#
        }
        _ => {
            r#"set -eu; archive=$(mktemp /tmp/material-chromium.XXXXXX.zip); trap 'rm -f "$archive"' EXIT HUP INT TERM; cat > "$archive"; unzip -oq "$archive" -d /opt/material-browser; ln -sfn /opt/material-browser/chrome-linux/chrome /usr/local/bin/chromium"#
        }
    };
    let input = fs::File::open(&archive).map_err(io_error)?;
    let child = Command::new("wsl.exe")
        .args([
            "-d",
            distribution,
            "-u",
            "root",
            "--exec",
            "sh",
            "-lc",
            unpack,
        ])
        .stdin(Stdio::from(input))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(io_error)?;
    wait_owned(child, Duration::from_secs(300))?;
    let executable = if engine == "firefox" {
        "firefox"
    } else {
        "chromium"
    };
    run(
        &[
            "-d",
            distribution,
            "-u",
            USER,
            "--exec",
            executable,
            "--version",
        ],
        Duration::from_secs(30),
    )?;
    if mode == "desktop" {
        run(
            &[
                "-d",
                distribution,
                "-u",
                "root",
                "--exec",
                "sh",
                "-lc",
                "set -eu; test -f /etc/xrdp/xrdp.ini; sed -i 's|^port=3389$|port=tcp://127.0.0.1:3389|' /etc/xrdp/xrdp.ini; grep -Fx 'port=tcp://127.0.0.1:3389' /etc/xrdp/xrdp.ini >/dev/null; test -x /usr/bin/startxfce4; test -x /usr/sbin/xrdp",
            ],
            Duration::from_secs(30),
        )?;
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn pinned_sources_and_package_scripts_are_bounded() {
        assert_eq!(FIREFOX_SHA.len(), 64);
        assert!(FIREFOX_SHA.bytes().all(|b| b.is_ascii_hexdigit()));
        assert!(FIREFOX_URL.starts_with("https://archive.mozilla.org/"));
        let script = apt_script("desktop");
        assert!(script.contains("AllowUnauthenticated=false"));
        assert!(script.contains("exit 101"));
        assert!(script.contains("xfce4 dbus-x11 xrdp xorgxrdp"));
        assert!(!apt_script("browser").contains("xrdp"));
    }
    #[test]
    fn invalid_mode_and_engine_do_not_launch_processes() {
        assert_eq!(
            provision("unused", "chromium", "invalid", Path::new("unused"))
                .unwrap_err()
                .code,
            "INVALID_MODE"
        );
        assert_eq!(
            provision("unused", "invalid", "browser", Path::new("unused"))
                .unwrap_err()
                .code,
            "INVALID_ENGINE"
        );
    }
}

//! Versioned Ubuntu WSL base acquisition with a fixed vendor digest.
use super::*;
const URL: &str = "https://releases.ubuntu.com/24.04.5/ubuntu-24.04.5-wsl-amd64.wsl";
const SHA256: &str = "bb415d824822c4b878125729af451a5d18fb13d1cf5cbed9a7393ad64ac6039e";

pub(super) fn resolve(settings: &Value, cache: &Path) -> Result<PathBuf> {
    if settings.get("rootfsPath").and_then(Value::as_str).is_some_and(|s| !s.is_empty()) {
        let path = PathBuf::from(text(settings, "rootfsPath")?);
        if !path.is_absolute() || !path.is_file() {
            return Err(error("INVALID_ROOTFS", "Choose an existing absolute root filesystem archive"));
        }
        verify_hash(&path, text(settings, "rootfsSha256")?)?;
        return Ok(path);
    }
    fs::create_dir_all(cache).map_err(io_error)?;
    crate::private(cache)?;
    let path = cache.join("ubuntu-24.04.5-wsl-amd64.wsl");
    if path.is_file() {
        verify_hash(&path, SHA256)?;
        return Ok(path);
    }
    let script = cache.join("download-base.ps1");
    fs::write(&script, format!("param([string]$Destination)\n$ErrorActionPreference='Stop'\nInvoke-WebRequest -UseBasicParsing -Uri '{URL}' -OutFile $Destination -TimeoutSec 180\n")).map_err(io_error)?;
    let partial = cache.join(format!("base-{}.partial", crate::random_hex()));
    let outcome = command("powershell.exe", &["-NoLogo", "-NoProfile", "-NonInteractive", "-File", unicode(&script)?, unicode(&partial)?], Duration::from_secs(200))
        .and_then(|_| verify_hash(&partial, SHA256));
    if let Err(e) = outcome {
        let _ = fs::remove_file(&partial);
        return Err(e);
    }
    fs::rename(&partial, &path).map_err(io_error)?;
    Ok(path)
}

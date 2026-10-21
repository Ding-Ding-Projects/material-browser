//! Guest-only managed bookmark policies from strictly validated portable input.
use super::*;

pub(super) fn stage(settings: &Value, directory: &Path, engine: &str) -> Result<()> {
    let Some(document) = settings.get("portableBookmarks") else {
        return Ok(());
    };
    if !matches!(engine, "chromium" | "firefox") {
        return Err(error(
            "INVALID_ENGINE",
            "Unsupported bookmark policy engine",
        ));
    }
    let policy =
        material_browser_core::portable_bookmarks::managed_policy(document, engine == "firefox")
            .map_err(|e| error(&e.code, &e.message))?;
    let path = directory.join("input/managed-bookmarks.json");
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(io_error)?;
    use std::io::Write;
    file.write_all(
        &serde_json::to_vec(&policy)
            .map_err(|_| error("INVALID_BOOKMARKS", "Cannot serialize bookmark policy"))?,
    )
    .map_err(io_error)?;
    Ok(())
}

pub(super) fn install_wsl(s: &Session, engine: &str) -> Result<()> {
    if !s.directory.join("input/managed-bookmarks.json").exists() {
        return Ok(());
    }
    verify_registration(s)?;
    let destination = match engine {
        "chromium" => "/etc/chromium/policies/managed/material-browser-bookmarks.json",
        "firefox" => "/opt/material-browser/firefox/distribution/policies.json",
        _ => {
            return Err(error(
                "INVALID_ENGINE",
                "Unsupported bookmark policy engine",
            ));
        }
    };
    // Stream the host-validated copy rather than trusting a guest-writable staging file.
    let script = format!(
        "set -eu; destination='{destination}'; mkdir -p \"$(dirname \"$destination\")\"; test ! -e \"$destination\"; umask 022; set -C; cat > \"$destination\"; chmod 644 \"$destination\""
    );
    let child = Command::new("wsl.exe")
        .args([
            "-d",
            &s.distribution,
            "-u",
            "root",
            "--exec",
            "sh",
            "-lc",
            &script,
        ])
        .stdin(Stdio::from(
            fs::File::open(s.directory.join("input/managed-bookmarks.json")).map_err(io_error)?,
        ))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(io_error)?;
    wait_owned(child, Duration::from_secs(30))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn stages_only_policy_and_preserves_existing_profile_bytes() {
        let root = std::env::temp_dir().join(format!("portable-bookmarks-{}", crate::random_hex()));
        fs::create_dir_all(root.join("input/state/browser")).unwrap();
        let editable = root.join("input/state/browser/Bookmarks");
        fs::write(&editable, b"existing editable bookmarks").unwrap();
        let settings = json!({"portableBookmarks":{"version":1,"folderName":"Imported","bookmarks":[{"name":"Example","url":"https://example.com"}]}});
        stage(&settings, &root, "chromium").unwrap();
        assert_eq!(fs::read(editable).unwrap(), b"existing editable bookmarks");
        let policy: Value =
            serde_json::from_slice(&fs::read(root.join("input/managed-bookmarks.json")).unwrap())
                .unwrap();
        assert_eq!(policy["ManagedBookmarks"][0]["toplevel_name"], "Imported");
        assert!(stage(&settings, &root, "chromium").is_err());
        fs::remove_dir_all(root).unwrap();
    }
}

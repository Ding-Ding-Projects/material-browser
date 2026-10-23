//! Guest-only KeePassXC browser registrations for a Super Profile that pairs inside its guest.
//!
//! The guest browser and KeePassXC share the guest, so the native messaging host is the guest's
//! own `/usr/bin/keepassxc-proxy`. KeePassXC itself reaches the guest through the template's
//! selected Linux installers; this module only verifies that it is present and registers it.
use super::*;
use crate::password_manager::merge_firefox_policy;
use material_browser_core::password_manager as core_pm;

const GUEST_PROXY: &str = "/usr/bin/keepassxc-proxy";
const STAGE_DIR: &str = "input/password-manager";

/// Templates store the pairing as supplied, so defaults (extension on) apply through normalize.
fn enabled(settings: &Value) -> bool {
    core_pm::normalize(&settings["passwordManager"])
        .map(|manager| manager["extension"] == true)
        .unwrap_or(false)
}
fn write_new(path: &Path, document: &Value) -> Result<()> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(io_error)?;
    }
    use std::io::Write;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(io_error)?;
    file.write_all(
        &serde_json::to_vec_pretty(document)
            .map_err(|_| error("SERIALIZATION", "Cannot serialize registration"))?,
    )
    .map_err(io_error)?;
    Ok(())
}
/// Stages host-validated registration documents beside the other guest inputs.
pub(super) fn stage(settings: &Value, directory: &Path, engine: &str) -> Result<()> {
    if !enabled(settings) {
        return Ok(());
    }
    let stage = directory.join(STAGE_DIR);
    match engine {
        "chromium" => {
            let manifest = core_pm::chromium_native_messaging_manifest(GUEST_PROXY)
                .map_err(|e| error(&e.code, &e.message))?;
            write_new(&stage.join("native-messaging-host.json"), &manifest)?;
            write_new(
                &stage.join("external-extension.json"),
                &core_pm::chromium_external_extension_registration(),
            )?;
        }
        "firefox" => {
            let manifest = core_pm::firefox_native_messaging_manifest(GUEST_PROXY)
                .map_err(|e| error(&e.code, &e.message))?;
            write_new(&stage.join("native-messaging-host.json"), &manifest)?;
            let bookmarks = directory.join("input/managed-bookmarks.json");
            let existing: Value = if bookmarks.is_file() {
                serde_json::from_slice(&fs::read(&bookmarks).map_err(io_error)?)
                    .map_err(|_| error("INVALID_BOOKMARKS", "Staged bookmark policy is not JSON"))?
            } else {
                Value::Null
            };
            write_new(
                &stage.join("policies.json"),
                &merge_firefox_policy(&existing)?,
            )?;
        }
        _ => {
            return Err(error(
                "INVALID_ENGINE",
                "Unsupported password manager engine",
            ));
        }
    }
    Ok(())
}
fn stream(s: &Session, user: &str, source: &Path, script: String) -> Result<()> {
    let child = Command::new("wsl.exe")
        .args([
            "-d",
            &s.distribution,
            "-u",
            user,
            "--exec",
            "sh",
            "-lc",
            &script,
        ])
        .stdin(Stdio::from(fs::File::open(source).map_err(io_error)?))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(io_error)?;
    wait_owned(child, Duration::from_secs(30))
}
/// Installs the staged registrations into the guest after proving the guest proxy exists.
pub(super) fn install_wsl(s: &Session, engine: &str) -> Result<()> {
    let stage = s.directory.join(STAGE_DIR);
    if !stage.join("native-messaging-host.json").is_file() {
        return Ok(());
    }
    verify_registration(s)?;
    run(
        &["-d", &s.distribution, "--exec", "sh", "-lc", "test -x /usr/bin/keepassxc-proxy"],
        Duration::from_secs(15),
    )
    .map_err(|_| {
        error(
            "PASSWORD_MANAGER_WSL_UNAVAILABLE",
            "The guest has no /usr/bin/keepassxc-proxy; add a KeePassXC package from the maintained lineage to the template installers",
        )
    })?;
    let new_file = |destination: &str| {
        format!(
            "set -eu; destination='{destination}'; mkdir -p \"$(dirname \"$destination\")\"; test ! -e \"$destination\"; umask 022; set -C; cp /dev/stdin \"$destination\"; chmod 644 \"$destination\""
        )
    };
    match engine {
        "chromium" => {
            stream(
                s,
                USER,
                &stage.join("native-messaging-host.json"),
                new_file(
                    "/home/materialbrowser/.material-browser/browser/NativeMessagingHosts/org.keepassxc.keepassxc_browser.json",
                ),
            )?;
            stream(
                s,
                USER,
                &stage.join("external-extension.json"),
                new_file(
                    "/home/materialbrowser/.material-browser/browser/External Extensions/oboonakemofpalcgghocfoadofidjkkk.json",
                ),
            )?;
        }
        "firefox" => {
            stream(
                s,
                USER,
                &stage.join("native-messaging-host.json"),
                new_file(
                    "/home/materialbrowser/.mozilla/native-messaging-hosts/org.keepassxc.keepassxc_browser.json",
                ),
            )?;
            // The merged policy is a superset of the bookmark-only file written earlier, so it
            // replaces that file rather than requiring its absence.
            stream(
                s,
                "root",
                &stage.join("policies.json"),
                "set -eu; destination='/opt/material-browser/firefox/distribution/policies.json'; mkdir -p \"$(dirname \"$destination\")\"; umask 022; cp /dev/stdin \"$destination.tmp\"; mv -f \"$destination.tmp\" \"$destination\"; chmod 644 \"$destination\"".to_string(),
            )?;
        }
        _ => {
            return Err(error(
                "INVALID_ENGINE",
                "Unsupported password manager engine",
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    fn settings() -> Value {
        json!({"passwordManager":{"provider":"keepassxc","source":"wsl","wslDistribution":"guest","database":{"path":"/home/materialbrowser/vault.kdbx"},"extension":true,"passkeys":true}})
    }
    #[test]
    fn stages_guest_registrations_and_merges_bookmark_policy() {
        let root = std::env::temp_dir().join(format!("pm-guest-{}", crate::random_hex()));
        fs::create_dir_all(root.join("input")).unwrap();
        fs::write(
            root.join("input/managed-bookmarks.json"),
            br#"{"policies":{"ManagedBookmarks":[{"toplevel_name":"Imported"}]}}"#,
        )
        .unwrap();
        stage(&settings(), &root, "firefox").unwrap();
        let policy: Value = serde_json::from_slice(
            &fs::read(root.join("input/password-manager/policies.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(
            policy["policies"]["ManagedBookmarks"][0]["toplevel_name"],
            "Imported"
        );
        assert_eq!(
            policy["policies"]["ExtensionSettings"][core_pm::FIREFOX_EXTENSION_ID]["installation_mode"],
            "normal_installed"
        );
        let manifest: Value = serde_json::from_slice(
            &fs::read(root.join("input/password-manager/native-messaging-host.json")).unwrap(),
        )
        .unwrap();
        assert_eq!(manifest["path"], GUEST_PROXY);
        assert_eq!(
            manifest["allowed_extensions"][0],
            core_pm::FIREFOX_EXTENSION_ID
        );
        assert!(stage(&settings(), &root, "firefox").is_err());
        let chromium = std::env::temp_dir().join(format!("pm-guest-c-{}", crate::random_hex()));
        fs::create_dir_all(&chromium).unwrap();
        stage(&settings(), &chromium, "chromium").unwrap();
        assert!(
            chromium
                .join("input/password-manager/external-extension.json")
                .is_file()
        );
        assert!(
            !chromium
                .join("input/password-manager/policies.json")
                .exists()
        );
        let off = std::env::temp_dir().join(format!("pm-guest-off-{}", crate::random_hex()));
        fs::create_dir_all(&off).unwrap();
        let mut disabled = settings();
        disabled["passwordManager"]["extension"] = json!(false);
        stage(&disabled, &off, "chromium").unwrap();
        assert!(!off.join("input/password-manager").exists());
        let defaults = std::env::temp_dir().join(format!("pm-guest-d-{}", crate::random_hex()));
        fs::create_dir_all(&defaults).unwrap();
        let mut minimal = settings();
        minimal["passwordManager"]
            .as_object_mut()
            .unwrap()
            .remove("extension");
        stage(&minimal, &defaults, "chromium").unwrap();
        assert!(
            defaults
                .join("input/password-manager/external-extension.json")
                .is_file()
        );
        fs::remove_dir_all(&defaults).unwrap();
        for dir in [root, chromium, off] {
            fs::remove_dir_all(dir).unwrap();
        }
    }
}

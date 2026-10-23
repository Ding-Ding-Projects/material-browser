//! Per-profile KeePassXC browser registration written only into application-owned locations.
//!
//! The host never edits KeePassXC's own configuration, never stores a database password and never
//! overwrites a file it did not create. Every write is a create-if-absent JSON document carrying a
//! marker so removal is scoped to this application's own registrations.
use crate::{Result, error, io_error};
use material_browser_core::password_manager as core_pm;
use serde_json::{Value, json};
use std::{
    fs,
    path::{Path, PathBuf},
};

const MARKER: &str = "material-browser";
const CHROMIUM_MANIFEST: &str = "NativeMessagingHosts/org.keepassxc.keepassxc_browser.json";
const CHROMIUM_EXTERNAL: &str = "External Extensions/oboonakemofpalcgghocfoadofidjkkk.json";
const FIREFOX_MANIFEST: &str = "native-messaging-hosts/org.keepassxc.keepassxc_browser.json";
const FIREFOX_POLICIES: &str = "distribution/policies.json";

/// An installed KeePassXC located under one of the supported installer roots.
#[derive(Clone, Debug)]
pub struct Installation {
    pub root: PathBuf,
    pub executable: PathBuf,
    pub proxy: PathBuf,
}

/// Finds a usable installation. Only Windows installer layouts from the maintained lineage count.
pub fn detect_installation(roots: &[PathBuf]) -> Option<Installation> {
    roots.iter().find_map(|root| {
        let executable = root.join("KeePassXC.exe");
        let proxy = root.join("keepassxc-proxy.exe");
        if executable.is_file() && proxy.is_file() {
            Some(Installation {
                root: root.clone(),
                executable,
                proxy,
            })
        } else {
            // Squirrel layouts keep the current version in app-<version>; prefer the newest.
            let mut versions: Vec<PathBuf> = fs::read_dir(root)
                .ok()?
                .filter_map(|entry| entry.ok().map(|e| e.path()))
                .filter(|p| {
                    p.is_dir()
                        && p.file_name()
                            .and_then(|n| n.to_str())
                            .is_some_and(|n| n.starts_with("app-"))
                        && p.join("KeePassXC.exe").is_file()
                        && p.join("keepassxc-proxy.exe").is_file()
                })
                .collect();
            versions.sort();
            versions.pop().map(|version| Installation {
                root: root.clone(),
                executable: version.join("KeePassXC.exe"),
                proxy: version.join("keepassxc-proxy.exe"),
            })
        }
    })
}

/// Parses `wsl.exe -l -q` output: one distribution per line, UTF-16 artefacts and blanks removed.
pub fn parse_distribution_list(output: &str) -> Vec<String> {
    output
        .lines()
        .map(|line| {
            line.chars()
                .filter(|c| *c != '\0' && *c != '\u{feff}')
                .collect::<String>()
        })
        .map(|line| line.trim().to_string())
        .filter(|line| core_pm::wsl_distribution(Some(&json!(line))).is_ok())
        .collect()
}
/// Registered WSL distributions on this host; empty off Windows or when WSL is unavailable.
pub fn list_distributions() -> Vec<String> {
    if !cfg!(windows) {
        return Vec::new();
    }
    crate::super_profiles::run(&["-l", "-q"], std::time::Duration::from_secs(10))
        .map(|output| parse_distribution_list(&output))
        .unwrap_or_default()
}
/// Confirms the maintained-lineage proxy is installed inside the named distribution.
pub fn verify_wsl_proxy(distribution: &str) -> Result<()> {
    let distribution = core_pm::wsl_distribution(Some(&json!(distribution)))
        .map_err(|e| error(&e.code, &e.message))?;
    if !cfg!(windows) {
        return Err(error(
            "CAPABILITY_UNAVAILABLE",
            "WSL password-manager sources require the supported Windows host",
        ));
    }
    crate::super_profiles::run(
        &[
            "-d",
            &distribution,
            "--exec",
            "sh",
            "-lc",
            "test -x /usr/bin/keepassxc-proxy",
        ],
        std::time::Duration::from_secs(15),
    )
    .map(|_| ())
    .map_err(|_| {
        error(
            "PASSWORD_MANAGER_WSL_UNAVAILABLE",
            "The selected WSL distribution has no /usr/bin/keepassxc-proxy; install KeePassXC from the maintained lineage inside it first",
        )
    })
}
/// Writes the app-owned stdio bridge that a Windows browser launches as the native host.
pub fn wsl_proxy_wrapper(user_root: &Path, distribution: &str) -> Result<PathBuf> {
    let script =
        core_pm::wsl_proxy_wrapper_script(distribution).map_err(|e| error(&e.code, &e.message))?;
    let path = user_root.join(format!("keepassxc-proxy-{distribution}.cmd"));
    fs::create_dir_all(user_root).map_err(io_error)?;
    if path.exists() {
        let existing = fs::read_to_string(&path).unwrap_or_default();
        if existing != script {
            if !existing.contains("managed-by: material-browser") {
                return Err(error(
                    "REGISTRATION_EXISTS",
                    "A wrapper this application does not own already exists",
                ));
            }
            fs::write(&path, script).map_err(io_error)?;
        }
        return Ok(path);
    }
    use std::io::Write;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&path)
        .map_err(io_error)?;
    file.write_all(script.as_bytes()).map_err(io_error)?;
    Ok(path)
}

/// Capability report for the renderer: what exists, what is missing, and why.
pub fn detect(wsl_capabilities: &Value) -> Value {
    let installation = if cfg!(windows) {
        detect_installation(&crate::password_manager_roots())
    } else {
        None
    };
    let distributions = list_distributions();
    let wsl = wsl_capabilities["wsl2"]["available"] == true && !distributions.is_empty();
    json!({
        "provider": "keepassxc",
        "installed": installation.as_ref().map(|i| json!({
            "root": i.root,
            "executable": i.executable,
            "proxy": i.proxy,
        })),
        "wslAvailable": wsl,
        "wslDistributions": distributions,
        "recommendedSource": if installation.is_some() { "installed" } else if wsl { "wsl" } else { "none" },
        "sourceRelease": "https://github.com/Ding-Ding-Projects/keepassxc/releases",
        "wslRuntimeVerified": false,
        "limits": [
            "Chromium and Firefox still ask the person to enable the extension on first launch; no silent enable exists.",
            "Passkey support lives in the extension and KeePassXC; this application records the default and does not edit KeePassXC settings.",
            "The WSL source expects KeePassXC from the maintained source lineage already installed in the chosen distribution; this application verifies the proxy and never installs it."
        ]
    })
}

fn owned(value: Value) -> Value {
    let mut value = value;
    value["managedBy"] = json!(MARKER);
    value
}
fn write_if_absent(path: &Path, document: &Value) -> Result<bool> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(io_error)?;
    }
    if path.exists() {
        let existing: Value = fs::read(path)
            .ok()
            .and_then(|bytes| serde_json::from_slice(&bytes).ok())
            .unwrap_or(Value::Null);
        if existing["managedBy"] == MARKER {
            return Ok(false);
        }
        return Err(error(
            "REGISTRATION_EXISTS",
            "A registration this application does not own already exists",
        ));
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
    Ok(true)
}
fn remove_if_owned(path: &Path) -> Result<bool> {
    if !path.exists() {
        return Ok(false);
    }
    let existing: Value = fs::read(path)
        .ok()
        .and_then(|bytes| serde_json::from_slice(&bytes).ok())
        .unwrap_or(Value::Null);
    if existing["managedBy"] != MARKER {
        return Ok(false);
    }
    fs::remove_file(path).map_err(io_error)?;
    Ok(true)
}

/// Writes Chromium registrations inside the profile's own user data directory.
pub fn stage_chromium(profile_dir: &Path, proxy: &Path) -> Result<Value> {
    let proxy = proxy
        .to_str()
        .ok_or_else(|| error("INVALID_PROXY_PATH", "Proxy path is not valid text"))?;
    let manifest = owned(
        core_pm::chromium_native_messaging_manifest(proxy)
            .map_err(|e| error(&e.code, &e.message))?,
    );
    let external = owned(core_pm::chromium_external_extension_registration());
    let wrote_manifest = write_if_absent(&profile_dir.join(CHROMIUM_MANIFEST), &manifest)?;
    let wrote_external = write_if_absent(&profile_dir.join(CHROMIUM_EXTERNAL), &external)?;
    Ok(
        json!({"engine":"chromium","nativeMessagingWritten":wrote_manifest,"extensionRegistrationWritten":wrote_external}),
    )
}
/// Removes only Chromium registrations this application wrote.
pub fn remove_chromium(profile_dir: &Path) -> Result<Value> {
    Ok(json!({
        "nativeMessagingRemoved": remove_if_owned(&profile_dir.join(CHROMIUM_MANIFEST))?,
        "extensionRegistrationRemoved": remove_if_owned(&profile_dir.join(CHROMIUM_EXTERNAL))?,
    }))
}

/// Merges the KeePassXC-Browser `ExtensionSettings` entry into the bundled Firefox policy file,
/// preserving unrelated policies such as `ManagedBookmarks`.
pub(crate) fn merge_firefox_policy(existing: &Value) -> Result<Value> {
    let mut document = if existing.is_null() {
        json!({"policies":{}})
    } else {
        existing.clone()
    };
    if !document["policies"].is_object() {
        return Err(error(
            "INVALID_POLICY_FILE",
            "The Firefox policy file is not an object with a policies member",
        ));
    }
    let settings = document["policies"]["ExtensionSettings"].take();
    let mut settings = if settings.is_null() {
        json!({})
    } else {
        settings
    };
    if !settings.is_object() {
        return Err(error(
            "INVALID_POLICY_FILE",
            "ExtensionSettings is not an object",
        ));
    }
    for (key, value) in core_pm::firefox_extension_policy().as_object().unwrap() {
        settings[key] = value.clone();
    }
    document["policies"]["ExtensionSettings"] = settings;
    Ok(document)
}
/// Writes the Firefox policy and the per-user native messaging manifest into app-owned paths.
pub fn stage_firefox(firefox_root: &Path, user_root: &Path, proxy: &Path) -> Result<Value> {
    let proxy = proxy
        .to_str()
        .ok_or_else(|| error("INVALID_PROXY_PATH", "Proxy path is not valid text"))?;
    let policy_path = firefox_root.join(FIREFOX_POLICIES);
    let existing: Value = match fs::read(&policy_path) {
        Ok(bytes) => serde_json::from_slice(&bytes)
            .map_err(|_| error("INVALID_POLICY_FILE", "Existing policy file is not JSON"))?,
        Err(_) => Value::Null,
    };
    let merged = merge_firefox_policy(&existing)?;
    let changed = merged != existing;
    if changed {
        if let Some(parent) = policy_path.parent() {
            fs::create_dir_all(parent).map_err(io_error)?;
        }
        let temporary = policy_path.with_extension("json.tmp");
        fs::write(
            &temporary,
            serde_json::to_vec_pretty(&merged)
                .map_err(|_| error("SERIALIZATION", "Cannot serialize policy"))?,
        )
        .map_err(io_error)?;
        fs::rename(&temporary, &policy_path).map_err(io_error)?;
    }
    let manifest = owned(
        core_pm::firefox_native_messaging_manifest(proxy)
            .map_err(|e| error(&e.code, &e.message))?,
    );
    let wrote_manifest = write_if_absent(&user_root.join(FIREFOX_MANIFEST), &manifest)?;
    Ok(
        json!({"engine":"firefox","policyUpdated":changed,"nativeMessagingWritten":wrote_manifest,"registryValueRequired":cfg!(windows)}),
    )
}

/// Registry registration on Windows: Firefox only discovers native hosts through
/// `HKCU\Software\Mozilla\NativeMessagingHosts\<name>`, pointing at the manifest file.
#[cfg(windows)]
pub fn register_firefox_manifest(user_root: &Path) -> Result<bool> {
    let manifest = user_root.join(FIREFOX_MANIFEST);
    let key = format!(
        "HKCU\\Software\\Mozilla\\NativeMessagingHosts\\{}",
        core_pm::NATIVE_HOST_NAME
    );
    let query = std::process::Command::new("reg.exe")
        .args(["query", &key, "/ve"])
        .output()
        .map_err(io_error)?;
    if query.status.success() {
        return Ok(false);
    }
    let status = std::process::Command::new("reg.exe")
        .args(["add", &key, "/ve", "/t", "REG_SZ", "/d"])
        .arg(manifest.as_os_str())
        .arg("/f")
        .status()
        .map_err(io_error)?;
    if !status.success() {
        return Err(error(
            "REGISTRY_WRITE_FAILED",
            "Could not register the Firefox native messaging host",
        ));
    }
    Ok(true)
}
#[cfg(not(windows))]
pub fn register_firefox_manifest(_user_root: &Path) -> Result<bool> {
    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    fn root(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!("pm-{name}-{}", crate::random_hex()));
        fs::create_dir_all(&root).unwrap();
        root
    }
    #[test]
    fn detects_flat_and_squirrel_layouts_and_prefers_newest_version() {
        let base = root("detect");
        assert!(detect_installation(&[base.join("missing")]).is_none());
        let squirrel = base.join("KeePassXC.Material");
        for version in ["app-2.8.1", "app-2.8.32001"] {
            fs::create_dir_all(squirrel.join(version)).unwrap();
            fs::write(squirrel.join(version).join("KeePassXC.exe"), b"x").unwrap();
            fs::write(squirrel.join(version).join("keepassxc-proxy.exe"), b"x").unwrap();
        }
        fs::create_dir_all(squirrel.join("app-2.9.0")).unwrap();
        let found = detect_installation(&[base.join("missing"), squirrel.clone()]).unwrap();
        assert!(found.proxy.ends_with("app-2.8.32001/keepassxc-proxy.exe"));
        let flat = base.join("KeePassXC");
        fs::create_dir_all(&flat).unwrap();
        fs::write(flat.join("KeePassXC.exe"), b"x").unwrap();
        fs::write(flat.join("keepassxc-proxy.exe"), b"x").unwrap();
        assert_eq!(
            detect_installation(&[flat.clone()]).unwrap().proxy,
            flat.join("keepassxc-proxy.exe")
        );
        fs::remove_dir_all(base).unwrap();
    }
    #[test]
    fn chromium_registrations_are_owned_idempotent_and_never_overwrite_foreign_files() {
        let profile = root("chromium");
        let proxy = Path::new("/opt/keepassxc/keepassxc-proxy");
        let first = stage_chromium(&profile, proxy).unwrap();
        assert_eq!(first["nativeMessagingWritten"], true);
        let manifest: Value =
            serde_json::from_slice(&fs::read(profile.join(CHROMIUM_MANIFEST)).unwrap()).unwrap();
        assert_eq!(manifest["name"], core_pm::NATIVE_HOST_NAME);
        assert_eq!(manifest["path"], "/opt/keepassxc/keepassxc-proxy");
        assert_eq!(manifest["managedBy"], MARKER);
        let second = stage_chromium(&profile, proxy).unwrap();
        assert_eq!(second["nativeMessagingWritten"], false);
        let removed = remove_chromium(&profile).unwrap();
        assert_eq!(removed["nativeMessagingRemoved"], true);
        assert!(!profile.join(CHROMIUM_MANIFEST).exists());
        fs::create_dir_all(profile.join("NativeMessagingHosts")).unwrap();
        fs::write(profile.join(CHROMIUM_MANIFEST), b"{\"name\":\"foreign\"}").unwrap();
        assert_eq!(
            stage_chromium(&profile, proxy).unwrap_err().code,
            "REGISTRATION_EXISTS"
        );
        assert_eq!(
            remove_chromium(&profile).unwrap()["nativeMessagingRemoved"],
            false
        );
        assert_eq!(
            fs::read(profile.join(CHROMIUM_MANIFEST)).unwrap(),
            b"{\"name\":\"foreign\"}"
        );
        fs::remove_dir_all(profile).unwrap();
    }
    #[test]
    fn wsl_wrapper_is_owned_and_distribution_list_is_filtered() {
        let user = root("wsl-wrapper");
        let path = wsl_proxy_wrapper(&user, "Ubuntu-24.04").unwrap();
        let script = fs::read_to_string(&path).unwrap();
        assert!(script.contains("wsl.exe -d \"Ubuntu-24.04\" --exec /usr/bin/keepassxc-proxy"));
        assert_eq!(wsl_proxy_wrapper(&user, "Ubuntu-24.04").unwrap(), path);
        fs::write(&path, "@echo off\r\nforeign\r\n").unwrap();
        assert_eq!(
            wsl_proxy_wrapper(&user, "Ubuntu-24.04").unwrap_err().code,
            "REGISTRATION_EXISTS"
        );
        assert!(wsl_proxy_wrapper(&user, "bad name").is_err());
        assert_eq!(
            parse_distribution_list("\u{feff}Ubuntu-24.04\r\n\r\nD\0ebian\r\nbad name\r\n"),
            vec!["Ubuntu-24.04".to_string(), "Debian".to_string()]
        );
        assert!(verify_wsl_proxy("Ubuntu-24.04").is_err());
        fs::remove_dir_all(user).unwrap();
    }
    #[test]
    fn firefox_policy_merge_preserves_existing_policies_and_stages_manifest() {
        let existing = json!({"policies":{"ManagedBookmarks":[{"toplevel_name":"Imported"}],"ExtensionSettings":{"other@example.org":{"installation_mode":"blocked"}}}});
        let merged = merge_firefox_policy(&existing).unwrap();
        assert_eq!(
            merged["policies"]["ManagedBookmarks"][0]["toplevel_name"],
            "Imported"
        );
        assert_eq!(
            merged["policies"]["ExtensionSettings"]["other@example.org"]["installation_mode"],
            "blocked"
        );
        assert_eq!(
            merged["policies"]["ExtensionSettings"][core_pm::FIREFOX_EXTENSION_ID]["installation_mode"],
            "normal_installed"
        );
        assert!(merge_firefox_policy(&json!({"policies":[]})).is_err());
        let firefox = root("firefox");
        let user = root("firefox-user");
        let result =
            stage_firefox(&firefox, &user, Path::new("/opt/keepassxc/keepassxc-proxy")).unwrap();
        assert_eq!(result["policyUpdated"], true);
        assert_eq!(result["nativeMessagingWritten"], true);
        let again =
            stage_firefox(&firefox, &user, Path::new("/opt/keepassxc/keepassxc-proxy")).unwrap();
        assert_eq!(again["policyUpdated"], false);
        assert_eq!(again["nativeMessagingWritten"], false);
        let manifest: Value =
            serde_json::from_slice(&fs::read(user.join(FIREFOX_MANIFEST)).unwrap()).unwrap();
        assert_eq!(
            manifest["allowed_extensions"][0],
            core_pm::FIREFOX_EXTENSION_ID
        );
        assert!(stage_chromium(&firefox, Path::new("relative")).is_err());
        fs::remove_dir_all(firefox).unwrap();
        fs::remove_dir_all(user).unwrap();
    }
}

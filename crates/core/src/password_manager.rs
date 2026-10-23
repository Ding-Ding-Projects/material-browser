//! Strict optional password-manager configuration stored on an ordinary profile.
//!
//! The document only records which KeePassXC database a profile pairs with and which browser-side
//! registrations the host may write. It never stores a database password, key file or credential.
use crate::{Result, err};
use serde_json::{Value, json};

/// KeePassXC-Browser identifier in the Chrome Web Store, shared by Chromium-based engines.
pub const CHROMIUM_EXTENSION_ID: &str = "oboonakemofpalcgghocfoadofidjkkk";
/// KeePassXC-Browser add-on identifier on addons.mozilla.org.
pub const FIREFOX_EXTENSION_ID: &str = "keepassxc-browser@keepassxc.org";
/// Native messaging host name that keepassxc-proxy registers under.
pub const NATIVE_HOST_NAME: &str = "org.keepassxc.keepassxc_browser";
const CHROMIUM_UPDATE_URL: &str = "https://clients2.google.com/service/update2/crx";
const FIREFOX_INSTALL_URL: &str =
    "https://addons.mozilla.org/firefox/downloads/latest/keepassxc-browser/latest.xpi";

fn invalid(message: &str) -> crate::CoreError {
    err("INVALID_PASSWORD_MANAGER", message)
}
fn keys(value: &Value, allowed: &[&str]) -> Result<()> {
    match value.as_object() {
        Some(object) if object.keys().all(|k| allowed.contains(&k.as_str())) => Ok(()),
        _ => Err(invalid("Unknown password manager field")),
    }
}
fn flag(value: Option<&Value>, default: bool) -> Result<bool> {
    match value {
        None | Some(Value::Null) => Ok(default),
        Some(Value::Bool(b)) => Ok(*b),
        _ => Err(invalid("Password manager flags must be booleans")),
    }
}
fn absolute(path: &str) -> bool {
    let bytes = path.as_bytes();
    path.starts_with('/')
        || path.starts_with("\\\\")
        || (bytes.len() > 2
            && bytes[0].is_ascii_alphabetic()
            && bytes[1] == b':'
            && matches!(bytes[2], b'\\' | b'/'))
}
/// Validates a database path: absolute, bounded, control-free, no traversal, `.kdbx` suffix.
pub fn database_path(value: &Value) -> Result<&str> {
    let path = value
        .as_str()
        .filter(|p| !p.is_empty() && p.chars().count() <= 1024 && !p.chars().any(char::is_control))
        .ok_or_else(|| invalid("Database path must be a bounded string"))?;
    if path.trim() != path
        || !absolute(path)
        || path.split(['/', '\\']).any(|segment| segment == "..")
        || !path.to_ascii_lowercase().ends_with(".kdbx")
    {
        return Err(invalid("Database path must be an absolute .kdbx path"));
    }
    Ok(path)
}
/// Validates a password-manager document. `null` means the profile has no password manager.
pub fn validate(document: &Value) -> Result<()> {
    normalize(document).map(|_| ())
}
/// Returns the canonical stored form with defaults applied, or `null` when absent.
pub fn normalize(document: &Value) -> Result<Value> {
    if document.is_null() {
        return Ok(Value::Null);
    }
    if serde_json::to_vec(document)?.len() > 8 * 1024 {
        return Err(invalid("Password manager document is too large"));
    }
    keys(
        document,
        &[
            "provider",
            "source",
            "database",
            "extension",
            "passkeys",
            "wslDistribution",
        ],
    )?;
    if document["provider"].as_str() != Some("keepassxc") {
        return Err(invalid("Unsupported password manager provider"));
    }
    let source = document["source"].as_str().unwrap_or("installed");
    if !["installed", "wsl"].contains(&source) {
        return Err(invalid("Unsupported password manager source"));
    }
    let database = &document["database"];
    keys(database, &["mode", "path"])?;
    let mode = database["mode"].as_str().unwrap_or("existing");
    if !["existing", "create"].contains(&mode) {
        return Err(invalid("Unsupported database mode"));
    }
    let path = database_path(&database["path"])?;
    let distribution = match (source, document.get("wslDistribution")) {
        ("installed", None | Some(Value::Null)) => None,
        ("installed", Some(_)) => {
            return Err(invalid(
                "An installed KeePassXC source takes no WSL distribution",
            ));
        }
        ("wsl", value) => Some(wsl_distribution(value)?),
        _ => unreachable!("source already validated"),
    };
    let mut stored = json!({
        "provider": "keepassxc",
        "source": source,
        "database": {"mode": mode, "path": path},
        "extension": flag(document.get("extension"), true)?,
        "passkeys": flag(document.get("passkeys"), true)?,
    });
    if let Some(distribution) = distribution {
        stored["wslDistribution"] = json!(distribution);
    }
    Ok(stored)
}
/// A WSL distribution name is a bounded identifier; `guest` names the owning Super Profile guest.
pub fn wsl_distribution(value: Option<&Value>) -> Result<String> {
    let name = value
        .and_then(Value::as_str)
        .filter(|n| {
            !n.is_empty()
                && n.len() <= 64
                && n.chars()
                    .all(|c| c.is_ascii_alphanumeric() || matches!(c, '.' | '_' | '-'))
        })
        .ok_or_else(|| invalid("A WSL source names its distribution"))?;
    Ok(name.to_string())
}
/// Wrapper script that bridges a Windows browser's stdio to a proxy inside a WSL distribution.
pub fn wsl_proxy_wrapper_script(distribution: &str) -> Result<String> {
    let distribution = wsl_distribution(Some(&json!(distribution)))?;
    Ok(format!(
        "@echo off\r\nrem managed-by: material-browser\r\nwsl.exe -d \"{distribution}\" --exec /usr/bin/keepassxc-proxy %*\r\n"
    ))
}
fn proxy(path: &str) -> Result<&str> {
    if path.is_empty() || path.chars().any(char::is_control) || !absolute(path) {
        return Err(invalid("Proxy executable path must be absolute"));
    }
    Ok(path)
}
/// Chromium reads `<user data dir>/NativeMessagingHosts/<name>.json` for user-level hosts.
pub fn chromium_native_messaging_manifest(proxy_path: &str) -> Result<Value> {
    Ok(json!({
        "name": NATIVE_HOST_NAME,
        "description": "KeePassXC integration with native messaging support",
        "path": proxy(proxy_path)?,
        "type": "stdio",
        "allowed_origins": [format!("chrome-extension://{CHROMIUM_EXTENSION_ID}/")],
    }))
}
/// Chromium external-extension registration; the browser still asks the person to enable it.
pub fn chromium_external_extension_registration() -> Value {
    json!({"external_update_url": CHROMIUM_UPDATE_URL})
}
/// Firefox native messaging manifest written beside the per-user registry value.
pub fn firefox_native_messaging_manifest(proxy_path: &str) -> Result<Value> {
    Ok(json!({
        "name": NATIVE_HOST_NAME,
        "description": "KeePassXC integration with native messaging support",
        "path": proxy(proxy_path)?,
        "type": "stdio",
        "allowed_extensions": [FIREFOX_EXTENSION_ID],
    }))
}
/// Firefox `ExtensionSettings` policy fragment, merged by the host into `policies.json`.
pub fn firefox_extension_policy() -> Value {
    json!({
        FIREFOX_EXTENSION_ID: {
            "installation_mode": "normal_installed",
            "install_url": FIREFOX_INSTALL_URL,
        }
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sample(path: &str) -> Value {
        json!({"provider":"keepassxc","database":{"path":path}})
    }
    #[test]
    fn null_is_absent_and_defaults_apply() {
        assert_eq!(normalize(&Value::Null).unwrap(), Value::Null);
        let stored = normalize(&sample("C:\\Users\\demo\\vault.kdbx")).unwrap();
        assert_eq!(stored["source"], "installed");
        assert_eq!(stored["database"]["mode"], "existing");
        assert_eq!(stored["extension"], true);
        assert_eq!(stored["passkeys"], true);
        let off = normalize(&json!({"provider":"keepassxc","source":"wsl","wslDistribution":"Ubuntu-24.04","database":{"mode":"create","path":"/home/demo/new.kdbx"},"extension":false,"passkeys":false})).unwrap();
        assert_eq!(off["source"], "wsl");
        assert_eq!(off["wslDistribution"], "Ubuntu-24.04");
        assert!(stored.get("wslDistribution").is_none());
        assert_eq!(off["extension"], false);
        assert_eq!(off["passkeys"], false);
    }
    #[test]
    fn rejects_relative_traversal_control_suffix_and_unknown_fields() {
        for path in [
            "vault.kdbx",
            "C:vault.kdbx",
            "/home/demo/../vault.kdbx",
            "/home/demo/vault.kdb",
            "/home/demo/vault.kdbx\n",
            " /home/demo/vault.kdbx",
            "",
        ] {
            assert!(validate(&sample(path)).is_err(), "{path:?}");
        }
        let mut value = sample("/home/demo/vault.kdbx");
        value["password"] = json!("never");
        assert!(validate(&value).is_err());
        value = sample("/home/demo/vault.kdbx");
        value["database"]["keyFile"] = json!("/k");
        assert!(validate(&value).is_err());
        value = sample("/home/demo/vault.kdbx");
        value["provider"] = json!("other");
        assert!(validate(&value).is_err());
        value = sample("/home/demo/vault.kdbx");
        value["source"] = json!("cloud");
        assert!(validate(&value).is_err());
        value = sample("/home/demo/vault.kdbx");
        value["passkeys"] = json!("yes");
        assert!(validate(&value).is_err());
        assert!(validate(&json!({"provider":"keepassxc","database":{"path":"/x.kdbx"},"extension":"x".repeat(9000)})).is_err());
        let wsl = |distribution: Value| json!({"provider":"keepassxc","source":"wsl","wslDistribution":distribution,"database":{"path":"/home/demo/vault.kdbx"}});
        assert!(validate(&wsl(Value::Null)).is_err());
        assert!(validate(&wsl(json!("bad name"))).is_err());
        assert!(validate(&wsl(json!("x".repeat(65)))).is_err());
        assert!(validate(&wsl(json!("guest"))).is_ok());
        let mut installed = sample("/home/demo/vault.kdbx");
        installed["wslDistribution"] = json!("Ubuntu");
        assert!(validate(&installed).is_err());
    }
    #[test]
    fn wsl_wrapper_bridges_stdio_to_the_named_distribution() {
        let script = wsl_proxy_wrapper_script("Ubuntu-24.04").unwrap();
        assert!(script.starts_with("@echo off\r\n"));
        assert!(script.contains("wsl.exe -d \"Ubuntu-24.04\" --exec /usr/bin/keepassxc-proxy %*"));
        assert!(script.contains("managed-by: material-browser"));
        assert!(wsl_proxy_wrapper_script("a b").is_err());
    }
    #[test]
    fn registrations_carry_exact_identifiers_and_reject_relative_proxy() {
        let chromium =
            chromium_native_messaging_manifest("C:\\KeePassXC\\keepassxc-proxy.exe").unwrap();
        assert_eq!(chromium["name"], NATIVE_HOST_NAME);
        assert_eq!(chromium["type"], "stdio");
        assert_eq!(
            chromium["allowed_origins"][0],
            "chrome-extension://oboonakemofpalcgghocfoadofidjkkk/"
        );
        assert!(chromium_native_messaging_manifest("keepassxc-proxy.exe").is_err());
        let firefox = firefox_native_messaging_manifest("/opt/keepassxc/keepassxc-proxy").unwrap();
        assert_eq!(firefox["allowed_extensions"][0], FIREFOX_EXTENSION_ID);
        assert_eq!(
            chromium_external_extension_registration()["external_update_url"],
            CHROMIUM_UPDATE_URL
        );
        let policy = firefox_extension_policy();
        assert_eq!(
            policy[FIREFOX_EXTENSION_ID]["installation_mode"],
            "normal_installed"
        );
        assert_eq!(policy.as_object().unwrap().len(), 1);
    }
}

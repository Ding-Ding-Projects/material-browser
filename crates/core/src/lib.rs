//! Encrypted local vault and immutable revision store. No browser processes are launched here.
mod super_profiles;
use argon2::{Algorithm, Argon2, Params, Version};
use chacha20poly1305::{
    XChaCha20Poly1305, XNonce,
    aead::{Aead, KeyInit, Payload},
};
use fs2::FileExt;
use hkdf::Hkdf;
use rand::{RngCore, rngs::OsRng};
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use sha2::Sha256;
use std::{
    collections::{BTreeMap, BTreeSet},
    fmt,
    fs::{self, OpenOptions},
    io::{Read, Write},
    path::{Component, Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};
use uuid::Uuid;
use zeroize::{Zeroize, Zeroizing};
const MAX: usize = 64 * 1024 * 1024;
const MAX_FILES: usize = 10000;
#[derive(Debug, Serialize)]
pub struct CoreError {
    pub code: String,
    pub message: String,
}
impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}
impl std::error::Error for CoreError {}
type Result<T> = std::result::Result<T, CoreError>;
fn err(code: &str, message: &str) -> CoreError {
    CoreError {
        code: code.into(),
        message: message.into(),
    }
}
impl From<std::io::Error> for CoreError {
    fn from(_: std::io::Error) -> Self {
        err("IO", "Vault filesystem operation failed")
    }
}
impl From<serde_json::Error> for CoreError {
    fn from(_: serde_json::Error) -> Self {
        err("INVALID_DATA", "Invalid vault data")
    }
}
#[derive(Serialize, Deserialize)]
struct Header {
    version: u32,
    salt: Vec<u8>,
    wrapped: Vec<u8>,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Profile {
    id: String,
    name: String,
    engine: String,
    automation: String,
    identity: Value,
    created_at: u64,
    updated_at: u64,
    sync: bool,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Revision {
    id: String,
    profile_id: String,
    parents: Vec<String>,
    created_at: u64,
    files: BTreeMap<String, String>,
}
#[derive(Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(transparent)]
struct SecretKey(Vec<u8>);
impl std::ops::Deref for SecretKey {
    type Target = [u8];
    fn deref(&self) -> &[u8] {
        &self.0
    }
}
impl Drop for SecretKey {
    fn drop(&mut self) {
        self.0.zeroize();
    }
}
#[derive(Clone, Default, Serialize, Deserialize)]
struct State {
    #[serde(default)]
    super_profiles: BTreeMap<String, super_profiles::SuperProfile>,
    #[serde(default)]
    super_revisions: BTreeMap<String, super_profiles::SuperRevision>,
    profiles: BTreeMap<String, Profile>,
    keys: BTreeMap<String, SecretKey>,
    revisions: BTreeMap<String, Revision>,
    heads: BTreeMap<String, Vec<String>>,
    preferences: Value,
    sync_folder: Option<PathBuf>,
}
pub struct Manager {
    _lock: fs::File,
    #[cfg(test)]
    restore_fault: Option<&'static str>,
    root: PathBuf,
    key: Option<Zeroizing<Vec<u8>>>,
    state: State,
}
fn now() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}
fn random(n: usize) -> Vec<u8> {
    let mut b = vec![0; n];
    OsRng.fill_bytes(&mut b);
    b
}
fn valid_id(id: &str) -> Result<()> {
    Uuid::parse_str(id)
        .map(|_| ())
        .map_err(|_| err("INVALID_ID", "Expected a UUID"))
}
fn text<'a>(v: &'a Value, k: &str) -> Result<&'a str> {
    v.get(k)
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty() && s.len() <= 4096)
        .ok_or_else(|| {
            err(
                "INVALID_ARGUMENT",
                "Required text field missing or too long",
            )
        })
}
fn derive(password: &str, salt: &[u8]) -> Result<Zeroizing<Vec<u8>>> {
    if password.is_empty() || password.len() > 4096 || salt.len() != 16 {
        return Err(err("INVALID_ARGUMENT", "Invalid password or vault header"));
    }
    let mut key = Zeroizing::new(vec![0; 32]);
    #[cfg(test)]
    let params = Params::new(32, 1, 1, Some(32)).unwrap();
    #[cfg(not(test))]
    let params = Params::new(65536, 3, 1, Some(32)).unwrap();
    Argon2::new(Algorithm::Argon2id, Version::V0x13, params)
        .hash_password_into(password.as_bytes(), salt, &mut key)
        .map_err(|_| err("CRYPTO", "Key derivation failed"))?;
    Ok(key)
}
fn seal(key: &[u8], data: &[u8], aad: &[u8]) -> Result<Vec<u8>> {
    if data.len() > MAX {
        return Err(err("LIMIT", "Object exceeds size limit"));
    }
    let nonce = random(24);
    let cipher = XChaCha20Poly1305::new_from_slice(key)
        .map_err(|_| err("CRYPTO", "Invalid encryption key"))?;
    let mut out = nonce.clone();
    out.extend(
        cipher
            .encrypt(XNonce::from_slice(&nonce), Payload { msg: data, aad })
            .map_err(|_| err("CRYPTO", "Encryption failed"))?,
    );
    Ok(out)
}
fn open(key: &[u8], data: &[u8], aad: &[u8]) -> Result<Zeroizing<Vec<u8>>> {
    if data.len() < 40 || data.len() > MAX + 40 {
        return Err(err("INTEGRITY", "Invalid encrypted object size"));
    }
    let cipher =
        XChaCha20Poly1305::new_from_slice(key).map_err(|_| err("INTEGRITY", "Invalid key"))?;
    cipher
        .decrypt(
            XNonce::from_slice(&data[..24]),
            Payload {
                msg: &data[24..],
                aad,
            },
        )
        .map(Zeroizing::new)
        .map_err(|_| err("INTEGRITY", "Authentication failed"))
}
fn no_links(path: &Path) -> Result<()> {
    for ancestor in path.ancestors() {
        if let Ok(m) = fs::symlink_metadata(ancestor) {
            if m.file_type().is_symlink() {
                return Err(err("UNSAFE_PATH", "Symbolic links are not allowed"));
            }
        }
    }
    Ok(())
}
fn read(path: &Path) -> Result<Vec<u8>> {
    no_links(path)?;
    let f = fs::File::open(path)?;
    if f.metadata()?.len() > (MAX + 40) as u64 {
        return Err(err("LIMIT", "Object exceeds size limit"));
    }
    let mut bytes = Vec::new();
    f.take((MAX + 41) as u64).read_to_end(&mut bytes)?;
    if bytes.len() > MAX + 40 {
        return Err(err("LIMIT", "Object exceeds size limit"));
    }
    Ok(bytes)
}
fn atomic(path: &Path, data: &[u8]) -> Result<()> {
    no_links(path)?;
    let parent = path
        .parent()
        .ok_or_else(|| err("UNSAFE_PATH", "Missing parent"))?;
    fs::create_dir_all(parent)?;
    no_links(parent)?;
    let tmp = parent.join(format!(".{}.tmp", Uuid::new_v4()));
    let mut f = OpenOptions::new().write(true).create_new(true).open(&tmp)?;
    f.write_all(data)?;
    f.sync_all()?;
    drop(f);
    let mut last = None;
    for _ in 0..4 {
        match fs::rename(&tmp, path) {
            Ok(()) => return Ok(()),
            Err(e) => {
                last = Some(e);
                std::thread::sleep(std::time::Duration::from_millis(30));
            }
        }
    }
    let _ = fs::remove_file(tmp);
    Err(last.unwrap().into())
}
fn safe_relative(s: &str) -> Result<PathBuf> {
    let p = PathBuf::from(s);
    if s.len() > 4096
        || s.chars().any(|c| c.is_control())
        || s.split('/').any(|part| {
            let base = part.split('.').next().unwrap_or("").to_ascii_uppercase();
            part.is_empty()
                || part.ends_with('.')
                || part.ends_with(' ')
                || part.len() > 255
                || part.contains(['<', '>', '"', '|', '?', '*'])
                || [
                    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6",
                    "COM7", "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7",
                    "LPT8", "LPT9",
                ]
                .contains(&base.as_str())
        })
        || s.is_empty()
        || s.contains('\\')
        || s.contains(':')
        || p.components().any(|c| !matches!(c, Component::Normal(_)))
    {
        return Err(err("UNSAFE_PATH", "Invalid snapshot path"));
    }
    Ok(p)
}
#[derive(Serialize, Deserialize)]
struct RestoreJournal {
    profile: String,
    backup: String,
    staged: String,
}
fn ephemeral(name: &str) -> bool {
    matches!(
        name.to_ascii_lowercase().as_str(),
        ".material-browser.lock"
            | "singletonlock"
            | "singletoncookie"
            | "singletonsocket"
            | "lock"
            | ".parentlock"
            | "parent.lock"
            | "devtoolsactiveport"
            | "marionetteactiveport"
    )
}
fn profile_lock(directory: &Path) -> Result<fs::File> {
    let path = directory.join(".material-browser.lock");
    no_links(&path)?;
    let file = OpenOptions::new()
        .read(true)
        .write(true)
        .create(true)
        .truncate(false)
        .open(path)?;
    file.try_lock_exclusive().map_err(|_| {
        err(
            "PROFILE_RUNNING",
            "Managed profile is locked by an engine or another operation",
        )
    })?;
    Ok(file)
}
fn recover_restore(root: &Path) -> Result<()> {
    let journal_path = root.join("restore-journal.json");
    if !journal_path.exists() {
        return Ok(());
    }
    let bytes = read(&journal_path)?;
    if bytes.len() > 4096 {
        return Err(err("INTEGRITY", "Invalid restore journal"));
    }
    let journal: RestoreJournal = serde_json::from_slice(&bytes)?;
    valid_id(&journal.profile)?;
    valid_id(&journal.backup)?;
    valid_id(&journal.staged)?;
    let active = root.join("active").join(&journal.profile);
    let backup = root.join("staging").join(&journal.backup);
    let retained = root.join("staging").join(&journal.staged);
    no_links(&active)?;
    no_links(&backup)?;
    no_links(&retained)?;
    let metadata_backup = root
        .join("staging")
        .join(format!("{}.metadata", journal.backup));
    // Roll back every journal still present, including a crash after metadata publication.
    // Removal of the journal is the commit point. Recovery preserves both directory versions.
    if backup.exists() {
        if active.exists() {
            if retained.exists() {
                return Err(err("RECOVERY_REQUIRED", "Restore staging collision"));
            }
            fs::rename(&active, &retained)?;
        }
        fs::rename(&backup, &active)?;
    }
    let old = read(&metadata_backup)?;
    // If an external actor replaced metadata with a directory, do not remove that directory.
    // Active rollback has already occurred; keep the journal for a supported retry.
    atomic(&root.join("metadata.enc"), &old)?;
    fs::remove_file(journal_path)?;
    Ok(())
}

impl Manager {
    /// Supplies the versioned browser encryption key only to trusted in-process code.
    /// The callback must not retain, serialize, log, or export the supplied bytes.
    /// This is deliberately absent from the JSON command dispatcher.
    pub fn with_browser_key<T>(
        &self,
        profile_id: &str,
        use_key: impl FnOnce(&[u8; 32]) -> T,
    ) -> Result<T> {
        self.key()?;
        let profile_uuid =
            Uuid::parse_str(profile_id).map_err(|_| err("INVALID_ID", "Expected a UUID"))?;
        if !self.state.profiles.contains_key(profile_id) {
            return Err(err("NOT_FOUND", "Profile not found"));
        }
        let profile_key = self
            .state
            .keys
            .get(profile_id)
            .ok_or_else(|| err("INTEGRITY", "Profile encryption key is missing"))?;
        if profile_key.len() != 32 {
            return Err(err("INTEGRITY", "Invalid profile encryption key"));
        }
        // Snapshot encryption uses the original random profile key. Browser keys
        // use a separate HKDF domain, version and stable UUID context.
        let hkdf =
            Hkdf::<Sha256>::new(Some(b"material-browser/browser-native-key/v1"), profile_key);
        let mut context = b"browser-native-encryption\0".to_vec();
        context.extend_from_slice(&1u32.to_be_bytes());
        context.extend_from_slice(profile_uuid.as_bytes());
        let mut browser_key = Zeroizing::new([0u8; 32]);
        hkdf.expand(&context, browser_key.as_mut())
            .map_err(|_| err("CRYPTO", "Browser key derivation failed"))?;
        Ok(use_key(&browser_key))
    }

    pub fn new(root: PathBuf) -> Result<Self> {
        no_links(&root)?;
        fs::create_dir_all(&root)?;
        let root = fs::canonicalize(root)?;
        let lock_path = root.join(".vault.lock");
        no_links(&lock_path)?;
        let lock = OpenOptions::new()
            .read(true)
            .write(true)
            .create(true)
            .truncate(false)
            .open(lock_path)?;
        lock.try_lock_exclusive()
            .map_err(|_| err("BUSY", "Vault is already open in another manager"))?;
        recover_restore(&root)?;
        Ok(Self {
            _lock: lock,
            #[cfg(test)]
            restore_fault: None,
            root,
            key: None,
            state: State::default(),
        })
    }
    fn key(&self) -> Result<&[u8]> {
        self.key
            .as_deref()
            .map(|x| x.as_slice())
            .ok_or_else(|| err("LOCKED", "Unlock the vault first"))
    }
    fn persist(&self) -> Result<()> {
        let plain = Zeroizing::new(serde_json::to_vec(&self.state)?);
        atomic(
            &self.root.join("metadata.enc"),
            &seal(self.key()?, &plain, b"metadata-v1")?,
        )
    }
    fn id<'a>(&self, p: &'a Value) -> Result<&'a str> {
        let id = text(p, "id")?;
        valid_id(id)?;
        if !self.state.profiles.contains_key(id) {
            return Err(err("NOT_FOUND", "Profile not found"));
        }
        Ok(id)
    }
    pub fn execute(&mut self, method: &str, p: Value) -> Result<Value> {
        if !p.is_object() {
            return Err(err("INVALID_ARGUMENT", "Parameters must be an object"));
        }
        for field in ["automation", "engine"] {
            if p.get(field).is_some_and(|v| !v.is_string()) {
                return Err(err("INVALID_ARGUMENT", "Expected a text option"));
            }
        }
        for field in ["sync", "running"] {
            if p.get(field).is_some_and(|v| !v.is_boolean()) {
                return Err(err("INVALID_ARGUMENT", "Expected a boolean option"));
            }
        }
        if serde_json::to_vec(&p)?.len() > 1024 * 1024 {
            return Err(err("LIMIT", "Request exceeds size limit"));
        }
        if self.root.join("restore-journal.json").exists()
            && !["system.status", "vault.lock"].contains(&method)
        {
            return Err(err(
                "RECOVERY_REQUIRED",
                "Reopen vault to finish interrupted restore recovery",
            ));
        }
        match method {
            "system.status" => {
                return Ok(
                    json!({"vaultExists":self.root.join("vault.json").exists(),"locked":self.key.is_none(),"snapshotProtocol":"stopped-only","liveSnapshotSupported":false}),
                );
            }
            "vault.create" => {
                if self.root.join("vault.json").exists() {
                    return Err(err("EXISTS", "Vault already exists"));
                }
                let password = text(&p, "password")?;
                let salt = random(16);
                let wrapping = derive(password, &salt)?;
                let key = Zeroizing::new(random(32));
                let h = Header {
                    version: 1,
                    salt,
                    wrapped: seal(&wrapping, &key, b"vault-key-v1")?,
                };
                self.key = Some(key);
                self.state = State::default();
                self.persist()?;
                atomic(&self.root.join("vault.json"), &serde_json::to_vec(&h)?)?;
                return Ok(json!({"locked":false}));
            }
            "vault.join" => return self.join(&p),
            "vault.unlock" => {
                let h: Header = serde_json::from_slice(&read(&self.root.join("vault.json"))?)?;
                if h.version != 1 {
                    return Err(err("VERSION", "Unsupported vault version"));
                }
                let wrapping = derive(text(&p, "password")?, &h.salt)?;
                let key = open(&wrapping, &h.wrapped, b"vault-key-v1").map_err(|_| {
                    err("AUTHENTICATION", "Password or vault authentication failed")
                })?;
                let state: State = serde_json::from_slice(&open(
                    &key,
                    &read(&self.root.join("metadata.enc"))?,
                    b"metadata-v1",
                )?)?;
                self.state = state;
                self.key = Some(key);
                return Ok(json!({"locked":false}));
            }
            "vault.lock" => {
                self.key = None;
                for k in self.state.keys.values_mut() {
                    k.0.zeroize();
                }
                self.state = State::default();
                return Ok(json!({"locked":true}));
            }
            _ => {
                self.key()?;
            }
        }
        let before = self.state.clone();
        let result = self.dispatch(method, &p);
        match result {
            Ok(value) => {
                if method == "revisions.restore" {
                    return Ok(value);
                }
                if let Err(e) = self.persist() {
                    self.state = before;
                    return Err(e);
                }
                Ok(value)
            }
            Err(e) => {
                self.state = before;
                Err(e)
            }
        }
    }
    fn dispatch(&mut self, m: &str, p: &Value) -> Result<Value> {
        if m.starts_with("superProfiles.") {
            return self.dispatch_super_profiles(m, p);
        }
        match m {
            "vault.changePassword" => {
                let old: Header = serde_json::from_slice(&read(&self.root.join("vault.json"))?)?;
                let wrapping = derive(text(p, "oldPassword")?, &old.salt)?;
                let actual = open(&wrapping, &old.wrapped, b"vault-key-v1")
                    .map_err(|_| err("AUTHENTICATION", "Password authentication failed"))?;
                if actual.as_slice() != self.key()? {
                    return Err(err("AUTHENTICATION", "Password authentication failed"));
                }
                let salt = random(16);
                let wrapping = derive(text(p, "newPassword")?, &salt)?;
                let h = Header {
                    version: 1,
                    salt,
                    wrapped: seal(&wrapping, self.key()?, b"vault-key-v1")?,
                };
                atomic(&self.root.join("vault.json"), &serde_json::to_vec(&h)?)?;
                Ok(json!({"changed":true}))
            }
            "profiles.list" => Ok(json!(self.state.profiles.values().collect::<Vec<_>>())),
            "profiles.create" | "profiles.duplicate" => {
                let id = Uuid::new_v4().to_string();
                let engine = p
                    .get("engine")
                    .and_then(Value::as_str)
                    .unwrap_or("chromium");
                if !["chromium", "firefox"].contains(&engine) {
                    return Err(err("INVALID_ARGUMENT", "Unsupported engine"));
                }
                let mut profile = Profile {
                    id: id.clone(),
                    name: text(p, "name")?.into(),
                    engine: engine.into(),
                    automation: "off".into(),
                    identity: json!({"seed":Uuid::new_v4().to_string(),"locale":"en-CA","timezone":"America/Toronto"}),
                    created_at: now(),
                    updated_at: now(),
                    sync: false,
                };
                if m == "profiles.duplicate" {
                    let source = self.id(p)?;
                    profile.engine = self.state.profiles[source].engine.clone();
                }
                self.state.keys.insert(id.clone(), SecretKey(random(32)));
                self.state.profiles.insert(id.clone(), profile.clone());
                Ok(json!(profile))
            }
            "profiles.update" => {
                let id = self.id(p)?.to_string();
                let profile = self.state.profiles.get_mut(&id).unwrap();
                if let Some(name) = p.get("name") {
                    profile.name = text(&json!({"name":name}), "name")?.into();
                }
                if let Some(a) = p.get("automation").and_then(Value::as_str) {
                    if !["off", "selenium", "puppeteer"].contains(&a) {
                        return Err(err("INVALID_ARGUMENT", "Unsupported automation mode"));
                    }
                    profile.automation = a.into();
                }
                if let Some(s) = p.get("sync").and_then(Value::as_bool) {
                    profile.sync = s;
                }
                profile.updated_at = now();
                Ok(json!(profile))
            }
            "profiles.remove" => {
                let id = self.id(p)?.to_string();
                self.state.profiles.remove(&id);
                self.state.keys.remove(&id);
                self.state.heads.remove(&id);
                self.state.revisions.retain(|_, r| r.profile_id != id);
                Ok(json!({"removed":true}))
            }
            "profiles.snapshot" => self.snapshot(p),
            "revisions.list" => {
                let id = self.id(p)?;
                Ok(json!(
                    self.state
                        .revisions
                        .values()
                        .filter(|r| r.profile_id == id)
                        .collect::<Vec<_>>()
                ))
            }
            "revisions.restore" => self.restore(p),
            "settings.get" => Ok(json!({"preferences":self.state.preferences})),
            "settings.update" => {
                let pref = p
                    .get("preferences")
                    .ok_or_else(|| err("INVALID_ARGUMENT", "Missing preferences"))?;
                if !pref.is_object() {
                    return Err(err("INVALID_ARGUMENT", "Preferences must be an object"));
                }
                self.state.preferences = pref.clone();
                Ok(json!({"preferences":pref}))
            }
            "sync.configure" => {
                let folder = PathBuf::from(text(p, "folder")?);
                if !folder.is_absolute() {
                    return Err(err("UNSAFE_PATH", "Sync folder must be absolute"));
                }
                no_links(&folder)?;
                fs::create_dir_all(&folder)?;
                let folder = fs::canonicalize(folder)?;
                if folder.starts_with(&self.root) || self.root.starts_with(&folder) {
                    return Err(err(
                        "UNSAFE_PATH",
                        "Sync folder must be separate from vault",
                    ));
                }
                self.state.sync_folder = Some(folder);
                Ok(json!({"configured":true}))
            }
            "sync.push" => self.push(),
            "sync.pull" => self.pull(),
            "sync.conflicts" => Ok(json!(
                self.state
                    .heads
                    .iter()
                    .filter(|(_, h)| h.len() > 1)
                    .map(|(id, h)| json!({"profileId":id,"revisionIds":h}))
                    .collect::<Vec<_>>()
            )),
            "sync.resolve" => {
                let id = self.id(p)?.to_string();
                let chosen = text(p, "revisionId")?;
                let heads = self.state.heads.get(&id).cloned().unwrap_or_default();
                if !heads.iter().any(|x| x == chosen) {
                    return Err(err("NOT_FOUND", "Revision is not a conflict head"));
                }
                let mut r = self.state.revisions[chosen].clone();
                r.id = Uuid::new_v4().to_string();
                r.parents = heads;
                r.created_at = now();
                self.write_revision(&r)?;
                self.state.heads.insert(id, vec![r.id.clone()]);
                self.state.revisions.insert(r.id.clone(), r.clone());
                Ok(json!(r))
            }
            _ => Err(err("UNKNOWN_METHOD", "Unknown core method")),
        }
    }
    fn object(&self, id: &str) -> Result<PathBuf> {
        valid_id(id)?;
        Ok(self.root.join("objects").join(format!("{id}.enc")))
    }
    fn write_revision(&self, r: &Revision) -> Result<()> {
        let b = Zeroizing::new(serde_json::to_vec(r)?);
        atomic(
            &self.object(&r.id)?,
            &seal(self.key()?, &b, format!("revision:{}", r.id).as_bytes())?,
        )
    }
    fn snapshot(&mut self, p: &Value) -> Result<Value> {
        let id = self.id(p)?.to_string();
        if p.get("running").and_then(Value::as_bool) != Some(false) {
            return Err(err(
                "ENGINE_BARRIER_UNAVAILABLE",
                "A verified stopped engine is required; live snapshot barrier is unavailable",
            ));
        }
        let dir = self.root.join("active").join(&id);
        no_links(&dir)?;
        fs::create_dir_all(&dir)?;
        let _profile_lock = profile_lock(&dir)?;
        let mut files = BTreeMap::new();
        let mut queue = vec![dir.clone()];
        let mut directory_count = 1usize;
        let mut total = 0usize;
        while let Some(d) = queue.pop() {
            for entry in fs::read_dir(d)? {
                let entry = entry?;
                let path = entry.path();
                if ephemeral(&entry.file_name().to_string_lossy()) {
                    continue;
                }
                let meta = fs::symlink_metadata(&path)?;
                if meta.file_type().is_symlink() {
                    return Err(err("UNSAFE_PATH", "Snapshot contains a symbolic link"));
                }
                if meta.is_dir() {
                    directory_count += 1;
                    if directory_count > MAX_FILES {
                        return Err(err("LIMIT", "Too many directories"));
                    }
                    queue.push(path);
                    if queue.len() > MAX_FILES {
                        return Err(err("LIMIT", "Too many directories"));
                    }
                } else if meta.is_file() {
                    if files.len() >= MAX_FILES {
                        return Err(err("LIMIT", "Too many snapshot files"));
                    }
                    let bytes = Zeroizing::new(read(&path)?);
                    total = total
                        .checked_add(bytes.len())
                        .ok_or_else(|| err("LIMIT", "Snapshot too large"))?;
                    if total > MAX {
                        return Err(err("LIMIT", "Snapshot exceeds total size limit"));
                    }
                    let relative = path
                        .strip_prefix(&dir)
                        .map_err(|_| err("UNSAFE_PATH", "Invalid path"))?
                        .to_str()
                        .ok_or_else(|| err("UNSAFE_PATH", "Non UTF-8 filename"))?
                        .replace('\\', "/");
                    safe_relative(&relative)?;
                    let chunk = Uuid::new_v4().to_string();
                    atomic(
                        &self.object(&chunk)?,
                        &seal(
                            &self.state.keys[&id],
                            &bytes,
                            format!("chunk:{id}:{chunk}").as_bytes(),
                        )?,
                    )?;
                    files.insert(relative, chunk);
                } else {
                    return Err(err("UNSAFE_PATH", "Unsupported filesystem object"));
                }
            }
        }
        let r = Revision {
            id: Uuid::new_v4().to_string(),
            profile_id: id.clone(),
            parents: self.state.heads.get(&id).cloned().unwrap_or_default(),
            created_at: now(),
            files,
        };
        self.write_revision(&r)?;
        self.state.heads.insert(id, vec![r.id.clone()]);
        self.state.revisions.insert(r.id.clone(), r.clone());
        Ok(json!(r))
    }
    fn restore(&mut self, p: &Value) -> Result<Value> {
        let id = self.id(p)?.to_string();
        let rid = text(p, "revisionId")?;
        valid_id(rid)?;
        let r = self
            .state
            .revisions
            .get(rid)
            .filter(|r| r.profile_id == id)
            .cloned()
            .ok_or_else(|| err("NOT_FOUND", "Revision not found for profile"))?;
        let stage = self.root.join("staging").join(Uuid::new_v4().to_string());
        no_links(&stage)?;
        fs::create_dir_all(&stage)?;
        let mut total = 0;
        for (name, chunk) in &r.files {
            let rel = safe_relative(name)?;
            if rel
                .components()
                .any(|c| ephemeral(&c.as_os_str().to_string_lossy()))
            {
                return Err(err("INTEGRITY", "Revision contains ephemeral engine data"));
            }
            let bytes = open(
                &self.state.keys[&id],
                &read(&self.object(chunk)?)?,
                format!("chunk:{id}:{chunk}").as_bytes(),
            )?;
            total += bytes.len();
            if total > MAX {
                return Err(err("LIMIT", "Restore exceeds size limit"));
            }
            atomic(&stage.join(rel), &bytes)?;
        }
        let active = self.root.join("active").join(&id);
        no_links(&active)?;
        fs::create_dir_all(self.root.join("active"))?;
        fs::create_dir_all(&active)?;
        let profile_guard = profile_lock(&active)?;
        let transaction_id = Uuid::new_v4().to_string();
        let backup = self.root.join("staging").join(&transaction_id);
        let previous_metadata = read(&self.root.join("metadata.enc"))?;
        // Prepare every fallible encrypted object before moving the productive directory.
        let mut restored = r.clone();
        restored.id = Uuid::new_v4().to_string();
        restored.parents = self.state.heads.get(&id).cloned().unwrap_or_default();
        restored.created_at = now();
        self.write_revision(&restored)?;
        self.state
            .heads
            .insert(id.clone(), vec![restored.id.clone()]);
        self.state.revisions.insert(restored.id.clone(), restored);
        let next_metadata = seal(
            self.key()?,
            &Zeroizing::new(serde_json::to_vec(&self.state)?),
            b"metadata-v1",
        )?;
        let metadata_backup = self
            .root
            .join("staging")
            .join(format!("{transaction_id}.metadata"));
        atomic(&metadata_backup, &previous_metadata)?;
        let journal = RestoreJournal {
            profile: id.clone(),
            backup: transaction_id,
            staged: stage.file_name().unwrap().to_str().unwrap().into(),
        };
        atomic(
            &self.root.join("restore-journal.json"),
            &serde_json::to_vec(&journal)?,
        )?;
        // The engine lock is checked before preparation; Windows requires closing its file
        // handle before directory rename. The host must retain process ownership serialization.
        drop(profile_guard);
        let outcome = (|| -> Result<()> {
            fs::rename(&active, &backup)?;
            fs::rename(&stage, &active)?;
            #[cfg(test)]
            if self.restore_fault == Some("after-swap") {
                return Err(err("IO", "Injected publication failure"));
            }
            atomic(&self.root.join("metadata.enc"), &next_metadata)?;
            fs::remove_file(self.root.join("restore-journal.json"))?;
            Ok(())
        })();
        if let Err(original) = outcome {
            recover_restore(&self.root).map_err(|_|err("RECOVERY_REQUIRED", "Restore rollback is incomplete; reopen vault after resolving filesystem access"))?;
            return Err(original);
        }
        Ok(json!({"restored":true,"revisionId":rid,"previousDirectoryRetained":true}))
    }

    fn join(&mut self, p: &Value) -> Result<Value> {
        if self.root.join("vault.json").exists() || self.key.is_some() {
            return Err(err("EXISTS", "A new empty vault root is required to join"));
        }
        let folder = PathBuf::from(text(p, "folder")?);
        if !folder.is_absolute() {
            return Err(err("UNSAFE_PATH", "Sync folder must be absolute"));
        }
        no_links(&folder)?;
        let folder = fs::canonicalize(folder)?;
        if folder.starts_with(&self.root) || self.root.starts_with(&folder) {
            return Err(err(
                "UNSAFE_PATH",
                "Sync folder must be separate from vault",
            ));
        }
        let password = text(p, "password")?;
        let entries = fs::read_dir(&folder)?
            .take(MAX_FILES + 1)
            .collect::<std::io::Result<Vec<_>>>()?;
        if entries.len() > MAX_FILES {
            return Err(err("LIMIT", "Too many synchronization objects"));
        }
        let mut headers: Vec<_> = entries
            .into_iter()
            .filter(|e| e.path().extension().and_then(|x| x.to_str()) == Some("header"))
            .collect();
        headers.sort_by_key(|e| e.file_name());
        if headers.is_empty() {
            return Err(err(
                "INCOMPLETE_SYNC",
                "No published vault enrollment header",
            ));
        }
        if headers.len() > 64 {
            return Err(err("LIMIT", "Too many enrollment headers"));
        }
        let mut authenticated = None;
        for entry in headers {
            let path = entry.path();
            let publication = path
                .file_stem()
                .and_then(|x| x.to_str())
                .ok_or_else(|| err("INTEGRITY", "Invalid publication identity"))?;
            valid_id(publication)?;
            if !folder.join(format!("{publication}.manifest")).exists() {
                continue;
            }
            let bytes = read(&path)?;
            if bytes.len() > 4096 {
                return Err(err("LIMIT", "Enrollment header exceeds size limit"));
            }
            let header: Header = serde_json::from_slice(&bytes)?;
            if header.version != 1 || header.salt.len() != 16 || header.wrapped.len() != 72 {
                return Err(err("INTEGRITY", "Invalid enrollment header"));
            }
            let wrapping = derive(password, &header.salt)?;
            if let Ok(key) = open(&wrapping, &header.wrapped, b"vault-key-v1") {
                authenticated = Some((bytes, key));
                break;
            }
        }
        let (header, key) = authenticated.ok_or_else(|| {
            err(
                "AUTHENTICATION",
                "Password or published vault authentication failed",
            )
        })?;
        if key.len() != 32 {
            return Err(err("INTEGRITY", "Invalid vault key length"));
        }
        self.key = Some(key);
        self.state = State::default();
        self.state.sync_folder = Some(folder);
        let result = (|| {
            let pulled = self.pull()?;
            self.persist()?;
            atomic(&self.root.join("vault.json"), &header)?;
            Ok(
                json!({"joined":true,"locked":false,"profiles":self.state.profiles.len(),"sync":pulled}),
            )
        })();
        if result.is_err() {
            self.key = None;
            self.state = State::default();
        }
        result
    }
    fn sync_folder(&self) -> Result<PathBuf> {
        let p = self
            .state
            .sync_folder
            .clone()
            .ok_or_else(|| err("NOT_CONFIGURED", "Configure a synchronization folder first"))?;
        no_links(&p)?;
        Ok(p)
    }
    fn push(&self) -> Result<Value> {
        let folder = self.sync_folder()?;
        let mut exported = self.state.clone();
        exported.super_profiles.clear();
        exported.super_revisions.clear();
        exported.preferences = Value::Null;
        exported.sync_folder = None;
        exported.profiles.retain(|_, p| p.sync);
        let ids: BTreeSet<_> = exported.profiles.keys().cloned().collect();
        exported.keys.retain(|id, _| ids.contains(id));
        exported
            .revisions
            .retain(|_, r| ids.contains(&r.profile_id));
        exported.heads.retain(|id, _| ids.contains(id));
        let mut objects = BTreeSet::new();
        for r in exported.revisions.values() {
            objects.insert(r.id.clone());
            objects.extend(r.files.values().cloned());
        }
        for id in &objects {
            let bytes = read(&self.object(id)?)?;
            let dst = folder.join(format!("{id}.enc"));
            if dst.exists() {
                if read(&dst)? != bytes {
                    return Err(err("SYNC_COLLISION", "Immutable object collision"));
                }
            } else {
                atomic(&dst, &bytes)?;
            }
        }
        let manifest = Uuid::new_v4().to_string();
        let header = read(&self.root.join("vault.json"))?;
        if header.len() > 4096 {
            return Err(err("INTEGRITY", "Invalid vault header size"));
        }
        atomic(&folder.join(format!("{manifest}.header")), &header)?;
        atomic(
            &folder.join(format!("{manifest}.manifest")),
            &seal(
                self.key()?,
                &Zeroizing::new(serde_json::to_vec(&exported)?),
                b"sync-manifest-v1",
            )?,
        )?;
        Ok(json!({"published":true,"objects":objects.len(),"manifestId":manifest}))
    }
    fn pull(&mut self) -> Result<Value> {
        let folder = self.sync_folder()?;
        let mut imported = 0;
        let entries = fs::read_dir(&folder)?
            .take(MAX_FILES + 1)
            .collect::<std::io::Result<Vec<_>>>()?;
        if entries.len() > MAX_FILES {
            return Err(err("LIMIT", "Too many sync objects"));
        }
        for entry in entries {
            let path = entry.path();
            if path.extension().and_then(|s| s.to_str()) != Some("manifest") {
                continue;
            }
            let remote: State =
                serde_json::from_slice(&open(self.key()?, &read(&path)?, b"sync-manifest-v1")?)?;
            for (id, profile) in &remote.profiles {
                valid_id(id)?;
                if &profile.id != id {
                    return Err(err("INTEGRITY", "Profile identity mismatch"));
                }
                let key = remote
                    .keys
                    .get(id)
                    .filter(|k| k.len() == 32)
                    .ok_or_else(|| err("INTEGRITY", "Missing profile key"))?;
                if let Some(local) = self.state.keys.get(id) {
                    if local != key {
                        return Err(err("SYNC_CONFLICT", "Profile key mismatch"));
                    }
                }
            }
            for r in remote.revisions.values() {
                valid_id(&r.id)?;
                valid_id(&r.profile_id)?;
                if r.files.len() > MAX_FILES {
                    return Err(err("LIMIT", "Too many files"));
                }
                let key = remote
                    .keys
                    .get(&r.profile_id)
                    .ok_or_else(|| err("INTEGRITY", "Missing profile key"))?;
                let sealed = read(&folder.join(format!("{}.enc", r.id)))?;
                let verified: Revision = serde_json::from_slice(&open(
                    self.key()?,
                    &sealed,
                    format!("revision:{}", r.id).as_bytes(),
                )?)?;
                if serde_json::to_value(&verified)? != serde_json::to_value(r)? {
                    return Err(err("INTEGRITY", "Revision manifest mismatch"));
                }
                let mut total = 0;
                for (name, chunk) in &r.files {
                    safe_relative(name)?;
                    valid_id(chunk)?;
                    let bytes = read(&folder.join(format!("{chunk}.enc")))?;
                    let plain = open(
                        key,
                        &bytes,
                        format!("chunk:{}:{chunk}", r.profile_id).as_bytes(),
                    )?;
                    total += plain.len();
                    if total > MAX {
                        return Err(err("LIMIT", "Revision too large"));
                    }
                    let dst = self.object(chunk)?;
                    if dst.exists() && read(&dst)? != bytes {
                        return Err(err("SYNC_COLLISION", "Immutable chunk collision"));
                    }
                    if !dst.exists() {
                        atomic(&dst, &bytes)?;
                    }
                }
                for parent in &r.parents {
                    valid_id(parent)?;
                    if !remote.revisions.contains_key(parent)
                        && !self.state.revisions.contains_key(parent)
                    {
                        return Err(err("INCOMPLETE_SYNC", "Missing revision parent"));
                    }
                }
                let dst = self.object(&r.id)?;
                if dst.exists() && read(&dst)? != sealed {
                    return Err(err("SYNC_COLLISION", "Immutable revision collision"));
                }
                if !dst.exists() {
                    atomic(&dst, &sealed)?;
                }
                if let Some(local) = self.state.revisions.get(&r.id) {
                    if serde_json::to_value(local)? != serde_json::to_value(r)? {
                        return Err(err("SYNC_COLLISION", "Revision identity collision"));
                    }
                }
                self.state.revisions.insert(r.id.clone(), r.clone());
                imported += 1;
            }
            for (id, profile) in remote.profiles {
                self.state.profiles.entry(id.clone()).or_insert(profile);
                self.state
                    .keys
                    .entry(id.clone())
                    .or_insert_with(|| remote.keys[&id].clone());
            }
        }
        self.recompute_heads()?;
        Ok(
            json!({"imported":imported,"conflicts":self.state.heads.values().filter(|h|h.len()>1).count()}),
        )
    }
    fn recompute_heads(&mut self) -> Result<()> {
        let mut remaining: BTreeSet<String> = self.state.revisions.keys().cloned().collect();
        let mut visited = BTreeSet::new();
        while !remaining.is_empty() {
            let ready: Vec<String> = remaining
                .iter()
                .filter(|id| {
                    self.state.revisions[*id]
                        .parents
                        .iter()
                        .all(|p| visited.contains(p))
                })
                .cloned()
                .collect();
            if ready.is_empty() {
                return Err(err(
                    "INTEGRITY",
                    "Revision graph contains a cycle or missing parent",
                ));
            }
            for id in ready {
                remaining.remove(&id);
                visited.insert(id);
            }
        }
        let mut parents = BTreeSet::new();
        for r in self.state.revisions.values() {
            for parent in &r.parents {
                let pr = self
                    .state
                    .revisions
                    .get(parent)
                    .ok_or_else(|| err("INCOMPLETE_SYNC", "Missing parent"))?;
                if pr.profile_id != r.profile_id {
                    return Err(err("INTEGRITY", "Cross-profile parent"));
                }
                parents.insert(parent.clone());
            }
        }
        let mut heads: BTreeMap<String, Vec<String>> = BTreeMap::new();
        for r in self.state.revisions.values() {
            if !parents.contains(&r.id) {
                heads
                    .entry(r.profile_id.clone())
                    .or_default()
                    .push(r.id.clone());
            }
        }
        self.state.heads = heads;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    fn manager() -> (TempDir, Manager) {
        let t = TempDir::new().unwrap();
        let mut m = Manager::new(t.path().join("vault")).unwrap();
        m.execute("vault.create", json!({"password":"test password"}))
            .unwrap();
        (t, m)
    }
    fn profile(m: &mut Manager) -> String {
        m.execute("profiles.create", json!({"name":"Synthetic profile"}))
            .unwrap()["id"]
            .as_str()
            .unwrap()
            .into()
    }
    fn snapshot(m: &mut Manager, id: &str, value: &str) -> Value {
        let active = m.root.join("active").join(id);
        fs::create_dir_all(&active).unwrap();
        fs::write(active.join("sample.txt"), value).unwrap();
        m.execute("profiles.snapshot", json!({"id":id,"running":false}))
            .unwrap()
    }
    #[test]
    fn browser_key_is_profile_scoped_and_never_a_json_export() {
        let (_t, mut m) = manager();
        let id = profile(&mut m);
        let other = profile(&mut m);
        let key = m.with_browser_key(&id, |key| Zeroizing::new(*key)).unwrap();
        assert!(
            m.with_browser_key(&other, |other| key.as_slice() != other)
                .unwrap()
        );
        assert_ne!(key.as_slice(), m.state.keys[&id].as_ref());
        let metadata = read(&m.root.join("metadata.enc")).unwrap();
        assert!(!metadata.windows(32).any(|window| window == key.as_slice()));
        let public = m.execute("profiles.list", json!({})).unwrap();
        assert!(!format!("{public:?}").contains(&format!("{:?}", key.as_slice())));
        assert_eq!(
            m.with_browser_key(&Uuid::new_v4().to_string(), |_| ())
                .unwrap_err()
                .code,
            "NOT_FOUND"
        );
        assert!(m.execute("profiles.browserKey", json!({"id":id})).is_err());
        m.execute("vault.lock", json!({})).unwrap();
        let mut invoked = false;
        let error = m.with_browser_key(&id, |_| invoked = true).unwrap_err();
        assert_eq!(error.code, "LOCKED");
        assert!(!invoked);
        assert!(!format!("{error:?}").contains(&format!("{:?}", key.as_slice())));
    }

    #[test]
    fn browser_key_survives_encrypted_join_and_password_rewrap() {
        let (t, mut source) = manager();
        let id = profile(&mut source);
        source
            .execute("profiles.update", json!({"id":id,"sync":true}))
            .unwrap();
        let expected = source
            .with_browser_key(&id, |key| Zeroizing::new(*key))
            .unwrap();
        let shared = t.path().join("browser-key-transport");
        source
            .execute("sync.configure", json!({"folder":shared}))
            .unwrap();
        source.execute("sync.push", json!({})).unwrap();
        let mut target = Manager::new(t.path().join("browser-key-peer")).unwrap();
        target
            .execute(
                "vault.join",
                json!({"folder":shared,"password":"test password"}),
            )
            .unwrap();
        assert!(
            target
                .with_browser_key(&id, |key| expected.as_slice() == key)
                .unwrap()
        );
        target
            .execute(
                "vault.changePassword",
                json!({"oldPassword":"test password","newPassword":"replacement"}),
            )
            .unwrap();
        target.execute("vault.lock", json!({})).unwrap();
        target
            .execute("vault.unlock", json!({"password":"replacement"}))
            .unwrap();
        assert!(
            target
                .with_browser_key(&id, |key| expected.as_slice() == key)
                .unwrap()
        );
    }
    #[test]
    fn exclusive_lock_cross_root_and_cycle_validation() {
        let (t, mut a) = manager();
        assert_eq!(Manager::new(a.root.clone()).err().unwrap().code, "BUSY");
        let id = profile(&mut a);
        let revision = snapshot(&mut a, &id, "original");
        let mut unrelated = Manager::new(t.path().join("unrelated")).unwrap();
        unrelated
            .execute("vault.create", json!({"password":"same password"}))
            .unwrap();
        assert!(
            open(
                unrelated.key().unwrap(),
                &read(&a.object(revision["id"].as_str().unwrap()).unwrap()).unwrap(),
                format!("revision:{}", revision["id"].as_str().unwrap()).as_bytes()
            )
            .is_err()
        );
        let rid = revision["id"].as_str().unwrap().to_string();
        a.state.revisions.get_mut(&rid).unwrap().parents = vec![rid.clone()];
        assert_eq!(a.recompute_heads().unwrap_err().code, "INTEGRITY");
    }
    #[test]
    fn join_authenticates_and_restores_on_new_root_without_manual_copy() {
        let (t, mut source) = manager();
        let id = profile(&mut source);
        source
            .execute("profiles.update", json!({"id":id,"sync":true}))
            .unwrap();
        source
            .execute(
                "settings.update",
                json!({"preferences":{"privateSetting":"local only"}}),
            )
            .unwrap();
        let revision = snapshot(&mut source, &id, "portable synthetic data");
        let shared = t.path().join("transport");
        source
            .execute("sync.configure", json!({"folder":shared}))
            .unwrap();
        source.execute("sync.push", json!({})).unwrap();
        let target_root = t.path().join("new-computer");
        let mut target = Manager::new(target_root.clone()).unwrap();
        assert_eq!(
            target
                .execute("vault.join", json!({"folder":shared,"password":"wrong"}))
                .unwrap_err()
                .code,
            "AUTHENTICATION"
        );
        assert!(!target_root.join("vault.json").exists());
        let chunk = revision["files"]["sample.txt"].as_str().unwrap();
        let chunk_path = shared.join(format!("{chunk}.enc"));
        let saved = fs::read(&chunk_path).unwrap();
        fs::remove_file(&chunk_path).unwrap();
        assert!(
            target
                .execute(
                    "vault.join",
                    json!({"folder":shared,"password":"test password"})
                )
                .is_err()
        );
        assert!(!target_root.join("vault.json").exists());
        fs::write(chunk_path, saved).unwrap();
        target
            .execute(
                "vault.join",
                json!({"folder":shared,"password":"test password"}),
            )
            .unwrap();
        assert_eq!(
            target.execute("profiles.list", json!({})).unwrap()[0]["id"],
            id
        );
        assert!(target.execute("settings.get", json!({})).unwrap()["preferences"].is_null());
        target
            .execute(
                "revisions.restore",
                json!({"id":id,"revisionId":revision["id"]}),
            )
            .unwrap();
        assert_eq!(
            fs::read_to_string(target_root.join("active").join(&id).join("sample.txt")).unwrap(),
            "portable synthetic data"
        );
        target.execute("vault.lock", json!({})).unwrap();
        target
            .execute("vault.unlock", json!({"password":"test password"}))
            .unwrap();
        assert_eq!(
            target
                .execute("profiles.list", json!({}))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            1
        );
    }
    #[test]
    fn restore_failure_keeps_active_metadata_and_memory() {
        let (_t, mut m) = manager();
        let id = profile(&mut m);
        let a = snapshot(&mut m, &id, "A");
        snapshot(&mut m, &id, "B");
        let metadata = m.root.join("metadata.enc");
        let saved = m.root.join("metadata.saved");
        let before = fs::read(&metadata).unwrap();
        let heads = m.state.heads.clone();
        fs::rename(&metadata, &saved).unwrap();
        fs::create_dir(&metadata).unwrap();
        assert_eq!(
            m.execute("revisions.restore", json!({"id":id,"revisionId":a["id"]}))
                .unwrap_err()
                .code,
            "IO"
        );
        assert_eq!(
            fs::read_to_string(m.root.join("active").join(&id).join("sample.txt")).unwrap(),
            "B"
        );
        assert_eq!(m.state.heads, heads);
        fs::remove_dir(&metadata).unwrap();
        fs::rename(saved, &metadata).unwrap();
        m.restore_fault = Some("after-swap");
        assert_eq!(
            m.execute("revisions.restore", json!({"id":id,"revisionId":a["id"]}))
                .unwrap_err()
                .code,
            "IO"
        );
        assert_eq!(
            fs::read_to_string(m.root.join("active").join(&id).join("sample.txt")).unwrap(),
            "B"
        );
        assert_eq!(fs::read(metadata).unwrap(), before);
        assert_eq!(m.state.heads, heads);
        assert!(!m.root.join("restore-journal.json").exists());
    }

    #[test]
    fn interrupted_restore_recovers_prepared_swapped_and_published_phases() {
        for phase in ["prepared", "swapped", "published"] {
            let (_t, mut m) = manager();
            let id = profile(&mut m);
            snapshot(&mut m, &id, "B");
            let root = m.root.clone();
            let old_metadata = fs::read(root.join("metadata.enc")).unwrap();
            let heads = m.state.heads.clone();
            let backup = Uuid::new_v4().to_string();
            let staged = Uuid::new_v4().to_string();
            fs::create_dir_all(root.join("staging").join(&staged)).unwrap();
            fs::write(root.join("staging").join(&staged).join("sample.txt"), "A").unwrap();
            atomic(
                &root.join("staging").join(format!("{backup}.metadata")),
                &old_metadata,
            )
            .unwrap();
            atomic(
                &root.join("restore-journal.json"),
                &serde_json::to_vec(&RestoreJournal {
                    profile: id.clone(),
                    backup: backup.clone(),
                    staged: staged.clone(),
                })
                .unwrap(),
            )
            .unwrap();
            if phase != "prepared" {
                fs::rename(
                    root.join("active").join(&id),
                    root.join("staging").join(&backup),
                )
                .unwrap();
                fs::rename(
                    root.join("staging").join(&staged),
                    root.join("active").join(&id),
                )
                .unwrap();
            }
            if phase == "published" {
                m.state.preferences = json!({"interrupted":true});
                m.persist().unwrap();
            }
            drop(m);
            let mut recovered = Manager::new(root.clone()).unwrap();
            assert_eq!(
                fs::read_to_string(root.join("active").join(&id).join("sample.txt")).unwrap(),
                "B",
                "{phase}"
            );
            assert_eq!(
                fs::read(root.join("metadata.enc")).unwrap(),
                old_metadata,
                "{phase}"
            );
            recovered
                .execute("vault.unlock", json!({"password":"test password"}))
                .unwrap();
            assert_eq!(recovered.state.heads, heads);
            assert!(!root.join("restore-journal.json").exists());
        }
    }

    #[test]
    fn engine_lock_and_ephemeral_files_and_typed_parameters() {
        let (_t, mut m) = manager();
        let id = profile(&mut m);
        for bad in [
            json!({"id":id,"automation":true}),
            json!({"id":id,"sync":"yes"}),
        ] {
            assert_eq!(
                m.execute("profiles.update", bad).unwrap_err().code,
                "INVALID_ARGUMENT"
            );
        }
        assert_eq!(
            m.execute("profiles.create", json!({"name":"bad","engine":123}))
                .unwrap_err()
                .code,
            "INVALID_ARGUMENT"
        );
        let r = snapshot(&mut m, &id, "B");
        let active = m.root.join("active").join(&id);
        for name in ["DevToolsActivePort", "SingletonCookie", "parent.lock"] {
            fs::write(active.join(name), "ephemeral").unwrap();
        }
        let lock = profile_lock(&active).unwrap();
        assert_eq!(
            m.execute("profiles.snapshot", json!({"id":id,"running":false}))
                .unwrap_err()
                .code,
            "PROFILE_RUNNING"
        );
        assert_eq!(
            m.execute("revisions.restore", json!({"id":id,"revisionId":r["id"]}))
                .unwrap_err()
                .code,
            "PROFILE_RUNNING"
        );
        drop(lock);
        let clean = m
            .execute("profiles.snapshot", json!({"id":id,"running":false}))
            .unwrap();
        assert_eq!(clean["files"].as_object().unwrap().len(), 1);
        assert!(clean["files"].get("sample.txt").is_some());
    }

    #[test]
    fn password_lock_change_and_persistence() {
        let (_t, mut m) = manager();
        let id = profile(&mut m);
        assert_eq!(
            m.execute("profiles.list", json!({})).unwrap()[0]["automation"],
            "off"
        );
        m.execute(
            "vault.changePassword",
            json!({"oldPassword":"test password","newPassword":"replacement"}),
        )
        .unwrap();
        m.execute("vault.lock", json!({})).unwrap();
        assert_eq!(
            m.execute("profiles.list", json!({})).unwrap_err().code,
            "LOCKED"
        );
        assert_eq!(
            m.execute("vault.unlock", json!({"password":"test password"}))
                .unwrap_err()
                .code,
            "AUTHENTICATION"
        );
        m.execute("vault.unlock", json!({"password":"replacement"}))
            .unwrap();
        assert_eq!(m.execute("profiles.list", json!({})).unwrap()[0]["id"], id);
    }
    #[test]
    fn snapshots_restore_and_tampering() {
        let (_t, mut m) = manager();
        let id = profile(&mut m);
        let first = snapshot(&mut m, &id, "first");
        snapshot(&mut m, &id, "second");
        m.execute(
            "revisions.restore",
            json!({"id":id,"revisionId":first["id"]}),
        )
        .unwrap();
        assert_eq!(
            fs::read_to_string(m.root.join("active").join(&id).join("sample.txt")).unwrap(),
            "first"
        );
        let chunk = first["files"]["sample.txt"].as_str().unwrap();
        let path = m.object(chunk).unwrap();
        let mut b = read(&path).unwrap();
        b[30] ^= 1;
        fs::write(path, b).unwrap();
        assert_eq!(
            m.execute(
                "revisions.restore",
                json!({"id":id,"revisionId":first["id"]})
            )
            .unwrap_err()
            .code,
            "INTEGRITY"
        );
        assert_eq!(
            fs::read_to_string(m.root.join("active").join(id).join("sample.txt")).unwrap(),
            "first"
        );
    }
    #[test]
    fn snapshot_requires_stopped_and_rejects_cross_profile() {
        let (_t, mut m) = manager();
        let a = profile(&mut m);
        let b = profile(&mut m);
        assert_eq!(
            m.execute("profiles.snapshot", json!({"id":a}))
                .unwrap_err()
                .code,
            "ENGINE_BARRIER_UNAVAILABLE"
        );
        let r = snapshot(&mut m, &a, "a");
        assert_eq!(
            m.execute("revisions.restore", json!({"id":b,"revisionId":r["id"]}))
                .unwrap_err()
                .code,
            "NOT_FOUND"
        );
        assert!(safe_relative("../escape").is_err());
        assert!(safe_relative("C:/escape").is_err());
        assert!(safe_relative("a\\b").is_err());
    }
    #[test]
    fn sync_preserves_concurrent_revisions_and_checks_completeness() {
        let (t, mut a) = manager();
        let id = profile(&mut a);
        a.execute("profiles.update", json!({"id":id,"sync":true}))
            .unwrap();
        let first = snapshot(&mut a, &id, "base");
        let other = t.path().join("other");
        fs::create_dir_all(&other).unwrap();
        fs::copy(a.root.join("vault.json"), other.join("vault.json")).unwrap();
        fs::copy(a.root.join("metadata.enc"), other.join("metadata.enc")).unwrap();
        fs::create_dir_all(other.join("objects")).unwrap();
        for e in fs::read_dir(a.root.join("objects")).unwrap() {
            let e = e.unwrap();
            fs::copy(e.path(), other.join("objects").join(e.file_name())).unwrap();
        }
        let mut b = Manager::new(other).unwrap();
        b.execute("vault.unlock", json!({"password":"test password"}))
            .unwrap();
        let shared = t.path().join("shared");
        for m in [&mut a, &mut b] {
            m.execute("sync.configure", json!({"folder":shared}))
                .unwrap();
        }
        snapshot(&mut a, &id, "a");
        snapshot(&mut b, &id, "b");
        a.execute("sync.push", json!({})).unwrap();
        b.execute("sync.push", json!({})).unwrap();
        b.execute("sync.pull", json!({})).unwrap();
        let conflicts = b.execute("sync.conflicts", json!({})).unwrap();
        assert_eq!(conflicts[0]["revisionIds"].as_array().unwrap().len(), 2);
        let chosen = conflicts[0]["revisionIds"][0].clone();
        b.execute("sync.resolve", json!({"id":id,"revisionId":chosen}))
            .unwrap();
        assert!(
            b.execute("sync.conflicts", json!({}))
                .unwrap()
                .as_array()
                .unwrap()
                .is_empty()
        );
        let chunk = first["files"]["sample.txt"].as_str().unwrap();
        fs::remove_file(shared.join(format!("{chunk}.enc"))).unwrap();
        assert!(a.execute("sync.pull", json!({})).is_err());
    }
    #[test]
    fn ciphertext_hides_metadata_and_rejects_wrong_key() {
        let (_t, mut m) = manager();
        profile(&mut m);
        let data = read(&m.root.join("metadata.enc")).unwrap();
        assert!(!String::from_utf8_lossy(&data).contains("Synthetic profile"));
        assert!(open(&random(32), &data, b"metadata-v1").is_err());
        let n = MAX + 41;
        assert!(open(&random(32), &vec![0; n], b"x").is_err());
    }
}

impl Drop for Manager {
    fn drop(&mut self) {
        for key in self.state.keys.values_mut() {
            key.0.zeroize();
        }
        self.key = None;
    }
}

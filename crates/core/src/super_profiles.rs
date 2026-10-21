//! Encrypted reusable environment templates and immutable archive revisions.
use super::*;
const CHUNK: usize = 4 * 1024 * 1024;
const MAX_ARCHIVE: u64 = 32 * 1024 * 1024 * 1024;
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SuperProfile {
    id: String,
    name: String,
    engine: String,
    settings: Value,
    revision_id: String,
    created_at: u64,
    updated_at: u64,
}
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct SuperRevision {
    id: String,
    super_profile_id: String,
    parent_id: Option<String>,
    created_at: u64,
    name: String,
    engine: String,
    settings: Value,
    #[serde(default)]
    chunks: Vec<String>,
    #[serde(default)]
    archive_bytes: u64,
}
fn validate(settings: &Value) -> Result<()> {
    if !settings.is_object() || serde_json::to_vec(settings)?.len() > 256 * 1024 {
        return Err(err("INVALID_ARGUMENT", "Settings must be a bounded object"));
    }
    if let Some(document) = settings.get("portableBookmarks") {
        crate::portable_bookmarks::validate(document)?;
    }
    if let Some(configurations) = settings.get("configurations") {
        let configurations = configurations
            .as_object()
            .ok_or_else(|| err("INVALID_ARGUMENT", "Invalid backend configurations"))?;
        for (backend, configuration) in configurations {
            if !matches!(backend.as_str(), "wsl2" | "windows-sandbox") || !configuration.is_object()
            {
                return Err(err("INVALID_ARGUMENT", "Invalid backend configuration"));
            }
            if let Some(document) = configuration.get("portableBookmarks") {
                crate::portable_bookmarks::validate(document)?;
            }
        }
    }
    if !matches!(
        settings.get("backend").and_then(Value::as_str),
        Some("wsl2" | "windows-sandbox")
    ) {
        return Err(err("INVALID_ARGUMENT", "Unsupported environment backend"));
    }
    if settings
        .get("launchMode")
        .is_some_and(|v| !matches!(v.as_str(), Some("terminal" | "browser" | "desktop")))
    {
        return Err(err("INVALID_ARGUMENT", "Unsupported launch mode"));
    }
    if settings.get("rootfsPath").is_some_and(|v| {
        v.as_str()
            .is_none_or(|s| s.is_empty() || s.len() > 4096 || s.contains('\0'))
    }) {
        return Err(err(
            "INVALID_ARGUMENT",
            "Invalid root filesystem configuration",
        ));
    }
    Ok(())
}
fn archive_compatible(profile: &SuperProfile, revision: &SuperRevision) -> bool {
    fn rootfs(settings: &Value) -> Option<(&str, Option<&str>)> {
        settings
            .get("rootfsPath")
            .and_then(Value::as_str)
            .filter(|path| !path.is_empty())
            .map(|path| (path, settings.get("rootfsSha256").and_then(Value::as_str)))
    }
    profile.engine == revision.engine
        && profile.settings.get("backend") == revision.settings.get("backend")
        && rootfs(&profile.settings) == rootfs(&revision.settings)
}
impl Manager {
    fn super_id(&self, p: &Value) -> Result<String> {
        let id = text(p, "id")?;
        valid_id(id)?;
        if !self.state.super_profiles.contains_key(id) {
            return Err(err("NOT_FOUND", "Super profile not found"));
        }
        Ok(id.into())
    }
    fn super_expected(&self, id: &str, expected: &str) -> Result<()> {
        if self
            .state
            .super_profiles
            .get(id)
            .ok_or_else(|| err("NOT_FOUND", "Super profile not found"))?
            .revision_id
            != expected
        {
            return Err(err(
                "REVISION_CONFLICT",
                "Super profile changed; reload before saving",
            ));
        }
        Ok(())
    }
    fn previous_compatible_archive(
        &self,
        profile: &SuperProfile,
        start: &str,
    ) -> Result<Option<SuperRevision>> {
        let mut current = Some(start);
        let mut visited = BTreeSet::new();
        while let Some(id) = current {
            if !visited.insert(id) {
                return Err(err(
                    "INTEGRITY",
                    "Template revision history contains a cycle",
                ));
            }
            let revision = self
                .state
                .super_revisions
                .get(id)
                .ok_or_else(|| err("INTEGRITY", "Missing template revision ancestor"))?;
            if revision.super_profile_id != profile.id {
                return Err(err(
                    "INTEGRITY",
                    "Template revision history crosses template boundary",
                ));
            }
            if archive_compatible(profile, revision) && !revision.chunks.is_empty() {
                return Ok(Some(revision.clone()));
            }
            current = revision.parent_id.as_deref();
        }
        Ok(None)
    }
    fn super_revision(
        &mut self,
        mut profile: SuperProfile,
        chunks: Vec<String>,
        archive_bytes: u64,
    ) -> Result<Value> {
        validate(&profile.settings)?;
        if !["chromium", "firefox"].contains(&profile.engine.as_str()) {
            return Err(err("INVALID_ARGUMENT", "Unsupported engine"));
        }
        let id = Uuid::new_v4().to_string();
        let revision = SuperRevision {
            id: id.clone(),
            super_profile_id: profile.id.clone(),
            parent_id: (!profile.revision_id.is_empty()).then(|| profile.revision_id.clone()),
            created_at: now(),
            name: profile.name.clone(),
            engine: profile.engine.clone(),
            settings: profile.settings.clone(),
            chunks,
            archive_bytes,
        };
        profile.revision_id = id.clone();
        profile.updated_at = now();
        self.state.super_revisions.insert(id, revision);
        self.state
            .super_profiles
            .insert(profile.id.clone(), profile.clone());
        Ok(json!(profile))
    }
    pub(crate) fn dispatch_super_profiles(&mut self, method: &str, p: &Value) -> Result<Value> {
        match method {
            "superProfiles.list" => Ok(json!(
                self.state.super_profiles.values().collect::<Vec<_>>()
            )),
            "superProfiles.create" => {
                let profile = SuperProfile {
                    id: Uuid::new_v4().to_string(),
                    name: text(p, "name")?.trim().into(),
                    engine: p
                        .get("engine")
                        .and_then(Value::as_str)
                        .unwrap_or("chromium")
                        .into(),
                    settings: p
                        .get("settings")
                        .cloned()
                        .ok_or_else(|| err("INVALID_ARGUMENT", "Missing settings"))?,
                    revision_id: String::new(),
                    created_at: now(),
                    updated_at: now(),
                };
                if profile.name.is_empty() {
                    return Err(err("INVALID_ARGUMENT", "Name cannot be blank"));
                }
                self.super_revision(profile, Vec::new(), 0)
            }
            "superProfiles.update"
            | "superProfiles.duplicate"
            | "superProfiles.revisions.restore" => {
                let id = self.super_id(p)?;
                let mut profile = self.state.super_profiles[&id].clone();
                let mut source = self
                    .state
                    .super_revisions
                    .get(&profile.revision_id)
                    .cloned()
                    .ok_or_else(|| err("INTEGRITY", "Missing template revision"))?;
                if method != "superProfiles.duplicate" {
                    self.super_expected(&id, text(p, "expectedRevisionId")?)?;
                }
                if method == "superProfiles.revisions.restore" {
                    source = self
                        .state
                        .super_revisions
                        .get(text(p, "revisionId")?)
                        .filter(|r| r.super_profile_id == id)
                        .cloned()
                        .ok_or_else(|| err("NOT_FOUND", "Revision not found"))?;
                    profile.name = source.name.clone();
                    profile.engine = source.engine.clone();
                    profile.settings = source.settings.clone();
                } else {
                    if let Some(name) = p.get("name") {
                        profile.name = text(&json!({"name":name}), "name")?.trim().into();
                    }
                    if profile.name.is_empty() {
                        return Err(err("INVALID_ARGUMENT", "Name cannot be blank"));
                    }
                    if let Some(engine) = p.get("engine") {
                        profile.engine = engine
                            .as_str()
                            .ok_or_else(|| err("INVALID_ARGUMENT", "Invalid engine"))?
                            .into();
                    }
                    if let Some(settings) = p.get("settings") {
                        profile.settings = settings.clone();
                    }
                    if method == "superProfiles.duplicate" {
                        profile.id = Uuid::new_v4().to_string();
                        profile.revision_id.clear();
                        profile.created_at = now();
                    }
                }
                let archive = if archive_compatible(&profile, &source) {
                    Some(source)
                } else if method == "superProfiles.update" {
                    self.previous_compatible_archive(&profile, &source.id)?
                } else {
                    None
                };
                let (chunks, bytes) = archive
                    .map(|revision| (revision.chunks, revision.archive_bytes))
                    .unwrap_or_default();
                self.super_revision(profile, chunks, bytes)
            }
            "superProfiles.remove" => {
                let id = self.super_id(p)?;
                self.super_expected(&id, text(p, "expectedRevisionId")?)?;
                self.state.super_profiles.remove(&id);
                self.state
                    .super_revisions
                    .retain(|_, r| r.super_profile_id != id);
                Ok(json!({"removed":true}))
            }
            "superProfiles.revisions.list" => {
                let id = self.super_id(p)?;
                Ok(json!(self.state.super_revisions.values().filter(|r|r.super_profile_id==id).map(|r|json!({"id":r.id,"superProfileId":r.super_profile_id,"parentId":r.parent_id,"createdAt":r.created_at,"name":r.name,"engine":r.engine,"settings":r.settings,"archiveBytes":r.archive_bytes})).collect::<Vec<_>>()))
            }
            _ => Err(err("UNKNOWN_METHOD", "Unknown super profile method")),
        }
    }
    /// Host-only archive export. The host supplies an owned staging destination.
    pub fn export_super_profile_state(&self, id: &str, destination: &Path) -> Result<()> {
        self.key()?;
        valid_id(id)?;
        let p = self
            .state
            .super_profiles
            .get(id)
            .ok_or_else(|| err("NOT_FOUND", "Super profile not found"))?;
        let r = self
            .state
            .super_revisions
            .get(&p.revision_id)
            .ok_or_else(|| err("INTEGRITY", "Missing template revision"))?;
        if r.chunks.is_empty() {
            return Err(err("NOT_FOUND", "Template has no saved environment"));
        }
        no_links(destination)?;
        let mut out = OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(destination)?;
        let result = (|| {
            let mut total = 0u64;
            for chunk in &r.chunks {
                valid_id(chunk)?;
                let plain = open(
                    self.key()?,
                    &read(&self.object(chunk)?)?,
                    format!("super-archive:{chunk}").as_bytes(),
                )?;
                if plain.len() > CHUNK {
                    return Err(err("INTEGRITY", "Invalid archive chunk"));
                }
                total += plain.len() as u64;
                if total > r.archive_bytes {
                    return Err(err("INTEGRITY", "Archive length mismatch"));
                }
                out.write_all(&plain)?;
            }
            if total != r.archive_bytes {
                return Err(err("INTEGRITY", "Archive length mismatch"));
            }
            out.sync_all()?;
            Ok(())
        })();
        drop(out);
        if result.is_err() {
            let _ = fs::remove_file(destination);
        }
        result
    }
    /// Host-only archive import, after independently stopping the owned environment.
    pub fn import_super_profile_state(
        &mut self,
        id: &str,
        expected_revision_id: &str,
        source: &Path,
    ) -> Result<Value> {
        self.key()?;
        valid_id(id)?;
        self.super_expected(id, expected_revision_id)?;
        no_links(source)?;
        let mut input = fs::File::open(source)?;
        let meta = input.metadata()?;
        if !meta.is_file() || meta.len() == 0 || meta.len() > MAX_ARCHIVE {
            return Err(err(
                "LIMIT",
                "Environment archive must contain 1 byte to 32 GiB",
            ));
        }
        let before = self.state.clone();
        let mut chunks = Vec::new();
        let mut total = 0u64;
        loop {
            let mut buffer = Zeroizing::new(vec![0u8; CHUNK]);
            let mut size = 0;
            while size < CHUNK {
                let n = input.read(&mut buffer[size..])?;
                if n == 0 {
                    break;
                }
                size += n;
            }
            if size == 0 {
                break;
            }
            total += size as u64;
            if total > MAX_ARCHIVE {
                return Err(err("LIMIT", "Environment archive exceeds limit"));
            }
            let chunk = Uuid::new_v4().to_string();
            atomic(
                &self.object(&chunk)?,
                &seal(
                    self.key()?,
                    &buffer[..size],
                    format!("super-archive:{chunk}").as_bytes(),
                )?,
            )?;
            chunks.push(chunk);
        }
        if total != meta.len() {
            return Err(err("INTEGRITY", "Archive changed during import"));
        }
        let profile = self.state.super_profiles[id].clone();
        let result = self.super_revision(profile, chunks, total).and_then(|v| {
            self.persist()?;
            Ok(v)
        });
        if result.is_err() {
            self.state = before;
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;
    fn manager() -> (TempDir, Manager) {
        let root = TempDir::new().unwrap();
        let mut m = Manager::new(root.path().join("vault")).unwrap();
        m.execute("vault.create", json!({"password":"test password"}))
            .unwrap();
        (root, m)
    }
    fn create(m: &mut Manager) -> Value {
        m.execute(
            "superProfiles.create",
            json!({"name":"Development","settings":{"backend":"wsl2","launchMode":"terminal"}}),
        )
        .unwrap()
    }
    #[test]
    fn portable_bookmarks_are_encrypted_separate_and_revision_restorable() {
        let (root, mut m) = manager();
        let document = |name: &str| json!({"version":1,"folderName":name,"bookmarks":[{"name":"Portable fixture","url":"https://portable-fixture.invalid/private-path"}]});
        let settings = json!({"backend":"wsl2","portableBookmarks":document("Linux import"),"configurations":{"wsl2":{"portableBookmarks":document("Linux import")},"windows-sandbox":{"portableBookmarks":document("Sandbox import")}}});
        let first = m
            .execute(
                "superProfiles.create",
                json!({"name":"Portable","settings":settings}),
            )
            .unwrap();
        let id = first["id"].as_str().unwrap();
        let original = first["revisionId"].as_str().unwrap();
        let mut changed = settings.clone();
        changed["portableBookmarks"] = document("Changed import");
        let second = m
            .execute(
                "superProfiles.update",
                json!({"id":id,"expectedRevisionId":original,"settings":changed}),
            )
            .unwrap();
        assert_eq!(
            second["settings"]["configurations"]["windows-sandbox"]["portableBookmarks"]["folderName"],
            "Sandbox import"
        );
        let restored = m
            .execute(
                "superProfiles.revisions.restore",
                json!({"id":id,"revisionId":original,"expectedRevisionId":second["revisionId"]}),
            )
            .unwrap();
        assert_eq!(restored["settings"], settings);
        let mut invalid = settings.clone();
        invalid["configurations"]["windows-sandbox"]["portableBookmarks"]["bookmarks"][0]["url"] =
            json!("file:///private");
        assert_eq!(
            m.execute(
                "superProfiles.update",
                json!({"id":id,"expectedRevisionId":restored["revisionId"],"settings":invalid})
            )
            .unwrap_err()
            .code,
            "INVALID_BOOKMARKS"
        );
        m.execute("vault.lock", json!({})).unwrap();
        fn check(path: &Path) {
            for entry in fs::read_dir(path).unwrap() {
                let path = entry.unwrap().path();
                if path.is_dir() {
                    check(&path);
                } else {
                    let bytes = fs::read(path).unwrap();
                    assert!(
                        !bytes
                            .windows(b"portable-fixture.invalid".len())
                            .any(|w| w == b"portable-fixture.invalid")
                    );
                }
            }
        }
        check(root.path());
        m.execute("vault.unlock", json!({"password":"test password"}))
            .unwrap();
        let listed = m.execute("superProfiles.list", json!({})).unwrap();
        assert_eq!(listed[0]["settings"], settings);
        let current = listed[0]["revisionId"].clone();
        m.state.super_revisions.get_mut(original).unwrap().settings["portableBookmarks"]["version"] =
            json!(2);
        assert_eq!(
            m.execute(
                "superProfiles.revisions.restore",
                json!({"id":id,"expectedRevisionId":current,"revisionId":original})
            )
            .unwrap_err()
            .code,
            "INVALID_BOOKMARKS"
        );
        let mut oversized = settings.clone();
        oversized["unrelated"] = json!("x".repeat(256 * 1024));
        assert_eq!(
            m.execute(
                "superProfiles.update",
                json!({"id":id,"expectedRevisionId":current,"settings":oversized})
            )
            .unwrap_err()
            .code,
            "INVALID_ARGUMENT"
        );
    }
    #[test]
    fn old_metadata_defaults_and_locked_commands() {
        let (_, mut m) = manager();
        let mut old = serde_json::to_value(&m.state).unwrap();
        old.as_object_mut().unwrap().remove("super_profiles");
        old.as_object_mut().unwrap().remove("super_revisions");
        let old: State = serde_json::from_value(old).unwrap();
        assert!(old.super_profiles.is_empty());
        m.execute("vault.lock", json!({})).unwrap();
        assert_eq!(
            m.execute("superProfiles.list", json!({})).unwrap_err().code,
            "LOCKED"
        );
    }
    #[test]
    fn revision_conflicts_validation_and_immutable_restore() {
        let (_root, mut m) = manager();
        let first = create(&mut m);
        let id = first["id"].as_str().unwrap();
        let rev = first["revisionId"].as_str().unwrap();
        assert_eq!(
            m.execute(
                "superProfiles.update",
                json!({"id":id,"expectedRevisionId":rev,"settings":{"backend":"invalid"}})
            )
            .unwrap_err()
            .code,
            "INVALID_ARGUMENT"
        );
        let second = m
            .execute(
                "superProfiles.update",
                json!({"id":id,"expectedRevisionId":rev,"name":"Updated"}),
            )
            .unwrap();
        assert_eq!(
            m.execute(
                "superProfiles.update",
                json!({"id":id,"expectedRevisionId":rev,"name":"Lost update"})
            )
            .unwrap_err()
            .code,
            "REVISION_CONFLICT"
        );
        let restored = m
            .execute(
                "superProfiles.revisions.restore",
                json!({"id":id,"expectedRevisionId":second["revisionId"],"revisionId":rev}),
            )
            .unwrap();
        assert_eq!(restored["name"], "Development");
        assert_ne!(restored["revisionId"], rev);
        assert_eq!(
            m.execute("superProfiles.revisions.list", json!({"id":id}))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            3
        );
    }
    #[test]
    fn changing_backend_or_engine_preserves_history_without_reusing_archive() {
        let (root, mut m) = manager();
        let first = create(&mut m);
        let id = first["id"].as_str().unwrap();
        let source = root.path().join("archive.tar");
        fs::write(&source, b"environment archive").unwrap();
        let saved = m
            .import_super_profile_state(id, first["revisionId"].as_str().unwrap(), &source)
            .unwrap();
        let changed=m.execute("superProfiles.update",json!({"id":id,"expectedRevisionId":saved["revisionId"],"settings":{"backend":"windows-sandbox"}})).unwrap();
        assert_eq!(
            m.export_super_profile_state(id, &root.path().join("wrong.tar"))
                .unwrap_err()
                .code,
            "NOT_FOUND"
        );
        assert!(
            !m.state.super_revisions[saved["revisionId"].as_str().unwrap()]
                .chunks
                .is_empty()
        );
        let restored=m.execute("superProfiles.revisions.restore",json!({"id":id,"expectedRevisionId":changed["revisionId"],"revisionId":saved["revisionId"]})).unwrap();
        let changed = m
            .execute(
                "superProfiles.update",
                json!({"id":id,"expectedRevisionId":restored["revisionId"],"engine":"firefox"}),
            )
            .unwrap();
        assert!(
            m.state.super_revisions[changed["revisionId"].as_str().unwrap()]
                .chunks
                .is_empty()
        );
    }
    #[test]
    fn switching_backends_recovers_separate_archives_from_own_history() {
        let (root, mut m) = manager();
        let first = create(&mut m);
        let id = first["id"].as_str().unwrap();
        let archive = root.path().join("input.tar");
        fs::write(&archive, b"WSL browser and workspace").unwrap();
        let mut current = m
            .import_super_profile_state(id, first["revisionId"].as_str().unwrap(), &archive)
            .unwrap();
        current=m.execute("superProfiles.update",json!({"id":id,"expectedRevisionId":current["revisionId"],"settings":{"backend":"windows-sandbox"}})).unwrap();
        fs::write(&archive, b"Sandbox browser and workspace").unwrap();
        current = m
            .import_super_profile_state(id, current["revisionId"].as_str().unwrap(), &archive)
            .unwrap();
        for (index, backend, expected) in [
            (0, "wsl2", b"WSL browser and workspace".as_slice()),
            (
                1,
                "windows-sandbox",
                b"Sandbox browser and workspace".as_slice(),
            ),
            (2, "wsl2", b"WSL browser and workspace".as_slice()),
        ] {
            current=m.execute("superProfiles.update",json!({"id":id,"expectedRevisionId":current["revisionId"],"settings":{"backend":backend}})).unwrap();
            let output = root.path().join(format!("output-{index}.tar"));
            m.export_super_profile_state(id, &output).unwrap();
            assert_eq!(fs::read(output).unwrap(), expected);
        }
    }
    #[test]
    fn root_filesystem_digest_and_custom_default_identity_isolate_archives() {
        let (root, mut m) = manager();
        let mut current = create(&mut m);
        let id = current["id"].as_str().unwrap().to_string();
        current=m.execute("superProfiles.update",json!({"id":id,"expectedRevisionId":current["revisionId"],"settings":{"backend":"wsl2","rootfsPath":"approved.tar","rootfsSha256":"first"}})).unwrap();
        let source = root.path().join("source.tar");
        fs::write(&source, b"custom rootfs archive").unwrap();
        current = m
            .import_super_profile_state(&id, current["revisionId"].as_str().unwrap(), &source)
            .unwrap();
        for settings in [
            json!({"backend":"wsl2","rootfsPath":"approved.tar","rootfsSha256":"second"}),
            json!({"backend":"wsl2"}),
        ] {
            current = m
                .execute(
                    "superProfiles.update",
                    json!({"id":id,"expectedRevisionId":current["revisionId"],"settings":settings}),
                )
                .unwrap();
            assert_eq!(
                m.export_super_profile_state(&id, &root.path().join("wrong.tar"))
                    .unwrap_err()
                    .code,
                "NOT_FOUND"
            );
        }
        current=m.execute("superProfiles.update",json!({"id":id,"expectedRevisionId":current["revisionId"],"settings":{"backend":"wsl2","rootfsPath":"approved.tar","rootfsSha256":"first"}})).unwrap();
        let output = root.path().join("right.tar");
        m.export_super_profile_state(&id, &output).unwrap();
        assert_eq!(fs::read(output).unwrap(), b"custom rootfs archive");
        current = m
            .execute(
                "superProfiles.update",
                json!({"id":id,"expectedRevisionId":current["revisionId"],"engine":"firefox"}),
            )
            .unwrap();
        assert_eq!(
            m.export_super_profile_state(&id, &root.path().join("wrong-engine.tar"))
                .unwrap_err()
                .code,
            "NOT_FOUND"
        );
        m.execute(
            "superProfiles.update",
            json!({"id":id,"expectedRevisionId":current["revisionId"],"engine":"chromium"}),
        )
        .unwrap();
        m.export_super_profile_state(&id, &root.path().join("right-engine.tar"))
            .unwrap();
    }
    #[test]
    fn history_lookup_rejects_cycles_and_cross_template_ancestors() {
        let (_root, mut m) = manager();
        let current = create(&mut m);
        let other = create(&mut m);
        let id = current["id"].as_str().unwrap();
        let revision = current["revisionId"].as_str().unwrap();
        m.state.super_revisions.get_mut(revision).unwrap().parent_id = Some(revision.to_string());
        let update =
            json!({"id":id,"expectedRevisionId":revision,"settings":{"backend":"windows-sandbox"}});
        assert_eq!(
            m.execute("superProfiles.update", update.clone())
                .unwrap_err()
                .code,
            "INTEGRITY"
        );
        m.state.super_revisions.get_mut(revision).unwrap().parent_id =
            Some(other["revisionId"].as_str().unwrap().to_string());
        assert_eq!(
            m.execute("superProfiles.update", update).unwrap_err().code,
            "INTEGRITY"
        );
    }
    #[test]
    fn archives_round_trip_encrypted_and_tampering_removes_partial_output() {
        let (root, mut m) = manager();
        let first = create(&mut m);
        let id = first["id"].as_str().unwrap();
        let source = root.path().join("archive.tar");
        let bytes = vec![71; CHUNK + 123];
        fs::write(&source, &bytes).unwrap();
        let saved = m
            .import_super_profile_state(id, first["revisionId"].as_str().unwrap(), &source)
            .unwrap();
        let destination = root.path().join("restored.tar");
        m.export_super_profile_state(id, &destination).unwrap();
        assert_eq!(fs::read(&destination).unwrap(), bytes);
        let chunk =
            m.state.super_revisions[saved["revisionId"].as_str().unwrap()].chunks[0].clone();
        let object = m.object(&chunk).unwrap();
        let mut encrypted = fs::read(&object).unwrap();
        assert_ne!(&encrypted[..32], &bytes[..32]);
        encrypted[30] ^= 1;
        fs::write(object, encrypted).unwrap();
        let bad = root.path().join("bad.tar");
        assert!(m.export_super_profile_state(id, &bad).is_err());
        assert!(!bad.exists());
        m.execute("vault.lock", json!({})).unwrap();
        m.execute("vault.unlock", json!({"password":"test password"}))
            .unwrap();
        assert_eq!(
            m.execute("superProfiles.list", json!({})).unwrap()[0]["revisionId"],
            saved["revisionId"]
        );
    }
}

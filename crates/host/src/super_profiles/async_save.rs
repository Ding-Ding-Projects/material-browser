//! Guest collection runs without vault access. Only the host finalizes encrypted revisions.
use super::*;
use sha2::{Digest, Sha256};
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct SavePlan {
    pub source_revision: String,
    pub categories: Vec<String>,
    pub close_after_save: bool,
    pub archive_name: String,
    pub archive_bytes: u64,
    pub archive_sha256: String,
    pub collection_epoch: String,
}
fn current_revision(core: &mut material_browser_core::Manager, s: &Session) -> Result<()> {
    let current = core
        .execute("superProfiles.list", json!({}))
        .map_err(|e| error(&e.code, &e.message))?;
    if !current.as_array().is_some_and(|profiles| {
        profiles
            .iter()
            .any(|p| p["id"] == s.profile_id && p["revisionId"] == s.revision_id)
    }) {
        return Err(error(
            "REVISION_CONFLICT",
            "The template changed after this session launched",
        ));
    }
    Ok(())
}
fn digest(path: &Path) -> Result<(u64, String)> {
    let metadata = fs::symlink_metadata(path).map_err(io_error)?;
    if !metadata.is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() == 0
        || metadata.len() > 32 * 1024 * 1024 * 1024
    {
        return Err(error(
            "UNSAFE_ARCHIVE",
            "Save archive must be a bounded regular file",
        ));
    }
    let mut file = fs::File::open(path).map_err(io_error)?;
    let mut hash = Sha256::new();
    let mut bytes = 0u64;
    let mut buffer = [0u8; 65536];
    loop {
        asynchronous::check_cancel()?;
        let n = file.read(&mut buffer).map_err(io_error)?;
        if n == 0 {
            break;
        }
        bytes += n as u64;
        if bytes > metadata.len() {
            return Err(error(
                "ARCHIVE_CHANGED",
                "Save archive changed during verification",
            ));
        }
        hash.update(&buffer[..n]);
    }
    if bytes != metadata.len() {
        return Err(error(
            "ARCHIVE_CHANGED",
            "Save archive changed during verification",
        ));
    }
    Ok((bytes, format!("{:x}", hash.finalize())))
}
fn archive_path(s: &Session, plan: &SavePlan) -> Result<PathBuf> {
    let id = plan
        .archive_name
        .strip_prefix("export-")
        .and_then(|name| name.strip_suffix(".tar"))
        .filter(|id| valid_id(id))
        .ok_or_else(|| error("INVALID_SAVE_PLAN", "Save archive identity is invalid"))?;
    Ok(s.directory.join(format!("export-{id}.tar")))
}
impl Sessions {
    pub fn on_vault_lock(&mut self) {
        self.unlock_epoch = crate::random_hex();
    }
    pub fn locked_status(&mut self) -> Value {
        self.refresh_workers();
        json!(self.entries.values().map(|s|json!({"id":s.id,"backend":s.backend,"mode":s.mode,"state":s.state,"phase":s.phase,"operationId":s.operation_id,"saveConfirmationRequired":s.save_plan.is_some(),"guestRemoved":s.guest_removed,"canStop":!matches!(s.state.as_str(),"discarded"|"cleanup-required"),"canDiscard":true})).collect::<Vec<_>>())
    }
    pub fn redact_control_response(value: Value) -> Value {
        let mut result = serde_json::Map::new();
        for key in [
            "id",
            "backend",
            "mode",
            "state",
            "phase",
            "operationId",
            "guestRemoved",
            "saveConfirmationRequired",
        ] {
            if let Some(value) = value.get(key) {
                result.insert(key.into(), value.clone());
            }
        }
        Value::Object(result)
    }
    pub fn save(&mut self, core: &mut material_browser_core::Manager, p: &Value) -> Result<Value> {
        self.refresh_workers();
        let id = text(p, "sessionId")?;
        let categories = selected_categories(p)?
            .iter()
            .map(|s| s.to_string())
            .collect::<Vec<_>>();
        let mut s = self
            .entries
            .get(id)
            .cloned()
            .ok_or_else(|| error("SESSION_NOT_FOUND", "Session not found"))?;
        if self.workers.contains_key(id) {
            return Err(error(
                "OPERATION_ACTIVE",
                "Wait for the current owned operation before saving",
            ));
        }
        if text(p, "expectedRevisionId")? != s.revision_id {
            return Err(error(
                "REVISION_CONFLICT",
                "Save must target the launched template revision",
            ));
        }
        current_revision(core, &s)?;
        if matches!(
            s.state.as_str(),
            "discarded" | "saved" | "cleanup-required" | "save-ready"
        ) {
            return Err(error(
                "INVALID_SESSION_STATE",
                "This session cannot start another save collection",
            ));
        }
        let close = match p.get("closeAfterSave") {
            Some(v) => v
                .as_bool()
                .ok_or_else(|| error("INVALID_PARAMS", "closeAfterSave must be a boolean"))?,
            None => false,
        };
        if !close && s.state != "stopped" {
            return Err(error(
                "SESSION_NOT_STOPPED",
                "Stop the guest or choose save and close",
            ));
        }
        s.operation_id = crate::random_hex();
        s.save_plan = Some(SavePlan {
            source_revision: s.revision_id.clone(),
            categories,
            close_after_save: close,
            archive_name: format!("export-{}.tar", crate::random_hex()),
            archive_bytes: 0,
            archive_sha256: String::new(),
            collection_epoch: self.unlock_epoch.clone(),
        });
        s.state = "collecting".into();
        s.saved_revision_id = None;
        s.save_confirmation_required = false;
        asynchronous::event(
            &mut s,
            "save-queued",
            "Managed state collection queued; the encrypted revision is not yet saved",
        );
        self.persist(&s)?;
        self.entries.insert(id.into(), s.clone());
        self.spawn_worker(s.clone(), |runner, s| runner.collect_save(s))?;
        let mut result = json!(s);
        result["saved"] = json!(false);
        Ok(result)
    }
    pub(super) fn collect_save(&mut self, mut s: Session) -> Result<Value> {
        let id = s.id.clone();
        self.entries.insert(id.clone(), s.clone());
        self.progress(
            &mut s,
            "stopping-for-save",
            "Stopping the owned guest before collecting managed state",
        )?;
        self.entries.insert(id.clone(), s.clone());
        self.stop(&id)?;
        s = self
            .entries
            .get(&id)
            .cloned()
            .ok_or_else(|| error("SESSION_NOT_FOUND", "Session not found"))?;
        s.state = "collecting".into();
        self.progress(
            &mut s,
            "collecting-state",
            "Archiving only selected managed state categories",
        )?;
        let plan = s
            .save_plan
            .clone()
            .ok_or_else(|| error("INVALID_SAVE_PLAN", "Missing save collection plan"))?;
        let path = archive_path(&s, &plan)?;
        let categories = plan
            .categories
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>();
        if s.backend == "windows-sandbox" {
            sandbox::archive(&s, &path, &categories)?;
        } else {
            verify_registration(&s)?;
            let output = fs::OpenOptions::new()
                .write(true)
                .create_new(true)
                .open(&path)
                .map_err(io_error)?;
            let mut args = vec![
                "-d",
                &s.distribution,
                "-u",
                USER,
                "--exec",
                "tar",
                "-cf",
                "-",
                "-C",
                "/home/materialbrowser/.material-browser",
            ];
            args.extend(categories);
            let child = Command::new("wsl.exe")
                .args(args)
                .stdin(Stdio::null())
                .stdout(Stdio::from(output))
                .stderr(Stdio::null())
                .spawn()
                .map_err(io_error)?;
            let result = wait_owned(child, Duration::from_secs(300));
            let stopped = run(&["--terminate", &s.distribution], Duration::from_secs(30));
            result?;
            stopped?;
        }
        validate_archive(&path)?;
        let (bytes, sha) = digest(&path)?;
        let plan = s.save_plan.as_mut().unwrap();
        plan.archive_bytes = bytes;
        plan.archive_sha256 = sha;
        s.state = "save-ready".into();
        self.progress(
            &mut s,
            "save-ready",
            "Managed state collected and verified; awaiting encrypted revision finalization",
        )?;
        self.entries.insert(id, s.clone());
        Ok(json!(s))
    }
    pub fn finalize_ready_saves(&mut self, core: &mut material_browser_core::Manager) {
        self.refresh_workers();
        let ready = self
            .entries
            .values()
            .filter(|s| {
                s.state == "save-ready"
                    && s.save_plan
                        .as_ref()
                        .is_some_and(|p| p.collection_epoch == self.unlock_epoch)
            })
            .map(|s| (s.id.clone(), s.operation_id.clone(), s.revision_id.clone()))
            .collect::<Vec<_>>();
        for (id, operation, revision) in ready {
            if let Err(e) = self.finalize_save(
                core,
                &json!({"sessionId":id,"operationId":operation,"expectedRevisionId":revision}),
            ) {
                if let Some(mut s) = self.entries.get(&id).cloned() {
                    s.save_confirmation_required = true;
                    if let Some(plan) = s.save_plan.as_mut() {
                        plan.collection_epoch.clear();
                    }
                    asynchronous::event(&mut s, "save-finalization-failed", &e.message);
                    let _ = self.persist(&s);
                    self.entries.insert(id, s);
                }
            }
        }
    }
    pub fn finalize_save(
        &mut self,
        core: &mut material_browser_core::Manager,
        p: &Value,
    ) -> Result<Value> {
        self.refresh_workers();
        let id = text(p, "sessionId")?;
        let mut s = self
            .entries
            .get(id)
            .cloned()
            .ok_or_else(|| error("SESSION_NOT_FOUND", "Session not found"))?;
        if text(p, "operationId")? != s.operation_id {
            return Err(error(
                "OPERATION_CONFLICT",
                "Save operation has been superseded",
            ));
        }
        if let Some(revision) = &s.saved_revision_id {
            return Ok(
                json!({"saved":true,"revisionId":revision,"sessionId":id,"operationId":s.operation_id,"cleanupPending":s.state=="cleanup-required"}),
            );
        }
        if s.state != "save-ready" || self.workers.contains_key(id) {
            return Err(error(
                "SAVE_NOT_READY",
                "Collection must complete before encrypted finalization",
            ));
        }
        let plan = s
            .save_plan
            .clone()
            .ok_or_else(|| error("INVALID_SAVE_PLAN", "Missing save collection plan"))?;
        if text(p, "expectedRevisionId")? != plan.source_revision
            || s.revision_id != plan.source_revision
        {
            return Err(error(
                "REVISION_CONFLICT",
                "Save finalization must target the collected source revision",
            ));
        }
        if plan.collection_epoch != self.unlock_epoch && p["confirmAfterUnlock"] != true {
            return Err(error(
                "SAVE_CONFIRMATION_REQUIRED",
                "The vault locked or the host restarted during collection; confirm this save again",
            ));
        }
        current_revision(core, &s)?;
        let path = archive_path(&s, &plan)?;
        validate_archive(&path)?;
        let (bytes, hash) = digest(&path)?;
        if bytes != plan.archive_bytes || hash != plan.archive_sha256 {
            return Err(error(
                "ARCHIVE_CHANGED",
                "Collected state changed before finalization",
            ));
        }
        let mut response = core
            .import_super_profile_state(&s.profile_id, &plan.source_revision, &path)
            .map_err(|e| error(&e.code, &e.message))?;
        s.saved_revision_id = response["revisionId"].as_str().map(str::to_string);
        s.state = "saved".into();
        s.save_confirmation_required = false;
        asynchronous::event(
            &mut s,
            "encrypted-save-complete",
            "Managed state persisted as a new encrypted immutable revision",
        );
        self.entries.insert(id.into(), s.clone());
        if let Some(object) = response.as_object_mut() {
            object.insert("saved".into(), json!(true));
            object.insert("sessionId".into(), json!(id));
            object.insert("operationId".into(), json!(s.operation_id));
            object.insert("cleanupPending".into(), json!(false));
        }
        let cleanup = match self.persist(&s) {
            Err(e) => Err(e),
            Ok(()) if plan.close_after_save => self.discard(id).map(|_| ()),
            Ok(()) => Ok(()),
        };
        if let Err(e) = cleanup {
            if let Some(object) = response.as_object_mut() {
                object.insert("cleanupPending".into(), json!(true));
                object.insert(
                    "cleanupError".into(),
                    json!({"code":e.code,"message":e.message}),
                );
            }
        }
        Ok(response)
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn ready_save_fixture() -> (
        PathBuf,
        material_browser_core::Manager,
        Sessions,
        String,
        String,
    ) {
        let root =
            std::env::temp_dir().join(format!("material-save-ready-{}", crate::random_hex()));
        fs::create_dir(&root).unwrap();
        let mut core = material_browser_core::Manager::new(root.clone()).unwrap();
        core.execute(
            "vault.create",
            json!({"password":"test-only-not-a-real-credential"}),
        )
        .unwrap();
        let profile=core.execute("superProfiles.create",json!({"name":"fixture","engine":"chromium","settings":{"backend":"wsl2","launchMode":"terminal"}})).unwrap();
        let mut sessions = Sessions::new(&root).unwrap();
        let id = crate::random_hex();
        let directory = sessions.root.join(&id);
        fs::create_dir(&directory).unwrap();
        let name = format!("export-{}.tar", crate::random_hex());
        let path = directory.join(&name);
        let mut builder = tar::Builder::new(fs::File::create(&path).unwrap());
        let mut header = tar::Header::new_gnu();
        header.set_size(5);
        header.set_mode(0o600);
        header.set_cksum();
        builder
            .append_data(&mut header, "workspace/item.txt", &b"saved"[..])
            .unwrap();
        builder.finish().unwrap();
        drop(builder);
        let (bytes, hash) = digest(&path).unwrap();
        let session:Session=serde_json::from_value(json!({"id":id,"profileId":profile["id"],"revisionId":profile["revisionId"],"distribution":format!("MaterialBrowser-{id}"),"mode":"terminal","backend":"wsl2","state":"save-ready","directory":directory,"message":"ready","operationId":crate::random_hex(),"phase":"save-ready","savePlan":{"sourceRevision":profile["revisionId"],"categories":["workspace"],"closeAfterSave":false,"archiveName":name,"archiveBytes":bytes,"archiveSha256":hash,"collectionEpoch":sessions.unlock_epoch}})).unwrap();
        sessions.persist(&session).unwrap();
        sessions.entries.insert(id.clone(), session);
        (
            root,
            core,
            sessions,
            id,
            profile["id"].as_str().unwrap().into(),
        )
    }
    #[test]
    fn lock_requires_fresh_confirmation_before_save_finalization() {
        let (root, mut core, mut sessions, id, profile_id) = ready_save_fixture();
        let s = sessions.entries[&id].clone();
        let mut request =
            json!({"sessionId":id,"operationId":s.operation_id,"expectedRevisionId":s.revision_id});
        sessions.on_vault_lock();
        core.execute("vault.lock", json!({})).unwrap();
        sessions.finalize_ready_saves(&mut core);
        assert_eq!(sessions.entries[&id].state, "save-ready");
        assert_eq!(sessions.status()[0]["saveConfirmationRequired"], true);
        let locked = sessions.locked_status();
        assert!(locked[0].get("profileId").is_none());
        assert!(locked[0].get("directory").is_none());
        core.execute(
            "vault.unlock",
            json!({"password":"test-only-not-a-real-credential"}),
        )
        .unwrap();
        assert_eq!(
            sessions
                .finalize_save(&mut core, &request)
                .unwrap_err()
                .code,
            "SAVE_CONFIRMATION_REQUIRED"
        );
        request["confirmAfterUnlock"] = json!(true);
        let saved = sessions.finalize_save(&mut core, &request).unwrap();
        assert_eq!(saved["saved"], true);
        assert_ne!(saved["revisionId"], s.revision_id);
        assert_eq!(
            sessions.finalize_save(&mut core, &request).unwrap()["revisionId"],
            saved["revisionId"]
        );
        assert_eq!(
            core.execute("superProfiles.revisions.list", json!({"id":profile_id}))
                .unwrap()
                .as_array()
                .unwrap()
                .len(),
            2
        );
        drop(core);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn uninterrupted_epoch_finalizes_ready_collection_once() {
        let (root, mut core, mut sessions, id, _) = ready_save_fixture();
        sessions.finalize_ready_saves(&mut core);
        assert_eq!(sessions.entries[&id].state, "saved");
        assert!(sessions.entries[&id].saved_revision_id.is_some());
        sessions.finalize_ready_saves(&mut core);
        assert_eq!(sessions.entries[&id].state, "saved");
        drop(core);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn save_archive_identity_stays_inside_owned_directory() {
        let s:Session=serde_json::from_value(json!({"id":"a".repeat(64),"profileId":"p","revisionId":"r","distribution":format!("MaterialBrowser-{}","a".repeat(64)),"mode":"terminal","backend":"wsl2","state":"stopped","directory":"/owned/session","message":""})).unwrap();
        let mut plan = SavePlan {
            source_revision: "r".into(),
            categories: vec!["workspace".into()],
            close_after_save: true,
            archive_name: format!("export-{}.tar", "b".repeat(64)),
            archive_bytes: 0,
            archive_sha256: String::new(),
            collection_epoch: "epoch".into(),
        };
        assert_eq!(
            archive_path(&s, &plan).unwrap(),
            s.directory.join(&plan.archive_name)
        );
        plan.archive_name = "../state.tar".into();
        assert!(archive_path(&s, &plan).is_err());
    }
}

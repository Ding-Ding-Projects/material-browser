//! Background provisioning observes cancellation without sharing vault state.
use super::*;
use std::cell::RefCell;
thread_local! { static CANCELLATION: RefCell<Option<PathBuf>> = const { RefCell::new(None) }; }
#[derive(Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct Event {
    pub sequence: u64,
    pub timestamp_ms: u128,
    pub phase: String,
    pub message: String,
}
pub(super) fn set_context(session: &Session) {
    CANCELLATION.with(|slot| *slot.borrow_mut() = Some(session.directory.join("cancel-requested")));
}
pub(super) fn check_cancel() -> Result<()> {
    if CANCELLATION.with(|slot| slot.borrow().as_ref().is_some_and(|path| path.is_file())) {
        return Err(error(
            "OPERATION_CANCELLED",
            "Provisioning cancellation observed; owned staging is retained for recovery",
        ));
    }
    Ok(())
}
pub(super) fn event(session: &mut Session, phase: &str, message: &str) {
    session.phase = phase.into();
    session.message = message.into();
    let sequence = session.events.last().map(|e| e.sequence + 1).unwrap_or(1);
    session.events.push(Event {
        sequence,
        timestamp_ms: std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis(),
        phase: phase.into(),
        message: message.into(),
    });
    if session.events.len() > 128 {
        session.events.remove(0);
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn cancellation_is_thread_scoped_and_fail_closed() {
        let root = std::env::temp_dir().join(format!("material-cancel-{}", crate::random_hex()));
        fs::create_dir(&root).unwrap();
        CANCELLATION.with(|slot| *slot.borrow_mut() = Some(root.join("cancel-requested")));
        assert!(check_cancel().is_ok());
        fs::write(root.join("cancel-requested"), b"cancel").unwrap();
        assert_eq!(check_cancel().unwrap_err().code, "OPERATION_CANCELLED");
        CANCELLATION.with(|slot| *slot.borrow_mut() = None);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn status_observes_durable_worker_progress_and_stop_requests_cancellation() {
        let root = std::env::temp_dir().join(format!("material-worker-{}", crate::random_hex()));
        fs::create_dir(&root).unwrap();
        let mut sessions = Sessions::new(&root).unwrap();
        let id = crate::random_hex();
        let directory = sessions.root.join(&id);
        fs::create_dir(&directory).unwrap();
        let mut session:Session=serde_json::from_value(json!({"id":id,"profileId":"profile-a","revisionId":"revision-a","distribution":format!("MaterialBrowser-{id}"),"mode":"terminal","backend":"wsl2","state":"provisioning","directory":directory,"message":"queued","operationId":id})).unwrap();
        sessions.persist(&session).unwrap();
        sessions.entries.insert(id.clone(), session.clone());
        let worker_root = sessions.root.clone();
        let (ready_tx, ready_rx) = std::sync::mpsc::channel();
        let worker = thread::spawn(move || {
            set_context(&session);
            let mut runner = Sessions {
                root: worker_root,
                entries: BTreeMap::new(),
                children: BTreeMap::new(),
                workers: BTreeMap::new(),
            };
            runner
                .progress(&mut session, "waiting-test", "Waiting for cancellation")
                .unwrap();
            ready_tx.send(()).unwrap();
            let deadline = Instant::now() + Duration::from_secs(2);
            while check_cancel().is_ok() && Instant::now() < deadline {
                thread::sleep(Duration::from_millis(5));
            }
            assert_eq!(check_cancel().unwrap_err().code, "OPERATION_CANCELLED");
            session.state = "recovery-required".into();
            event(&mut session, "cancelled", "Retained for recovery");
            runner.persist(&session).unwrap();
            runner.entries.insert(session.id.clone(), session);
            (runner.entries, runner.children)
        });
        sessions.workers.insert(id.clone(), worker);
        ready_rx.recv_timeout(Duration::from_secs(2)).unwrap();
        assert_eq!(sessions.status()[0]["phase"], "waiting-test");
        assert_eq!(sessions.stop(&id).unwrap()["state"], "cancelling");
        let deadline = Instant::now() + Duration::from_secs(2);
        while !sessions.workers[&id].is_finished() && Instant::now() < deadline {
            thread::sleep(Duration::from_millis(5));
        }
        let status = sessions.status();
        assert_eq!(status[0]["phase"], "cancelled");
        assert_eq!(status[0]["state"], "recovery-required");
        assert_eq!(status[0]["operationId"], id);
        assert!(sessions.workers.is_empty());
        fs::remove_dir_all(root).unwrap();
    }
}

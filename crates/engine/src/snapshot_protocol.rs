//! Restricted native snapshot messages. This is not a debugging transport.
use serde::{Deserialize, Serialize};
#[derive(Debug, Deserialize, Serialize)]
#[serde(
    tag = "command",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub enum SnapshotCommand {
    Begin {
        protocol: u32,
        request_id: String,
        profile_id: String,
    },
    Commit {
        protocol: u32,
        request_id: String,
        generation: u64,
    },
    Abort {
        protocol: u32,
        request_id: String,
    },
}
#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct BarrierReceipt {
    pub protocol: u32,
    pub request_id: String,
    pub profile_id: String,
    pub engine_sha256: String,
    pub generation: u64,
    pub network_paused: bool,
    pub renderers_paused: bool,
    pub service_workers_paused: bool,
    pub databases_flushed: bool,
    pub storage_writers_frozen: bool,
}
impl BarrierReceipt {
    /// Only validates an already authenticated native reply. Callers must authenticate
    /// the inherited pipe peer and bind its PID to the supervised process first.
    pub fn validate(&self, request_id: &str, profile_id: &str, engine_sha256: &str) -> bool {
        self.protocol == 1
            && self.request_id == request_id
            && self.profile_id == profile_id
            && self.engine_sha256 == engine_sha256
            && self.generation > 0
            && self.network_paused
            && self.renderers_paused
            && self.service_workers_paused
            && self.databases_flushed
            && self.storage_writers_frozen
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn restricted_commands_use_exact_camel_case_wire_fields() {
        let commands = [
            (
                SnapshotCommand::Begin {
                    protocol: 1,
                    request_id: "r".into(),
                    profile_id: "p".into(),
                },
                serde_json::json!({"command":"begin","protocol":1,"requestId":"r","profileId":"p"}),
            ),
            (
                SnapshotCommand::Commit {
                    protocol: 1,
                    request_id: "r".into(),
                    generation: 7,
                },
                serde_json::json!({"command":"commit","protocol":1,"requestId":"r","generation":7}),
            ),
            (
                SnapshotCommand::Abort {
                    protocol: 1,
                    request_id: "r".into(),
                },
                serde_json::json!({"command":"abort","protocol":1,"requestId":"r"}),
            ),
        ];
        for (command, expected) in commands {
            assert_eq!(serde_json::to_value(command).unwrap(), expected);
            let decoded: SnapshotCommand = serde_json::from_value(expected.clone()).unwrap();
            assert_eq!(serde_json::to_value(decoded).unwrap(), expected);
        }
        for invalid in [
            serde_json::json!({"command":"begin","protocol":1,"request_id":"r","profile_id":"p"}),
            serde_json::json!({"command":"commit","protocol":1,"request_id":"r","generation":7}),
            serde_json::json!({"command":"abort","protocol":1,"request_id":"r"}),
            serde_json::json!({"command":"abort","protocol":1,"requestId":"r","extra":true}),
        ] {
            assert!(serde_json::from_value::<SnapshotCommand>(invalid).is_err());
        }
    }
    #[test]
    fn missing_writer_barrier_is_rejected() {
        let mut r = BarrierReceipt {
            protocol: 1,
            request_id: "r".into(),
            profile_id: "p".into(),
            engine_sha256: "h".into(),
            generation: 1,
            network_paused: true,
            renderers_paused: true,
            service_workers_paused: true,
            databases_flushed: true,
            storage_writers_frozen: false,
        };
        assert!(!r.validate("r", "p", "h"));
        r.storage_writers_frozen = true;
        assert!(r.validate("r", "p", "h"));
        assert!(!r.validate("other", "p", "h"));
    }
}

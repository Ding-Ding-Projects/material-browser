//! Durable launch intent survives supervisor crashes. Unknown state is never idle.
use super::*;
use std::io::Write;
use sysinfo::{Pid, ProcessRefreshKind, ProcessesToUpdate, System, UpdateKind};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct ProcessIdentity {
    pub pid: u32,
    pub start_time: u64,
    pub executable: PathBuf,
    pub profile: PathBuf,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "state", rename_all = "camelCase", deny_unknown_fields)]
pub(super) enum Journal {
    Starting { profile: PathBuf },
    Running { identity: ProcessIdentity },
    Stopped,
}

pub(super) fn journal_path(root: &Path, id: &str) -> PathBuf {
    root.join(".material-browser-processes")
        .join(format!("{id}.json"))
}

pub(super) fn persist(root: &Path, id: &str, record: &Journal) -> Result<()> {
    let path = journal_path(root, id);
    fs::create_dir_all(path.parent().unwrap()).map_err(io)?;
    // A torn write remains unreadable and blocks reuse instead of looking idle.
    let mut file = OpenOptions::new()
        .create(true)
        .write(true)
        .truncate(true)
        .open(path)
        .map_err(io)?;
    serde_json::to_writer(&mut file, record)
        .map_err(|_| err("PROCESS_JOURNAL", "Cannot persist process state"))?;
    file.flush().map_err(io)?;
    file.sync_all().map_err(io)
}

fn processes(pids: ProcessesToUpdate<'_>) -> System {
    let mut system = System::new();
    system.refresh_processes_specifics(
        pids,
        true,
        ProcessRefreshKind::nothing()
            .with_exe(UpdateKind::Always)
            .with_cmd(UpdateKind::Always),
    );
    system
}

fn uses_profile(args: &[std::ffi::OsString], profile: &Path) -> bool {
    args.iter().enumerate().any(|(i, arg)| {
        let text = arg.to_string_lossy();
        if let Some(value) = text.strip_prefix("--user-data-dir=") {
            return Path::new(value).canonicalize().ok().as_deref() == Some(profile);
        }
        (text == "-profile" || text == "--profile")
            && args
                .get(i + 1)
                .and_then(|p| Path::new(p).canonicalize().ok())
                .as_deref()
                == Some(profile)
    })
}

pub(super) fn capture(pid: u32, executable: &Path, profile: &Path) -> Result<ProcessIdentity> {
    let system = processes(ProcessesToUpdate::Some(&[Pid::from_u32(pid)]));
    let p = system
        .process(Pid::from_u32(pid))
        .ok_or_else(|| err("PROCESS_IDENTITY", "Browser process is unavailable"))?;
    let actual = p.exe().and_then(|p| p.canonicalize().ok());
    if actual.as_deref() != Some(executable) || !uses_profile(p.cmd(), profile) {
        return Err(err(
            "PROCESS_IDENTITY",
            "Browser executable and profile arguments could not be verified",
        ));
    }
    Ok(ProcessIdentity {
        pid,
        start_time: native_start_time(pid)?,
        executable: executable.into(),
        profile: profile.into(),
    })
}

pub(super) fn assert_inactive(root: &Path, id: &str) -> Result<()> {
    let path = journal_path(root, id);
    let bytes = match fs::read(path) {
        Ok(b) if b.len() <= 65536 => b,
        Ok(_) => {
            return Err(err(
                "PROCESS_RECOVERY_REQUIRED",
                "Oversized process journal",
            ));
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return scan_profile(root, id),
        Err(e) => return Err(io(e)),
    };
    let journal: Journal = serde_json::from_slice(&bytes).map_err(|_| {
        err(
            "PROCESS_RECOVERY_REQUIRED",
            "Incomplete process journal; explicit recovery required",
        )
    })?;
    match journal {
        Journal::Starting { .. } => Err(err(
            "PROCESS_RECOVERY_REQUIRED",
            "Interrupted launch intent; explicit recovery required",
        )),
        Journal::Running { identity } => {
            let system = processes(ProcessesToUpdate::Some(&[Pid::from_u32(identity.pid)]));
            if let Some(start) = native_start_time_if_exists(identity.pid)? {
                if start == identity.start_time {
                    let p = system.process(Pid::from_u32(identity.pid)).ok_or_else(|| {
                        err(
                            "PROCESS_RECOVERY_REQUIRED",
                            "Live process metadata is unavailable",
                        )
                    })?;
                    if p.exe().and_then(|p| p.canonicalize().ok()).as_deref()
                        != Some(identity.executable.as_path())
                        || !uses_profile(p.cmd(), &identity.profile)
                    {
                        return Err(err(
                            "PROCESS_RECOVERY_REQUIRED",
                            "Live process ownership cannot be verified",
                        ));
                    }
                    return Err(err(
                        "PROFILE_ACTIVE",
                        "Owned browser survived its supervisor",
                    ));
                }
            }
            scan_profile(root, id)
        }
        Journal::Stopped => scan_profile(root, id),
    }
}

fn scan_profile(root: &Path, id: &str) -> Result<()> {
    let profile = root.join(id);
    if !profile.exists() {
        return Ok(());
    }
    let profile = profile.canonicalize().map_err(io)?;
    let system = processes(ProcessesToUpdate::All);
    if system
        .processes()
        .values()
        .any(|p| uses_profile(p.cmd(), &profile))
    {
        return Err(err(
            "PROFILE_ACTIVE",
            "A browser process still references this profile",
        ));
    }
    Ok(())
}

#[cfg(windows)]
fn native_start_time(pid: u32) -> Result<u64> {
    native_start_time_if_exists(pid)?
        .ok_or_else(|| err("PROCESS_IDENTITY", "Process no longer exists"))
}
#[cfg(windows)]
fn native_start_time_if_exists(pid: u32) -> Result<Option<u64>> {
    use std::ffi::c_void;
    #[repr(C)]
    struct FileTime {
        low: u32,
        high: u32,
    }
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut c_void;
        fn GetProcessTimes(
            handle: *mut c_void,
            creation: *mut FileTime,
            exit: *mut FileTime,
            kernel: *mut FileTime,
            user: *mut FileTime,
        ) -> i32;
        fn CloseHandle(handle: *mut c_void) -> i32;
        fn GetLastError() -> u32;
    }
    unsafe {
        let handle = OpenProcess(0x1000, 0, pid);
        if handle.is_null() {
            if GetLastError() == 87 {
                return Ok(None);
            }
            return Err(err("PROCESS_IDENTITY", "Cannot open process identity"));
        }
        let mut times = [const { FileTime { low: 0, high: 0 } }; 4];
        let ptr = times.as_mut_ptr();
        let ok = GetProcessTimes(handle, ptr, ptr.add(1), ptr.add(2), ptr.add(3));
        CloseHandle(handle);
        if ok == 0 {
            return Err(err(
                "PROCESS_IDENTITY",
                "Cannot read native process creation time",
            ));
        }
        Ok(Some(
            (u64::from(times[0].high) << 32) | u64::from(times[0].low),
        ))
    }
}
#[cfg(not(windows))]
fn native_start_time(_pid: u32) -> Result<u64> {
    Err(err(
        "PROCESS_IDENTITY_UNSUPPORTED",
        "Native process identity is only implemented on Windows",
    ))
}
#[cfg(not(windows))]
fn native_start_time_if_exists(_pid: u32) -> Result<Option<u64>> {
    Err(err(
        "PROCESS_IDENTITY_UNSUPPORTED",
        "Native process identity is only implemented on Windows",
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn interrupted_and_torn_journals_never_mean_idle() {
        let root = std::env::temp_dir().join(format!("engine-lifetime-{}", std::process::id()));
        let id = "00000000-0000-0000-0000-000000000002";
        persist(
            &root,
            id,
            &Journal::Starting {
                profile: root.join(id),
            },
        )
        .unwrap();
        assert_eq!(
            assert_inactive(&root, id).unwrap_err().code,
            "PROCESS_RECOVERY_REQUIRED"
        );
        fs::write(journal_path(&root, id), b"{").unwrap();
        assert_eq!(
            assert_inactive(&root, id).unwrap_err().code,
            "PROCESS_RECOVERY_REQUIRED"
        );
    }
    #[test]
    fn profile_argument_matching_is_not_substring_matching() {
        let profile = std::env::temp_dir().canonicalize().unwrap();
        assert!(uses_profile(
            &["-profile".into(), profile.as_os_str().into()],
            &profile
        ));
        assert!(!uses_profile(
            &[format!("--other={}", profile.display()).into()],
            &profile
        ));
        assert!(!uses_profile(
            &[format!("--user-data-dir={}extra", profile.display()).into()],
            &profile
        ));
    }
}

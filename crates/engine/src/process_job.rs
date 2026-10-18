//! A private Windows job terminates owned descendants when the supervisor disappears.
use super::*;

#[cfg(windows)]
mod native {
    use super::*;
    use std::{ffi::c_void, os::windows::io::AsRawHandle};
    #[repr(C)]
    #[derive(Default)]
    struct FileTime { low: u32, high: u32 }
    #[repr(C)]
    #[derive(Default)]
    struct BasicLimits {
        process_time: i64,
        job_time: i64,
        flags: u32,
        min_working_set: usize,
        max_working_set: usize,
        active_limit: u32,
        affinity: usize,
        priority: u32,
        scheduling: u32,
    }
    #[repr(C)]
    #[derive(Default)]
    struct IoCounters {
        read: u64,
        write: u64,
        other: u64,
        read_bytes: u64,
        write_bytes: u64,
        other_bytes: u64,
    }
    #[repr(C)]
    #[derive(Default)]
    struct ExtendedLimits {
        basic: BasicLimits,
        io: IoCounters,
        process_memory: usize,
        job_memory: usize,
        peak_process: usize,
        peak_job: usize,
    }
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut c_void;
        fn IsProcessInJob(process: *mut c_void, job: *mut c_void, member: *mut i32) -> i32;
        fn QueryFullProcessImageNameW(process: *mut c_void, flags: u32, path: *mut u16, length: *mut u32) -> i32;
        fn WaitForSingleObject(handle: *mut c_void, timeout: u32) -> u32;
        fn GetProcessTimes(process: *mut c_void, creation: *mut FileTime, exit: *mut FileTime, kernel: *mut FileTime, user: *mut FileTime) -> i32;
        fn GetLastError() -> u32;
        fn QueryInformationJobObject(job: *mut c_void, class: i32, info: *mut c_void, length: u32, returned: *mut u32) -> i32;
        fn CreateJobObjectW(attributes: *const c_void, name: *const u16) -> *mut c_void;
        fn SetInformationJobObject(
            job: *mut c_void,
            class: i32,
            info: *const c_void,
            length: u32,
        ) -> i32;
        fn AssignProcessToJobObject(job: *mut c_void, process: *mut c_void) -> i32;
        fn CloseHandle(handle: *mut c_void) -> i32;
    }
    #[link(name = "ntdll")]
    unsafe extern "system" {
        fn NtResumeProcess(process: *mut c_void) -> i32;
    }

    pub struct ProcessJob(*mut c_void);
    // The job handle is owned, never accessed concurrently, and only closes on Drop.
    unsafe impl Send for ProcessJob {}
    impl ProcessJob {
        pub fn with_live_member(&self, pid: u32, executable: &Path, minimum_start: u64, action: impl FnOnce() -> bool) -> Result<bool> {
            use std::os::windows::ffi::OsStringExt;
            struct ProcessHandle(*mut c_void);
            impl Drop for ProcessHandle { fn drop(&mut self) { unsafe { CloseHandle(self.0); } } }
            let raw = unsafe { OpenProcess(0x00101000, 0, pid) };
            if raw.is_null() {
                if unsafe { GetLastError() } == 87 { return Ok(false); }
                return Err(err("PROCESS_IDENTITY", "Cannot pin owned job member identity"));
            }
            let handle = ProcessHandle(raw);
            let mut member = 0;
            if unsafe { IsProcessInJob(handle.0, self.0, &mut member) } == 0 || member == 0 {
                return Err(err("PROCESS_IDENTITY", "Window process is no longer an owned job member"));
            }
            match unsafe { WaitForSingleObject(handle.0, 0) } {
                0 => return Ok(false),
                258 => {},
                _ => return Err(err("PROCESS_IDENTITY", "Cannot verify owned member liveness")),
            }
            let mut times = [FileTime::default(), FileTime::default(), FileTime::default(), FileTime::default()];
            let ptr = times.as_mut_ptr();
            if unsafe { GetProcessTimes(handle.0, ptr, ptr.add(1), ptr.add(2), ptr.add(3)) } == 0 {
                return Err(err("PROCESS_IDENTITY", "Cannot verify owned member creation time"));
            }
            if times[1].low != 0 || times[1].high != 0 { return Ok(false); }
            let start = (u64::from(times[0].high) << 32) | u64::from(times[0].low);
            if start < minimum_start { return Err(err("PROCESS_IDENTITY", "Owned member predates launch identity")); }
            let mut path = vec![0u16; 32768];
            let mut length = path.len() as u32;
            if unsafe { QueryFullProcessImageNameW(handle.0, 0, path.as_mut_ptr(), &mut length) } == 0 {
                return Err(err("PROCESS_IDENTITY", "Cannot verify owned member executable"));
            }
            let actual = PathBuf::from(std::ffi::OsString::from_wide(&path[..length as usize])).canonicalize().map_err(io)?;
            if actual != executable { return Ok(false); }
            // Keep this process handle pinned across the caller's HWND recheck
            // and close request, preventing PID reuse during the action.
            Ok(action())
        }
        pub fn process_ids(&self) -> Result<Vec<u32>> {
            #[repr(C)]
            struct Members { assigned: u32, listed: u32, ids: [usize; 256] }
            let mut members = Members { assigned: 0, listed: 0, ids: [0; 256] };
            let success = unsafe { QueryInformationJobObject(self.0, 3, &mut members as *mut _ as *mut c_void,
                std::mem::size_of::<Members>() as u32, std::ptr::null_mut()) };
            if success == 0 || members.assigned != members.listed || members.listed > 256 {
                return Err(err("PROCESS_JOB", "Cannot enumerate complete owned process job"));
            }
            members.ids[..members.listed as usize].iter().map(|pid| u32::try_from(*pid)
                .ok().filter(|pid| *pid != 0).ok_or_else(|| err("PROCESS_JOB", "Invalid owned process identity"))).collect()
        }
        pub fn is_empty(&self) -> Result<bool> {
            #[repr(C)]
            #[derive(Default)]
            struct Accounting {
                total_user: i64, total_kernel: i64, period_user: i64, period_kernel: i64,
                page_faults: u32, total_processes: u32, active_processes: u32, terminated_processes: u32,
            }
            let mut accounting = Accounting::default();
            let mut returned = 0;
            let success = unsafe { QueryInformationJobObject(self.0, 1, &mut accounting as *mut _ as *mut c_void,
                std::mem::size_of::<Accounting>() as u32, &mut returned) };
            if success == 0 || returned != std::mem::size_of::<Accounting>() as u32 {
                return Err(err("PROCESS_JOB", "Cannot verify owned process job completion"));
            }
            Ok(accounting.active_processes == 0)
        }
        pub fn attach(child: &mut Child, suspended: bool) -> Result<Self> {
            let mut limits = ExtendedLimits::default();
            limits.basic.flags = 0x2000; // JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE
            unsafe {
                let handle = CreateJobObjectW(std::ptr::null(), std::ptr::null());
                if handle.is_null() {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(err("PROCESS_JOB", "Cannot create owned process job"));
                }
                let job = Self(handle);
                if SetInformationJobObject(
                    handle,
                    9,
                    &limits as *const _ as *const c_void,
                    std::mem::size_of::<ExtendedLimits>() as u32,
                ) == 0
                    || AssignProcessToJobObject(handle, child.as_raw_handle()) == 0
                {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(err("PROCESS_JOB", "Cannot contain owned browser process"));
                }
                if suspended && NtResumeProcess(child.as_raw_handle()) < 0 {
                    let _ = child.kill();
                    let _ = child.wait();
                    return Err(err(
                        "PROCESS_JOB",
                        "Cannot resume contained browser process",
                    ));
                }
                Ok(job)
            }
        }
    }
    impl Drop for ProcessJob {
        fn drop(&mut self) {
            unsafe {
                CloseHandle(self.0);
            }
        }
    }
}
#[cfg(windows)]
pub(super) use native::ProcessJob;
#[cfg(not(windows))]
pub(super) struct ProcessJob;
#[cfg(not(windows))]
impl ProcessJob {
    pub fn process_ids(&self) -> Result<Vec<u32>> {
        Err(err("PROCESS_JOB_UNSUPPORTED", "Native process containment is only implemented on Windows"))
    }
    pub fn is_empty(&self) -> Result<bool> {
        Err(err("PROCESS_JOB_UNSUPPORTED", "Native process containment is only implemented on Windows"))
    }
    pub fn attach(child: &mut Child, _suspended: bool) -> Result<Self> {
        let _ = child.kill();
        let _ = child.wait();
        Err(err(
            "PROCESS_JOB_UNSUPPORTED",
            "Native process containment is only implemented on Windows",
        ))
    }
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    use std::os::windows::process::CommandExt;
    #[test]
    fn member_action_requires_live_owned_job_and_exact_executable() {
        let executable = PathBuf::from(std::env::var_os("SystemRoot").unwrap())
            .join("System32/WindowsPowerShell/v1.0/powershell.exe").canonicalize().unwrap();
        let spawn = || Command::new(&executable).args(["-NoProfile", "-NonInteractive", "-Command", "Start-Sleep -Seconds 30"])
            .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
            .creation_flags(0x08000004).spawn().unwrap();
        let mut owned = spawn();
        let job = ProcessJob::attach(&mut owned, true).unwrap();
        let mut foreign = spawn();
        // The suspended foreign fixture is not assigned to this private job.
        let result = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            assert!(job.process_ids().unwrap().contains(&owned.id()));
            assert!(job.with_live_member(owned.id(), &executable, 0, || true).unwrap());
            let mut acted = false;
            assert!(!job.with_live_member(owned.id(), Path::new("unrelated.exe"), 0, || { acted = true; true }).unwrap());
            assert!(!acted);
            assert!(job.with_live_member(owned.id(), &executable, u64::MAX, || { acted = true; true }).is_err());
            assert!(job.with_live_member(foreign.id(), &executable, 0, || { acted = true; true }).is_err());
            assert!(!acted);
        }));
        let _ = foreign.kill(); let _ = foreign.wait();
        drop(job); let _ = owned.wait();
        result.unwrap();
    }
    #[test]
    fn owned_job_is_empty_after_native_exit_with_retained_child_handle() {
        let mut child = Command::new("cmd.exe").args(["/d", "/c", "exit", "0"])
            .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
            .creation_flags(0x08000004).spawn().unwrap();
        let job = ProcessJob::attach(&mut child, true).unwrap();
        assert!(child.wait().unwrap().success());
        // Native accounting may settle asynchronously after exit. The retained
        // Child handle is not proof that a process remains live.
        let deadline = Instant::now() + Duration::from_secs(2);
        while !job.is_empty().unwrap() && Instant::now() < deadline { std::thread::sleep(Duration::from_millis(25)); }
        assert!(job.is_empty().unwrap(), "Exited process objects must not count as active job members");
        drop(child);
    }
    #[test]
    fn owned_job_remains_active_after_launcher_exits_with_a_contained_child() {
        let executable = PathBuf::from(std::env::var_os("SystemRoot").unwrap())
            .join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let script = "$p=New-Object System.Diagnostics.ProcessStartInfo; $p.FileName=(Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'); $p.Arguments='-NoProfile -NonInteractive -Command Start-Sleep -Seconds 30'; $p.UseShellExecute=$false; $p.CreateNoWindow=$true; [System.Diagnostics.Process]::Start($p) | Out-Null";
        let mut launcher = Command::new(executable).args(["-NoProfile", "-NonInteractive", "-Command", script])
            .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
            .creation_flags(0x08000004).spawn().unwrap();
        let job = ProcessJob::attach(&mut launcher, true).unwrap();
        assert!(launcher.wait().unwrap().success());
        drop(launcher);
        // Unlike a retained launcher object, this must still hold a live child.
        std::thread::sleep(Duration::from_millis(100));
        assert!(!job.is_empty().unwrap(), "Launcher exit cannot prove contained child exit");
        // The exact private test job owns the remaining child and closes it on drop.
        drop(job);
    }
    #[test]
    fn closing_owned_job_terminates_contained_process() {
        let executable = PathBuf::from(std::env::var_os("SystemRoot").unwrap())
            .join("System32/WindowsPowerShell/v1.0/powershell.exe");
        let mut child = Command::new(executable)
            .args([
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                "Start-Sleep -Seconds 30",
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .creation_flags(0x08000004)
            .spawn()
            .unwrap();
        let job = ProcessJob::attach(&mut child, true).unwrap();
        assert!(child.try_wait().unwrap().is_none());
        drop(job);
        let deadline = Instant::now() + Duration::from_secs(3);
        while child.try_wait().unwrap().is_none() && Instant::now() < deadline {
            std::thread::sleep(Duration::from_millis(10));
        }
        let result = child.try_wait().unwrap();
        if result.is_none() {
            let _ = child.kill();
            let _ = child.wait();
        }
        assert!(result.is_some(), "Job close must terminate its own process");
    }
}

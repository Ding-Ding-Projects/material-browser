//! A private Windows job terminates owned descendants when the supervisor disappears.
use super::*;

#[cfg(windows)]
mod native {
    use super::*;
    use std::{ffi::c_void, os::windows::io::AsRawHandle};
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
    fn owned_job_is_empty_after_native_exit_with_retained_child_handle() {
        let mut child = Command::new("cmd.exe").args(["/d", "/c", "exit", "0"])
            .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
            .creation_flags(0x08000004).spawn().unwrap();
        let job = ProcessJob::attach(&mut child, true).unwrap();
        assert!(child.wait().unwrap().success());
        assert!(!job.is_empty().unwrap(), "Retaining the exited Child keeps it accounted in the job");
        drop(child);
        let deadline = Instant::now() + Duration::from_secs(2);
        while !job.is_empty().unwrap() && Instant::now() < deadline { std::thread::sleep(Duration::from_millis(25)); }
        assert!(job.is_empty().unwrap(), "Exited process objects must not count as active job members");
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

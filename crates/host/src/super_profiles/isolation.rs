//! Disable per-distribution host integration before its first guest command.
use super::*;

// WSL preserves LXSS_DISTRO_FLAGS_VM_MODE (0x8) for WSL2. The documented
// interop, inherited Windows PATH and drive-mount flags occupy bits 0x1..0x4.
// https://github.com/microsoft/WSL/blob/ab075604403b08df668f5481d06844cd23d1e8eb/src/windows/service/inc/wslservice.idl
#[cfg(any(windows, test))]
fn isolated_configuration(version: u32, uid: u32, flags: u32) -> bool {
    version == 2 && uid == 0 && flags == 0x8
}

#[cfg(windows)]
pub(super) fn configure(distribution: &str) -> Result<()> {
    if !distribution.strip_prefix("MaterialBrowser-").is_some_and(valid_id) {
        return Err(error("OWNERSHIP_MISMATCH", "Only an owned distribution may be configured"));
    }
    use std::ffi::c_void;
    type Configure = unsafe extern "system" fn(*const u16, u32, u32) -> i32;
    type GetConfiguration = unsafe extern "system" fn(*const u16, *mut u32, *mut u32, *mut u32, *mut *mut *mut u8, *mut u32) -> i32;
    #[link(name = "kernel32")]
    unsafe extern "system" {
        fn LoadLibraryExW(name: *const u16, file: *mut c_void, flags: u32) -> *mut c_void;
        fn GetProcAddress(module: *mut c_void, name: *const u8) -> *const c_void;
        fn FreeLibrary(module: *mut c_void) -> i32;
    }
    #[link(name = "ole32")]
    unsafe extern "system" { fn CoTaskMemFree(memory: *mut c_void); }
    struct Module(*mut c_void);
    impl Drop for Module { fn drop(&mut self) { unsafe { FreeLibrary(self.0); } } }
    let dll: Vec<u16> = "wslapi.dll\0".encode_utf16().collect();
    // LOAD_LIBRARY_SEARCH_SYSTEM32 prevents resolving an application-local DLL.
    let module = Module(unsafe { LoadLibraryExW(dll.as_ptr(), std::ptr::null_mut(), 0x800) });
    if module.0.is_null() { return Err(error("WSL_CONFIGURATION_UNAVAILABLE", "The supported WSL configuration API is unavailable")); }
    let configure = unsafe { GetProcAddress(module.0, c"WslConfigureDistribution".as_ptr().cast()) };
    let get = unsafe { GetProcAddress(module.0, c"WslGetDistributionConfiguration".as_ptr().cast()) };
    if configure.is_null() || get.is_null() { return Err(error("WSL_CONFIGURATION_UNAVAILABLE", "WSL configuration entrypoints are unavailable")); }
    let configure: Configure = unsafe { std::mem::transmute(configure) };
    let get: GetConfiguration = unsafe { std::mem::transmute(get) };
    let name: Vec<u16> = distribution.encode_utf16().chain(Some(0)).collect();
    // The new distribution bootstraps as root; productive launches explicitly select the guest user.
    let configured = unsafe { configure(name.as_ptr(), 0, 0) };
    if configured < 0 {
        return Err(error("WSL_CONFIGURATION_FAILED", &format!("Owned distribution configuration API failed (HRESULT 0x{:08X})", configured as u32)));
    }
    let (mut version, mut uid, mut flags, mut count) = (0u32, 0u32, u32::MAX, 0u32);
    let mut environment: *mut *mut u8 = std::ptr::null_mut();
    let status = unsafe { get(name.as_ptr(), &mut version, &mut uid, &mut flags, &mut environment, &mut count) };
    if status >= 0 && !environment.is_null() {
        for index in 0..count { unsafe { CoTaskMemFree((*environment.add(index as usize)).cast()); } }
        unsafe { CoTaskMemFree(environment.cast()); }
    }
    if status < 0 {
        return Err(error("WSL_CONFIGURATION_FAILED", &format!("Owned distribution readback API failed (HRESULT 0x{:08X})", status as u32)));
    }
    if !isolated_configuration(version, uid, flags) {
        return Err(error("WSL_CONFIGURATION_FAILED", "Owned distribution host integration readback did not match"));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::isolated_configuration;
    #[test]
    fn wsl2_vm_flag_is_preserved_but_every_host_integration_bit_is_rejected() {
        assert!(isolated_configuration(2, 0, 8));
        for flags in [0, 1, 2, 4, 9, 10, 12, 15, 16, 24, u32::MAX] {
            assert!(!isolated_configuration(2, 0, flags));
        }
        assert!(!isolated_configuration(1, 0, 8));
        assert!(!isolated_configuration(2, 1000, 8));
    }
}

#[cfg(not(windows))]
pub(super) fn configure(_distribution: &str) -> Result<()> {
    Err(error("PLATFORM_UNSUPPORTED", "WSL configuration requires the supported Windows host"))
}

//! Verifies explicitly selected staged Linux installers before guest-only execution.
use super::*;
use sha2::{Digest, Sha256};
use std::io::Write;
const MAX_INSTALLERS: usize = 10_000;
const MAX_BYTES: u64 = 32 * 1024 * 1024 * 1024;
fn inspect(path: &Path) -> Result<()> {
    for ancestor in path.ancestors() {
        let metadata = fs::symlink_metadata(ancestor).map_err(io_error)?;
        if metadata.file_type().is_symlink() {
            return Err(error(
                "UNSAFE_INSTALLER",
                "Installer paths must not contain symbolic links",
            ));
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::MetadataExt;
            if metadata.file_attributes() & 0x400 != 0 {
                return Err(error(
                    "UNSAFE_INSTALLER",
                    "Installer paths must not contain reparse points",
                ));
            }
        }
    }
    Ok(())
}
fn digest(path: &Path) -> Result<String> {
    inspect(path)?;
    let mut options = fs::OpenOptions::new();
    options.read(true);
    #[cfg(target_os = "linux")]
    {
        use std::os::unix::fs::OpenOptionsExt;
        options.custom_flags(0x20000);
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::OpenOptionsExt;
        options.custom_flags(0x00200000);
        options.share_mode(1);
    }
    let mut file = options.open(path).map_err(io_error)?;
    let before = file.metadata().map_err(io_error)?;
    if !before.is_file() || before.len() > MAX_BYTES {
        return Err(error(
            "UNSAFE_INSTALLER",
            "Installer must be a bounded regular file",
        ));
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        if before.nlink() != 1 {
            return Err(error(
                "UNSAFE_INSTALLER",
                "Installer hard links are not allowed",
            ));
        }
    }
    #[cfg(windows)]
    {
        use std::os::windows::io::AsRawHandle;
        #[repr(C)]
        struct Info {
            attributes: u32,
            creation: [u32; 2],
            access: [u32; 2],
            write: [u32; 2],
            volume: u32,
            size_high: u32,
            size_low: u32,
            links: u32,
            index_high: u32,
            index_low: u32,
        }
        #[link(name = "kernel32")]
        unsafe extern "system" {
            fn GetFileInformationByHandle(handle: *mut std::ffi::c_void, info: *mut Info) -> i32;
        }
        let mut info = std::mem::MaybeUninit::<Info>::uninit();
        if unsafe { GetFileInformationByHandle(file.as_raw_handle(), info.as_mut_ptr()) } == 0 {
            return Err(io_error(std::io::Error::last_os_error()));
        }
        let info = unsafe { info.assume_init() };
        if info.links != 1 || info.attributes & 0x400 != 0 {
            return Err(error("UNSAFE_INSTALLER", "Installer links are not allowed"));
        }
    }
    let mut hash = Sha256::new();
    let mut buffer = [0u8; 65536];
    let mut count = 0u64;
    loop {
        let n = file.read(&mut buffer).map_err(io_error)?;
        if n == 0 {
            break;
        }
        count += n as u64;
        if count > before.len() {
            return Err(error(
                "INSTALLER_CHANGED",
                "Staged installer changed while hashing",
            ));
        }
        hash.update(&buffer[..n]);
    }
    let after = file.metadata().map_err(io_error)?;
    if count != before.len()
        || after.len() != before.len()
        || after.modified().ok() != before.modified().ok()
    {
        return Err(error(
            "INSTALLER_CHANGED",
            "Staged installer changed while hashing",
        ));
    }
    Ok(format!("{:x}", hash.finalize()))
}
fn kind(name: &str) -> Result<&'static str> {
    if name.is_empty()
        || name
            .chars()
            .any(|c| c.is_control() || c == '/' || c == '\\')
    {
        return Err(error("UNSAFE_INSTALLER", "Installer filename is invalid"));
    }
    match Path::new(name).extension().and_then(|x| x.to_str()) {
        Some("deb") => Ok("deb"),
        Some("sh") => Ok("sh"),
        _ => Err(error(
            "INSTALLER_UNSUPPORTED",
            "Linux installers must be .deb packages or .sh scripts",
        )),
    }
}
/// Hashes the actual owned staged bytes, not their original source path.
/// Call before launching the guest and include both manifests in its input archive.
pub(super) fn prepare(directory: &Path) -> Result<bool> {
    let input = directory.join("input");
    let installers = input.join("installers");
    inspect(&installers)?;
    let mut entries = Vec::new();
    let mut sums = String::new();
    let mut total = 0u64;
    let mut paths = fs::read_dir(&installers)
        .map_err(io_error)?
        .take(MAX_INSTALLERS + 1)
        .map(|entry| entry.map(|e| e.path()).map_err(io_error))
        .collect::<Result<Vec<_>>>()?;
    if paths.len() > MAX_INSTALLERS {
        return Err(error("INSTALLER_LIMIT", "Too many installers"));
    }
    paths.sort();
    for path in paths {
        let filename = path
            .file_name()
            .and_then(|n| n.to_str())
            .ok_or_else(|| error("UNSAFE_INSTALLER", "Installer filename must be Unicode"))?;
        let package_kind = kind(filename)?;
        let sha256 = digest(&path)?;
        total = total
            .checked_add(fs::metadata(&path).map_err(io_error)?.len())
            .ok_or_else(|| error("INSTALLER_LIMIT", "Installer bytes exceed limit"))?;
        if total > MAX_BYTES {
            return Err(error("INSTALLER_LIMIT", "Installer bytes exceed 32 GiB"));
        }
        entries.push(json!({"file":filename,"sha256":sha256,"kind":package_kind}));
        sums.push_str(&format!("{sha256}  ./{filename}\n"));
    }
    let nonempty = !entries.is_empty();
    let manifest = serde_json::to_vec_pretty(&json!({"version":1,"installers":entries}))
        .map_err(|_| error("SERIALIZATION", "Cannot serialize installer manifest"))?;
    for (name, bytes) in [
        ("installer-manifest.json", manifest.as_slice()),
        ("installer-checksums.sha256", sums.as_bytes()),
    ] {
        let mut output = fs::OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(input.join(name))
            .map_err(io_error)?;
        output.write_all(bytes).map_err(io_error)?;
        output.sync_all().map_err(io_error)?;
    }
    Ok(nonempty)
}
const INSTALL_SCRIPT: &str = r#"set -eu
cd /home/materialbrowser/.material-browser/input/installers
test -f ../installer-checksums.sha256
if [ ! -s ../installer-checksums.sha256 ]; then exit 0; fi
sha256sum --strict -c ../installer-checksums.sha256
export DEBIAN_FRONTEND=noninteractive
for installer in ./*.deb; do
    [ -f "$installer" ] || continue
    apt-get -o Acquire::AllowInsecureRepositories=false -o APT::Get::AllowUnauthenticated=false install -y --no-install-recommends -- "$installer"
done
for installer in ./*.sh; do
    [ -f "$installer" ] || continue
    runuser -u materialbrowser -- sh "$installer"
done
"#;
/// Runs only inside the uniquely owned guest, never on the host.
pub(super) fn install(distribution: &str) -> Result<()> {
    run(
        &[
            "-d",
            distribution,
            "-u",
            "root",
            "--exec",
            "sh",
            "-lc",
            INSTALL_SCRIPT,
        ],
        Duration::from_secs(900),
    )?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    fn stage() -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("material-installers-{}", crate::random_hex()));
        fs::create_dir_all(path.join("input/installers")).unwrap();
        path
    }
    #[test]
    fn hashes_staged_bytes_and_retains_separate_manifest() {
        let root = stage();
        fs::write(root.join("input/installers/setup.sh"), b"echo guest only\n").unwrap();
        assert!(prepare(&root).unwrap());
        let manifest: Value =
            serde_json::from_slice(&fs::read(root.join("input/installer-manifest.json")).unwrap())
                .unwrap();
        assert_eq!(manifest["installers"][0]["file"], "setup.sh");
        assert_eq!(manifest["installers"][0]["kind"], "sh");
        let checksum = digest(&root.join("input/installers/setup.sh")).unwrap();
        assert_eq!(manifest["installers"][0]["sha256"], checksum);
        assert!(
            fs::read_to_string(root.join("input/installer-checksums.sha256"))
                .unwrap()
                .contains(&format!("{checksum}  ./setup.sh"))
        );
        assert!(prepare(&root).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn unsupported_files_fail_before_manifest_creation() {
        let root = stage();
        fs::write(root.join("input/installers/host.exe"), b"not supported").unwrap();
        assert_eq!(prepare(&root).unwrap_err().code, "INSTALLER_UNSUPPORTED");
        assert!(!root.join("input/installer-manifest.json").exists());
        fs::remove_dir_all(root).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn rejects_links_and_control_character_names() {
        use std::os::unix::fs::symlink;
        let root = stage();
        fs::write(root.join("original"), b"echo content").unwrap();
        symlink(root.join("original"), root.join("input/installers/link.sh")).unwrap();
        assert!(prepare(&root).is_err());
        fs::remove_file(root.join("input/installers/link.sh")).unwrap();
        fs::hard_link(
            root.join("original"),
            root.join("input/installers/hardlink.sh"),
        )
        .unwrap();
        assert!(prepare(&root).is_err());
        assert!(kind("bad\nname.sh").is_err());
        fs::remove_dir_all(root).unwrap();
    }
}

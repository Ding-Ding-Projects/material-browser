//! Copies explicit user-selected guest inputs without executing them on the host.
use crate::{Result, error, io_error};
use serde_json::Value;
use std::{
    collections::BTreeSet,
    fs::{self, File, Metadata, OpenOptions},
    io::{Read, Write},
    path::{Component, Path},
};
const MAX_FILES: usize = 10_000;
const MAX_BYTES: u64 = 32 * 1024 * 1024 * 1024;
const MAX_SCRIPT: usize = 1024 * 1024;
#[derive(Default)]
struct Budget {
    entries: usize,
    bytes: u64,
}
impl Budget {
    fn entry(&mut self) -> Result<()> {
        self.entries += 1;
        if self.entries > MAX_FILES {
            return Err(error("PAYLOAD_LIMIT", "Too many payload entries"));
        }
        Ok(())
    }
    fn bytes(&mut self, n: u64) -> Result<()> {
        self.bytes = self
            .bytes
            .checked_add(n)
            .ok_or_else(|| error("PAYLOAD_LIMIT", "Payload exceeds size limit"))?;
        if self.bytes > MAX_BYTES {
            return Err(error("PAYLOAD_LIMIT", "Payload exceeds 32 GiB"));
        }
        Ok(())
    }
}
fn plain(metadata: &Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return false;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return false;
        }
    }
    metadata.is_file() || metadata.is_dir()
}
fn ancestors(path: &Path) -> Result<()> {
    if path
        .components()
        .any(|c| matches!(c, Component::ParentDir | Component::CurDir))
    {
        return Err(error("UNSAFE_PAYLOAD_PATH", "Traversal is not allowed"));
    }
    for ancestor in path.ancestors() {
        match fs::symlink_metadata(ancestor) {
            Ok(metadata) if !plain(&metadata) => {
                return Err(error(
                    "UNSAFE_PAYLOAD_PATH",
                    "Linked or special payload paths are not allowed",
                ));
            }
            Ok(_) => (),
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => (),
            Err(e) => return Err(io_error(e)),
        }
    }
    Ok(())
}
fn linked(file: &File, metadata: &Metadata) -> Result<bool> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::MetadataExt;
        let _ = file;
        return Ok(metadata.nlink() != 1);
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
        let _ = metadata;
        return Ok(info.links != 1 || info.attributes & 0x400 != 0);
    }
    #[cfg(not(any(unix, windows)))]
    {
        let _ = (file, metadata);
        Err(error(
            "PLATFORM_UNSUPPORTED",
            "Payload link verification is unavailable",
        ))
    }
}
fn safe_name(name: &std::ffi::OsStr) -> Result<String> {
    let name = name
        .to_str()
        .ok_or_else(|| error("UNSAFE_PAYLOAD_PATH", "Payload names must be Unicode"))?;
    let stem = name.split('.').next().unwrap_or("").to_ascii_uppercase();
    if name.is_empty()
        || name.ends_with([' ', '.'])
        || name
            .chars()
            .any(|c| c.is_control() || "<>:\"/\\|?*".contains(c))
        || [
            "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7",
            "COM8", "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
        ]
        .contains(&stem.as_str())
    {
        return Err(error("UNSAFE_PAYLOAD_PATH", "Unsupported payload filename"));
    }
    Ok(name.to_lowercase())
}
fn copy_file(source: &Path, destination: &Path, budget: &mut Budget) -> Result<()> {
    ancestors(source)?;
    ancestors(destination)?;
    let mut options = OpenOptions::new();
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
    let mut input = options.open(source).map_err(io_error)?;
    let before = input.metadata().map_err(io_error)?;
    if !before.is_file() || !plain(&before) || linked(&input, &before)? {
        return Err(error(
            "UNSAFE_PAYLOAD_PATH",
            "Payload files must be regular files without hard links",
        ));
    }
    budget.bytes(before.len())?;
    let mut output = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)
        .map_err(io_error)?;
    let mut count = 0u64;
    let mut buffer = [0u8; 65536];
    loop {
        let n = input.read(&mut buffer).map_err(io_error)?;
        if n == 0 {
            break;
        }
        count += n as u64;
        if count > before.len() {
            return Err(error("PAYLOAD_CHANGED", "Payload changed while copying"));
        }
        output.write_all(&buffer[..n]).map_err(io_error)?;
    }
    let after = input.metadata().map_err(io_error)?;
    if count != before.len()
        || after.len() != before.len()
        || after.modified().ok() != before.modified().ok()
        || linked(&input, &after)?
    {
        return Err(error("PAYLOAD_CHANGED", "Payload changed while copying"));
    }
    output.sync_all().map_err(io_error)
}
fn copy_directory(
    source: &Path,
    destination: &Path,
    budget: &mut Budget,
    depth: usize,
) -> Result<()> {
    if depth > 64 {
        return Err(error(
            "PAYLOAD_LIMIT",
            "Payload directory nesting exceeds limit",
        ));
    }
    ancestors(source)?;
    ancestors(destination)?;
    let metadata = fs::symlink_metadata(source).map_err(io_error)?;
    if !metadata.is_dir() || !plain(&metadata) {
        return Err(error(
            "UNSAFE_PAYLOAD_PATH",
            "Workspace must be an ordinary directory",
        ));
    }
    fs::create_dir(destination).map_err(io_error)?;
    let mut names = BTreeSet::new();
    for entry in fs::read_dir(source).map_err(io_error)? {
        let entry = entry.map_err(io_error)?;
        budget.entry()?;
        if !names.insert(safe_name(&entry.file_name())?) {
            return Err(error("PAYLOAD_COLLISION", "Payload filenames collide"));
        }
        let source = entry.path();
        let target = destination.join(entry.file_name());
        let metadata = fs::symlink_metadata(&source).map_err(io_error)?;
        if !plain(&metadata) {
            return Err(error(
                "UNSAFE_PAYLOAD_PATH",
                "Linked or special payload paths are not allowed",
            ));
        }
        if metadata.is_dir() {
            copy_directory(&source, &target, budget, depth + 1)?;
        } else {
            copy_file(&source, &target, budget)?;
        }
    }
    Ok(())
}
fn commands(settings: &Value, key: &str) -> Result<Vec<String>> {
    let Some(value) = settings.get(key) else {
        return Ok(Vec::new());
    };
    let values = value
        .as_array()
        .filter(|v| v.len() <= 1024)
        .ok_or_else(|| error("INVALID_PARAMS", "Commands must be a bounded text array"))?;
    let mut total = 0usize;
    values
        .iter()
        .map(|v| {
            let value = v.as_str().filter(|s| !s.contains('\0')).ok_or_else(|| {
                error("INVALID_PARAMS", "Command must be text without null bytes")
            })?;
            total += value.len();
            if total > MAX_SCRIPT {
                return Err(error("PAYLOAD_LIMIT", "Command script exceeds size limit"));
            }
            Ok(value.to_string())
        })
        .collect()
}
fn script(path: &Path, body: &str, budget: &mut Budget) -> Result<()> {
    budget.entry()?;
    budget.bytes(body.len() as u64)?;
    let mut f = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(io_error)?;
    f.write_all(body.as_bytes()).map_err(io_error)?;
    f.sync_all().map_err(io_error)
}
/// Destination is an owned session directory. A failed stage is retained for inspection.
pub(super) fn stage(settings: &Value, destination: &Path) -> Result<()> {
    if !settings.is_object() {
        return Err(error("INVALID_PARAMS", "Settings must be an object"));
    }
    ancestors(destination)?;
    if !destination.is_absolute() || !destination.is_dir() {
        return Err(error(
            "UNSAFE_PAYLOAD_PATH",
            "Staging destination must be an existing absolute directory",
        ));
    }
    let setup = commands(settings, "setupCommands")?;
    let startup = commands(settings, "startupCommands")?;
    let input = destination.join("input");
    fs::create_dir(&input).map_err(io_error)?;
    let state = input.join("state");
    fs::create_dir(&state).map_err(io_error)?;
    let mut budget = Budget::default();
    if let Some(workspace) = settings.get("workspacePath") {
        let workspace = workspace
            .as_str()
            .filter(|s| !s.is_empty())
            .ok_or_else(|| error("INVALID_PARAMS", "Workspace path must be nonempty text"))?;
        let source = Path::new(workspace);
        if !source.is_absolute() {
            return Err(error(
                "UNSAFE_PAYLOAD_PATH",
                "Workspace path must be absolute",
            ));
        }
        let source_real = fs::canonicalize(source).map_err(io_error)?;
        let destination_real = fs::canonicalize(destination).map_err(io_error)?;
        if source_real.starts_with(&destination_real) || destination_real.starts_with(&source_real)
        {
            return Err(error(
                "UNSAFE_PAYLOAD_PATH",
                "Workspace and session staging must be separate",
            ));
        }
        copy_directory(source, &state.join("workspace"), &mut budget, 0)?;
    } else {
        fs::create_dir(state.join("workspace")).map_err(io_error)?;
    }
    let installers = input.join("installers");
    fs::create_dir(&installers).map_err(io_error)?;
    if let Some(values) = settings.get("installers") {
        let values = values
            .as_array()
            .filter(|v| v.len() <= MAX_FILES)
            .ok_or_else(|| error("INVALID_PARAMS", "Installers must be a bounded path array"))?;
        let mut names = BTreeSet::new();
        for value in values {
            let source = Path::new(
                value
                    .as_str()
                    .ok_or_else(|| error("INVALID_PARAMS", "Installer path must be text"))?,
            );
            if !source.is_absolute() {
                return Err(error(
                    "UNSAFE_PAYLOAD_PATH",
                    "Installer path must be absolute",
                ));
            }
            let name = source
                .file_name()
                .ok_or_else(|| error("UNSAFE_PAYLOAD_PATH", "Installer requires a filename"))?;
            if !names.insert(safe_name(name)?) {
                return Err(error("PAYLOAD_COLLISION", "Installer filenames collide"));
            }
            budget.entry()?;
            copy_file(source, &installers.join(name), &mut budget)?;
        }
    }
    for (name, values) in [("setup", setup), ("startup", startup)] {
        script(
            &input.join(format!("{name}.sh")),
            &format!("#!/bin/sh\nset -eu\n{}\n", values.join("\n")),
            &mut budget,
        )?;
        script(
            &input.join(format!("{name}.ps1")),
            &format!(
                "$ErrorActionPreference = 'Stop'\r\n{}\r\n",
                values.iter().map(|command| format!("$global:LASTEXITCODE = 0\r\n{command}\r\nif (!$? -or $global:LASTEXITCODE -ne 0) {{ throw 'Guest command returned a nonzero result' }}")).collect::<Vec<_>>().join("\r\n")
            ),
            &mut budget,
        )?;
    }
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    fn root() -> std::path::PathBuf {
        let root = std::env::temp_dir().join(format!("material-payload-{}", crate::random_hex()));
        fs::create_dir(&root).unwrap();
        root
    }
    #[test]
    fn copies_explicit_inputs_and_separates_scripts() {
        let root = root();
        let source = root.join("source");
        let dest = root.join("session");
        fs::create_dir(&source).unwrap();
        fs::create_dir(&dest).unwrap();
        fs::write(source.join("note.txt"), b"workspace").unwrap();
        let installer = root.join("tool.bin");
        fs::write(&installer, b"installer").unwrap();
        stage(&json!({"workspacePath":source,"installers":[installer],"setupCommands":["echo setup"],"startupCommands":["echo startup"]}),&dest).unwrap();
        assert_eq!(
            fs::read(dest.join("input/state/workspace/note.txt")).unwrap(),
            b"workspace"
        );
        assert!(
            fs::read_to_string(dest.join("input/setup.sh"))
                .unwrap()
                .contains("echo setup")
        );
        assert!(
            !fs::read_to_string(dest.join("input/setup.sh"))
                .unwrap()
                .contains("echo startup")
        );
        assert!(stage(&json!({}), &dest).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn refuses_hardlinks_and_case_collisions() {
        let root = root();
        let source = root.join("file");
        fs::write(&source, b"data").unwrap();
        let link = root.join("link");
        fs::hard_link(&source, &link).unwrap();
        let dest = root.join("session");
        fs::create_dir(&dest).unwrap();
        assert!(stage(&json!({"installers":[source]}), &dest).is_err());
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn refuses_case_colliding_installers() {
        let root = root();
        let first = root.join("one");
        let second = root.join("two");
        fs::create_dir(&first).unwrap();
        fs::create_dir(&second).unwrap();
        fs::write(first.join("Tool.exe"), b"one").unwrap();
        fs::write(second.join("tool.exe"), b"two").unwrap();
        let destination = root.join("session");
        fs::create_dir(&destination).unwrap();
        let result = stage(
            &json!({"installers":[first.join("Tool.exe"),second.join("tool.exe")]}),
            &destination,
        );
        assert_eq!(result.unwrap_err().code, "PAYLOAD_COLLISION");
        fs::remove_dir_all(root).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn refuses_symlink_ancestors_and_workspace_links() {
        use std::os::unix::fs::symlink;
        let root = root();
        let source = root.join("source");
        fs::create_dir(&source).unwrap();
        fs::write(source.join("file"), b"private").unwrap();
        symlink(source.join("file"), source.join("link")).unwrap();
        let dest = root.join("session");
        fs::create_dir(&dest).unwrap();
        assert!(stage(&json!({"workspacePath":source}), &dest).is_err());
        let linked = root.join("linked");
        symlink(&dest, &linked).unwrap();
        assert!(stage(&json!({}), &linked).is_err());
        fs::remove_dir_all(root).unwrap();
    }
}

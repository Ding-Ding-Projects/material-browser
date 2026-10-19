//! Convert verified filesystem identities only at external runtime boundaries.
use super::*;

pub(super) fn external_runtime_path(path: &Path) -> Result<PathBuf> {
    if !path.is_absolute() || path.to_str().is_none() {
        return Err(err("INVALID_ADAPTER_PATH", "Runtime path must be absolute and representable"));
    }
    #[cfg(windows)]
    ordinary_windows_path(path)?;
    let canonical = path.canonicalize().map_err(io)?;
    #[cfg(windows)]
    let external = ordinary_windows_path(&canonical)?;
    #[cfg(not(windows))]
    let external = canonical.clone();
    if external.to_str().is_none() || external.canonicalize().map_err(io)? != canonical {
        return Err(err("INVALID_ADAPTER_PATH", "Runtime path spelling changes its verified identity"));
    }
    Ok(external)
}

#[cfg(windows)]
fn ordinary_windows_path(path: &Path) -> Result<PathBuf> {
    use std::{ffi::OsString, path::{Component, Prefix}};
    let invalid = || err("INVALID_ADAPTER_PATH", "Unsupported runtime path namespace");
    let mut components = path.components();
    let Some(Component::Prefix(prefix)) = components.next() else { return Err(invalid()); };
    let mut spelling = OsString::new();
    match prefix.kind() {
        Prefix::VerbatimDisk(letter) | Prefix::Disk(letter) => {
            spelling.push(format!("{}:\\", char::from(letter)));
        }
        Prefix::VerbatimUNC(server, share) | Prefix::UNC(server, share) => {
            spelling.push(r"\\"); spelling.push(server); spelling.push(r"\");
            spelling.push(share); spelling.push(r"\");
        }
        _ => return Err(invalid()),
    }
    if !matches!(components.next(), Some(Component::RootDir)) { return Err(invalid()); }
    let mut external = PathBuf::from(spelling);
    for component in components {
        match component {
            Component::Normal(name) => external.push(name),
            _ => return Err(invalid()),
        }
    }
    Ok(external)
}

#[cfg(all(test, windows))]
mod tests {
    use super::*;
    #[test]
    fn runtime_paths_preserve_identity_without_extended_prefixes() {
        let root = std::env::temp_dir().join(format!("material-runtime-path-{}-{}", std::process::id(),
            std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos()));
        fs::create_dir(&root).unwrap();
        let directory = root.join("space and 中文");
        fs::create_dir(&directory).unwrap();
        let file = directory.join("helper.cjs");
        fs::write(&file, b"synthetic path fixture").unwrap();
        for input in [&file, &directory] {
            let canonical = input.canonicalize().unwrap();
            let external = external_runtime_path(&canonical).unwrap();
            assert!(!external.as_os_str().to_string_lossy().starts_with(r"\\?\"));
            assert_eq!(external.canonicalize().unwrap(), canonical);
            assert_eq!(external_runtime_path(input).unwrap(), external);
        }
        assert!(external_runtime_path(Path::new("relative.cjs")).is_err());
        assert!(external_runtime_path(Path::new(r"C:relative.cjs")).is_err());
        assert!(external_runtime_path(Path::new(r"\\.\C:\helper.cjs")).is_err());
        let trailing = root.canonicalize().unwrap().join("trailing.");
        fs::write(&trailing, b"namespace-sensitive fixture").unwrap();
        assert!(external_runtime_path(&trailing).is_err());
        fs::remove_dir_all(&root).unwrap();
    }

    #[test]
    fn namespace_conversion_is_narrow_and_unc_aware() {
        assert_eq!(ordinary_windows_path(Path::new(r"\\?\UNC\server\share\space name\helper.cjs")).unwrap(),
            PathBuf::from(r"\\server\share\space name\helper.cjs"));
        for invalid in [r"\\.\C:\helper.cjs", r"\\?\GLOBALROOT\Device\HarddiskVolume1\helper.cjs",
            r"C:relative.cjs", "relative.cjs"] {
            assert!(ordinary_windows_path(Path::new(invalid)).is_err());
        }
    }
}

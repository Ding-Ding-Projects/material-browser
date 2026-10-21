//! Inspect archive headers directly before any guest output is extracted or persisted.
use super::*;
use std::collections::BTreeSet;

pub(super) fn safe_member(name: &str) -> bool {
    if name.is_empty() || name.len() > 4096 || name.chars().any(|c| c.is_control())
        || name.contains(['\\', ':', '<', '>', '"', '|', '?', '*']) || name.starts_with('/') { return false; }
    let parts: Vec<_> = name.trim_end_matches('/').split('/').collect();
    if !matches!(parts.first(), Some(&"browser" | &"workspace")) { return false; }
    parts.iter().all(|p| {
        if p.is_empty() || *p == "." || *p == ".." || p.ends_with(['.', ' ']) { return false; }
        let stem = p.split('.').next().unwrap_or("").to_ascii_uppercase();
        !matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL" | "CLOCK$" | "CONIN$" | "CONOUT$" | "COM¹" | "COM²" | "COM³" | "LPT¹" | "LPT²" | "LPT³")
            && !(stem.len() == 4 && (stem.starts_with("COM") || stem.starts_with("LPT"))
                && matches!(stem.as_bytes()[3], b'1'..=b'9'))
    })
}

pub(super) fn validate_archive(path: &Path) -> Result<()> {
    let file = fs::File::open(path).map_err(io_error)?;
    if file.metadata().map_err(io_error)?.len() > 32 * 1024 * 1024 * 1024 {
        return Err(error("ARCHIVE_LIMIT", "Saved archive exceeds the supported size"));
    }
    let mut archive = tar::Archive::new(file);
    let mut names = BTreeSet::new();
    let mut total = 0u64;
    let entries = archive.entries().map_err(|_| error("UNSAFE_ARCHIVE", "Invalid archive headers"))?;
    for (index, item) in entries.enumerate() {
        if index >= 10000 { return Err(error("ARCHIVE_LIMIT", "Saved archive has too many entries")); }
        let mut entry = item.map_err(|_| error("UNSAFE_ARCHIVE", "Invalid archive entry"))?;
        let name = entry.path().map_err(|_| error("UNSAFE_ARCHIVE", "Invalid archive path"))?
            .to_str().ok_or_else(|| error("UNSAFE_ARCHIVE", "Archive paths must be Unicode"))?.to_owned();
        let kind = entry.header().entry_type();
        if !safe_member(&name) || !(kind.is_file() || kind.is_dir())
            || !names.insert(name.trim_end_matches('/').to_uppercase().to_lowercase()) {
            return Err(error("UNSAFE_ARCHIVE", "Archive contains unsafe, duplicate or linked paths"));
        }
        total = total.checked_add(entry.size()).ok_or_else(|| error("ARCHIVE_LIMIT", "Archive size overflow"))?;
        if total > 32 * 1024 * 1024 * 1024 { return Err(error("ARCHIVE_LIMIT", "Expanded archive exceeds limit")); }
        // Read every member to catch truncation before publishing a revision.
        let read = std::io::copy(&mut entry, &mut std::io::sink()).map_err(io_error)?;
        if read != entry.size() { return Err(error("UNSAFE_ARCHIVE", "Truncated archive member")); }
    }
    if names.is_empty() { return Err(error("UNSAFE_ARCHIVE", "Archive is empty")); }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn rejects_cross_platform_escapes_and_device_paths() {
        for p in ["browser/file", "workspace/nested/file", "workspace/"] { assert!(safe_member(p), "{p}"); }
        for p in ["/browser/file", "workspace/../file", "workspace/./file", "workspace//file", "browser/a:b", "workspace/CON.txt", "workspace/com1", "workspace/COM¹.txt", "workspace/a*b", "workspace/a?b", "workspace/trailing.", "workspace/a\nfile", "workspace\\file", "etc/passwd"] { assert!(!safe_member(p), "{p}"); }
    }
    #[test]
    fn unicode_case_collisions_are_rejected_before_extraction() {
        let path = std::env::temp_dir().join(format!("material-archive-{}.tar", crate::random_hex()));
        let file = fs::File::create(&path).unwrap();
        let mut builder = tar::Builder::new(file);
        for name in ["workspace/Ä.txt", "workspace/ä.txt"] {
            let mut header = tar::Header::new_gnu();
            header.set_size(1);
            header.set_mode(0o600);
            header.set_cksum();
            builder.append_data(&mut header, name, &b"x"[..]).unwrap();
        }
        builder.finish().unwrap();
        drop(builder);
        assert_eq!(validate_archive(&path).unwrap_err().code, "UNSAFE_ARCHIVE");
        fs::remove_file(path).unwrap();
    }
}

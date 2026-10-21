//! Remove decrypted session staging only after the owned guest has been removed.
use super::*;
fn linked(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() { return true; }
    #[cfg(windows)] {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 { return true; }
    }
    false
}
fn inspect(path: &Path, count: &mut usize, depth: usize) -> Result<()> {
    *count += 1;
    if *count > 100000 || depth > 128 { return Err(error("CLEANUP_LIMIT", "Session cleanup inventory exceeds limit")); }
    let metadata = fs::symlink_metadata(path).map_err(io_error)?;
    if linked(&metadata) || !(metadata.is_file() || metadata.is_dir()) {
        return Err(error("CLEANUP_UNSAFE_PATH", "Linked or special staging data requires manual recovery"));
    }
    if metadata.is_dir() {
        for item in fs::read_dir(path).map_err(io_error)? { inspect(&item.map_err(io_error)?.path(), count, depth + 1)?; }
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn removal_receipt_and_complete_inventory_precede_deletion() {
        let directory = std::env::temp_dir().join(crate::random_hex());
        fs::create_dir(&directory).unwrap();
        let id = directory.file_name().unwrap().to_str().unwrap();
        fs::write(directory.join("ownership.json"), json!({"id":id,"guestRemoved":false}).to_string()).unwrap();
        fs::write(directory.join("state.tar"), b"synthetic data").unwrap();
        assert!(wipe(&directory).is_err());
        assert!(directory.join("state.tar").exists());
        fs::write(directory.join("ownership.json"), json!({"id":id,"guestRemoved":true}).to_string()).unwrap();
        fs::write(directory.join("unrecognized"), b"retain").unwrap();
        assert!(wipe(&directory).is_err());
        assert!(directory.join("state.tar").exists());
        fs::remove_file(directory.join("unrecognized")).unwrap();
        wipe(&directory).unwrap();
        assert!(!directory.join("state.tar").exists());
        assert!(directory.join("ownership.json").exists());
        fs::remove_dir_all(directory).unwrap();
    }
}
pub(super) fn wipe(directory: &Path) -> Result<()> {
    let name = directory.file_name().and_then(|s| s.to_str()).unwrap_or("");
    if !valid_id(name) { return Err(error("OWNERSHIP_MISMATCH", "Invalid session cleanup identity")); }
    for ancestor in directory.ancestors() {
        if linked(&fs::symlink_metadata(ancestor).map_err(io_error)?) {
            return Err(error("CLEANUP_UNSAFE_PATH", "Session cleanup ancestor is linked"));
        }
    }
    let journal_path = directory.join("ownership.json");
    let mut count = 0;
    inspect(&journal_path, &mut count, 0)?;
    let journal: Value = serde_json::from_slice(&fs::read(journal_path).map_err(io_error)?)
        .map_err(|_| error("INVALID_SESSION_JOURNAL", "Invalid cleanup ownership record"))?;
    if journal["id"] != name || journal["guestRemoved"] != true {
        return Err(error("OWNERSHIP_MISMATCH", "Guest removal must be recorded before staging cleanup"));
    }
    let mut selected = Vec::new();
    for item in fs::read_dir(directory).map_err(io_error)? {
        let item = item.map_err(io_error)?;
        let name = item.file_name().to_string_lossy().into_owned();
        if matches!(name.as_str(), "ownership.json" | "events.json") { continue; }
        let allowed = matches!(name.as_str(), "input" | "exchange" | "distribution" | "state.tar" | "input.tar" | "session.wsb" | "desktop.rdp" | "desktop-connection.ps1" | "ownership.tmp" | "cancel" | "cancel-requested")
            || name.strip_prefix("export-").and_then(|s| s.strip_suffix(".tar")).is_some_and(valid_id);
        if !allowed { return Err(error("CLEANUP_UNKNOWN_ENTRY", "Unexpected session entry retained for review")); }
        inspect(&item.path(), &mut count, 0)?;
        selected.push(item.path());
    }
    // Inventory completes before any deletion. No selected path is user source.
    for path in selected {
        let metadata = fs::symlink_metadata(&path).map_err(io_error)?;
        if linked(&metadata) { return Err(error("CLEANUP_UNSAFE_PATH", "Session staging changed during cleanup")); }
        if metadata.is_dir() { fs::remove_dir_all(path).map_err(io_error)?; }
        else { fs::remove_file(path).map_err(io_error)?; }
    }
    Ok(())
}

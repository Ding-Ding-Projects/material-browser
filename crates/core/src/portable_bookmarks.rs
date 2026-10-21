//! Strict portable bookmark documents, independent of native browser profile formats.
use crate::{Result, err};
use serde_json::{Value, json};

fn invalid() -> crate::CoreError {
    err(
        "INVALID_BOOKMARKS",
        "Invalid or oversized portable bookmark document",
    )
}
fn text(value: &Value, maximum: usize) -> Result<&str> {
    value
        .as_str()
        .filter(|s| {
            !s.is_empty() && s.chars().count() <= maximum && !s.chars().any(char::is_control)
        })
        .ok_or_else(invalid)
}
fn keys(value: &Value, allowed: &[&str]) -> Result<()> {
    if value
        .as_object()
        .is_none_or(|o| o.keys().any(|k| !allowed.contains(&k.as_str())))
    {
        return Err(invalid());
    }
    Ok(())
}
fn nodes(value: &Value, depth: usize, count: &mut usize) -> Result<()> {
    let entries = value.as_array().ok_or_else(invalid)?;
    if depth > 8 {
        return Err(invalid());
    }
    for entry in entries {
        *count += 1;
        if *count > 500 {
            return Err(invalid());
        }
        keys(entry, &["name", "url", "children"])?;
        text(&entry["name"], 256)?;
        match (entry.get("url"), entry.get("children")) {
            (Some(value), None) => {
                let raw = text(value, 4096)?;
                let parsed = url::Url::parse(raw).map_err(|_| invalid())?;
                if raw.trim() != raw
                    || !matches!(parsed.scheme(), "http" | "https")
                    || parsed.host_str().is_none()
                    || !parsed.username().is_empty()
                    || parsed.password().is_some()
                    || raw.contains('\\')
                {
                    return Err(invalid());
                }
                // Reject even empty userinfo, rather than silently normalizing it away.
                let authority = raw
                    .split_once("://")
                    .ok_or_else(invalid)?
                    .1
                    .split(['/', '?', '#'])
                    .next()
                    .unwrap_or_default();
                if authority.contains('@') {
                    return Err(invalid());
                }
            }
            (None, Some(children)) => nodes(children, depth + 1, count)?,
            _ => return Err(invalid()),
        }
    }
    Ok(())
}
pub fn validate(document: &Value) -> Result<()> {
    if serde_json::to_vec(document)?.len() > 64 * 1024 {
        return Err(invalid());
    }
    keys(document, &["version", "folderName", "bookmarks"])?;
    if document["version"].as_u64() != Some(1) {
        return Err(invalid());
    }
    text(&document["folderName"], 256)?;
    nodes(&document["bookmarks"], 1, &mut 0)
}
/// Converts validated data only, never arbitrary policy keys supplied by an importer.
pub fn managed_policy(document: &Value, firefox: bool) -> Result<Value> {
    validate(document)?;
    let mut entries = vec![json!({"toplevel_name":document["folderName"]})];
    entries.extend(document["bookmarks"].as_array().unwrap().iter().cloned());
    Ok(if firefox {
        json!({"policies":{"ManagedBookmarks":entries}})
    } else {
        json!({"ManagedBookmarks":entries})
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    fn sample(url: &str) -> Value {
        json!({"version":1,"folderName":"Imported","bookmarks":[{"name":"Example","url":url}]})
    }
    #[test]
    fn rejects_credentials_schemes_controls_and_unknown_fields() {
        for url in [
            "javascript:alert(1)",
            "file:///tmp/x",
            "data:text/plain,x",
            "https://user:pass@example.com",
            "https://@example.com",
            "https://example.com/\n",
            "https://example.com\\x",
            "https:example.com",
        ] {
            assert!(validate(&sample(url)).is_err(), "{url}");
        }
        let mut value = sample("https://example.com");
        value["bookmarks"][0]["favicon"] = json!("https://example.com/x");
        assert!(validate(&value).is_err());
        value = sample("https://example.com");
        value["bookmarks"][0]["children"] = json!([]);
        assert!(validate(&value).is_err());
    }
    #[test]
    fn enforces_document_node_depth_and_text_bounds() {
        let mut value = sample("https://example.com");
        value["bookmarks"] = Value::Array(vec![value["bookmarks"][0].clone(); 501]);
        assert!(validate(&value).is_err());
        value = sample("https://example.com");
        value["folderName"] = json!("x".repeat(257));
        assert!(validate(&value).is_err());
        let mut child = json!({"name":"leaf","url":"https://example.com"});
        for _ in 0..8 {
            child = json!({"name":"folder","children":[child]});
        }
        value = sample("https://example.com");
        value["bookmarks"] = json!([child]);
        assert!(validate(&value).is_err());
        value = sample("https://example.com");
        value["bookmarks"] = Value::Array(
            (0..500)
                .map(|_| json!({"name":"x".repeat(256),"url":"https://example.com"}))
                .collect(),
        );
        assert!(validate(&value).is_err());
    }
    #[test]
    fn policy_conversion_preserves_data_and_limits_keys() {
        let value = sample("https://example.com/path");
        let chrome = managed_policy(&value, false).unwrap();
        let firefox = managed_policy(&value, true).unwrap();
        assert_eq!(
            chrome["ManagedBookmarks"],
            firefox["policies"]["ManagedBookmarks"]
        );
        assert_eq!(chrome["ManagedBookmarks"][1], value["bookmarks"][0]);
        assert_eq!(chrome.as_object().unwrap().len(), 1);
    }
}

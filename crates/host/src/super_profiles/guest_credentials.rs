//! Protected guest credential handoff with bounded, non-sensitive diagnostics.
use super::*;
const RESULT_LIMIT: usize = 1024;
const STATUS_NAME: &str = "input/desktop-credentials-status.json";
#[derive(Clone, Copy, Debug, Deserialize, PartialEq)]
#[serde(rename_all = "kebab-case")]
enum Phase {
    Assembly,
    RandomInput,
    StartGuestCommand,
    WriteGuestInput,
    WaitGuestCommand,
    Protect,
    WriteConnectionFile,
    Complete,
}
impl Phase {
    fn name(self) -> &'static str {
        match self {
            Self::Assembly => "assembly",
            Self::RandomInput => "random-input",
            Self::StartGuestCommand => "start-guest-command",
            Self::WriteGuestInput => "write-guest-input",
            Self::WaitGuestCommand => "wait-guest-command",
            Self::Protect => "protect",
            Self::WriteConnectionFile => "write-connection-file",
            Self::Complete => "complete",
        }
    }
}
#[derive(Debug, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
enum Status {
    Success,
    Error,
}
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
struct Diagnostic {
    phase: Phase,
    hresult: i32,
    child_exit: Option<i32>,
    status: Status,
}
fn invalid() -> crate::Error {
    error(
        "DESKTOP_CREDENTIAL_DIAGNOSTIC_INVALID",
        "Desktop credential setup returned an invalid diagnostic; staging retained",
    )
}
fn parse(bytes: &[u8]) -> Result<Diagnostic> {
    if bytes.is_empty() || bytes.len() > RESULT_LIMIT {
        return Err(invalid());
    }
    let value: Value = serde_json::from_slice(bytes).map_err(|_| invalid())?;
    let object = value.as_object().ok_or_else(invalid)?;
    if object.len() != 4
        || ["phase", "hresult", "childExit", "status"]
            .iter()
            .any(|key| !object.contains_key(*key))
    {
        return Err(invalid());
    }
    let diagnostic: Diagnostic = serde_json::from_slice(bytes).map_err(|_| invalid())?;
    if diagnostic.status == Status::Success {
        if diagnostic.phase != Phase::Complete
            || diagnostic.hresult != 0
            || diagnostic.child_exit != Some(0)
        {
            return Err(invalid());
        }
    } else if diagnostic.phase == Phase::Complete
        || (diagnostic.phase == Phase::Assembly && diagnostic.child_exit.is_some())
    {
        return Err(invalid());
    }
    Ok(diagnostic)
}
fn regular(path: &Path) -> Result<fs::Metadata> {
    let metadata = fs::symlink_metadata(path).map_err(io_error)?;
    if !metadata.is_file() || metadata.file_type().is_symlink() {
        return Err(invalid());
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & 0x400 != 0 {
            return Err(invalid());
        }
    }
    Ok(metadata)
}
fn verify_result(process: Result<()>, diagnostic: Diagnostic, connection: &Path) -> Result<()> {
    // A forged success receipt cannot override a failed, timed-out or cancelled child.
    if process
        .as_ref()
        .is_err_and(|e| matches!(e.code.as_str(), "OPERATION_CANCELLED" | "GUEST_TIMEOUT"))
    {
        return process;
    }
    if diagnostic.status == Status::Error {
        return Err(error(
            "DESKTOP_CREDENTIAL_SETUP_FAILED",
            &format!(
                "Desktop credential setup failed during {} (HRESULT {}, child exit {}); staging retained",
                diagnostic.phase.name(),
                diagnostic.hresult,
                diagnostic
                    .child_exit
                    .map(|code| code.to_string())
                    .unwrap_or_else(|| "unavailable".into())
            ),
        ));
    }
    process?;
    regular(connection)?;
    Ok(())
}

fn require_absent(path: &Path) -> Result<()> {
    match fs::symlink_metadata(path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(io_error(e)),
        Ok(_) => Err(error(
            "OWNERSHIP_MISMATCH",
            "Desktop credential destination is not a fresh owned path",
        )),
    }
}

pub(super) fn prepare(session: &Session, port: u16, connection: &Path) -> Result<()> {
    verify_registration(session)?;
    asynchronous::check_cancel()?;
    let expected = session.directory.join("desktop.rdp");
    if connection != expected {
        return Err(error(
            "OWNERSHIP_MISMATCH",
            "Desktop credential destination is not a fresh owned path",
        ));
    }
    require_absent(connection)?;
    let status = session.directory.join(STATUS_NAME);
    // Creating the result inside the already-protected input directory also keeps it
    // within the existing complete staging cleanup inventory.
    let result_file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&status)
        .map_err(io_error)?;
    drop(result_file);
    let script = session.directory.join("desktop-connection.ps1");
    use std::io::Write;
    let mut file = fs::OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&script)
        .map_err(io_error)?;
    file.write_all(SCRIPT.as_bytes()).map_err(io_error)?;
    drop(file);
    let child = Command::new("powershell.exe")
        .args([
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-File",
            unicode(&script)?,
            &session.distribution,
            &port.to_string(),
            unicode(connection)?,
            unicode(&status)?,
        ])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(io_error)?;
    let process = wait_owned(child, Duration::from_secs(30));
    if process
        .as_ref()
        .is_err_and(|e| matches!(e.code.as_str(), "OPERATION_CANCELLED" | "GUEST_TIMEOUT"))
    {
        return process;
    }
    if regular(&status)?.len() > RESULT_LIMIT as u64 {
        return Err(invalid());
    }
    let diagnostic = parse(&fs::read(&status).map_err(io_error)?)?;
    verify_result(process, diagnostic, connection)
}

const SCRIPT: &str = r#"param([string]$Distribution,[int]$Port,[string]$ConnectionFile,[string]$StatusFile)
$ErrorActionPreference='Stop'
$phase='assembly'
$ok=$false
$hresult=0
$childExit=$null
$helperExit=1
$bytes=$null
$plain=$null
$protected=$null
$password=$null
$encoded=$null
$content=$null
$process=$null
$rng=$null
try {
 Add-Type -AssemblyName System.Security
 $phase='random-input'
 $bytes=New-Object byte[] 32
 $rng=[Security.Cryptography.RandomNumberGenerator]::Create()
 $rng.GetBytes($bytes)
 $password=[Convert]::ToBase64String($bytes)
 $phase='start-guest-command'
 $start=New-Object Diagnostics.ProcessStartInfo
 $start.FileName='wsl.exe'
 $start.Arguments='-d '+$Distribution+' -u root --exec /usr/sbin/chpasswd'
 $start.UseShellExecute=$false
 $start.CreateNoWindow=$true
 $start.RedirectStandardInput=$true
 $start.RedirectStandardOutput=$true
 $start.RedirectStandardError=$true
 $process=[Diagnostics.Process]::Start($start)
 $phase='write-guest-input'
 $process.StandardInput.WriteLine('materialbrowser:'+$password)
 $process.StandardInput.Close()
 $phase='wait-guest-command'
 if (!$process.WaitForExit(15000)) { $helperExit=124; $process.Kill(); throw 'Guest command timeout' }
 $childExit=$process.ExitCode
 if ($childExit -ne 0) { $helperExit=$childExit; throw 'Guest command failed' }
 $phase='protect'
 $plain=[Text.Encoding]::Unicode.GetBytes($password)
 $protected=[Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $encoded=([BitConverter]::ToString($protected)).Replace('-','')
 $phase='write-connection-file'
 $content="full address:s:127.0.0.1:$Port`r`nusername:s:materialbrowser`r`npassword 51:b:$encoded`r`nprompt for credentials:i:0`r`nauthentication level:i:2`r`nredirectclipboard:i:0`r`nredirectprinters:i:0`r`ndrivestoredirect:s:`r`naudiomode:i:2`r`n"
 [IO.File]::WriteAllText($ConnectionFile,$content,[Text.Encoding]::Unicode)
 if (!(Test-Path -LiteralPath $ConnectionFile -PathType Leaf)) { throw 'Connection file unavailable' }
 $phase='complete'
 $ok=$true
 $helperExit=0
} catch {
 $hresult=$_.Exception.HResult
} finally {
 if ($process) {
  try { if (!$process.HasExited) { $process.Kill(); $process.WaitForExit(3000) | Out-Null } } catch {}
  $process.Dispose()
 }
 if ($plain) { [Array]::Clear($plain,0,$plain.Length) }
 if ($bytes) { [Array]::Clear($bytes,0,$bytes.Length) }
 if ($protected) { [Array]::Clear($protected,0,$protected.Length) }
 $password=$null
 $encoded=$null
 $content=$null
 if ($rng) { $rng.Dispose() }
 # Only this fixed schema leaves the helper. Never emit raw exception or command output.
 $status=if($ok){'success'}else{'error'}
 $result=@{phase=$phase;hresult=[int]$hresult;childExit=$childExit;status=$status} | ConvertTo-Json -Compress
 [IO.File]::WriteAllText($StatusFile,$result,[Text.UTF8Encoding]::new($false))
}
exit $helperExit
"#;

#[cfg(test)]
mod tests {
    use super::*;
    fn result(phase: &str, status: &str) -> Vec<u8> {
        serde_json::to_vec(&json!({"phase":phase,"hresult":0,"childExit":0,"status":status}))
            .unwrap()
    }
    #[test]
    fn diagnostic_protocol_rejects_unknown_forged_and_oversized_records() {
        assert!(parse(&result("complete", "success")).is_ok());
        for phase in ["unknown", "protect;ignored", "write-connection-file"] {
            assert!(parse(&result(phase, "success")).is_err());
        }
        assert!(parse(&result("complete", "error")).is_err());
        assert!(
            parse(
                br#"{"phase":"complete","hresult":1,"hresult":0,"childExit":0,"status":"success"}"#
            )
            .is_err()
        );
        assert!(parse(&vec![b' '; RESULT_LIMIT + 1]).is_err());
        for bytes in [br#"{"phase":"complete","hresult":0,"status":"success"}"#.as_slice(),br#"{"phase":"complete","hresult":0,"childExit":0,"status":"success","message":"untrusted"}"#.as_slice()] {assert!(parse(bytes).is_err());}
    }
    #[test]
    fn success_requires_real_child_success_and_connection_file() {
        let root = std::env::temp_dir().join(crate::random_hex());
        fs::create_dir(&root).unwrap();
        let connection = root.join("desktop.rdp");
        assert!(
            verify_result(
                Ok(()),
                parse(&result("complete", "success")).unwrap(),
                &connection
            )
            .is_err()
        );
        fs::write(&connection, b"synthetic protected file fixture").unwrap();
        assert!(
            verify_result(
                Err(error("GUEST_COMMAND_FAILED", "failed")),
                parse(&result("complete", "success")).unwrap(),
                &connection
            )
            .is_err()
        );
        assert_eq!(
            verify_result(
                Err(error("OPERATION_CANCELLED", "cancelled")),
                parse(&result("protect", "error")).unwrap(),
                &connection
            )
            .unwrap_err()
            .code,
            "OPERATION_CANCELLED"
        );
        assert!(
            verify_result(
                Ok(()),
                parse(&result("complete", "success")).unwrap(),
                &connection
            )
            .is_ok()
        );
        fs::remove_dir_all(root).unwrap();
    }
    #[cfg(unix)]
    #[test]
    fn dangling_connection_link_is_not_a_fresh_destination() {
        let root = std::env::temp_dir().join(crate::random_hex());
        fs::create_dir(&root).unwrap();
        let destination = root.join("desktop.rdp");
        std::os::unix::fs::symlink(root.join("missing"), &destination).unwrap();
        assert!(!destination.exists());
        assert!(require_absent(&destination).is_err());
        fs::remove_file(destination).unwrap();
        fs::remove_dir(root).unwrap();
    }
    #[cfg(windows)]
    #[test]
    fn credential_script_parses_without_execution() {
        use std::io::Write;
        let check = "$tokens=$null;$errors=$null;[Management.Automation.Language.Parser]::ParseInput([Console]::In.ReadToEnd(),[ref]$tokens,[ref]$errors)|Out-Null;if($errors.Count -ne 0){exit 1}";
        let mut child = Command::new("powershell.exe")
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                check,
            ])
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .unwrap();
        child
            .stdin
            .take()
            .unwrap()
            .write_all(SCRIPT.as_bytes())
            .unwrap();
        assert!(child.wait().unwrap().success());
    }
}

use super::*;
pub(super) fn available() -> bool {
    std::env::var_os("WINDIR")
        .map(|p| {
            PathBuf::from(p)
                .join("System32/WindowsSandbox.exe")
                .is_file()
        })
        .unwrap_or(false)
}
fn xml(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;")
        .replace('\'', "&apos;")
}
pub(super) fn launch(
    s: &Session,
    archive: &Path,
    browser: Option<&Path>,
    networking: bool,
) -> Result<Child> {
    if s.mode != "browser" {
        return Err(error(
            "MODE_UNSUPPORTED",
            "Windows Sandbox currently supports the managed browser mode only",
        ));
    }
    if !available() {
        return Err(error(
            "SANDBOX_UNAVAILABLE",
            "Windows Sandbox must already be installed and enabled",
        ));
    }
    let browser = browser.ok_or_else(|| {
        error(
            "ENGINE_UNAVAILABLE",
            "A verified managed Chromium bundle is required",
        )
    })?;
    let bundle = browser
        .parent()
        .ok_or_else(|| error("ENGINE_UNAVAILABLE", "Invalid managed browser bundle"))?;
    let leaf = browser
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| error("ENGINE_UNAVAILABLE", "Invalid managed browser executable"))?;
    if !leaf
        .bytes()
        .all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'-' || b == b'_')
    {
        return Err(error(
            "ENGINE_UNAVAILABLE",
            "Unsupported browser executable name",
        ));
    }
    let input = s.directory.join("input");
    fs::create_dir_all(&input).map_err(io_error)?;
    crate::private(&input)?;
    let exchange = s.directory.join("exchange");
    fs::create_dir(&exchange).map_err(io_error)?;
    crate::private(&exchange)?;
    let data = input.join("state");
    fs::create_dir_all(&data).map_err(io_error)?;
    if archive.is_file() {
        validate_archive(archive)?;
        command(
            "tar.exe",
            &["-xf", unicode(archive)?, "-C", unicode(&data)?],
            Duration::from_secs(120),
        )?;
    }
    fs::create_dir_all(data.join("browser")).map_err(io_error)?;
    fs::create_dir_all(data.join("workspace")).map_err(io_error)?;
    fs::write(input.join("controls.ps1"), r#"$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationFramework
[xml]$markup=@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" Title="Super Profile" Width="500" Height="280" ResizeMode="CanResize" WindowStartupLocation="CenterScreen">
 <StackPanel Margin="24">
  <TextBlock Text="Disposable Super Profile" FontSize="22" Margin="0,0,0,16"/>
  <TextBlock Text="Save stops the browser, exports managed data and asks Material Browser to encrypt a new revision before closing this environment. Check the host for the actual result." TextWrapping="Wrap" Margin="0,0,0,16"/>
  <Button Name="Save" Content="Save back and close" Padding="12" Margin="0,0,0,8"/>
  <Button Name="Discard" Content="Discard and close" Padding="12"/>
 </StackPanel>
</Window>
'@
$window=[Windows.Markup.XamlReader]::Load((New-Object Xml.XmlNodeReader $markup))
$window.FindName('Save').Add_Click({[IO.File]::WriteAllText('C:\MaterialBrowserOutput\save-requested','save');$window.Close()})
$window.FindName('Discard').Add_Click({[IO.File]::WriteAllText('C:\MaterialBrowserOutput\discard-requested','discard');$window.Close()})
$window.ShowDialog() | Out-Null
"#).map_err(io_error)?;
    let script=r#"$ErrorActionPreference='Stop'
$inputRoot='C:\MaterialBrowserInput'
$exchange='C:\MaterialBrowserOutput'
$localRoot='C:\MaterialBrowser\data'
try {
 New-Item -ItemType Directory -Path $localRoot -Force | Out-Null
 Copy-Item -LiteralPath (Join-Path $inputRoot 'state\browser') -Destination $localRoot -Recurse -Force
 Copy-Item -LiteralPath (Join-Path $inputRoot 'state\workspace') -Destination $localRoot -Recurse -Force
 Set-Location (Join-Path $localRoot 'workspace')
 foreach ($installer in Get-ChildItem -LiteralPath (Join-Path $inputRoot 'installers') -File) {
   if ($installer.Extension -eq '.msi') { $install = Start-Process msiexec.exe -ArgumentList @('/i',('"'+$installer.FullName+'"'),'/qn','/norestart') -PassThru -Wait }
   elseif ($installer.Extension -eq '.exe') { $install = Start-Process -FilePath $installer.FullName -PassThru -Wait }
   else { throw 'Unsupported Windows installer format' }
   if ($install.ExitCode -ne 0) { throw 'Installer did not finish successfully' }
 }
 & (Join-Path $inputRoot 'setup.ps1')
 if (!$?) { throw 'Setup commands failed' }
 & (Join-Path $inputRoot 'startup.ps1')
 if (!$?) { throw 'Startup commands failed' }
 $browser='C:\MaterialBrowserEngine\__EXECUTABLE__'
 $profile=Join-Path $localRoot 'browser'
 $process=Start-Process -FilePath $browser -ArgumentList @('--user-data-dir="'+$profile+'"','--no-first-run','about:blank') -PassThru
 Start-Sleep -Seconds 3
 $running=Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -eq $browser -and $_.CommandLine -like '*C:\MaterialBrowser\data\browser*' }
 if (!$running) { throw 'Managed browser readiness not observed' }
 [IO.File]::WriteAllText((Join-Path $exchange 'ready'),'browser-process-ready')
 $controls=Join-Path $inputRoot 'controls.ps1'
 Start-Process powershell.exe -ArgumentList @('-NoProfile','-STA','-File',$controls) | Out-Null
 while (!(Test-Path -LiteralPath (Join-Path $exchange 'stop')) -and !(Test-Path -LiteralPath (Join-Path $exchange 'save-requested')) -and !(Test-Path -LiteralPath (Join-Path $exchange 'discard-requested'))) { Start-Sleep -Milliseconds 500 }
 Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($browser)) -ErrorAction SilentlyContinue | ForEach-Object { $_.CloseMainWindow() | Out-Null }
 Start-Sleep -Seconds 3
 if (Get-Process -Name ([IO.Path]::GetFileNameWithoutExtension($browser)) -ErrorAction SilentlyContinue) { throw 'Managed browser remains active; save refused' }
 if (!(Test-Path -LiteralPath (Join-Path $exchange 'discard-requested'))) {
  New-Item -ItemType Directory -Path (Join-Path $exchange 'data') -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $localRoot 'browser') -Destination (Join-Path $exchange 'data') -Recurse -Force
  Copy-Item -LiteralPath (Join-Path $localRoot 'workspace') -Destination (Join-Path $exchange 'data') -Recurse -Force
 }
 [IO.File]::WriteAllText((Join-Path $exchange 'stopped'),'browser-exited-and-state-copied')
} catch { [IO.File]::WriteAllText((Join-Path $exchange 'failed'),'Guest bootstrap or graceful stop failed') }
"#.replace("__EXECUTABLE__",leaf);
    fs::write(input.join("bootstrap.ps1"), script).map_err(io_error)?;
    let config = format!(
        r#"<Configuration><Networking>{}</Networking><ClipboardRedirection>Disable</ClipboardRedirection><vGPU>Disable</vGPU><AudioInput>Disable</AudioInput><VideoInput>Disable</VideoInput><PrinterRedirection>Disable</PrinterRedirection><MappedFolders><MappedFolder><HostFolder>{}</HostFolder><SandboxFolder>C:\MaterialBrowserInput</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder><MappedFolder><HostFolder>{}</HostFolder><SandboxFolder>C:\MaterialBrowserEngine</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder><MappedFolder><HostFolder>{}</HostFolder><SandboxFolder>C:\MaterialBrowserOutput</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder></MappedFolders><LogonCommand><Command>powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\MaterialBrowserInput\bootstrap.ps1</Command></LogonCommand></Configuration>"#,
        if networking { "Enable" } else { "Disable" },
        xml(unicode(&input)?),
        xml(unicode(bundle)?),
        xml(unicode(&exchange)?)
    );
    let path = s.directory.join("session.wsb");
    fs::write(&path, config).map_err(io_error)?;
    let exe = PathBuf::from(
        std::env::var_os("WINDIR")
            .ok_or_else(|| error("SANDBOX_UNAVAILABLE", "Windows directory unavailable"))?,
    )
    .join("System32/WindowsSandbox.exe");
    Command::new(exe)
        .arg(path)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(io_error)
}
pub(super) fn stop(s: &Session, child: Option<&mut Child>) -> Result<()> {
    let child=child.ok_or_else(||error("SANDBOX_RECOVERY_REQUIRED","Original Sandbox process handle is unavailable after host restart; close that Sandbox manually before recovery"))?;
    fs::write(s.directory.join("exchange/stop"), b"stop").map_err(io_error)?;
    let start = Instant::now();
    loop {
        if s.directory.join("exchange/failed").is_file() {
            return Err(error(
                "SANDBOX_STOP_FAILED",
                "Guest did not confirm graceful browser stop; staging retained",
            ));
        }
        if s.directory.join("exchange/stopped").is_file() {
            break;
        }
        if child.try_wait().map_err(io_error)?.is_some() {
            return Err(error(
                "SANDBOX_EXITED",
                "Sandbox exited without stopped-state receipt; save refused",
            ));
        }
        if start.elapsed() > Duration::from_secs(30) {
            return Err(error(
                "SANDBOX_STOP_TIMEOUT",
                "Sandbox did not acknowledge stop; save refused",
            ));
        }
        thread::sleep(Duration::from_millis(200));
    }
    if child.try_wait().map_err(io_error)?.is_none() {
        child.kill().map_err(io_error)?;
        child.wait().map_err(io_error)?;
    }
    Ok(())
}
pub(super) fn archive(s: &Session, destination: &Path, categories: &[&str]) -> Result<()> {
    if !s.directory.join("exchange/stopped").is_file() {
        return Err(error(
            "SANDBOX_NOT_STOPPED",
            "Missing guest stopped-state receipt",
        ));
    }
    let data = s.directory.join("exchange/data");
    let mut arguments = vec!["-cf", unicode(destination)?, "-C", unicode(&data)?];
    arguments.extend(categories.iter().copied());
    command("tar.exe", &arguments, Duration::from_secs(120))?;
    Ok(())
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn mapping_path_is_xml_escaped() {
        assert_eq!(xml("a&b<\""), "a&amp;b&lt;&quot;");
    }
}

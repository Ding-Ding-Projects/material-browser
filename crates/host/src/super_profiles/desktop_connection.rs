//! Per-session loopback RDP connection. Guest credentials never enter arguments or logs.
use super::*;
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};

pub(super) fn launch(session: &Session) -> Result<Child> {
    let reservation = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(io_error)?;
    let port = reservation.local_addr().map_err(io_error)?.port();
    let script = session.directory.join("desktop-connection.ps1");
    let rdp = session.directory.join("desktop.rdp");
    // Parameters contain only owned identifiers, a port and protected output paths.
    // Random credential generation, guest transfer and DPAPI protection stay in one process.
    fs::write(&script, r#"param([string]$Distribution,[int]$Port,[string]$ConnectionFile)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName System.Security
$bytes=New-Object byte[] 32
$rng=[Security.Cryptography.RandomNumberGenerator]::Create()
$rng.GetBytes($bytes)
$password=[Convert]::ToBase64String($bytes)
try {
 $start=New-Object Diagnostics.ProcessStartInfo
 $start.FileName='wsl.exe'
 $start.Arguments='-d '+$Distribution+' -u root --exec chpasswd'
 $start.UseShellExecute=$false
 $start.CreateNoWindow=$true
 $start.RedirectStandardInput=$true
 $start.RedirectStandardOutput=$true
 $start.RedirectStandardError=$true
 $process=[Diagnostics.Process]::Start($start)
 $process.StandardInput.WriteLine('materialbrowser:'+$password)
 $process.StandardInput.Close()
 if (!$process.WaitForExit(15000)) { $process.Kill(); throw 'Guest credential setup timed out' }
 if ($process.ExitCode -ne 0) { throw 'Guest credential setup failed' }
 $plain=[Text.Encoding]::Unicode.GetBytes($password)
 $protected=[Security.Cryptography.ProtectedData]::Protect($plain,$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
 $encoded=([BitConverter]::ToString($protected)).Replace('-','')
 $content="full address:s:127.0.0.1:$Port`r`nusername:s:materialbrowser`r`npassword 51:b:$encoded`r`nprompt for credentials:i:0`r`nauthentication level:i:2`r`nredirectclipboard:i:0`r`nredirectprinters:i:0`r`ndrivestoredirect:s:`r`naudiomode:i:2`r`n"
 [IO.File]::WriteAllText($ConnectionFile,$content,[Text.Encoding]::Unicode)
} finally {
 if ($plain) { [Array]::Clear($plain,0,$plain.Length) }
 [Array]::Clear($bytes,0,$bytes.Length)
 $password=$null
 $rng.Dispose()
}
"#).map_err(io_error)?;
    command(
        "powershell.exe",
        &[
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-File",
            unicode(&script)?,
            &session.distribution,
            &port.to_string(),
            unicode(&rdp)?,
        ],
        Duration::from_secs(30),
    )?;
    let setup = format!(
        "set -eu; mkdir -p /run/xrdp; sed -i 's|^port=tcp://127.0.0.1:3389$|port=tcp://127.0.0.1:{port}|' /etc/xrdp/xrdp.ini; grep -Fx 'port=tcp://127.0.0.1:{port}' /etc/xrdp/xrdp.ini >/dev/null; echo 'exec /usr/local/lib/material-browser/desktop-entry.sh' > /home/materialbrowser/.xsession; chown materialbrowser /home/materialbrowser/.xsession; service xrdp start >/dev/null"
    );
    drop(reservation);
    run(
        &[
            "-d",
            &session.distribution,
            "-u",
            "root",
            "--exec",
            "sh",
            "-lc",
            &setup,
        ],
        Duration::from_secs(30),
    )?;
    let verify = format!(
        "set -eu; ss -H -ltnp 'sport = :{port}' | grep -F '127.0.0.1:{port}' | grep -F '\"xrdp\"' >/dev/null; test \"$(readlink -f /proc/$(cat /run/xrdp/xrdp.pid)/exe)\" = /usr/sbin/xrdp"
    );
    run(
        &[
            "-d",
            &session.distribution,
            "-u",
            "root",
            "--exec",
            "sh",
            "-lc",
            &verify,
        ],
        Duration::from_secs(15),
    )?;
    let address = SocketAddr::from((Ipv4Addr::LOCALHOST, port));
    let started = Instant::now();
    while TcpStream::connect_timeout(&address, Duration::from_millis(300)).is_err() {
        if started.elapsed() > Duration::from_secs(20) {
            return Err(error(
                "DESKTOP_CONNECTION_UNAVAILABLE",
                "Guest desktop loopback forwarding did not become available",
            ));
        }
        thread::sleep(Duration::from_millis(200));
    }
    let executable = PathBuf::from(
        std::env::var_os("WINDIR")
            .ok_or_else(|| error("PLATFORM_UNSUPPORTED", "Windows directory unavailable"))?,
    )
    .join("System32/mstsc.exe");
    Command::new(executable)
        .arg(&rdp)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(io_error)
}

//! Per-session loopback RDP connection. Guest credentials never enter arguments or logs.
use super::*;
use std::net::{Ipv4Addr, SocketAddr, TcpListener, TcpStream};

pub(super) fn launch(session: &Session) -> Result<Child> {
    let reservation = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).map_err(io_error)?;
    let port = reservation.local_addr().map_err(io_error)?.port();
    let rdp = session.directory.join("desktop.rdp");
    guest_credentials::prepare(session, port, &rdp)?;
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

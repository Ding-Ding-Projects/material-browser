//! Explicitly paired native LAN transport. This protocol is not a browser WebSocket API.
use super::*;
use base64::{Engine, engine::general_purpose::STANDARD as B64};
use snow::{Builder, params::NoiseParams};
use tungstenite::{Message, accept_with_config, protocol::WebSocketConfig};
use zeroize::Zeroizing;
const PROTOCOL: &str = "Noise_KK_25519_ChaChaPoly_SHA256";
const MAX_NOISE: usize = 65535;
struct CheckedStream {
    stream: TcpStream,
    root: PathBuf,
    peer: Option<String>,
    handshake_started: std::time::Instant,
    established: bool,
}
impl Read for CheckedStream {
    fn read(&mut self, bytes: &mut [u8]) -> io::Result<usize> {
        if !self.established && self.handshake_started.elapsed() > Duration::from_secs(10) {
            return Err(io::ErrorKind::PermissionDenied.into());
        }
        if self
            .peer
            .as_ref()
            .is_some_and(|peer| trusted(&self.root, peer).is_err())
        {
            return Err(io::ErrorKind::PermissionDenied.into());
        }
        self.stream.read(bytes)
    }
}
impl Write for CheckedStream {
    fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
        self.stream.write(bytes)
    }
    fn flush(&mut self) -> io::Result<()> {
        self.stream.flush()
    }
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct Grant {
    public_key: String,
    methods: Vec<String>,
    profile_ids: Vec<String>,
    #[serde(default)]
    revoked: bool,
}
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct Trust {
    peers: Vec<Grant>,
}
fn noise_error(_: snow::Error) -> Error {
    error("NOISE_REJECTED", "Encrypted session rejected")
}
fn key(bytes: &str) -> Result<Vec<u8>> {
    let key = B64
        .decode(bytes)
        .map_err(|_| error("INVALID_KEY", "Invalid pairing key"))?;
    if key.len() != 32 {
        return Err(error("INVALID_KEY", "Pairing key must be 32 bytes"));
    }
    Ok(key)
}
fn trusted(root: &Path, public: &str) -> Result<Grant> {
    let bytes = fs::read(root.join("lan-peers.json")).map_err(io_error)?;
    if bytes.len() > 65536 {
        return Err(error("INVALID_TRUST", "Peer file exceeds limit"));
    }
    let trust: Trust = serde_json::from_slice(&bytes)
        .map_err(|_| error("INVALID_TRUST", "Invalid peer grants"))?;
    trust
        .peers
        .into_iter()
        .find(|g| g.public_key == public && !g.revoked)
        .ok_or_else(|| error("PEER_REVOKED", "Peer is unknown or revoked"))
}
pub fn create_key(root: &Path) -> Result<()> {
    if !root.is_absolute() {
        return Err(error("INVALID_DATA_DIR", "Data directory must be absolute"));
    }
    fs::create_dir_all(root).map_err(io_error)?;
    private(root)?;
    let keys = Builder::new(PROTOCOL.parse::<NoiseParams>().unwrap())
        .generate_keypair()
        .map_err(noise_error)?;
    let private_key = Zeroizing::new(keys.private);
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(root.join("lan-key"))
        .map_err(io_error)?;
    file.write_all(&private_key).map_err(io_error)?;
    file.sync_all().map_err(io_error)?;
    println!(
        "{}",
        json!({"publicKey":B64.encode(keys.public),"protocol":PROTOCOL})
    );
    Ok(())
}
fn private_address(address: SocketAddr) -> bool {
    match address.ip() {
        std::net::IpAddr::V4(ip) => ip.is_private() && !ip.is_unspecified() && address.port() != 0,
        std::net::IpAddr::V6(_) => false,
    }
}
pub fn serve(root: &Path, address: SocketAddr, host: Host) -> Result<()> {
    if !private_address(address) {
        return Err(error(
            "INVALID_LISTEN",
            "Bind one explicit private IPv4 interface and nonzero port",
        ));
    }
    let secret = Zeroizing::new(fs::read(root.join("lan-key")).map_err(io_error)?);
    if secret.len() != 32 {
        return Err(error("INVALID_KEY", "Invalid native static key"));
    }
    let listener = TcpListener::bind(address).map_err(io_error)?;
    let host = Arc::new(Mutex::new(host));
    let limit = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    for incoming in listener.incoming() {
        let stream = incoming.map_err(io_error)?;
        if !stream.peer_addr().map_err(io_error)?.ip().is_ipv4() {
            continue;
        }
        use std::sync::atomic::Ordering;
        if limit.fetch_add(1, Ordering::SeqCst) >= 16 {
            limit.fetch_sub(1, Ordering::SeqCst);
            continue;
        }
        let host = host.clone();
        let root = root.to_path_buf();
        let secret = Zeroizing::new(secret.to_vec());
        let limit = limit.clone();
        std::thread::spawn(move || {
            let _ = connection(stream, &root, &secret, &host);
            limit.fetch_sub(1, Ordering::SeqCst);
        });
    }
    Ok(())
}
fn connection(
    stream: TcpStream,
    root: &Path,
    secret: &[u8],
    host: &Arc<Mutex<Host>>,
) -> Result<()> {
    stream
        .set_read_timeout(Some(Duration::from_secs(1)))
        .map_err(io_error)?;
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(io_error)?;
    let config = WebSocketConfig::default()
        .max_message_size(Some(MAX_NOISE))
        .max_frame_size(Some(MAX_NOISE));
    let guarded = CheckedStream {
        stream,
        root: root.to_path_buf(),
        peer: None,
        handshake_started: std::time::Instant::now(),
        established: false,
    };
    let mut socket = accept_with_config(guarded, Some(config))
        .map_err(|_| error("WEBSOCKET_REJECTED", "WebSocket upgrade rejected"))?;
    // Cleartext peer selection performs no operation and conveys no secret. Static keys are paired out of band.
    let first = socket
        .read()
        .map_err(|_| error("PAIRING_REQUIRED", "Peer selection required"))?;
    let public = first
        .into_text()
        .map_err(|_| error("PAIRING_REQUIRED", "Base64 public key text required"))?
        .to_string();
    trusted(root, &public)?;
    socket.get_mut().peer = Some(public.clone());
    let remote = key(&public)?;
    let mut handshake = Builder::new(PROTOCOL.parse::<NoiseParams>().unwrap())
        .local_private_key(secret)
        .remote_public_key(&remote)
        .build_responder()
        .map_err(noise_error)?;
    let message = socket
        .read()
        .map_err(|_| error("NOISE_REJECTED", "Handshake required"))?;
    if !message.is_binary() {
        return Err(error("NOISE_REJECTED", "Binary handshake required"));
    }
    let mut buffer = Zeroizing::new(vec![0u8; MAX_NOISE]);
    let early = handshake
        .read_message(&message.into_data(), &mut buffer)
        .map_err(noise_error)?;
    if early != 0 {
        return Err(error(
            "EARLY_DATA",
            "Handshake application payload is not permitted",
        ));
    }
    let n = handshake
        .write_message(&[], &mut buffer)
        .map_err(noise_error)?;
    socket
        .send(Message::Binary(buffer[..n].to_vec().into()))
        .map_err(|_| error("WEBSOCKET_CLOSED", "Connection closed"))?;
    if !handshake.is_handshake_finished() {
        return Err(error("NOISE_REJECTED", "Incomplete handshake"));
    }
    let mut transport = handshake.into_transport_mode().map_err(noise_error)?;
    socket.get_mut().established = true;
    loop {
        let grant = match trusted(root, &public) {
            Ok(g) => g,
            Err(e) => {
                let _ = socket.close(None);
                return Err(e);
            }
        };
        let frame = match socket.read() {
            Ok(frame) => frame,
            Err(tungstenite::Error::Io(e))
                if matches!(
                    e.kind(),
                    io::ErrorKind::WouldBlock | io::ErrorKind::TimedOut
                ) =>
            {
                continue;
            }
            Err(_) => return Ok(()),
        };
        if frame.is_close() {
            return Ok(());
        }
        if frame.is_ping() {
            continue;
        }
        if !frame.is_binary() {
            return Err(error(
                "ENCRYPTED_DATA_REQUIRED",
                "Encrypted binary message required",
            ));
        }
        let count = transport
            .read_message(&frame.into_data(), &mut buffer)
            .map_err(noise_error)?;
        let request: Request = serde_json::from_slice(&buffer[..count])
            .map_err(|_| error("INVALID_REQUEST", "Invalid encrypted envelope"))?;
        let reply = if !authorized(&grant, &request) {
            json!({"id":request.id,"error":error("GRANT_REQUIRED","Method or profile outside peer grant")})
        } else {
            // Re-read immediately before execution to close a revoke-during-read race.
            let mut state = host
                .lock()
                .map_err(|_| error("HOST_UNAVAILABLE", "Host state unavailable"))?;
            let current = trusted(root, &public)?;
            if !authorized(&current, &request) {
                return Err(error("GRANT_REQUIRED", "Peer grant changed"));
            }
            match state.execute(&request.method, request.params) {
                Ok(mut value) => {
                    if ["profiles.list", "profiles.status"].contains(&request.method.as_str())
                        && !current.profile_ids.iter().any(|p| p == "*")
                    {
                        if let Some(profiles) = value.as_array_mut() {
                            profiles.retain(|p| {
                                p.get("id")
                                    .or_else(|| p.get("profileId"))
                                    .and_then(Value::as_str)
                                    .is_some_and(|id| current.profile_ids.iter().any(|v| v == id))
                            });
                        }
                    }
                    json!({"id":request.id,"result":value})
                }
                Err(e) => json!({"id":request.id,"error":e}),
            }
        };
        let plain = Zeroizing::new(
            serde_json::to_vec(&reply)
                .map_err(|_| error("SERIALIZATION", "Cannot encode reply"))?,
        );
        if plain.len() > MAX_NOISE - 16 {
            return Err(error(
                "MESSAGE_TOO_LARGE",
                "Reply exceeds encrypted frame limit",
            ));
        }
        let n = transport
            .write_message(&plain, &mut buffer)
            .map_err(noise_error)?;
        socket
            .send(Message::Binary(buffer[..n].to_vec().into()))
            .map_err(|_| error("WEBSOCKET_CLOSED", "Connection closed"))?;
    }
}
fn authorized(grant: &Grant, request: &Request) -> bool {
    if grant.revoked || !grant.methods.iter().any(|m| m == &request.method) {
        return false;
    }
    if ["vault.", "settings.", "sync."]
        .iter()
        .any(|prefix| request.method.starts_with(prefix))
    {
        return grant.profile_ids.iter().any(|id| id == "*");
    }
    if (request.method.starts_with("profiles.")
        && !["profiles.list", "profiles.status"].contains(&request.method.as_str()))
        || request.method.starts_with("revisions.")
    {
        if grant.profile_ids.iter().any(|p| p == "*") {
            return true;
        }
        return request
            .params
            .get("id")
            .or_else(|| request.params.get("profileId"))
            .and_then(Value::as_str)
            .is_some_and(|id| grant.profile_ids.iter().any(|p| p == id));
    }
    !request.method.starts_with("automation.") && !request.method.starts_with("tunnel.")
}
#[cfg(test)]
mod tests {
    use super::*;
    fn session() -> (snow::TransportState, snow::TransportState) {
        let p: NoiseParams = PROTOCOL.parse().unwrap();
        let a = Builder::new(p.clone()).generate_keypair().unwrap();
        let b = Builder::new(p.clone()).generate_keypair().unwrap();
        let mut i = Builder::new(p.clone())
            .local_private_key(&a.private)
            .remote_public_key(&b.public)
            .build_initiator()
            .unwrap();
        let mut r = Builder::new(p)
            .local_private_key(&b.private)
            .remote_public_key(&a.public)
            .build_responder()
            .unwrap();
        let mut wire = [0; 1024];
        let mut out = [0; 1024];
        let n = i.write_message(&[], &mut wire).unwrap();
        r.read_message(&wire[..n], &mut out).unwrap();
        let n = r.write_message(&[], &mut wire).unwrap();
        i.read_message(&wire[..n], &mut out).unwrap();
        (
            i.into_transport_mode().unwrap(),
            r.into_transport_mode().unwrap(),
        )
    }
    #[test]
    fn ciphertext_replay_and_tamper_rejected() {
        let (mut a, mut b) = session();
        let mut wire = [0; 1024];
        let mut plain = [0; 1024];
        let n = a.write_message(b"request", &mut wire).unwrap();
        assert_eq!(b.read_message(&wire[..n], &mut plain).unwrap(), 7);
        assert!(b.read_message(&wire[..n], &mut plain).is_err());
        let n = a.write_message(b"second", &mut wire).unwrap();
        wire[0] ^= 1;
        assert!(b.read_message(&wire[..n], &mut plain).is_err());
    }
    #[test]
    fn wrong_static_key_rejected() {
        let p: NoiseParams = PROTOCOL.parse().unwrap();
        let a = Builder::new(p.clone()).generate_keypair().unwrap();
        let b = Builder::new(p.clone()).generate_keypair().unwrap();
        let wrong = Builder::new(p.clone()).generate_keypair().unwrap();
        let mut i = Builder::new(p.clone())
            .local_private_key(&a.private)
            .remote_public_key(&b.public)
            .build_initiator()
            .unwrap();
        let mut r = Builder::new(p)
            .local_private_key(&b.private)
            .remote_public_key(&wrong.public)
            .build_responder()
            .unwrap();
        let mut wire = [0; 1024];
        let mut out = [0; 1024];
        let n = i.write_message(&[], &mut wire).unwrap();
        assert!(r.read_message(&wire[..n], &mut out).is_err());
    }
    #[test]
    fn grants_are_exact() {
        let grant = Grant {
            public_key: String::new(),
            methods: vec!["profiles.stop".into()],
            profile_ids: vec!["allowed".into()],
            revoked: false,
        };
        assert!(authorized(
            &grant,
            &Request {
                id: json!(1),
                method: "profiles.stop".into(),
                params: json!({"id":"allowed"})
            }
        ));
        assert!(!authorized(
            &grant,
            &Request {
                id: json!(1),
                method: "profiles.stop".into(),
                params: json!({"id":"other"})
            }
        ));
        assert!(!authorized(
            &grant,
            &Request {
                id: json!(1),
                method: "vault.unlock".into(),
                params: json!({})
            }
        ));
    }
    #[test]
    fn no_wildcard_or_loopback_listen() {
        assert!(!private_address("0.0.0.0:4000".parse().unwrap()));
        assert!(!private_address("127.0.0.1:4000".parse().unwrap()));
        assert!(private_address("192.168.1.4:4000".parse().unwrap()));
    }
    #[test]
    fn real_websocket_handshake_control_replay_and_revocation() {
        for revoke in [false, true] {
            let root = std::env::temp_dir().join(format!("material-noise-test-{}", random_hex()));
            let host = Arc::new(Mutex::new(Host::new(&root).unwrap()));
            let p: NoiseParams = PROTOCOL.parse().unwrap();
            let client = Builder::new(p.clone()).generate_keypair().unwrap();
            let server = Builder::new(p.clone()).generate_keypair().unwrap();
            let public = B64.encode(&client.public);
            fs::write(root.join("lan-peers.json"),serde_json::to_vec(&json!({"peers":[{"publicKey":public,"methods":["system.status"],"profileIds":[],"revoked":false}]})).unwrap()).unwrap();
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let address = listener.local_addr().unwrap();
            let server_root = root.clone();
            let thread = std::thread::spawn(move || {
                let (stream, _) = listener.accept().unwrap();
                connection(stream, &server_root, &server.private, &host)
            });
            let stream = TcpStream::connect(address).unwrap();
            stream
                .set_read_timeout(Some(Duration::from_secs(4)))
                .unwrap();
            let (mut ws, _) =
                tungstenite::client(format!("ws://{address}/v1/noise"), stream).unwrap();
            ws.send(Message::Text(public.into())).unwrap();
            let mut handshake = Builder::new(p)
                .local_private_key(&client.private)
                .remote_public_key(&server.public)
                .build_initiator()
                .unwrap();
            let mut buffer = [0; MAX_NOISE];
            let count = handshake.write_message(&[], &mut buffer).unwrap();
            ws.send(Message::Binary(buffer[..count].to_vec().into()))
                .unwrap();
            let message = ws.read().unwrap().into_data();
            handshake.read_message(&message, &mut buffer).unwrap();
            let mut transport = handshake.into_transport_mode().unwrap();
            let count = transport
                .write_message(
                    br#"{"id":"network","method":"system.status","params":{}}"#,
                    &mut buffer,
                )
                .unwrap();
            let frame = buffer[..count].to_vec();
            ws.send(Message::Binary(frame.clone().into())).unwrap();
            let response = ws.read().unwrap().into_data();
            let count = transport.read_message(&response, &mut buffer).unwrap();
            let response: Value = serde_json::from_slice(&buffer[..count]).unwrap();
            assert_eq!(response["id"], "network");
            assert!(response["result"]["locked"].as_bool().unwrap());
            if revoke {
                fs::write(root.join("lan-peers.json"), br#"{"peers":[]}"#).unwrap();
                let count = transport
                    .write_message(
                        br#"{"id":"revoked","method":"system.status","params":{}}"#,
                        &mut buffer,
                    )
                    .unwrap();
                let _ = ws.send(Message::Binary(buffer[..count].to_vec().into()));
            } else {
                ws.send(Message::Binary(frame.into())).unwrap();
            }
            assert!(match ws.read() {
                Ok(frame) => frame.is_close(),
                Err(_) => true,
            });
            assert!(thread.join().unwrap().is_err());
            fs::remove_dir_all(root).unwrap();
        }
    }
}

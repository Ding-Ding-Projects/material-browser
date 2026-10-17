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
    private(&root.join("lan-key"))?;
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
    let mut tunnels = std::collections::HashMap::<String, (String, String, TcpStream)>::new();
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
            let result = if request.method.starts_with("tunnel.") {
                tunnel(&mut tunnels, &mut state, &request)
            } else {
                state.execute(&request.method, request.params)
            };
            match result {
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
    if request.method == "vault.secret" || request.method == "vault.exportKey" {
        return false;
    }
    if grant.revoked || !grant.methods.iter().any(|m| m == &request.method) {
        return false;
    }
    if ["vault.", "settings.", "sync.", "operations."]
        .iter()
        .any(|prefix| request.method.starts_with(prefix))
    {
        return grant.profile_ids.iter().any(|id| id == "*");
    }
    if (request.method.starts_with("profiles.")
        && !["profiles.list", "profiles.status"].contains(&request.method.as_str()))
        || request.method.starts_with("revisions.")
        || request.method.starts_with("automation.")
        || request.method.starts_with("tunnel.")
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
    true
}
// Native local relay for standard browser clients. The network hop remains paired Noise.
pub fn forward(
    root: &Path,
    address: SocketAddr,
    server_public: &str,
    client_public: &str,
    profile: &str,
) -> Result<()> {
    if !private_address(address) {
        return Err(error(
            "INVALID_LISTEN",
            "An explicit private LAN destination is required",
        ));
    }
    let secret = Zeroizing::new(fs::read(root.join("lan-key")).map_err(io_error)?);
    if secret.len() != 32 {
        return Err(error("INVALID_KEY", "Invalid local pairing identity"));
    }
    key(server_public)?;
    key(client_public)?;
    let mut client = PairedClient::connect(address, &secret, server_public, client_public)?;
    let opened = client.call("tunnel.open", json!({"id":profile}))?;
    let endpoint: tungstenite::http::Uri = opened["endpoint"]["url"]
        .as_str()
        .ok_or_else(|| error("INVALID_ENDPOINT", "Missing endpoint"))?
        .parse()
        .map_err(|_| error("INVALID_ENDPOINT", "Invalid endpoint"))?;
    client.call(
        "tunnel.close",
        json!({"id":profile,"tunnelId":opened["tunnelId"]}),
    )?;
    let listener = TcpListener::bind("127.0.0.1:0").map_err(io_error)?;
    let local = listener.local_addr().map_err(io_error)?;
    println!(
        "{}",
        json!({"url":format!("ws://{local}{}",endpoint.path_and_query().map(|p|p.as_str()).unwrap_or("/")),"profileId":profile})
    );
    let active = Arc::new(std::sync::atomic::AtomicUsize::new(0));
    for stream in listener.incoming() {
        let stream = stream.map_err(io_error)?;
        use std::sync::atomic::Ordering;
        if active.fetch_add(1, Ordering::SeqCst) >= 4 {
            active.fetch_sub(1, Ordering::SeqCst);
            continue;
        }
        let secret = Zeroizing::new(secret.to_vec());
        let server = server_public.to_owned();
        let public = client_public.to_owned();
        let profile = profile.to_owned();
        let active = active.clone();
        std::thread::spawn(move || {
            let _ = relay(stream, address, &secret, &server, &public, &profile);
            active.fetch_sub(1, Ordering::SeqCst);
        });
    }
    Ok(())
}
struct PairedClient {
    socket: tungstenite::WebSocket<TcpStream>,
    transport: snow::TransportState,
}
impl PairedClient {
    fn connect(address: SocketAddr, secret: &[u8], server: &str, public: &str) -> Result<Self> {
        let stream =
            TcpStream::connect_timeout(&address, Duration::from_secs(3)).map_err(io_error)?;
        stream
            .set_read_timeout(Some(Duration::from_secs(15)))
            .map_err(io_error)?;
        stream
            .set_write_timeout(Some(Duration::from_secs(5)))
            .map_err(io_error)?;
        let config = WebSocketConfig::default()
            .max_message_size(Some(MAX_NOISE))
            .max_frame_size(Some(MAX_NOISE));
        let (mut socket, _) = tungstenite::client::client_with_config(
            format!("ws://{address}/v1/noise"),
            stream,
            Some(config),
        )
        .map_err(|_| error("PAIRING_FAILED", "Paired transport unavailable"))?;
        socket
            .send(Message::Text(public.to_owned().into()))
            .map_err(|_| error("PAIRING_FAILED", "Peer selection failed"))?;
        let remote = key(server)?;
        let mut handshake = Builder::new(PROTOCOL.parse::<NoiseParams>().unwrap())
            .local_private_key(secret)
            .remote_public_key(&remote)
            .build_initiator()
            .map_err(noise_error)?;
        let mut buffer = Zeroizing::new(vec![0; MAX_NOISE]);
        let n = handshake
            .write_message(&[], &mut buffer)
            .map_err(noise_error)?;
        socket
            .send(Message::Binary(buffer[..n].to_vec().into()))
            .map_err(|_| error("PAIRING_FAILED", "Handshake write failed"))?;
        let frame = socket
            .read()
            .map_err(|_| error("PAIRING_FAILED", "Handshake read failed"))?;
        if !frame.is_binary() {
            return Err(error("NOISE_REJECTED", "Encrypted handshake required"));
        }
        if handshake
            .read_message(&frame.into_data(), &mut buffer)
            .map_err(noise_error)?
            != 0
        {
            return Err(error("EARLY_DATA", "Handshake payload rejected"));
        }
        Ok(Self {
            socket,
            transport: handshake.into_transport_mode().map_err(noise_error)?,
        })
    }
    fn call(&mut self, method: &str, params: Value) -> Result<Value> {
        let plain = Zeroizing::new(
            serde_json::to_vec(&json!({"id":"relay","method":method,"params":params}))
                .map_err(|_| error("SERIALIZATION", "Cannot encode relay request"))?,
        );
        if plain.len() > MAX_NOISE - 16 {
            return Err(error("MESSAGE_TOO_LARGE", "Relay request too large"));
        }
        let mut buffer = Zeroizing::new(vec![0; MAX_NOISE]);
        let n = self
            .transport
            .write_message(&plain, &mut buffer)
            .map_err(noise_error)?;
        self.socket
            .send(Message::Binary(buffer[..n].to_vec().into()))
            .map_err(|_| error("TUNNEL_CLOSED", "Paired relay closed"))?;
        let frame = self
            .socket
            .read()
            .map_err(|_| error("TUNNEL_CLOSED", "Paired relay closed"))?;
        if !frame.is_binary() {
            return Err(error("TUNNEL_CLOSED", "Expected encrypted reply"));
        }
        let n = self
            .transport
            .read_message(&frame.into_data(), &mut buffer)
            .map_err(noise_error)?;
        let value: Value = serde_json::from_slice(&buffer[..n])
            .map_err(|_| error("INVALID_RESPONSE", "Invalid relay response"))?;
        if value.get("error").is_some() {
            return Err(error("RELAY_REJECTED", "Paired relay command rejected"));
        }
        Ok(value["result"].clone())
    }
}
fn relay(
    mut local: TcpStream,
    address: SocketAddr,
    secret: &[u8],
    server: &str,
    public: &str,
    profile: &str,
) -> Result<()> {
    local
        .set_read_timeout(Some(Duration::from_millis(50)))
        .map_err(io_error)?;
    local
        .set_write_timeout(Some(Duration::from_secs(2)))
        .map_err(io_error)?;
    let mut client = PairedClient::connect(address, secret, server, public)?;
    let opened = client.call("tunnel.open", json!({"id":profile}))?;
    let tunnel = opened["tunnelId"].clone();
    let mut buffer = Zeroizing::new(vec![0; 32768]);
    loop {
        let n = match local.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => n,
            Err(e)
                if matches!(
                    e.kind(),
                    io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock
                ) =>
            {
                0
            }
            Err(e) => return Err(io_error(e)),
        };
        let reply = client.call(
            "tunnel.exchange",
            json!({"id":profile,"tunnelId":tunnel,"data":B64.encode(&buffer[..n])}),
        )?;
        let data = reply["data"]
            .as_str()
            .filter(|s| s.len() <= 43692)
            .ok_or_else(|| error("INVALID_RESPONSE", "Invalid relay payload"))?;
        let data = Zeroizing::new(
            B64.decode(data)
                .map_err(|_| error("INVALID_RESPONSE", "Invalid relay encoding"))?,
        );
        local.write_all(&data).map_err(io_error)?;
        if reply["eof"] == true {
            break;
        }
    }
    client.call("tunnel.close", json!({"id":profile,"tunnelId":tunnel}))?;
    Ok(())
}
fn tunnel(
    tunnels: &mut std::collections::HashMap<String, (String, String, TcpStream)>,
    host: &mut Host,
    request: &Request,
) -> Result<Value> {
    let profile = request
        .params
        .get("id")
        .and_then(Value::as_str)
        .ok_or_else(|| error("INVALID_PARAMS", "Profile id required"))?;
    // Every chunk rechecks effective automation. A preference change revokes access immediately.
    let endpoint = match host.execute("automation.endpoint", json!({"id":profile})) {
        Ok(endpoint) => endpoint,
        Err(e) => {
            tunnels.retain(|_, (owner, _, _)| owner != profile);
            return Err(e);
        }
    };
    match request.method.as_str() {
        "tunnel.open" => {
            if tunnels.len() >= 4 {
                return Err(error(
                    "TUNNEL_LIMIT",
                    "Four tunnels per peer connection permitted",
                ));
            }
            if endpoint["protocol"] == "webdriver" {
                return Err(error(
                    "SESSION_PROXY_REQUIRED",
                    "WebDriver requires the session-confined request route",
                ));
            }
            let url = endpoint["url"]
                .as_str()
                .ok_or_else(|| error("INVALID_ENDPOINT", "Engine endpoint unavailable"))?;
            let uri: tungstenite::http::Uri = url
                .parse()
                .map_err(|_| error("INVALID_ENDPOINT", "Invalid engine endpoint"))?;
            let ip: std::net::IpAddr = uri
                .host()
                .ok_or_else(|| error("INVALID_ENDPOINT", "Engine endpoint host unavailable"))?
                .parse()
                .map_err(|_| error("INVALID_ENDPOINT", "Engine endpoint must use a loopback IP"))?;
            if !ip.is_loopback() {
                return Err(error(
                    "INVALID_ENDPOINT",
                    "Engine endpoint must use loopback",
                ));
            }
            let port = uri
                .port_u16()
                .ok_or_else(|| error("INVALID_ENDPOINT", "Engine endpoint port unavailable"))?;
            let stream =
                TcpStream::connect_timeout(&SocketAddr::new(ip, port), Duration::from_secs(2))
                    .map_err(io_error)?;
            stream
                .set_read_timeout(Some(Duration::from_millis(100)))
                .map_err(io_error)?;
            stream
                .set_write_timeout(Some(Duration::from_secs(2)))
                .map_err(io_error)?;
            let id = random_hex();
            tunnels.insert(id.clone(), (profile.to_owned(), url.to_owned(), stream));
            Ok(json!({"tunnelId":id,"endpoint":endpoint,"maxChunkBytes":32768}))
        }
        "tunnel.exchange" | "tunnel.close" => {
            let id = request.params["tunnelId"]
                .as_str()
                .ok_or_else(|| error("INVALID_PARAMS", "Tunnel id required"))?;
            let (owner, bound_url, stream) = tunnels
                .get_mut(id)
                .ok_or_else(|| error("TUNNEL_NOT_FOUND", "Tunnel not found"))?;
            if owner != profile || endpoint["url"].as_str() != Some(bound_url.as_str()) {
                return Err(error("GRANT_REQUIRED", "Tunnel belongs to another profile"));
            }
            if request.method == "tunnel.close" {
                tunnels.remove(id);
                return Ok(json!({"closed":true}));
            }
            let data = request
                .params
                .get("data")
                .and_then(Value::as_str)
                .unwrap_or("");
            if data.len() > 43692 {
                return Err(error("MESSAGE_TOO_LARGE", "Tunnel chunk exceeds limit"));
            }
            let data = Zeroizing::new(
                B64.decode(data)
                    .map_err(|_| error("INVALID_PARAMS", "Base64 tunnel data required"))?,
            );
            if data.len() > 32768 {
                return Err(error("MESSAGE_TOO_LARGE", "Tunnel chunk exceeds limit"));
            }
            stream.write_all(&data).map_err(io_error)?;
            let mut buffer = Zeroizing::new(vec![0; 32768]);
            let count = match stream.read(&mut buffer) {
                Ok(n) => n,
                Err(e)
                    if matches!(
                        e.kind(),
                        io::ErrorKind::TimedOut | io::ErrorKind::WouldBlock
                    ) =>
                {
                    return Ok(json!({"data":"","eof":false}));
                }
                Err(e) => return Err(io_error(e)),
            };
            Ok(json!({"data":B64.encode(&buffer[..count]),"eof":count==0}))
        }
        _ => Err(error("METHOD_NOT_FOUND", "Unknown tunnel method")),
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn native_paired_client_performs_real_encrypted_rpc() {
        let root =
            std::env::temp_dir().join(format!("material-relay-client-test-{}", random_hex()));
        let host = Arc::new(Mutex::new(Host::new(&root).unwrap()));
        let params: NoiseParams = PROTOCOL.parse().unwrap();
        let client = Builder::new(params.clone()).generate_keypair().unwrap();
        let server = Builder::new(params).generate_keypair().unwrap();
        let client_public = B64.encode(&client.public);
        let server_public = B64.encode(&server.public);
        fs::write(root.join("lan-peers.json"),serde_json::to_vec(&json!({"peers":[{"publicKey":client_public,"methods":["system.status"],"profileIds":[],"revoked":false}]})).unwrap()).unwrap();
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let address = listener.local_addr().unwrap();
        let server_root = root.clone();
        let thread = std::thread::spawn(move || {
            let (stream, _) = listener.accept().unwrap();
            connection(stream, &server_root, &server.private, &host)
        });
        let mut paired =
            PairedClient::connect(address, &client.private, &server_public, &client_public)
                .unwrap();
        assert_eq!(
            paired.call("system.status", json!({})).unwrap()["locked"],
            true
        );
        assert!(
            paired
                .call("vault.unlock", json!({"password":"synthetic-only"}))
                .is_err()
        );
        drop(paired);
        let _ = thread.join().unwrap();
        fs::remove_dir_all(root).unwrap();
    }
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
        let secret_grant = Grant {
            public_key: String::new(),
            methods: vec!["vault.secret".into(), "vault.exportKey".into()],
            profile_ids: vec!["*".into()],
            revoked: false,
        };
        for method in ["vault.secret", "vault.exportKey"] {
            assert!(!authorized(
                &secret_grant,
                &Request {
                    id: json!(1),
                    method: method.into(),
                    params: json!({})
                }
            ));
        }
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

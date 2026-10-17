use fs2::FileExt;
use material_browser_core::Manager;
use material_browser_engine::{EngineRegistry, LaunchRequest, Supervisor};
use rand::RngCore;
use serde::{Deserialize, Serialize};
use serde_json::{Value, json};
use std::{
    fs::{self, File, OpenOptions},
    io::{self, BufRead, Read, Write},
    net::{SocketAddr, TcpListener, TcpStream},
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};
mod lan;
const MAX_MESSAGE: usize = 1024 * 1024;
#[derive(Debug, Serialize)]
pub struct Error {
    pub code: String,
    pub message: String,
}
fn error(code: &str, message: &str) -> Error {
    Error {
        code: code.into(),
        message: message.into(),
    }
}
type Result<T> = std::result::Result<T, Error>;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request {
    pub id: Value,
    pub method: String,
    #[serde(default = "empty")]
    pub params: Value,
}
fn empty() -> Value {
    json!({})
}
pub struct Host {
    core: Manager,
    registry: EngineRegistry,
    supervisor: Supervisor,
    active: PathBuf,
    operations: Vec<Value>,
    _lock: File,
}
impl Host {
    fn new(root: &Path) -> Result<Self> {
        if !root.is_absolute() {
            return Err(error("INVALID_DATA_DIR", "Data directory must be absolute"));
        }
        fs::create_dir_all(root).map_err(io_error)?;
        private(root)?;
        let lock = OpenOptions::new()
            .create(true)
            .truncate(false)
            .read(true)
            .write(true)
            .open(root.join("host.lock"))
            .map_err(io_error)?;
        lock.try_lock_exclusive().map_err(|_| {
            error(
                "HOST_ACTIVE",
                "Another native host owns this data directory",
            )
        })?;
        let core = Manager::new(root.to_path_buf()).map_err(|e| Error {
            code: e.code,
            message: e.message,
        })?;
        let mut registry = EngineRegistry::new();
        for kind in ["chromium", "firefox"] {
            let bundle = root.join("engines").join(kind);
            if bundle.join("manifest.json").exists() {
                registry
                    .register(&bundle, &bundle.join("manifest.json"))
                    .map_err(|e| Error {
                        code: e.code,
                        message: e.message,
                    })?;
            }
        }
        let active = root.join("active");
        let supervisor = Supervisor::new(active.clone()).map_err(|e| Error {
            code: e.code,
            message: e.message,
        })?;
        Ok(Self {
            core,
            registry,
            supervisor,
            active,
            operations: Vec::new(),
            _lock: lock,
        })
    }
    fn execute(&mut self, method: &str, params: Value) -> Result<Value> {
        if !params.is_object() {
            return Err(error("INVALID_PARAMS", "Parameters must be an object"));
        }
        if method == "operations.list" {
            return Ok(json!(self.operations));
        }
        let tracked = [
            "profiles.snapshot",
            "revisions.restore",
            "sync.push",
            "sync.pull",
            "vault.changePassword",
        ]
        .contains(&method);
        if !tracked {
            return self.execute_inner(method, params);
        }
        let id = random_hex();
        let started = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let result = self.execute_inner(method, params);
        let finished = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let status = if result.is_ok() {
            "completed"
        } else {
            "failed"
        };
        let mut operation = json!({"id":id,"method":method,"status":status,"events":[{"state":"started","at":started},{"state":status,"at":finished}]});
        if let Err(ref e) = result {
            operation["errorCode"] = json!(e.code);
        }
        self.operations.push(operation);
        if self.operations.len() > 128 {
            self.operations.remove(0);
        }
        result.map(|mut value| {
            if let Some(object) = value.as_object_mut() {
                object.insert("operationId".into(), json!(id));
            }
            value
        })
    }
    fn execute_inner(&mut self, method: &str, mut params: Value) -> Result<Value> {
        if method.len() > 128 {
            return Err(error("INVALID_REQUEST", "Method name exceeds limit"));
        }
        if !params.is_object() {
            return Err(error("INVALID_PARAMS", "Parameters must be an object"));
        }
        match method {
            "engines.list" => Ok(json!(self.registry.list())),
            "automation.endpoint" | "devices.list" => Err(error(
                "CAPABILITY_UNAVAILABLE",
                "This host has no verified implementation for this capability",
            )),
            "profiles.status" => {
                serde_json::to_value(self.supervisor.status().map_err(|e| Error {
                    code: e.code,
                    message: e.message,
                })?)
                .map_err(|_| error("SERIALIZATION", "Status serialization failed"))
            }
            "profiles.launch" => {
                let id = params
                    .get("id")
                    .and_then(Value::as_str)
                    .ok_or_else(|| error("INVALID_PARAMS", "Profile id required"))?;
                let profiles =
                    self.core
                        .execute("profiles.list", json!({}))
                        .map_err(|e| Error {
                            code: e.code,
                            message: e.message,
                        })?;
                let profile = profiles
                    .as_array()
                    .and_then(|p| p.iter().find(|p| p["id"] == id))
                    .ok_or_else(|| error("PROFILE_NOT_FOUND", "Profile not found"))?;
                let request: LaunchRequest = serde_json::from_value(json!({"profileId": id, "engine":profile["engine"],"requestedMode":profile["automation"],"requireStableIdentity":params.get("requireStableIdentity").and_then(Value::as_bool).unwrap_or(true)})).map_err(|_|error("INVALID_PROFILE", "Invalid profile launch configuration"))?;
                serde_json::to_value(self.supervisor.launch(&self.registry, request).map_err(
                    |e| Error {
                        code: e.code,
                        message: e.message,
                    },
                )?)
                .map_err(|_| error("SERIALIZATION", "Launch status serialization failed"))
            }
            "profiles.stop" => {
                let id = params
                    .get("id")
                    .and_then(Value::as_str)
                    .ok_or_else(|| error("INVALID_PARAMS", "Profile id required"))?;
                self.supervisor
                    .stop(id, Duration::from_secs(10))
                    .map_err(|e| Error {
                        code: e.code,
                        message: e.message,
                    })?;
                Ok(json!({"stopped":true}))
            }
            "profiles.focus" => Err(error(
                "CAPABILITY_UNAVAILABLE",
                "Native window activation is not supported by this host",
            )),
            "vault.lock" => {
                if !self
                    .supervisor
                    .status()
                    .map_err(|e| Error {
                        code: e.code,
                        message: e.message,
                    })?
                    .is_empty()
                {
                    return Err(error(
                        "PROFILE_ACTIVE",
                        "Stop active profiles before locking the vault",
                    ));
                }
                let mut locks = Vec::new();
                for directory in fs::read_dir(&self.active).map_err(io_error)? {
                    let entry = directory.map_err(io_error)?;
                    if entry.file_type().map_err(io_error)?.is_dir() {
                        locks.push(stopped_lock(
                            &self.active,
                            &entry.file_name().to_string_lossy(),
                        )?);
                    }
                }
                self.core.execute(method, params).map_err(|e| Error {
                    code: e.code,
                    message: e.message,
                })
            }
            "profiles.snapshot" | "revisions.restore" | "profiles.remove" => {
                let id = params
                    .get("id")
                    .or_else(|| params.get("profileId"))
                    .and_then(Value::as_str)
                    .ok_or_else(|| error("INVALID_PARAMS", "Profile id required"))?
                    .to_string();
                if self
                    .supervisor
                    .status()
                    .map_err(|e| Error {
                        code: e.code,
                        message: e.message,
                    })?
                    .iter()
                    .any(|p| p.profile_id == id)
                {
                    return Err(error(
                        "PROFILE_ACTIVE",
                        "Stop the profile before this operation",
                    ));
                }
                // The engine's exclusive owner lock prevents another host from racing this operation.
                let _lock = stopped_lock(&self.active, &id)?;
                params["running"] = Value::Bool(false);
                self.core.execute(method, params).map_err(|e| Error {
                    code: e.code,
                    message: e.message,
                })
            }
            _ => self.core.execute(method, params).map_err(|e| Error {
                code: e.code,
                message: e.message,
            }),
        }
    }
    fn reply(&mut self, bytes: &[u8]) -> Value {
        match serde_json::from_slice::<Request>(bytes) {
            Ok(request) if request.method.len() <= 128 => {
                match self.execute(&request.method, request.params) {
                    Ok(result) => json!({"id":request.id,"result":result}),
                    Err(e) => json!({"id":request.id,"error":e}),
                }
            }
            _ => {
                json!({"id":null,"error":error("INVALID_REQUEST","Expected a bounded request envelope")})
            }
        }
    }
}
fn stopped_lock(active: &Path, id: &str) -> Result<File> {
    if id.len() != 36
        || !id.bytes().enumerate().all(|(i, c)| {
            if [8, 13, 18, 23].contains(&i) {
                c == b'-'
            } else {
                c.is_ascii_hexdigit()
            }
        })
    {
        return Err(error("INVALID_PROFILE_ID", "Profile id must be a UUID"));
    }
    let directory = active.join(id);
    if directory
        .symlink_metadata()
        .is_ok_and(|m| m.file_type().is_symlink())
    {
        return Err(error(
            "UNSAFE_PATH",
            "Linked active directories are not permitted",
        ));
    }
    fs::create_dir_all(&directory).map_err(io_error)?;
    let path = directory.join(".material-browser.lock");
    if path
        .symlink_metadata()
        .is_ok_and(|m| m.file_type().is_symlink())
    {
        return Err(error("UNSAFE_PATH", "Linked owner locks are not permitted"));
    }
    let lock = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(path)
        .map_err(io_error)?;
    lock.try_lock_exclusive()
        .map_err(|_| error("PROFILE_ACTIVE", "Profile is locked by another process"))?;
    Ok(lock)
}
fn io_error(_: io::Error) -> Error {
    error("HOST_IO", "Native host I/O operation failed")
}
fn private(path: &Path) -> Result<()> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700)).map_err(io_error)?;
    }
    #[cfg(windows)]
    {
        // Build a fresh protected DACL from the process identity, never an environment name.
        // Removing inheritance alone leaves pre-existing explicit access rules behind.
        let script = "$ErrorActionPreference='Stop'; $p=$args[0]; $sid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User; if(Test-Path -LiteralPath $p -PathType Container){$acl=New-Object System.Security.AccessControl.DirectorySecurity; $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow')}else{$acl=New-Object System.Security.AccessControl.FileSecurity; $rule=New-Object System.Security.AccessControl.FileSystemAccessRule($sid,'FullControl','Allow')}; $acl.SetAccessRuleProtection($true,$false); $acl.AddAccessRule($rule); if(Test-Path -LiteralPath $p -PathType Container){[System.IO.Directory]::SetAccessControl($p,$acl)}else{[System.IO.File]::SetAccessControl($p,$acl)}; $actual=if(Test-Path -LiteralPath $p -PathType Container){[System.IO.Directory]::GetAccessControl($p)}else{[System.IO.File]::GetAccessControl($p)}; if(-not $actual.AreAccessRulesProtected){exit 1}; foreach($r in $actual.Access){if($r.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value -ne $sid.Value -or $r.AccessControlType -ne 'Allow'){exit 1}}";
        let script = script.replace(
            "$p=$args[0]",
            &format!("$p='{}'", path.to_string_lossy().replace('\'', "''")),
        );
        let status = std::process::Command::new("powershell.exe")
            .args([
                "-NoLogo",
                "-NoProfile",
                "-NonInteractive",
                "-Command",
                &script,
            ])
            .stdout(std::process::Stdio::null())
            .stderr(std::process::Stdio::null())
            .status()
            .map_err(io_error)?;
        if !status.success() {
            return Err(error(
                "ACL_FAILED",
                "User-only directory access could not be established",
            ));
        }
    }
    Ok(())
}
fn read_line(reader: &mut impl BufRead) -> Result<Option<Vec<u8>>> {
    let mut line = Vec::new();
    loop {
        let available = reader.fill_buf().map_err(io_error)?;
        if available.is_empty() {
            return if line.is_empty() {
                Ok(None)
            } else {
                Ok(Some(line))
            };
        }
        let n = available
            .iter()
            .position(|b| *b == b'\n')
            .map(|i| i + 1)
            .unwrap_or(available.len());
        if line.len() + n > MAX_MESSAGE {
            return Err(error("MESSAGE_TOO_LARGE", "Message exceeds one MiB"));
        }
        line.extend_from_slice(&available[..n]);
        let done = available[n - 1] == b'\n';
        reader.consume(n);
        if done {
            return Ok(Some(line));
        }
    }
}
fn stdio(host: &mut Host) -> Result<()> {
    let mut input = io::stdin().lock();
    let mut output = io::stdout().lock();
    while let Some(line) = read_line(&mut input)? {
        let reply = host.reply(&line);
        serde_json::to_writer(&mut output, &reply)
            .map_err(|_| io_error(io::ErrorKind::BrokenPipe.into()))?;
        output.write_all(b"\n").map_err(io_error)?;
        output.flush().map_err(io_error)?;
    }
    Ok(())
}
fn random_hex() -> String {
    let mut bytes = [0u8; 32];
    rand::rngs::OsRng.fill_bytes(&mut bytes);
    bytes.iter().map(|v| format!("{v:02x}")).collect()
}
fn constant_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    a.iter().zip(b).fold(0u8, |n, (a, b)| n | (a ^ b)) == 0
}
fn http_connection(
    mut stream: TcpStream,
    host: &Arc<Mutex<Host>>,
    authority: &str,
    token: &str,
) -> Result<()> {
    stream
        .set_read_timeout(Some(Duration::from_secs(5)))
        .map_err(io_error)?;
    stream
        .set_write_timeout(Some(Duration::from_secs(5)))
        .map_err(io_error)?;
    let mut reader = io::BufReader::new(stream.try_clone().map_err(io_error)?);
    let mut total = 0usize;
    let mut lines = Vec::new();
    loop {
        let line =
            read_line(&mut reader)?.ok_or_else(|| error("INVALID_HTTP", "Incomplete headers"))?;
        total += line.len();
        if total > 16384 {
            return Err(error("INVALID_HTTP", "Headers too large"));
        }
        if line == b"\r\n" {
            break;
        }
        lines.push(String::from_utf8(line).map_err(|_| error("INVALID_HTTP", "Invalid headers"))?);
    }
    let valid_request = lines
        .first()
        .map(|s| s == "POST /v1/call HTTP/1.1\r\n")
        .unwrap_or(false);
    let mut headers = std::collections::HashMap::new();
    let mut duplicate = false;
    for line in lines.iter().skip(1) {
        let (key, value) = line
            .split_once(':')
            .ok_or_else(|| error("INVALID_HTTP", "Invalid headers"))?;
        if headers
            .insert(key.to_ascii_lowercase(), value.trim().to_owned())
            .is_some()
        {
            duplicate = true;
        }
    }
    let allowed = valid_request
        && !duplicate
        && headers.get("host").is_some_and(|v| v == authority)
        && !headers.contains_key("origin")
        && !headers.contains_key("transfer-encoding")
        && headers
            .get("authorization")
            .is_some_and(|v| constant_eq(v.as_bytes(), format!("Bearer {token}").as_bytes()));
    let (status, reply) = if !allowed {
        (
            "403 Forbidden",
            json!({"error":error("UNAUTHORIZED","Local API request rejected")}),
        )
    } else {
        let len = headers
            .get("content-length")
            .and_then(|s| s.parse::<usize>().ok())
            .filter(|n| *n <= MAX_MESSAGE)
            .ok_or_else(|| error("INVALID_HTTP", "Bounded Content-Length required"))?;
        let mut body = vec![0; len];
        reader.read_exact(&mut body).map_err(io_error)?;
        (
            "200 OK",
            host.lock()
                .map_err(|_| error("HOST_UNAVAILABLE", "Host state unavailable"))?
                .reply(&body),
        )
    };
    let body =
        serde_json::to_vec(&reply).map_err(|_| error("SERIALIZATION", "Reply encoding failed"))?;
    write!(stream,"HTTP/1.1 {status}\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\nContent-Length: {}\r\n\r\n",body.len()).map_err(io_error)?;
    stream.write_all(&body).map_err(io_error)
}
fn daemon(root: &Path, host: Host) -> Result<()> {
    let listener = TcpListener::bind("127.0.0.1:0").map_err(io_error)?;
    let authority = listener.local_addr().map_err(io_error)?.to_string();
    let token = random_hex();
    let descriptor = root.join("api.json");
    fs::write(&descriptor,serde_json::to_vec(&json!({"schemaVersion":1,"url":format!("http://{authority}/v1/call"),"token":token,"pid":std::process::id()})).unwrap()).map_err(io_error)?;
    private(&descriptor)?;
    let host = Arc::new(Mutex::new(host));
    for stream in listener.incoming() {
        if let Ok(stream) = stream {
            let _ = http_connection(stream, &host, &authority, &token);
        }
    }
    let _ = fs::remove_file(descriptor);
    Ok(())
}
fn cli_call(root: &Path, request: Value) -> Result<()> {
    let reply = if root.join("api.json").exists() {
        let bytes = fs::read(root.join("api.json")).map_err(io_error)?;
        if bytes.len() > 8192 {
            return Err(error(
                "INVALID_DESCRIPTOR",
                "Local API descriptor exceeds limit",
            ));
        }
        let descriptor: Value = serde_json::from_slice(&bytes)
            .map_err(|_| error("INVALID_DESCRIPTOR", "Invalid local API descriptor"))?;
        let url = descriptor["url"]
            .as_str()
            .ok_or_else(|| error("INVALID_DESCRIPTOR", "Local API URL missing"))?;
        let authority = url
            .strip_prefix("http://")
            .and_then(|s| s.strip_suffix("/v1/call"))
            .ok_or_else(|| error("INVALID_DESCRIPTOR", "Invalid local API URL"))?;
        let address: SocketAddr = authority
            .parse()
            .map_err(|_| error("INVALID_DESCRIPTOR", "Invalid local address"))?;
        if !address.ip().is_loopback() {
            return Err(error("INVALID_DESCRIPTOR", "Local API must be loopback"));
        }
        let token = descriptor["token"]
            .as_str()
            .filter(|s| s.len() == 64 && s.bytes().all(|b| b.is_ascii_hexdigit()))
            .ok_or_else(|| error("INVALID_DESCRIPTOR", "Invalid local API credential"))?;
        let mut stream =
            TcpStream::connect_timeout(&address, Duration::from_secs(3)).map_err(io_error)?;
        stream
            .set_read_timeout(Some(Duration::from_secs(120)))
            .map_err(io_error)?;
        stream
            .set_write_timeout(Some(Duration::from_secs(5)))
            .map_err(io_error)?;
        let body = serde_json::to_vec(&request)
            .map_err(|_| error("INVALID_REQUEST", "Request encoding failed"))?;
        write!(stream,"POST /v1/call HTTP/1.1\r\nHost: {authority}\r\nAuthorization: Bearer {token}\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n",body.len()).map_err(io_error)?;
        stream.write_all(&body).map_err(io_error)?;
        let mut bytes = Vec::new();
        stream
            .take((MAX_MESSAGE + 16385) as u64)
            .read_to_end(&mut bytes)
            .map_err(io_error)?;
        if bytes.len() > MAX_MESSAGE + 16384 {
            return Err(error(
                "MESSAGE_TOO_LARGE",
                "Local API response exceeds limit",
            ));
        }
        let offset = bytes
            .windows(4)
            .position(|v| v == b"\r\n\r\n")
            .ok_or_else(|| error("INVALID_HTTP", "Incomplete API response"))?;
        serde_json::from_slice(&bytes[offset + 4..])
            .map_err(|_| error("INVALID_HTTP", "Invalid API response"))?
    } else {
        let mut host = Host::new(root)?;
        host.reply(
            &serde_json::to_vec(&request)
                .map_err(|_| error("INVALID_REQUEST", "Invalid request"))?,
        )
    };
    println!("{reply}");
    if reply.get("error").is_some() {
        return Err(error("COMMAND_FAILED", "Native request returned an error"));
    }
    Ok(())
}
fn run() -> Result<()> {
    let mut args = std::env::args().skip(1);
    if args.next().as_deref() != Some("--data-dir") {
        return Err(error(
            "USAGE",
            "Use --data-dir <absolute path> serve --stdio | daemon | call | status | profiles list | vault create/unlock/lock",
        ));
    }
    let root = PathBuf::from(
        args.next()
            .ok_or_else(|| error("USAGE", "Data directory required"))?,
    );
    let command = args
        .next()
        .ok_or_else(|| error("USAGE", "Command required"))?;
    if command == "pair-key" {
        return lan::create_key(&root);
    }
    if !root.is_absolute() {
        return Err(error("INVALID_DATA_DIR", "Data directory must be absolute"));
    }
    match command.as_str() {
        "call" => {
            let mut input = io::stdin().lock();
            let bytes = read_line(&mut input)?
                .ok_or_else(|| error("INVALID_REQUEST", "Request required on stdin"))?;
            let request: Value = serde_json::from_slice(&bytes)
                .map_err(|_| error("INVALID_REQUEST", "Invalid request envelope"))?;
            return cli_call(&root, request);
        }
        "status" => {
            return cli_call(
                &root,
                json!({"id":"cli","method":"system.status","params":{}}),
            );
        }
        "profiles" => {
            let action = args
                .next()
                .ok_or_else(|| error("USAGE", "Profile action required"))?;
            let params = match action.as_str() {
                "list" => json!({}),
                "launch" | "stop" => {
                    json!({"id":args.next().ok_or_else(||error("USAGE","Profile id required"))?})
                }
                "create" => {
                    json!({"name":args.next().ok_or_else(||error("USAGE","Profile name required"))?,"engine":args.next().unwrap_or("chromium".into()),"automation":"off"})
                }
                _ => return Err(error("USAGE", "Unsupported profile command")),
            };
            return cli_call(
                &root,
                json!({"id":"cli","method":format!("profiles.{action}"),"params":params}),
            );
        }
        "vault" => {
            let action = args
                .next()
                .ok_or_else(|| error("USAGE", "Vault action required"))?;
            if !["create", "unlock", "lock", "join"].contains(&action.as_str()) {
                return Err(error("USAGE", "Unsupported vault command"));
            }
            let mut params = json!({});
            if action == "join" {
                params["folder"] = Value::String(
                    args.next()
                        .ok_or_else(|| error("USAGE", "Shared folder required"))?,
                );
            }
            if action != "lock" {
                let bytes = read_line(&mut io::stdin().lock())?.ok_or_else(|| {
                    error(
                        "INVALID_PARAMS",
                        "JSON password object required on standard input",
                    )
                })?;
                let secret: Value = serde_json::from_slice(&bytes).map_err(|_| {
                    error(
                        "INVALID_PARAMS",
                        "JSON password object required on standard input",
                    )
                })?;
                params["password"] = secret
                    .get("password")
                    .filter(|p| p.is_string())
                    .cloned()
                    .ok_or_else(|| error("INVALID_PARAMS", "Password string required"))?;
            }
            return cli_call(
                &root,
                json!({"id":"cli","method":format!("vault.{action}"),"params":params}),
            );
        }
        "sync" | "revisions" => {
            let action = args
                .next()
                .ok_or_else(|| error("USAGE", "Action required"))?;
            let params = match (command.as_str(), action.as_str()) {
                ("sync", "push" | "pull" | "conflicts") => json!({}),
                ("sync", "configure") => {
                    json!({"folder":args.next().ok_or_else(||error("USAGE","Absolute sync folder required"))?})
                }
                ("revisions", "list") => {
                    json!({"id":args.next().ok_or_else(||error("USAGE","Profile id required"))?})
                }
                ("revisions", "restore") | ("sync", "resolve") => {
                    json!({"id":args.next().ok_or_else(||error("USAGE","Profile id required"))?,"revisionId":args.next().ok_or_else(||error("USAGE","Revision id required"))?})
                }
                _ => return Err(error("USAGE", "Unsupported action")),
            };
            return cli_call(
                &root,
                json!({"id":"cli","method":format!("{command}.{action}"),"params":params}),
            );
        }
        _ => {}
    }
    let mut host = Host::new(&root)?;
    match command.as_str() {
        "serve" if args.next().as_deref() == Some("--stdio") => stdio(&mut host),
        "daemon" => daemon(&root, host),
        "lan" => {
            let address: SocketAddr = args
                .next()
                .ok_or_else(|| error("USAGE", "Explicit private listen address required"))?
                .parse()
                .map_err(|_| error("USAGE", "Invalid listen address"))?;
            lan::serve(&root, address, host)
        }
        _ => Err(error(
            "USAGE",
            "Unknown command; use call with a JSON envelope on stdin for all native methods",
        )),
    }
}
fn main() {
    if let Err(e) = run() {
        eprintln!(
            "{}",
            serde_json::to_string(&e).unwrap_or_else(|_| "Native host failed".into())
        );
        std::process::exit(1);
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn operation_history_records_real_failure_without_parameters() {
        let root = std::env::temp_dir().join(format!("material-operation-test-{}", random_hex()));
        let mut host = Host::new(&root).unwrap();
        assert!(
            host.execute("sync.push", json!({"password":"synthetic-only"}))
                .is_err()
        );
        let history = host.execute("operations.list", json!({})).unwrap();
        assert_eq!(history.as_array().unwrap().len(), 1);
        assert_eq!(history[0]["status"], "failed");
        assert_eq!(history[0]["events"][0]["state"], "started");
        assert_eq!(history[0]["events"][1]["state"], "failed");
        assert_eq!(history[0]["id"].as_str().unwrap().len(), 64);
        assert!(!history.to_string().contains("synthetic-only"));
        drop(host);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn bounded_parser() {
        assert!(read_line(&mut io::Cursor::new(vec![b'x'; MAX_MESSAGE + 1])).is_err());
        assert_eq!(
            read_line(&mut io::Cursor::new(b"one\ntwo\n"))
                .unwrap()
                .unwrap(),
            b"one\n"
        );
    }
    #[test]
    fn token_comparison() {
        assert!(constant_eq(b"abc", b"abc"));
        assert!(!constant_eq(b"abc", b"abd"));
        assert!(!constant_eq(b"abc", b"ab"));
    }
    #[test]
    fn snapshot_cannot_override_external_lock() {
        let root = std::env::temp_dir().join(format!("material-host-test-{}", random_hex()));
        let mut host = Host::new(&root).unwrap();
        host.execute(
            "vault.create",
            json!({"password":"test-only-not-a-real-secret"}),
        )
        .unwrap();
        let profile = host
            .execute(
                "profiles.create",
                json!({"name":"fixture","engine":"chromium"}),
            )
            .unwrap();
        let id = profile["id"].as_str().unwrap();
        let lock = stopped_lock(&host.active, id).unwrap();
        let failure = host
            .execute("profiles.snapshot", json!({"id":id,"running":false}))
            .unwrap_err();
        assert_eq!(failure.code, "PROFILE_ACTIVE");
        assert_eq!(
            host.execute("vault.lock", json!({})).unwrap_err().code,
            "PROFILE_ACTIVE"
        );
        drop(lock);
        drop(host);
        fs::remove_dir_all(root).unwrap();
    }
    #[test]
    fn hostile_http_origin_host_and_credential_do_not_execute() {
        let root = std::env::temp_dir().join(format!("material-http-test-{}", random_hex()));
        let host = Arc::new(Mutex::new(Host::new(&root).unwrap()));
        for headers in [
            "Host: attacker.invalid\r\nAuthorization: Bearer expected\r\n",
            "Host: EXPECTED\r\nOrigin: https://attacker.invalid\r\nAuthorization: Bearer expected\r\n",
            "Host: EXPECTED\r\nAuthorization: Bearer wrong\r\n",
            "Host: EXPECTED\r\nHost: EXPECTED\r\nAuthorization: Bearer expected\r\n",
        ] {
            let listener = TcpListener::bind("127.0.0.1:0").unwrap();
            let authority = listener.local_addr().unwrap().to_string();
            let cloned = host.clone();
            let expected = authority.clone();
            let server = std::thread::spawn(move || {
                let (stream, _) = listener.accept().unwrap();
                http_connection(stream, &cloned, &expected, "expected").unwrap();
            });
            let mut client = TcpStream::connect(&authority).unwrap();
            let headers = headers.replace("EXPECTED", &authority);
            write!(
                client,
                "POST /v1/call HTTP/1.1\r\n{headers}Content-Length: 0\r\n\r\n"
            )
            .unwrap();
            let mut result = String::new();
            client.read_to_string(&mut result).unwrap();
            assert!(result.starts_with("HTTP/1.1 403"));
            server.join().unwrap();
        }
        drop(host);
        fs::remove_dir_all(root).unwrap();
    }
}

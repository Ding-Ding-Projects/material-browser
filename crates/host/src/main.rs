use material_browser_core::Manager;
use material_browser_engine::{EngineRegistry, Supervisor, LaunchRequest};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{fs::{self, File, OpenOptions}, io::{self, BufRead, Read, Write}, net::{SocketAddr, TcpListener, TcpStream}, path::{Path, PathBuf}, sync::{Arc, Mutex}, time::Duration};
use fs2::FileExt;
use rand::RngCore;
mod lan;
const MAX_MESSAGE: usize = 1024 * 1024;
#[derive(Debug, Serialize)]
pub struct Error { pub code: String, pub message: String }
fn error(code: &str, message: &str) -> Error { Error { code: code.into(), message: message.into() } }
type Result<T> = std::result::Result<T, Error>;
#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Request { pub id: Value, pub method: String, #[serde(default = "empty")] pub params: Value }
fn empty() -> Value { json!({}) }
pub struct Host { core: Manager, registry: EngineRegistry, supervisor: Supervisor, active: PathBuf, _lock: File }
impl Host {
 fn new(root: &Path) -> Result<Self> {
  if !root.is_absolute() { return Err(error("INVALID_DATA_DIR", "Data directory must be absolute")); }
  fs::create_dir_all(root).map_err(io_error)?;
  private(root)?;
  let lock = OpenOptions::new().create(true).truncate(false).read(true).write(true).open(root.join("host.lock")).map_err(io_error)?;
  lock.try_lock_exclusive().map_err(|_|error("HOST_ACTIVE", "Another native host owns this data directory"))?;
  let core = Manager::new(root.to_path_buf()).map_err(|e|Error {code:e.code,message:e.message})?;
  let mut registry = EngineRegistry::new();
  for kind in ["chromium", "firefox"] {
   let bundle = root.join("engines").join(kind);
   if bundle.join("manifest.json").exists() { registry.register(&bundle, &bundle.join("manifest.json")).map_err(|e|Error {code:e.code,message:e.message})?; }
  }
  let active = root.join("active");
  let supervisor = Supervisor::new(active.clone()).map_err(|e|Error {code:e.code,message:e.message})?;
  Ok(Self {core,registry,supervisor,active,_lock:lock})
 }
 fn execute(&mut self, method: &str, mut params: Value) -> Result<Value> {
  if !params.is_object() { return Err(error("INVALID_PARAMS", "Parameters must be an object")); }
  match method {
   "profiles.status" => serde_json::to_value(self.supervisor.status().map_err(|e|Error {code:e.code,message:e.message})?).map_err(|_|error("SERIALIZATION", "Status serialization failed")),
   "profiles.launch" => {
    let id = params.get("id").and_then(Value::as_str).ok_or_else(||error("INVALID_PARAMS", "Profile id required"))?;
    let profiles = self.core.execute("profiles.list", json!({})).map_err(|e|Error {code:e.code,message:e.message})?;
    let profile = profiles.as_array().and_then(|p|p.iter().find(|p|p["id"]==id)).ok_or_else(||error("PROFILE_NOT_FOUND", "Profile not found"))?;
    let request: LaunchRequest = serde_json::from_value(json!({"profileId": id, "engine":profile["engine"],"requestedMode":profile["automation"],"requireStableIdentity":params.get("requireStableIdentity").and_then(Value::as_bool).unwrap_or(false)})).map_err(|_|error("INVALID_PROFILE", "Invalid profile launch configuration"))?;
    serde_json::to_value(self.supervisor.launch(&self.registry, request).map_err(|e|Error {code:e.code,message:e.message})?).map_err(|_|error("SERIALIZATION", "Launch status serialization failed"))
   },
   "profiles.stop" => { let id=params.get("id").and_then(Value::as_str).ok_or_else(||error("INVALID_PARAMS", "Profile id required"))?; self.supervisor.stop(id, Duration::from_secs(10)).map_err(|e|Error {code:e.code,message:e.message})?; Ok(json!({"stopped":true})) },
   "profiles.focus" => Err(error("CAPABILITY_UNAVAILABLE", "Native window activation is not supported by this host")),
   "vault.lock" => {
    if !self.supervisor.status().map_err(|e|Error {code:e.code,message:e.message})?.is_empty() { return Err(error("PROFILE_ACTIVE", "Stop active profiles before locking the vault")); }
    self.core.execute(method,params).map_err(|e|Error {code:e.code,message:e.message})
   },
   "profiles.snapshot" | "revisions.restore" | "profiles.remove" => {
    let id=params.get("id").or_else(||params.get("profileId")).and_then(Value::as_str).ok_or_else(||error("INVALID_PARAMS", "Profile id required"))?.to_string();
    if self.supervisor.status().map_err(|e|Error {code:e.code,message:e.message})?.iter().any(|p|p.profile_id==id) { return Err(error("PROFILE_ACTIVE", "Stop the profile before this operation")); }
    // The engine's exclusive owner lock prevents another host from racing this operation.
    if id.len()!=36 || !id.bytes().all(|c|c.is_ascii_hexdigit()||c==b'-') { return Err(error("INVALID_PROFILE_ID", "Profile id must be a UUID")); }
    let directory=self.active.join(&id); fs::create_dir_all(&directory).map_err(io_error)?;
    let lock=OpenOptions::new().create(true).truncate(false).read(true).write(true).open(directory.join(".material-browser.lock")).map_err(io_error)?;
    lock.try_lock_exclusive().map_err(|_|error("PROFILE_ACTIVE", "Profile is locked by another process"))?;
    params["running"]=Value::Bool(false);
    self.core.execute(method,params).map_err(|e|Error {code:e.code,message:e.message})
   },
   _ => self.core.execute(method,params).map_err(|e|Error {code:e.code,message:e.message})
  }
 }
 fn reply(&mut self, bytes: &[u8]) -> Value {
  match serde_json::from_slice::<Request>(bytes) {
   Ok(request) if request.method.len()<=128 => match self.execute(&request.method, request.params) { Ok(result)=>json!({"id":request.id,"result":result}),Err(e)=>json!({"id":request.id,"error":e}) },
   _=>json!({"id":null,"error":error("INVALID_REQUEST","Expected a bounded request envelope")})
  }
 }
}
fn io_error(_: io::Error) -> Error { error("HOST_IO", "Native host I/O operation failed") }
fn private(path: &Path) -> Result<()> {
 #[cfg(unix)] { use std::os::unix::fs::PermissionsExt; fs::set_permissions(path, fs::Permissions::from_mode(0o700)).map_err(io_error)?; }
 #[cfg(windows)] {
  let user=std::env::var("USERNAME").map_err(|_|error("ACL_FAILED", "Current user could not be resolved"))?;
  let status=std::process::Command::new("icacls.exe").arg(path).args(["/inheritance:r","/grant:r"]).arg(format!("{user}:(OI)(CI)F")).stdout(std::process::Stdio::null()).stderr(std::process::Stdio::null()).status().map_err(io_error)?;
  if !status.success() {return Err(error("ACL_FAILED", "User-only directory access could not be established"));}
 }
 Ok(())
}
fn read_line(reader: &mut impl BufRead) -> Result<Option<Vec<u8>>> {
 let mut line=Vec::new();
 loop {let available=reader.fill_buf().map_err(io_error)?; if available.is_empty(){return if line.is_empty(){Ok(None)}else{Ok(Some(line))};} let n=available.iter().position(|b|*b==b'\n').map(|i|i+1).unwrap_or(available.len()); if line.len()+n>MAX_MESSAGE{return Err(error("MESSAGE_TOO_LARGE","Message exceeds one MiB"));} line.extend_from_slice(&available[..n]); let done=available[n-1]==b'\n';reader.consume(n);if done{return Ok(Some(line));}}
}
fn stdio(host: &mut Host) -> Result<()> { let mut input=io::stdin().lock();let mut output=io::stdout().lock();while let Some(line)=read_line(&mut input)? {let reply=host.reply(&line);serde_json::to_writer(&mut output,&reply).map_err(|_|io_error(io::ErrorKind::BrokenPipe.into()))?;output.write_all(b"\n").map_err(io_error)?;output.flush().map_err(io_error)?;} Ok(()) }
fn random_hex() -> String { let mut bytes=[0u8;32];rand::rngs::OsRng.fill_bytes(&mut bytes);bytes.iter().map(|v|format!("{v:02x}")).collect() }
fn constant_eq(a: &[u8], b: &[u8]) -> bool { if a.len()!=b.len(){return false;}a.iter().zip(b).fold(0u8,|n,(a,b)|n|(a^b))==0 }
fn http_connection(mut stream:TcpStream,host:&Arc<Mutex<Host>>,authority:&str,token:&str) -> Result<()> {
 stream.set_read_timeout(Some(Duration::from_secs(5))).map_err(io_error)?;stream.set_write_timeout(Some(Duration::from_secs(5))).map_err(io_error)?;
 let mut reader=io::BufReader::new(stream.try_clone().map_err(io_error)?); let mut total=0usize;let mut lines=Vec::new();
 loop {let line=read_line(&mut reader)?.ok_or_else(||error("INVALID_HTTP","Incomplete headers"))?;total+=line.len();if total>16384{return Err(error("INVALID_HTTP","Headers too large"));}if line==b"\r\n"{break;}lines.push(String::from_utf8(line).map_err(|_|error("INVALID_HTTP","Invalid headers"))?);}
 let valid_request=lines.first().map(|s|s=="POST /v1/call HTTP/1.1\r\n").unwrap_or(false);
 let mut headers=std::collections::HashMap::new();let mut duplicate=false;
 for line in lines.iter().skip(1){let (key,value)=line.split_once(':').ok_or_else(||error("INVALID_HTTP","Invalid headers"))?;if headers.insert(key.to_ascii_lowercase(),value.trim().to_owned()).is_some(){duplicate=true;}}
 let allowed=valid_request&&!duplicate&&headers.get("host").is_some_and(|v|v==authority)&&!headers.contains_key("origin")&&!headers.contains_key("transfer-encoding")&&headers.get("authorization").is_some_and(|v|constant_eq(v.as_bytes(),format!("Bearer {token}").as_bytes()));
 let (status,reply)=if !allowed {("403 Forbidden",json!({"error":error("UNAUTHORIZED","Local API request rejected")}))}else{
  let len=headers.get("content-length").and_then(|s|s.parse::<usize>().ok()).filter(|n|*n<=MAX_MESSAGE).ok_or_else(||error("INVALID_HTTP","Bounded Content-Length required"))?;
  let mut body=vec![0;len];reader.read_exact(&mut body).map_err(io_error)?;
  ("200 OK",host.lock().map_err(|_|error("HOST_UNAVAILABLE","Host state unavailable"))?.reply(&body))};
 let body=serde_json::to_vec(&reply).map_err(|_|error("SERIALIZATION","Reply encoding failed"))?;
 write!(stream,"HTTP/1.1 {status}\r\nContent-Type: application/json\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\nContent-Length: {}\r\n\r\n",body.len()).map_err(io_error)?;stream.write_all(&body).map_err(io_error)
}
fn daemon(root:&Path,host:Host)->Result<()> {
 let listener=TcpListener::bind("127.0.0.1:0").map_err(io_error)?;let authority=listener.local_addr().map_err(io_error)?.to_string();let token=random_hex();
 let descriptor=root.join("api.json");fs::write(&descriptor,serde_json::to_vec(&json!({"schemaVersion":1,"url":format!("http://{authority}/v1/call"),"token":token,"pid":std::process::id()})).unwrap()).map_err(io_error)?;
 let host=Arc::new(Mutex::new(host));
 for stream in listener.incoming(){if let Ok(stream)=stream{let _=http_connection(stream,&host,&authority,&token);}}
 let _=fs::remove_file(descriptor);Ok(())
}
fn run()->Result<()> {
 let mut args=std::env::args().skip(1);if args.next().as_deref()!=Some("--data-dir"){return Err(error("USAGE","Use --data-dir <absolute path> serve --stdio | daemon | call | status | profiles list | vault create/unlock/lock"));}
 let root=PathBuf::from(args.next().ok_or_else(||error("USAGE","Data directory required"))?);let command=args.next().ok_or_else(||error("USAGE","Command required"))?;
 if command=="pair-key"{return lan::create_key(&root);}
 let mut host=Host::new(&root)?;
 match command.as_str(){
  "serve" if args.next().as_deref()==Some("--stdio") => stdio(&mut host),
  "daemon" => daemon(&root,host),
  "lan" => {let address:SocketAddr=args.next().ok_or_else(||error("USAGE","Explicit private listen address required"))?.parse().map_err(|_|error("USAGE","Invalid listen address"))?;lan::serve(&root,address,host)},
  "call"=>{let mut input=io::stdin().lock();let bytes=read_line(&mut input)?.ok_or_else(||error("INVALID_REQUEST","Request required on stdin"))?;println!("{}",host.reply(&bytes));Ok(())},
  "status"=>{println!("{}",host.reply(br#"{"id":"cli","method":"system.status","params":{}}"#));Ok(())},
  "profiles" if args.next().as_deref()==Some("list")=>{println!("{}",host.reply(br#"{"id":"cli","method":"profiles.list","params":{}}"#));Ok(())},
  "vault"=>{let action=args.next().ok_or_else(||error("USAGE","Vault action required"))?;if !["create","unlock","lock"].contains(&action.as_str()){return Err(error("USAGE","Unsupported vault action"));}let mut params=json!({});if action!="lock"{let password=rpassword::prompt_password("Vault password: ").map_err(io_error)?;params["password"]=Value::String(password);}let result=host.execute(&format!("vault.{action}"),params)?;println!("{}",json!({"id":"cli","result":result}));Ok(())},
  _=>Err(error("USAGE","Unknown command; use call with a JSON envelope on stdin for all native methods"))
 }
}
fn main(){if let Err(e)=run(){eprintln!("{}",serde_json::to_string(&e).unwrap_or_else(|_|"Native host failed".into()));std::process::exit(1);}}
#[cfg(test)] mod tests {use super::*;#[test]fn bounded_parser(){assert!(read_line(&mut io::Cursor::new(vec![b'x';MAX_MESSAGE+1])).is_err());assert_eq!(read_line(&mut io::Cursor::new(b"one\ntwo\n")).unwrap().unwrap(),b"one\n");}#[test]fn token_comparison(){assert!(constant_eq(b"abc",b"abc"));assert!(!constant_eq(b"abc",b"abd"));assert!(!constant_eq(b"abc",b"ab"));}}


"""Run only through an isolated desktop launcher, with synthetic data and managed bundles.

This fixture opens real browser windows. It does not select a desktop or prove its
own capture route. The caller must bind its receipt to the actual isolated launch.
"""
import argparse
import hashlib
import json
import pathlib
import subprocess
import time
import urllib.request

parser = argparse.ArgumentParser()
parser.add_argument("--binary", required=True)
parser.add_argument("--root", required=True)
parser.add_argument("--output", required=True)
parser.add_argument("--engine", choices=["chromium", "firefox"], default="chromium")
parser.add_argument("--lan-address", help="Explicit private IPv4 interface:port for paired runtime checks")
args = parser.parse_args()
binary = pathlib.Path(args.binary).resolve()
root = pathlib.Path(args.root).resolve()
report = {"binarySha256": hashlib.sha256(binary.read_bytes()).hexdigest(),
          "engine": args.engine, "checks": [], "advancedCapabilitiesVerified": False}
client_root = root.parent / (root.name + "-paired-client")
server_public = client_public = None
grants = ["vault.create", "vault.lock", "profiles.create", "profiles.update", "profiles.launch",
          "profiles.stop", "profiles.status", "profiles.snapshot", "automation.endpoint",
          "automation.webdriver", "tunnel.open", "tunnel.exchange", "tunnel.close"]
if args.lan_address:
    def identity(directory):
        child = subprocess.run([str(binary), "--data-dir", str(directory), "pair-key"], capture_output=True, text=True, check=True)
        return json.loads(child.stdout)["publicKey"]
    server_public, client_public = identity(root), identity(client_root)
    (root / "lan-peers.json").write_text(json.dumps({"peers": [{"publicKey": client_public, "methods": grants, "profileIds": ["*"], "revoked": False}]}))
host_command = [str(binary), "--data-dir", str(root)] + (["lan", args.lan_address] if args.lan_address else ["serve", "--stdio"])
host = subprocess.Popen(host_command,
                        stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                        stderr=subprocess.PIPE, text=True, encoding="utf-8")
sequence = 0

def call(method, params=None, expected_error=None):
    global sequence
    sequence += 1
    envelope = json.dumps({"id": sequence, "method": method, "params": params or {}}) + "\n"
    if args.lan_address:
        child = subprocess.run([str(binary), "--data-dir", str(client_root), "lan-call", args.lan_address, server_public, client_public], input=envelope, capture_output=True, text=True, timeout=45)
        reply = json.loads(child.stdout)
    else:
        host.stdin.write(envelope)
        host.stdin.flush()
        reply = json.loads(host.stdout.readline())
    if expected_error:
        assert reply.get("error", {}).get("code") == expected_error, method
        return reply
    if "error" in reply:
        raise RuntimeError(method + ":" + reply["error"]["code"])
    return reply["result"]

try:
    if args.lan_address:
        time.sleep(1)
    call("vault.create", {"password": "synthetic-native-runtime-fixture-only"})
    profile = call("profiles.create", {"name": "Synthetic runtime fixture", "engine": args.engine})
    profile_id = profile["id"]
    assert profile["automation"] == "off"
    report["checks"].append("new-profile-default-off")
    for mode in ["off", "selenium", "puppeteer"]:
        call("profiles.update", {"id": profile_id, "automation": mode})
        status = call("profiles.launch", {"id": profile_id, "requireStableIdentity": False})
        assert status["effectiveMode"] == mode
        if mode == "off":
            call("automation.endpoint", {"id": profile_id}, "AUTOMATION_DISABLED")
        elif mode == "selenium":
            endpoint = call("automation.endpoint", {"id": profile_id})
            assert endpoint["protocol"] == "webdriver" and endpoint["sessionId"]
            call("automation.webdriver", {"id": profile_id, "verb": "POST", "path": "/url",
                                          "body": {"url": "data:text/html,<title>Managed fixture</title>"}})
            title = call("automation.webdriver", {"id": profile_id, "path": "/title"})
            assert title["value"] == "Managed fixture"
            if args.lan_address:
                relay = subprocess.Popen([str(binary), "--data-dir", str(client_root), "lan-webdriver", args.lan_address, server_public, client_public, profile_id], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                try:
                    local = json.loads(relay.stdout.readline())
                    with urllib.request.urlopen(local["url"] + "/session/" + local["sessionId"] + "/title", timeout=15) as response:
                        assert json.load(response)["value"] == "Managed fixture"
                    report["checks"].append("paired-selenium-owned-session-title")
                finally:
                    relay.terminate(); relay.wait(timeout=10)
        else:
            endpoint = call("automation.endpoint", {"id": profile_id})
            assert endpoint["protocol"] in ["cdp", "bidi"]
            adapter = json.loads((root / "engines" / args.engine / "adapters.json").read_text())[mode]
            script = "const fs=require('node:fs');const c=JSON.parse(fs.readFileSync(0,'utf8'));const r=require('node:module').createRequire(c.helper);(async()=>{const b=await r('puppeteer-core').connect({browserWSEndpoint:c.url,protocol:c.protocol==='bidi'?'webDriverBiDi':'cdp'});try{const p=await b.newPage();await p.goto('data:text/html,<title>Managed fixture</title>');if(await p.title()!=='Managed fixture')throw Error('title');await p.close();}finally{await b.disconnect();}})().catch(()=>process.exit(1));"
            relay = None
            try:
                if args.lan_address:
                    relay = subprocess.Popen([str(binary), "--data-dir", str(client_root), "lan-forward", args.lan_address, server_public, client_public, profile_id], stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
                    endpoint["url"] = json.loads(relay.stdout.readline())["url"]
                child = subprocess.run([adapter["node"], "-e", script], input=json.dumps({"helper": adapter["helper"], "url": endpoint["url"], "protocol": endpoint["protocol"]}),
                                       text=True, capture_output=True, timeout=30)
                assert child.returncode == 0, "puppeteer title roundtrip"
                if args.lan_address:
                    report["checks"].append("paired-puppeteer-title")
            finally:
                if relay:
                    relay.terminate(); relay.wait(timeout=10)
        if mode != "off":
            call("profiles.update", {"id": profile_id, "automation": "off"})
            call("automation.endpoint", {"id": profile_id}, "AUTOMATION_DISABLED")
        call("profiles.stop", {"id": profile_id})
        assert call("profiles.status") == []
        call("profiles.snapshot", {"id": profile_id})
        report["checks"].append(mode + "-launch-stop-snapshot")
    call("vault.lock")
    report["state"] = "passed"
except Exception as error:
    report["state"] = "failed"
    report["reason"] = str(error)
finally:
    host.stdin.close()
    if args.lan_address:
        host.terminate()
    try:
        report["hostExit"] = host.wait(timeout=15)
    except subprocess.TimeoutExpired:
        host.kill()
        report["hostExit"] = host.wait(timeout=5)
    pathlib.Path(args.output).write_text(json.dumps(report, indent=2), encoding="utf-8")
raise SystemExit(0 if report["state"] == "passed" and (args.lan_address or report["hostExit"] == 0) else 1)

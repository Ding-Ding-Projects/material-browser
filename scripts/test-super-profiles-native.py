"""Exercise the real native stdio boundary with an isolated synthetic vault.

Does not launch guests or change host features. Pass a new, task-owned data path.
"""
import argparse
import hashlib
import json
import queue
import secrets
import subprocess
import threading
from pathlib import Path


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--executable", required=True)
    parser.add_argument("--data-dir", required=True)
    parser.add_argument("--receipt", required=True)
    args = parser.parse_args()
    executable_hash = hashlib.sha256(Path(args.executable).read_bytes()).hexdigest()
    password = secrets.token_urlsafe(48)
    checks = []
    process = None

    def start():
        child = subprocess.Popen(
            [args.executable, "--data-dir", args.data_dir, "serve", "--stdio"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            text=True, encoding="utf-8", bufsize=1,
        )
        responses = queue.Queue()
        def read():
            for line in child.stdout:
                responses.put(line)
            responses.put(None)
        threading.Thread(target=read, daemon=True).start()
        return child, responses

    def call(method, params=None, expected=None):
        identifier = str(len(checks))
        process.stdin.write(json.dumps({"id": identifier, "method": method, "params": params or {}}) + "\n")
        process.stdin.flush()
        line = responses.get(timeout=30)
        if line is None:
            raise AssertionError("Native host exited before responding")
        reply = json.loads(line)
        assert reply["id"] == identifier
        if expected:
            assert reply.get("error", {}).get("code") == expected, "Unexpected native error code"
            checks.append({"method": method, "expectedError": expected, "passed": True})
            return None
        assert "error" not in reply, "Native operation did not succeed"
        checks.append({"method": method, "passed": True})
        return reply["result"]

    def stop():
        process.stdin.close()
        assert process.wait(timeout=15) == 0

    try:
        process, responses = start()
        assert call("system.status")["locked"] is True
        call("superProfiles.list", expected="LOCKED")
        call("vault.create", {"password": password})
        profile = call("superProfiles.create", {"name": "Synthetic environment", "engine": "chromium", "settings": {"backend": "wsl2", "launchMode": "terminal"}})
        first = profile["revisionId"]
        profile = call("superProfiles.update", {"id": profile["id"], "expectedRevisionId": first, "settings": {"backend": "windows-sandbox", "launchMode": "browser"}})
        call("superProfiles.update", {"id": profile["id"], "expectedRevisionId": first, "name": "Stale update"}, "REVISION_CONFLICT")
        assert len(call("superProfiles.revisions.list", {"id": profile["id"]})) == 2
        profile = call("superProfiles.revisions.restore", {"id": profile["id"], "expectedRevisionId": profile["revisionId"], "revisionId": first})
        assert profile["settings"]["backend"] == "wsl2"
        duplicate = call("superProfiles.duplicate", {"id": profile["id"], "name": "Synthetic copy"})
        call("superProfiles.remove", {"id": duplicate["id"], "expectedRevisionId": duplicate["revisionId"]})
        call("superProfiles.sessions.launch", {"profileId": profile["id"]}, "IDENTITY_CONFIRMATION_REQUIRED")
        call("vault.lock")
        stop()
        process, responses = start()
        assert call("system.status")["locked"] is True
        call("vault.unlock", {"password": password})
        restored = call("superProfiles.list")
        assert len(restored) == 1 and restored[0]["revisionId"] == profile["revisionId"]
        call("superProfiles.capabilities")
        call("vault.lock")
        stop()
        receipt = {"schemaVersion": 1, "executableSha256": executable_hash, "checks": checks,
                   "guestLaunchTested": False, "status": "passed"}
        Path(args.receipt).parent.mkdir(parents=True, exist_ok=True)
        Path(args.receipt).write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        print(f"Native Super Profiles protocol: {len(checks)} checks passed; guest launch not tested")
    finally:
        password = None
        if process is not None and process.poll() is None:
            process.stdin.close()
            try:
                process.wait(timeout=10)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=10)


if __name__ == "__main__":
    main()

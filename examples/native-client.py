"""Persistent native transport example. Password input stays off argv and terminal echo."""
import json
import subprocess
import sys

binary, root = sys.argv[1:3]
with subprocess.Popen([binary, "--data-dir", root, "serve", "--stdio"], stdin=subprocess.PIPE,
                      stdout=subprocess.PIPE, text=True, encoding="utf-8") as host:
    sequence = 0
    def request(method, params=None):
        global sequence
        sequence += 1
        host.stdin.write(json.dumps({"id": str(sequence), "method": method, "params": params or {}}) + "\n")
        host.stdin.flush()
        reply = json.loads(host.stdout.readline())
        if "error" in reply:
            raise RuntimeError(reply["error"]["code"])
        return reply["result"]
    print(request("system.status"))
    # For unlock, use getpass.getpass(), then request("vault.unlock", {"password": value}).
    host.stdin.close()
    if host.wait(timeout=10) != 0:
        raise RuntimeError("Native host failed")

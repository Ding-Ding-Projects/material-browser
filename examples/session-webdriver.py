"""Use an already-running local daemon's session-confined WebDriver command.

The profile must have been explicitly configured for Selenium and launched. This
example never creates a driver session or supplies a browser directory.
"""
import json
import subprocess
import sys

binary, root, profile_id = sys.argv[1:4]
request = {"id": "webdriver-url", "method": "automation.webdriver",
           "params": {"id": profile_id, "verb": "GET", "path": "/url"}}
completed = subprocess.run([binary, "--data-dir", root, "call"],
                           input=json.dumps(request) + "\n", text=True,
                           encoding="utf-8", capture_output=True, check=True)
reply = json.loads(completed.stdout)
if "error" in reply:
    raise RuntimeError(reply["error"]["code"])
print(reply["result"]["value"])

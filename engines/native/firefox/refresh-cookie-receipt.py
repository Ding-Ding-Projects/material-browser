"""Generate the reviewed cookie patch receipt without changing native source."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


def patch_files(source, patch_text):
    sections = {}
    current = None
    for line in patch_text.splitlines(keepends=True):
        if line.startswith("--- a/"):
            current = line[6:].strip()
            if current in sections or not current.startswith("netwerk/") or ".." in Path(current).parts:
                raise ValueError("Unexpected or duplicate cookie patch path")
            sections[current] = []
        if current is not None:
            sections[current].append(line)
    if not sections:
        raise ValueError("Cookie patch has no files")
    results = {}
    for name, lines in sections.items():
        original = subprocess.check_output(["git", "-C", str(source), "show", f"HEAD:{name}"]).decode("utf-8")
        old_lines = original.splitlines(keepends=True)
        output = []
        cursor = 0
        index = 2
        if lines[1].strip() != f"+++ b/{name}":
            raise ValueError("Cookie patch destination mismatch")
        while index < len(lines):
            header = re.fullmatch(r"@@ -(\d+)(?:,\d+)? \+\d+(?:,\d+)? @@[^\n]*\n", lines[index])
            if not header:
                raise ValueError(f"Malformed patch hunk: {name}")
            start = int(header[1]) - 1
            if start < cursor:
                raise ValueError("Overlapping patch hunks")
            output.extend(old_lines[cursor:start])
            cursor = start
            index += 1
            while index < len(lines) and not lines[index].startswith("@@"):
                line = lines[index]
                if line[0] in " -":
                    if cursor >= len(old_lines) or old_lines[cursor] != line[1:]:
                        raise ValueError(f"Cookie patch source context mismatch: {name}")
                    cursor += 1
                if line[0] in " +":
                    output.append(line[1:])
                if line[0] not in " +-":
                    raise ValueError(f"Unsupported patch content: {name}")
                index += 1
        output.extend(old_lines[cursor:])
        results[name] = (original, "".join(output))
    return results


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--check", action="store_true")
    args = parser.parse_args()
    recipes = Path(__file__).resolve().parents[2] / "recipes"
    pin = json.loads((recipes / "native-pins.json").read_text(encoding="utf-8"))["firefox"]["revision"]
    actual = subprocess.check_output(["git", "-C", str(args.source), "rev-parse", "HEAD"], text=True).strip()
    if actual != pin:
        raise ValueError("Cookie patch requires its exact pinned source revision")
    patch_path = recipes / "firefox-158-cookie-pause.patch"
    patch_text = patch_path.read_text(encoding="utf-8")
    sha = lambda text: hashlib.sha256(text.encode("utf-8")).hexdigest()
    record = {
        "schemaVersion": 1,
        "revision": pin,
        "patch": patch_path.name,
        "patchSha256": sha(patch_text),
        "files": [{"path": path, "baselineSha256": sha(before), "patchedSha256": sha(after)}
                  for path, (before, after) in patch_files(args.source, patch_text).items()],
        "nativeCompiled": False,
        "liveSnapshotVerified": False,
    }
    serialized = json.dumps(record, indent=2) + "\n"
    destination = recipes / "firefox-cookie-pause.json"
    if args.check:
        if destination.read_text(encoding="utf-8") != serialized:
            raise ValueError("Cookie patch receipt is stale")
        print("PASS: cookie patch receipt matches pinned inputs")
    else:
        destination.write_text(serialized, encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()

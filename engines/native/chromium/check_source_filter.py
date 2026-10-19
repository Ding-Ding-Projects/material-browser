"""Offline admission of the optional test filter using the pinned DEPS evaluator."""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys

parser = argparse.ArgumentParser()
parser.add_argument('--source', type=Path, required=True)
parser.add_argument('--depot', type=Path, required=True)
args = parser.parse_args()
recipe = json.loads((Path(__file__).parents[2] / 'recipes/chromium-source-filter.json').read_text())
revision = subprocess.check_output(['git', '-C', str(args.source), 'rev-parse', 'HEAD'], text=True).strip()
if revision != recipe['revision']:
    raise ValueError('Chromium source revision mismatch')
depot_revision = subprocess.check_output(['git', '-C', str(args.depot), 'rev-parse', 'HEAD'], text=True).strip()
pins = json.loads((Path(__file__).parents[2] / 'recipes/native-pins.json').read_text())
if depot_revision != pins['depotTools']['revision']:
    raise ValueError('DEPS evaluator revision mismatch')
text = (args.source / 'DEPS').read_text()
if hashlib.sha256(text.encode()).hexdigest() != recipe['patchedSha256']:
    raise ValueError('Optional test source filter hash mismatch')
sys.path.insert(0, str(args.depot))
import gclient_eval

deps = gclient_eval.Parse(text, 'DEPS')['deps']
excluded = []
for name, entry in deps.items():
    if entry and any(package['package'] == recipe['excludedPackage']
                     for package in entry.get('packages', [])):
        if gclient_eval.EvaluateCondition(entry['condition'], {'checkout_win': True}):
            raise ValueError('Blocked optional package is still enabled')
        excluded.append(name)
if sorted(excluded) != sorted(recipe['excludedPaths']):
    raise ValueError('Optional package reference inventory differs')
print('PASS: pinned DEPS evaluator excludes every optional blocked-package reference before registration')

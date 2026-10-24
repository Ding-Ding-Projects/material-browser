/** Validate the alternative Linux capture contract without presenting it as a Windows receipt. */
import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import { hashFile } from './desktop-ui-probe.mjs';
const input = process.argv[2];
if (!input) throw Error('Usage: node scripts/desktop-ui-validate.mjs <receipt-directory>');
const names = (await fs.readdir(input)).filter(name => name.endsWith('.json'));
let count = 0;
for (const name of names) {
  const receipt = JSON.parse(await fs.readFile(path.join(input,name),'utf8'));
  if (receipt.kind !== 'linux-electron-dom-layout') continue;
  assert.equal(receipt.route,'electron-playwright-xvfb');
  assert.match(receipt.source.commit,/^[a-f0-9]{40}$/);
  assert.match(receipt.source.treeSha256,/^[a-f0-9]{64}$/);
  assert.equal(await hashFile(receipt.buildReceipt.path),receipt.buildReceipt.sha256);
  const build = JSON.parse(await fs.readFile(receipt.buildReceipt.path,'utf8'));
  assert.equal(build.source.treeSha256,receipt.source.treeSha256);
  assert.equal(build.artifact.sha256,receipt.artifact.sha256);
  assert.equal(await hashFile(receipt.screenshot.path),receipt.screenshot.sha256);
  const png = await fs.readFile(receipt.screenshot.path);
  assert.equal(png.subarray(1,4).toString(),'PNG');
  assert.ok(png.readUInt32BE(16)>0 && png.readUInt32BE(20)>0);
  assert.equal(receipt.processIdentity.platform,'linux');
  assert.ok(receipt.processIdentity.pid>0);
  assert.ok(receipt.processIdentity.windows.some(w=>w.url.startsWith('file:')&&w.contentBounds.width>0&&w.rendererPid>0));
  assert.equal(receipt.privacy.taskOwnedProfile,true);
  assert.equal(receipt.privacy.visibleDesktopUntouched,true);
  assert.ok(receipt.measurements.elements.length>0);
  for (const element of receipt.measurements.elements) {
    assert.ok(element.rect.width>0 && element.rect.height>0);
    assert.ok(element.matchedCount>element.chosenIndex);
    for (const field of ['display','position','boxSizing','width','height','overflowX','overflowY']) assert.equal(typeof element.computed[field],'string');
  }
  count++;
}
assert.ok(count>0,'No Linux Electron receipts found');
const run = JSON.parse(await fs.readFile(path.join(input,'run.json'),'utf8'));
assert.equal(run.sourceStable,true,'Source changed during capture');
assert.equal(run.artifactStable,true,'Built artifact changed during capture');
assert.equal(run.ownedProcessClosed,true,'Owned process teardown not recorded');
console.log(JSON.stringify({valid:true,receipts:count,scope:'File integrity and Linux DOM measurement structure; not layout acceptance, Windows, or audible sound proof.'}));

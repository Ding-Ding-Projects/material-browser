import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const expected = [
  '29337f1432ce34984214e9d0b02f489f53e96e55dc1035258fcb7e74413ec7a7',
  '2eec0e8861fd9dd90c0e8d6f354ec635c96d02543382f814ba8111249bff79fc',
  '34e65dc4e3deafe3d668d398a26c6a292730fe356a6a1f4303d5af3919a0e941',
  '02b4d89306066a2698c1e9f44463917fdbf17426c06789a52819d9f5f467cd64',
  'e44efd49524d8b9ba8cb4b627aeac4aa34524e11d9bf67a57becf0740bb58d88',
  '61d982d5f6183523de5b328ec77d0ac46dbd4b72a7359530e61e14669b4334c9',
];
const sources = new Map();
for (const pkg of ['@fontsource-variable/noto-sans-hk', '@fontsource/roboto']) {
  const directory = path.join(root, 'apps/desktop/node_modules', pkg, 'files');
  for (const name of fs.readdirSync(directory).filter(name => /\.woff2?$/.test(name))) {
    const bytes = fs.readFileSync(path.join(directory, name));
    const digest = createHash('sha256').update(bytes).digest('hex');
    if (expected.includes(digest)) sources.set(digest, { bytes, extension: path.extname(name) });
  }
}
assert.equal(sources.size, 6, 'The reviewed font source fixtures must be installed');
const fonts = expected.map(digest => sources.get(digest));
const meta = '<meta http-equiv="Content-Security-Policy" content="font-src \'self\'">';
const html = head => `<!doctype html><html><head>${head}</head><body></body></html>`;
const rules = fonts.map((font, index) => `@font-face{font-family:fixture${index};src:url("./font-${index}${font.extension}")}`);
function fixture(t, { head = meta, css = rules.join(''), missing = -1, changed = -1 } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'desktop-font-check-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, 'index.html'), html(head));
  fs.writeFileSync(path.join(directory, 'style.css'), css);
  fonts.forEach((font, index) => {
    if (index !== missing) fs.writeFileSync(path.join(directory, `font-${index}${font.extension}`), index === changed ? Buffer.concat([font.bytes, Buffer.from([1])]) : font.bytes);
  });
  return directory;
}
function run(directory) {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/check-desktop-font-assets.mjs'), '--dist', directory], { encoding: 'utf8' });
  return { status: result.status, output: (result.stdout + result.stderr).trim() };
}
test('reviewed local font references pass under an active self-only policy', t => {
  const result = run(fixture(t));
  assert.equal(result.status, 0, result.output);
  assert.equal(JSON.parse(result.output).requiredFonts, 6);
});
for (const [name, head] of [['script raw text', `<script type="application/json">${meta}</script>`], ['template', `<template>${meta}</template>`], ['comment', `<!--${meta}-->`]]) {
  test(`a policy inside ${name} cannot satisfy active metadata`, t => {
    const result = run(fixture(t, { head }));
    assert.equal(result.status, 1);
    assert.match(result.output, /expected self-only font policy changed/);
  });
}
test('uppercase CSS cannot hide an external font reference', t => {
  const result = run(fixture(t, { css: rules.join('') + '@FONT-FACE{font-family:external;SRC:URL("https://example.invalid/font.woff2")}' }));
  assert.equal(result.status, 1);
  assert.match(result.output, /URL is incompatible/);
});
test('changed font bytes fail and restored original bytes pass', t => {
  const directory = fixture(t, { changed: 0 });
  const result = run(directory);
  assert.equal(result.status, 1);
  assert.match(result.output, /bytes do not match/);
  fs.writeFileSync(path.join(directory, `font-0${fonts[0].extension}`), fonts[0].bytes);
  const restored = run(directory);
  assert.equal(restored.status, 0, restored.output);
});
test('missing referenced font output fails', t => {
  const result = run(fixture(t, { missing: 0 }));
  assert.equal(result.status, 1);
  assert.match(result.output, /ENOENT/);
});
for (let index = 0; index < fonts.length; index++) {
  test(`omitting reviewed font ${index + 1} fails rather than hiding the original defect`, t => {
    const result = run(fixture(t, { css: rules.filter((_, i) => i !== index).join('') }));
    assert.equal(result.status, 1);
    assert.match(result.output, /required font inventory is absent or changed/);
  });
}

'use strict';
const path = require('node:path');
const fs = require('node:fs');
const ORIGIN = 'handbook://local';
const HOME = ORIGIN + '/index.html';
const PROFILE_MARKER = 'Material Browser Handbook verification\n';
function assetForUrl(value, files) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'handbook:' || url.hostname !== 'local' || url.port || url.username || url.password || url.search) return null;
    const name = decodeURIComponent(url.pathname).slice(1);
    if (!name || name.includes('\\') || name.split('/').some(part => part === '.' || part === '..') || name.includes('\0')) return null;
    return files.has(name) ? name : null;
  } catch { return null; }
}
function allowsDocument(value) {
  try { const url = new URL(value); return url.protocol === 'handbook:' && url.hostname === 'local' && !url.port && !url.username && !url.password && !url.search && url.pathname === '/index.html'; }
  catch { return false; }
}
function verificationDirectory(input, home, normalData) {
  if (typeof input !== 'string' || !path.isAbsolute(input) || /[\0\r\n]/.test(input)) throw Error('Verification data requires an absolute directory.');
  const resolved = path.resolve(input);
  const reserved = [path.parse(resolved).root, path.resolve(home), path.resolve(normalData)];
  if (reserved.some(p => p.toLowerCase() === resolved.toLowerCase())) throw Error('Verification data cannot use a root, home, or normal profile directory.');
  // Never follow a junction into an unrelated directory, including at an ancestor.
  let cursor = resolved;
  while (true) {
    if (fs.existsSync(cursor) && fs.lstatSync(cursor).isSymbolicLink()) throw Error('Verification data cannot use linked directories.');
    const parent = path.dirname(cursor); if (parent === cursor) break; cursor = parent;
  }
  const marker = path.join(resolved, '.handbook-verification-profile');
  if (fs.existsSync(resolved)) {
    if (!fs.statSync(resolved).isDirectory()) throw Error('Verification data is not a directory.');
    if (fs.readdirSync(resolved).length && (!fs.existsSync(marker) || fs.lstatSync(marker).isSymbolicLink() || !fs.statSync(marker).isFile() || fs.statSync(marker).size !== Buffer.byteLength(PROFILE_MARKER) || fs.readFileSync(marker, 'utf8') !== PROFILE_MARKER)) throw Error('Verification data directory is not owned by this companion.');
  }
  fs.mkdirSync(resolved, { recursive: true });
  fs.writeFileSync(marker, PROFILE_MARKER, { flag: 'w' });
  return resolved;
}
module.exports = { ORIGIN, HOME, assetForUrl, allowsDocument, verificationDirectory };

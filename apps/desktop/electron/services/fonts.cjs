'use strict';
const { execFile } = require('node:child_process');
const path = require('node:path');
const SCRIPT = ` $ErrorActionPreference='Stop'; [Console]::OutputEncoding=[System.Text.UTF8Encoding]::new($false); Add-Type -AssemblyName System.Drawing; $c=New-Object System.Drawing.Text.InstalledFontCollection; try { $r=@(foreach($f in $c.Families) { foreach($s in @('Regular','Bold','Italic','BoldItalic')) { if($f.IsStyleAvailable(([System.Drawing.FontStyle]$(if($s -eq 'BoldItalic'){3}else{[System.Enum]::Parse([System.Drawing.FontStyle],$s)})))) { [pscustomobject]@{family=$f.Name;style=$s} } } }); ConvertTo-Json -Compress -InputObject $r } finally { $c.Dispose() }`;
const fail = (code, message) => ({ ok: false, error: { code, message } });
async function listInstalledFonts(options = {}) {
  const { platform = process.platform, timeoutMs = 10000, execute = execFile } = options;
  if (!Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30000 || typeof execute !== 'function') return fail('INVALID_OPTIONS', 'Invalid font enumeration options.');
  if (platform !== 'win32') return fail('UNAVAILABLE', 'Installed font enumeration requires Windows.');
  const executable = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
  return new Promise(resolve => execute(executable, ['-NoLogo', '-NoProfile', '-NonInteractive', '-Command', SCRIPT], { windowsHide: true, timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8', shell: false }, (error, stdout) => {
    if (error) return resolve(fail(error.killed || error.code === 'ETIMEDOUT' ? 'TIMEOUT' : 'UNAVAILABLE', 'Installed fonts could not be enumerated.'));
    try {
      const rows = JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
      if (!Array.isArray(rows) || rows.length > 20000) throw new Error();
      const found = new Map();
      for (const row of rows) {
        if (typeof row.family !== 'string' || !row.family.trim() || row.family.length > 256 || /[\x00-\x1f]/.test(row.family) || !['Regular', 'Bold', 'Italic', 'BoldItalic'].includes(row.style)) throw new Error();
        const id = JSON.stringify([row.family, row.style]);
        found.set(id, { id, family: row.family, style: row.style });
      }
      const fonts = [...found.values()].sort((a,b) => a.family.localeCompare(b.family) || a.style.localeCompare(b.style));
      resolve(fonts.length ? { ok: true, fonts, source: 'windows-gdi' } : fail('UNAVAILABLE', 'No installed font families were returned.'));
    } catch { resolve(fail('INVALID_RESPONSE', 'The font provider returned an invalid response.')); }
  }));
}
module.exports = { listInstalledFonts };

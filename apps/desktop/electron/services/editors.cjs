'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn } = require('node:child_process');
const fail = (code, message) => ({ ok: false, error: { code, message } });
const safePath = value => typeof value === 'string' && value.length < 32768 && path.isAbsolute(value) && !/[\x00-\x1f]/.test(value) && !value.startsWith('\\\\');
function knownEditors(env = process.env) {
  const entries = [];
  const add = (id, name, root, suffix) => { if(root) entries.push({id, name, executable:path.join(root, suffix)}); };
  add('notepad', 'Notepad', env.SystemRoot, 'System32/notepad.exe');
  add('vscode-user', 'Visual Studio Code', env.LOCALAPPDATA, 'Programs/Microsoft VS Code/Code.exe');
  add('vscode-system', 'Visual Studio Code', env.ProgramFiles, 'Microsoft VS Code/Code.exe');
  add('notepad-plus-plus', 'Notepad++', env.ProgramFiles, 'Notepad++/notepad++.exe');
  return entries;
}
async function discoverEditors(options = {}) {
  const { platform = process.platform, selectedEditor, io = fs, env = process.env } = options;
  if (platform !== 'win32') return fail('UNAVAILABLE', 'Editor discovery requires Windows.');
  const candidates = knownEditors(env);
  if (selectedEditor !== undefined) {
    if (!safePath(selectedEditor) || path.extname(selectedEditor).toLowerCase() !== '.exe') return fail('INVALID_EDITOR', 'Select a local editor executable.');
    candidates.push({id:'selected', name:'Selected editor', executable:selectedEditor});
  }
  const editors = [];
  for (const candidate of candidates) {
    try {
      if (!safePath(candidate.executable)) continue;
      const executable = await io.realpath(candidate.executable);
      if (!safePath(executable) || path.extname(executable).toLowerCase() !== '.exe' || !(await io.stat(executable)).isFile()) continue;
      if (!editors.some(item => item.executable.toLowerCase() === executable.toLowerCase())) editors.push({...candidate, executable});
    } catch { /* An absent optional editor is not an error. */ }
  }
  return {ok:true, editors};
}
async function openInEditor(request, options = {}) {
  const { trustedRequest, approvedFiles, exportRoot, timeoutMs = 5000, io = fs, launch = spawn } = options;
  if (trustedRequest !== true || !request || Object.keys(request).some(k => !['editorId','fileId'].includes(k)) || typeof request.editorId !== 'string' || typeof request.fileId !== 'string' || request.fileId.length > 128 || request.editorId.length > 128) return fail('INVALID_REQUEST', 'An explicit approved editor request is required.');
  if (!Array.isArray(approvedFiles) || approvedFiles.length > 100 || !safePath(exportRoot) || !Number.isInteger(timeoutMs) || timeoutMs < 50 || timeoutMs > 30000 || typeof launch !== 'function') return fail('INVALID_OPTIONS', 'Invalid editor service options.');
  const approved = approvedFiles.find(file => file.id === request.fileId && file.nonSecret === true && file.applicationOwned === true);
  if (!approved || !safePath(approved.path) || !['.json','.txt','.md'].includes(path.extname(approved.path).toLowerCase())) return fail('INVALID_FILE', 'Only an approved non-secret exported document can be opened.');
  const discovered = await discoverEditors(options);
  if (!discovered.ok) return discovered;
  const editor = discovered.editors.find(item => item.id === request.editorId);
  if (!editor) return fail('INVALID_EDITOR', 'The selected editor is unavailable.');
  let file;
  try {
    const root = await io.realpath(exportRoot);
    file = await io.realpath(approved.path);
    const relative = path.relative(root, file);
    const stat = await io.stat(file);
    if (!relative || relative.startsWith('..') || path.isAbsolute(relative) || !stat.isFile() || stat.size > 1024 * 1024 || !safePath(file)) return fail('INVALID_FILE', 'The document is outside the approved export area or exceeds its limit.');
  } catch { return fail('INVALID_FILE', 'The exported document is unavailable.'); }
  return new Promise(resolve => {
    let settled = false;
    let child;
    const finish = result => { if (!settled) { settled = true; clearTimeout(timer); resolve(result); } };
    const timer = setTimeout(() => { child?.kill(); finish(fail('TIMEOUT', 'The editor did not start within the time limit.')); }, timeoutMs);
    try {
      child = launch(editor.executable, [file], {shell:false, windowsHide:false, detached:false, stdio:'ignore'});
      child.once('error', () => finish(fail('LAUNCH_FAILED', 'The selected editor could not be started.')));
      child.once('spawn', () => { child.unref(); finish({ok:true, editorId:editor.id, fileId:request.fileId, state:'launched'}); });
    } catch { finish(fail('LAUNCH_FAILED', 'The selected editor could not be started.')); }
  });
}
module.exports = { discoverEditors, openInEditor };

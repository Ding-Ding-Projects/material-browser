// One native process retains the vault's unlocked state. No secrets belong in argv.
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
const [binary, root] = process.argv.slice(2);
if (!binary || !root) throw new Error('Usage: node native-client.mjs <binary> <absolute-data-dir>');
const child = spawn(binary, ['--data-dir', root, 'serve', '--stdio'], { stdio: ['pipe', 'pipe', 'inherit'] });
const pending = new Map(); let next = 0;
createInterface({ input: child.stdout }).on('line', line => {
  const reply = JSON.parse(line); const callback = pending.get(reply.id);
  if (callback) { pending.delete(reply.id); reply.error ? callback.reject(new Error(reply.error.code)) : callback.resolve(reply.result); }
});
child.on('exit', () => { for (const callback of pending.values()) callback.reject(new Error('Native host exited')); pending.clear(); });
export function request(method, params = {}) {
  const id = String(++next);
  return new Promise((resolve, reject) => { pending.set(id, { resolve, reject }); child.stdin.write(JSON.stringify({ id, method, params }) + '\n'); });
}
try { console.log(await request('system.status')); } finally { child.stdin.end(); }

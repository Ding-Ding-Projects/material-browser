import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import { parseVocabulary } from '../vocabulary.mjs';

const source = await readFile(new URL('./App.tsx', import.meta.url), 'utf8');
const tree = ts.createSourceFile('App.tsx', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const printer = ts.createPrinter();
let importer;
const lifecycleEffects = [];
function hasIdentifier(node, name) {
  if (ts.isIdentifier(node) && node.text === name) return true;
  return ts.forEachChild(node, child => hasIdentifier(child, name)) || false;
}
function visit(node) {
  if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'importWording') importer = node.initializer;
  if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && node.expression.text === 'useEffect' && node.arguments[0] && hasIdentifier(node.arguments[0], 'celebrationTimer')) lifecycleEffects.push(node.arguments[0]);
  ts.forEachChild(node, visit);
}
visit(tree);
assert.ok(importer, 'production import handler exists');
function executable(node, context) {
  const text = printer.printNode(ts.EmitHint.Expression, node, tree);
  const js = ts.transpileModule(`const run = ${text};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return new Function(...Object.keys(context), `${js}; return run;`)(...Object.values(context));
}
function fixture() {
  let now = 0, next = 0, celebration = '', storageBlocked = false, writes = 0;
  const timers = new Map();
  const context = {
    celebrationTimer: { current: null }, celebrationMounted: { current: true }, parseVocabulary,
    localStorage: { setItem() { if (storageBlocked) throw new Error('unavailable'); writes++; } },
    setEntries() {}, setNotice() {}, settings: { notify() {} }, t: text => text,
    setCelebration: value => { celebration = value; },
    setTimeout: (fn, delay) => { const id = ++next; timers.set(id, { fn, at: now + delay }); return id; },
    clearTimeout: id => timers.delete(id),
  };
  const cleanups = lifecycleEffects.map(node => executable(node, context)()).filter(Boolean);
  return {
    importWording: executable(importer, context),
    advance(to) { for (;;) { const due = [...timers].filter(([, timer]) => timer.at <= to).sort((a,b) => a[1].at-b[1].at)[0]; if (!due) break; now = due[1].at; timers.delete(due[0]); due[1].fn(); } now = to; },
    unmount() { assert.equal(cleanups.length, 1, 'one production timer cleanup is registered'); cleanups.forEach(fn => fn()); },
    blockStorage() { storageBlocked = true; },
    get value() { return celebration; }, get pending() { return timers.size; }, get writes() { return writes; },
  };
}
const file = () => ({ name: 'wording.json', size: 70, text: async () => JSON.stringify({ schemaVersion: 1, entries: { Example: 'Sample' } }) });

test('the latest successful import receives a complete three-second celebration', async () => {
  const f = fixture(); await f.importWording(file()); f.advance(2000); await f.importWording(file());
  f.advance(3000); assert.equal(f.value, 'Personal wording applied');
  f.advance(4999); assert.equal(f.value, 'Personal wording applied');
  f.advance(5000); assert.equal(f.value, ''); assert.equal(f.pending, 0);
});
test('invalid input and failed persistence do not replace the successful timer', async () => {
  const f = fixture(); await f.importWording(file()); f.advance(2000);
  await f.importWording({ ...file(), name: 'invalid.txt' }); f.blockStorage(); await f.importWording(file());
  assert.equal(f.writes, 1); f.advance(2999); assert.equal(f.value, 'Personal wording applied');
  f.advance(3000); assert.equal(f.value, '');
});
test('unmount disposes the timer and a late file read cannot schedule another', async () => {
  const f = fixture(); await f.importWording(file());
  let resolve; const waiting = f.importWording({ ...file(), text: () => new Promise(r => { resolve = r; }) });
  f.unmount(); assert.equal(f.pending, 0);
  resolve(await file().text()); await waiting; assert.equal(f.pending, 0);
});

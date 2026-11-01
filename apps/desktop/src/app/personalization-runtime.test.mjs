import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as appearanceModel from './appearance-elements-model.mjs';
import * as colours from './colour.mjs';

async function loadTs(file, dependencies, globals = {}) {
  const source = await readFile(new URL(file, import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const module = { exports: {} };
  const factory = new Function('require', 'module', 'exports', ...Object.keys(globals), output);
  factory(name => { if (!(name in dependencies)) throw new Error(`Unexpected import: ${name}`); return dependencies[name]; }, module, module.exports, ...Object.values(globals));
  return module.exports;
}

test('the shell context-menu mount restores saved appearance before opening an editor', async () => {
  const effects = [];
  const styles = new Map();
  const document = {
    getElementById: id => styles.get(id),
    createElement: () => ({ id: '', textContent: '' }),
    head: { appendChild: node => styles.set(node.id, node) },
    addEventListener() {}, removeEventListener() {},
  };
  const react = {
    createElement: (...args) => args, Fragment: 'fragment', useContext: () => null,
    useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}],
    useEffect: fn => effects.push(fn), useMemo: fn => fn(),
  };
  const appearance = await loadTs('./appearance-elements.ts', {
    react, './appearance-elements-model.mjs': appearanceModel,
  }, { document, localStorage: { getItem: () => JSON.stringify({ 'primary-buttons': { background: '#123456' } }) } });
  const surface = await loadTs('./Personalize.tsx', {
    react, '../m3': {}, './context': { AppContext: {} }, './focus-modes': {},
    './colour.mjs': colours, './appearance-elements-model.mjs': appearanceModel,
    './appearance-elements': appearance, './personalize-controls': {},
  }, { document });
  surface.AppearanceContextMenu();
  assert.equal(styles.size, 0);
  for (const effect of effects) effect();
  assert.match(styles.get('appearance-elements').textContent, /\.m3 \.btn\.filled.*#123456/);
});

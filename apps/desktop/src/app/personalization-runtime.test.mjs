import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';
import * as appearanceModel from './appearance-elements-model.mjs';
import * as colours from './colour.mjs';
import * as focusModel from './focus-modes-model.mjs';

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

test('the hue control keeps right-edge accessibility values within its declared bounds', async () => {
  const react = {
    createElement: (type, props, ...children) => ({ type, props, children }),
    useContext: () => null, useEffect() {}, useRef: () => ({ current: null }),
    useState: initial => { const value = typeof initial === 'function' ? initial() : initial; return [value && typeof value === 'object' && 'h' in value ? { h: 359.9, s: 100, v: 100 } : value, () => {}]; },
  };
  const controls = await loadTs('./personalize-controls.tsx', { react, '../m3': {}, './context': { AppContext: {} }, './colour.mjs': colours });
  const tree = controls.ColourPicker({ value: '#FF0000', label: 'Colour', onChange() {} });
  function find(node) { if (!node || typeof node !== 'object') return null; if (node.props?.className === 'pz-hue') return node; return node.children?.flat(Infinity).map(find).find(Boolean); }
  const hue = find(tree);
  assert.ok(hue);
  assert.ok(hue.props['aria-valuenow'] >= hue.props['aria-valuemin']);
  assert.ok(hue.props['aria-valuenow'] <= hue.props['aria-valuemax']);
  assert.equal(hue.props['aria-valuetext'], `${hue.props['aria-valuenow']}°`);
});

test('translucent colour contrast is composited only against a known solid backdrop', () => {
  assert.equal(colours.parseCssRgb('rgba(0, 0, 0, 0.5)'), null);
  const result = colours.resolveCssBackground([
    { color: 'rgba(0, 0, 0, 0.5)', image: 'none' },
    { color: 'rgb(255, 255, 255)', image: 'none' },
  ]);
  assert.equal(colours.formatHex(result), '#808080');
  assert.equal(colours.contrastCheck(colours.formatHex(result), '#FFFFFF').passes, false);
  assert.equal(colours.resolveCssBackground([{ color: 'rgba(0, 0, 0, 0)', image: 'none' }]), null);
  assert.equal(colours.resolveCssBackground([{ color: 'rgb(0, 0, 0)', image: 'linear-gradient(red, blue)' }]), null);
});

test('explicit colour overrides do not claim contrast through unsupported rendered effects', async () => {
  const react = { createElement: (type, props, ...children) => ({ type, props, children }), Fragment: 'fragment', useEffect() {}, useState: initial => [typeof initial === 'function' ? initial() : initial, () => {}] };
  const target = { parentElement: null };
  for (const effect of [{ opacity: '0.5' }, { backdropFilter: 'blur(4px)' }]) {
    const surface = await loadTs('./Personalize.tsx', {
      react, '../m3': {}, './context': {}, './focus-modes': {}, './colour.mjs': colours,
      './appearance-elements-model.mjs': appearanceModel,
      './appearance-elements': { useAppearancePersistence: () => 'saved', useAppearanceOverrides: () => ({ 'primary-buttons': { background: '#000000', foreground: '#FFFFFF' } }), listElements: () => [], elementLabel: () => 'Buttons', firstElement: () => target },
      './personalize-controls': { useT: () => text => text },
    }, { getComputedStyle: () => ({ opacity: '1', filter: 'none', mixBlendMode: 'normal', backdropFilter: 'none', backgroundImage: 'none', backgroundColor: 'rgb(0, 0, 0)', color: 'rgb(255, 255, 255)', ...effect }) });
    const tree = surface.AppearanceEditor({});
    const text = JSON.stringify(tree);
    assert.match(text, /Contrast unavailable/);
    assert.doesNotMatch(text, /21\.0:1/);
  }
});

test('appearance save and reset failures stay session-only until a successful retry', async () => {
  let blocked = true;
  let stored = JSON.stringify({ panes: { radius: 8 } });
  const styles = new Map();
  const store = {
    getItem: () => stored,
    setItem: (_key, value) => { if (blocked) throw new Error('quota'); stored = value; },
    removeItem: () => { if (blocked) throw new Error('unavailable'); stored = null; },
  };
  const appearance = await loadTs('./appearance-elements.ts', { react: {}, './appearance-elements-model.mjs': appearanceModel }, {
    localStorage: store, document: { getElementById: id => styles.get(id), createElement: () => ({ id: '', textContent: '' }), head: { appendChild: node => styles.set(node.id, node) } },
  });
  appearance.setOverride('panes', { radius: 12 });
  assert.equal(appearance.getAppearancePersistence(), 'session-only');
  assert.equal(JSON.parse(stored).panes.radius, 8);
  assert.equal(appearance.getOverride('panes').radius, 12);
  blocked = false; appearance.retryAppearancePersistence();
  assert.equal(appearance.getAppearancePersistence(), 'saved');
  assert.equal(JSON.parse(stored).panes.radius, 12);
  blocked = true; appearance.resetAllOverrides();
  assert.equal(appearance.getAppearancePersistence(), 'session-only');
  assert.ok(stored);
  blocked = false; appearance.retryAppearancePersistence();
  assert.equal(stored, null);
  assert.equal(appearance.getAppearancePersistence(), 'saved');
});

test('focus persistence exposes failure and retries the latest session settings', async () => {
  const slots = []; let cursor = 0, blocked = true, stored = null;
  const react = {
    createContext: () => ({ Provider: 'provider' }), createElement: (type, props) => ({ type, props }),
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
    useEffect() {}, useCallback: fn => fn, useMemo: fn => fn(),
  };
  const focus = await loadTs('./focus-modes.tsx', { react, '../m3': {}, './context': {}, './focus-modes-model.mjs': focusModel, './focus-modes.css': {} }, {
    localStorage: { getItem: () => stored, setItem: (_key, value) => { if (blocked) throw new Error('quota'); stored = value; } },
  });
  const render = () => { cursor = 0; return focus.FocusModesProvider({}).props.value; };
  render().setMode('calm', true);
  assert.equal(render().persisted, false);
  assert.equal(render().settings.calm, true);
  assert.equal(stored, null);
  blocked = false; render().retryPersistence();
  assert.equal(render().persisted, true);
  assert.equal(JSON.parse(stored).calm, true);
});

test('startup storage-read exceptions prevent overwriting earlier state after write access returns', async () => {
  let writes = 0, readBlocked = true;
  const original = JSON.stringify({ prior: 'durable record' });
  let durable = original;
  const storage = { getItem() { if (readBlocked) throw new Error('read unavailable'); return durable; }, setItem(_key, value) { writes++; durable = value; }, removeItem() { writes++; durable = null; } };
  const styles = new Map();
  const appearance = await loadTs('./appearance-elements.ts', { react: {}, './appearance-elements-model.mjs': appearanceModel }, {
    localStorage: storage, document: { getElementById: id => styles.get(id), createElement: () => ({ id: '', textContent: '' }), head: { appendChild: node => styles.set(node.id, node) } },
  });
  appearance.setOverride('panes', { radius: 12 });
  assert.equal(appearance.getAppearancePersistence(), 'reload-required');
  readBlocked = false;
  appearance.retryAppearancePersistence();
  appearance.resetAllOverrides();
  assert.equal(writes, 0);
  assert.equal(durable, original);
  readBlocked = true;
  const slots = []; let cursor = 0;
  const react = {
    createContext: () => ({ Provider: 'provider' }), createElement: (type, props) => ({ type, props }),
    useState: initial => { const i = cursor++; if (!(i in slots)) slots[i] = typeof initial === 'function' ? initial() : initial; return [slots[i], next => { slots[i] = typeof next === 'function' ? next(slots[i]) : next; }]; },
    useRef: initial => { const i = cursor++; return slots[i] ?? (slots[i] = { current: initial }); },
    useEffect() {}, useCallback: fn => fn, useMemo: fn => fn(),
  };
  const focus = await loadTs('./focus-modes.tsx', { react, '../m3': {}, './context': {}, './focus-modes-model.mjs': focusModel, './focus-modes.css': {} }, { localStorage: storage });
  const render = () => { cursor = 0; return focus.FocusModesProvider({}).props.value; };
  render().setMode('calm', true);
  assert.equal(render().persisted, false);
  assert.equal(render().canRetryPersistence, false);
  readBlocked = false;
  render().retryPersistence();
  assert.equal(writes, 0);
  assert.equal(durable, original);
});

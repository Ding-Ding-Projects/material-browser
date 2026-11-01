import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

test('rail destinations own their scroll region while Lock remains outside it', async () => {
  const source = await readFile(new URL('./Shell.tsx', import.meta.url), 'utf8');
  const output = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  const react = { createElement: (type, props, ...children) => ({ type, props, children }), useState: value => [typeof value === 'function' ? value() : value, () => {}], useEffect() {}, useRef: value => ({ current: value }) };
  const destinations = [];
  const dependencies = {
    react, '../build-version': { APP_VERSION: 'test' }, '../api': {},
    '../m3': { cx: (...parts) => parts.filter(Boolean).join(' ') },
    './context': { useApp: () => ({ t: s => s, page: 'servers', navigate: id => destinations.push(id), status: { unlocked: true }, conflicts: [], busy: false }) },
    './focus-modes': {},
  };
  const module = { exports: {} };
  class Element { scrollIntoView(options) { this.options = options; } }
  new Function('require', 'module', 'exports', 'localStorage', 'HTMLElement', output)(name => { assert.ok(name in dependencies, name); return dependencies[name]; }, module, module.exports, { getItem: () => null }, Element);
  const tree = module.exports.Rail({ onFab() {}, fabIcon: 'dns', fabLabel: 'New server' });
  const children = tree.children.flat(Infinity);
  const scrolling = children.find(node => node?.props?.className === 'rail-destinations');
  assert.ok(scrolling);
  const buttons = scrolling.children.flat(Infinity).filter(node => node?.type === 'button');
  assert.equal(buttons.length, 8);
  buttons.forEach(button => button.props.onClick());
  assert.deepEqual(destinations, ['profiles','super-profiles','sync','servers','models','tools','personalize','settings']);
  const lock = children.find(node => node?.type === 'button' && node.props.className === 'ri rail-x');
  assert.ok(lock);
  assert.ok(!scrolling.children.flat(Infinity).includes(lock));
  const target = new Element(); scrolling.props.onFocusCapture({ target });
  assert.deepEqual(target.options, { block: 'nearest', inline: 'nearest' });
  const css = await readFile(new URL('../m3/app.css', import.meta.url), 'utf8');
  const rule = css.match(/\.m3 \.rail-destinations \{([^}]+)\}/)?.[1] || '';
  assert.match(rule, /min-height:\s*0/);
  assert.match(rule, /overflow-y:\s*auto/);
  assert.match(rule, /flex:\s*1 1 0/);
  assert.match(css, /\.m3 \.rail > \.rail-x \{[^}]*flex-shrink:\s*0/);
});

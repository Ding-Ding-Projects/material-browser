import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolvePresentationTheme, applyPresentationTheme } from './design-system/theme.mjs';
import { COLOR_SCHEMES } from './design-system/reference-colors.mjs';
import { defaults, validatePreferences } from './settings/model.mjs';
import { readPresentationRecord } from './settings/record.mjs';

const record = () => readPresentationRecord(null);
test('fresh dark uses every reference role; default accent does not override light', () => {
  const r = record();
  assert.equal(defaults.theme, 'dark');
  assert.equal(defaults.fontFamily, 'Roboto');
  assert.deepEqual(resolvePresentationTheme(r.preferences, r).roles, COLOR_SCHEMES.dark);
  assert.deepEqual(resolvePresentationTheme({ ...r.preferences, theme: 'light' }, r).roles, COLOR_SCHEMES.light);
});
test('explicit saved choices survive loading and system follows media changes', () => {
  for (const theme of ['light', 'dark', 'system', 'contrast']) {
    const r = record();
    r.preferences = validatePreferences({ ...r.preferences, theme, fontFamily: 'Custom Local Font', accent: '#6750a4' });
    r.writtenKeys = ['theme', 'fontFamily', 'accent'];
    const saved = readPresentationRecord(JSON.stringify(r));
    assert.equal(saved.preferences.theme, theme);
    assert.equal(saved.preferences.fontFamily, 'Custom Local Font');
    assert.equal(saved.preferences.accent, '#6750a4');
    const resolved = resolvePresentationTheme(saved.preferences, saved, true);
    assert.equal(resolved.name, theme === 'system' ? 'dark' : theme);
    assert.equal(resolved.roles.primary, theme === 'contrast' ? '#FFFFFF' : '#6750a4');
  }
  assert.equal(resolvePresentationTheme({ ...defaults, theme: 'system' }, record(), false).name, 'light');
});
test('high contrast defeats explicit and scheduled accents without mutating saved values', () => {
  const r = record();
  r.writtenKeys = ['accent'];
  r.preferences.accent = '#123456';
  const prefs = { ...r.preferences, accent: '#eeeeee', highContrast: true };
  assert.deepEqual(resolvePresentationTheme(prefs, r).roles, COLOR_SCHEMES.contrast);
  assert.equal(r.preferences.accent, '#123456');
  assert.equal(resolvePresentationTheme({ ...prefs, highContrast: false }, r).roles.primary, '#eeeeee');
});
test('scheduled accent applies without a saved accent and chooses readable filled-button text', () => {
  const r = record();
  assert.equal(resolvePresentationTheme({ ...r.preferences, accent: '#eeeeee' }, r).roles['on-primary'], '#000000');
  assert.equal(resolvePresentationTheme({ ...r.preferences, accent: '#111111' }, r).roles['on-primary'], '#FFFFFF');
});
test('theme transitions replace all roles rather than retaining a previous custom accent', () => {
  const values = new Map();
  const root = { dataset: {}, style: { setProperty: (key, value) => values.set(key, value) } };
  const r = record();
  r.writtenKeys = ['accent'];
  r.preferences.accent = '#6750a4';
  applyPresentationTheme(root, r.preferences, r, false);
  assert.equal(values.get('--md-sys-color-primary'), '#6750a4');
  applyPresentationTheme(root, { ...defaults, highContrast: true }, record(), false);
  for (const [key, value] of Object.entries(COLOR_SCHEMES.contrast)) assert.equal(values.get(`--md-sys-color-${key}`), value);
  applyPresentationTheme(root, { ...defaults, theme: 'light' }, record(), false);
  assert.equal(values.get('--md-sys-color-primary'), '#006A6A');
  assert.equal(root.style.colorScheme, 'light');
});
test('initial-paint CSS matches all dark roles before effects run', () => {
  const css = readFileSync(new URL('./design-system/material-browser.css', import.meta.url), 'utf8');
  for (const [key, value] of Object.entries(COLOR_SCHEMES.dark)) assert.ok(css.includes(`--md-sys-color-${key}: ${value};`), key);
});

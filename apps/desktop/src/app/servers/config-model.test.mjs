import test from 'node:test';
import assert from 'node:assert/strict';
import { propertyChange } from './config-model.mjs';
test('unavailable and unknown controls never become writable', () => {
  assert.ok(propertyChange({ available: false, control: 'text' }, 'value').error);
  assert.ok(propertyChange({ available: true, control: 'unknown' }, 'value').error);
});
test('numeric changes preserve empty and invalid input rather than silently coercing', () => {
  const d = { key: 'server-port', available: true, control: 'number', min: 1, max: 65535 };
  for (const v of ['', null, true, 0, 80, 1023, 65536, 'abc', 1024.5]) assert.ok(propertyChange(d, v).error);
  assert.deepEqual(propertyChange(d, '25565'), { value: 25565 });
});
test('booleans and enumerations preserve their actual types', () => {
  assert.deepEqual(propertyChange({ available: true, control: 'switch' }, false), { value: false });
  assert.ok(propertyChange({ available: true, control: 'switch' }, 'false').error);
  assert.ok(propertyChange({ available: true, control: 'choice', choices: ['easy'] }, 'hard').error);
});
test('text bounds, line breaks and descriptor patterns are checked', () => {
  const d = { available: true, control: 'text', maxLength: 3, pattern: '^[a-z]*$' };
  assert.deepEqual(propertyChange(d, ''), { value: '' });
  for (const v of ['abcd', 'a\nb', 'ABC']) assert.ok(propertyChange(d, v).error);
});

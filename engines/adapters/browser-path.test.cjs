'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { browserPath } = require('./launch.cjs');
test('extended local and UNC paths retain the same browser destination', () => {
  assert.equal(browserPath('\\\\?\\C:\\Synthetic profile\\chrome.exe', 'win32'), 'C:\\Synthetic profile\\chrome.exe');
  assert.equal(browserPath('\\\\?\\UNC\\server\\share\\profile', 'win32'), '\\\\server\\share\\profile');
});
test('ordinary, device, absent and non-Windows paths are unchanged', () => {
  for (const value of ['C:\\profile', '\\\\.\\pipe\\fixture', '/tmp/profile', undefined]) {
    assert.equal(browserPath(value, 'win32'), value);
  }
  const extended = '\\\\?\\C:\\profile';
  assert.equal(browserPath(extended, 'linux'), extended);
});

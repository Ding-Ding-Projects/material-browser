'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { puppeteerOptions } = require('./launch.cjs');
test('Chromium explicitly requests an ephemeral loopback debugging port', () => {
  const config = { engine: 'chromium', executable: 'synthetic-chrome.exe', profile: 'synthetic-profile' };
  const options = puppeteerOptions(config);
  assert.ok(options.args.includes('--remote-debugging-address=127.0.0.1'));
  assert.ok(options.args.includes('--remote-debugging-port=0'));
  assert.equal(options.executablePath, config.executable);
  assert.equal(options.userDataDir, config.profile);
  assert.equal(options.protocol, 'cdp');
  assert.equal(options.headless, false);
  assert.equal(options.args.some(arg => arg.includes('no-sandbox')), false);
});
test('Firefox uses its native BiDi protocol without Chromium debugging switches', () => {
  const options = puppeteerOptions({ engine: 'firefox', executable: 'synthetic-firefox.exe', profile: 'synthetic-profile' });
  assert.equal(options.browser, 'firefox');
  assert.equal(options.protocol, 'webDriverBiDi');
  assert.deepEqual(options.args, []);
});

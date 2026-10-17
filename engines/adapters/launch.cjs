'use strict';
// Native host supplies configuration through protected stdin, never page content.
const readline = require('node:readline');
const fs = require('node:fs');
const crypto = require('node:crypto');
const lines = readline.createInterface({input: process.stdin});
let browser, driver, started = false, closing = false;
const pins = { 'puppeteer-core': '25.14.0', 'selenium-webdriver': '4.51.0' };
async function close() {
  if (closing) return;
  closing = true;
  try { if (browser) await browser.close(); if (driver) await driver.quit(); }
  finally { process.exit(0); }
}
process.on('SIGTERM', close);
lines.on('close', close);
lines.on('line', async line => {
  if (started) { if (line === '{"command":"shutdown"}') await close(); return; }
  started = true;
  let timer = setTimeout(() => { process.stderr.write('Adapter startup timeout\n'); close(); }, 25000);
  try {
    if (line.length > 65536) throw Error('Configuration too large');
    const config = JSON.parse(line);
    if (!['chromium','firefox'].includes(config.engine) || !['selenium','puppeteer'].includes(config.mode)) throw Error('Invalid adapter');
    const pkg = config.mode === 'puppeteer' ? 'puppeteer-core' : 'selenium-webdriver';
    if (require(`${pkg}/package.json`).version !== pins[pkg]) throw Error('Adapter version mismatch');
    let version, pid;
    if (config.mode === 'puppeteer') {
      const puppeteer = require('puppeteer-core');
      browser = await puppeteer.launch({ browser: config.engine === 'firefox' ? 'firefox' : 'chrome',
        protocol: config.engine === 'firefox' ? 'webDriverBiDi' : 'cdp', executablePath: config.executable,
        userDataDir: config.profile, headless: false, pipe: config.engine === 'chromium',
        args: config.engine === 'chromium' ? ['--no-first-run','--no-default-browser-check'] : [], timeout: 20000 });
      version = (await browser.version()).replace(/^[^/]+\//, '');
      pid = browser.process()?.pid;
    } else {
      if (!config.driver || !config.driverSha256 || crypto.createHash('sha256').update(fs.readFileSync(config.driver)).digest('hex') !== config.driverSha256) throw Error('Driver hash mismatch');
      const {Builder} = require('selenium-webdriver');
      const adapter = require(`selenium-webdriver/${config.engine === 'firefox' ? 'firefox' : 'chrome'}`);
      const options = new adapter.Options();
      if (config.engine === 'chromium') options.setChromeBinaryPath(config.executable).addArguments(`--user-data-dir=${config.profile}`, '--no-first-run','--no-default-browser-check');
      else options.setBinary(config.executable).addArguments('-no-remote','-profile',config.profile);
      const service = new adapter.ServiceBuilder(config.driver);
      let builder = new Builder().forBrowser(config.engine === 'chromium' ? 'chrome' : 'firefox');
      builder = config.engine === 'chromium' ? builder.setChromeOptions(options).setChromeService(service) : builder.setFirefoxOptions(options).setFirefoxService(service);
      driver = await builder.build();
      const caps = await driver.getCapabilities();
      version = caps.get('browserVersion');
      pid = caps.get('goog:processID') || caps.get('moz:processID');
    }
    if (version !== config.version || !Number.isInteger(pid) || pid <= 0) throw Error('Browser version or process receipt mismatch');
    clearTimeout(timer);
    process.stdout.write(JSON.stringify({pid,version,mode:config.mode,engine:config.engine})+'\n');
  } catch (_) {
    clearTimeout(timer);
    process.stderr.write('Engine adapter initialization failed\n');
    try { if (browser) await browser.close(); if (driver) await driver.quit(); } finally { process.exit(1); }
  }
});


'use strict';
// Native host supplies configuration through protected stdin, never page content.
const readline = require('node:readline');
const fs = require('node:fs');
const crypto = require('node:crypto');
function puppeteerOptions(config) {
  return { browser: config.engine === 'firefox' ? 'firefox' : 'chrome',
    protocol: config.engine === 'firefox' ? 'webDriverBiDi' : 'cdp', executablePath: config.executable,
    userDataDir: config.profile, headless: false, pipe: false,
    args: config.engine === 'chromium' ? ['--no-first-run','--no-default-browser-check','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0'] : [], timeout: 20000 };
}
module.exports = { puppeteerOptions };
if (require.main === module) {
const lines = readline.createInterface({input: process.stdin});
let browser, driver, service, firefoxEndpoint, started = false, closing = false;
const pins = { 'puppeteer-core': '25.14.0', 'selenium-webdriver': '4.51.0' };
async function close() {
  if (closing) return;
  closing = true;
  let exit = 0;
  try {
    if (firefoxEndpoint) browser = await require('puppeteer-core').connect({browserWSEndpoint: firefoxEndpoint, protocol: 'webDriverBiDi', protocolTimeout: 10000});
    if (browser) await browser.close();
    if (driver) await driver.quit();
    if (service) await service.kill();
  } catch (_) { exit = 1; }
  finally { process.exit(exit); }
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
    let version, pid, endpoint;
    if (config.mode === 'puppeteer') {
      const puppeteer = require('puppeteer-core');
      browser = await puppeteer.launch(puppeteerOptions(config));
      version = (await browser.version()).replace(/^[^/]+\//, '');
      pid = browser.process()?.pid;
      endpoint = {mode:config.mode, protocol:config.engine === 'chromium' ? 'cdp' : 'bidi', url:browser.wsEndpoint(), sessionId:null};
      if (config.engine === 'firefox') {
        // Firefox permits only one BiDi session. Release the launch session so
        // the external client can connect, then reacquire it for graceful close.
        firefoxEndpoint = endpoint.url;
        await browser.disconnect();
        browser = null;
      }
    } else {
      if (!config.driver || !config.driverSha256 || crypto.createHash('sha256').update(fs.readFileSync(config.driver)).digest('hex') !== config.driverSha256) throw Error('Driver hash mismatch');
      const {Builder} = require('selenium-webdriver');
      const adapter = require(`selenium-webdriver/${config.engine === 'firefox' ? 'firefox' : 'chrome'}`);
      const options = new adapter.Options();
      if (config.engine === 'chromium') options.setChromeBinaryPath(config.executable).addArguments(`--user-data-dir=${config.profile}`, '--no-first-run','--no-default-browser-check');
      else options.setBinary(config.executable).addArguments('-no-remote','-profile',config.profile);
      const serviceBuilder = new adapter.ServiceBuilder(config.driver).setLoopback(true).setHostname('127.0.0.1');
      serviceBuilder.addArguments(config.engine === 'firefox' ? '--host=127.0.0.1' : '--allowed-ips=127.0.0.1');
      service = serviceBuilder.build();
      const serviceUrl = await service.start(20000);
      let builder = new Builder().forBrowser(config.engine === 'chromium' ? 'chrome' : 'firefox').usingServer(serviceUrl);
      builder = config.engine === 'chromium' ? builder.setChromeOptions(options) : builder.setFirefoxOptions(options);
      driver = await builder.build();
      const caps = await driver.getCapabilities();
      version = caps.get('browserVersion');
      pid = caps.get('goog:processID') || caps.get('moz:processID');
      endpoint = {mode:config.mode,protocol:'webdriver',url:serviceUrl,sessionId:(await driver.getSession()).getId()};
    }
    if (version !== config.version || !Number.isInteger(pid) || pid <= 0) throw Error('Browser version or process receipt mismatch');
    clearTimeout(timer);
    const url = new URL(endpoint.url);
    if (url.hostname !== '127.0.0.1' || !url.port || url.username || url.password) throw Error('Unsafe endpoint');
    process.stdout.write(JSON.stringify({pid,version,mode:config.mode,engine:config.engine,endpoint})+'\n');
  } catch (_) {
    clearTimeout(timer);
    process.stderr.write('Engine adapter initialization failed\n');
    try { if (browser) await browser.close(); if (driver) await driver.quit(); if (service) await service.kill(); } finally { process.exit(1); }
  }
});
}


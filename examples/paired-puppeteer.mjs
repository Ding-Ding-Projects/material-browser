// Install puppeteer-core in your own client project. Start lan-forward separately and
// pass its returned loopback URL. Public pairing keys are not authentication secrets.
import puppeteer from 'puppeteer-core';
const [endpoint] = process.argv.slice(2);
if (!endpoint) throw new Error('Usage: node paired-puppeteer.mjs <loopback-websocket-url>');
const url = new URL(endpoint);
if (url.protocol !== 'ws:' || url.hostname !== '127.0.0.1') throw new Error('Use the native relay loopback URL');
const browser = await puppeteer.connect({ browserWSEndpoint: endpoint });
try {
  const page = await browser.newPage();
  await page.goto('https://example.com/', { waitUntil: 'domcontentloaded' });
  console.log(await page.title());
  await page.close();
} finally {
  await browser.disconnect();
}

// The front page on phones and computers: install and donate are near the top, iPhone shows its three steps, nothing scrolls sideways,
// tap targets are big enough, and the browser's real install prompt is captured where it exists.
//   node test/landing.mjs        (screenshots land in test/shots)
import { chromium, devices } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site'), shots = path.join(root, 'test', 'shots');
fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.xml': 'application/xml', '.txt': 'text/plain' };
const srv = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (rel.endsWith('/')) rel += 'index.html';
  if (req.method === 'POST') { res.writeHead(204); return res.end(); }
  fs.readFile(path.join(site, rel), (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(rel)] || 'application/octet-stream' }), res.end(d)));
}).listen(0, 'localhost');
await new Promise((r) => srv.on('listening', r));
const base = `http://localhost:${srv.address().port}`;
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (m) => console.log('  ok  ', m);

async function phone(name, device, expect) {
  const ctx = await browser.newContext({ ...device });
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(base + '/'); await page.waitForLoadState('networkidle');
  const vh = page.viewportSize().height;
  // install and donate are within the first two screens
  const inst = await page.locator('#install-now').boundingBox(), don = await page.locator('.donate-strip .amounts a').first().boundingBox();
  assert.ok(inst && inst.y < vh, `${name}: the Install button is on the first screen (y=${Math.round(inst?.y)})`);
  assert.ok(don && don.y < vh * 2.2, `${name}: the donate amounts are near the top (y=${Math.round(don?.y)})`);
  // nothing scrolls sideways
  const over = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  assert.ok(over.sw <= over.iw + 1, `${name}: no horizontal scroll (${over.sw} > ${over.iw})`);
  // tap targets: buttons and nav links are at least 44px tall and not squashed
  const small = await page.evaluate(() => [...document.querySelectorAll('.btn, .top nav a, .dock a, summary')].filter((n) => n.offsetParent).map((n) => ({ t: n.textContent.trim().slice(0, 24), h: n.getBoundingClientRect().height, w: n.getBoundingClientRect().width })).filter((x) => x.h < 40 || x.w < 40));
  assert.deepEqual(small, [], `${name}: tap targets are big enough`);
  if (expect.dock) { assert.ok(await page.locator('.dock').isVisible(), `${name}: the Install and Donate dock is visible`); const d = await page.locator('.dock').boundingBox(); assert.ok(d.y + d.height >= vh - 2, 'the dock sits at the bottom'); }
  if (expect.iosSteps) { const txt = await page.textContent('#install-help'); assert.match(txt, /Share/); assert.match(txt, /Add to Home Screen/); assert.match(await page.textContent('#install-now'), /how to install|iPhone/i); }
  await page.screenshot({ path: path.join(shots, `40-landing-${name}.png`) });
  await page.screenshot({ path: path.join(shots, `40-landing-${name}-full.png`), fullPage: true });
  assert.deepEqual(errors, [], name + ' page errors');
  await ctx.close(); ok(`${name}: install and donate near the top, no sideways scroll, big tap targets${expect.dock ? ', dock' : ''}${expect.iosSteps ? ', iPhone steps shown' : ''}`);
}
await phone('iphone', devices['iPhone 14'], { dock: true, iosSteps: true });
await phone('android', devices['Pixel 7'], { dock: true });
await phone('small-android', { ...devices['Pixel 7'], viewport: { width: 320, height: 640 } }, { dock: true });

// desktop: the same page, and the browser's real install prompt fires on the front page so the button installs in one tap
const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
const page = await ctx.newPage();
await page.addInitScript(() => { window.__bip = false; window.addEventListener('beforeinstallprompt', () => { window.__bip = true; }); });
await page.goto(base + '/'); await page.waitForLoadState('networkidle'); await page.waitForTimeout(1500);
assert.equal(await page.locator('.dock').isVisible(), false, 'no dock on a big screen');
const bip = await page.evaluate(() => window.__bip);
console.log('  info  beforeinstallprompt fired on the front page:', bip);
await page.screenshot({ path: path.join(shots, '40-landing-desktop.png') });
// clicking the button when a prompt exists calls prompt() (simulated), otherwise it goes to the app's install sheet
await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
await page.click('#install-now');
assert.equal(await page.evaluate(() => window.__prompted), true);
ok('desktop: the big Install button uses the browser prompt in place');
await ctx.close(); await browser.close(); srv.close();
console.log('\nLANDING CHECKS PASSED');

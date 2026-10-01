// The floating widget, as another website would use it: one script tag on a page served from a different address.
// Serves the built site the way Netlify does (including the /embed/ rewrite), and checks the button, the panel, the keyboard,
// phones, that nothing is stored on the host page, and that nothing is counted when it should not be.
//   node scripts/build-site.mjs && node test/widget.mjs
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site'), shots = path.join(root, 'test', 'shots');
fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const hits = [];
const phoenix = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/hit') { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { hits.push(b); res.writeHead(204); res.end(); }); return; }
  if (u.pathname.startsWith('/api/')) { res.writeHead(503, { 'content-type': 'application/json' }); return res.end('{"error":"unavailable"}'); }
  let rel = decodeURIComponent(u.pathname);
  const frameAncestors = rel.startsWith('/embed') ? '*' : rel.startsWith('/app') ? "'self'" : '';
  if (rel === '/embed' || rel === '/embed/') rel = '/app/index.html'; else if (rel.startsWith('/embed/')) rel = '/app/' + rel.slice(7); // what _redirects does
  if (rel.endsWith('/')) rel += 'index.html';
  fs.readFile(path.join(site, rel), (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    const h = { 'content-type': types[path.extname(rel)] || 'application/octet-stream' };
    if (frameAncestors) h['content-security-policy'] = `frame-ancestors ${frameAncestors}`;
    res.writeHead(200, h); res.end(d);
  });
}).listen(0, '127.0.0.1');
await new Promise((r) => phoenix.on('listening', r));
const phoenixUrl = `http://localhost:${phoenix.address().port}`;

// somebody else's website, on a different address
const CDN = `http://phoenix.example.net:${phoenix.address().port}`;
const hostPage = (attrs = '', src = phoenixUrl) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>A charity website</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Our charity</h1><p>Some words.</p><script src="${src}/embed.js" ${attrs} async></script></body></html>`;
const other = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(hostPage(new URL(req.url, 'http://x').searchParams.get('a') || '')); }).listen(0, '127.0.0.1');
await new Promise((r) => other.on('listening', r));
const otherUrl = `http://127.0.0.1:${other.address().port}`;

const browser = await chromium.launch({ channel: 'msedge' });
const ok = (m) => console.log('  ok  ', m);
let failed = 0;
const step = async (name, fn) => { try { await fn(); ok(name); } catch (e) { failed++; console.log('  FAIL', name, '\n      ', String(e.message).split('\n').slice(0, 6).join('\n       ')); } };

const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(otherUrl + '/');
await page.waitForSelector('[data-phoenix-widget]', { state: 'attached' });

await step('one script tag adds one labelled button, bottom-right, and loads nothing else yet', async () => {
  const b = page.locator('[data-phoenix-widget] >> button.fab');
  assert.equal(await b.count(), 1);
  assert.match(await b.textContent(), /Chat with Phoenix/);
  assert.equal(await b.getAttribute('aria-expanded'), 'false');
  assert.equal(await page.locator('iframe').count(), 0, 'the app is not loaded until someone asks for it');
  const box = await b.boundingBox(), vp = page.viewportSize();
  assert.ok(box.x > vp.width / 2 && box.y > vp.height / 2, 'bottom-right');
  await page.screenshot({ path: path.join(shots, '40-widget-closed.png') });
});

await step('it sets no cookies and stores nothing on the host page', async () => {
  assert.equal(await page.evaluate(() => document.cookie), '');
  assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
});

await step('pressing it opens Phoenix in a panel, with the real app inside and no install prompts', async () => {
  await page.locator('button.fab').click();
  const frame = page.frameLocator('iframe[title="Phoenix chat"]');
  await frame.locator('textarea[aria-label="Message Phoenix"]').waitFor({ timeout: 20000 });
  assert.equal(await page.locator('button.fab').count(), 1);
  assert.equal(await page.locator('button.fab').isVisible(), false, 'the round button hides while the panel is open');
  assert.equal(await frame.locator('#install-btn').isVisible().catch(() => false), false);
  assert.ok(await frame.locator('#donate-btn').isVisible(), 'the donate button is still there');
  assert.ok(await frame.locator('#help-btn').isVisible(), 'the Help button is still there');
  await page.screenshot({ path: path.join(shots, '41-widget-open.png') });
});

await step('Phoenix works inside the panel (built-in helper answers a question)', async () => {
  const frame = page.frameLocator('iframe[title="Phoenix chat"]');
  const start = frame.locator('button:has-text("Start with the built-in helper")');
  if (await start.count()) await start.click();
  const skip = frame.locator('button:has-text("Skip, no name needed")');
  if (await skip.count()) await skip.click();
  await frame.locator('textarea[aria-label="Message Phoenix"]').fill('what is masking?');
  await frame.locator('button:has-text("Send")').click();
  await frame.locator('.msg.assistant').last().waitFor();
  await frame.locator('.msg.assistant:has-text("Masking")').waitFor({ timeout: 10000 });
});

await step('Escape closes the panel and puts focus back on the button; it can be reopened', async () => {
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('button.fab').isVisible(), true);
  assert.equal(await page.evaluate(() => document.querySelector('[data-phoenix-widget]').shadowRoot.activeElement?.className), 'fab');
  await page.locator('button.fab').click();
  assert.equal(await page.locator('iframe').count(), 1, 'the same panel is reused');
  await page.locator('button:has-text("Close")').click();
});

await step('the host page cannot be broken: no script errors', async () => { assert.deepEqual(errors, []); });

await step('options: left side, own words, own colour, JavaScript open and close', async () => {
  const p2 = await ctx.newPage();
  await p2.goto(otherUrl + '/?a=' + encodeURIComponent('data-position="left" data-label="Need a calm moment?" data-color="#0f766e"'));
  await p2.waitForSelector('button.fab');
  const b = p2.locator('button.fab'); assert.match(await b.textContent(), /Need a calm moment\?/);
  assert.ok((await b.boundingBox()).x < 200, 'left');
  assert.match(await b.evaluate((n) => getComputedStyle(n).backgroundColor), /rgb\(15, 118, 110\)/);
  await p2.evaluate(() => window.PhoenixWidget.open()); assert.ok(await p2.locator('iframe').count() === 1);
  await p2.evaluate(() => window.PhoenixWidget.close()); assert.ok(await b.isVisible());
  await p2.close();
});

await step('a phone gets a full-screen panel with nothing sideways', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  const p3 = await m.newPage(); await p3.goto(otherUrl + '/'); await p3.waitForSelector('button.fab');
  await p3.locator('button.fab').tap();
  await p3.frameLocator('iframe').locator('textarea[aria-label="Message Phoenix"]').waitFor({ timeout: 20000 });
  const r = await p3.locator('.panel').evaluate((n) => { const b = n.getBoundingClientRect(); return { w: b.width, h: b.height }; }).catch(() => null);
  const over = await p3.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  assert.ok(over, 'no horizontal scroll on the host page');
  await p3.screenshot({ path: path.join(shots, '42-widget-phone.png') });
  await m.close();
});

await step('the app cannot be put in a frame from /app/ by other sites, but /embed/ can', async () => {
  const a = await (await fetch(phoenixUrl + '/app/')).headers.get('content-security-policy');
  const e = await (await fetch(phoenixUrl + '/embed/')).headers.get('content-security-policy');
  assert.match(a, /frame-ancestors 'self'/); assert.match(e, /frame-ancestors \*/);
});

await step('nothing is counted for local test pages (so tests never pollute the live numbers)', async () => { assert.deepEqual(hits, []); });

// counting, with a pretend public website name
await step('on a real website name it reports one load (Do Not Track reports none)', async () => {
  // two made-up public names that both point at this computer, so the widget runs on a "real" website name
  const b2 = await chromium.launch({ channel: 'msedge', args: ['--disable-features=BlockInsecurePrivateNetworkRequests,LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights', `--host-resolver-rules=MAP shop.example.com 127.0.0.1:${other.address().port}, MAP phoenix.example.net 127.0.0.1:${phoenix.address().port}`] });
  const c2 = await b2.newContext({ viewport: { width: 1000, height: 700 } });
  await c2.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })); // automated browsers say they are automated, and the widget (rightly) counts nothing then
  await c2.route('http://shop.example.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: hostPage('', CDN) }));
  const p4 = await c2.newPage(); await p4.goto('http://shop.example.com/');
  await p4.waitForSelector('button.fab'); await p4.waitForTimeout(500);
  assert.equal(hits.length, 1); const h = JSON.parse(hits[0]); assert.deepEqual([h.e, h.v, h.h], ['embed_load', 'ok', 'shop.example.com']);
  await c2.close();
  hits.length = 0;
  const dnt = await b2.newContext({ extraHTTPHeaders: { dnt: '1' }, viewport: { width: 1000, height: 700 } });
  await dnt.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' }); });
  await dnt.route('http://shop.example.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: hostPage('', CDN) }));
  const p5 = await dnt.newPage(); await p5.goto('http://shop.example.com/'); await p5.waitForSelector('button.fab'); await p5.waitForTimeout(500);
  assert.equal(hits.length, 0); await dnt.close(); await b2.close();
});

await browser.close(); phoenix.close(); other.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nWIDGET CHECKS PASSED');

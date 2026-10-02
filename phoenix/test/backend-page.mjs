// The /backend/ install page: easy to find, says what to do on Windows and Android, marks the device you are on, copies a link for your
// phone, the browser agrees it can install the app from it, and it is kept out of search engines.
//   node scripts/build-site.mjs && node test/backend-page.mjs
import { chromium, devices } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), site = path.join(root, 'site'), shots = path.join(root, 'test', 'shots');
fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); if (u.pathname.startsWith('/api/')) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{}'); }
  let rel = decodeURIComponent(u.pathname); if (rel.endsWith('/')) rel += 'index.html';
  fs.readFile(path.join(site, rel), (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(rel)] || 'text/plain' }), res.end(d)));
}).listen(0, 'localhost');
await new Promise((r) => srv.on('listening', r));
const base = `http://localhost:${srv.address().port}`;
const browser = await chromium.launch({ channel: 'msedge' });
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { failed++; console.log('  FAIL', name, '\n      ', String(e.message).split('\n').slice(0, 7).join('\n       ')); } };

const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 Edg/140.0' });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base + '/backend/'); await page.waitForSelector('#install');

await step('the page explains the app, with one big Install button and steps for Windows and Android', async () => {
  assert.equal((await page.title()), 'Get the Phoenix backend app'); assert.match(await page.textContent('h1'), /Get the Phoenix backend app/);
  const t = await page.textContent('main'); assert.match(t, /Windows/); assert.match(t, /Android/); assert.match(t, /pause Phoenix AI/); assert.match(t, /authenticator code/);
  assert.equal(await page.locator('#install').isVisible(), true); assert.equal(await page.getAttribute('#open', 'href'), '/admin/');
  await page.screenshot({ path: path.join(shots, '81-backend-page.png'), fullPage: true });
});
await step('the device you are on is marked (Windows here), and not the other', async () => {
  assert.equal(await page.locator('#windows .badge').isVisible(), true); assert.equal(await page.locator('#android .badge').isVisible(), false);
});
await step('copying the link puts the page address on the clipboard, for sending to a phone', async () => {
  await page.click('#copy'); await page.waitForFunction(() => /Link copied/.test(document.getElementById('note').textContent));
  assert.equal(await page.evaluate(() => navigator.clipboard.readText()), base + '/backend/');
});
await step('the browser agrees the app can be installed from this page (manifest, icons, service worker)', async () => {
  const cdp = await ctx.newCDPSession(page); await cdp.send('Page.enable');
  const { errors: mErr, url } = await cdp.send('Page.getAppManifest'); assert.ok(url.endsWith('/admin/manifest.webmanifest')); assert.deepEqual(mErr.map((e) => e.message), []);
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration('/admin/')), null, { timeout: 15000 });
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  console.log('      (installability notes: ' + (installabilityErrors.map((e) => e.errorId).join(', ') || 'none') + ')');
  assert.ok(!installabilityErrors.some((e) => /manifest|icon|service|start-url|scope/.test(e.errorId) && !/in-incognito|not-from-secure-origin|not-in-scope/.test(e.errorId)), JSON.stringify(installabilityErrors));
});
await step('without the browser’s prompt, Install takes a computer to the backend’s own page (where the address-bar install works)', async () => {
  await page.click('#install'); await page.waitForURL(/\/admin\/\?install=1/, { timeout: 5000 });
  await page.waitForSelector('#install-admin:not([hidden]), #login:not([hidden])');
});
await step('on an Android phone: the Android card is marked, the page fits, and Install says what to tap', async () => {
  const a = await browser.newContext({ ...devices['Pixel 7'] }); const p = await a.newPage(); await p.goto(base + '/backend/'); await p.waitForSelector('#install');
  assert.equal(await p.locator('#android .badge').isVisible(), true); assert.equal(await p.locator('#windows .badge').isVisible(), false);
  assert.ok((await p.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1, 'fits the phone');
  await p.click('#install'); await p.waitForFunction(() => /Install app/.test(document.getElementById('note').textContent));
  await p.screenshot({ path: path.join(shots, '81-backend-page-phone.png'), fullPage: true }); await a.close();
});
await step('it is private: noindex on the page and in the headers, disallowed in robots.txt, and not in the sitemap', async () => {
  assert.match(fs.readFileSync(path.join(site, 'backend', 'index.html'), 'utf8'), /noindex, nofollow/);
  const h = fs.readFileSync(path.join(site, '_headers'), 'utf8'); assert.match(h, /\/backend\/\*[\s\S]*?X-Robots-Tag: noindex, nofollow/);
  assert.match(fs.readFileSync(path.join(site, 'robots.txt'), 'utf8'), /Disallow: \/backend\//); assert.ok(!/\/backend/.test(fs.readFileSync(path.join(site, 'sitemap.xml'), 'utf8')));
});
await step('no script errors', async () => { assert.deepEqual(errors, []); });
await browser.close(); srv.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nBACKEND PAGE CHECKS PASSED');

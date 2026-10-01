// The private backend as an installable app: valid manifest and icons, the page's own security rules allow them, the browser agrees it is
// installable, the service worker caches nothing, and the sign-in page fits a phone.
//   node scripts/build-site.mjs && node test/admin-pwa.mjs
import { chromium, devices } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };
// the real security header for /admin/*, taken from the built site so the test checks what is actually deployed
const headerBlock = fs.readFileSync(path.join(site, '_headers'), 'utf8').split(/\n(?=\S)/).find((b) => b.startsWith('/admin/*'));
const csp = /Content-Security-Policy: (.*)/.exec(headerBlock)[1];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); if (u.pathname.startsWith('/api/')) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"error":"signed_out"}'); }
  let rel = decodeURIComponent(u.pathname); if (rel.endsWith('/')) rel += 'index.html';
  fs.readFile(path.join(site, rel), (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(rel)] || 'text/plain', 'content-security-policy': csp }), res.end(d)));
}).listen(0, 'localhost');
await new Promise((r) => srv.on('listening', r));
const base = `http://localhost:${srv.address().port}`;
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (m) => console.log('  ok  ', m);
let failed = 0;
const step = async (name, fn) => { try { await fn(); ok(name); } catch (e) { failed++; console.log('  FAIL', name, '\n      ', String(e.message).split('\n').slice(0, 7).join('\n       ')); } };

const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (m.type() === 'error' && !/401|Failed to load resource/.test(m.text())) errors.push(m.text()); });
await page.goto(base + '/admin/'); await page.waitForSelector('#login:not([hidden])');

await step('the manifest names the app, keeps it inside /admin/, and every icon exists', async () => {
  const cdp = await ctx.newCDPSession(page); await cdp.send('Page.enable');
  const { url, errors: mErr, data } = await cdp.send('Page.getAppManifest');
  assert.ok(url.endsWith('/admin/manifest.webmanifest')); assert.deepEqual(mErr.map((e) => e.message), []);
  const m = JSON.parse(data);
  assert.equal(m.short_name, 'Phoenix Admin'); assert.equal(m.display, 'standalone'); assert.equal(m.scope, './'); assert.match(m.id, /\/admin\/$/);
  assert.ok(m.icons.some((i) => i.purpose === 'maskable') && m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any') && m.icons.some((i) => i.sizes === '192x192'));
  for (const i of m.icons) { const r = await ctx.request.get(new URL(i.src, base + '/admin/').href); assert.equal(r.status(), 200, i.src); assert.match(r.headers()['content-type'], /image\/png/); }
});
await step('the page’s own security rules allow the manifest and service worker (and nothing else new), and the browser says it can be installed', async () => {
  assert.match(csp, /manifest-src 'self'/); assert.match(csp, /worker-src 'self'/); assert.match(csp, /default-src 'none'/); assert.match(csp, /frame-ancestors 'none'/); assert.ok(!/unsafe-eval|script-src[^;]*unsafe-inline/.test(csp));
  const cdp = await ctx.newCDPSession(page);
  await page.waitForFunction(async () => !!(await navigator.serviceWorker.getRegistration('./')), null, { timeout: 15000 });
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
  const blockers = installabilityErrors.filter((e) => e.errorId !== 'in-incognito');
  assert.deepEqual(blockers.map((e) => e.errorId), [], JSON.stringify(blockers));
});
await step('the service worker caches nothing and answers nothing itself, so no data is ever kept on the phone', async () => {
  const sw = fs.readFileSync(path.join(site, 'admin', 'sw.js'), 'utf8');
  assert.ok(!/caches\.(open|put|add)|cache\.(put|add)|respondWith/.test(sw), 'never stores or serves a response');
  assert.equal(await page.evaluate(async () => (await caches.keys()).length), 0);
});
await step('there is an install button on the sign-in page, and an iPhone gets plain steps instead', async () => {
  assert.ok(await page.locator('#install-admin').isVisible()); assert.match(await page.textContent('#install-admin'), /Get the backend as an app/);
  const ios = await browser.newContext({ ...devices['iPhone 13'] }); const p = await ios.newPage(); await p.goto(base + '/admin/'); await p.waitForSelector('#install-admin:not([hidden])');
  assert.match(await p.textContent('#install-admin-help'), /Add to Home Screen/); assert.equal(await p.locator('#install-admin-btn').isVisible(), false); await ios.close();
});
await step('on a phone the sign-in page fits the screen, with tap-sized controls and nothing scrolling sideways', async () => {
  const m = await browser.newContext({ ...devices['Pixel 7'] }); const p = await m.newPage(); await p.goto(base + '/admin/'); await p.waitForSelector('#login:not([hidden])');
  const r = await p.evaluate(() => ({ over: document.documentElement.scrollWidth - innerWidth, small: [...document.querySelectorAll('button, input')].filter((n) => n.offsetParent && n.getBoundingClientRect().height < 40).map((n) => n.id || n.tagName) }));
  assert.ok(r.over <= 1, 'sideways scroll: ' + r.over); assert.deepEqual(r.small, []);
  await p.screenshot({ path: path.join(root, 'test', 'shots', '76-admin-phone.png') }); await m.close();
});
await step('no script errors', async () => { assert.deepEqual(errors, []); });

await browser.close(); srv.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nADMIN APP CHECKS PASSED');

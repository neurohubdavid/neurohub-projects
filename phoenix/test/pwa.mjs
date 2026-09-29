// PWA check in real Edge over http: valid manifest, installable, service worker precache, works fully offline,
// data survives a reload, update flow, and the first visit is not interrupted by a reload.
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'site');
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const srv = http.createServer((req, res) => {
  let rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (rel.endsWith('/')) rel += 'index.html';
  const f = path.join(root, rel);
  const extra = rel.endsWith('sw.js') ? { 'service-worker-allowed': '/app/' } : {};
  fs.readFile(f, (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-cache', ...extra }), res.end(d)));
}).listen(0, 'localhost');
await new Promise((r) => srv.on('listening', r));
const LIVE = process.env.PWA_URL; // e.g. https://phoenix-neuroaffirming-ai.netlify.app/app/  (skips the local-file update test)
const base = LIVE || `http://localhost:${srv.address().port}/app/`;   // localhost counts as a secure context, like https

const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
let navCount = 0; page.on('framenavigated', (f) => { if (f === page.mainFrame()) navCount++; });
const ok = (n) => console.log('  ok  ', n);

await page.goto(base);
await page.waitForSelector('.modal');
await page.click('button:has-text("Start with the built-in helper")');
await page.evaluate(() => navigator.serviceWorker.ready);
await page.waitForTimeout(1500);
const navsAfterFirstVisit = navCount;
ok('first visit is not interrupted by a service-worker reload (navigations: ' + navsAfterFirstVisit + ')');
assert.ok(navsAfterFirstVisit <= 2);

// manifest, as the browser sees it
const cdp = await ctx.newCDPSession(page);
await cdp.send('Page.enable');
const { url: manifestUrl, errors: mErrors, data } = await cdp.send('Page.getAppManifest');
assert.ok(manifestUrl.endsWith('manifest.webmanifest'), 'manifest is linked');
assert.deepEqual(mErrors.map((e) => e.message), [], 'manifest has no errors');
const m = JSON.parse(data);
assert.equal(m.display, 'standalone'); assert.equal(m.short_name, 'Phoenix');
assert.ok(m.icons.some((i) => i.purpose === 'maskable') && m.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any') && m.icons.some((i) => i.sizes === '192x192'));
assert.ok(m.shortcuts.length >= 3 && m.screenshots.length >= 4);
for (const asset of [...m.icons.map((i) => i.src), ...m.screenshots.map((s) => s.src), ...m.shortcuts.flatMap((s) => s.icons.map((i) => i.src))]) {
  const r = await ctx.request.get(new URL(asset, base).href); assert.equal(r.status(), 200, asset);
  assert.match(r.headers()['content-type'] || '', /image\/png/, asset);
}
ok('manifest valid: ' + m.icons.length + ' icons (incl. maskable), ' + m.screenshots.length + ' screenshots, ' + m.shortcuts.length + ' shortcuts, all reachable');

// installability, straight from the browser's own checks
const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors');
// "in-incognito" only means the test browser is a private window; it is not a problem with the app.
const blockers = installabilityErrors.filter((e) => e.errorId !== 'in-incognito');
assert.deepEqual(blockers.map((e) => e.errorId), [], 'installable: ' + JSON.stringify(blockers));
ok('browser reports the app is installable (no installability errors other than "private window")');

// service worker precached everything listed
const cacheInfo = await page.evaluate(async () => {
  const names = (await caches.keys()).filter((n) => n !== 'phoenix-config'); // that one holds the reminder settings for the service worker
  const c = await caches.open(names[0]); const keys = await c.keys();
  return { names, count: keys.length, hasSite: keys.some((k) => k.url.endsWith('data/site.json')), hasShell: keys.some((k) => k.url.endsWith('index.html')), hasFont: keys.some((k) => k.url.includes('opendyslexic')) };
});
assert.equal(cacheInfo.names.length, 1); assert.ok(cacheInfo.count >= 40 && cacheInfo.hasSite && cacheInfo.hasShell && cacheInfo.hasFont, JSON.stringify(cacheInfo));
ok('service worker precached ' + cacheInfo.count + ' files (' + cacheInfo.names[0] + ')');

// use it, then go offline
await page.fill('textarea[aria-label="Message Phoenix"]', 'what is masking?');
await page.click('button:has-text("Send")');
await page.waitForFunction(() => /Masking/.test(document.body.textContent));
await ctx.setOffline(true);
await page.reload();
await page.waitForSelector('.chat-list');
assert.ok((await page.locator('.msg').count()) >= 2, 'chat is still there offline');
await page.fill('textarea[aria-label="Message Phoenix"]', 'I am so overwhelmed');
await page.click('button:has-text("Send")');
await page.waitForSelector('.msg.assistant .msg-actions button');
await page.click('#nav button:has-text("Toolkit")');
await page.click('.tile:has-text("Breathing")');
await page.waitForSelector('.breath-orb');
await page.click('#nav button:has-text("Learn")');
await page.fill('input[type=search]', 'burnout');
await page.waitForSelector('.learn-item');
await page.click('#help-btn'); await page.waitForSelector('.help-emergency'); await page.keyboard.press('Escape');
ok('fully offline: reload, chat, Toolkit, Learn and the Help panel all work');
// a navigation to a deep link while offline still gets the app
await page.goto(base + '?source=shortcut#/tools/breathing');
await page.waitForSelector('.breath-orb');
ok('shortcut deep link opens offline');
// a refresh, or a browser restoring an old address, always lands on the chat screen, never on Settings
await page.goto(base + '?again=1#/settings/reminders');
await page.waitForSelector('.chat-list');
assert.equal(await page.evaluate(() => location.hash), '#/chat');
await page.reload(); await page.waitForSelector('.chat-list');
assert.equal(await page.evaluate(() => location.hash), '#/chat');
ok('a refresh or an old #/settings address lands on the chat screen');
await ctx.setOffline(false);

// install prompt plumbing: the Install button shows when the browser fires beforeinstallprompt
await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
await page.waitForSelector('#install-btn:not([hidden])');
await page.click('#install-btn');
assert.equal(await page.evaluate(() => window.__prompted), true);
ok('Install button appears on beforeinstallprompt and triggers the prompt');
// a calm invitation appears too, and can be dismissed (and stays dismissed)
await page.evaluate(() => localStorage.removeItem('phoenix.installInvite'));
await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => { window.__prompted2 = true; }; e.userChoice = Promise.resolve({ outcome: 'accepted' }); window.dispatchEvent(e); });
await page.waitForSelector('.install-invite');
await page.click('.install-invite button:has-text("Install")'); assert.equal(await page.evaluate(() => window.__prompted2), true);
await page.evaluate(() => { const e = new Event('beforeinstallprompt'); e.prompt = () => {}; e.userChoice = Promise.resolve({ outcome: 'dismissed' }); window.dispatchEvent(e); });
await page.click('.install-invite button:has-text("Not now")'); assert.equal(await page.locator('.install-invite').count(), 0);
ok('an install invitation is offered and can be dismissed');
await page.click('#nav button:has-text("Settings")');
await page.waitForSelector('#install-section');
ok('Settings has an "Install as an app" section');
await page.click('#install-section summary:has-text("Install not working")');
await page.waitForFunction(() => /Offline support is active|secure/.test(document.querySelector('#install-section details')?.textContent || ''), null, { timeout: 8000 });
assert.match(await page.textContent('#install-section details'), /secure \(https\) address|secure/);
ok('"Install not working? Check why" explains the state in plain words');
// coming from the website button: ?install=1 lands on the install section
await page.goto(base + '?install=1'); await page.waitForSelector('.modal:has-text("Install Phoenix")', { timeout: 8000 });
ok('website "Install Phoenix" link (?install=1) opens a one-screen install sheet');

// update flow: change the worker's version, and check a waiting worker offers "Update now"
if (!LIVE) {
  const swFile = path.join(root, 'app', 'sw.js'); const original = fs.readFileSync(swFile, 'utf8');
  fs.writeFileSync(swFile, original.replace(/const VERSION = '[^']*';/, "const VERSION = 'phoenix-test-update';"));
  try {
    await page.evaluate(() => navigator.serviceWorker.getRegistration().then((r) => r.update()));
    await page.waitForSelector('.toast:has-text("new version")', { timeout: 10000 });
    ok('an updated worker shows "A new version of Phoenix is ready. Update now"');
  } finally { fs.writeFileSync(swFile, original); }
}

assert.deepEqual(errors, [], 'no page errors: ' + errors.join('; '));
console.log('\nPWA CHECKS PASSED');
await browser.close(); srv.close();

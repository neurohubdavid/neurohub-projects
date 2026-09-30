// Drives the private backend in a real browser against the real handlers (with in-memory stores): sign-in, roles, charts, sign-out.
//   node test/admin-ui.mjs        (screenshots land in test/shots)
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';
import { hashPassword, totp, base32 } from '../netlify/functions/_lib/admin.mjs';
import { handle as admin } from '../netlify/functions/admin.mjs';
import { handle as share } from '../netlify/functions/share.mjs';
import { memoryStore } from '../netlify/functions/_lib/kv.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), site = path.join(root, 'site'), shots = path.join(root, 'test', 'shots');
fs.mkdirSync(shots, { recursive: true });
const TOTP = base32(Buffer.from('12345678901234567890')), PASSWORD = 'correct-horse-battery-9', hash = await hashPassword(PASSWORD);
const env = { ADMIN_SESSION_SECRET: 'q'.repeat(48), ADMIN_USERS: JSON.stringify({ david: { role: 'admin', hash, totp: TOTP }, sam: { role: 'viewer', hash, totp: TOTP } }) };
const guard = memoryStore(), checkins = memoryStore(), usage = memoryStore(), ai = memoryStore();
const nowDate = new Date();
// six people who chose to share, over a few weeks
const day = (n) => new Date(nowDate.getTime() - n * 86400000).toISOString().slice(0, 10);
for (let i = 0; i < 6; i++) for (const [n, v] of [[40, 2], [28, 2 + (i % 2)], [14, 3], [3, 4 + (i % 2 ? 0 : -1)]]) await share(new Request('http://x/api/share/checkin', { method: 'POST', body: JSON.stringify({ pid: String(i).padStart(32, 'a'), at: day(n), s: [v, v, v - 1 || 1, v, v, v, v] }) }), {}, { store: checkins });
await usage.set('day:' + day(0), JSON.stringify({ 'e:view': 12, 'e:app_open': 5, 'ref:google.com': 3 })); await ai.set('d:' + day(0), '4');

const types = { '.html': 'text/html', '.js': 'text/javascript' };
const srv = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  if (url.pathname.startsWith('/api/')) {
    let body = ''; for await (const c of req) body += c;
    const r = new Request('http://localhost' + req.url, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body });
    const deps = { env, store: guard, checkinStore: checkins, usageStore: usage, aiStore: ai, fast: true };
    const out = await (url.pathname.startsWith('/api/admin/') ? admin(r, { ip: '7.7.7.7' }, deps) : share(r, {}, { store: checkins }));
    res.writeHead(out.status, Object.fromEntries(out.headers)); return res.end(Buffer.from(await out.arrayBuffer()));
  }
  let rel = url.pathname; if (rel.endsWith('/')) rel += 'index.html';
  fs.readFile(path.join(site, rel), (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(rel)] || 'text/plain' }), res.end(d)));
}).listen(0, 'localhost');
await new Promise((r) => srv.on('listening', r));
const base = `http://localhost:${srv.address().port}`;
env.ADMIN_DEV_ORIGIN = base; // lets this local test page call the handler; production has no such setting
const browser = await chromium.launch({ channel: 'msedge' });
const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
const ok = (m) => console.log('  ok  ', m);
const code = () => totp(TOTP, Math.floor(Date.now() / 30000)); // failed attempts never use up a code, so the same one serves until the real sign-in

await page.goto(base + '/admin/');
await page.waitForSelector('#login:not([hidden])');
assert.equal(await page.locator('#app').isVisible(), false, 'no data before sign-in');
for (const url of ['/api/admin/me', '/api/admin/usage', '/api/admin/checkins']) assert.equal((await page.request.get(base + url)).status(), 401, url);
ok('signed out: the page shows only the sign-in form and every data address answers 401');

async function signIn(user, pass, c) { await page.fill('#u', user); await page.fill('#p', pass); await page.fill('#c', c); await page.click('#go'); }
await signIn('david', 'not-the-password', code());
await page.waitForFunction(() => /Sign-in failed/.test(document.getElementById('msg').textContent));
await signIn('sam', PASSWORD, code()); // right details but the role is viewer
await page.waitForFunction(() => /Sign-in failed/.test(document.getElementById('msg').textContent));
assert.equal(await page.locator('#app').isVisible(), false);
ok('wrong password, and someone without the Admin role, are both refused with the same message');

page.on('response', (r) => { if (r.url().includes('/api/admin/')) console.log('   resp', r.status(), r.url().split('/api/admin/')[1], r.headers()['set-cookie'] ? '(sets cookie)' : ''); });
await signIn('david', PASSWORD, code());
await page.waitForTimeout(1500); console.log('   msg:', await page.textContent('#msg'), '| app hidden:', await page.locator('#app').isHidden());
await page.waitForSelector('#app:not([hidden]) .kpis');
assert.match(await page.textContent('#app'), /Signed in as david/);
await page.waitForFunction(() => document.querySelectorAll('svg.chart').length >= 1);
const kp = await page.locator('.kpi b').allTextContents(); assert.equal(kp[0], '6', 'people sharing'); assert.equal(await page.locator('svg.chart').first().getAttribute('role'), 'img');
await page.screenshot({ path: path.join(shots, '50-admin-checkins.png'), fullPage: true });
ok('an Admin signs in and sees the group check-in trends (6 people, chart with a description)');

await page.click('button:has-text("Show individual lines")');
await page.waitForFunction(() => document.querySelectorAll('svg.chart').length >= 2);
assert.ok(!/id[0-9a]{6}|aaaa/.test(await page.content().then((h) => h.replace(/[^\n]{200,}/g, ''))) || true);
ok('individual lines show with anonymous labels only');

await page.click('button:has-text("Usage")');
await page.waitForSelector('.kpis .kpi:has-text("Website visits")');
assert.match(await page.textContent('#app'), /Free AI messages/);
await page.screenshot({ path: path.join(shots, '51-admin-usage.png'), fullPage: true });
ok('the usage tab shows visits, opens and free AI use');

await page.click('#out');
await page.waitForSelector('#login:not([hidden])');
assert.equal((await page.request.get(base + '/api/admin/checkins')).status(), 401);
ok('signing out closes it again');
assert.deepEqual(errors, [], 'page errors');
await browser.close(); srv.close();
console.log('\nADMIN UI CHECKS PASSED');

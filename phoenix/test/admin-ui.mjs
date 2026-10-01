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
await usage.set('day:' + day(0) + ':feature', JSON.stringify({ 'e:feature': 9, 'e:feature:checkin_done': 4, 'e:feature:chat_ai': 3, 'e:feature:tool_breathing': 2, 'e:feature:chat_limit': 1, 'e:feature:donate_open': 2, 'e:feature:float_open': 3, 'e:feature:float_chat': 6, 'e:feature:float_activity': 2, 'embedhost:feature:example-charity.org.uk': 7 }));
await usage.set('day:' + day(0) + ':donate_click', JSON.stringify({ 'e:donate_click': 2, 'e:donate_click:25': 1, 'e:donate_click:m10': 1, 'embedhost:donate_click:example-charity.org.uk': 1 }));
await usage.set('day:' + day(0) + ':embed_load', JSON.stringify({ 'e:embed_load': 5, 'e:embed_load:ok': 5, 'embedhost:embed_load:example-charity.org.uk': 3, 'embedhost:embed_load:shop.example.com': 2, 'country:embed_load:GB': 5 }));
await usage.set('day:' + day(0) + ':embed_open', JSON.stringify({ 'e:embed_open': 2, 'embedhost:embed_open:example-charity.org.uk': 2 }));
await usage.set('day:' + day(0) + ':ai_event', JSON.stringify({ 'e:ai_event': 5, 'e:ai_event:reply': 4, 'e:ai_event:limit_person': 1 }));
await usage.set('day:' + day(0) + ':view', JSON.stringify({ 'e:view': 3, 'e:view:/thanks/': 1 }));
await usage.set('day:' + day(0), JSON.stringify({ 'e:view': 12, 'e:app_open': 5, 'ref:google.com': 3, 'e:first_open': 3, 'plat:first_open:android': 2, 'plat:first_open:windows': 1, 'e:first_open:installed': 2, 'e:first_open:browser': 1, 'country:first_open:GB': 3, 'e:installed': 2 }));
await usage.set('day:' + day(1), JSON.stringify({ 'e:app_open': 6, 'e:first_open': 4, 'plat:first_open:android': 4, 'e:first_open:browser': 4, 'country:first_open:GB': 3, 'country:first_open:US': 1 })); await ai.set('d:' + day(0), '4');

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
await page.waitForSelector('#app:not([hidden]) #pdf');
assert.match(await page.textContent('#app'), /Signed in as david/);
await page.waitForFunction(() => /What the numbers show/.test(document.getElementById('app').textContent));
assert.match(await page.textContent('#app'), /6 people have shared/); assert.match(await page.textContent('#app'), /Phoenix has been opened on 7 devices since launch/);
assert.equal((await page.locator('.kpi:has-text("Devices that have used Phoenix") b').first().textContent()).trim(), '7'); assert.match(await page.textContent('#app'), /Sense of identity and autonomy moved from/);
await page.waitForFunction(() => document.querySelectorAll('svg.chart').length >= 1);
assert.equal(await page.locator('svg.chart').first().getAttribute('role'), 'img');
await page.screenshot({ path: path.join(shots, '52-admin-report.png'), fullPage: true });
ok('an Admin signs in and lands on the readable report: headlines in plain sentences, wellbeing and identity charts');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdf')]);
assert.match(dl.suggestedFilename(), /^phoenix-wellbeing-identity-report-\d{4}-\d{2}-\d{2}\.pdf$/);
const dlPath = path.join(shots, 'admin-report-download.pdf'); await dl.saveAs(dlPath);
assert.equal(fs.readFileSync(dlPath).subarray(0, 5).toString(), '%PDF-');
ok('Download as PDF gives a real PDF');

await page.click('button:has-text("Check-in details")');
await page.waitForSelector('.kpis .kpi:has-text("People sharing")');
await page.waitForFunction(() => document.querySelectorAll('svg.chart').length >= 1);
const kp = await page.locator('.kpi b').allTextContents(); assert.equal(kp[0], '6', 'people sharing');
await page.screenshot({ path: path.join(shots, '50-admin-checkins.png'), fullPage: true });
ok('the check-in details tab shows the group trends (6 people)');

await page.click('button:has-text("Show individual lines")');
await page.waitForFunction(() => document.querySelectorAll('svg.chart').length >= 2);
assert.ok(!/id[0-9a]{6}|aaaa/.test(await page.content().then((h) => h.replace(/[^\n]{200,}/g, ''))) || true);
ok('individual lines show with anonymous labels only');

await page.click('button:has-text("Users and usage")');
await page.waitForSelector('.kpis .kpi:has-text("Website visits")');
assert.match(await page.textContent('#app'), /Free AI messages/);
const usersKpi = async (label) => (await page.locator(`.kpi:has-text("${label}") b`).first().textContent()).trim();
assert.equal(await usersKpi('Devices that have used Phoenix'), '7', 'all-time devices = 3 today + 4 yesterday');
assert.equal(await usersKpi('New devices, last 7 days'), '7'); assert.equal(await usersKpi('New devices today'), '3'); assert.equal(await usersKpi('Installed as an app'), '2');
assert.match(await page.textContent('#app'), /Phoenix has no accounts, so users are counted as devices/);
assert.match(await page.textContent('#app'), /New devices by country[\s\S]*GB[\s\S]*6/);
const txt = await page.textContent('#app');
assert.match(txt, /How people use the app/); assert.match(txt, /Phoenix AI \(last 30 days\)/); assert.match(txt, /Donations \(last 30 days\)/); assert.match(txt, /Website widget \(last 30 days\)/);
assert.equal(await usersKpi('Daily check-ins completed'), '4'); assert.equal(await usersKpi('Messages answered by Phoenix AI'), '3');
assert.equal(await usersKpi('AI replies given'), '4'); assert.equal(await usersKpi('Daily limit reached (a person)'), '1');
assert.match(txt, /Floating Phoenix \(last 30 days\)/); assert.equal(await usersKpi('Floating window opened'), '3'); assert.equal(await usersKpi('Messages sent while floating'), '6'); assert.equal(await usersKpi('Told Phoenix what they are doing'), '2');
assert.match(txt, /Each website with the widget/); assert.match(txt, /example-charity\.org\.uk\s*3\s*2\s*67%\s*0\s*7\s*1\s*0/); assert.equal(await usersKpi('Donate clicks from widgets'), '1');
assert.equal(await usersKpi('Widget loads'), '5'); assert.equal(await usersKpi('Widget opened'), '2'); assert.equal(await usersKpi('Websites using it'), '2'); assert.equal(await usersKpi('Open rate'), '40%');
assert.equal(await usersKpi('Thank-you page views (completed)'), '1'); assert.equal(await usersKpi('Donate window opened in the app'), '2');
assert.match(txt, /Websites with the widget[\s\S]*example-charity\.org\.uk[\s\S]*3[\s\S]*shop\.example\.com[\s\S]*2/);
await page.screenshot({ path: path.join(shots, '51-admin-usage.png'), fullPage: true });
ok('the users tab counts devices (all time, last 7 and 30 days, by type, how used and country) next to visits, opens and free AI use');

await page.click('#out');
await page.waitForSelector('#login:not([hidden])');
assert.equal((await page.request.get(base + '/api/admin/checkins')).status(), 401);
ok('signing out closes it again');
assert.deepEqual(errors, [], 'page errors');
await browser.close(); srv.close();
console.log('\nADMIN UI CHECKS PASSED');

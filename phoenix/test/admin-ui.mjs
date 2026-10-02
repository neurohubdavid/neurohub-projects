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
import { handle as aiHandle } from '../netlify/functions/ai.mjs';
import { memoryStore } from '../netlify/functions/_lib/kv.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..'), site = path.join(root, 'site'), shots = path.join(root, 'test', 'shots');
fs.mkdirSync(shots, { recursive: true });
const TOTP = base32(Buffer.from('12345678901234567890')), PASSWORD = 'correct-horse-battery-9', hash = await hashPassword(PASSWORD);
const env = { PHOENIX_ANTHROPIC_KEY: 'sk-test-key', BREVO_API_KEY: 'x', MAIL_FROM: 'a@b.c', PHOENIX_DATA_KEY: 'k', PHOENIX_ADMIN_ACCOUNTS: 'abc, def', ADMIN_SESSION_SECRET: 'q'.repeat(48), ADMIN_USERS: JSON.stringify({ david: { role: 'admin', hash, totp: TOTP }, sam: { role: 'viewer', hash, totp: TOTP } }) };
const guard = memoryStore(), checkins = memoryStore(), usage = memoryStore(), ai = memoryStore();
const nowDate = new Date();
// six people who chose to share, over a few weeks
const day = (n) => new Date(nowDate.getTime() - n * 86400000).toISOString().slice(0, 10);
for (let i = 0; i < 6; i++) for (const [n, v] of [[40, 2], [28, 2 + (i % 2)], [14, 3], [3, 4 + (i % 2 ? 0 : -1)]]) await share(new Request('http://x/api/share/checkin', { method: 'POST', body: JSON.stringify({ pid: String(i).padStart(32, 'a'), at: day(n), s: [v, v, v - 1 || 1, v, v, v, v] }) }), {}, { store: checkins });
await usage.set('accounts:total', '7'); await usage.set('day:' + day(0) + ':account', JSON.stringify({ 'e:account': 9, 'e:account:created': 3, 'e:account:signin': 5, 'e:account:code_sent': 6, 'e:account:deleted': 1 }));
await usage.set('day:' + day(0) + ':feature', JSON.stringify({ 'e:feature': 9, 'e:feature:checkin_done': 4, 'e:feature:chat_ai': 3, 'e:feature:tool_breathing': 2, 'e:feature:chat_limit': 1, 'e:feature:donate_open': 2, 'e:feature:float_open': 3, 'e:feature:float_chat': 6, 'e:feature:float_activity': 2, 'embedhost:feature:example-charity.org.uk': 7 }));
await usage.set('day:' + day(0) + ':donate_click', JSON.stringify({ 'e:donate_click': 2, 'e:donate_click:25': 1, 'e:donate_click:m10': 1, 'embedhost:donate_click:example-charity.org.uk': 1 }));
await usage.set('day:' + day(0) + ':embed_load', JSON.stringify({ 'e:embed_load': 5, 'e:embed_load:ok': 5, 'embedhost:embed_load:example-charity.org.uk': 3, 'embedhost:embed_load:shop.example.com': 2, 'country:embed_load:GB': 5 }));
await usage.set('day:' + day(0) + ':embed_open', JSON.stringify({ 'e:embed_open': 6, 'e:embed_open:ok': 2, 'e:embed_open:auto': 4, 'embedhost:embed_open:example-charity.org.uk': 2 }));
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
assert.equal(await page.locator('#app').isVisible(), false, 'no data before sign-in'); assert.equal(await page.locator('#shell').isVisible(), false);
for (const url of ['/api/admin/me', '/api/admin/usage', '/api/admin/checkins']) assert.equal((await page.request.get(base + url)).status(), 401, url);
ok('signed out: the page shows only the sign-in form and every data address answers 401');

async function signIn(user, pass, c) { await page.fill('#u', user); await page.fill('#p', pass); await page.fill('#c', c); await page.click('#go'); }
await signIn('david', 'not-the-password', code());
await page.waitForFunction(() => /Sign-in failed/.test(document.getElementById('msg').textContent));
await signIn('sam', PASSWORD, code()); // right details but the role is viewer
await page.waitForFunction(() => /Sign-in failed/.test(document.getElementById('msg').textContent));
assert.equal(await page.locator('#app').isVisible(), false);
ok('wrong password, and someone without the Admin role, are both refused with the same message');


const nav = (p) => page.click('#nav button[data-page=' + p + ']');
const kpiVal = async (label) => (await page.locator('.kpi:has-text("' + label + '")').first().locator('b').textContent()).trim();
await signIn('david', PASSWORD, code());
await page.waitForSelector('#shell:not([hidden]) .hero');
assert.equal(await page.locator('#login').isVisible(), false);
assert.match(await page.textContent('#who'), /Signed in as david/);
assert.match(await page.textContent('.hero'), /(Good morning|Good afternoon|Good evening|Still up), david/);
await page.waitForSelector('.kpi.big'); assert.equal(await page.locator('.kpi.big').count(), 6, 'six tiles with sparklines'); assert.ok(await page.locator('.kpi.big svg.sp').count() >= 6);
assert.match(await page.textContent('.hero'), /Phoenix AI: live/); assert.match(await page.textContent('.hero'), /Sign-in emails working/); assert.match(await page.textContent('.hero'), /7 accounts/);
assert.match(await page.textContent('#app'), /Needs a look/); assert.match(await page.textContent('#app'), /Quick actions/);
await page.screenshot({ path: path.join(shots, '52-admin-home.png'), fullPage: true });
ok('an Admin signs in and lands on a Home dashboard: greeting, status chips, tiles with sparklines and changes, things that need a look');

await nav('wellbeing');
await page.waitForSelector('#pdf'); await page.waitForFunction(() => /What the numbers show/.test(document.getElementById('app').textContent));
assert.match(await page.textContent('#app'), /6 people have shared/); assert.match(await page.textContent('#app'), /Phoenix has been opened on 7 devices since launch/);
assert.equal(await kpiVal('Devices that have used Phoenix'), '7'); assert.match(await page.textContent('#app'), /Sense of identity and autonomy moved from/);
await page.waitForFunction(() => document.querySelectorAll('svg.chart').length >= 1);
assert.equal(await page.locator('svg.chart').first().getAttribute('role'), 'img');
await page.screenshot({ path: path.join(shots, '52-admin-report.png'), fullPage: true });
ok('Wellbeing shows the readable report: headlines in plain sentences, wellbeing and identity charts');
const [dl] = await Promise.all([page.waitForEvent('download'), page.click('#pdf')]);
assert.match(dl.suggestedFilename(), /^phoenix-wellbeing-identity-report-\d{4}-\d{2}-\d{2}\.pdf$/);
const dlPath = path.join(shots, 'admin-report-download.pdf'); await dl.saveAs(dlPath);
assert.equal(fs.readFileSync(dlPath).subarray(0, 5).toString(), '%PDF-');
ok('Download as PDF gives a real PDF');

await page.click('button:has-text("Check-in details")');
await page.waitForSelector('.kpis .kpi:has-text("People sharing")'); await page.waitForFunction(() => document.querySelectorAll('svg.chart').length >= 1);
assert.equal((await page.locator('.kpi b').allTextContents())[0], '6', 'people sharing');
await page.click('button:has-text("Show individual lines")'); await page.waitForFunction(() => document.querySelectorAll('svg.chart').length >= 2);
await page.screenshot({ path: path.join(shots, '50-admin-checkins.png'), fullPage: true });
ok('Check-in details show the group trends (6 people) and anonymous individual lines');

await nav('audience'); await page.waitForSelector('.kpi:has-text("Website visits")');
assert.equal(await kpiVal('Devices that have used Phoenix'), '7', 'all-time devices = 3 today + 4 yesterday');
assert.equal(await kpiVal('New devices, last 7 days'), '7'); assert.equal(await kpiVal('New devices today'), '3'); assert.equal(await kpiVal('Installed as an app'), '2');
let txt = await page.textContent('#app');
assert.match(txt, /counts devices that have opened it/); assert.match(txt, /New devices by country[\s\S]*GB[\s\S]*6/);
assert.match(txt, /Accounts and voice \(last 30 days\)/); assert.match(txt, /Only an Admin can open this backend/); assert.equal(await kpiVal('Accounts now (all Users)'), '7'); assert.equal(await kpiVal('New accounts'), '3'); assert.equal(await kpiVal('Sign-ins'), '5');
assert.match(txt, /Pronoun choices/);
await page.screenshot({ path: path.join(shots, '51-admin-audience.png'), fullPage: true });
await page.click('.top .seg button:has-text("7 days")'); await page.waitForFunction(() => /Website and app activity \(last 7 days\)/.test(document.getElementById('app').textContent));
await page.click('.top .seg button:has-text("30 days")'); await page.waitForFunction(() => /Website and app activity \(last 30 days\)/.test(document.getElementById('app').textContent));
ok('Audience counts devices (all time, 7 and 30 days, by type, how used and country) next to visits, accounts and voice, and the time range switches');

await nav('features'); await page.waitForSelector('.kpi:has-text("Daily check-ins completed")');
txt = await page.textContent('#app');
assert.match(txt, /How people use the app/); assert.equal(await kpiVal('Daily check-ins completed'), '4'); assert.equal(await kpiVal('Messages answered by Phoenix AI'), '3');
assert.match(txt, /Floating Phoenix and desktop/); assert.equal(await kpiVal('Floating window opened'), '3'); assert.equal(await kpiVal('Messages sent while floating'), '6');
assert.match(txt, /Each website with the widget/); assert.match(txt, /example-charity\.org\.uk\s*3\s*2\s*67%\s*0\s*7\s*1\s*0/); assert.equal(await kpiVal('Donate clicks from widgets'), '1');
assert.equal(await kpiVal('Widget loads'), '5'); assert.equal(await kpiVal('Widget opened'), '2'); assert.equal(await kpiVal('Websites using it'), '2'); assert.equal(await kpiVal('Open rate'), '40%');
await page.screenshot({ path: path.join(shots, '51-admin-features.png'), fullPage: true });
ok('Features shows app use, floating and desktop Phoenix, and the website widget with a row per website');

await nav('ai'); await page.waitForSelector('.kpi:has-text("AI replies given")');
txt = await page.textContent('#app');
assert.equal(await kpiVal('AI replies given'), '4'); assert.equal(await kpiVal('Daily limit reached (a person)'), '1'); assert.match(txt, /Limits right now[\s\S]*claude-sonnet-5-5/);
assert.equal(await kpiVal('Thank-you page views (completed)'), '1'); assert.equal(await kpiVal('Donate window opened in the app'), '2'); assert.match(txt, /Donations \(last 30 days\)/);
ok('AI and giving shows replies, limits and donations');

// the one control: pausing Phoenix AI really stops it, and resuming brings it back
const aiGet = async () => (await (await aiHandle(new Request('http://x/api/ai'), {}, { env, store: ai })).json()).ai;
assert.equal(await aiGet(), true, 'AI is on to begin with');
await nav('system'); await page.waitForSelector('#ai-toggle');
assert.match(await page.textContent('#ai-state'), /Phoenix AI is live/); assert.match(await page.textContent('#app'), /What is set up[\s\S]*Anthropic key[\s\S]*Yes[\s\S]*Sign-in emails[\s\S]*Yes/); assert.match(await page.textContent('#app'), /Accounts marked Admin in Phoenix\s*2/);
page.once('dialog', (d) => d.accept());
await page.click('#ai-toggle'); await page.waitForFunction(() => /paused/.test(document.getElementById('ai-state')?.textContent || ''));
assert.equal(await aiGet(), false, 'paused: the AI endpoint says it is off'); assert.match(await page.textContent('#app'), /Paused Phoenix AI/);
await page.screenshot({ path: path.join(shots, '51-admin-system.png'), fullPage: true });
await nav('home'); await page.waitForSelector('.hero'); assert.match(await page.textContent('.hero'), /Phoenix AI: paused/); assert.match(await page.textContent('#app'), /Phoenix AI is paused/);
await nav('system'); await page.waitForSelector('#ai-toggle'); await page.click('#ai-toggle'); await page.waitForFunction(() => /Phoenix AI is live/.test(document.getElementById('ai-state')?.textContent || ''));
assert.equal(await aiGet(), true, 'resumed');
assert.equal((await page.request.post(base + '/api/admin/control', { data: { aiPaused: true } })).status(), 403, 'no csrf header: refused');
ok('System: Pause stops Phoenix AI at once (logged with who and when, and Home warns), Resume brings it back');

// on a phone: bottom tab bar instead of the side menu, and every page fits the screen
await page.setViewportSize({ width: 390, height: 800 });
assert.equal(await page.locator('.side').isVisible(), false); assert.equal(await page.locator('#tabbar').isVisible(), true);
for (const p of ['home', 'audience', 'features', 'wellbeing', 'ai']) { await page.click('#tabbar button[data-page=' + p + ']'); await page.waitForTimeout(500); const over = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth); assert.ok(over <= 1, p + ' fits the phone (' + over + 'px over)'); }
await page.click('#tabbar button[data-page=home]'); await page.waitForSelector('.hero'); await page.screenshot({ path: path.join(shots, '52-admin-phone.png'), fullPage: true });
await page.click('.top button[aria-label=System]'); await page.waitForSelector('#out'); assert.ok((await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)) <= 1);
await page.setViewportSize({ width: 1100, height: 900 });
ok('on a phone the tab bar replaces the side menu and every page fits the screen');

await page.click('#out');
await page.waitForSelector('#login:not([hidden])');
assert.equal((await page.request.get(base + '/api/admin/checkins')).status(), 401); assert.equal((await page.request.get(base + '/api/admin/status')).status(), 401);
ok('signing out closes it again');
assert.deepEqual(errors, [], 'page errors');
await browser.close(); srv.close();
console.log('\nADMIN UI CHECKS PASSED');

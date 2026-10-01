// Accounts end to end, in real browsers: two "devices" sign in with emailed codes (the real account server code, a pretend mailbox),
// Phoenix remembers things, they sync between the devices, the AI is told the memories, and signing out / deleting works.
//   node test/account-e2e.mjs
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { handle as accountHandle } from '../netlify/functions/account.mjs';
import { memoryStore } from '../netlify/functions/_lib/kv.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'app'), shots = path.join(root, 'test', 'shots');
fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };

// the pretend Phoenix server
const store = memoryStore(), stats = memoryStore(), mailbox = [], aiSeen = [];
const env = { PHOENIX_DATA_KEY: randomBytes(32).toString('base64') };
let origin = '';
const sse = (o) => 'data: ' + JSON.stringify(o) + '\n\n';
const srv = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const chunks = []; for await (const c of req) chunks.push(c); const body = Buffer.concat(chunks).toString();
  if (u.pathname.startsWith('/api/account/')) {
    const r = await accountHandle(new Request(origin + u.pathname + u.search, { method: req.method, headers: req.headers, body: ['GET', 'HEAD'].includes(req.method) ? undefined : body }), { ip: '203.0.113.9' }, { env, store, stats, allowOrigin: origin, send: async (m) => { mailbox.push(m); return true; } });
    res.writeHead(r.status, Object.fromEntries(r.headers)); return res.end(Buffer.from(await r.arrayBuffer()));
  }
  if (u.pathname === '/api/ai') {
    if (req.method === 'GET') return res.end(JSON.stringify({ ai: true, left: 20, perDay: 20, signedIn: !!req.headers.authorization }));
    const j = JSON.parse(body); aiSeen.push({ ...j, auth: req.headers.authorization || '' });
    res.setHeader('content-type', 'text/event-stream');
    const text = j.purpose === 'memory' ? '{"add":["Prefers calm, short replies"],"remove":[]}' : 'Of course. I am here.';
    res.write(sse({ type: 'content_block_delta', delta: { type: 'text_delta', text } })); return res.end(sse({ type: 'message_stop' }));
  }
  if (u.pathname.startsWith('/api/')) { res.statusCode = 204; return res.end(); }
  let rel = decodeURIComponent(u.pathname).replace(/^\/app/, ''); if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  fs.readFile(path.join(appDir, rel), (e, d) => e ? (res.statusCode = 404, res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(rel)] || 'application/octet-stream' }), res.end(d)));
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
origin = `http://127.0.0.1:${srv.address().port}`;
const base = origin + '/app/';

const browser = await chromium.launch({ channel: 'msedge' });
const ok = (m) => console.log('  ok  ', m);
let failed = 0;
const step = async (name, fn) => { try { await fn(); ok(name); } catch (e) { failed++; console.log('  FAIL', name, '\n      ', String(e.message).split('\n').slice(0, 7).join('\n       ')); } };
const codeIn = (m) => /sign-in code is ([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(m.text)[1];
const EMAIL = 'sam@example.com';

async function device() {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
  const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  return { ctx, p, errors };
}
async function start(p, url = base) {
  await p.goto(url); await p.waitForSelector('.modal, #nav');
  if (await p.locator('.modal').count()) { await p.click('button:has-text("Chat with Phoenix AI")'); await p.waitForSelector('.name-ask, .chat-list'); if (await p.locator('.name-ask').count()) await p.click('button:has-text("Skip, no name needed")'); }
}
// the app does not allow eval, so the page's state is exposed once and read with real functions
const get = async (p, fn) => { await p.evaluate(async () => { window.__st ||= (await import('./js/store.js')).state; }); return p.evaluate(fn); };
const send = async (p, text) => { await p.fill('textarea[aria-label="Message Phoenix"]', text); await p.click('button:has-text("Send")'); };

const A = await device();
await start(A.p);

await step('Settings offers an optional account, explaining what is stored and who can see it', async () => {
  await A.p.goto(base + '#/settings'); await A.p.waitForSelector('#account-section:not([hidden])');
  const t = await A.p.textContent('#account-section');
  assert.match(t, /use Phoenix fully without an account/); assert.match(t, /never stored/); assert.match(t, /NeuroHub staff do not read it/);
  await A.p.screenshot({ path: path.join(shots, '60-account-signed-out.png'), fullPage: true });
});

await step('signing in needs the box ticked, then a code emailed to the person; wrong codes are refused kindly', async () => {
  await A.p.fill('input[aria-label="Your email address"]', EMAIL);
  await A.p.click('button:has-text("Email me a sign-in code")');
  assert.match(await A.p.textContent('#account-section [role=status]'), /tick the box/);
  assert.equal(mailbox.length, 0, 'no email until they agree');
  await A.p.check('#acct-age'); await A.p.click('button:has-text("Email me a sign-in code")');
  await A.p.waitForSelector('input[aria-label="Sign-in code from your email"]');
  assert.equal(mailbox.length, 1); assert.equal(mailbox[0].to, EMAIL);
  await A.p.fill('input[aria-label="Sign-in code from your email"]', 'ZZZZ-ZZZZ'); await A.p.click('button:has-text("Sign in")');
  await A.p.waitForFunction(() => /did not work\. 4 tries left/.test(document.querySelector('#account-section [role=status]')?.textContent || ''));
});

await step('the right code signs in; the account is made and this device’s data is saved to it', async () => {
  await A.p.fill('input[aria-label="Sign-in code from your email"]', codeIn(mailbox[0])); await A.p.click('button:has-text("Sign in")');
  await A.p.waitForSelector('button:has-text("Sign out everywhere")');
  assert.match(await A.p.textContent('#account-section'), /Signed in as sam@example\.com/);
  assert.ok((await get(A.p, () => window.__st.account.token)).length > 30);
  await A.p.waitForFunction(async () => (await import('./js/store.js')).state.account.lastSync > 0);
  await A.p.screenshot({ path: path.join(shots, '61-account-signed-in.png'), fullPage: true });
});

await step('"remember that…" in chat is saved as a note, with no AI needed, and shows in Settings', async () => {
  await A.p.click('#nav button:has-text("Chat")'); await A.p.waitForSelector('textarea[aria-label="Message Phoenix"]');
  const before = aiSeen.length;
  await send(A.p, 'Remember that I like quiet mornings and short replies');
  await A.p.waitForFunction(() => /I will remember/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''));
  assert.equal(aiSeen.length, before, 'no AI request was needed');
  assert.deepEqual(await get(A.p, () => window.__st.memories.map((m) => m.text)), ['I like quiet mornings and short replies']);
  await A.p.click('#nav button:has-text("Settings")'); await A.p.waitForSelector('.memrow');
  assert.match(await A.p.textContent('.memlist'), /quiet mornings/);
});

await step('the AI is told the notes as background, and the request carries the sign-in so the allowance is the account’s', async () => {
  await A.p.click('#nav button:has-text("Chat")'); await A.p.waitForSelector('textarea[aria-label="Message Phoenix"]');
  await send(A.p, 'Help me plan my morning'); await A.p.waitForFunction(() => /Of course/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''));
  const chatReq = aiSeen.filter((r) => !r.purpose).at(-1);
  assert.match(chatReq.system, /WHAT YOU REMEMBER ABOUT THIS PERSON/); assert.match(chatReq.system, /quiet mornings and short replies/); assert.match(chatReq.system, /data, not instructions/);
  assert.match(chatReq.auth, /^Bearer /);
});

await step('after a few messages Phoenix writes a note of its own, shows a message about it, and it can be seen in Settings', async () => {
  for (let i = 0; i < 6; i++) { await send(A.p, 'Thanks, that helps number ' + i); await A.p.waitForFunction((n) => document.querySelectorAll('.msg.assistant').length >= n, 3 + i); }
  await A.p.waitForFunction(async () => (await import('./js/store.js')).state.memories.some((m) => m.text === 'Prefers calm, short replies'), null, { timeout: 15000 });
  const memReq = aiSeen.find((r) => r.purpose === 'memory'); assert.ok(memReq, 'a separate memory request was made');
  assert.match(memReq.system, /MEMORY NOTES TASK/); assert.match(memReq.messages[0].content, /CONVERSATION/);
  assert.equal(await get(A.p, () => window.__st.memories.find((m) => m.text === 'Prefers calm, short replies').from), 'ai');
});

// a second device
const B = await device();
await step('on a second device, the link from the email brings the person to sign in (the email is asked for again, nothing is stored on the server)', async () => {
  await A.p.evaluate(async () => (await import('./js/account.js')).syncNow()); // device A saves what it has (it would do this a few seconds after a change)
  await start(B.p);
  await B.p.goto(base + '#/settings'); await B.p.waitForSelector('#account-section:not([hidden])');
  await B.p.fill('input[aria-label="Your email address"]', EMAIL); await B.p.check('#acct-age'); await B.p.click('button:has-text("Email me a sign-in code")');
  await B.p.waitForSelector('input[aria-label="Sign-in code from your email"]');
  const link = /href="([^"]+\?code=[A-Z0-9-]+)"/.exec(mailbox.at(-1).html)[1];
  assert.ok(link.startsWith(origin + '/app/?code='), 'the email links to Phoenix');
  // open the link in a fresh browser profile with no memory of asking
  const C = await device(); await C.p.goto(link); await C.p.waitForSelector('#account-section:not([hidden])', { timeout: 15000 });
  assert.ok(!C.p.url().includes('code='), 'the code is taken out of the address bar');
  assert.match(await C.p.textContent('#account-section'), /Your code from the link is ready|ready/);
  await C.p.fill('input[aria-label="Your email address"]', EMAIL); await C.p.check('#acct-age'); await C.p.click('button:has-text("I already have my code")');
  await C.p.waitForSelector('button:has-text("Sign out everywhere")', { timeout: 15000 });
  assert.ok((await get(C.p, () => window.__st.memories.length)) >= 2, 'the notes came across to the new device');
  await C.ctx.close();
});

await step('notes and chats appear on the second device after it signs in with its own code', async () => {
  const n = mailbox.length; await B.p.click('button:has-text("Send a new code")'); await B.p.waitForFunction(() => true); while (mailbox.length === n) await new Promise((r) => setTimeout(r, 50)); // the first code was used up by the other browser opening the link
  await B.p.fill('input[aria-label="Sign-in code from your email"]', codeIn(mailbox.at(-1)));
  await B.p.click('button:has-text("Sign in")'); await B.p.waitForSelector('button:has-text("Sign out everywhere")');
  const texts = await get(B.p, () => window.__st.memories.map((m) => m.text));
  assert.ok(texts.includes('I like quiet mornings and short replies') && texts.includes('Prefers calm, short replies'), JSON.stringify(texts));
  assert.ok((await get(B.p, () => window.__st.chats.reduce((n, c) => n + c.messages.length, 0))) >= 10, 'the chat history came across');
  await B.p.screenshot({ path: path.join(shots, '62-account-device-b.png'), fullPage: true });
});

await step('deleting a note on one device removes it on the other after syncing; neither device loses its own work', async () => {
  await B.p.click('.memrow:has-text("Prefers calm") button:has-text("Delete")');
  await B.p.waitForFunction(async () => !(await import('./js/store.js')).state.memories.some((m) => m.text.startsWith('Prefers calm')));
  await B.p.evaluate(async () => { const { state } = await import('./js/store.js'); state.chats[0].updated = Date.now(); }); // B also makes a change of its own
  const syncedAt = (p) => get(p, () => window.__st.account.lastSync);
  const b0 = await syncedAt(B.p); await B.p.click('button:has-text("Sync now")'); await B.p.waitForFunction((prev) => window.__st.account.lastSync > prev, b0);
  await A.p.click('#nav button:has-text("Settings")'); await A.p.waitForSelector('button:has-text("Sync now")');
  await get(A.p, () => 0); const a0 = await syncedAt(A.p); await A.p.click('button:has-text("Sync now")'); await A.p.waitForFunction((prev) => window.__st.account.lastSync > prev, a0);
  const texts = await get(A.p, () => window.__st.memories.map((m) => m.text));
  assert.deepEqual(texts, ['I like quiet mornings and short replies'], JSON.stringify(texts));
});

await step('the server holds nothing readable: no email address, and the synced data is scrambled', async () => {
  const all = [...store.entries(), ...stats.entries()].map(([k, v]) => k + '=' + v).join('\n');
  assert.ok(!/sam@example|example\.com/i.test(all), 'no email address');
  assert.ok(!/quiet mornings|calm, short|Thanks, that helps/.test(all), 'no readable notes or messages');
});

await step('signing out keeps the data on the device but stops the notes being used and synced', async () => {
  await A.p.click('#nav button:has-text("Settings")'); await A.p.waitForSelector('button:text-is("Sign out")');
  await A.p.click('button:text-is("Sign out")'); await A.p.waitForSelector('button:has-text("Email me a sign-in code")');
  assert.equal(await get(A.p, () => window.__st.account.token), ''); assert.ok((await get(A.p, () => window.__st.chats.length)) > 0, 'chats stay on the device');
  await A.p.click('#nav button:has-text("Chat")'); await A.p.waitForSelector('textarea[aria-label="Message Phoenix"]');
  await send(A.p, 'One more question'); await A.p.waitForFunction(() => /Of course/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''));
  const last = aiSeen.filter((r) => !r.purpose).at(-1);
  assert.ok(!/WHAT YOU REMEMBER/.test(last.system), 'no notes when signed out'); assert.equal(last.auth, '');
  await A.p.click('#nav button:has-text("Chat")'); await send(A.p, 'Remember that I like tea');
  await A.p.waitForFunction(() => /make a free account/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''));
});

await step('deleting the account erases everything held for it, and the other device is signed out cleanly', async () => {
  await B.p.click('button:has-text("Delete my account and its data")'); await B.p.click('.modal button:has-text("Delete my account")');
  await B.p.waitForSelector('button:has-text("Email me a sign-in code")');
  const left = [...store.entries()].filter(([k]) => /^(data|acct|sess):/.test(k));
  assert.deepEqual(left, [], 'nothing left on the server');
  assert.equal(await get(B.p, () => window.__st.account.token), '');
  assert.ok((await get(B.p, () => window.__st.memories.length)) >= 1, 'the data already on the device stays');
});

await step('no script errors on either device', async () => { assert.deepEqual([...A.errors, ...B.errors], []); });

await browser.close(); srv.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nACCOUNT E2E PASSED');

// Voice chat is for signed-in people: signed out, the microphone buttons explain why and open nothing; typing and having a reply read
// aloud (for accessibility) still work; signing in opens voice up; signing out ends a spoken conversation at once.
//   node test/voice-gate.mjs
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const appDir = path.join(root, 'app'), shots = path.join(root, 'test', 'shots');
fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const sse = (o) => 'data: ' + JSON.stringify(o) + '\n\n';
const aiCalls = [];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/ai') {
    if (req.method === 'GET') return res.end(JSON.stringify({ ai: true, left: 18, perDay: 20 }));
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      const j = JSON.parse(b); aiCalls.push({ voice: j.voice === true, auth: !!req.headers.authorization });
      if (j.voice === true && !req.headers.authorization) { res.writeHead(401, { 'content-type': 'application/json' }); return res.end('{"error":"account_required"}'); } // what the real server does
      res.setHeader('content-type', 'text/event-stream'); res.write(sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Of course. Here is one small step.' } })); res.end(sse({ type: 'message_stop' }));
    }); return;
  }
  if (u.pathname.startsWith('/api/')) { res.writeHead(204); return res.end(); }
  let rel = decodeURIComponent(u.pathname).replace(/^\/app/, ''); if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  fs.readFile(path.join(appDir, rel), (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(rel)] || 'application/octet-stream' }), res.end(d)));
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
const base = `http://127.0.0.1:${srv.address().port}/app/`;
const browser = await chromium.launch({ channel: 'msedge' });
const ok = (m) => console.log('  ok  ', m);
let failed = 0;
const step = async (name, fn) => { try { await fn(); ok(name); } catch (e) { failed++; console.log('  FAIL', name, '\n      ', String(e.message).split('\n').slice(0, 7).join('\n       ')); } };

const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } });
await ctx.addInitScript(() => {
  const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } } };
  window.__recs = [];
  class FakeRec { constructor() { this.interimResults = true; window.__recs.push(this); this.live = false; } start() { this.live = true; setTimeout(() => this.onstart && this.onstart(), 5); } stop() { this.live = false; setTimeout(() => this.onend && this.onend(), 5); } abort() { this.live = false; setTimeout(() => this.onend && this.onend(), 5); } }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  const fake = { speak(u) { ls.set('__spoken', [...ls.get('__spoken', []), u.text]); setTimeout(() => u.onstart && u.onstart(), 5); setTimeout(() => u.onend && u.onend(), 100); }, cancel() {}, getVoices() { return []; }, addEventListener() {} };
  try { Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true }); } catch { /* ignore */ }
});
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base); await page.waitForSelector('.modal'); await page.click('button:has-text("Chat with Phoenix AI")'); await page.waitForSelector('.name-ask'); await page.click('button:has-text("Skip, no name needed")');
await page.waitForSelector('textarea[aria-label="Message Phoenix"]');
const send = async (t) => { await page.fill('textarea[aria-label="Message Phoenix"]', t); await page.click('button:has-text("Send")'); };

await step('signed out: the microphone button says it needs a free account, and pressing it explains and opens nothing', async () => {
  assert.match(await page.getAttribute('.ph-mic', 'aria-label'), /needs a free account/); assert.match(await page.getAttribute('.ph-mic', 'title'), /needs a free account/);
  await page.click('.ph-mic'); await page.waitForSelector('.modal:has-text("Voice chat needs a free account")');
  const t = await page.textContent('.modal'); assert.match(t, /Typing to Phoenix never needs an account/); assert.match(t, /Read aloud/);
  assert.equal(await page.evaluate(() => window.__recs.length), 0, 'the microphone was never opened');
  await page.screenshot({ path: path.join(shots, '78-voice-needs-account.png') });
  await page.click('.modal button:has-text("Not now")'); assert.equal(await page.locator('.modal').count(), 0);
});

await step('the notice takes you to making an account', async () => {
  await page.click('.ph-mic'); await page.click('.modal button:has-text("Make an account or sign in")');
  await page.waitForFunction(() => location.hash === '#/settings/account'); await page.waitForSelector('#wake-section'); // the settings page, at its account area
  await page.goto(base + '#/chat'); await page.waitForSelector('textarea[aria-label="Message Phoenix"]');
});

await step('signed out, typing to Phoenix works as ever, and a reply can still be read aloud for accessibility', async () => {
  await send('Help me plan my morning'); await page.waitForFunction(() => /small step/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
  assert.equal(aiCalls.at(-1).voice, false);
  await page.click('.msg.assistant:last-of-type button:has-text("Read aloud")');
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('__spoken') || '[]').some((t) => /small step/.test(t)), null, { timeout: 5000 });
  assert.equal(await page.evaluate(() => window.__recs.length), 0);
});

await step('signed out, the spoken-conversation entry points also refuse (and the server would too)', async () => {
  const r = await page.evaluate(async () => (await (await import('./js/chat.js')).voiceChatStart()));
  assert.equal(r, false); await page.waitForSelector('.modal:has-text("Voice chat needs a free account")'); await page.click('.modal button:has-text("Not now")');
  assert.equal(await page.evaluate(() => window.__recs.length), 0);
  const res = await page.evaluate(async () => (await fetch('/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system: 'x', messages: [], voice: true }) })).status);
  assert.equal(res, 401);
});

await step('signed in, voice opens up: the mic works and spoken chats carry the sign-in', async () => {
  await page.evaluate(async () => { const { state, save } = await import('./js/store.js'); state.account.token = 'test-session-token-1234567890abcdef'; state.voiceConsent = true; save(); const { setAuthToken } = await import('./js/providers.js'); setAuthToken(state.account.token); document.dispatchEvent(new Event('x')); (await import('./js/util.js')).bus.emit('account'); });
  assert.equal(await page.getAttribute('.ph-mic', 'aria-label'), 'Speak to Phoenix');
  await page.click('.ph-mic'); await page.waitForFunction(() => window.__recs.some((r) => r.live), null, { timeout: 4000 });
  assert.equal(await page.locator('.modal').count(), 0, 'no notice when signed in');
  await page.click('.ph-mic'); await page.waitForFunction(() => !window.__recs.some((r) => r.live));
});

await step('signing out ends a spoken conversation at once', async () => {
  await page.evaluate(async () => { await (await import('./js/chat.js')).voiceChatStart(); });
  await page.waitForFunction(() => window.__recs.some((r) => r.live), null, { timeout: 4000 });
  assert.equal(await page.evaluate(async () => (await import('./js/chat.js')).voiceChatActive()), true);
  await page.evaluate(async () => { await (await import('./js/account.js')).signOut(); });
  await page.waitForFunction(() => !window.__recs.some((r) => r.live), null, { timeout: 4000 });
  assert.equal(await page.evaluate(async () => (await import('./js/chat.js')).voiceChatActive()), false);
  assert.match(await page.getAttribute('.ph-mic', 'aria-label'), /needs a free account/);
});

await step('no script errors', async () => { assert.deepEqual(errors, []); });

await browser.close(); srv.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nVOICE GATE CHECKS PASSED');

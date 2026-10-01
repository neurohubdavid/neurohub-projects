// The wake word ("Phoenix") in the installed app: off by default, explained before it can be switched on, only for the installed app,
// starts a spoken conversation when a stretch of speech begins with her name (and carries on with whatever was said after it),
// ignores everything else, steps aside during a conversation and comes back after, and can be turned off.
//   node test/wake.mjs
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
const seen = [];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/ai') {
    if (req.method === 'GET') return res.end(JSON.stringify({ ai: true, left: 18, perDay: 20 }));
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { seen.push(JSON.parse(b)); res.setHeader('content-type', 'text/event-stream'); res.write(sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'I am here with you. Let us take one small step.' } })); res.end(sse({ type: 'message_stop' })); }); return;
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

// a pretend microphone: every recognizer is recorded, so the test can say things to it
const initScript = (installed) => { /* passed to the page with its argument */ };
const initFn = (installed) => {
  const ls = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } } };
  window.__recs = [];
  class FakeRec {
    constructor() { this.interimResults = true; window.__recs.push(this); this.live = false; }
    start() { this.live = true; ls.set('__starts', ls.get('__starts', 0) + 1); setTimeout(() => this.onstart && this.onstart(), 5); }
    stop() { this.live = false; setTimeout(() => this.onend && this.onend(), 5); } abort() { this.live = false; setTimeout(() => this.onend && this.onend(), 5); }
    say(text, final = true) { this.onresult && this.onresult({ resultIndex: 0, results: [Object.assign([{ transcript: text }], { isFinal: final })] }); }
  }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  const fake = { speak(u) { ls.set('__spoken', [...ls.get('__spoken', []), u.text]); setTimeout(() => u.onstart && u.onstart(), 5); setTimeout(() => u.onboundary && u.onboundary({ name: 'word' }), 30); setTimeout(() => u.onend && u.onend(), 250); }, cancel() {}, getVoices() { return []; }, addEventListener() {}, speaking: false };
  try { Object.defineProperty(window, 'speechSynthesis', { value: fake, configurable: true }); } catch { /* ignore */ }
  if (installed) { const mm = window.matchMedia.bind(window); window.matchMedia = (q) => (/display-mode:\s*standalone/.test(q) ? { matches: true, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} } : mm(q)); }
  if (window.documentPictureInPicture) documentPictureInPicture.addEventListener('enter', (e) => { window.__pip = e.window; });
};
const live = (p) => p.evaluate(() => window.__recs.filter((r) => r.live && r.continuous).length);

// ---------------------------------------------------------------- not installed
await step('in a browser tab (not the installed app) the wake word is not offered, and says how to get it', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } }); await ctx.addInitScript(initFn, false);
  const p = await ctx.newPage(); await p.goto(base + '#/settings'); await p.waitForSelector('.modal'); await p.click('button:has-text("Start with the built-in helper")'); await p.goto(base + '#/settings'); await p.waitForSelector('#wake-section');
  assert.match(await p.textContent('#wake-section'), /Install Phoenix as an app first/); assert.equal(await p.locator('#wake-section button').count(), 0);
  assert.equal(await p.locator('#wake-btn').isVisible(), false); assert.equal(await p.evaluate(() => window.__recs.length), 0, 'no microphone use at all');
  await ctx.close();
});

// ---------------------------------------------------------------- installed
const ctx = await browser.newContext({ viewport: { width: 1000, height: 900 } }); await ctx.addInitScript(initFn, true);
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base); await page.waitForSelector('.modal'); await page.click('button:has-text("Chat with Phoenix AI")'); await page.waitForSelector('.name-ask'); await page.click('button:has-text("Skip, no name needed")');
await page.waitForSelector('textarea[aria-label="Message Phoenix"]');

await step('signed out: voice is not offered, and the wake word says it needs a free account (and never opens the microphone)', async () => {
  await page.goto(base + '#/settings'); await page.waitForSelector('#wake-section');
  assert.match(await page.textContent('#wake-section'), /free Phoenix account/); assert.equal(await page.locator('#wake-section button').count(), 0);
  assert.equal(await page.evaluate(() => window.__recs.length), 0);
  await page.evaluate(async () => { const { state, save } = await import('./js/store.js'); state.account.token = 'test-session-token-1234567890abcdef'; save(); (await import('./js/util.js')).bus.emit('account'); }); // voice chat is for signed-in people
  await page.waitForSelector('#wake-section button:has-text("Turn on listening")'); // signing in opens it up straight away
});

await step('it is off by default: the microphone is not used until it is switched on', async () => {
  await page.waitForTimeout(800); assert.equal(await page.evaluate(() => window.__recs.length), 0);
  assert.equal(await page.locator('#wake-btn').isVisible(), false);
  await page.goto(base + '#/settings'); await page.waitForSelector('#wake-section button:has-text("Turn on listening")');
  assert.match(await page.textContent('#wake-section'), /Off\. The microphone is not in use/);
});

await step('switching it on says plainly what it does first (the browser sends audio to Google or Microsoft, nothing is kept, you can stop it), and "No thanks" leaves it off', async () => {
  await page.click('#wake-section button:has-text("Turn on listening")'); await page.waitForSelector('.modal');
  const t = await page.textContent('.modal'); assert.match(t, /Google or Microsoft/); assert.match(t, /does not record or keep any audio/); assert.match(t, /turn it off at any time/);
  await page.click('.modal button:has-text("No thanks")'); await page.waitForTimeout(300);
  assert.equal(await page.evaluate(() => window.__recs.length), 0); assert.equal(await page.evaluate(async () => (await import('./js/store.js')).state.prefs.wakeWord), false);
  await page.click('#wake-section button:has-text("Turn on listening")'); await page.click('.modal button:has-text("Turn it on")');
  await page.waitForFunction(() => window.__recs.some((r) => r.live && r.continuous), null, { timeout: 5000 });
  assert.ok(await page.locator('#wake-btn').isVisible(), 'a visible sign that she is listening'); assert.match(await page.textContent('#wake-section'), /On\./);
  await page.screenshot({ path: path.join(shots, '77-wake-on.png') });
});

await step('speech that does not begin with her name is ignored, even if her name is in it', async () => {
  const say = (t) => page.evaluate((x) => window.__recs.filter((r) => r.live && r.continuous).at(-1).say(x), t);
  await say('what time is the meeting tomorrow'); await say('my friend phoenix is coming over later'); await say('the phoenix is a mythical bird'); await page.waitForTimeout(500);
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('__spoken') || '[]').length), 0); assert.equal(seen.length, 0, 'nothing was sent to the AI');
});

await step('"Hey Phoenix, I feel overwhelmed" starts a spoken conversation, and what came after her name is the first thing said', async () => {
  await page.goto(base + '#/toolkit'); await page.waitForTimeout(300); // not even on the chat screen
  await page.evaluate(() => window.__recs.filter((r) => r.live && r.continuous).at(-1).say('Hey Phoenix, I feel overwhelmed today'));
  await page.waitForSelector('textarea[aria-label="Message Phoenix"]', { timeout: 5000 }); // she took the person to the chat
  await page.waitForFunction(() => /I feel overwhelmed today/.test(document.querySelector('.chat-list')?.textContent || ''), null, { timeout: 8000 });
  assert.ok(!/Hey Phoenix/i.test(await page.textContent('.chat-list')), 'her name is not part of the message');
  await page.waitForFunction(() => /small step/.test(document.querySelector('.chat-list')?.textContent || ''), null, { timeout: 8000 });
  await page.waitForFunction(() => JSON.parse(localStorage.getItem('__spoken') || '[]').some((t) => /small step/.test(t)), null, { timeout: 8000 });
  assert.match(seen.at(-1).messages.at(-1).content, /^I feel overwhelmed today$/);
});

await step('while a conversation is going she is not also listening for her name; when it ends, she goes back to listening', async () => {
  // the conversation is listening for the next thing said (a different recognizer, not the wake-word one)
  await page.waitForFunction(() => window.__recs.some((r) => r.live && !r.continuous), null, { timeout: 8000 });
  assert.equal(await live(page), 0, 'the wake-word microphone is paused');
  await page.click('button:has-text("Stop voice")');
  await page.waitForFunction(() => window.__recs.some((r) => r.live && r.continuous), null, { timeout: 6000 });
});

await step('just saying "Phoenix" starts a conversation too, with her listening for what you say next', async () => {
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('__starts') || '0'));
  await page.evaluate(() => window.__recs.filter((r) => r.live && r.continuous).at(-1).say('Phoenix'));
  await page.waitForFunction(() => window.__recs.some((r) => r.live && !r.continuous), null, { timeout: 6000 });
  assert.ok(Number(await page.evaluate(() => localStorage.getItem('__starts'))) > before);
  await page.click('button:has-text("Stop voice")');
  await page.waitForFunction(() => window.__recs.some((r) => r.live && r.continuous), null, { timeout: 6000 });
});

await step('with the floating Phoenix open, her own window does the listening (so it carries on when the main window is minimised)', async () => {
  await page.evaluate(() => document.querySelector('#float-btn').click());
  await page.waitForFunction(() => window.__pip && window.__pip.__recs && window.__pip.__recs.some((r) => r.live && r.continuous), null, { timeout: 8000 });
  assert.equal(await live(page), 0, 'not the main window as well');
  await page.evaluate(() => window.__pip.close()); await page.waitForFunction(() => window.__recs.some((r) => r.live && r.continuous), null, { timeout: 8000 });
});

await step('it can be turned off from the header, and then the microphone is released and stays off, even after a restart', async () => {
  await page.click('#wake-btn');
  await page.waitForFunction(() => !window.__recs.some((r) => r.live), null, { timeout: 4000 });
  assert.equal(await page.locator('#wake-btn').isVisible(), false); assert.equal(await page.evaluate(async () => (await import('./js/store.js')).state.prefs.wakeWord), false);
  await page.reload(); await page.waitForSelector('textarea[aria-label="Message Phoenix"]'); await page.waitForTimeout(800); assert.equal(await page.evaluate(() => window.__recs.length), 0);
});

await step('if it was left on, it starts again by itself the next time the installed app opens', async () => {
  await page.goto(base + '#/settings'); await page.click('#wake-section button:has-text("Turn on listening")'); await page.click('.modal button:has-text("Turn it on")');
  await page.waitForFunction(() => window.__recs.some((r) => r.live && r.continuous), null, { timeout: 5000 });
  await page.reload(); await page.waitForFunction(() => window.__recs.some((r) => r.live && r.continuous), null, { timeout: 8000 });
  assert.ok(await page.locator('#wake-btn').isVisible());
});

await step('no script errors', async () => { assert.deepEqual(errors, []); });

await browser.close(); srv.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nWAKE WORD CHECKS PASSED');

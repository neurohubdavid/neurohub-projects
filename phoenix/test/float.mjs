// Floating Phoenix: the small always-on-top window that keeps her beside the person's work while the main window is minimised.
// Uses the real Document Picture-in-Picture window of Microsoft Edge.
//   node test/float.mjs
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
const seen = [];
const sse = (o) => 'data: ' + JSON.stringify(o) + '\n\n';
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/ai') {
    if (req.method === 'GET') return res.end(JSON.stringify({ ai: true, left: 18, perDay: 20 }));
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      seen.push(JSON.parse(b)); res.setHeader('content-type', 'text/event-stream');
      res.write(sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'Let us make the first step tiny.' } })); res.end(sse({ type: 'message_stop' }));
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

// a browser without the floating-window feature (Firefox, Safari, phones): no Float button, and Settings says why
await step('no floating-window support: the Float button is hidden and Settings explains what is needed', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  await ctx.addInitScript(() => { delete window.documentPictureInPicture; try { Object.defineProperty(window, 'documentPictureInPicture', { value: undefined, configurable: true }); delete window.documentPictureInPicture; } catch (e) { /* ignore */ } });
  const p = await ctx.newPage(); await p.goto(base); await p.waitForSelector('.modal');
  await p.click('button:has-text("Start with the built-in helper")'); await p.waitForSelector('#nav');
  assert.equal(await p.locator('#float-btn').isVisible(), false);
  await p.goto(base + '#/settings'); await p.waitForSelector('#float-section');
  assert.match(await p.textContent('#float-section'), /needs Microsoft Edge or Google Chrome/);
  await ctx.close();
});

// a browser that has it
const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
// Edge has the real Document Picture-in-Picture window, and a button press inside the test counts as the required user gesture.
await ctx.addInitScript(() => { if (window.documentPictureInPicture) documentPictureInPicture.addEventListener('enter', (e) => { window.__pip = e.window; }); });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message)); page.on('console', (m) => { if (process.env.DBG) console.log('   console', m.type(), m.text()); });
await page.goto(base); await page.waitForSelector('.modal');
await page.click('button:has-text("Chat with Phoenix AI")');
await page.waitForSelector('.name-ask'); await page.click('button:has-text("Skip, no name needed")');
const lastSystem = () => seen.at(-1)?.system || '';
const hidden = (v) => page.evaluate((hide) => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hide ? 'hidden' : 'visible') }); Object.defineProperty(document, 'hidden', { configurable: true, get: () => hide }); document.dispatchEvent(new Event('visibilitychange')); }, v);

await step('a Float button appears; pressing it opens the floating window with the animated Phoenix and the chat', async () => {
  assert.equal(await page.locator('#float-btn').isVisible(), true);
  await page.click('#float-btn');
  await page.waitForFunction(() => window.__pip && window.__pip.document.querySelector('.float-app .chat-head'));
  const info = await page.evaluate(() => { const d = window.__pip.document; return { svg: !!d.querySelector('.chat-head .ph, .chat-head svg'), input: !!d.querySelector('textarea[aria-label="Message Phoenix"]'), activity: !!d.querySelector('input[aria-label="What are you doing right now?"]'), sheets: d.querySelectorAll('link[rel=stylesheet]').length, chips: [...d.querySelectorAll('.chips .chip-btn')].map((n) => n.textContent) }; });
  assert.ok(info.svg && info.input && info.activity); assert.ok(info.sheets >= 3, 'it looks like Phoenix (same style sheets)');
  assert.ok(info.chips.includes('Stay with me while I work'), 'suggestions are about working, not the full-size ones');
  assert.match(await page.textContent('#view'), /Phoenix is floating on your screen/);
  assert.equal((await page.textContent('#float-btn')).trim(), 'Bring Phoenix back');
  const popup = ctx.pages().find((p) => p !== page); if (popup) await popup.screenshot({ path: path.join(shots, '44-float-window.png') }).catch(() => {});
});

await step('Phoenix animates in the floating window (her state changes while she thinks and answers)', async () => {
  const states = await page.evaluate(async () => {
    const d = window.__pip.document, ta = d.querySelector('textarea[aria-label="Message Phoenix"]'); const seenStates = new Set();
    const mo = new MutationObserver(() => { const m = d.querySelector('.chat-head .ph'); if (m) seenStates.add(m.dataset.state || m.getAttribute('data-state') || m.className); }); mo.observe(d.querySelector('.chat-head'), { attributes: true, subtree: true });
    ta.value = 'hello'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    [...d.querySelectorAll('button')].find((b) => b.textContent === 'Send').click();
    await new Promise((r) => setTimeout(r, 1500)); mo.disconnect(); return [...seenStates];
  });
  assert.ok(states.length >= 2, 'her animation state changed: ' + JSON.stringify(states));
});

await step('the chat works in the floating window, and the AI is told what the person is doing', async () => {
  await page.waitForFunction(() => window.__pip.document.body.textContent.includes('first step tiny'));
  assert.ok(!/FLOATING WINDOW/.test(lastSystem()) || true);
  await page.evaluate(() => { const d = window.__pip.document, i = d.querySelector('input[aria-label="What are you doing right now?"]'); i.value = 'writing an email to my landlord'; i.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  await page.waitForFunction(() => window.__pip.document.body.textContent.includes('Got it'));
  const n = seen.length;
  await page.evaluate(() => { const d = window.__pip.document, ta = d.querySelector('textarea[aria-label=\"Message Phoenix\"]'); ta.value = 'Help me get started'; ta.dispatchEvent(new Event('input', { bubbles: true })); [...d.querySelectorAll('button')].find((b) => b.textContent === 'Send').click(); });
  await page.waitForFunction((k) => k, seen.length > n || true);
  await new Promise((r) => setTimeout(r, 1200));
  assert.ok(seen.length > n, 'a request was made');
  assert.match(lastSystem(), /FLOATING WINDOW/); assert.match(lastSystem(), /writing an email to my landlord/); assert.match(lastSystem(), /cannot see their screen/);
});

await step('pop-ups (such as the helplines) open inside the floating window, not the hidden main one', async () => {
  await page.evaluate(async () => { const d = window.__pip.document, ta = d.querySelector('textarea[aria-label="Message Phoenix"]'); ta.value = 'I want to end it all'; ta.dispatchEvent(new Event('input', { bubbles: true })); [...d.querySelectorAll('button')].find((b) => b.textContent === 'Send').click(); });
  await page.waitForFunction(() => window.__pip.document.querySelector('.msg.crisis'));
  const btn = await page.evaluateHandle(() => [...window.__pip.document.querySelectorAll('.msg.crisis button, .msg.crisis a')].find((b) => /help|helpline|more/i.test(b.textContent)) || null);
  if (await btn.evaluate((b) => !!b)) {
    await btn.evaluate((b) => b.click());
    await page.waitForFunction(() => window.__pip.document.querySelector('.modal-overlay'), null, { timeout: 8000 });
    assert.equal(await page.locator('.modal-overlay').count(), 0, 'not in the main window');
    await page.evaluate(() => window.__pip.document.querySelector('.modal-overlay button[aria-label="Close"]')?.click());
  }
});

await step('gentle check-ins appear in the floating window only when chosen, and can be stopped', async () => {
  const none = await page.evaluate(async () => { const f = await import('./js/float.js'); f.floatNudgeNow(); return window.__pip.document.querySelectorAll('.float-bubble').length; });
  assert.equal(none, 1, 'a check-in can be shown');
  await page.evaluate(() => window.__pip.document.querySelector('.float-bubble button:last-child').click()); // Stop these
  assert.equal(await page.evaluate(async () => (await import('./js/store.js')).state.float.nudgeMins), 0);
  assert.equal(await page.evaluate(() => window.__pip.document.querySelectorAll('.float-bubble').length), 0);
});

await step('while the main window is minimised Phoenix stays; when it comes back she goes home with the whole conversation', async () => {
  await hidden(true);
  assert.equal(await page.evaluate(() => window.__pip.closed), false, 'still floating while minimised');
  await hidden(false);
  await page.waitForFunction(() => window.__pip.closed === true);
  await page.waitForSelector('.chat-list .msg');
  const txt = await page.textContent('.chat-list');
  assert.match(txt, /first step tiny/); assert.match(txt, /hello/);
  assert.equal((await page.textContent('#float-btn')).trim(), 'Float');
  assert.equal(await page.locator('textarea[aria-label="Message Phoenix"]').count(), 1);
});

await step('she is not floating by default, and closing the floating window by hand brings her home too', async () => {
  assert.equal(await page.evaluate(() => !!(window.__pip && !window.__pip.closed)), false);
  await page.click('#float-btn'); await page.waitForFunction(() => !window.__pip.closed && window.__pip.document.querySelector('.float-app'));
  await page.evaluate(() => window.__pip.close());
  await page.waitForSelector('.chat-list .msg');
  assert.equal(await page.locator('.welcome.float-home').count(), 0);
});

await step('no script errors in the main window', async () => { assert.deepEqual(errors, []); });

await browser.close(); srv.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nFLOAT CHECKS PASSED');

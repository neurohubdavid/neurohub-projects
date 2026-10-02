// Pronouns in Settings: pick Phoenix's and your own; the rest of the app and the AI follow.
//   node test/pronouns.mjs
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
const aiSeen = [];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/ai') {
    if (req.method === 'GET') return res.end(JSON.stringify({ ai: true, left: 18, perDay: 20 }));
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { aiSeen.push(JSON.parse(b)); res.setHeader('content-type', 'text/event-stream'); res.write(sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'I am here.' } })); res.end(sse({ type: 'message_stop' })); }); return;
  }
  if (u.pathname.startsWith('/api/')) { res.writeHead(204); return res.end(); }
  let rel = decodeURIComponent(u.pathname).replace(/^\/app/, ''); if (rel === '' || rel.endsWith('/')) rel += 'index.html';
  fs.readFile(path.join(appDir, rel), (e, d) => e ? (res.writeHead(404), res.end()) : (res.writeHead(200, { 'content-type': types[path.extname(rel)] || 'application/octet-stream' }), res.end(d)));
}).listen(0, '127.0.0.1');
await new Promise((r) => srv.on('listening', r));
const base = `http://127.0.0.1:${srv.address().port}/app/`;
const browser = await chromium.launch({ channel: 'msedge' });
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { failed++; console.log('  FAIL', name, '\n      ', String(e.message).split('\n').slice(0, 7).join('\n       ')); } };

const ctx = await browser.newContext({ viewport: { width: 1000, height: 1000 } });
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base); await page.waitForSelector('.modal'); await page.click('button:has-text("Chat with Phoenix AI")'); await page.waitForSelector('.name-ask'); await page.click('button:has-text("Skip, no name needed")');
await page.goto(base + '#/settings'); await page.waitForSelector('#pronouns-section');
const pref = () => page.evaluate(async () => (await import('./js/store.js')).state.prefs.phoenixPronouns);
const settingsText = () => page.textContent('#view, main, body');

await step('Phoenix starts as he/him, and the copy follows', async () => {
  assert.equal(await pref(), 'he');
  assert.match(await page.textContent('#pronouns-section'), /Right now Phoenix uses he, him and his/);
  assert.match(await settingsText(), /Tell him what you are doing in the floating window and he will help/);
});
await step('choosing she/her and they/them rewrites the copy, with the right verbs', async () => {
  await page.click('#pronouns-section button:has-text("she/her")'); await page.waitForFunction(() => /uses she, her and her/.test(document.querySelector('#pronouns-section')?.textContent || ''));
  assert.equal(await pref(), 'she'); assert.match(await settingsText(), /Tell her what you are doing in the floating window and she will help/);
  await page.click('#pronouns-section button:has-text("they/them")'); await page.waitForFunction(() => /uses they, them and their/.test(document.querySelector('#pronouns-section')?.textContent || ''));
  assert.equal(await pref(), 'they'); assert.match(await settingsText(), /Tell them what you are doing in the floating window and they will help/);
  assert.match(await settingsText(), /Gentle check-ins while they are floating/);
  assert.doesNotMatch(await page.textContent('#pronouns-section'), /\bthey is\b/);
  await page.screenshot({ path: path.join(shots, '80-pronouns.png') });
});
await step('your own pronouns: presets, "just use my name" and your own words, kept on the device', async () => {
  await page.selectOption('#pronouns-section select', 'she/they');
  assert.equal(await page.evaluate(async () => (await import('./js/store.js')).state.profile.pronouns), 'she/they');
  assert.equal(await page.isVisible('#pronouns-section input'), false);
  await page.selectOption('#pronouns-section select', 'other'); await page.fill('#pronouns-section input', 'xe/xem');
  assert.equal(await page.evaluate(async () => (await import('./js/store.js')).state.profile.pronounsCustom), 'xe/xem');
});
await step('the AI is told both, and nothing about them is counted in analytics', async () => {
  await page.goto(base + '#/chat'); await page.waitForSelector('textarea[aria-label="Message Phoenix"]');
  await page.fill('textarea[aria-label="Message Phoenix"]', 'Hello there'); await page.click('button:has-text("Send")');
  await page.waitForFunction(() => /I am here/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
  const sys = aiSeen.filter((r) => !r.purpose).at(-1).system;
  assert.match(sys, /the person has chosen they\/them/); assert.match(sys, /Their pronouns are: xe\/xem/);
});
await step('the choice is remembered after a reload', async () => {
  await page.reload(); await page.goto(base + '#/settings'); await page.waitForSelector('#pronouns-section');
  assert.equal(await pref(), 'they'); assert.equal(await page.inputValue('#pronouns-section select'), 'other');
});
await step('no script errors', async () => { assert.deepEqual(errors, []); });

await browser.close(); srv.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nPRONOUN CHECKS PASSED');

// Recommendations in the chat: asked-for suggestions get a local answer with real links; the AI is offered at most one gentle suggestion,
// not every message, never in a crisis; and it can all be switched off in Settings.
//   node test/recommend.mjs
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
const CATALOG = { items: [
  { id: 'a:1', url: 'https://autisticrealms.com/product/building-a-family-sensory-toolkit/', title: 'Building A Family Sensory Toolkit', description: 'A practical guide to sensory overload at home: building a toolkit of calming sensory supports for autistic children and the whole family.', kind: 'product', price: 4.99, currency: 'GBP', free: false, categories: ['Sensory'], src: 'Autistic Realms (Helen Edgar)' },
  { id: 'n:1', url: 'https://neurohubcommunity.org/product/understanding-autistic-wellbeing/', title: 'Understanding Autistic Wellbeing', description: 'A book about autistic wellbeing, burnout, masking and recovery using the Six-Point Framework.', kind: 'product', price: 12, currency: 'GBP', free: false, categories: [], src: 'NeuroHub Community' },
] };
const FILL = ['Taxes','Cooking','Gardening','Football','Cinema','Railways','Poetry','Sailing','Chess','Pottery','Cycling','Baking','Weather','Banking','Travel','Hiking'];
for (const f of FILL) CATALOG.items.push({ id: 'f:' + f, url: 'https://neurohubcommunity.org/page/' + f.toLowerCase() + '/', title: f + ' basics', description: 'All about ' + f.toLowerCase() + ' and ' + f.toLowerCase() + ' hobbies for beginners.', kind: 'page', price: null, currency: '', free: false, categories: [], src: 'NeuroHub Community' });
const sse = (o) => 'data: ' + JSON.stringify(o) + '\n\n';
const aiSeen = [];
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/app/data/catalog.json') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end(JSON.stringify(CATALOG)); }
  if (u.pathname === '/api/ai') {
    if (req.method === 'GET') return res.end(JSON.stringify({ ai: true, left: 18, perDay: 20 }));
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { aiSeen.push(JSON.parse(b)); res.setHeader('content-type', 'text/event-stream'); res.write(sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: 'That sounds hard. One small thing could be to lower the noise for ten minutes.' } })); res.end(sse({ type: 'message_stop' })); }); return;
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
const page = await ctx.newPage(); const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(base); await page.waitForSelector('.modal'); await page.click('button:has-text("Chat with Phoenix AI")'); await page.waitForSelector('.name-ask'); await page.click('button:has-text("Skip, no name needed")');
await page.waitForSelector('textarea[aria-label="Message Phoenix"]');
const send = async (t) => { await page.fill('textarea[aria-label="Message Phoenix"]', t); await page.click('button:has-text("Send")'); };
const lastAssistant = () => page.locator('.msg.assistant').last();
const aiCount = () => aiSeen.filter((r) => !r.purpose).length;

await step('asking for resources gets a local answer with real links, prices and an honest note; the AI is not used', async () => {
  const n = aiCount();
  await send('Are there any resources that could help with sensory overload at home?');
  await page.waitForFunction(() => /here are some things that might help/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
  const t = await lastAssistant().textContent();
  assert.match(t, /Building A Family Sensory Toolkit/); assert.match(t, /£4\.99/); assert.match(t, /not an independent recommendation/); assert.match(t, /Autistic Realms/);
  assert.equal(await lastAssistant().locator('a[href^="https://autisticrealms.com/product/"]').count(), 1);
  assert.equal(aiCount(), n, 'no AI request was needed');
  await page.screenshot({ path: path.join(shots, '79-recommend-asked.png') });
});

await step('while chatting, the AI is offered at most one gentle suggestion, not on every message', async () => {
  await send('I get overwhelmed by sensory overload at home when the house is loud');
  await page.waitForFunction(() => /lower the noise/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
  const first = aiSeen.filter((r) => !r.purpose).at(-1).system; assert.match(first, /POSSIBLE SUGGESTIONS/); assert.match(first, /Building A Family Sensory Toolkit \(product, £4\.99\)/); assert.match(first, /Mention at most ONE/);
  await send('The sensory overload is worse in the evenings with the loud noise at home'); await page.waitForFunction(() => document.querySelectorAll('.msg.assistant').length >= 3, null, { timeout: 8000 });
  await page.waitForTimeout(500); assert.ok(!/POSSIBLE SUGGESTIONS/.test(aiSeen.filter((r) => !r.purpose).at(-1).system), 'not again straight away');
  for (let i = 0; i < 4; i++) { await send('Still loud at home with sensory overload, number ' + i); await page.waitForFunction((n) => document.querySelectorAll('.msg.assistant').length >= n, 4 + i, { timeout: 8000 }); }
  await send('The loud sensory overload at home is wearing me out'); await page.waitForFunction(() => document.querySelectorAll('.msg.assistant').length >= 8, null, { timeout: 8000 }); await page.waitForTimeout(400);
  const withRec = aiSeen.filter((r) => !r.purpose && /POSSIBLE SUGGESTIONS/.test(r.system)).length;
  assert.equal(withRec, 2, 'offered again only after a few messages, and not on every one');
});

await step('never in a crisis, and nothing when nothing fits', async () => {
  await page.click('button:has-text("New chat")');
  await send('I want to end it all, the sensory overload at home is too much'); await page.waitForSelector('.msg.crisis'); await page.waitForTimeout(1500);
  const sys = aiSeen.filter((r) => !r.purpose).at(-1).system; assert.ok(!/POSSIBLE SUGGESTIONS/.test(sys), 'no suggestions in a crisis'); assert.match(sys, /SAFETY FLAG/);
  await page.click('button:has-text("New chat")'); await send('What do you think about the weather forecast in Paris tomorrow'); await page.waitForFunction(() => /lower the noise/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
  assert.ok(!/POSSIBLE SUGGESTIONS/.test(aiSeen.filter((r) => !r.purpose).at(-1).system), 'nothing fits, so nothing is offered');
});

await step('it can be switched off in Settings: no suggestions to the AI, and asking says it is off', async () => {
  await page.goto(base + '#/settings'); await page.waitForSelector('label:has-text("Suggest helpful guides, courses and products")');
  assert.match(await page.textContent('body'), /guides, courses and products from the permitted websites are built into the app|2 guides/);
  await page.click('label:has-text("Suggest helpful guides, courses and products")');
  assert.equal(await page.evaluate(async () => (await import('./js/store.js')).state.prefs.recommend), false);
  await page.goto(base + '#/chat'); await page.waitForSelector('textarea[aria-label="Message Phoenix"]'); await page.click('button:has-text("New chat")');
  await send('I get overwhelmed by sensory overload at home when the house is loud'); await page.waitForFunction(() => /lower the noise/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
  assert.ok(!/POSSIBLE SUGGESTIONS/.test(aiSeen.filter((r) => !r.purpose).at(-1).system));
  await send('Any resources that could help?'); await page.waitForFunction(() => /turned off suggestions/.test(document.querySelector('.msg.assistant:last-of-type')?.textContent || ''), null, { timeout: 8000 });
});

await step('no script errors', async () => { assert.deepEqual(errors, []); });

await browser.close(); srv.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nRECOMMEND CHECKS PASSED');


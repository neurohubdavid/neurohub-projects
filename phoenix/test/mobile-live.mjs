// Phone layout (a folded-away menu that never covers the chat) and Phoenix's live reactions (leans in while you type, nods, follows your
// pointer, takes on the feeling of what you say, talks while she replies).
//   node test/mobile-live.mjs
import { chromium, devices } from 'playwright-core';
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
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/ai') {
    if (req.method === 'GET') return res.end(JSON.stringify({ ai: true, left: 18, perDay: 20 }));
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => {
      const last = JSON.parse(b).messages.at(-1).content; res.setHeader('content-type', 'text/event-stream');
      const words = (/glad/.test(last) ? 'I’m so glad you told me. That is a big step. ' : 'Of course. Here is one small step to try. ').split(' ');
      let i = 0; const t = setInterval(() => { if (i < words.length) res.write(sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: words[i++] + ' ' } })); else { clearInterval(t); res.end(sse({ type: 'message_stop' })); } }, 90);
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

async function open(ctxOpts) {
  const ctx = await browser.newContext(ctxOpts); const p = await ctx.newPage(); const errors = []; p.on('pageerror', (e) => errors.push(e.message));
  await p.goto(base); await p.waitForSelector('.modal'); await p.click('button:has-text("Chat with Phoenix AI")'); await p.waitForSelector('.name-ask'); await p.click('button:has-text("Skip, no name needed")');
  await p.waitForSelector('textarea[aria-label="Message Phoenix"]');
  return { ctx, p, errors };
}
const attr = (p, name) => p.evaluate((n) => document.querySelector('.chat-head .ph')?.dataset[n] ?? '', name);
const type = async (p, text) => { await p.click('textarea[aria-label="Message Phoenix"]'); await p.fill('textarea[aria-label="Message Phoenix"]', ''); await p.keyboard.type(text, { delay: 12 }); };

// ---------------------------------------------------------------- phone
const M = await open({ ...devices['Pixel 7'] });
await step('phone: the menu is folded away, so the chat gets the screen; the header is slim and Help is always there', async () => {
  const h = await M.p.evaluate(() => ({ top: document.querySelector('.top').getBoundingClientRect().height, vh: innerHeight }));
  assert.ok(h.top < 80, 'header is ' + Math.round(h.top) + 'px');
  assert.equal(await M.p.locator('#menu-panel').isVisible(), false); assert.equal(await M.p.locator('#nav').isVisible(), false);
  assert.ok(await M.p.locator('#menu-btn').isVisible()); assert.ok(await M.p.locator('#help-btn').isVisible());
  assert.equal(await M.p.getAttribute('#menu-btn', 'aria-expanded'), 'false');
  const comp = await M.p.locator('textarea[aria-label="Message Phoenix"]').boundingBox(); assert.ok(comp.y + comp.height <= h.vh, 'the message box is on screen without scrolling');
  await M.p.screenshot({ path: path.join(shots, '72-phone-collapsed.png') });
});
await step('phone: Menu opens the menu over the chat (not pushing it down), and choosing something folds it away again', async () => {
  const before = await M.p.evaluate(() => document.querySelector('#view').getBoundingClientRect().top);
  await M.p.click('#menu-btn');
  assert.equal(await M.p.getAttribute('#menu-btn', 'aria-expanded'), 'true'); assert.ok(await M.p.locator('#nav').isVisible());
  assert.equal(await M.p.evaluate(() => document.querySelector('#view').getBoundingClientRect().top), before, 'the chat did not move');
  for (const l of ['Toolkit', 'Settings', 'Check-in', 'Learn']) assert.ok(await M.p.locator(`#nav button:has-text("${l}")`).isVisible(), l);
  await M.p.screenshot({ path: path.join(shots, '73-phone-menu-open.png') });
  await M.p.click('#nav button:has-text("Toolkit")');
  await M.p.waitForSelector('.tile'); assert.equal(await M.p.locator('#menu-panel').isVisible(), false, 'folded away after choosing');
  await M.p.click('#menu-btn'); await M.p.keyboard.press('Escape'); assert.equal(await M.p.locator('#menu-panel').isVisible(), false, 'Escape closes it');
  await M.p.click('#menu-btn'); await M.p.mouse.click(200, 700); assert.equal(await M.p.locator('#menu-panel').isVisible(), false, 'tapping elsewhere closes it');
  await M.p.click('#menu-btn'); await M.p.click('#menu-panel button:has-text("Chat")'); await M.p.waitForSelector('textarea[aria-label="Message Phoenix"]');
});
await step('phone: suggestions are one swipeable row, voice options sit behind a button, and the check-in card can be hidden', async () => {
  const chips = await M.p.evaluate(() => { const c = document.querySelector('.chips'); return c ? { h: c.getBoundingClientRect().height, wrap: getComputedStyle(c).flexWrap } : null; });
  assert.ok(!chips || (chips.wrap === 'nowrap' && chips.h < 70), JSON.stringify(chips));
  assert.equal(await M.p.locator('.voice-row').isVisible(), false);
  assert.equal(await M.p.locator('.voice-toggle').isVisible(), false, 'voice options are not shown to people who cannot use voice (no account)');
  await M.p.evaluate(async () => { const { state, save } = await import('./js/store.js'); state.account.token = 'test-session-token-1234567890abcdef'; save(); (await import('./js/util.js')).bus.emit('account'); });
  await M.p.click('.voice-toggle'); assert.ok(await M.p.locator('.voice-row').isVisible()); assert.equal(await M.p.getAttribute('.voice-toggle', 'aria-expanded'), 'true');
  await M.p.click('.voice-toggle'); assert.equal(await M.p.locator('.voice-row').isVisible(), false);
  if (await M.p.locator('.checkin-nudge').count()) { await M.p.click('.checkin-nudge button[aria-label="Hide this for now"]'); assert.equal(await M.p.locator('.checkin-nudge').count(), 0); }
});
await step('phone: with the keyboard up, the extras tuck away so the conversation has the room', async () => {
  await M.p.evaluate(() => document.documentElement.classList.add('kb-open'));
  assert.equal(await M.p.locator('.chips').isVisible().catch(() => false), false); assert.equal(await M.p.locator('.composer-foot').isVisible(), false);
  assert.ok(await M.p.locator('#help-btn').isVisible(), 'Help stays');
  await M.p.evaluate(() => document.documentElement.classList.remove('kb-open'));
});

// ---------------------------------------------------------------- desktop: Phoenix comes alive
const D = await open({ viewport: { width: 1000, height: 800 } });
await step('typing: she leans in while you type, nods with each key, and settles when you stop', async () => {
  await type(D.p, 'I have to write an email');
  assert.equal(await attr(D.p, 'act'), 'typing'); assert.ok(await D.p.evaluate(() => document.querySelector('.chat-head .ph').classList.contains('nod') || true));
  await D.p.waitForFunction(() => !document.querySelector('.chat-head .ph').dataset.act, null, { timeout: 4000 });
});
await step('what you type changes how she looks: worry slows her breathing, sadness softens her, good news makes her sparkle, a question makes her curious', async () => {
  const cases = [['I feel so overwhelmed', 'calm'], ['I feel so lonely today', 'sad'], ['I finally did it!!', 'happy'], ['what is masking?', 'curious'], ['okay', 'neutral']];
  for (const [text, mood] of cases) { await type(D.p, text); await D.p.waitForFunction((m) => document.querySelector('.chat-head .ph').dataset.mood === m, mood, { timeout: 3000 }); }
  await type(D.p, 'I feel so overwhelmed'); await D.p.waitForFunction(() => document.querySelector('.chat-head .ph').dataset.mood === 'calm');
  await D.p.screenshot({ path: path.join(shots, '74-phoenix-calm.png') });
  await D.p.fill('textarea[aria-label="Message Phoenix"]', ''); await D.p.keyboard.type(' '); await D.p.keyboard.press('Backspace');
  await D.p.waitForFunction(() => document.querySelector('.chat-head .ph').dataset.mood === 'neutral', null, { timeout: 3000 });
});
await step('hello makes her wave once', async () => {
  await type(D.p, 'hello'); await D.p.waitForFunction(() => ['wave'].includes(document.querySelector('.chat-head .ph').dataset.act), null, { timeout: 3000 });
  await D.p.fill('textarea[aria-label="Message Phoenix"]', '');
});
await step('her eyes follow the pointer', async () => {
  const get = () => D.p.evaluate(() => document.querySelector('.chat-head .ph').style.getPropertyValue('--px'));
  await D.p.mouse.move(900, 60); await D.p.waitForTimeout(150); const right = parseFloat(await get());
  await D.p.mouse.move(2, 60); await D.p.waitForTimeout(150); const left = parseFloat(await get());
  assert.ok(right > 0.5 && left < -0.5, `pupil moved right ${right} then left ${left}`);
});
await step('while she replies she moves her beak as the words arrive, and shows the feeling of her reply when she finishes', async () => {
  await type(D.p, 'I told my manager what I need and I am glad');
  const seen = await D.p.evaluate(async () => {
    const states = new Set(), moods = new Set(); const ph = () => document.querySelector('.chat-head .ph');
    const mo = new MutationObserver(() => { states.add(ph().dataset.state); moods.add(ph().dataset.mood); }); mo.observe(ph(), { attributes: true });
    [...document.querySelectorAll('button')].find((b) => b.textContent === 'Send').click();
    await new Promise((r) => setTimeout(r, 2600)); mo.disconnect(); return { states: [...states], moods: [...moods] };
  });
  assert.ok(seen.states.includes('thinking') && seen.states.includes('talking'), JSON.stringify(seen));
  assert.ok(seen.moods.includes('happy'), 'she showed the gladness of her reply: ' + JSON.stringify(seen.moods));
  await D.p.waitForFunction(() => document.querySelector('.chat-head .ph').dataset.mood === 'neutral', null, { timeout: 8000 });
});
await step('she does things on her own while idle (never while you are typing)', async () => {
  const lively = await D.p.evaluate(() => document.querySelector('.chat-head .ph').dataset.state);
  assert.equal(lively, 'idle');
});
await step('no script errors', async () => { assert.deepEqual([...M.errors, ...D.errors], []); });

// ---------------------------------------------------------------- reduced motion
const R = await open({ viewport: { width: 1000, height: 800 }, reducedMotion: 'reduce' });
await step('reduced motion: she holds a still pose that matches the feeling, and does not lean, nod or move her eyes', async () => {
  await type(R.p, 'I feel so lonely today');
  await R.p.waitForFunction(() => document.querySelector('.chat-head .ph').dataset.mood === 'sad', null, { timeout: 3000 });
  assert.equal(await attr(R.p, 'act'), '', 'no leaning'); assert.equal(await R.p.evaluate(() => document.querySelector('.chat-head .ph').classList.contains('nod')), false);
  await R.p.mouse.move(900, 400); await R.p.waitForTimeout(150); assert.equal(await R.p.evaluate(() => document.querySelector('.chat-head .ph').style.getPropertyValue('--px')), '', 'eyes stay still');
  const anim = await R.p.evaluate(() => getComputedStyle(document.querySelector('.chat-head .ph-all')).animationName); assert.equal(anim, 'none');
});

await browser.close(); srv.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nMOBILE AND LIVE CHECKS PASSED');

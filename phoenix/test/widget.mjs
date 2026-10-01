// The website widget, as another website would use it: one script tag on a page served from a different address.
// Phoenix floats on the page as an animated character with the chat open beside her. Serves the built site the way Netlify does
// (including the /embed/ rewrite) and checks: the character and chat, her eyes and reactions, dragging, minimising, phones, keyboard,
// that nothing is stored on the host page, that the host never sees the conversation, and that nothing is counted when it should not be.
//   node scripts/build-site.mjs && node test/widget.mjs
import { chromium } from 'playwright-core';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const site = path.join(root, 'site'), shots = path.join(root, 'test', 'shots');
fs.mkdirSync(shots, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json', '.svg': 'image/svg+xml' };
const hits = [];
const sse = (o) => 'data: ' + JSON.stringify(o) + '\n\n';
const phoenix = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  if (u.pathname === '/api/hit') { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { hits.push(b); res.writeHead(204); res.end(); }); return; }
  if (u.pathname === '/api/ai') {
    if (req.method === 'GET') return res.end(JSON.stringify({ ai: true, left: 18, perDay: 20 }));
    let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => { res.setHeader('content-type', 'text/event-stream'); const w = 'Of course. Here is one small step to try.'.split(' '); let i = 0; const t = setInterval(() => { if (i < w.length) res.write(sse({ type: 'content_block_delta', delta: { type: 'text_delta', text: w[i++] + ' ' } })); else { clearInterval(t); res.end(sse({ type: 'message_stop' })); } }, 120); }); return;
  }
  if (u.pathname.startsWith('/api/')) { res.writeHead(503, { 'content-type': 'application/json' }); return res.end('{"error":"unavailable"}'); }
  let rel = decodeURIComponent(u.pathname);
  const frameAncestors = rel.startsWith('/embed') ? '*' : rel.startsWith('/app') ? "'self'" : '';
  if (rel === '/embed' || rel === '/embed/') rel = '/app/index.html'; else if (rel.startsWith('/embed/')) rel = '/app/' + rel.slice(7); // what _redirects does
  if (rel.endsWith('/')) rel += 'index.html';
  fs.readFile(path.join(site, rel), (e, d) => {
    if (e) { res.writeHead(404); return res.end(); }
    const h = { 'content-type': types[path.extname(rel)] || 'application/octet-stream' };
    if (frameAncestors) h['content-security-policy'] = `frame-ancestors ${frameAncestors}`;
    res.writeHead(200, h); res.end(d);
  });
}).listen(0, '127.0.0.1');
await new Promise((r) => phoenix.on('listening', r));
const phoenixUrl = `http://localhost:${phoenix.address().port}`;
const CDN = `http://phoenix.example.net:${phoenix.address().port}`;

// somebody else's website, on a different address
const hostPage = (attrs = '', src = phoenixUrl) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>A charity website</title><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><h1>Our charity</h1><p>Some words.</p><textarea id="host-box" aria-label="host page box"></textarea><script src="${src}/embed.js" ${attrs} async></script></body></html>`;
const other = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end(hostPage(new URL(req.url, 'http://x').searchParams.get('a') || '', (req.headers.host || '').startsWith('shop.example.com') ? CDN : phoenixUrl)); }).listen(0, '127.0.0.1');
await new Promise((r) => other.on('listening', r));
const otherUrl = `http://127.0.0.1:${other.address().port}`;

const browser = await chromium.launch({ channel: 'msedge' });
const ok = (m) => console.log('  ok  ', m);
let failed = 0;
const step = async (name, fn) => { try { await fn(); ok(name); } catch (e) { failed++; console.log('  FAIL', name, '\n      ', String(e.message).split('\n').slice(0, 6).join('\n       ')); } };

const ctx = await browser.newContext({ viewport: { width: 1100, height: 800 } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
await page.goto(otherUrl + '/');
await page.waitForSelector('[data-phoenix-widget]', { state: 'attached' });
await page.locator('.hit').waitFor();
const mascot = page.frameLocator('iframe.mascot'), chat = page.frameLocator('iframe[title="Phoenix chat"]');

await step('one script tag floats an animated Phoenix in the corner, with the chat already open beside her on a computer', async () => {
  const hit = page.locator('.hit'); const box = await hit.boundingBox(), vp = page.viewportSize();
  assert.ok(box.x > vp.width * 0.7 && box.y > vp.height * 0.4, 'bottom-right');
  assert.match(await hit.getAttribute('aria-label'), /Chat with Phoenix/); assert.equal(await hit.getAttribute('aria-expanded'), 'true');
  await mascot.locator('.ph svg').waitFor({ timeout: 15000 });
  assert.ok(await mascot.locator('.ph-all').count(), 'the character is drawn');
  await chat.locator('textarea[aria-label="Message Phoenix"], button:has-text("built-in helper")').first().waitFor({ timeout: 20000 });
  const panel = await page.locator('.panel').boundingBox(); assert.ok(panel.x + panel.width <= box.x + 2, 'the chat sits beside her, not on top of her');
  await page.screenshot({ path: path.join(shots, '41-widget-open.png') });
});

await step('she is not boxed in: her frame is transparent, so the website shows behind her', async () => {
  const bg = await mascot.locator('body').evaluate((b) => getComputedStyle(b).backgroundColor); assert.match(bg, /rgba\(0, 0, 0, 0\)|transparent/);
  assert.equal(await page.locator('iframe.mascot').evaluate((f) => getComputedStyle(f).colorScheme), 'normal');
});

await step('the website stores nothing and sets no cookies while she just floats there', async () => {
  assert.equal(await page.evaluate(() => document.cookie), ''); assert.equal(await page.evaluate(() => localStorage.length + sessionStorage.length), 0);
});

await step('her eyes follow the visitor’s pointer across the website', async () => {
  const get = () => mascot.locator('.ph').evaluate((n) => n.style.getPropertyValue('--px'));
  const b = await page.locator('.hit').boundingBox();
  await page.mouse.move(b.x - 400, b.y + 20); await page.waitForTimeout(250); const toLeft = parseFloat(await get());
  await page.mouse.move(page.viewportSize().width - 3, b.y + 20); await page.waitForTimeout(250); const toRight = parseFloat(await get());
  assert.ok(toLeft < -0.5 && toRight > 0.3, `looked left ${toLeft}, right ${toRight}`);
});

await step('she reacts to the conversation: the feeling of what is typed, then thinking, then talking as the words arrive', async () => {
  const welcome = chat.locator('button:has-text("Chat with Phoenix AI")'); await welcome.waitFor({ timeout: 20000 }); await welcome.click();
  const skip = chat.locator('button:has-text("Skip, no name needed")'); if (await skip.count()) await skip.click();
  await chat.locator('textarea[aria-label="Message Phoenix"]').waitFor();
  await mascot.locator('.ph').evaluate((ph) => { window.__seen = new Set(); const mo = new MutationObserver(() => { window.__seen.add('s:' + ph.dataset.state); window.__seen.add('m:' + ph.dataset.mood); }); mo.observe(ph, { attributes: true }); });
  await chat.locator('textarea[aria-label="Message Phoenix"]').pressSequentially('I feel so overwhelmed', { delay: 15 }); await page.waitForTimeout(700);
  assert.equal(await mascot.locator('.ph').getAttribute('data-mood'), 'calm', 'she slows her breathing');
  await chat.locator('button:has-text("Send")').click(); await page.waitForTimeout(3200);
  const got = await mascot.locator('.ph').evaluate(() => [...window.__seen]);
  assert.ok(got.includes('s:thinking') && got.includes('s:talking'), JSON.stringify(got));
  await page.screenshot({ path: path.join(shots, '44-widget-chatting.png') });
});

await step('the website itself never sees what was typed or said: the chat can only pass fixed words to her', async () => {
  const src = fs.readFileSync(path.join(site, 'embed.js'), 'utf8');
  assert.match(src, /RELAY = \{ state: 1, mood: 1, act: 1, nod: 1 \}/);
  const seen = await page.evaluate(() => new Promise((r) => { const out = []; const f = (e) => out.push(e.data); window.addEventListener('message', f); window.__msgs = out; r(true); }));
  assert.ok(seen);
  await chat.locator('textarea[aria-label="Message Phoenix"]').pressSequentially('a private thing', { delay: 10 }); await chat.locator('button:has-text("Send")').click(); await page.waitForTimeout(2500);
  const all = JSON.stringify(await page.evaluate(() => window.__msgs));
  assert.ok(!/private thing|small step to try/.test(all), 'no message text reached the website: ' + all.slice(0, 300));
  assert.ok(/phoenix/.test(all), 'only her state words did');
});

await step('clicking her minimises or reopens the chat; she stays on screen; the choice is remembered for this visit only', async () => {
  await page.locator('.hit').click();
  assert.equal(await page.locator('.panel').isVisible(), false); assert.ok(await page.locator('.hit').isVisible());
  assert.equal(await page.locator('.hit').getAttribute('aria-expanded'), 'false'); assert.equal(await page.evaluate(() => sessionStorage.getItem('phoenix-widget')), 'min');
  await page.reload(); await page.waitForSelector('.hit'); assert.equal(await page.locator('.panel').isVisible(), false, 'stays minimised on the next page of the visit');
  await page.locator('.hit').click(); assert.ok(await page.locator('.panel').isVisible());
  await page.keyboard.press('Escape'); assert.equal(await page.locator('.panel').isVisible(), false, 'Escape minimises');
  await page.locator('.hit').focus(); await page.keyboard.press('Enter'); assert.ok(await page.locator('.panel').isVisible(), 'the keyboard works too');
});

await step('she can be dragged anywhere on the page, and a drag does not toggle the chat', async () => {
  const before = await page.locator('.hit').boundingBox(); const wasOpen = await page.locator('.panel').isVisible();
  await page.mouse.move(before.x + 60, before.y + 60); await page.mouse.down(); await page.mouse.move(before.x - 200, before.y - 150, { steps: 8 }); await page.mouse.up();
  const after = await page.locator('.hit').boundingBox();
  assert.ok(after.x < before.x - 150 && after.y < before.y - 100, `moved from ${Math.round(before.x)},${Math.round(before.y)} to ${Math.round(after.x)},${Math.round(after.y)}`);
  assert.equal(await page.locator('.panel').isVisible(), wasOpen, 'dragging did not open or close the chat');
  const vp = page.viewportSize(); await page.mouse.move(after.x + 60, after.y + 60); await page.mouse.down(); await page.mouse.move(-500, -500, { steps: 5 }); await page.mouse.up();
  const off = await page.locator('.hit').boundingBox(); assert.ok(off.x >= -1 && off.y >= -1 && off.x < vp.width, 'she cannot be dragged off the screen');
});

await step('while minimised she says hello with a bubble, and the bubble opens the chat', async () => {
  const p2 = await ctx.newPage(); await p2.goto(otherUrl + '/?a=' + encodeURIComponent('data-open="false"'));
  await p2.locator('.hit').waitFor(); await p2.waitForFunction(() => document.querySelector('[data-phoenix-widget]').shadowRoot.querySelector('.bubble.show'), null, { timeout: 8000 });
  assert.match(await p2.locator('.bubble').textContent(), /Want to talk/); assert.equal(await p2.locator('.panel').isVisible(), false);
  await p2.locator('.bubble').click(); assert.ok(await p2.locator('.panel').isVisible()); await p2.close();
});

await step('options: left side, a size, her own greeting, a colour, or the round button instead', async () => {
  const p2 = await ctx.newPage();
  await p2.goto(otherUrl + '/?a=' + encodeURIComponent('data-position="left" data-size="160" data-greeting="Need a calm moment?" data-open="false" data-color="#0f766e"'));
  await p2.locator('.hit').waitFor(); const b = await p2.locator('.hit').boundingBox(); assert.ok(b.x < 200, 'left'); assert.ok(Math.abs(b.width - 160) <= 1, 'size ' + b.width);
  await p2.waitForFunction(() => document.querySelector('[data-phoenix-widget]').shadowRoot.querySelector('.bubble.show'), null, { timeout: 8000 }); assert.match(await p2.locator('.bubble').textContent(), /Need a calm moment/);
  await p2.locator('.hit').click(); assert.match(await p2.locator('.bar').evaluate((n) => getComputedStyle(n).backgroundColor), /rgb\(15, 118, 110\)/);
  await p2.close();
  const p3 = await ctx.newPage(); await p3.goto(otherUrl + '/?a=' + encodeURIComponent('data-style="button" data-label="Need a calm moment?" data-open="false"'));
  await p3.locator('button.fab').waitFor(); assert.match(await p3.locator('button.fab').textContent(), /Need a calm moment\?/); assert.equal(await p3.locator('.char').isVisible(), false); assert.equal(await p3.locator('.panel').isVisible(), false);
  await p3.locator('button.fab').click(); assert.ok(await p3.locator('.panel').isVisible()); await p3.evaluate(() => window.PhoenixWidget.close()); assert.equal(await p3.locator('.panel').isVisible(), false); await p3.close();
});

await step('a phone sees Phoenix and her greeting first (the chat is a tap away and then fills the screen), with nothing scrolling sideways', async () => {
  const m = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true });
  const p3 = await m.newPage(); await p3.goto(otherUrl + '/'); await p3.locator('.hit').waitFor();
  assert.equal(await p3.locator('.panel').isVisible(), false, 'closed on a phone until asked for'); assert.ok(await p3.locator('.hit').isVisible());
  await p3.waitForFunction(() => document.querySelector('[data-phoenix-widget]').shadowRoot.querySelector('.bubble.show'), null, { timeout: 8000 });
  await p3.screenshot({ path: path.join(shots, '42-widget-phone-closed.png') });
  await p3.locator('.hit').tap(); await p3.frameLocator('iframe[title="Phoenix chat"]').locator('#menu-btn').waitFor({ timeout: 20000 });
  const r = await p3.locator('.panel').evaluate((n) => { const b = n.getBoundingClientRect(); return { w: b.width, h: b.height }; }); assert.ok(r.w >= 385 && r.h >= 700, 'the chat fills the screen: ' + JSON.stringify(r));
  assert.ok(await p3.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal scroll on the host page');
  await p3.screenshot({ path: path.join(shots, '43-widget-phone-open.png') });
  await p3.locator('button:has-text("Minimise")').tap(); assert.equal(await p3.locator('.panel').isVisible(), false); await m.close();
});

await step('the app cannot be put in a frame from /app/ by other sites, but the widget’s pages can', async () => {
  const a = (await fetch(phoenixUrl + '/app/')).headers.get('content-security-policy');
  const e = (await fetch(phoenixUrl + '/embed/')).headers.get('content-security-policy'), mf = (await fetch(phoenixUrl + '/embed/mascot.html')).headers.get('content-security-policy');
  assert.match(a, /frame-ancestors 'self'/); assert.match(e, /frame-ancestors \*/); assert.match(mf, /frame-ancestors \*/);
});

await step('the host page cannot be broken: no script errors', async () => { assert.deepEqual(errors, []); });
await step('nothing is counted for local test pages (so tests never pollute the live numbers)', async () => { assert.deepEqual(hits, []); });

// counting, with a pretend public website name
await step('on a real website name it reports one load, a chat showing at the start is not counted as a visitor opening it, and Do Not Track reports none', async () => {
  const b2 = await chromium.launch({ channel: 'msedge', args: ['--disable-features=BlockInsecurePrivateNetworkRequests,LocalNetworkAccessChecks,PrivateNetworkAccessSendPreflights', `--host-resolver-rules=MAP shop.example.com 127.0.0.1:${other.address().port}, MAP phoenix.example.net 127.0.0.1:${phoenix.address().port}`] });
  const c2 = await b2.newContext({ viewport: { width: 1100, height: 800 } });
  await c2.addInitScript(() => Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false })); // automated browsers say they are automated, and the widget (rightly) counts nothing then
  const p4 = await c2.newPage(); p4.on('console', (m) => { if (process.env.DBG) console.log('   console', m.type(), m.text().slice(0, 200)); }); p4.on('requestfailed', (r) => { if (process.env.DBG) console.log('   failed', r.url().slice(0, 120), r.failure()?.errorText); }); await p4.goto('http://shop.example.com/');
  await p4.locator('.hit').waitFor(); await p4.frameLocator('iframe[title="Phoenix chat"]').locator('#menu-btn').waitFor({ timeout: 20000 }); for (let i = 0; i < 80 && !hits.some((h) => h.includes('embed_open')); i++) await new Promise((r) => setTimeout(r, 100));
  if (process.env.DBG) { const fr = p4.frames().find((x) => x.url().includes('/embed/?')); console.log('   DBG frame', fr && fr.url(), fr && JSON.stringify(await fr.evaluate(async () => { const a = await import('./js/analytics.js'); const { state } = await import('./js/store.js'); return { allowed: a.analyticsAllowed(state), wd: navigator.webdriver, an: state.prefs.analytics, ls: Object.keys(localStorage) }; }))); }
  const parsed = hits.map((h) => JSON.parse(h));
  const loads = parsed.filter((h) => h.e === 'embed_load'); assert.equal(loads.length, 1); assert.deepEqual([loads[0].v, loads[0].h], ['ok', 'shop.example.com']);
  const opens = parsed.filter((h) => h.e === 'embed_open'); assert.ok(opens.length >= 1 && opens.every((o) => o.v === 'auto'), 'a chat showing by itself is "auto": ' + JSON.stringify(opens) + ' all: ' + JSON.stringify(parsed.map((h) => h.e + ':' + h.v)));
  hits.length = 0; const p6 = await c2.newPage(); await p6.goto('http://shop.example.com/?a=' + encodeURIComponent('data-open="false"')); await p6.locator('.hit').waitFor(); await p6.locator('.hit').click(); await p6.frameLocator('iframe[title="Phoenix chat"]').locator('#menu-btn').waitFor({ timeout: 20000 }); for (let i = 0; i < 80 && !hits.some((h) => h.includes('embed_open')); i++) await new Promise((r) => setTimeout(r, 100));
  assert.ok(hits.map((h) => JSON.parse(h)).some((h) => h.e === 'embed_open' && h.v === 'ok'), 'a visitor opening it is counted');
  await c2.close(); hits.length = 0;
  const dnt = await b2.newContext({ extraHTTPHeaders: { dnt: '1' }, viewport: { width: 1000, height: 700 } });
  await dnt.addInitScript(() => { Object.defineProperty(Navigator.prototype, 'webdriver', { get: () => false }); Object.defineProperty(Navigator.prototype, 'doNotTrack', { get: () => '1' }); });
  const p5 = await dnt.newPage(); await p5.goto('http://shop.example.com/'); await p5.locator('.hit').waitFor(); await p5.waitForTimeout(1500);
  assert.equal(hits.length, 0); await dnt.close(); await b2.close();
});

await browser.close(); phoenix.close(); other.close();
if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
console.log('\nWIDGET CHECKS PASSED');

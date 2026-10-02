// Starts the real desktop program against the live site and checks the parts that matter: a see-through, always-on-top window over the
// whole screen; clicks go through except on Phoenix; clicking Phoenix opens the chat; the tray/shortcut message toggles it; the chat is the
// live app; nothing else can be asked of the window.
//   npm test        (needs internet; the live site must be up)
const path = require('node:path');
const fs = require('node:fs');
const assert = require('node:assert/strict');
// Playwright is installed in the Phoenix app folder next to this one (phoenix-companion, or phoenix in the GitHub repo)
const pw = ['phoenix-companion', 'phoenix'].map((n) => path.join(__dirname, '..', '..', n, 'node_modules', 'playwright-core')).find((p) => fs.existsSync(p));
const { _electron } = require(pw);

(async () => {
  const shots = path.join(__dirname, 'shots'); fs.mkdirSync(shots, { recursive: true });
  const userData = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'phoenix-desktop-'));
  const app = await _electron.launch({ executablePath: require('electron'), args: ['.', `--user-data-dir=${userData}`], cwd: path.join(__dirname, '..') });
  let failed = 0;
  const step = async (name, fn) => { try { await fn(); console.log('  ok  ', name); } catch (e) { failed++; console.log('  FAIL', name, '\n      ', String(e.message).split('\n').slice(0, 6).join('\n       ')); } };
  try {
    const page = await app.firstWindow();
    await page.waitForLoadState('domcontentloaded');
    await app.evaluate(({ BrowserWindow }) => { // record what the page asks of the window
      const w = BrowserWindow.getAllWindows()[0]; globalThis.__calls = []; const orig = w.setIgnoreMouseEvents.bind(w);
      w.setIgnoreMouseEvents = (...a) => { globalThis.__calls.push(a[0]); return orig(...a); };
    });
    await page.waitForFunction(() => document.querySelector('[data-phoenix-widget]'), null, { timeout: 30000 });

    await step('a see-through, always-on-top window covers the screen and is not in the taskbar', async () => {
      const info = await app.evaluate(({ BrowserWindow, screen }) => { const w = BrowserWindow.getAllWindows()[0]; return { top: w.isAlwaysOnTop(), b: w.getBounds(), wa: screen.getPrimaryDisplay().workArea, vis: w.isVisible(), url: w.webContents.getURL() }; });
      assert.equal(info.top, true); assert.equal(info.vis, true); assert.deepEqual(info.b, info.wa); assert.match(info.url, /^https:\/\/phoenix\.neurohubcommunity\.org\/desktop\//);
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor), 'rgba(0, 0, 0, 0)');
    });
    await step('the page is the live widget, minimised, with only the allowed bridge', async () => {
      assert.deepEqual(await page.evaluate(() => Object.keys(window.phoenixDesktop).sort()), ['onOpen', 'onToggle', 'setInteractive']);
      assert.equal(await page.evaluate(() => typeof require + typeof process), 'undefinedundefined', 'no Node access from the page');
      assert.equal(await page.evaluate(() => document.querySelector('[data-phoenix-widget]').shadowRoot.querySelector('.dock').classList.contains('open')), false);
    });
    const hit = () => page.evaluate(() => { const r = document.querySelector('[data-phoenix-widget]').shadowRoot.querySelector('.hit').getBoundingClientRect(); return { x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2) }; });
    const send = (ev) => app.evaluate(({ BrowserWindow }, e) => BrowserWindow.getAllWindows()[0].webContents.sendInputEvent(e), ev);
    await step('clicks pass through everywhere except on Phoenix', async () => {
      const p = await hit(); await send({ type: 'mouseMove', x: p.x, y: p.y }); await page.waitForTimeout(300);
      let c = await app.evaluate(() => globalThis.__calls); assert.equal(c.at(-1), false, 'clickable over Phoenix');
      await send({ type: 'mouseMove', x: 5, y: 5 }); await page.waitForTimeout(300);
      c = await app.evaluate(() => globalThis.__calls); assert.equal(c.at(-1), true, 'click-through over empty space');
    });
    await step('clicking Phoenix opens the chat, which is the live app', async () => {
      const p = await hit(); await send({ type: 'mouseDown', x: p.x, y: p.y, button: 'left', clickCount: 1 }); await send({ type: 'mouseUp', x: p.x, y: p.y, button: 'left', clickCount: 1 });
      await page.waitForFunction(() => document.querySelector('[data-phoenix-widget]').shadowRoot.querySelector('.dock').classList.contains('open'), null, { timeout: 8000 });
      const chat = await (async () => { for (let i = 0; i < 40; i++) { const f = page.frames().find((f) => /\/embed\//.test(f.url()) && !/mascot/.test(f.url())); if (f) return f; await page.waitForTimeout(500); } })();
      assert.ok(chat, 'chat frame');
      await chat.waitForSelector('textarea[aria-label="Message Phoenix"], .modal', { timeout: 30000 });
      await page.waitForTimeout(1500); await fs.promises.writeFile(path.join(shots, 'desktop-open.png'), (await app.evaluate(async ({ BrowserWindow }) => (await BrowserWindow.getAllWindows()[0].webContents.capturePage()).toPNG().toString('base64'))), 'base64');
    });
    await step('the tray and shortcut message closes and reopens the chat', async () => {
      const isOpen = () => page.evaluate(() => document.querySelector('[data-phoenix-widget]').shadowRoot.querySelector('.dock').classList.contains('open'));
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('phoenix:toggle')); await page.waitForTimeout(500); assert.equal(await isOpen(), false);
      await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].webContents.send('phoenix:open')); await page.waitForTimeout(500); assert.equal(await isOpen(), true);
    });
    await step('other websites cannot open inside the window, and no permissions (microphone, camera, location) are granted', async () => {
      const r = await app.evaluate(({ BrowserWindow }) => new Promise((res) => {
        const wc = BrowserWindow.getAllWindows()[0].webContents; let blocked = false; wc.once('will-navigate', (e) => { blocked = e.defaultPrevented; });
        wc.executeJavaScript("location.href='https://example.com/'").catch(() => {}); setTimeout(() => res({ url: wc.getURL(), blocked }), 1500);
      }));
      assert.match(r.url, /phoenix\.neurohubcommunity\.org/);
      const perms = await page.evaluate(async () => { const out = {}; for (const n of ['microphone', 'camera', 'geolocation', 'notifications']) { try { out[n] = (await navigator.permissions.query({ name: n })).state; } catch { out[n] = 'n/a'; } } return out; });
      for (const [n, s] of Object.entries(perms)) assert.notEqual(s, 'granted', n);
    });
  } finally { await app.close(); }
  if (failed) { console.log(`\n${failed} FAILED`); process.exit(1); }
  console.log('\nDESKTOP CHECKS PASSED');
})().catch((e) => { console.error(e); process.exit(1); });

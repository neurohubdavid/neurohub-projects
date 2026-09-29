// Phoenix desktop app (Electron main process).
// - Serves the app from a private phoenix:// scheme so it has a stable, secure origin (localStorage, modules, fetch).
// - Blocks navigation and new windows: external links open in the person's normal browser.
// - Provides a small network bridge so the app can talk to a local Ollama or an online AI service without
//   browser cross-origin limits. Only the app's own pages may use it, and only http(s) URLs.
const { app, BrowserWindow, Menu, protocol, shell, ipcMain, session, net } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const APP_DIR = path.join(__dirname, '..', 'app');
const SMOKE = process.argv.includes('--smoke');

protocol.registerSchemesAsPrivileged([{ scheme: 'phoenix', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

if (!SMOKE && !app.requestSingleInstanceLock()) { app.quit(); }

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ico': 'image/x-icon',
};

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1040, height: 820, minWidth: 360, minHeight: 520,
    title: 'Phoenix', backgroundColor: '#fffbf2', show: false,
    icon: path.join(__dirname, '..', 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, sandbox: true, nodeIntegration: false, spellcheck: true },
  });
  win.once('ready-to-show', () => { if (!SMOKE) win.show(); });
  win.setMenuBarVisibility(false);
  win.loadURL('phoenix://app/index.html');

  win.webContents.setWindowOpenHandler(({ url }) => { openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('phoenix://app/')) { e.preventDefault(); openExternal(url); } });
  win.on('closed', () => { win = null; });

  if (SMOKE) {
    const fail = (m) => { console.error('SMOKE FAIL:', m); app.exit(1); };
    setTimeout(() => fail('timeout'), 20000);
    win.webContents.on('console-message', (_e, level, message) => { if (level >= 3) console.error('renderer error:', message); });
    win.webContents.once('did-finish-load', async () => {
      try {
        await new Promise((r) => setTimeout(r, 1500));
        const r = await win.webContents.executeJavaScript(`(async () => {
          const out = {};
          out.bridge = typeof window.phoenixNative?.request === 'function';
          out.chat = !!document.querySelector('.chat-list');
          out.nav = document.querySelectorAll('#nav button').length;
          out.title = document.title;
          out.mascot = !!document.querySelector('.ph-svg');
          const r = await fetch('data/crisis.json'); out.crisis = (await r.json()).global?.length;
          return out;
        })()`);
        console.log('SMOKE RESULT', JSON.stringify(r));
        if (!r.bridge || !r.chat || r.nav !== 4 || !r.mascot || !r.crisis) return fail('checks failed: ' + JSON.stringify(r));
        console.log('SMOKE OK'); app.exit(0);
      } catch (e) { fail(e.message); }
    });
  }
}

function openExternal(url) {
  try { const u = new URL(url); if (['http:', 'https:', 'mailto:'].includes(u.protocol)) shell.openExternal(u.toString()); } catch { /* ignore bad URLs */ }
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  session.defaultSession.setPermissionRequestHandler((_wc, _perm, cb) => cb(false)); // Phoenix needs no device permissions

  protocol.handle('phoenix', async (request) => {
    try {
      let rel = decodeURIComponent(new URL(request.url).pathname);
      if (rel === '/' || rel === '') rel = '/index.html';
      const file = path.normalize(path.join(APP_DIR, rel));
      if (!file.startsWith(APP_DIR + path.sep)) return new Response('Forbidden', { status: 403 });
      const data = await fs.promises.readFile(file);
      return new Response(data, { headers: { 'content-type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' } });
    } catch { return new Response('Not found', { status: 404 }); }
  });

  // ---- network bridge
  const inflight = new Map();
  const fromApp = (e) => (e.senderFrame?.url || '').startsWith('phoenix://app/');
  ipcMain.on('net:request', async (e, id, req) => {
    if (!fromApp(e)) return;
    const send = (ev) => { if (!e.sender.isDestroyed()) e.sender.send('net:event', id, ev); };
    const ctl = new AbortController();
    inflight.set(`${e.sender.id}:${id}`, ctl);
    try {
      const u = new URL(req.url);
      if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http and https addresses are allowed.');
      const res = await net.fetch(u.toString(), { method: req.method || 'GET', headers: req.headers || {}, body: req.body ?? undefined, signal: ctl.signal, bypassCustomProtocolHandlers: true });
      send({ type: 'head', status: res.status, statusText: res.statusText, headers: Object.fromEntries(res.headers) });
      if (res.body) {
        const reader = res.body.getReader();
        for (;;) { const { done, value } = await reader.read(); if (done) break; send({ type: 'chunk', data: value }); }
      }
      send({ type: 'end' });
    } catch (err) {
      if (!ctl.signal.aborted) send({ type: 'error', message: String(err?.message || err) });
    } finally { inflight.delete(`${e.sender.id}:${id}`); }
  });
  ipcMain.on('net:abort', (e, id) => { if (!fromApp(e)) return; inflight.get(`${e.sender.id}:${id}`)?.abort(); });
  ipcMain.on('open-external', (e, url) => { if (fromApp(e)) openExternal(url); });

  // ---- persistent storage: a real file in the person's app-data folder, so chats and check-ins survive updates,
  // reinstalls and cleared browser data. Writes are atomic (temp file then rename), the previous copy is kept as .bak,
  // and one backup per day is kept for a week. The app's localStorage is only a mirror.
  const dir = app.getPath('userData');
  const dataFile = path.join(dir, 'phoenix-data.json');
  const backups = path.join(dir, 'backups');
  const readGood = (f) => { try { const t = fs.readFileSync(f, 'utf8'); JSON.parse(t); return t; } catch { return null; } };
  ipcMain.on('store:load', (e) => { e.returnValue = fromApp(e) ? (readGood(dataFile) ?? readGood(dataFile + '.bak') ?? '') : ''; });
  ipcMain.on('store:save', (e, text) => {
    if (!fromApp(e) || typeof text !== 'string' || text.length > 30e6) return;
    try {
      JSON.parse(text); // never overwrite good data with something broken
      fs.mkdirSync(dir, { recursive: true });
      const tmp = dataFile + '.tmp';
      fs.writeFileSync(tmp, text);
      if (fs.existsSync(dataFile)) fs.copyFileSync(dataFile, dataFile + '.bak');
      fs.renameSync(tmp, dataFile);
      const day = new Date().toISOString().slice(0, 10);
      const daily = path.join(backups, `phoenix-${day}.json`);
      if (!fs.existsSync(daily)) {
        fs.mkdirSync(backups, { recursive: true });
        fs.copyFileSync(dataFile, daily);
        for (const old of fs.readdirSync(backups).filter((n) => /^phoenix-.*\.json$/.test(n)).sort().slice(0, -7)) fs.rmSync(path.join(backups, old), { force: true });
      }
    } catch (err) { console.error('store:save failed', err.message); }
  });
  ipcMain.on('store:info', (e) => { e.returnValue = fromApp(e) ? { file: dataFile, backups, exists: fs.existsSync(dataFile) } : null; });
  // "Delete everything" must really delete everything, including the rolling backups.
  ipcMain.on('store:wipe', (e) => { try { if (fromApp(e)) { for (const f of [dataFile, dataFile + '.bak', dataFile + '.tmp']) fs.rmSync(f, { force: true }); fs.rmSync(backups, { recursive: true, force: true }); } } catch { /* ignore */ } e.returnValue = true; });
  ipcMain.on('store:reveal', (e) => { if (fromApp(e)) shell.showItemInFolder(fs.existsSync(dataFile) ? dataFile : dir); });

  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });

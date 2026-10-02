// Main-process side of listening: passes start/stop from Phoenix's chat to a hidden window that runs the offline speech engine, and passes
// the words it hears back to the one chat that asked. The microphone is only used while a session is running, only for Phoenix's own
// pages, and can be switched off from the tray at any time.
const { BrowserWindow, ipcMain, protocol, net, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const SCHEME = 'phoenix-speech', PART = 'phoenix-speech';
const SPEECH_DIR = path.join(__dirname, 'speech').replace('app.asar', 'app.asar.unpacked'); // in the packaged program the engine files are kept unpacked, outside the archive
const FILES = new Set(['worker.html', 'worker.js', 'vosk.js', 'model.tar.gz']);
const IDLE_CLOSE_MS = 3 * 60 * 1000; // the engine uses a few hundred MB while loaded, so it is let go of when nobody is listening

/** Must run before the app is ready. */
const registerScheme = () => protocol.registerSchemesAsPrivileged([{ scheme: SCHEME, privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, corsEnabled: true } }]);

function setupSpeech({ isHome, onActive }) {
  let win = null, ready = null, idle = null, allowed = true, active = null; // active: { id, frame }
  const state = { get allowed() { return allowed; }, get active() { return !!active; } };

  const ses = () => session.fromPartition(PART);
  ses().protocol.handle(SCHEME, (req) => { // only the four engine files, from inside the program's own folder
    const u = new URL(req.url); const name = decodeURIComponent(u.pathname).replace(/^\/+/, '');
    if (u.hostname !== 'app' || !FILES.has(name)) return new Response('not found', { status: 404 });
    return net.fetch(pathToFileURL(path.join(SPEECH_DIR, name)).toString());
  });
  // the hidden window may use the microphone; no other window or frame may
  ses().setPermissionRequestHandler((_wc, perm, cb, d) => cb(perm === 'media' && String(d.requestingUrl || '').startsWith(`${SCHEME}://app/`) && allowed));
  ses().setPermissionCheckHandler((_wc, perm, origin) => perm === 'media' && String(origin || '').startsWith(`${SCHEME}://app`) && allowed);

  function ensureWorker() {
    if (win && !win.isDestroyed()) return ready;
    win = new BrowserWindow({ show: false, width: 200, height: 100, webPreferences: { preload: path.join(__dirname, 'speech-preload.js'), partition: PART, contextIsolation: true, sandbox: true, nodeIntegration: false, backgroundThrottling: false } });
    win.webContents.on('will-navigate', (e) => e.preventDefault());
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    win.on('closed', () => { win = null; ready = null; if (active) fail(active, 'engine'); });
    ready = new Promise((res) => { const h = (_e, m) => { if (m && m.type === 'hello') { ipcMain.removeListener('speech:event', h); res(); } }; ipcMain.on('speech:event', h); });
    win.loadURL(`${SCHEME}://app/worker.html`);
    return ready;
  }
  const toFrame = (a, msg) => { try { if (a && a.frame && !a.frame.isDestroyed?.()) a.frame.send('phoenix:speech:event', msg); } catch { /* the chat went away */ } };
  function fail(a, error) { toFrame(a, { id: a.id, type: 'error', error }); toFrame(a, { id: a.id, type: 'end' }); if (active === a) { active = null; onActive(false); } }
  const restartIdle = () => { clearTimeout(idle); idle = setTimeout(() => { if (!active && win && !win.isDestroyed()) win.close(); }, IDLE_CLOSE_MS); };

  ipcMain.on('phoenix:speech:cmd', async (e, m) => {
    if (!e.senderFrame || !isHome(e.senderFrame.url) || !m || typeof m.id !== 'string' || m.id.length > 40) return; // only Phoenix's own pages
    if (m.cmd === 'start') {
      const a = { id: m.id, frame: e.senderFrame };
      if (!allowed) { toFrame(a, { id: a.id, type: 'error', error: 'not-allowed' }); toFrame(a, { id: a.id, type: 'end' }); return; }
      if (active && active.id !== a.id) { toFrame(active, { id: active.id, type: 'end' }); } // a new session replaces the old one
      active = a; onActive(true); clearTimeout(idle);
      try { await ensureWorker(); } catch { return fail(a, 'engine'); }
      if (active !== a) return;
      win.webContents.send('speech:cmd', { cmd: 'start', id: a.id, continuous: !!m.continuous });
    } else if (m.cmd === 'stop' || m.cmd === 'abort') {
      if (!active || active.id !== m.id || active.frame !== e.senderFrame) return; // a chat can only stop its own session
      if (win && !win.isDestroyed()) win.webContents.send('speech:cmd', { cmd: m.cmd, id: m.id });
    }
  });
  ipcMain.on('speech:event', (e, m) => {
    if (!win || win.isDestroyed() || e.sender !== win.webContents || !m || !m.id) return;
    const a = active && active.id === m.id ? active : null; if (!a) return;
    toFrame(a, { id: m.id, type: String(m.type || ''), text: typeof m.text === 'string' ? m.text.slice(0, 2000) : undefined, error: typeof m.error === 'string' ? m.error : undefined });
    if (m.type === 'end') { active = null; onActive(false); restartIdle(); }
  });

  state.allow = (v) => { allowed = !!v; if (!allowed && active) { const a = active; if (win && !win.isDestroyed()) win.webContents.send('speech:cmd', { cmd: 'abort', id: a.id }); fail(a, 'not-allowed'); } };
  state.shutdown = () => { try { if (win && !win.isDestroyed()) win.destroy(); } catch { /* quitting */ } };
  return state;
}
module.exports = { registerScheme, setupSpeech };

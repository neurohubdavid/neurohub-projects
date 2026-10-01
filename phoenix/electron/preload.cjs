// Exposes a tiny, fixed bridge to the app. No Node access, no arbitrary IPC.
const { contextBridge, ipcRenderer } = require('electron');

let next = 1;
const callbacks = new Map();
ipcRenderer.on('net:event', (_e, id, ev) => {
  const cb = callbacks.get(id);
  if (!cb) return;
  cb(ev);
  if (ev.type === 'end' || ev.type === 'error') callbacks.delete(id);
});

contextBridge.exposeInMainWorld('phoenixNative', {
  /** Only set by the test suite, to point the shared AI at a local mock. Normally empty, so the real Phoenix service is used. */
  apiBase: process.env.PHOENIX_API_BASE || '',
  /** request({url, method, headers, body}, onEvent) -> Promise<id>. onEvent gets {type:'head'|'chunk'|'end'|'error', ...}. */
  request(req, onEvent) {
    const id = next++;
    callbacks.set(id, onEvent);
    ipcRenderer.send('net:request', id, { url: String(req.url), method: String(req.method || 'GET'), headers: req.headers || {}, body: req.body ?? null });
    return Promise.resolve(id);
  },
  abort(id) { ipcRenderer.send('net:abort', id); callbacks.delete(id); },
  openExternal(url) { ipcRenderer.send('open-external', String(url)); },
  storage: {
    loadSync: () => ipcRenderer.sendSync('store:load'),
    save: (text) => ipcRenderer.send('store:save', text),
    saveSync: (text) => ipcRenderer.sendSync('store:save', text),
    info: () => ipcRenderer.sendSync('store:info'),
    reveal: () => ipcRenderer.send('store:reveal'),
    wipe: () => ipcRenderer.sendSync('store:wipe'),
  },
  reminders: {
    set: (cfg) => ipcRenderer.send('reminders:set', { enabled: !!cfg.enabled, time: String(cfg.time || ''), launch: !!cfg.launch, doneDay: String(cfg.doneDay || '') }),
    done: (day) => ipcRenderer.send('reminders:done', String(day)),
    test: () => ipcRenderer.send('reminders:test'),
  },
  /** The main process asks the app to open a screen (for example when a reminder is clicked). Only '#/...' routes are accepted. */
  onNavigate: (cb) => ipcRenderer.on('nav', (_e, hash) => { if (typeof hash === 'string' && hash.startsWith('#/')) cb(hash); }),
  platform: process.platform,
  noAnalytics: process.env.PHOENIX_NO_ANALYTICS === '1', // tests and development switch counting off
});

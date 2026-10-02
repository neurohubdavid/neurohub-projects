// For the hidden speech window only: lets it receive start/stop commands and report what it hears, and nothing else.
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('speechHost', {
  onCommand: (fn) => { if (typeof fn === 'function') ipcRenderer.on('speech:cmd', (_e, m) => fn(m)); },
  send: (m) => ipcRenderer.send('speech:event', m),
});

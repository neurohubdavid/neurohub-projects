// The only things Phoenix's own pages can ask this program to do:
//  - (the see-through page) become clickable or click-through, and hear when the shortcut or tray asks to open or close the chat;
//  - (the chat, a frame of the same site) listen for speech: start, stop and hear what was said, using the offline engine in speech/.
// Nothing else is exposed, and none of it exists on any other website.
const { contextBridge, ipcRenderer } = require('electron');
if (location.origin === 'https://phoenix.neurohubcommunity.org') {
  if (window === window.top) {
    contextBridge.exposeInMainWorld('phoenixDesktop', {
      setInteractive: (on) => ipcRenderer.send('phoenix:interactive', on === true),
      onToggle: (fn) => { if (typeof fn === 'function') ipcRenderer.on('phoenix:toggle', () => fn()); },
      onOpen: (fn) => { if (typeof fn === 'function') ipcRenderer.on('phoenix:open', () => fn()); },
    });
  }
  const listeners = new Set();
  ipcRenderer.on('phoenix:speech:event', (_e, ev) => { for (const l of listeners) { try { l(ev); } catch { /* one listener must not stop the rest */ } } });
  let n = 0;
  contextBridge.exposeInMainWorld('phoenixSpeech', {
    available: true,
    onDevice: true, // the audio is turned into text on this computer and goes nowhere
    start: (opts) => { const id = `${Date.now().toString(36)}-${++n}`; ipcRenderer.send('phoenix:speech:cmd', { cmd: 'start', id, continuous: !!(opts && opts.continuous) }); return id; },
    stop: (id) => ipcRenderer.send('phoenix:speech:cmd', { cmd: 'stop', id: String(id) }),
    abort: (id) => ipcRenderer.send('phoenix:speech:cmd', { cmd: 'abort', id: String(id) }),
    on: (fn) => { if (typeof fn !== 'function') return () => {}; listeners.add(fn); return () => listeners.delete(fn); },
  });
}

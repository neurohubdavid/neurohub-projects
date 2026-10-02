// The only things Phoenix's page can ask this program to do: become clickable or click-through, and hear when the shortcut or tray
// asks to open or close the chat. Nothing else is exposed. It does nothing on any other website.
const { contextBridge, ipcRenderer } = require('electron');
if (location.origin === 'https://phoenix.neurohubcommunity.org') {
  contextBridge.exposeInMainWorld('phoenixDesktop', {
    setInteractive: (on) => ipcRenderer.send('phoenix:interactive', on === true),
    onToggle: (fn) => { if (typeof fn === 'function') ipcRenderer.on('phoenix:toggle', () => fn()); },
    onOpen: (fn) => { if (typeof fn === 'function') ipcRenderer.on('phoenix:open', () => fn()); },
  });
}

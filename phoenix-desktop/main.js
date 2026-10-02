// Phoenix on your desktop: Phoenix floats over everything else, like a desktop companion, and opens a chat when you click him.
// This program is only a see-through, click-through window. All of Phoenix (the character, the chat, the AI, accounts, safety) is the
// live site at https://phoenix.neurohubcommunity.org/desktop/, so it is always up to date and always connected to Phoenix AI.
const { app, BrowserWindow, Tray, Menu, nativeImage, screen, shell, ipcMain, globalShortcut, session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');

const HOME = 'https://phoenix.neurohubcommunity.org';
const PAGE = HOME + '/desktop/';
const SHORTCUT = 'Control+Alt+P';

if (!app.requestSingleInstanceLock()) app.quit();

let win = null, tray = null, shown = true, displayIndex = 0, retry = null, quitting = false;
const prefsFile = () => path.join(app.getPath('userData'), 'desktop-prefs.json');
const prefs = (() => { try { return JSON.parse(fs.readFileSync(prefsFile(), 'utf8')); } catch { return {}; } })();
const savePrefs = () => { try { fs.writeFileSync(prefsFile(), JSON.stringify(prefs)); } catch { /* not worth stopping for */ } };

const isHome = (u) => { try { return new URL(u).origin === HOME; } catch { return false; } };
const area = () => { const all = screen.getAllDisplays(); return all[displayIndex % all.length].workArea; };

function createWindow() {
  const b = area();
  win = new BrowserWindow({
    x: b.x, y: b.y, width: b.width, height: b.height,
    transparent: true, frame: false, hasShadow: false, resizable: false, movable: false, maximizable: false, minimizable: false, fullscreenable: false,
    skipTaskbar: true, alwaysOnTop: true, focusable: true, backgroundColor: '#00000000', show: false, title: 'Phoenix',
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true, nodeIntegration: false, partition: 'persist:phoenix', spellcheck: false },
  });
  win.setAlwaysOnTop(true, 'screen-saver'); // above full-screen windows too
  win.setIgnoreMouseEvents(true, { forward: true }); // clicks go through, until the page says the pointer is on Phoenix
  win.once('ready-to-show', () => { win.showInactive(); shown = true; });
  win.loadURL(PAGE);

  // Phoenix can only ever show his own site; links to anywhere else open in the normal browser
  win.webContents.on('will-navigate', (e, url) => { if (!isHome(url)) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('did-create-window', (w) => w.close());
  win.webContents.on('did-fail-load', (_e, code, _d, url, isMain) => { if (isMain && code !== -3) offline(); });
  win.webContents.on('did-finish-load', () => { clearTimeout(retry); });
  win.on('closed', () => { win = null; });
}

// No internet: say so kindly and keep trying
function offline() {
  if (!win) return;
  win.loadFile(path.join(__dirname, 'offline.html'));
  clearTimeout(retry); retry = setTimeout(() => { if (win) win.loadURL(PAGE); }, 15000);
}

function fit() { if (win) win.setBounds(area()); }

function toggleChat() { if (!win) return; if (!shown) show(); win.webContents.send('phoenix:toggle'); }
function openChat() { if (!win) return; if (!shown) show(); win.webContents.send('phoenix:open'); }
function show() { if (win) { win.showInactive(); shown = true; buildMenu(); } }
function hide() { if (win) { win.hide(); shown = false; buildMenu(); } }

function buildMenu() {
  if (!tray) return;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Talk to Phoenix', accelerator: SHORTCUT, click: openChat },
    { label: shown ? 'Hide Phoenix' : 'Show Phoenix', click: () => (shown ? hide() : show()) },
    { label: 'Move to the next screen', enabled: screen.getAllDisplays().length > 1, click: () => { displayIndex = (displayIndex + 1) % screen.getAllDisplays().length; fit(); } },
    { type: 'separator' },
    { label: 'Start with Windows', type: 'checkbox', checked: !!prefs.openAtLogin, click: (i) => { prefs.openAtLogin = i.checked; savePrefs(); app.setLoginItemSettings({ openAtLogin: i.checked, args: [] }); } },
    { label: 'Open the Phoenix app in my browser', click: () => shell.openExternal(HOME + '/app/') },
    { label: 'Privacy and how Phoenix works', click: () => shell.openExternal(HOME + '/privacy/') },
    { type: 'separator' },
    { label: 'Quit Phoenix', click: () => { quitting = true; app.quit(); } },
  ]));
}

app.whenReady().then(() => {
  // Nothing is allowed except what the chat needs (copying text). No camera, microphone, location or notifications.
  const s = session.fromPartition('persist:phoenix');
  s.setPermissionRequestHandler((_wc, permission, cb) => cb(permission === 'clipboard-sanitized-write'));
  s.setPermissionCheckHandler((_wc, permission) => permission === 'clipboard-sanitized-write');

  // Only the desktop page may steer the window, and only to make it clickable or open and close the chat
  ipcMain.on('phoenix:interactive', (e, on) => {
    if (!win || e.senderFrame !== win.webContents.mainFrame || !isHome(e.senderFrame.url)) return;
    if (on === true) win.setIgnoreMouseEvents(false); else win.setIgnoreMouseEvents(true, { forward: true });
  });

  createWindow();
  const img = nativeImage.createFromPath(path.join(__dirname, 'icon.png')).resize({ width: 32, height: 32 });
  tray = new Tray(img); tray.setToolTip('Phoenix'); tray.on('click', toggleChat); buildMenu();
  globalShortcut.register(SHORTCUT, toggleChat);
  screen.on('display-metrics-changed', fit); screen.on('display-added', fit); screen.on('display-removed', () => { displayIndex = 0; fit(); });
  app.setLoginItemSettings({ openAtLogin: !!prefs.openAtLogin });
});

app.on('second-instance', openChat); // starting the program again just opens the chat
app.on('will-quit', () => globalShortcut.unregisterAll());
app.on('window-all-closed', () => { if (quitting) app.quit(); });

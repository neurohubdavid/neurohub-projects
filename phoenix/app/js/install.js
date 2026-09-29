// Installing the web version as an app (PWA), and telling people when a new version is ready.
//  - Chrome, Edge, Android, Samsung Internet: the browser offers an install prompt, which we save and show as an Install button.
//  - iPhone and iPad (Safari) and Mac Safari: no prompt exists, so we show the exact steps instead.
//  - Inside the desktop app there is nothing to install, so all of this stays hidden.
import { el, toast, modal } from './util.js';
import { track } from './analytics.js';

const desktopApp = !!globalThis.phoenixNative;
let deferred = null;
const listeners = new Set();
const notify = () => listeners.forEach((f) => f());

export const isStandalone = () => desktopApp || matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: minimal-ui)').matches || navigator.standalone === true;
export const canPrompt = () => !!deferred;
export const onInstallStateChange = (f) => { listeners.add(f); return () => listeners.delete(f); };

const ua = navigator.userAgent || '';
const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const isSafari = /^((?!chrome|android|crios|fxios|edg).)*safari/i.test(ua);

export function initInstall() {
  if (desktopApp) return;
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; notify(); });
  window.addEventListener('appinstalled', () => { deferred = null; track('installed', 'pwa'); notify(); toast('Phoenix is installed. Find it in your apps.', { icon: '✅', ms: 4000 }); });
  matchMedia('(display-mode: standalone)').addEventListener?.('change', notify);
}

export async function promptInstall() {
  if (!deferred) return false;
  track('install_click', 'app');
  const ev = deferred; deferred = null; notify();
  ev.prompt();
  const { outcome } = await ev.userChoice.catch(() => ({ outcome: 'dismissed' }));
  return outcome === 'accepted';
}

/** Header button: visible only when the browser is ready to install and the app is not already installed. */
export function wireInstallButton(btn) {
  const sync = () => { btn.hidden = isStandalone() || !canPrompt(); };
  btn.addEventListener('click', () => promptInstall());
  onInstallStateChange(sync); sync();
}

/** Settings section: status, a button when possible, and the manual steps for browsers with no install prompt. */
export function installPanel() {
  const box = el('div', { class: 'stack' });
  const draw = () => {
    box.textContent = '';
    if (desktopApp) { box.append(el('p', {}, 'You are already using the Phoenix desktop app. Nothing to install.')); return; }
    if (isStandalone()) { box.append(el('p', {}, '✅ Phoenix is installed and running as an app on this device. It works offline.')); return; }
    if (canPrompt()) box.append(el('p', {}, 'Install Phoenix so it opens in its own window, works offline, and sits with your other apps.'), el('button', { class: 'btn btn-primary', onclick: () => promptInstall() }, 'Install Phoenix'));
    else if (isIOS) box.append(el('p', {}, el('strong', {}, 'On iPhone or iPad: '), 'open this page in Safari, tap the Share button (a square with an arrow), then choose ', el('strong', {}, 'Add to Home Screen'), '.'));
    else if (isSafari) box.append(el('p', {}, el('strong', {}, 'On Mac Safari: '), 'choose File, then ', el('strong', {}, 'Add to Dock'), '.'));
    else box.append(el('p', {}, 'Your browser will offer to install Phoenix when it is ready. Look for an install icon in the address bar, or open the browser menu and choose ', el('strong', {}, 'Install Phoenix'), ' (Chrome, Edge) or ', el('strong', {}, 'Add to Home screen'), ' (Android). On Firefox for desktop, use the Windows or Linux download instead.'));
    const checkBox = el('div', { class: 'small', 'aria-live': 'polite' });
    box.append(el('details', {}, el('summary', {}, 'Install not working? Check why'), checkBox));
    box.querySelector('details').addEventListener('toggle', async (e) => {
      if (!e.target.open) return;
      checkBox.textContent = 'Checking...';
      const items = await installChecks();
      checkBox.textContent = ''; checkBox.append(el('ul', {}, items.map((i) => el('li', {}, (i.ok ? 'OK: ' : 'Not yet: ') + i.text))));
    });
    box.append(el('p', { class: 'muted small' }, 'Installing does not send anything anywhere. Your chats and settings stay on this device, and clearing the browser’s site data would erase them, so download a backup from “Your data” now and then.'));
  };
  draw();
  onInstallStateChange(draw);
  return box;
}

/** Registers the service worker and tells the person when a new version is waiting. */
export function registerServiceWorker() {
  if (desktopApp || !('serviceWorker' in navigator) || !location.protocol.startsWith('http')) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    const offer = (worker) => {
      const t = el('div', { class: 'toast' }, el('span', {}, 'A new version of Phoenix is ready. '), el('button', { class: 'btn btn-sm btn-primary', onclick: () => worker.postMessage('skipWaiting') }, 'Update now'));
      let host = document.getElementById('toasts');
      if (!host) { host = el('div', { id: 'toasts', 'aria-live': 'polite' }); document.body.append(host); }
      host.append(t);
    };
    if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) offer(w); });
    });
    setInterval(() => reg.update().catch(() => {}), 6 * 60 * 60 * 1000); // check for a new version every few hours while open
  }).catch(() => { /* offline support is a bonus, not required */ });
  // Reload once when an update takes over, but never on the very first visit (there was no earlier version to replace).
  const hadController = !!navigator.serviceWorker.controller;
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!hadController || reloaded) return; reloaded = true; location.reload(); });
}

// ---------------------------------------------------------------- one-tap install invitation and self-check
const INVITE_KEY = 'phoenix.installInvite';
const lsGet = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch { /* ignore */ } };

/** A calm, dismissible card offering to install, shown when the browser is ready and the app is not installed. */
export function wireInstallInvite(host) {
  if (desktopApp || !host) return;
  const sync = () => {
    host.textContent = '';
    if (isStandalone() || !canPrompt() || lsGet(INVITE_KEY) === 'no') return;
    host.append(el('div', { class: 'install-invite', role: 'region', 'aria-label': 'Install Phoenix' },
      el('span', {}, 'Install Phoenix as an app: its own icon and window, works offline, and your data stays on this device.'),
      el('span', { class: 'row-wrap' },
        el('button', { class: 'btn btn-sm btn-primary', onclick: () => promptInstall() }, 'Install'),
        el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { lsSet(INVITE_KEY, 'no'); sync(); } }, 'Not now'))));
  };
  onInstallStateChange(sync); sync();
}

/** What the browser says about installing right now, in plain words. Helps when the Install button does not appear. */
export async function installChecks() {
  const out = [];
  const add = (ok, good, bad) => out.push({ ok, text: ok ? good : bad });
  add(isSecureContext, 'The page is on a secure (https) address.', 'The page is not on a secure address, so browsers will not offer to install it. Open the https address.');
  let reg = null; try { reg = await navigator.serviceWorker?.getRegistration(); } catch { /* ignore */ }
  add(!!reg?.active, 'Offline support is active.', 'Offline support has not started yet. Reload the page once, wait a few seconds, and check again.');
  add(!!document.querySelector('link[rel=manifest]'), 'The app description (manifest) is present.', 'The app description is missing.');
  add(canPrompt() || isStandalone(), isStandalone() ? 'Phoenix is already installed and you are using it as an app.' : 'Your browser is ready to install Phoenix: use the Install button.', 'Your browser has not offered to install yet. That can mean: Phoenix is already installed on this device (look in your Start menu or Apps list), you are in a private window, or your browser is not Chrome or Edge. Chrome and Edge on the address bar also show an install icon when ready.');
  return out;
}
/** A simple full-screen sheet: one big button where the browser can install, the exact steps where it cannot. Used when arriving from the website's Install button. */
export function openInstallSheet() {
  if (desktopApp || isStandalone()) return;
  const body = el('div', { class: 'stack' });
  let m = null, off = null;
  const draw = () => {
    body.textContent = '';
    if (canPrompt()) {
      body.append(el('p', {}, 'One tap adds Phoenix to this device. It gets its own icon, works offline, and keeps your data on your device.'),
        el('button', { class: 'btn btn-primary btn-lg', style: { width: '100%' }, onclick: async () => { const ok = await promptInstall(); if (ok) m?.close(); } }, 'Install Phoenix'));
    } else if (isIOS) {
      body.append(el('p', {}, isSafari ? 'On iPhone and iPad, three taps in Safari:' : 'Open this page in Safari to install (iPhone and iPad only allow it there).'),
        isSafari ? el('ol', {}, el('li', {}, 'Tap the ', el('strong', {}, 'Share'), ' button (a square with an arrow).'), el('li', {}, 'Scroll down and tap ', el('strong', {}, 'Add to Home Screen'), '.'), el('li', {}, 'Tap ', el('strong', {}, 'Add'), '. Phoenix now sits with your other apps.')) : null);
    } else if (/firefox/i.test(ua) && !/android/i.test(ua)) {
      body.append(el('p', {}, 'Firefox on a computer cannot install web apps. Open this page in Edge or Chrome to install Phoenix, or carry on using it right here.'));
    } else {
      body.append(el('p', {}, 'Your browser will offer the install in a moment. If it does not, open the browser menu and choose ', el('strong', {}, 'Install Phoenix'), ' or ', el('strong', {}, 'Add to Home screen'), '. Phoenix may also already be installed: look in your Start menu or Apps list.'));
    }
  };
  m = modal({ title: 'Install Phoenix', body, actions: [{ label: 'Not now' }], onClose: () => off?.() });
  off = onInstallStateChange(draw);
  draw();
}
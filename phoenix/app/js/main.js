// Phoenix: entry point. Small hash router, header, first-run welcome, offline support.
import { $, el, modal, bus } from './util.js';
import { state, save, flush } from './store.js';
import { phoenixSVG } from './mascot.js';
import { openHelp } from './crisis.js';
import { mountChat, leaveChat } from './chat.js';
import { mountToolkit, leaveTools } from './tools.js';
import { mountLearn } from './learn.js';
import { mountSettings } from './settings.js';
import { applyLook, openAccessibility } from './accessibility.js';
import { initInstall, wireInstallButton, wireInstallInvite, isStandalone, openInstallSheet, registerServiceWorker } from './install.js';
import { mountCheckin, leaveCheckin } from './checkin.js';
import { initReminders } from './reminders.js';
import { openDonate, checkDonateNudge } from './donate.js';
import { trackStart } from './analytics.js';
import { flushShared } from './share.js';
import { checkedInToday } from './sixpf.js';

const NAV = [['chat', 'Chat'], ['checkin', 'Check-in'], ['tools', 'Toolkit'], ['learn', 'Learn'], ['settings', 'Settings']];
const view = $('#view');
const nav = $('#nav');
let renderedHash = null;

/** Route strings used across the app: chat, checkin, checkin:new|insights|history, learn, learn:<id>, settings, settings:ai, settings:reminders, tool:home, tool:<id>, help. */
export function navigate(route) {
  if (route === 'help') return openHelp();
  const hash = route === 'chat' ? '#/chat' : route === 'learn' ? '#/learn' : route.startsWith('learn:') ? '#/learn/' + route.slice(6) : route === 'settings' ? '#/settings'
    : route === 'settings:ai' ? '#/settings/ai' : route === 'settings:reminders' ? '#/settings/reminders' : route === 'settings:share' ? '#/settings/share'
    : route === 'checkin' ? '#/checkin' : route.startsWith('checkin:') ? '#/checkin/' + route.slice(8)
    : route.startsWith('tool:') ? '#/tools/' + route.slice(5) : '#/chat';
  if (location.hash !== hash) location.hash = hash;
  render(); // synchronous, so callers can use the new screen straight away (for example to prefill the chat box)
}

function parse() {
  const [, a = 'chat', b = ''] = location.hash.split('/');
  return { area: NAV.some(([k]) => k === a) ? a : 'chat', sub: b };
}

function drawNav(area) {
  nav.textContent = '';
  for (const [k, label] of NAV) {
    const b = el('button', { onclick: () => navigate(k === 'tools' ? 'tool:home' : k) }, label);
    if (k === area) b.setAttribute('aria-current', 'page');
    if (k === 'checkin' && !checkedInToday(state.wellness)) { b.append(el('span', { class: 'nav-dot', 'aria-hidden': 'true' })); b.setAttribute('aria-label', 'Check-in, not done today'); }
    nav.append(b);
  }
}

/** Show or hide the small red dot on the Check-in tab as check-ins are saved or deleted. */
function updateDot() {
  const b = [...nav.querySelectorAll('button')].find((x) => x.textContent.startsWith('Check-in'));
  if (!b) return;
  const need = !checkedInToday(state.wellness), dot = b.querySelector('.nav-dot');
  if (need && !dot) { b.append(el('span', { class: 'nav-dot', 'aria-hidden': 'true' })); b.setAttribute('aria-label', 'Check-in, not done today'); }
  if (!need && dot) { dot.remove(); b.removeAttribute('aria-label'); }
}
bus.on('change', updateDot);

function render() {
  const { area, sub } = parse();
  leaveChat(); leaveTools(); leaveCheckin();
  view.scrollTop = 0;
  drawNav(area);
  document.title = { chat: 'Phoenix', checkin: 'Check-in · Phoenix', tools: 'Toolkit · Phoenix', learn: 'Learn · Phoenix', settings: 'Settings · Phoenix' }[area];
  if (area === 'chat') mountChat(view, { navigate });
  else if (area === 'checkin') mountCheckin(view, { navigate, sub });
  else if (area === 'tools') mountToolkit(view, { navigate, tool: sub || 'home' });
  else if (area === 'learn') mountLearn(view, { navigate, open: sub });
  else if (area === 'settings') mountSettings(view, { focus: sub });
  renderedHash = location.hash;
}

function welcome() {
  const big = phoenixSVG(4); big.style.setProperty('--ph-size', '110px');
  const m = modal({
    title: 'Welcome to Phoenix',
    body: el('div', { class: 'stack' },
      el('div', { style: { textAlign: 'center' } }, big),
      el('p', {}, 'Phoenix is a free, neuro-affirming AI assistant for Autistic, ADHD and other neurodivergent people. You do not have to mask here, explain yourself, or be “fine”.'),
      el('ul', {},
        el('li', {}, el('strong', {}, 'Private. '), 'Your chats, check-ins and settings are stored on this device, and there is no account. NeuroHub counts anonymous app opens (no identifiers, nothing you write). You can switch that off in Settings.'),
        el('li', {}, el('strong', {}, 'Honest. '), 'Phoenix is a computer program, not a person or a therapist, and it cannot diagnose you.'),
        el('li', {}, el('strong', {}, 'Free AI, no setup. '), 'Phoenix starts with its free AI, run by NeuroHub Community, with a daily limit. Your messages go to NeuroHub’s server and on to Claude to write a reply. They are not stored or read, but please avoid names and identifying details. To keep everything on your device, choose the built-in helper below (or any time in Settings), or connect an AI on your own computer or your own key. The built-in helper and Toolkit work with no internet.'),
        el('li', {}, el('strong', {}, 'Safety first. '), 'The red Help button is always there and shows helplines for your country.')),
      el('p', { class: 'muted small' }, 'Next, Phoenix will ask what you would like to be called.')),
    actions: [
      { label: 'Start with the built-in helper', onclick: () => { state.onboarded = true; state.provider.kind = 'offline'; save(); render(); } },
      { label: 'Connect my own AI', onclick: () => { state.onboarded = true; save(); navigate('settings:ai'); } },
      { label: 'Chat with Phoenix AI (recommended)', class: 'btn-primary', onclick: () => { state.onboarded = true; state.provider.kind = 'shared'; save(); render(); } },
    ],
    onClose: () => { if (!state.onboarded) { state.onboarded = true; save(); } },
  });
  return m;
}

// ---------------------------------------------------------------- boot
applyLook();
$('#brand').prepend((() => { const m = phoenixSVG(4); m.style.setProperty('--ph-size', '38px'); return m; })());
$('#help-btn').addEventListener('click', () => openHelp());
$('#donate-btn').addEventListener('click', () => openDonate());
$('#a11y-btn').addEventListener('click', () => openAccessibility());
// Alt + A opens accessibility from anywhere.
document.addEventListener('keydown', (e) => { if (e.altKey && !e.ctrlKey && !e.metaKey && e.key.toLowerCase() === 'a') { e.preventDefault(); openAccessibility(); } });
window.addEventListener('hashchange', () => { if (location.hash !== renderedHash) render(); });
document.addEventListener('click', (e) => {
  // External links open outside the app (the desktop app blocks in-app navigation).
  const a = e.target.closest?.('a[href^="http"]');
  if (a && globalThis.phoenixNative?.openExternal) { e.preventDefault(); globalThis.phoenixNative.openExternal(a.href); }
});
window.addEventListener('beforeunload', flush);
// Always start on the chat screen, even after a refresh or when a browser restores an old address (for example #/settings).
// Only a home-screen shortcut or a tapped reminder notification (?source=shortcut / ?source=notify) opens somewhere else.
{
  const source = new URLSearchParams(location.search).get('source');
  if (!['shortcut', 'notify'].includes(source) && location.hash !== '#/chat') history.replaceState(null, '', location.pathname + location.search + '#/chat');
}
render();
if (!state.onboarded) welcome();

initReminders();
trackStart();
flushShared(); // if sharing is on and an earlier check-in could not be sent, try again now
// A gentle weekly donate reminder, shown a few seconds after opening (so it never competes with the first screen or the install card).
setTimeout(() => checkDonateNudge($('#donate-nudge-host')), 4000);
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.type === 'navigate' && /^#\//.test(e.data.hash || '')) location.hash = e.data.hash; });
// A deep link like #/checkin/new opened from a notification or shortcut is honoured by the router above.

// Installable and offline-capable web version (skipped inside the desktop app, which already ships every file).
initInstall();
wireInstallButton($('#install-btn'));
wireInstallInvite($('#install-invite-host'));
// Coming from the "Install" button on the website (?install=1): take them straight to the install steps for their device.
if (/[?&]install=1\b/.test(location.search) && !isStandalone() && !globalThis.phoenixNative) setTimeout(() => openInstallSheet(), 700);
registerServiceWorker();

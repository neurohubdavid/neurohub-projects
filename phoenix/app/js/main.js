// Phoenix: entry point. Small hash router, header, first-run welcome, offline support.
import { $, el, modal } from './util.js';
import { state, save, flush } from './store.js';
import { phoenixSVG } from './mascot.js';
import { openHelp } from './crisis.js';
import { mountChat, leaveChat } from './chat.js';
import { mountToolkit, leaveTools } from './tools.js';
import { mountLearn } from './learn.js';
import { mountSettings, applyLook } from './settings.js';

const NAV = [['chat', 'Chat'], ['tools', 'Toolkit'], ['learn', 'Learn'], ['settings', 'Settings']];
const view = $('#view');
const nav = $('#nav');
let renderedHash = null;

/** Route strings used across the app: chat, learn, settings, settings:ai, tool:home, tool:<id>, help. */
export function navigate(route) {
  if (route === 'help') return openHelp();
  const hash = route === 'chat' ? '#/chat' : route === 'learn' ? '#/learn' : route === 'settings' ? '#/settings'
    : route === 'settings:ai' ? '#/settings/ai' : route.startsWith('tool:') ? '#/tools/' + route.slice(5) : '#/chat';
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
    nav.append(b);
  }
}

function render() {
  const { area, sub } = parse();
  leaveChat(); leaveTools();
  view.scrollTop = 0;
  drawNav(area);
  document.title = { chat: 'Phoenix', tools: 'Toolkit · Phoenix', learn: 'Learn · Phoenix', settings: 'Settings · Phoenix' }[area];
  if (area === 'chat') mountChat(view, { navigate });
  else if (area === 'tools') mountToolkit(view, { navigate, tool: sub || 'home' });
  else if (area === 'learn') mountLearn(view, { navigate });
  else if (area === 'settings') mountSettings(view, { focus: sub });
  renderedHash = location.hash;
}

function welcome() {
  const big = phoenixSVG(4); big.style.setProperty('--ph-size', '110px');
  const name = el('input', { class: 'input', placeholder: 'Your name, or anything you like (optional)', maxlength: '40', autocomplete: 'off', 'aria-label': 'What should Phoenix call you?' });
  const m = modal({
    title: 'Welcome to Phoenix',
    body: el('div', { class: 'stack' },
      el('div', { style: { textAlign: 'center' } }, big),
      el('p', {}, 'Phoenix is a free, neuro-affirming AI assistant for Autistic, ADHD and other neurodivergent people. You do not have to mask here, explain yourself, or be “fine”.'),
      el('ul', {},
        el('li', {}, el('strong', {}, 'Private. '), 'Everything stays on this device. There is no account.'),
        el('li', {}, el('strong', {}, 'Honest. '), 'Phoenix is a computer program, not a person or a therapist, and it cannot diagnose you.'),
        el('li', {}, el('strong', {}, 'Bring your own AI. '), 'To talk freely, connect an AI you control: free and private on your own computer (Ollama), a free online tier, or your own paid key. You pay your provider directly, never Phoenix. Until then the built-in helper and Toolkit work with no internet.'),
        el('li', {}, el('strong', {}, 'Safety first. '), 'The red Help button is always there and shows helplines for your country.')),
      el('label', { class: 'field' }, 'What should Phoenix call you?', name)),
    actions: [
      { label: 'Start with the built-in helper', onclick: () => { state.profile.name = name.value.trim(); state.onboarded = true; save(); render(); } },
      { label: 'Connect my AI (recommended)', class: 'btn-primary', onclick: () => { state.profile.name = name.value.trim(); state.onboarded = true; save(); navigate('settings:ai'); } },
    ],
    onClose: () => { if (!state.onboarded) { state.onboarded = true; save(); } },
  });
  return m;
}

// ---------------------------------------------------------------- boot
applyLook();
$('#brand').prepend((() => { const m = phoenixSVG(4); m.style.setProperty('--ph-size', '38px'); return m; })());
$('#help-btn').addEventListener('click', () => openHelp());
window.addEventListener('hashchange', () => { if (location.hash !== renderedHash) render(); });
document.addEventListener('click', (e) => {
  // External links open outside the app (the desktop app blocks in-app navigation).
  const a = e.target.closest?.('a[href^="http"]');
  if (a && globalThis.phoenixNative?.openExternal) { e.preventDefault(); globalThis.phoenixNative.openExternal(a.href); }
});
window.addEventListener('beforeunload', flush);
render();
if (!state.onboarded) welcome();

// Offline support for the web version. Skipped inside the desktop app, which already ships every file.
if ('serviceWorker' in navigator && !globalThis.phoenixNative && location.protocol.startsWith('http')) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* not fatal */ });
}

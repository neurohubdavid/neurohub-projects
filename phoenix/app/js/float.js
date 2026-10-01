// Floating Phoenix. A small always-on-top window with the animated Phoenix and the same chat, that stays beside the person's work
// while the main Phoenix window is minimised (or hidden behind other windows), and goes home again when they come back.
//
// How it works, and its honest limits:
//  - It uses the browser's Document Picture-in-Picture window (Microsoft Edge and Google Chrome on a computer). Firefox, Safari and
//    phones do not have it, so the Float button is not shown there.
//  - A browser only allows that window to open when the person presses a button, never by itself. So the person presses Float, then
//    minimises Phoenix. Phoenix stays floating while the main window is out of sight, and closes the floating window when they return.
//  - Phoenix cannot see the person's screen or other programs. They tell it what they are doing, and it helps with that.
//  - It is the same chat, saved on this device in the same place, so nothing is lost when it moves between the two windows.
import { el, setUiDocument, toast, announce, bus } from './util.js';
import { state, save } from './store.js';
import { mountChat, leaveChat, setChatCompact, send, voiceChatStart, voiceChatStop, voiceChatActive } from './chat.js';
import { act, reactToDraft, trackWindow } from './mascot-live.js';
import { phoenixSVG } from './mascot.js';
import { openHelp } from './crisis.js';
import { openDonate } from './donate.js';
import { trackFeature } from './analytics.js';

export const floatSupported = () => typeof window !== 'undefined' && 'documentPictureInPicture' in window;

const COMPACT = [330, 520], WIDE = [420, 680]; // her window: just Phoenix and a bubble, or with the whole conversation
let pip = null;          // the floating window, while it is open
let sawHidden = false;   // has the main window been out of sight since the floating window opened?
let goMain = () => {};   // navigate in the main window
let nudgeTimer = null, lastNudge = 0;

export const floatIsOpen = () => !!pip;
/** The floating window itself, while it is open (her own speech recognition runs in it, so it keeps listening when the main window is minimised). */
export const floatWindow = () => pip;

/** A short, plain description of the person's activity, safe to show back and to send to the AI. */
export const cleanActivity = (s) => String(s || '').replace(/[\r\n\t<>`"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);

/** Opens the floating window. Must be called from a button press. Returns true if it opened. */
export async function openFloat({ navigate } = {}) {
  if (pip) { try { pip.focus(); } catch { /* ignore */ } return true; }
  if (!floatSupported()) { trackFeature('float_unsupported'); toast('Floating Phoenix needs Microsoft Edge or Google Chrome on a computer.', { icon: 'ℹ️', ms: 4200 }); return false; }
  if (navigate) goMain = navigate;
  let w;
  try { w = await window.documentPictureInPicture.requestWindow({ width: COMPACT[0], height: COMPACT[1], disallowReturnToOpener: true }); }
  catch (e) { toast('Your browser did not open the floating window. Press the Float button again.', { icon: '⚠️', ms: 4200 }); return false; }
  pip = w; sawHidden = document.visibilityState === 'hidden'; lastNudge = Date.now();
  copyLook(w);
  const app = w.document.createElement('div'); app.className = 'app float-app';
  const view = w.document.createElement('main'); view.className = 'view'; view.id = 'float-view';
  app.append(view); w.document.body.append(app);
  setUiDocument(w.document);
  setChatCompact(true);
  const comp = buildCompanion();
  view.append(comp.root);
  mountChat(comp.chatBox, { navigate: floatNavigate });
  comp.watch();
  trackWindow(w); // her eyes follow the pointer in her own window too
  setTimeout(() => act('wave', 1400), 450); // she waves hello when she appears
  w.addEventListener('pagehide', closed);
  trackFeature('float_open');
  startNudges();
  bus.emit('float');
  return true;
}

export function closeFloat() { try { pip?.close(); } catch { /* ignore */ } closed(); }

function closed() {
  if (!pip) return;
  pip = null; clearInterval(nudgeTimer); nudgeTimer = null;
  voiceChatStop(); setUiDocument(document); setChatCompact(false); leaveChat();
  trackFeature('float_close');
  bus.emit('float'); bus.emit('float:closed'); // the main window shows the chat again
}

/** The floating window looks like Phoenix does: same style sheets, theme, fonts and accessibility settings. */
function copyLook(w) {
  const d = w.document;
  for (const a of document.documentElement.attributes) d.documentElement.setAttribute(a.name, a.value);
  d.body.className = document.body.className; d.body.style.cssText = document.body.style.cssText;
  d.title = 'Phoenix';
  for (const l of document.querySelectorAll('link[rel="stylesheet"]')) { const n = d.createElement('link'); n.rel = 'stylesheet'; n.href = l.href; d.head.append(n); }
  for (const s of document.querySelectorAll('style')) d.head.append(s.cloneNode(true));
}

/** Help, donate and the helplines open in the floating window; everything else belongs to the main window. */
function floatNavigate(route) {
  if (route === 'help') return openHelp();
  if (route === 'donate') return openDonate();
  goMain(route);
  toast('Opened in the main Phoenix window. Bring it back up when you are ready.', { icon: '🪟', ms: 3600 });
}

// ---------------------------------------------------------------- "what are you doing?"
function activityBar() {
  const input = el('input', { class: 'input', maxlength: '120', autocomplete: 'off', 'aria-label': 'What are you doing right now?', placeholder: 'I’m working on…', value: state.float?.activity || '' });
  const set = (v) => {
    state.float ||= { activity: '', nudgeMins: 0, invited: false };
    state.float.activity = cleanActivity(v); input.value = state.float.activity; save();
    if (state.float.activity) { trackFeature('float_activity'); toast('Got it. I will keep that in mind.', { icon: '🪶', ms: 2200 }); announce('Saved what you are doing'); }
    else announce('Cleared');
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); set(input.value); } });
  return el('div', { class: 'float-activity' },
    el('label', { class: 'small' }, 'What are you doing? ', el('span', { class: 'muted' }, 'I can’t see your screen, so tell me and I’ll help with it.')),
    el('div', { class: 'composer-row' }, input,
      el('button', { class: 'btn btn-sm', type: 'button', onclick: () => set(input.value) }, 'Tell Phoenix'),
      el('button', { class: 'btn btn-sm btn-ghost', type: 'button', 'aria-label': 'Clear what I am doing', onclick: () => set('') }, '✕')));
}

// ---------------------------------------------------------------- gentle check-ins (off unless the person turns them on)
const NUDGES = ['How is it going? Want a hand with anything?', 'A small reminder: water, shoulders, breathing. No need to answer.', 'Still here if you want company while you work.', 'Is there a smaller first step I can help you find?'];
function startNudges() {
  clearInterval(nudgeTimer);
  if (!(state.float?.nudgeMins > 0)) return;
  nudgeTimer = setInterval(() => {
    if (!pip || Date.now() - lastNudge < state.float.nudgeMins * 60000) return;
    lastNudge = Date.now();
    const act = state.float.activity;
    showBubble(act ? `How is “${act}” going? Want a hand?` : NUDGES[Math.floor(Math.random() * NUDGES.length)]);
  }, 20000);
}
function showBubble(text) {
  const host = pip?.document.getElementById('float-view'); if (!host) return;
  host.querySelector('.float-bubble')?.remove();
  const b = el('div', { class: 'float-bubble', role: 'status' }, el('span', {}, text),
    el('span', { class: 'row-wrap' },
      el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => { b.remove(); send(state.float?.activity ? `I am working on: ${state.float.activity}. Could you help me with it?` : 'I could use some company while I work.'); } }, 'Yes please'),
      el('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => b.remove() }, 'I’m fine'),
      el('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: () => { state.float.nudgeMins = 0; save(); clearInterval(nudgeTimer); b.remove(); toast('No more check-ins.', { icon: '✓', ms: 2200 }); } }, 'Stop these')));
  (host.querySelector('.comp-stage') ? host.querySelector('.comp-stage').after(b) : host.prepend(b));
  act('wave', 1300);
  announce(text);
}
/** Shows a check-in message now (used by the timer, and by tests). */
export function floatNudgeNow() { if (!pip) return false; const act = state.float?.activity; showBubble(act ? `How is “${act}” going? Want a hand?` : NUDGES[0]); return true; }
export function setNudges(mins) {
  state.float ||= { activity: '', nudgeMins: 0, invited: false };
  state.float.nudgeMins = [0, 20, 30, 45, 60].includes(Number(mins)) ? Number(mins) : 0; save();
  if (state.float.nudgeMins) trackFeature('float_nudges_on');
  startNudges();
}

// ---------------------------------------------------------------- main window
/** Wires the "main window comes back, so Phoenix comes home" behaviour. Call once at start. */
export function initFloat({ navigate } = {}) {
  if (navigate) goMain = navigate;
  document.addEventListener('visibilitychange', () => {
    if (!pip) return;
    if (document.visibilityState === 'hidden') sawHidden = true;
    else if (sawHidden) closeFloat(); // the person is back: Phoenix returns to the main window
  });
}

/** What the main window's chat screen shows while Phoenix is floating. */
export function floatPlaceholder(container) {
  container.textContent = '';
  container.classList.remove('chat-view');
  const big = phoenixSVG(4); big.style.setProperty('--ph-size', '110px');
  container.append(el('div', { class: 'welcome float-home' }, big,
    el('h1', {}, 'Phoenix is floating on your screen'),
    el('p', {}, 'Minimise this window and Phoenix stays beside your work in her own small window, ready to help or just keep you company. When you come back to Phoenix, she comes home too.'),
    el('div', { class: 'row-wrap', style: { justifyContent: 'center' } }, el('button', { class: 'btn btn-primary', type: 'button', onclick: closeFloat }, 'Bring Phoenix back here'))));
}

/** The one-time invitation, shown to people who have installed Phoenix as an app on a computer that can float her. */
export function offerFloat(host, { navigate } = {}) {
  if (!host || !floatSupported() || state.float?.invited) return;
  const standalone = matchMedia('(display-mode: standalone)').matches;
  if (!standalone) return;
  const dismiss = () => { state.float ||= { activity: '', nudgeMins: 0, invited: false }; state.float.invited = true; save(); host.textContent = ''; };
  host.append(el('div', { class: 'install-invite float-invite', role: 'region', 'aria-label': 'Float Phoenix beside your work' },
    el('span', {}, 'Want Phoenix beside you while you work? Press Float, then minimise this window. She stays in a small window on top, to help with what you are doing or just chat.'),
    el('span', { class: 'row-wrap' },
      el('button', { class: 'btn btn-sm btn-primary', type: 'button', onclick: () => { dismiss(); openFloat({ navigate }); } }, 'Float Phoenix'),
      el('button', { class: 'btn btn-sm btn-ghost', type: 'button', onclick: dismiss }, 'Not now'))));
}

// ---------------------------------------------------------------- the companion: a big animated Phoenix you can talk to
const STATUS = { idle: 'Here when you need me', listening: 'Listening…', thinking: 'Thinking…', talking: 'Speaking…', happy: 'Glad to help', concerned: 'Here with you' };
const short = (s, n) => { const t = String(s || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…' : t; };

/** Builds the companion: a big Phoenix, a speech bubble with what she last said, a Talk button for a spoken conversation, and typing and the whole conversation when wanted. */
function buildCompanion() {
  const big = phoenixSVG(5); big.style.setProperty('--ph-size', '170px'); big.classList.add('comp-ph');
  const stage = el('div', { class: 'comp-stage' }, big);
  const you = el('p', { class: 'comp-you small muted' }), said = el('p', { class: 'comp-text' }, 'Hi. I am here. Press Talk and we can chat out loud, or type to me.');
  const bubble = el('div', { class: 'comp-bubble', role: 'log', 'aria-live': 'polite', 'aria-label': 'What Phoenix said' }, you, said);
  const status = el('div', { class: 'comp-status small muted', 'aria-hidden': 'true' }, STATUS.idle);
  const talk = el('button', { class: 'btn btn-primary comp-talk', type: 'button', 'aria-pressed': 'false' }, '🎤 Talk with Phoenix');
  const typeBtn = el('button', { class: 'btn comp-type-btn', type: 'button', 'aria-expanded': 'false' }, '⌨ Type');
  const chatBtn = el('button', { class: 'btn comp-chat-btn', type: 'button', 'aria-pressed': 'false' }, '💬 Conversation');
  const ta = el('textarea', { class: 'input', rows: '2', 'aria-label': 'Type to Phoenix', placeholder: 'Type to Phoenix…', maxlength: '4000' });
  const typeBox = el('form', { class: 'comp-typebox', hidden: true }, ta, el('button', { class: 'btn btn-purple', type: 'submit' }, 'Send it'));
  const chatBox = el('div', { class: 'view comp-chat', hidden: true });
  const rootEl = el('div', { class: 'companion', 'data-view': 'compact' }, stage, bubble, status, el('div', { class: 'comp-controls' }, talk, typeBtn, chatBtn), typeBox, activityBar(), chatBox);

  const drawTalk = () => { const on = voiceChatActive(); talk.textContent = on ? '⏹ Stop talking' : '🎤 Talk with Phoenix'; talk.setAttribute('aria-pressed', String(on)); talk.classList.toggle('on', on); };
  talk.addEventListener('click', async () => { if (voiceChatActive()) voiceChatStop(); else await voiceChatStart(); drawTalk(); });
  bus.on('voicechat', drawTalk);
  bus.on('chat:state', (st) => { status.textContent = STATUS[st] || ''; });

  typeBtn.addEventListener('click', () => { typeBox.hidden = !typeBox.hidden; typeBtn.setAttribute('aria-expanded', String(!typeBox.hidden)); if (!typeBox.hidden) ta.focus(); });
  const submit = () => { const v = ta.value.trim(); if (!v) return; ta.value = ''; reactToDraft(''); send(v); };
  typeBox.addEventListener('submit', (e) => { e.preventDefault(); submit(); });
  ta.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } });
  ta.addEventListener('input', () => reactToDraft(ta.value));

  chatBtn.addEventListener('click', () => {
    const toChat = rootEl.dataset.view !== 'chat';
    rootEl.dataset.view = toChat ? 'chat' : 'compact'; chatBox.hidden = !toChat; chatBtn.setAttribute('aria-pressed', String(toChat));
    try { pip?.resizeTo(...(toChat ? WIDE : COMPACT)); } catch { /* the browser may not allow resizing */ }
    if (toChat) { trackFeature('companion_chat_view'); const l = chatBox.querySelector('.chat-list'); if (l) l.scrollTop = l.scrollHeight; }
  });

  // what Phoenix last said (and what you said) is shown in the bubble, kept short; the whole conversation is one press away
  const refresh = () => {
    const msgs = [...chatBox.querySelectorAll('.chat-list .msg')], lastA = [...msgs].reverse().find((m) => m.classList.contains('assistant')), lastU = [...msgs].reverse().find((m) => m.classList.contains('user'));
    const aText = lastA?.querySelector('.bubble-text')?.innerText || '';
    const afterUser = lastU && lastA && (lastU.compareDocumentPosition(lastA) & Node.DOCUMENT_POSITION_PRECEDING);
    you.textContent = lastU ? `You: ${short(lastU.innerText, 90)}` : '';
    said.textContent = aText && !afterUser && aText.trim() !== '…' ? short(aText, 280) : lastU ? '…' : said.textContent;
  };
  return {
    root: rootEl, chatBox,
    watch() { const list = chatBox.querySelector('.chat-list'); if (!list) return; new (pip?.MutationObserver || MutationObserver)(refresh).observe(list, { childList: true, subtree: true, characterData: true }); refresh(); drawTalk(); },
  };
}

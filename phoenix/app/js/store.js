// Everything Phoenix remembers lives here, on this device only (localStorage). Nothing is uploaded anywhere by
// Phoenix itself. If you connect an online AI service, only the messages you send to Phoenix go to that service.
import { bus, uid } from './util.js';
import { normaliseProvider } from './provider-policy.js';

const KEY = 'phoenix.v1';

export const DEFAULTS = () => ({
  v: 1,
  onboarded: false,
  profile: { name: '', nameAsked: false, about: '', neurotypes: [] }, // nameAsked: Phoenix asks what to call someone once, on first meeting
  prefs: {
    theme: 'auto',          // auto | light | dark | calm
    motion: 'auto',         // auto | reduced | full
    textScale: 1,
    font: 'atkinson',       // atkinson | lexend | opendyslexic | system | serif | mono
    lineHeight: 1.6,        // 1.3 to 2.4
    letterSpacing: 0,       // em, 0 to 0.16
    wordSpacing: 0,         // em, 0 to 0.5
    underlineLinks: false,
    bigFocus: false,
    narrow: false,          // narrower reading column
    boldText: false,
    voicePitch: 1,
    voiceVolume: 1,
    replyLength: 'short',   // short | normal | detailed
    tone: 'gentle',         // gentle | direct | playful
    literal: false,         // literal language: no idioms, sarcasm or figures of speech
    voiceReplies: false,
    handsFree: false,
    voiceRate: 1,
    voiceName: '',
    voiceLang: 'en-GB',
    country: '',
    showMascot: true,
    focusChime: true,
    useSite: true,          // let the assistant draw on neurohubcommunity.org articles
    wakeWord: false,        // installed app only: listen for the word "Phoenix" to start a spoken conversation, see wake.js (off unless the person turns it on)
    donateReminders: true,  // a gentle reminder to donate, at most once a week, see donate.js
    analytics: true,       // share anonymous usage counts (app opens, installs) with NeuroHub, see analytics.js
    aiSeesCheckins: 'no',   // no | yes: may Phoenix AI read a summary of daily check-ins? Off unless the person turns it on.
  },
  share: { on: false, pid: '', since: '', pending: [], asked: false }, // optional anonymous sharing of check-in scores, off by default, see share.js
  donate: { firstSeen: 0, lastShown: 0, lastClick: 0 }, // timestamps for the weekly donate reminder
  wellness: [],            // 6PF-Wellness daily check-ins, see sixpf.js
  reports: [],              // reflection documents (6PF assessment, burnout plan, identity workbook), see reports.js
  float: { activity: '', nudgeMins: 0, invited: false }, // the floating Phoenix window, see float.js
  account: { token: '', email: '', signedInAt: 0, sync: true, memory: 'auto', base: '', lastSync: 0, scalarsAt: 0, scalarsHash: '', learnCount: 0 }, // the optional account, see account.js (the token stays on this device)
  memories: [],            // short notes Phoenix keeps for a signed-in person, see memory.js
  deleted: {},             // ids of things deleted, so a deletion reaches other devices when syncing
  reminders: { enabled: false, time: '10:00', lastShown: '', snoozedUntil: 0, launch: false },
  provider: {
    kind: 'shared',         // shared (Phoenix AI, run on NeuroHub's own Claude account, limited per day) | offline (the built-in helper, no AI). Nothing else exists.
  },
  chats: [],                // [{id, title, updated, messages:[{role, content, crisis?}]}]
  currentChat: null,
  checkins: [],             // [{ts, energy, sensory, social, mood, note}]
  tasks: [],                // [{id, title, created, steps:[{text, done}]}]
  plan: { signs: '', helps: '', avoid: '', tell: '', say: '' },
  voiceConsent: false,
});

function merge(base, extra) {
  if (Array.isArray(base) || typeof base !== 'object' || base === null) return extra ?? base;
  const out = { ...base };
  for (const k of Object.keys(extra || {})) {
    out[k] = k in base && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k]) ? merge(base[k], extra[k]) : extra[k];
  }
  return out;
}

// Where the data lives: in this browser (localStorage), on this device only. The browser is asked to keep it.

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return cleaned(merge(DEFAULTS(), JSON.parse(raw)));
  } catch { /* corrupt or blocked storage: start fresh */ }
  return DEFAULTS();
}
/** Older versions let people connect other AIs and store their own keys. Those settings are dropped, and the keys erased. */
function cleaned(s) { normaliseProvider(s); delete s.billing; if (!s.account || typeof s.account !== 'object') s.account = DEFAULTS().account; return s; }

export const state = load();

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 120);
}
export function flush() {
  clearTimeout(saveTimer);
  const text = JSON.stringify(state);
  try { localStorage.setItem(KEY, text); } catch (e) { console.warn('Could not save', e); }
  bus.emit('change');
}
window.addEventListener('pagehide', () => { clearTimeout(saveTimer); flush(); });
// Ask the browser not to evict our data when disk space is low.
try { navigator.storage?.persist?.(); } catch { /* not supported */ }


export function resetAll() {
  try { localStorage.removeItem(KEY); localStorage.removeItem('phoenix.tool.plan'); localStorage.removeItem('phoenix.site'); } catch { /* ignore */ }
  Object.assign(state, DEFAULTS());
  flush();
}

export function exportData() { return JSON.stringify(state, null, 2); }
export function importData(text) {
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) throw new Error('This does not look like a Phoenix backup.');
  Object.assign(state, merge(DEFAULTS(), parsed));
  flush();
}

// ---------------------------------------------------------------- conversations
export function newChat() {
  const c = { id: uid(), title: 'New chat', updated: Date.now(), messages: [] };
  state.chats.unshift(c);
  state.chats = state.chats.slice(0, 40);
  state.currentChat = c.id;
  save();
  return c;
}
export function currentChat() {
  return state.chats.find((c) => c.id === state.currentChat) || newChat();
}
export function markDeleted(id) { (state.deleted ||= {})[id] = Date.now(); }
export function deleteChat(id) {
  state.chats = state.chats.filter((c) => c.id !== id);
  markDeleted(id);
  if (state.currentChat === id) state.currentChat = state.chats[0]?.id || null;
  save();
}

/** The AI is Phoenix's own (shared) or none. There is nothing to connect and nothing to pay on the person's side. */
export const providerReady = () => state.provider.kind === 'shared';
export const aiActive = () => providerReady();
/** May the AI read a short summary of the daily check-ins? Only if the person chose "yes" in Settings. They are never sent by default. */
export function aiMaySeeCheckins() { return aiActive() && state.prefs.aiSeesCheckins === 'yes'; }
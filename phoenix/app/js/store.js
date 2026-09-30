// Everything Phoenix remembers lives here, on this device only (localStorage). Nothing is uploaded anywhere by
// Phoenix itself. If you connect an online AI service, only the messages you send to Phoenix go to that service.
import { bus, uid } from './util.js';

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
    donateReminders: true,  // a gentle reminder to donate, at most once a week, see donate.js
    analytics: true,       // share anonymous usage counts (app opens, installs) with NeuroHub, see analytics.js
    aiSeesCheckins: 'auto', // auto (only an AI on this computer) | yes | no: may the AI read a summary of daily check-ins?
  },
  share: { on: false, pid: '', since: '', pending: [], asked: false }, // optional anonymous sharing of check-in scores, off by default, see share.js
  donate: { firstSeen: 0, lastShown: 0, lastClick: 0 }, // timestamps for the weekly donate reminder
  wellness: [],            // 6PF-Wellness daily check-ins, see sixpf.js
  reports: [],              // reflection documents (6PF assessment, burnout plan, identity workbook), see reports.js
  reminders: { enabled: false, time: '10:00', lastShown: '', snoozedUntil: 0, launch: false },
  provider: {
    kind: 'shared',         // shared (Phoenix free AI, limited) | offline (built-in helper) | ollama | openai | anthropic. New people start on the free AI and can opt out in Settings.
    ollama: { url: 'http://localhost:11434', model: '' },
    openai: { preset: 'custom', baseUrl: '', key: '', model: '' },
    anthropic: { key: '', model: 'claude-sonnet-5-5' },
  },
  billing: {                // You pay your own AI provider directly. Phoenix only keeps rough local estimates.
    month: '', messages: 0, inTok: 0, outTok: 0,
    day: '', dayCount: 0, dailyLimit: 0,        // dailyLimit 0 = no cap
    inPerM: 0, outPerM: 0, currency: '$',       // prices per million tokens, typed in by the person from their provider's price page
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

// Where the data lives. In the desktop app the source of truth is a file in the person's app-data folder (see
// electron/main.cjs), which survives updates, reinstalls and cleared browser data; localStorage is only a mirror (the
// theme is applied from it before first paint). In a browser, localStorage is used, and the browser is asked to keep it.
const disk = globalThis.phoenixNative?.storage;

function load() {
  try {
    const fromDisk = disk?.loadSync?.();
    if (fromDisk) return merge(DEFAULTS(), JSON.parse(fromDisk));
    const raw = localStorage.getItem(KEY); // first run of the desktop app, or the web version
    if (raw) return merge(DEFAULTS(), JSON.parse(raw));
  } catch { /* corrupt or blocked storage: start fresh */ }
  return DEFAULTS();
}

export const state = load();

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 120);
}
export function flush() {
  clearTimeout(saveTimer);
  const text = JSON.stringify(state);
  try { disk?.save(text); } catch (e) { console.warn('Could not save to disk', e); }
  try { localStorage.setItem(KEY, text); } catch (e) { if (!disk) console.warn('Could not save', e); }
  bus.emit('change');
}
window.addEventListener('pagehide', () => { clearTimeout(saveTimer); try { disk?.saveSync?.(JSON.stringify(state)); } catch { /* ignore */ } flush(); });
// Ask the browser not to evict our data when disk space is low (web version; the desktop app writes a real file).
try { navigator.storage?.persist?.(); } catch { /* not supported */ }

export const storageInfo = () => { try { return disk?.info?.() || null; } catch { return null; } };
export const revealStorage = () => disk?.reveal?.();

export function resetAll() {
  try { localStorage.removeItem(KEY); localStorage.removeItem('phoenix.tool.plan'); localStorage.removeItem('phoenix.site'); } catch { /* ignore */ }
  Object.assign(state, DEFAULTS());
  try { disk?.wipe?.(); } catch { /* ignore */ }
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
export function deleteChat(id) {
  state.chats = state.chats.filter((c) => c.id !== id);
  if (state.currentChat === id) state.currentChat = state.chats[0]?.id || null;
  save();
}

export const providerReady = () => {
  const p = state.provider;
  if (p.kind === 'ollama') return !!p.ollama.model;
  if (p.kind === 'openai') return !!(p.openai.baseUrl && p.openai.model);
  if (p.kind === 'anthropic') return !!(p.anthropic.key && p.anthropic.model);
  if (p.kind === 'shared') return true; // Phoenix's own limited free AI: no key or model to set
  return false;
};
export const aiActive = () => providerReady();

// ---------------------------------------------------------------- pay-as-you-go accounting (estimates, on this device)
/** True when each message costs the person money (their own key with an online provider). Local Ollama and LM Studio are free. */
export function isPaidProvider() {
  const p = state.provider;
  if (p.kind === 'anthropic') return true;
  if (p.kind === 'openai') return !/^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(p.openai.baseUrl || '');
  return false;
}
/** True when the connected AI runs on this computer (Ollama, or an OpenAI-compatible server on localhost), so nothing leaves the device. */
export const aiIsLocal = () => aiActive() && (state.provider.kind === 'ollama' || (state.provider.kind === 'openai' && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(state.provider.openai.baseUrl || '')));
/** May the AI read a short summary of the daily check-ins? 'auto' means only an AI running on this computer. */
export function aiMaySeeCheckins() {
  const v = state.prefs.aiSeesCheckins;
  if (!aiActive() || v === 'no') return false;
  return v === 'yes' || aiIsLocal();
}
const estTokens =(chars) => Math.ceil(chars / 4); // rough rule of thumb for English; real counts differ
function rollover() {
  const b = state.billing, now = new Date();
  const month = `${now.getFullYear()}-${now.getMonth() + 1}`, day = now.toDateString();
  if (b.month !== month) { b.month = month; b.messages = 0; b.inTok = 0; b.outTok = 0; }
  if (b.day !== day) { b.day = day; b.dayCount = 0; }
}
/** Returns {ok:true} or {ok:false, message} if the person's own daily cap has been reached. */
export function checkBudget() {
  rollover();
  const b = state.billing;
  if (isPaidProvider() && b.dailyLimit > 0 && b.dayCount >= b.dailyLimit) return { ok: false, message: `You set a limit of ${b.dailyLimit} paid messages a day, and you have reached it. Phoenix stopped so you do not spend more than you meant to. You can change the limit in Settings, or use the free built-in helper and the Toolkit.` };
  return { ok: true };
}
export function recordUsage(inChars, outChars) {
  if (!isPaidProvider()) return;
  rollover();
  const b = state.billing;
  b.messages++; b.dayCount++; b.inTok += estTokens(inChars); b.outTok += estTokens(outChars);
  save();
}
export function estimatedCost() {
  const b = state.billing;
  if (!(b.inPerM > 0 || b.outPerM > 0)) return null;
  return (b.inTok / 1e6) * b.inPerM + (b.outTok / 1e6) * b.outPerM;
}
export function resetUsage() { const b = state.billing; b.messages = 0; b.inTok = 0; b.outTok = 0; b.dayCount = 0; save(); }
// "Phoenix": wake-word listening, for people who have installed Phoenix as an app and turned it on (it is off by default).
// While it is on, the microphone is open whenever the app is, waiting to hear the word "Phoenix" at the start of something said
// (like "Phoenix" or "Hey Phoenix, I feel overwhelmed"). Then Phoenix starts a spoken conversation. It uses the browser's own speech
// recognition, so there is no always-on code of Phoenix's own: in Chrome and Edge the browser sends what the microphone hears to
// Google or Microsoft to be turned into text while it listens (that is explained, and agreed to, before it can be switched on).
// Phoenix itself never records, keeps or sends any audio, and ignores everything said unless it begins with the wake word.
import { state, save } from './store.js';
import { createRecognizer, voiceSupport } from './voice.js';
import { bus, toast, modal, el } from './util.js';
import { trackFeature } from './analytics.js';
import { voiceAllowed, requireAccountForVoice } from './voice-gate.js';
import { ph } from './pronouns.js';

/** The installed app, or the Phoenix desktop program (which is always "installed"). */
export const isInstalled = () => !!globalThis.phoenixSpeech?.available || typeof matchMedia !== 'undefined' && (matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true);
/** Only for the installed app, on a browser with speech recognition. */
export const wakeSupported = () => voiceSupport.stt && isInstalled();
export const wakeEnabled = () => !!state.prefs.wakeWord && wakeSupported() && voiceAllowed();

const WAKE = /^(?:phoenix|phenix|fenix|feenix|phoenics|phoenice)$/i;
const GREET = /^(?:hey|hi|hello|ok|okay|yo|hiya|oi)$/i;
/** Does something said begin with "Phoenix" (or "Hey Phoenix")? Returns {rest} (anything said after it), or null. */
export function findWake(text) {
  const words = String(text || '').replace(/[’‘]/g, "'").trim().split(/\s+/).filter(Boolean);
  for (let i = 0; i < Math.min(words.length, 3); i++) {
    const w = words[i].replace(/[^A-Za-z']/g, '');
    if (WAKE.test(w) && words.slice(0, i).every((g) => GREET.test(g.replace(/[^A-Za-z']/g, '')))) return { rest: words.slice(i + 1).join(' ').replace(/^[,.:;!?\s-]+/, '').trim() };
  }
  return null;
}

let ctl = { onWake: () => {}, getWindow: () => null };
let on = false, rec = null, paused = false, errors = 0, timer = null;
export const wakeListening = () => on && !!rec;

function chime() {
  try {
    const A = window.AudioContext || window.webkitAudioContext; if (!A) return;
    const a = new A(), o = a.createOscillator(), g = a.createGain(); o.type = 'sine'; o.frequency.value = 880; g.gain.value = 0.06; o.connect(g); g.connect(a.destination);
    o.start(); g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.18); o.stop(a.currentTime + 0.2); setTimeout(() => a.close?.(), 400);
  } catch { /* a missing chime must never matter */ }
}

function begin() {
  if (!on || paused || rec || !voiceSupport.stt || !voiceAllowed()) return;
  rec = createRecognizer({
    lang: state.prefs.voiceLang || 'en-GB', win: ctl.getWindow?.() || null, continuous: true,
    onStart: () => { errors = 0; bus.emit('wake'); },
    onSegment: (t) => { if (paused) return; const f = findWake(t); if (f) trigger(f); },
    onEnd: () => { rec = null; bus.emit('wake'); if (on && !paused) { clearTimeout(timer); timer = setTimeout(begin, 400 + Math.min(errors, 5) * 1500); } },
    onError: (e) => {
      errors++;
      if (e === 'not-allowed' || e === 'service-not-allowed') { on = false; state.prefs.wakeWord = false; save(); bus.emit('wake'); toast(voiceSupport.onDevice ? ph('The microphone is switched off, so Phoenix cannot listen for {their} name. Turn it back on from the Phoenix icon near the clock, then switch this on again in Settings.') : ph('The microphone is blocked, so Phoenix cannot listen for {their} name. You can allow it in your browser’s site settings and turn it on again in Settings.'), { icon: '🎤', ms: 6500 }); }
    },
  });
  rec?.start();
}

function trigger(f) {
  paused = true; const r = rec; rec = null; try { r?.abort(); } catch { /* ignore */ }
  chime(); trackFeature('wake_word'); bus.emit('wake');
  Promise.resolve(ctl.onWake(f.rest)).catch(() => {}).finally(() => { if (!ctl.busy?.()) resumeWake(); }); // if no conversation started, go back to listening
}

export function pauseWake() { paused = true; clearTimeout(timer); try { rec?.abort(); } catch { /* ignore */ } rec = null; bus.emit('wake'); }
export function resumeWake() { paused = false; if (on) { clearTimeout(timer); timer = setTimeout(begin, 700); } }
/** Start again in the right window (the floating Phoenix has her own, which keeps listening when the main window is minimised). */
export function restartWake() { if (!on) return; const was = paused; pauseWake(); paused = was; if (!was) resumeWake(); }

/** Set up once. onWake(rest) starts the conversation; getWindow() gives the floating window while it is open; busy() says if a conversation is going. */
export function initWake(handlers) {
  ctl = { ...ctl, ...handlers };
  if (wakeEnabled()) { on = true; paused = false; begin(); }
  bus.on('account', () => { if (!voiceAllowed()) { pauseWake(); } else if (state.prefs.wakeWord && wakeSupported()) { on = true; paused = false; begin(); } bus.emit('wake'); }); // signing out stops her listening; signing in again starts it if it was on
}

/** Switch it on, after saying plainly what it does. Must follow a button press. Resolves true if it is now on. */
export function enableWake() {
  if (!wakeSupported()) return Promise.resolve(false);
  if (!requireAccountForVoice()) return Promise.resolve(false); // voice chat is for people with an account
  if (on) return Promise.resolve(true);
  return new Promise((resolve) => {
    let done = false; const finish = (v) => { if (!done) { done = true; resolve(v); } };
    modal({
      title: 'Listen for “Phoenix”?', onClose: () => finish(false),
      body: el('div', { class: 'stack' },
        el('p', {}, ph('When this is on, your microphone stays open while Phoenix is open, waiting to hear the word “Phoenix”. Say “Phoenix” (or “Hey Phoenix”) and {they} {start|starts} a spoken conversation with you.')),
        el('ul', {},
          voiceSupport.onDevice ? el('li', {}, 'Listening happens on this computer: what the microphone hears is turned into text here, offline, and is never sent anywhere. The microphone is only used while Phoenix is listening, and you can switch it off for good from the Phoenix icon near the clock.') : el('li', {}, ph('In Chrome and Edge, what the microphone hears is sent to Google or Microsoft to be turned into text, all the time it is listening, not only after you say {their} name.')),
          el('li', {}, ph('Phoenix does not record or keep any audio, and ignores everything unless it starts with {their} name.')),
          el('li', {}, voiceSupport.onDevice ? 'Please do not turn this on where private conversations could be overheard.' : 'Your browser shows that the microphone is in use. Please do not turn this on where private conversations could be overheard.'),
          el('li', {}, 'You can turn it off at any time here or in Settings.'))),
      actions: [{ label: 'No thanks', onclick: () => finish(false) }, { label: 'Turn it on', class: 'btn-primary', onclick: () => { state.voiceConsent = true; state.prefs.wakeWord = true; save(); on = true; paused = false; trackFeature('wake_on'); begin(); bus.emit('wake'); finish(true); } }],
    });
  });
}

export function disableWake() {
  on = false; paused = false; clearTimeout(timer); try { rec?.abort(); } catch { /* ignore */ } rec = null;
  state.prefs.wakeWord = false; save(); trackFeature('wake_off'); bus.emit('wake');
}

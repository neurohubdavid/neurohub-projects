// Voice for Phoenix, using the browser's built-in speech recognition and speech synthesis.
// - Opt-in only. Nothing listens or speaks until the person turns it on.
// - Speaking replies out loud works almost everywhere, including the desktop app, and stays on the device.
// - Listening (speech to text) works in Chrome, Edge and Safari. In Chrome and Edge the audio is sent to Google or
//   Microsoft to be transcribed. It does NOT work inside the desktop app (Electron has no speech service), so there
//   the app hides the microphone and suggests Windows dictation (Win + H) or macOS dictation instead.
import { plain } from './util.js';

const SR = globalThis.SpeechRecognition || globalThis.webkitSpeechRecognition;
const inDesktopApp = !!globalThis.phoenixNative;
export const voiceSupport = { stt: !!SR && !inDesktopApp, tts: 'speechSynthesis' in globalThis, desktop: inDesktopApp };

// ---------------------------------------------------------------- speech to text
export function createRecognizer({ lang = 'en-GB', onStart, onInterim, onEnd, onError }) {
  if (!voiceSupport.stt) return null;
  const rec = new SR();
  rec.lang = lang;
  rec.interimResults = true;
  rec.continuous = false;
  rec.maxAlternatives = 1;
  let finalText = '';
  let gotFinal = false;
  rec.onstart = () => onStart?.();
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i][0].transcript;
      if (e.results[i].isFinal) { finalText += t; gotFinal = true; } else interim += t;
    }
    onInterim?.((finalText + interim).trim());
  };
  rec.onerror = (e) => onError?.(e.error || 'error');
  rec.onend = () => { const text = finalText.trim(); onEnd?.({ text, gotFinal: gotFinal && !!text }); };
  return {
    start() { finalText = ''; gotFinal = false; try { rec.start(); } catch { /* already started */ } },
    stop() { try { rec.stop(); } catch { /* ignore */ } },
    abort() { try { rec.abort(); } catch { /* ignore */ } },
  };
}

// ---------------------------------------------------------------- text to speech
let voicesCache = [];
function refreshVoices() { if (voiceSupport.tts) voicesCache = speechSynthesis.getVoices(); return voicesCache; }
if (voiceSupport.tts) { refreshVoices(); speechSynthesis.addEventListener?.('voiceschanged', refreshVoices); }
export const allVoices = () => (voiceSupport.tts ? refreshVoices().slice() : []);
export const listVoices =(lang = 'en') => refreshVoices().filter((v) => v.lang?.toLowerCase().startsWith(lang.toLowerCase().slice(0, 2)));

/** Removes things that read badly aloud: URLs, markdown and emoji. */
export function speakable(text) {
  return plain(text)
    .replace(/https?:\/\/\S+/g, 'the link on screen')
    .replace(/[*_`#>]/g, '')
    .replace(/^[-•] /gm, '')
    .replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * A speaker that can be fed streamed text. Complete sentences are queued as they arrive, so Phoenix starts
 * speaking before the whole reply has been written.
 */
export function createSpeaker({ getSettings, onSpeakingChange, onWord }) {
  let buffer = '';
  let active = 0;
  let stopped = false;
  const setActive = (n) => {
    const was = active > 0;
    active = n;
    if ((active > 0) !== was) onSpeakingChange?.(active > 0);
  };

  function utter(text) {
    if (!voiceSupport.tts || !text.trim()) return;
    const s = getSettings();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = Math.min(2, Math.max(0.5, s.voiceRate || 1));
    u.pitch = Math.min(2, Math.max(0.1, s.voicePitch || 1));
    u.volume = Math.min(1, Math.max(0.05, s.voiceVolume ?? 1));
    u.lang = s.voiceLang || 'en-GB';
    const v = refreshVoices().find((x) => x.name === s.voiceName) || refreshVoices().find((x) => x.lang === u.lang && x.localService) || refreshVoices().find((x) => x.lang?.startsWith('en'));
    if (v) u.voice = v;
    setActive(active + 1);
    u.onend = u.onerror = () => setActive(Math.max(0, active - 1));
    u.onboundary = (e) => { if (e.name === 'word') onWord?.(); }; // not every voice fires this; the talking animation works without it
    speechSynthesis.speak(u);
  }

  function flush(force) {
    const re = /([^.!?\n]+[.!?]+["')\]]*\s|[^\n]+\n)/g;
    let m, last = 0;
    while ((m = re.exec(buffer))) { utter(speakable(m[0])); last = re.lastIndex; }
    buffer = buffer.slice(last);
    if (force && buffer.trim()) { utter(speakable(buffer)); buffer = ''; }
  }

  return {
    push(delta) { if (stopped) return; buffer += delta; flush(false); },
    end() { if (!stopped) flush(true); },
    speakNow(text) { this.stop(); stopped = false; buffer = text; flush(true); },
    stop() { stopped = true; buffer = ''; if (voiceSupport.tts) speechSynthesis.cancel(); setActive(0); },
    reset() { stopped = false; buffer = ''; },
    get speaking() { return active > 0; },
  };
}

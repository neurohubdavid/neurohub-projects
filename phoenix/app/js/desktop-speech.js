// Speech recognition inside the Phoenix desktop program. That program cannot use the browser's own speech recognition (it needs Google's
// servers), so it offers an offline engine instead, through window.phoenixSpeech (put there by the program's own preload script, and
// nowhere else). This file makes that look like the browser's SpeechRecognition, so the rest of Phoenix (the mic button, spoken
// conversations, "Phoenix" wake word) works the same everywhere. The audio is turned into text on this computer and goes nowhere.

const bridge = () => (globalThis.phoenixSpeech && globalThis.phoenixSpeech.available ? globalThis.phoenixSpeech : null);
export const desktopSpeechAvailable = () => !!bridge();

const ERRORS = { engine: 'service-not-allowed', aborted: 'aborted' }; // anything else (not-allowed, no-speech, audio-capture) already matches the browser's names
const result = (text, isFinal) => { const r = [{ transcript: text, confidence: isFinal ? 0.9 : 0.5 }]; r.isFinal = isFinal; r.item = (i) => r[i]; return r; };

/** A SpeechRecognition look-alike, or null when this is not the desktop program. */
export function desktopRecognitionClass() {
  if (!bridge()) return null;
  return class DesktopRecognition {
    constructor() {
      this.lang = 'en-GB'; this.interimResults = true; this.continuous = false; this.maxAlternatives = 1;
      this.onstart = this.onaudiostart = this.onresult = this.onerror = this.onend = null;
      this._id = null; this._off = null; this._finals = []; this._over = true;
    }
    start() {
      if (!this._over) throw new DOMException('already started', 'InvalidStateError');
      this._over = false; this._finals = [];
      this._off = bridge().on((ev) => this._handle(ev));
      this._id = bridge().start({ continuous: this.continuous });
    }
    stop() { if (!this._over) bridge().stop(this._id); } // finishes what was being said, then ends
    abort() { if (!this._over) { bridge().abort(this._id); this._finish(); } }
    _handle(ev) {
      if (!ev || ev.id !== this._id || this._over) return;
      if (ev.type === 'start') this.onstart?.({});
      else if (ev.type === 'audiostart') this.onaudiostart?.({});
      else if (ev.type === 'partial') { if (this.interimResults && ev.text) this._emit(ev.text, false); }
      else if (ev.type === 'final') { if (ev.text) { this._finals.push((this._finals.length ? ' ' : '') + ev.text); this._emit(null, true); } }
      else if (ev.type === 'error') this.onerror?.({ error: ERRORS[ev.error] || ev.error });
      else if (ev.type === 'end') this._finish();
    }
    // like Chrome: the list holds every finished stretch so far, and resultIndex says where the news starts
    _emit(interim, isFinal) {
      const results = this._finals.map((t) => result(t, true));
      let resultIndex = this._finals.length - 1;
      if (!isFinal) { resultIndex = this._finals.length; results.push(result((this._finals.length ? ' ' : '') + interim, false)); }
      results.item = (i) => results[i];
      this.onresult?.({ resultIndex, results });
    }
    _finish() { if (this._over) return; this._over = true; try { this._off?.(); } catch { /* ignore */ } this._off = null; this.onend?.({}); }
  };
}

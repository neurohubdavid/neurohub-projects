// Accessibility and appearance: one panel, used from the header button and from Settings.
// Everything here is applied instantly and saved on the device. theme-boot.js applies the same settings before first
// paint so there is no flash of the wrong look.
import { el, modal, toast } from './util.js';
import { trackFeature } from './analytics.js';
import { state, save } from './store.js';
import { voiceSupport, listVoices, allVoices } from './voice.js';

export const FONTS = {
  atkinson: { label: 'Atkinson Hyperlegible (default)', stack: "'Atkinson Hyperlegible', system-ui, 'Segoe UI', Roboto, sans-serif", display: "'Lilita One', 'Atkinson Hyperlegible', system-ui, sans-serif" },
  lexend: { label: 'Lexend (easy to read)', stack: "'Lexend', system-ui, 'Segoe UI', sans-serif" },
  opendyslexic: { label: 'OpenDyslexic', stack: "'OpenDyslexic', 'Comic Sans MS', sans-serif" },
  system: { label: 'My device’s own font', stack: "system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif" },
  serif: { label: 'Serif (Georgia)', stack: "Georgia, 'Times New Roman', serif" },
  mono: { label: 'Monospace', stack: "ui-monospace, Consolas, 'Courier New', monospace" },
};

export const PRESETS = [
  { id: 'default', label: 'Default', set: { theme: 'auto', font: 'atkinson', textScale: 1, lineHeight: 1.6, letterSpacing: 0, wordSpacing: 0, underlineLinks: false, bigFocus: false, narrow: false, boldText: false, motion: 'auto' } },
  { id: 'dyslexia', label: 'Dyslexia-friendly', set: { font: 'lexend', textScale: 1.15, lineHeight: 1.9, letterSpacing: 0.05, wordSpacing: 0.2, narrow: true, underlineLinks: true } },
  { id: 'lowvision', label: 'Low vision', set: { theme: 'contrast', font: 'atkinson', textScale: 1.5, lineHeight: 1.7, letterSpacing: 0.03, wordSpacing: 0.1, underlineLinks: true, bigFocus: true, boldText: false } },
  { id: 'calm', label: 'Calm and quiet', set: { theme: 'calm', motion: 'reduced', textScale: 1.05, lineHeight: 1.75, narrow: true } },
];

/** Applies the saved look to the page. Safe to call any time. */
export function applyLook() {
  const r = document.documentElement, p = state.prefs;
  const f = FONTS[p.font] || FONTS.atkinson;
  if (p.theme === 'auto') delete r.dataset.theme; else r.dataset.theme = p.theme;
  if (p.motion === 'auto') delete r.dataset.motion; else r.dataset.motion = p.motion;
  r.style.setProperty('--scale', String(p.textScale || 1));
  r.style.setProperty('--font', f.stack);
  r.style.setProperty('--display', f.display || f.stack);
  r.style.setProperty('--lh', String(p.lineHeight || 1.6));
  r.style.setProperty('--ls', `${p.letterSpacing || 0}em`);
  r.style.setProperty('--ws', `${p.wordSpacing || 0}em`);
  const flag = (name, on) => { if (on) r.dataset[name] = on === true ? 'on' : on; else delete r.dataset[name]; };
  flag('links', p.underlineLinks ? 'underline' : false);
  flag('focus', p.bigFocus ? 'big' : false);
  flag('measure', p.narrow ? 'narrow' : false);
  flag('boldtext', p.boldText);
  try { document.querySelector('meta[name=theme-color]')?.setAttribute('content', getComputedStyle(document.body).backgroundColor); } catch { /* ignore */ }
}

const row = (label, hint, control, valueEl) => el('div', { class: 'a11y-row' },
  el('div', { class: 'a11y-label' }, el('strong', {}, label), valueEl || null, hint ? el('span', { class: 'muted small' }, hint) : null), control);

function slider({ label, hint, key, min, max, step, format = (v) => v, id }) {
  const out = el('span', { class: 'chip', 'aria-hidden': 'true' }, format(state.prefs[key]));
  const input = el('input', { type: 'range', class: 'range', id, min: String(min), max: String(max), step: String(step), value: String(state.prefs[key]), 'aria-label': label, 'aria-valuetext': String(format(state.prefs[key])) });
  input.addEventListener('input', () => { const v = Number(input.value); state.prefs[key] = v; out.textContent = format(v); input.setAttribute('aria-valuetext', String(format(v))); applyLook(); save(); });
  return { node: row(label, hint, input, out), input, out, key, format };
}
const seg = (options, get, set, label) => {
  const wrap = el('div', { class: 'seg', role: 'group', 'aria-label': label });
  const draw = () => { wrap.textContent = ''; for (const [v, l] of options) wrap.append(el('button', { 'aria-pressed': String(get() === v), onclick: () => { set(v); applyLook(); save(); draw(); } }, l)); };
  draw(); return wrap;
};
const toggle = (label, hint, get, set) => {
  const input = el('input', { type: 'checkbox', checked: !!get() });
  input.addEventListener('change', () => { set(input.checked); applyLook(); save(); });
  return row(label, hint, el('label', { class: 'switch' }, input, el('span', {}, 'On')));
};

/** The whole panel. `onChange` is called after a preset or reset so the caller can refresh anything it shows. */
export function buildAccessibilityPanel() {
  const root = el('div', { class: 'a11y stack' });
  const p = state.prefs;

  // live preview so people can see each change straight away
  const preview = el('div', { class: 'card a11y-preview' },
    el('h3', {}, 'Preview'),
    el('p', {}, 'This is how text will look. You are not broken, and you do not have to mask here. Take the words and the spacing that work for you.'),
    el('p', { class: 'muted' }, 'A second line, in muted colour, to check contrast.'),
    el('p', {}, el('a', { href: '#/learn' }, 'A sample link')));

  const sliders = [];
  const drawAll = () => { root.textContent = ''; build(); };

  function build() {
    const presets = el('div', { class: 'tags', role: 'group', 'aria-label': 'Presets' }, PRESETS.map((pr) =>
      el('button', { class: 'tag', onclick: () => { Object.assign(state.prefs, pr.set); applyLook(); save(); drawAll(); toast(`${pr.label} applied`, { ms: 1500 }); } }, pr.label)));

    const fontSel = el('select', { class: 'input', 'aria-label': 'Font' }, Object.entries(FONTS).map(([k, v]) => el('option', { value: k, selected: p.font === k }, v.label)));
    fontSel.addEventListener('change', () => { p.font = fontSel.value; applyLook(); save(); });

    const fmtPct = (v) => `${Math.round(v * 100)}%`;
    const fmtEm = (v) => `${Number(v).toFixed(2)} em`;
    const s = {
      size: slider({ id: 'a11y-size', label: 'Text size', hint: 'Makes everything bigger or smaller.', key: 'textScale', min: 0.85, max: 2, step: 0.05, format: fmtPct }),
      line: slider({ id: 'a11y-line', label: 'Line spacing', hint: 'Space between lines.', key: 'lineHeight', min: 1.3, max: 2.4, step: 0.05, format: (v) => Number(v).toFixed(2) }),
      letter: slider({ id: 'a11y-letter', label: 'Letter spacing', hint: 'Space between letters.', key: 'letterSpacing', min: 0, max: 0.16, step: 0.01, format: fmtEm }),
      word: slider({ id: 'a11y-word', label: 'Word spacing', hint: 'Space between words.', key: 'wordSpacing', min: 0, max: 0.5, step: 0.02, format: fmtEm }),
    };
    sliders.push(...Object.values(s));

    root.append(
      row('Quick presets', 'Start from a preset, then adjust.', presets),
      preview,
      el('h3', {}, 'Reading'),
      row('Font', 'Lexend and OpenDyslexic are designed to be easier for some readers. Try them and keep what helps.', fontSel),
      s.size.node, s.line.node, s.letter.node, s.word.node,
      toggle('Bold text', 'Heavier text everywhere.', () => p.boldText, (v) => (p.boldText = v)),
      toggle('Narrow reading column', 'Shorter lines are easier to track.', () => p.narrow, (v) => (p.narrow = v)),
      toggle('Underline links', 'Links are always underlined, not only coloured.', () => p.underlineLinks, (v) => (p.underlineLinks = v)),
      el('h3', {}, 'Colour and movement'),
      row('Theme', 'High contrast is black and white with strong yellow.', seg([['auto', 'Match my device'], ['light', 'Light'], ['dark', 'Dark'], ['calm', 'Calm'], ['contrast', 'High contrast']], () => p.theme, (v) => (p.theme = v), 'Theme')),
      row('Movement', 'Reduced turns off animation, including Phoenix’s.', seg([['auto', 'Match my device'], ['reduced', 'Reduced'], ['full', 'Full']], () => p.motion, (v) => (p.motion = v), 'Movement')),
      toggle('Larger keyboard focus outline', 'A thicker outline shows where you are when using the keyboard.', () => p.bigFocus, (v) => (p.bigFocus = v)),
      el('h3', {}, 'Voice'),
      voicePanel(),
      el('div', { class: 'row' }, el('button', { class: 'btn btn-sm', onclick: () => { Object.assign(state.prefs, PRESETS[0].set, { voiceRate: 1, voicePitch: 1, voiceVolume: 1, voiceName: '' }); applyLook(); save(); drawAll(); toast('Back to the defaults', { ms: 1500 }); } }, 'Reset accessibility settings')));
  }

  function voicePanel() {
    if (!voiceSupport.tts) return el('p', { class: 'muted' }, 'Spoken replies are not available in this browser.');
    const wrap = el('div', { class: 'stack' });
    const voices = allVoices();
    const sel = el('select', { class: 'input', 'aria-label': 'Voice' }, el('option', { value: '' }, 'Default voice'));
    const byLang = new Map();
    for (const v of voices) (byLang.get(v.lang) || byLang.set(v.lang, []).get(v.lang)).push(v);
    for (const [lang, list] of [...byLang].sort((a, b) => (a[0].startsWith('en') ? -1 : 1) - (b[0].startsWith('en') ? -1 : 1) || a[0].localeCompare(b[0]))) {
      sel.append(el('optgroup', { label: lang }, list.map((v) => el('option', { value: v.name, selected: v.name === p.voiceName }, `${v.name}${v.localService ? '' : ' (online)'}`))));
    }
    sel.addEventListener('change', () => { p.voiceName = sel.value; const v = voices.find((x) => x.name === sel.value); if (v) p.voiceLang = v.lang; save(); });
    if (!voices.length) wrap.append(el('p', { class: 'muted small' }, 'No voices were found on this device yet. Your system may still be loading them, so try again in a moment, or install a voice in your operating system’s speech settings.'));
    const rate = slider({ id: 'a11y-rate', label: 'Speaking speed', key: 'voiceRate', min: 0.6, max: 1.8, step: 0.05, format: (v) => `${Number(v).toFixed(2)}×` });
    const pitch = slider({ id: 'a11y-pitch', label: 'Pitch', key: 'voicePitch', min: 0.5, max: 1.6, step: 0.05, format: (v) => Number(v).toFixed(2) });
    const vol = slider({ id: 'a11y-vol', label: 'Volume', key: 'voiceVolume', min: 0.2, max: 1, step: 0.05, format: fmtPctVol });
    function fmtPctVol(v) { return `${Math.round(v * 100)}%`; }
    const test = el('button', { class: 'btn btn-sm btn-primary', onclick: () => sample() }, '▶ Hear a sample');
    const stop = el('button', { class: 'btn btn-ghost btn-sm', onclick: () => speechSynthesis.cancel() }, '⏹ Stop');
    function sample() {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance('Hello, I am Phoenix. This is how I sound. You can change my voice, speed and pitch.');
      u.rate = p.voiceRate; u.pitch = p.voicePitch; u.volume = p.voiceVolume; u.lang = p.voiceLang || 'en-GB';
      const v = voices.find((x) => x.name === p.voiceName); if (v) { u.voice = v; u.lang = v.lang; }
      speechSynthesis.speak(u);
    }
    const replies = el('input', { type: 'checkbox', checked: !!p.voiceReplies });
    replies.addEventListener('change', () => { p.voiceReplies = replies.checked; save(); });
    wrap.append(
      row('Read Phoenix’s replies aloud', 'Off by default. You can also switch it on in Chat.', el('label', { class: 'switch' }, replies, el('span', {}, 'On'))),
      row('Voice', 'Voices come from your device. Ones marked online may send text to your browser’s speech service.', sel),
      rate.node, pitch.node, vol.node, el('div', { class: 'row' }, test, stop));
    return wrap;
  }

  build();
  return root;
}

export function openAccessibility() {
  trackFeature('a11y_open');
  const body = buildAccessibilityPanel();
  modal({ title: 'Accessibility', body, wide: true, actions: [{ label: 'Done', class: 'btn-primary' }] });
}

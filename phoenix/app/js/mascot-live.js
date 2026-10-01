// Brings Phoenix to life: she leans in while you type, nods as you go, follows your pointer with her eyes, changes how she looks with
// what you say, and now and then does something of her own (looks around, preens, tilts her head). Everything is local and only
// moves the mascot; with reduced motion on, nothing moves and she just holds the pose that matches the feeling.
import { ui, prefersReducedMotion } from './util.js';
import { moodFor, replyMood, actFor, lookFor } from './mood.js';
import { isEmbedded } from './analytics.js';

// Inside the website widget's chat panel, Phoenix's state and mood are passed (as a few fixed words, never any text) to the page that
// holds the free-floating Phoenix, so she can react to the conversation. The mascot page itself turns this off.
let relayOn = true;
export const setRelay = (on) => { relayOn = !!on; };
export function relay(t, v) { try { if (relayOn && isEmbedded() && window.parent !== window) window.parent.postMessage({ phoenix: true, t, v }, '*'); } catch { /* never break the page */ } }
const mascots = () => (ui.doc ? [...ui.doc.querySelectorAll('.ph')] : []);
const timers = new Map();
const later = (key, fn, ms) => { clearTimeout(timers.get(key)); timers.set(key, setTimeout(fn, ms)); };

export function setMood(mood) { const m = lookFor(mood || 'neutral'); let changed = false; for (const n of mascots()) if (n.dataset.mood !== m) { n.dataset.mood = m; changed = true; } if (changed) relay('mood', m); }

/** A short action ('wave', 'preen', 'tilt', 'typing'); it ends by itself. */
export function act(name, ms = 1200) {
  if (prefersReducedMotion()) return;
  for (const n of mascots()) n.dataset.act = name;
  relay('act', name);
  later('act:' + name, () => { for (const n of mascots()) if (n.dataset.act === name) delete n.dataset.act; }, ms);
}

/** A tiny nod, for each key pressed or word heard. */
let lastNod = 0;
export function nod() {
  if (prefersReducedMotion()) return;
  const now = Date.now(); if (now - lastNod < 110) return; lastNod = now;
  for (const n of mascots()) { n.classList.remove('nod'); void n.getBoundingClientRect(); n.classList.add('nod'); }
  relay('nod', 1);
  later('nod', () => { for (const n of mascots()) n.classList.remove('nod'); }, 220);
}

/** Called as the person types or speaks (the draft text stays on the device). Phoenix leans in, nods, and takes on the feeling. */
let greeted = false;
export function reactToDraft(text) {
  const t = String(text || '');
  if (!t.trim()) { greeted = false; setMood('neutral'); for (const n of mascots()) delete n.dataset.act; return; }
  act('typing', 1300); nod();
  later('mood', () => {
    const m = moodFor(t); setMood(m);
    if (actFor(m) && !greeted) { greeted = true; act(actFor(m), 1300); }
  }, 350);
}

/** Phoenix hears something said aloud (interim speech results): nod, and take on the feeling. */
export function reactToSpeech(text) { nod(); const m = moodFor(text); setMood(m); if (actFor(m)) act(actFor(m), 1300); }

/** The person sent something: a little acknowledgement, and the feeling stays while Phoenix thinks. */
export function reactToSent(text) {
  const m = moodFor(text); setMood(m); nod(); greeted = false;
  if (actFor(m)) act(actFor(m), 1300); else act('tilt', 900);
}

/** Phoenix has finished replying: she shows the feeling of her reply for a few seconds, then settles. */
export function reactToReply(text) {
  const m = replyMood(text); setMood(m);
  later('settle', () => setMood('neutral'), m === 'neutral' ? 100 : 4200);
}

// ---------------------------------------------------------------- eyes that follow
let raf = 0, px = 0, py = 0, looking = false;
function look() {
  raf = 0; if (prefersReducedMotion()) return;
  for (const n of mascots()) {
    const r = n.getBoundingClientRect(); if (r.width < 8 || r.bottom < 0 || r.top > innerHeight) continue;
    const dx = px - (r.left + r.width * 0.55), dy = py - (r.top + r.height * 0.3), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
    n.style.setProperty('--px', (dx / d * 2.6 * k).toFixed(2) + 'px'); n.style.setProperty('--py', (dy / d * 2.2 * k).toFixed(2) + 'px');
  }
}
const track = (x, y) => { px = x; py = y; looking = true; if (!raf) raf = requestAnimationFrame(look); };
/** Where something is that she should look at (the website widget tells the mascot page where the visitor's pointer is). */
export const lookAtPoint = track;

// ---------------------------------------------------------------- things she does on her own
const IDLE = [['preen', 1500], ['tilt', 1400], ['look', 1600], ['look', 1600], ['stretch', 1800], ['peck', 1200], ['sparkle', 1500], ['yawn', 1900]];
function idleLoop() {
  const next = 6500 + Math.random() * 7000;
  setTimeout(() => {
    try {
      if (ui.doc.visibilityState !== 'hidden' && !prefersReducedMotion() && !ui.doc.activeElement?.matches?.('textarea, input')) {
        const lively = mascots().filter((n) => n.dataset.state === 'idle' && n.dataset.mood !== 'sad');
        if (lively.length) {
          const [name, ms] = IDLE[Math.floor(Math.random() * IDLE.length)];
          if (name === 'look') { const sx = (Math.random() < 0.5 ? -1 : 1) * (2 + Math.random()); for (const n of lively) { n.style.setProperty('--px', sx.toFixed(1) + 'px'); n.style.setProperty('--py', (Math.random() * 2 - 1).toFixed(1) + 'px'); } later('look', () => { looking = false; for (const n of lively) { n.style.removeProperty('--px'); n.style.removeProperty('--py'); } }, ms); }
          else act(name, ms);
        }
      }
    } catch { /* never break the page for an animation */ }
    idleLoop();
  }, next);
}

/** The floating window is a separate window, so it needs its own eyes-follow-the-pointer listeners. */
export function trackWindow(win) {
  try { win.addEventListener('pointermove', (e) => track(e.clientX, e.clientY), { passive: true }); win.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) track(t.clientX, t.clientY); }, { passive: true }); } catch { /* fine */ }
}

let started = false;
export function initLive() {
  if (started || typeof window === 'undefined') return; started = true;
  window.addEventListener('pointermove', (e) => track(e.clientX, e.clientY), { passive: true });
  window.addEventListener('touchstart', (e) => { const t = e.touches[0]; if (t) track(t.clientX, t.clientY); }, { passive: true });
  idleLoop();
}

// The free-floating animated Phoenix on a website that has added the widget (see scripts/site-assets/embed.js).
// This tiny page holds only the mascot. The widget script on the website tells it where the visitor's pointer is (so her eyes follow it)
// and what Phoenix in the chat panel is doing (thinking, talking, listening, her mood). Only those few fixed words are passed along:
// nothing the visitor types or Phoenix replies ever leaves the chat panel, so the website itself never sees a conversation.
import { phoenixSVG, setPhoenixState } from './mascot.js';
import { setMood, act, nod, lookAtPoint, initLive, setRelay } from './mascot-live.js';

const STATES = ['idle', 'listening', 'thinking', 'talking', 'happy', 'concerned'];
const MOODS = ['neutral', 'sad', 'calm', 'happy', 'curious', 'alert', 'greet'];
const ACTS = ['wave', 'preen', 'tilt', 'typing', 'stretch', 'peck', 'sparkle', 'yawn'];

setRelay(false); // this page only receives; it never sends anything back out
const ph = phoenixSVG(5);
document.getElementById('stage').append(ph);
initLive();
// hello, once she is there
setTimeout(() => act('wave', 1400), 500);

window.addEventListener('message', (e) => {
  if (e.source !== window.parent) return; // only the website's widget script may steer her
  const d = e.data; if (!d || typeof d !== 'object' || d.phoenix !== true) return;
  if (d.t === 'pointer' && Number.isFinite(d.x) && Number.isFinite(d.y)) lookAtPoint(Math.max(-5000, Math.min(5000, d.x)), Math.max(-5000, Math.min(5000, d.y)));
  else if (d.t === 'state' && STATES.includes(d.v)) setPhoenixState(ph, d.v);
  else if (d.t === 'mood' && MOODS.includes(d.v)) setMood(d.v);
  else if (d.t === 'act' && ACTS.includes(d.v)) act(d.v, 1300);
  else if (d.t === 'nod') nod();
});

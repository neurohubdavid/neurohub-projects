// Safety layer. This runs in the app itself, before and regardless of any AI, so a model can never switch it off.
// Deliberately broad: a false positive shows a supportive panel, a false negative could cost a life.
// Helpline data lives in app/data/crisis.json. It must be re-verified against each provider's own website.
import { el, modal } from './util.js';
import { state, save } from './store.js';

export { CRISIS_RE, EMERGENCY_RE, crisisText, crisisReply } from './safety.js';

let data = null;
export async function loadCrisis() {
  if (data) return data;
  const r = await fetch('data/crisis.json');
  data = await r.json();
  return data;
}

/** Best guess at the person's country without any network call: the browser locale (en-GB gives GB). */
export function guessCountry() {
  if (state.prefs.country) return state.prefs.country;
  const loc = (navigator.languages && navigator.languages[0]) || navigator.language || '';
  const m = /[-_]([A-Za-z]{2})\b/.exec(loc);
  return m ? m[1].toUpperCase() : '';
}

const firstNumber = (how) => {
  const m = /(\+?\d[\d\s-]{1,}\d)/.exec(how || '');
  return m ? m[1].replace(/[\s-]/g, '') : null;
};

function renderCountry(body, d, code) {
  body.textContent = '';
  const c = d.countries[code];
  body.append(el('div', { class: 'help-emergency' },
    el('strong', {}, 'In immediate danger? '), c ? `Call ${c.emergency}.` : d.fallbackEmergency));
  if (c) {
    body.append(el('p', { class: 'muted small' }, 'Text and chat options are listed first where they exist. You do not have to talk on the phone.'));
    for (const l of [...c.lines].sort((a, b) => (a.type === 'text' ? -1 : 1) - (b.type === 'text' ? -1 : 1))) {
      const num = /call/i.test(l.how) ? firstNumber(l.how) : null;
      body.append(el('div', { class: 'help-line' },
        el('div', { class: 'help-line-icon', 'aria-hidden': 'true' }, l.type === 'text' ? '💬' : '📞'),
        el('div', {}, el('strong', {}, l.name), el('div', {}, num ? el('a', { href: `tel:${num}` }, l.how) : l.how), el('div', { class: 'muted small' }, l.detail))));
    }
  } else {
    body.append(el('p', {}, 'There is no line for that place in Phoenix’s list. These directories cover most countries:'));
  }
  body.append(el('h3', { class: 'help-sub' }, c ? 'Other places to look' : 'Find a helpline anywhere'));
  for (const g of d.global) {
    body.append(el('div', { class: 'help-line' },
      el('div', { class: 'help-line-icon', 'aria-hidden': 'true' }, '🌍'),
      el('div', {}, el('a', { href: g.url, target: '_blank', rel: 'noopener noreferrer' }, g.name), el('div', { class: 'muted small' }, g.detail))));
  }
  body.append(el('p', { class: 'muted small help-foot' },
    'These details are given in good faith' + (d.lastReviewed ? ` and were last reviewed on ${d.lastReviewed}` : '') +
    '. Please check them yourself. Phoenix is not a crisis or medical service, and nobody is watching this conversation.'));
}

export async function openHelp() {
  const d = await loadCrisis();
  const body = el('div', { class: 'help-body' });
  const codes = Object.keys(d.countries).sort((a, b) => d.countries[a].name.localeCompare(d.countries[b].name));
  const start = guessCountry();
  const select = el('select', { id: 'help-country', 'aria-label': 'Where are you?' },
    el('option', { value: '' }, 'Somewhere else / not sure'),
    codes.map((c) => el('option', { value: c, selected: c === start }, d.countries[c].name)));
  select.addEventListener('change', () => { state.prefs.country = select.value; save(); renderCountry(body, d, select.value); });
  const wrap = el('div', {},
    el('p', {}, 'If things feel like too much right now, you deserve support from a real person. Where are you?'),
    el('label', { class: 'help-country', for: 'help-country' }, select),
    body);
  renderCountry(body, d, codes.includes(start) ? start : '');
  modal({ title: 'Get help now', body: wrap, wide: true, actions: [{ label: 'Close', class: 'btn-primary' }] });
}

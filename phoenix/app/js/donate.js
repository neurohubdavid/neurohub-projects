// Donations to NeuroHub Community, the Autistic-led social enterprise that makes Phoenix. Phoenix never handles money: every button is
// a plain link that opens a payment page hosted by Stripe (or NeuroHub's Ko-fi page) in the person's own browser. People can give once or
// every month, choose one of four suggested amounts, or type an amount of their own on the payment page.
import { el, modal } from './util.js';
import { track } from './analytics.js';
import { AMOUNTS, FREQUENCIES, KOFI, linkFor, usingStripe, clickKey } from './donate-links.js';
export { AMOUNTS, KOFI };
export const donateUrl = (amount, frequency = 'once') => linkFor(frequency, amount);

/** Remembers that someone opened the donate options, so the weekly reminder gives them a long rest. */
async function noteDonateClick() { try { const { state, save } = await import('./store.js'); state.donate ||= { firstSeen: 0, lastShown: 0, lastClick: 0 }; state.donate.lastClick = Date.now(); save(); } catch { /* ignore */ } }

export function openDonate() {
  let frequency = 'once';
  const amounts = el('div', { class: 'donate-amounts', role: 'group', 'aria-label': 'Suggested donation amounts' });
  const note = el('p', { class: 'small muted', 'aria-live': 'polite' });
  const choose = el('div', { class: 'seg', role: 'group', 'aria-label': 'How often' });
  const draw = () => {
    amounts.textContent = ''; choose.textContent = '';
    for (const f of FREQUENCIES) choose.append(el('button', { type: 'button', 'aria-pressed': String(f === frequency), onclick: () => { frequency = f; draw(); } }, f === 'once' ? 'Give once' : 'Give monthly'));
    const go = (a) => { track('donate_click', clickKey(frequency, a)); noteDonateClick(); };
    for (const a of AMOUNTS) amounts.append(el('a', { class: 'btn btn-lg donate-amt', onclick: () => go(a), href: linkFor(frequency, a), target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Give £${a}${frequency === 'monthly' ? ' every month' : ' once'} (opens the secure payment page in your browser)` }, [`£${a}`, frequency === 'monthly' ? el('small', { style: { display: 'block', fontWeight: 400, fontSize: '.7em' } }, 'a month') : null]));
    note.textContent = frequency === 'monthly'
      ? 'Monthly gifts are taken every month until you cancel, which you can do yourself at any time from the receipt email. For your own monthly amount, set the number of pounds on the payment page.'
      : 'A single gift. Nothing is taken again.';
  };
  draw();
  modal({
    title: '♥ Support NeuroHub Community',
    body: el('div', { class: 'stack' },
      el('p', {}, 'Phoenix is free, with no ads and no account. It is made by NeuroHub Community, a small Autistic-led social enterprise, and every Phoenix AI reply is paid for from our own Claude account. If Phoenix has helped and you can spare something, a donation helps cover the cost of keeping the AI live for everyone.'),
      choose, amounts,
      el('p', {}, el('a', { class: 'btn', onclick: () => { track('donate_click', clickKey(frequency, 'other')); noteDonateClick(); }, href: linkFor(frequency, 'other'), target: '_blank', rel: 'noopener noreferrer' }, 'Choose my own amount')),
      note,
      el('p', { class: 'small muted' }, usingStripe()
        ? 'Each button opens a secure payment page run by Stripe. The suggested amounts are already filled in, and you can change them there. Stripe handles the payment, not Phoenix, and no card details ever pass through this app.'
        : 'Each button opens NeuroHub’s donation page in your browser, where you choose the amount and can pay by card. No payment details ever pass through this app.'),
      el('p', { class: 'small' }, 'Prefer another way? ', el('a', { href: KOFI, target: '_blank', rel: 'noopener noreferrer', onclick: () => { track('donate_click', 'other'); noteDonateClick(); } }, 'Give through Ko-fi'), '. There is never any pressure: Phoenix works exactly the same either way.')),
    actions: [{ label: 'Maybe later' }],
  });
}

// ---------------------------------------------------------------- a gentle weekly reminder
const DAY = 86400000;
/**
 * Should the weekly "if you can, donate" card show now? Deliberately kind: not in the first week, at most once every 7 days,
 * never soon after a crisis message or on a very low day, not for 30 days after someone opens the donate options, and never
 * again once they turn it off. Pure, so it is unit tested.
 */
export function donateNudgeDue({ now = Date.now(), firstSeen = 0, lastShown = 0, lastClick = 0, enabled = true, recentCrisis = false, lowDay = false, otherBannerShowing = false } = {}) {
  if (!enabled || recentCrisis || lowDay || otherBannerShowing) return false;
  if (!firstSeen || now - firstSeen < 7 * DAY) return false;
  if (lastClick && now - lastClick < 30 * DAY) return false;
  return !lastShown || now - lastShown >= 7 * DAY;
}

/** Reads the app's state and, if it is time, shows the card in `host`. `force` is for tests. */
export async function checkDonateNudge(host, { force = false } = {}) {
  if (!host) return;
  const { state, save } = await import('./store.js');
  const now = Date.now();
  state.donate ||= { firstSeen: 0, lastShown: 0, lastClick: 0 };
  if (!state.donate.firstSeen) { state.donate.firstSeen = now; save(); }
  const lastWell = [...(state.wellness || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const ctx = {
    now, ...state.donate, enabled: state.prefs.donateReminders !== false,
    recentCrisis: (state.chats || []).some((c) => now - (c.updated || 0) < 3 * DAY && (c.messages || []).some((m) => m.crisis)),
    lowDay: !!lastWell && now - new Date(lastWell.createdAt) < 2 * DAY && lastWell.overallMood <= 2,
    otherBannerShowing: !!document.querySelector('.install-invite'),
  };
  if (!force && !donateNudgeDue(ctx)) return;
  state.donate.lastShown = now; save();
  host.textContent = '';
  const close = () => { host.textContent = ''; };
  host.append(el('div', { class: 'donate-nudge', role: 'region', 'aria-label': 'Support NeuroHub Community' },
    el('span', {}, 'Every Phoenix AI reply costs NeuroHub Community, a small Autistic-led social enterprise, real money, and donations are what keep the AI live for everyone. If Phoenix has helped and you can spare something, even a little or monthly, thank you. No pressure at all.'),
    el('span', { class: 'row-wrap' },
      el('button', { class: 'btn btn-sm', onclick: () => { close(); openDonate(); } }, '♥ Donate'),
      el('button', { class: 'btn btn-sm btn-ghost', onclick: close }, 'Not this week'),
      el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { state.prefs.donateReminders = false; save(); close(); } }, 'Don’t remind me'))));
}
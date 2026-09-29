// Donations to NeuroHub Community, the Autistic-led social enterprise that makes Phoenix. Phoenix never handles money:
// each amount is a plain link that opens NeuroHub's PayPal page in the person's own browser.
import { el, modal } from './util.js';
import { track } from './analytics.js';

// PayPal business page. It does not take an amount in the link, so the suggested amounts are shown as a guide and the person types
// the amount on PayPal. (A paypal.me link would allow the amount to be filled in; if NeuroHub gets one, change donateUrl.)
export const PAYPAL = 'https://paypal.biz/emergentdivergence';
export const KOFI = 'https://ko-fi.com/neurohubcommunity';
export const AMOUNTS = [5, 10, 25, 50];
export const donateUrl = () => PAYPAL;

/** Remembers that someone opened the donate options, so the weekly reminder gives them a long rest. */
async function noteDonateClick() { try { const { state, save } = await import('./store.js'); state.donate ||= { firstSeen: 0, lastShown: 0, lastClick: 0 }; state.donate.lastClick = Date.now(); save(); } catch { /* ignore */ } }

export function openDonate() {
  const link = (amount) => el('a', { class: 'btn btn-lg donate-amt', onclick: () => { track('donate_click', String(amount)); noteDonateClick(); }, href: donateUrl(amount), target: '_blank', rel: 'noopener noreferrer', 'aria-label': `Donate about £${amount} with PayPal (opens PayPal in your browser, where you enter the amount)` }, `£${amount}`);
  modal({
    title: '♥ Support NeuroHub Community',
    body: el('div', { class: 'stack' },
      el('p', {}, 'Phoenix is free, with no ads and no account, and it always will be. It is made by NeuroHub Community, a small Autistic-led social enterprise. If Phoenix has helped and you can spare something, a donation helps us keep it free and keep building tools like it.'),
      el('div', { class: 'donate-amounts', role: 'group', 'aria-label': 'Suggested donation amounts' }, AMOUNTS.map(link)),
      el('p', { class: 'small muted' }, 'These are suggestions. Each one opens PayPal in your browser, where you type the amount you would like to give. PayPal handles the payment, not Phoenix, and no payment details ever pass through this app.'),
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
    el('span', {}, 'Phoenix is free for everyone because NeuroHub Community, a small Autistic-led social enterprise, pays for it. If it has helped and you can spare something, a donation keeps it going. No pressure at all.'),
    el('span', { class: 'row-wrap' },
      el('button', { class: 'btn btn-sm', onclick: () => { close(); openDonate(); } }, '♥ Donate'),
      el('button', { class: 'btn btn-sm btn-ghost', onclick: close }, 'Not this week'),
      el('button', { class: 'btn btn-sm btn-ghost', onclick: () => { state.prefs.donateReminders = false; save(); close(); } }, 'Don’t remind me'))));
}
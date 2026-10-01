// Where the donation buttons go. One place, used by the app (donate.js) and by the website's front page (scripts/site-pages.mjs).
// Every button opens a Stripe-hosted Payment Link, so no card or payment detail ever touches Phoenix or its server.
//   once    - a single gift, for 5, 10, 25 or 50 pounds, or "other" where the person types their own amount
//   monthly - the same, taken every month until they cancel. Stripe cannot offer "any amount" on a subscription, so monthly "other"
//             is a 1 pound a month price where the person sets the quantity (the number of pounds) on the Stripe page.
export const KOFI = 'https://ko-fi.com/neurohubcommunity';
export const LINKS = {
  once: {
    5: 'https://buy.stripe.com/9B6cN5fBBcgaee29UK0Ny08',
    10: 'https://buy.stripe.com/8x25kD2OPeoi1rg7MC0Ny09',
    25: 'https://buy.stripe.com/3cI4gzcpp93Yee26Iy0Ny0a',
    50: 'https://buy.stripe.com/14AdR9fBB1Bw2vk1oe0Ny0b',
    other: 'https://buy.stripe.com/4gM8wPfBBdkeb1Qgj80Ny0c',
  },
  monthly: {
    5: 'https://buy.stripe.com/cNi9AT6112FA5Hw4Aq0Ny0d',
    10: 'https://buy.stripe.com/dRmaEX2OPbc6gma2si0Ny0e',
    25: 'https://buy.stripe.com/dRm14nfBB2FAfi66Iy0Ny0f',
    50: 'https://buy.stripe.com/4gMaEXahhcga8TIc2S0Ny0g',
    other: 'https://buy.stripe.com/3cI14n3ST5RMgma2si0Ny0h',
  },
};
export const AMOUNTS = [5, 10, 25, 50];
export const FREQUENCIES = ['once', 'monthly'];
const STRIPE = /^https:\/\/(buy|donate)\.stripe\.com\//;
/** True once every button is a Stripe Payment Link (amounts open already chosen, and "other" lets the person type their own). */
export const usingStripe = () => FREQUENCIES.every((f) => [...AMOUNTS, 'other'].every((a) => STRIPE.test(LINKS[f][a])));
export const linkFor = (frequency, amount) => (LINKS[frequency] || LINKS.once)[amount] || (LINKS[frequency] || LINKS.once).other;
/** The value sent to the anonymous counters: 5, 10, 25, 50 or other, with an m in front for monthly. */
export const clickKey = (frequency, amount) => `${frequency === 'monthly' ? 'm' : ''}${amount}`;

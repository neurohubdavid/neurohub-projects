// Anonymous, cookieless usage counts for NeuroHub (page views, install and download clicks, app opens, which features get used,
// and where the website widget is installed).
// Privacy by design: no cookies, no IDs, no IP address, no user agent and no message or health content is stored. Each event adds 1
// to a few daily counters (event, coarse device type, country, referring website). Do Not Track and Global Privacy Control are
// respected by the app and the site (they send nothing). See the privacy page for the plain-language version.
import { openStore, dayOf, bump, readJson, platformOf, dayKeyFor, isBot } from './_lib/kv.mjs';

export const config = { path: '/api/hit' };

const ORIGINS = ['https://phoenix.neurohubcommunity.org', 'https://phoenix-neuroaffirming-ai.netlify.app'];
// What people do in the app. A fixed list, so only a name from this list can ever be counted (never anything typed).
export const FEATURES = [
  'chat_ai', 'chat_helper', 'chat_limit', 'chat_ai_error', 'crisis_shown',
  'checkin_done', 'insights_open', 'doc_started', 'doc_pdf', 'doc_ai_draft',
  'tool_breathing', 'tool_grounding', 'tool_sensory', 'tool_checkin', 'tool_focus', 'tool_tasks', 'tool_scripts', 'tool_plan',
  'learn_open', 'share_on', 'share_off', 'reminders_on', 'reminders_off', 'a11y_open', 'help_open',
  'donate_open', 'nudge_shown', 'nudge_dismissed', 'nudge_off', 'ai_on', 'ai_off', 'install_sheet', 'name_given', 'backup_export', 'data_deleted',
  'float_open', 'float_close', 'float_chat', 'float_activity', 'float_nudges_on', 'float_unsupported',
  'account_created', 'account_signin', 'account_signout', 'account_deleted', 'memory_added', 'memory_edited', 'memory_deleted', 'sync_off', 'sync_on',
  'voice_chat', 'companion_chat_view', 'wake_on', 'wake_off', 'wake_word', 'voice_needs_account',
];
// Every event and every allowed value is listed here, so nothing free-form is ever stored.
export const ALLOWED = {
  view: ['/', '/privacy/', '/accessibility/', '/thanks/', '/add-to-your-site/'],
  install_click: ['landing', 'app'],
  installed: ['pwa'],
  app_open: ['browser', 'installed', 'desktop', 'embed'],
  first_open: ['browser', 'installed', 'desktop', 'embed'],
  ai_kind: ['offline', 'shared'],
  donate_click: ['5', '10', '25', '50', 'other', 'm5', 'm10', 'm25', 'm50', 'mother'], // m = monthly
  feature: FEATURES,
  embed_load: ['ok'], // the floating widget was loaded on someone's website (the website's address is read from the browser, see below)
  embed_open: ['ok', 'auto'], // the chat was opened by the visitor ('ok'), or was already showing because the widget starts open ('auto')
  embed_chat: ['ok'], // someone sent a message inside the widget
};
const HOST_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;
const MAX_HOST_KEYS = 300; // a day's counters never grow past this many different websites, whatever is sent
const EMBED = ['embed_load', 'embed_open', 'embed_chat'];
const HOSTED = ['feature', 'donate_click', 'first_open']; // counted per website too, when they come from inside the widget on someone's site

/** A clean website name (no www, no port, lower case) or '' if it is not one. */
export function cleanHost(v) {
  const h = String(v || '').toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/[:/].*$/, '');
  return HOST_RE.test(h) && h.length <= 60 ? h : '';
}

export function namesFor(body, { ua = '', country = '', originHost = '' } = {}) {
  const e = body?.e, v = String(body?.v ?? '');
  if (!ALLOWED[e] || !ALLOWED[e].includes(v)) return null;
  const names = [`e:${e}:${v}`, `e:${e}`];
  if (['view', 'app_open', 'first_open', 'installed', 'install_click', ...EMBED].includes(e)) {
    names.push(`plat:${e}:${platformOf(ua)}`);
    if (/^[A-Z]{2}$/.test(country)) names.push(`country:${e}:${country}`);
  }
  if (e === 'view') {
    let ref = String(body.r || '').toLowerCase().replace(/^www\./, '');
    ref = HOST_RE.test(ref) && ref.length <= 60 && !ref.endsWith('neurohubcommunity.org') && !ref.endsWith('netlify.app') ? ref : 'direct';
    names.push(`ref:${ref}`);
  }
  if (EMBED.includes(e)) { // which website the widget is on: the browser's own Origin header when it loads, the page's name from the widget when it is used
    const host = cleanHost(e === 'embed_load' ? originHost : body.h);
    if (host && !host.endsWith('neurohubcommunity.org') && !(e === 'embed_open' && v === 'auto')) names.push(`embedhost:${e}:${host}`); // per website, only real opens count
  }
  if (HOSTED.includes(e) && body.h) { // use inside the widget: counted against the website it is on (one counter per website, not per feature)
    const host = cleanHost(body.h);
    if (host && !host.endsWith('neurohubcommunity.org')) names.push(`embedhost:${e}:${host}`);
  }
  return names;
}

export async function handle(req, ctx = {}, deps = {}) {
  const origin = req.headers.get('origin') || '';
  const known = !origin || ORIGINS.includes(origin);
  const cors = origin ? { 'access-control-allow-origin': known ? origin : '*', vary: 'origin' } : {};
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1' || isBot(req.headers.get('user-agent') || '')) return new Response(null, { status: 204, headers: cors });
  let body; try { body = JSON.parse(await req.text()); } catch { return new Response(null, { status: 204, headers: cors }); }
  // Other websites may only report that the widget loaded on them; every other event has to come from Phoenix's own addresses.
  if (!known && body?.e !== 'embed_load') return new Response(null, { status: 204, headers: cors });
  let originHost = ''; try { originHost = origin ? new URL(origin).hostname : ''; } catch { /* no usable origin */ }
  const names = namesFor(body, { ua: req.headers.get('user-agent') || '', country: ctx.geo?.country?.code || '', originHost });
  if (names) {
    try {
      const store = deps.store || (await openStore('phoenix-stats'));
      const key = dayKeyFor(dayOf(deps.now ? deps.now() : new Date()), body.e);
      let use = names;
      if (names.some((n) => n.startsWith('embedhost:'))) { // keep the number of different website names bounded
        const cur = await readJson(store, key);
        if (Object.keys(cur).filter((k) => k.startsWith('embedhost:')).length >= MAX_HOST_KEYS) use = names.filter((n) => !n.startsWith('embedhost:') || n in cur);
      }
      await bump(store, key, use);
    } catch { /* counting must never break the page */ }
  }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store', ...cors } });
}
export default async (req, ctx) => handle(req, ctx);

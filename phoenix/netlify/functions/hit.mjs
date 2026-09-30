// Anonymous, cookieless usage counts for NeuroHub (page views, install and download clicks, app opens).
// Privacy by design: no cookies, no IDs, no IP address, no user agent and no message or health content is stored. Each event adds 1
// to a few daily counters (event, coarse device type, country, referring website). Do Not Track and Global Privacy Control are
// respected by the app and the site (they send nothing). See the privacy page for the plain-language version.
import { openStore, dayOf, bump, platformOf, dayKeyFor, isBot } from './_lib/kv.mjs';

export const config = { path: '/api/hit' };

const ORIGINS = ['https://phoenix.neurohubcommunity.org', 'https://phoenix-neuroaffirming-ai.netlify.app'];
// Every event and every allowed value is listed here, so nothing free-form is ever stored.
const ALLOWED = {
  view: ['/', '/privacy/', '/accessibility/'],
  install_click: ['landing', 'app'],
  installed: ['pwa'],
  app_open: ['browser', 'installed', 'desktop'],
  first_open: ['browser', 'installed', 'desktop'],
  ai_kind: ['offline', 'shared', 'ollama', 'openai', 'anthropic'],
  donate_click: ['5', '10', '25', '50', 'other'],
};
const HOST_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/;

export function namesFor(body, { ua = '', country = '' } = {}) {
  const e = body?.e, v = String(body?.v ?? '');
  if (!ALLOWED[e] || !ALLOWED[e].includes(v)) return null;
  const names = [`e:${e}:${v}`, `e:${e}`];
  if (['view', 'app_open', 'first_open', 'installed', 'install_click'].includes(e)) {
    names.push(`plat:${e}:${platformOf(ua)}`);
    if (/^[A-Z]{2}$/.test(country)) names.push(`country:${e}:${country}`);
  }
  if (e === 'view') {
    let ref = String(body.r || '').toLowerCase().replace(/^www\./, '');
    ref = HOST_RE.test(ref) && ref.length <= 60 && !ref.endsWith('neurohubcommunity.org') && !ref.endsWith('netlify.app') ? ref : 'direct';
    names.push(`ref:${ref}`);
  }
  return names;
}

export async function handle(req, ctx = {}, deps = {}) {
  const origin = req.headers.get('origin') || '';
  if (origin && !ORIGINS.includes(origin)) return new Response(null, { status: 204 });
  const cors = origin ? { 'access-control-allow-origin': origin, vary: 'origin' } : {};
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
  if (req.method !== 'POST') return new Response(null, { status: 405 });
  if (req.headers.get('dnt') === '1' || req.headers.get('sec-gpc') === '1' || isBot(req.headers.get('user-agent') || '')) return new Response(null, { status: 204, headers: cors });
  let body; try { body = JSON.parse(await req.text()); } catch { return new Response(null, { status: 204, headers: cors }); }
  const names = namesFor(body, { ua: req.headers.get('user-agent') || '', country: ctx.geo?.country?.code || '' });
  if (names) { try { await bump(deps.store || (await openStore('phoenix-stats')), dayKeyFor(dayOf(deps.now ? deps.now() : new Date()), body.e), names); } catch { /* counting must never break the page */ } }
  return new Response(null, { status: 204, headers: { 'cache-control': 'no-store', ...cors } });
}
export default async (req, ctx) => handle(req, ctx);

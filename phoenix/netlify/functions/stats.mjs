// Private numbers for NeuroHub: how many people visit, click Install, download, open the app, and use the shared free AI.
// Protected by a secret key (Netlify environment variable PHOENIX_STATS_KEY). Returns anonymous counts only.
import { timingSafeEqual } from 'node:crypto';
import { openStore, dayOf, readJson } from './_lib/kv.mjs';

export const config = { path: '/api/stats' };

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex' } });
const same = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

export async function handle(req, ctx = {}, deps = {}) {
  const env = deps.env || process.env;
  if (!env.PHOENIX_STATS_KEY || env.PHOENIX_STATS_KEY.length < 16) return json({ error: 'not_configured' }, 503);
  if (!same(req.headers.get('x-stats-key') || '', env.PHOENIX_STATS_KEY)) return json({ error: 'auth' }, 401);
  const u = new URL(req.url);
  const n = Math.min(Math.max(parseInt(u.searchParams.get('days') || '30', 10) || 30, 1), 400);
  const stats = deps.store || (await openStore('phoenix-stats')), usage = deps.aiStore || (await openStore('phoenix-ai-usage'));
  const now = deps.now ? deps.now() : new Date();
  const days = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86400000), day = dayOf(d);
    days.push({ day, counts: await readJson(stats, `day:${day}`), sharedAi: Number((await usage.get(`d:${day}`)) || 0) });
  }
  const totals = {};
  for (const d of days) for (const [k, v] of Object.entries(d.counts)) totals[k] = (totals[k] || 0) + v;
  return json({ generated: now.toISOString(), days, totals, sharedAiMonth: Number((await usage.get(`m:${dayOf(now).slice(0, 7)}`)) || 0) });
}
export default async (req, ctx) => handle(req, ctx);

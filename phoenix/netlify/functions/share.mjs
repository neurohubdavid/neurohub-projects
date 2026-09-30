// Receives check-in scores from people who chose to share them (Settings, off by default), and deletes them again on request.
// What arrives: a random 32-character ID made on the person's own device, dates, and seven numbers from 1 to 5. Never a name, a note,
// what they wrote, their IP address or their device. Only the owner (Admin role) can read it, in aggregate, in the private backend.
import { openStore, readJson } from './_lib/kv.mjs';
import { cleanEntry, validPid } from './_lib/cohort.mjs';

export const config = { path: '/api/share/*' };

const ORIGINS = ['https://phoenix.neurohubcommunity.org', 'https://phoenix-neuroaffirming-ai.netlify.app'];
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const MAX_DAYS = 800, MAX_BATCH = 400, KEEP_DAYS = 730;

export async function handle(req, ctx = {}, deps = {}) {
  const origin = req.headers.get('origin') || '';
  if (origin && !ORIGINS.includes(origin)) return json({ error: 'origin' }, 403);
  const cors = origin ? { 'access-control-allow-origin': origin, vary: 'origin' } : {};
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
  if (req.method !== 'POST') return json({ error: 'method' }, 405, cors);
  const route = new URL(req.url).pathname.replace(/\/+$/, '').split('/').pop();
  let raw; try { raw = await req.text(); } catch { return json({ error: 'bad_request' }, 400, cors); }
  if (raw.length > 30000) return json({ error: 'too_big' }, 413, cors);
  let body; try { body = JSON.parse(raw); } catch { return json({ error: 'bad_request' }, 400, cors); }
  if (!validPid(body?.pid)) return json({ error: 'bad_id' }, 400, cors);
  const store = deps.store || (await openStore('phoenix-checkins'));
  const now = deps.now ? deps.now() : new Date();
  const key = `p:${body.pid}`;

  if (route === 'forget') { // the right to be forgotten: remove everything held under this ID
    await store.delete(key);
    const idx = (JSON.parse((await store.get('index')) || '[]') || []).filter((x) => x !== body.pid);
    await store.set('index', JSON.stringify(idx));
    return json({ ok: true }, 200, cors);
  }
  if (route !== 'checkin') return json({ error: 'not_found' }, 404, cors);

  const list = Array.isArray(body.entries) ? body.entries.slice(0, MAX_BATCH) : [{ at: body.at, s: body.s }];
  const good = list.map((e) => cleanEntry(e, now)).filter(Boolean);
  if (!good.length) return json({ error: 'bad_entry' }, 400, cors);
  const rec = await readJson(store, key);
  const isNew = !rec.days;
  rec.days ||= {}; rec.c ||= now.toISOString();
  for (const e of good) rec.days[e.day] = e.scores; // one entry per day: the latest wins
  const days = Object.keys(rec.days).sort(), cutoff = new Date(now.getTime() - KEEP_DAYS * 86400000).toISOString().slice(0, 10);
  for (const d of days) if (d < cutoff) delete rec.days[d]; // scores are kept for two years at most
  const left = Object.keys(rec.days).sort();
  for (const d of left.slice(0, Math.max(0, left.length - MAX_DAYS))) delete rec.days[d];
  await store.set(key, JSON.stringify(rec));
  if (isNew) {
    const idx = JSON.parse((await store.get('index')) || '[]') || [];
    if (!idx.includes(body.pid)) { idx.push(body.pid); await store.set('index', JSON.stringify(idx)); }
  }
  return json({ ok: true, stored: good.length }, 200, cors);
}
export default async (req, ctx) => handle(req, ctx);

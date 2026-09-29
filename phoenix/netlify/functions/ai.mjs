// Phoenix's shared, limited free AI: a small proxy that holds NeuroHub's Claude key on the server (it is NEVER in the app's code)
// and answers for people who have not connected an AI of their own. Because NeuroHub pays for every message, it is built to
// be hard to abuse and impossible to overspend:
//   - on when a Claude key is available (Netlify AI Gateway by default); the off switch is PHOENIX_SHARED_AI=off
//   - a fixed model and reply length; only Phoenix's own kind of request is accepted (not a general-purpose Claude endpoint)
//   - a daily cap per person (hashed IP, never stored raw), a daily cap for everyone, and a monthly cap for everyone
//   - messages are streamed straight through and never stored or logged; only anonymous counters are kept
// Limits (change in Netlify environment variables): PHOENIX_PER_PERSON_DAILY=20, PHOENIX_GLOBAL_DAILY=400, PHOENIX_GLOBAL_MONTHLY=6000,
// PHOENIX_MODEL=claude-sonnet-5-5, PHOENIX_MAX_TOKENS=700.
import { createHash } from 'node:crypto';

export const config = { path: '/api/ai' };

const ORIGINS = ['https://phoenix.neurohubcommunity.org', 'https://phoenix-neuroaffirming-ai.netlify.app'];
const cors = (origin) => (origin && ORIGINS.includes(origin) ? { 'access-control-allow-origin': origin, vary: 'origin' } : {});
const json = (obj, status = 200, extra = {}) => new Response(JSON.stringify(obj), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });

export function settings(env = process.env) {
  const n = (k, d) => { const v = Number(env[k]); return Number.isFinite(v) && v >= 0 ? v : d; };
  // Which Claude account pays: by default Netlify's AI Gateway, which injects ANTHROPIC_API_KEY and ANTHROPIC_BASE_URL into functions and
  // bills the site's Netlify credits (the same way the identity course's Phoenix can run). To use a personal Anthropic key instead, set
  // PHOENIX_ANTHROPIC_KEY (a gateway-issued key is rejected by api.anthropic.com and the other way round, so the pair is kept together).
  const own = env.PHOENIX_ANTHROPIC_KEY || '';
  const key = own || env.ANTHROPIC_API_KEY || '';
  const upstream = own ? 'https://api.anthropic.com' : (env.ANTHROPIC_BASE_URL || 'https://api.anthropic.com');
  return {
    on: env.PHOENIX_SHARED_AI !== 'off' && !!key, // on whenever a key is available; PHOENIX_SHARED_AI=off is the off switch
    key,
    model: env.PHOENIX_MODEL || 'claude-sonnet-5-5',
    upstream: (env.PHOENIX_UPSTREAM || upstream).replace(/\/+$/, ''),
    maxTokens: Math.min(n('PHOENIX_MAX_TOKENS', 700), 1200),
    perPerson: n('PHOENIX_PER_PERSON_DAILY', 20), globalDaily: n('PHOENIX_GLOBAL_DAILY', 400), globalMonthly: n('PHOENIX_GLOBAL_MONTHLY', 6000),
    salt: env.PHOENIX_SALT || key.slice(-6) || 'phoenix',
  };
}
/** Checks the request body is a Phoenix chat request and trims it to safe sizes. Returns {error} or {system, messages}. */
export function cleanBody(body) {
  if (!body || typeof body !== 'object') return { error: 'bad_request' };
  const system = typeof body.system === 'string' ? body.system : '';
  // Phoenix's own prompt always contains these; a request without them is someone using this as a general-purpose Claude.
  if (system.length < 200 || system.length > 30000 || !system.includes('You are Phoenix') || !(system.includes('CRISIS SUPPORT DETAILS') || system.includes('write down a reflection form'))) return { error: 'not_phoenix' };
  const raw = Array.isArray(body.messages) ? body.messages : [];
  const messages = raw.filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim()).slice(-16).map((m) => ({ role: m.role, content: m.content.slice(0, 3000) }));
  while (messages.length && messages[0].role !== 'user') messages.shift();
  if (!messages.length || messages[messages.length - 1].role !== 'user') return { error: 'no_user_message' };
  return { system, messages };
}

// In-memory counters for tests and as a fallback when Netlify Blobs is unavailable.
export function memoryStore() { const m = new Map(); return { get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, String(v)); } }; }
async function realStore() { try { const { getStore } = await import('@netlify/blobs'); return getStore('phoenix-ai-usage'); } catch { return memoryStore(); } }

export async function handle(req, ctx = {}, deps = {}) {
  const s = settings(deps.env || process.env);
  const origin = req.headers.get('origin') || '';
  const c = cors(origin);
  if (origin && !ORIGINS.includes(origin)) return json({ error: 'origin' }, 403);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...c, 'access-control-allow-methods': 'GET, POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' } });
  const store = deps.store || (await realStore());
  const now = deps.now ? deps.now() : new Date();
  const day = now.toISOString().slice(0, 10), month = day.slice(0, 7);
  const ip = ctx.ip || req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const who = createHash('sha256').update(`${s.salt}|${ip}`).digest('hex').slice(0, 24);
  const kPerson = `p:${who}:${day}`, kDay = `d:${day}`, kMonth = `m:${month}`;
  const read = async (k) => Number((await store.get(k)) || 0);

  if (req.method === 'GET') {
    const [p, d, m] = await Promise.all([read(kPerson), read(kDay), read(kMonth)]);
    const left = Math.max(0, Math.min(s.perPerson - p, s.globalDaily - d, s.globalMonthly - m));
    return json({ ai: s.on, perDay: s.perPerson, left: s.on ? left : 0 }, 200, c);
  }
  if (req.method !== 'POST') return json({ error: 'method' }, 405, c);
  if (!s.on) return json({ error: 'unavailable' }, 503, c);

  let body; try { body = await req.json(); } catch { return json({ error: 'bad_request' }, 400, c); }
  const cb = cleanBody(body);
  if (cb.error) return json({ error: cb.error }, 400, c);

  const [p, d, m] = await Promise.all([read(kPerson), read(kDay), read(kMonth)]);
  if (p >= s.perPerson) return json({ error: 'limit', scope: 'person', perDay: s.perPerson }, 429, c);
  if (d >= s.globalDaily || m >= s.globalMonthly) return json({ error: 'limit', scope: 'everyone' }, 429, c);
  // Count first, so a burst of parallel requests cannot slip past the cap by much.
  await Promise.all([store.set(kPerson, p + 1), store.set(kDay, d + 1), store.set(kMonth, m + 1)]);

  const maxTokens = Math.min(Number(body.maxTokens) || s.maxTokens, s.maxTokens);
  let up;
  try {
    up = await (deps.fetch || fetch)(`${s.upstream}/v1/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': s.key, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: s.model, max_tokens: maxTokens, stream: true, system: cb.system, messages: cb.messages }),
    });
  } catch { return json({ error: 'unavailable' }, 503, c); }
  if (!up.ok || !up.body) {
    await Promise.all([store.set(kPerson, p), store.set(kDay, d), store.set(kMonth, m)]).catch(() => {}); // a failed call does not use up the person's allowance
    const st = up.status;
    console.error('phoenix shared ai upstream status', st); // status only, never content
    return json({ error: st === 429 ? 'busy' : 'unavailable' }, 503, c);
  }
  return new Response(up.body, { status: 200, headers: { 'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform', 'x-accel-buffering': 'no', 'x-phoenix-left': String(Math.max(0, s.perPerson - p - 1)), ...c } });
}

export default async (req, ctx) => handle(req, ctx);

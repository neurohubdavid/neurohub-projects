// Optional Phoenix accounts: sign in with an emailed code, sync notes, chats and check-ins between devices, keep Phoenix's memories.
//   GET  /api/account/status     is the account system switched on?
//   POST /api/account/request    {email}        emails a one-time sign-in code (always answers the same, whoever the email belongs to)
//   POST /api/account/verify     {email, code}  signs in (creating the account the first time); returns a session token
//   GET  /api/account/data       the person's synced data          (Authorization: Bearer <token>)
//   PUT  /api/account/data       {data, base}   saves it; 409 with the newer copy if another device saved first
//   GET  /api/account/export     everything held, as a download
//   POST /api/account/logout     {all?}         ends this session, or every session
//   POST /api/account/delete     {confirm:"DELETE"}  erases the account and all its data
// What is stored, and how: see _lib/accounts.mjs (no email address is stored; data is sealed with a server-only key).
import { openStore, dayOf, bump, dayKeyFor } from './_lib/kv.mjs';
import { accountSettings, normaliseEmail, accountId, newCode, prettyCode, cleanCode, sha, sameHash, newToken, seal, unseal, bearer, sessionAccount, CODE_MINUTES, CODE_TRIES, SESSION_DAYS, MAX_SESSIONS, MAX_DATA_BYTES } from './_lib/accounts.mjs';
import { signInEmail, sendViaBrevo } from './_lib/mail.mjs';

export const config = { path: '/api/account/*' };

const ORIGINS = ['https://phoenix.neurohubcommunity.org', 'https://phoenix-neuroaffirming-ai.netlify.app'];
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...extra } });
const DAY = 86400000;

export async function handle(req, ctx = {}, deps = {}) {
  const env = deps.env || process.env, s = accountSettings(env, deps);
  const origin = req.headers.get('origin') || '';
  const known = ORIGINS.includes(origin) || (!!deps.allowOrigin && origin === deps.allowOrigin);
  const cors = known ? { 'access-control-allow-origin': origin, vary: 'origin' } : {};
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...cors, 'access-control-allow-methods': 'GET, POST, PUT, OPTIONS', 'access-control-allow-headers': 'content-type, authorization', 'access-control-max-age': '86400' } });
  const route = new URL(req.url).pathname.replace(/\/+$/, '').split('/').pop();
  if (route === 'status' && req.method === 'GET') return json({ enabled: s.on }, 200, cors);
  if (!s.on) return json({ error: 'off' }, 503, cors);
  // Asking for a code or signing in (which anyone could try from anywhere) is only for Phoenix's own sites. Everything after that is protected by the person's private session token, which no other website has.
  if (!known && (route === 'request' || route === 'verify')) return json({ error: 'origin' }, 403);

  const store = deps.store || (await openStore('phoenix-accounts', { strong: true }));
  const stats = deps.stats || (await openStore('phoenix-stats'));
  const now = deps.now ? deps.now() : new Date(), t = now.getTime(), day = dayOf(now);
  const note = async (name) => { try { await bump(stats, dayKeyFor(day, 'account'), ['e:account:' + name, 'e:account']); } catch { /* counting must never break sign-in */ } };
  const read = async (k) => { try { return JSON.parse((await store.get(k)) || 'null'); } catch { return null; } };
  const readBody = async (max = 4000) => { let raw; try { raw = await req.text(); } catch { return null; } if (raw.length > max) return null; try { return JSON.parse(raw); } catch { return null; } };
  const ip = ctx.ip || req.headers.get('x-nf-client-connection-ip') || req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const hit = async (key, limit) => { const n = Number((await store.get(key)) || 0); if (n >= limit) return false; await store.set(key, String(n + 1)); return true; }; // a counter with a ceiling

  // ---------------------------------------------------------------- signing in
  if (route === 'request' && req.method === 'POST') {
    const b = await readBody(); const email = normaliseEmail(b?.email);
    if (!email) return json({ error: 'bad_email' }, 400, cors);
    const id = accountId(s.idKey, email), hour = Math.floor(t / 3600000);
    if (!(await hit('rl:e:' + id + ':' + hour, 5)) || !(await hit('rl:i:' + sha(s.key.toString('hex') + ip).slice(0, 24) + ':' + hour, 20))) return json({ error: 'slow_down' }, 429, cors);
    const code = newCode();
    await store.set('code:' + id, JSON.stringify({ h: sha(code), exp: t + CODE_MINUTES * 60000, tries: 0 }));
    const link = origin + '/app/?code=' + prettyCode(code);
    const mail = signInEmail(prettyCode(code), link, CODE_MINUTES);
    try {
      const sent = deps.send ? await deps.send({ to: email, ...mail }) : await sendViaBrevo({ apiKey: s.brevo, from: s.from, to: email, ...mail }, deps.fetch || fetch);
      if (sent === false) { await store.delete('code:' + id); return json({ error: 'mail_failed' }, 502, cors); }
    } catch { await store.delete('code:' + id); return json({ error: 'mail_failed' }, 502, cors); }
    await note('code_sent');
    return json({ ok: true, minutes: CODE_MINUTES }, 200, cors); // the same answer whether or not this email already has an account
  }

  if (route === 'verify' && req.method === 'POST') {
    const b = await readBody(); const email = normaliseEmail(b?.email), code = cleanCode(b?.code);
    if (!email || code.length !== 8) return json({ error: 'bad_code' }, 400, cors);
    const id = accountId(s.idKey, email), rec = await read('code:' + id);
    if (!rec || rec.exp < t) { if (rec) await store.delete('code:' + id); return json({ error: 'bad_code', expired: true }, 400, cors); }
    if (rec.tries >= CODE_TRIES) { await store.delete('code:' + id); return json({ error: 'bad_code', expired: true }, 400, cors); }
    if (!sameHash(rec.h, sha(code))) { rec.tries += 1; await store.set('code:' + id, JSON.stringify(rec)); return json({ error: 'bad_code', triesLeft: Math.max(0, CODE_TRIES - rec.tries) }, 400, cors); }
    await store.delete('code:' + id); // a code works once
    let acct = await read('acct:' + id), isNew = false;
    if (!acct) {
      isNew = true; acct = { created: now.toISOString(), sessions: [] };
      try { const n = Number((await stats.get('accounts:total')) || 0); await stats.set('accounts:total', String(n + 1)); } catch { /* counting only */ }
      await note('created');
    }
    const token = newToken(), hash = sha(token);
    await store.set('sess:' + hash, JSON.stringify({ acct: id, exp: t + SESSION_DAYS * DAY, created: t }));
    acct.sessions = [...(acct.sessions || []), hash];
    while (acct.sessions.length > MAX_SESSIONS) await store.delete('sess:' + acct.sessions.shift()); // the oldest sign-ins end first
    await store.set('acct:' + id, JSON.stringify(acct));
    await note('signin');
    return json({ ok: true, token, isNew, expires: t + SESSION_DAYS * DAY }, 200, cors);
  }

  // ---------------------------------------------------------------- signed-in requests
  const id = await sessionAccount(store, bearer(req), t);
  if (!id) return json({ error: 'signed_out' }, 401, cors);
  const dkey = 'data:' + id;

  if (route === 'data' && req.method === 'GET') {
    const raw = await store.get(dkey); if (!raw) return json({ data: null, updated: null }, 200, cors);
    try { const rec = unseal(raw, s.key); return json({ data: rec.data, updated: rec.updated }, 200, cors); } catch { return json({ error: 'unreadable' }, 500, cors); }
  }
  if (route === 'data' && req.method === 'PUT') {
    let raw; try { raw = await req.text(); } catch { return json({ error: 'bad_request' }, 400, cors); }
    if (raw.length > MAX_DATA_BYTES) return json({ error: 'too_big' }, 413, cors);
    let b; try { b = JSON.parse(raw); } catch { return json({ error: 'bad_request' }, 400, cors); }
    if (!b || typeof b.data !== 'object' || b.data === null || Array.isArray(b.data)) return json({ error: 'bad_request' }, 400, cors);
    const cur = await store.get(dkey);
    if (cur) {
      let rec; try { rec = unseal(cur, s.key); } catch { rec = null; }
      if (rec && rec.updated !== (b.base || null)) return json({ error: 'conflict', data: rec.data, updated: rec.updated }, 409, cors); // another device saved first: merge and try again
    }
    const updated = t + '-' + newCode().toLowerCase(); // changes with every save, so two devices saving at once are noticed
    await store.set(dkey, seal({ data: b.data, updated }, s.key));
    await note('push');
    return json({ ok: true, updated }, 200, cors);
  }
  if (route === 'export' && req.method === 'GET') {
    const raw = await store.get(dkey); let rec = null; try { rec = raw ? unseal(raw, s.key) : null; } catch { /* unreadable */ }
    await note('export');
    return new Response(JSON.stringify({ exportedAt: now.toISOString(), note: 'Everything Phoenix holds for your account. No email address is stored.', updated: rec?.updated || null, data: rec?.data || null }, null, 2), { status: 200, headers: { 'content-type': 'application/json; charset=utf-8', 'content-disposition': 'attachment; filename="phoenix-account-data.json"', 'cache-control': 'no-store', ...cors } });
  }
  if (route === 'logout' && req.method === 'POST') {
    const b = (await readBody()) || {}, acct = (await read('acct:' + id)) || { sessions: [] }, me = sha(bearer(req));
    const drop = b.all ? [...(acct.sessions || []), me] : [me];
    for (const h of drop) await store.delete('sess:' + h);
    acct.sessions = (acct.sessions || []).filter((h) => !drop.includes(h));
    await store.set('acct:' + id, JSON.stringify(acct));
    await note('signout');
    return json({ ok: true }, 200, cors);
  }
  if (route === 'delete' && req.method === 'POST') {
    const b = await readBody();
    if (b?.confirm !== 'DELETE') return json({ error: 'confirm' }, 400, cors);
    const acct = (await read('acct:' + id)) || { sessions: [] };
    for (const h of acct.sessions || []) await store.delete('sess:' + h);
    await store.delete('sess:' + sha(bearer(req))); await store.delete(dkey); await store.delete('acct:' + id); await store.delete('code:' + id);
    try { const n = Number((await stats.get('accounts:total')) || 0); await stats.set('accounts:total', String(Math.max(0, n - 1))); } catch { /* counting only */ }
    await note('deleted');
    return json({ ok: true }, 200, cors);
  }
  return json({ error: 'not_found' }, 404, cors);
}
export default async (req, ctx) => handle(req, ctx);

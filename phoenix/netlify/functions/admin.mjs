// The private backend's server side. Everything under /api/admin/ except signing in needs a signed-in person who has the Admin role.
//   POST /api/admin/login    { username, password, code }   -> sets the session cookie
//   POST /api/admin/logout
//   GET  /api/admin/me       -> { user }
//   GET  /api/admin/usage    -> anonymous usage counts (visits, installs, downloads, app opens, free AI use)
//   GET  /api/admin/checkins -> how the people who chose to share their check-ins are doing, in aggregate
import { openStore, dayOf, readJson, readDayCounts } from './_lib/kv.mjs';
import { adminUsers, hasAdminRole, verifyPassword, checkTotp, signUserSession, adminFromRequest, sessionCookie, ipHash, COOKIE } from './_lib/admin.mjs';
import { summarise, trajectories, MEASURES, MIN_N } from './_lib/cohort.mjs';
import { buildReport } from './_lib/report.mjs';
import { sinceLaunch, usersSummary } from './_lib/usage.mjs';

export const config = { path: '/api/admin/*' };

const ORIGINS = ['https://phoenix.neurohubcommunity.org', 'https://phoenix-neuroaffirming-ai.netlify.app'];
const HEADERS = { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-robots-tag': 'noindex, nofollow', 'x-content-type-options': 'nosniff' };
const json = (o, status = 200, extra = {}) => new Response(JSON.stringify(o), { status, headers: { ...HEADERS, ...extra } });
const DUMMY = 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='; // so an unknown name takes as long as a known one
const LOCK_AFTER = 5, LOCK_MINUTES = 15;

export async function handle(req, ctx = {}, deps = {}) {
  const env = deps.env || process.env, now = deps.now ? deps.now() : new Date();
  const route = new URL(req.url).pathname.replace(/\/+$/, '').split('/').pop();
  const origin = req.headers.get('origin') || '';
  if (origin && !ORIGINS.includes(origin) && !(env.ADMIN_DEV_ORIGIN && origin === env.ADMIN_DEV_ORIGIN)) return json({ error: 'origin' }, 403); // ADMIN_DEV_ORIGIN is for local tests only and is never set in production

  if (req.method === 'POST') { // the cookie is SameSite=Strict already; this second check means another website cannot trigger it either
    if (req.headers.get('x-admin-csrf') !== '1') return json({ error: 'csrf' }, 403);
  }
  const guard = deps.store || (await openStore('phoenix-admin'));

  if (route === 'login' && req.method === 'POST') {
    const secret = env.ADMIN_SESSION_SECRET, users = adminUsers(env);
    if (!secret || secret.length < 32 || !Object.keys(users).length) return json({ error: 'closed' }, 503); // not set up: stays shut
    const ip = ctx.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown', who = ipHash(ip, secret.slice(0, 12)), fkey = `fail:${who}`;
    const f = await readJson(guard, fkey);
    if (f.until && f.until > now.getTime()) return json({ error: 'locked', minutes: Math.ceil((f.until - now.getTime()) / 60000) }, 429);
    let body; try { body = JSON.parse(await req.text()); } catch { body = {}; }
    const username = String(body.username || '').trim().slice(0, 60), user = Object.hasOwn(users, username) ? users[username] : null;
    const passOk = await verifyPassword(String(body.password || '').slice(0, 200), user?.hash || DUMMY);
    const step = user ? checkTotp(user.totp || 'AAAAAAAAAAAAAAAA', body.code, now.getTime()) : null;
    const last = user ? Number((await guard.get(`step:${username}`)) || 0) : 0;
    const ok = !!user && passOk && hasAdminRole(user) && step !== null && step > last;
    const audit = async (good) => { const a = JSON.parse((await guard.get('audit')) || '[]') || []; a.unshift({ at: now.toISOString(), user: good ? username : (user ? username : '(unknown)'), ok: good, from: who.slice(0, 6) }); await guard.set('audit', JSON.stringify(a.slice(0, 40))); };
    if (!ok) {
      const n = (f.until && f.until <= now.getTime() ? 0 : f.n || 0) + 1;
      await guard.set(fkey, JSON.stringify(n >= LOCK_AFTER ? { n: 0, until: now.getTime() + LOCK_MINUTES * 60000 } : { n }));
      await audit(false);
      if (!deps.fast) await new Promise((r) => setTimeout(r, 500));
      return json({ error: 'failed' }, 401); // one message for every reason, so nothing is revealed
    }
    await guard.set(`step:${username}`, String(step)); // a code works once
    await guard.delete(fkey);
    await audit(true);
    return json({ ok: true, user: username }, 200, { 'set-cookie': sessionCookie(signUserSession(secret, username, now.getTime())) });
  }
  if (route === 'logout' && req.method === 'POST') return json({ ok: true }, 200, { 'set-cookie': `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict` });

  // everything below needs a signed-in person who still has the Admin role
  const admin = adminFromRequest(req, env, now.getTime());
  if (!admin) return json({ error: 'auth' }, 401);
  if (req.method !== 'GET') return json({ error: 'method' }, 405);
  const u = new URL(req.url);

  if (route === 'me') { const a = JSON.parse((await guard.get('audit')) || '[]') || []; return json({ user: admin, recent: a.slice(0, 12) }); }

  if (route === 'usage') {
    const n = Math.min(Math.max(parseInt(u.searchParams.get('days') || '30', 10) || 30, 1), 400);
    const stats = deps.usageStore || (await openStore('phoenix-stats')), usage = deps.aiStore || (await openStore('phoenix-ai-usage'));
    const days = [];
    for (let i = n - 1; i >= 0; i--) { const day = dayOf(new Date(now.getTime() - i * 86400000)); days.push({ day, counts: await readDayCounts(stats, day), sharedAi: Number((await usage.get(`d:${day}`)) || 0) }); }
    const totals = {}; for (const d of days) for (const [k, v] of Object.entries(d.counts)) totals[k] = (totals[k] || 0) + v;
    const users = usersSummary(await sinceLaunch(stats, now));
    const accountsNow = Number((await stats.get('accounts:total')) || 0);
    return json({ generated: now.toISOString(), users, days, totals, accountsNow, sharedAiMonth: Number((await usage.get(`m:${dayOf(now).slice(0, 7)}`)) || 0) });
  }

  if (route === 'checkins' || route === 'report') {
    const store = deps.checkinStore || (await openStore('phoenix-checkins'));
    const idx = JSON.parse((await store.get('index')) || '[]') || [], people = [];
    const cutoff = new Date(now.getTime() - 730 * 86400000).toISOString().slice(0, 10), keep = [];
    for (const id of idx) {
      const r = await readJson(store, `p:${id}`), days = Object.keys(r.days || {}).sort();
      if (!days.length || days[days.length - 1] < cutoff) { await store.delete(`p:${id}`); continue; } // nothing newer than two years: deleted
      keep.push(id); people.push({ id, c: r.c, days: r.days });
    }
    if (keep.length !== idx.length) await store.set('index', JSON.stringify(keep));
    const weeks = Math.min(Math.max(parseInt(u.searchParams.get('weeks') || '12', 10) || 12, 4), 52);
    if (route === 'report') { const devices = usersSummary(await sinceLaunch(deps.usageStore || (await openStore('phoenix-stats')), now)).devicesAllTime; return json(buildReport(people, { now, weeks, devices })); }
    return json({ generated: now.toISOString(), measures: MEASURES, minN: MIN_N, summary: summarise(people, { now, weeks }), trajectories: u.searchParams.get('individual') === '1' ? trajectories(people) : undefined });
  }
  return json({ error: 'not_found' }, 404);
}
export default async (req, ctx) => handle(req, ctx);

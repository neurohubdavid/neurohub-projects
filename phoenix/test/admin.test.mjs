// The private backend: only people with the Admin role can get in, and shared check-ins are combined so nobody can be picked out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, totp, checkTotp, base32, unbase32, signUserSession, verifySession, adminFromRequest, adminUsers, hasAdminRole, cookieFrom } from '../netlify/functions/_lib/admin.mjs';
import { handle as admin } from '../netlify/functions/admin.mjs';
import { handle as share } from '../netlify/functions/share.mjs';
import { summarise, trajectories, cleanEntry, validPid, weekStart } from '../netlify/functions/_lib/cohort.mjs';
import { memoryStore } from '../netlify/functions/_lib/kv.mjs';
import { sharePayload, newShareId } from '../app/js/share-core.js';
import { freshEntry } from '../app/js/sixpf.js';

const SECRET = 'x'.repeat(48), TOTP_SECRET = base32(Buffer.from('12345678901234567890')), NOW = new Date('2026-10-01T12:00:00Z');
const PASSWORD = 'correct-horse-battery-9';
const hash = await hashPassword(PASSWORD);
const env = (users) => ({ ADMIN_SESSION_SECRET: SECRET, ADMIN_USERS: JSON.stringify(users) });
const ME = { david: { role: 'admin', hash, totp: TOTP_SECRET }, sam: { role: 'viewer', hash, totp: TOTP_SECRET } };
const codeAt = (t) => totp(TOTP_SECRET, Math.floor(t / 30000));
const post = (path, body, headers = {}) => new Request('https://phoenix.neurohubcommunity.org/api/admin/' + path, { method: 'POST', headers: { 'content-type': 'application/json', 'x-admin-csrf': '1', ...headers }, body: JSON.stringify(body) });
const get = (path, cookie = '') => new Request('https://phoenix.neurohubcommunity.org/api/admin/' + path, { headers: cookie ? { cookie } : {} });
const deps = (e, extra = {}) => ({ env: e, store: memoryStore(), now: () => NOW, fast: true, ...extra });
const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

test('sign-in primitives: passwords, one-time codes and session cookies', async () => {
  assert.equal(await verifyPassword(PASSWORD, hash), true); assert.equal(await verifyPassword('wrong', hash), false); assert.equal(await verifyPassword(PASSWORD, ''), false);
  assert.ok(!hash.includes(PASSWORD), 'only a hash is stored');
  assert.equal(unbase32(base32(Buffer.from('hello'))).toString(), 'hello');
  assert.equal(totp(TOTP_SECRET, Math.floor(59000 / 30000)), '287082', 'RFC 6238 test vector');
  assert.equal(checkTotp(TOTP_SECRET, '287082', 59000), 1); assert.equal(checkTotp(TOTP_SECRET, '000000', 59000), null); assert.equal(checkTotp(TOTP_SECRET, 'abcdef', 59000), null);
  assert.equal(checkTotp(TOTP_SECRET, codeAt(30000 * 10), 30000 * 11 + 5), 10, 'one step of clock drift is allowed'); assert.equal(checkTotp(TOTP_SECRET, codeAt(30000 * 10), 30000 * 14), null, 'older codes are not');
  const tok = signUserSession(SECRET, 'david', NOW.getTime());
  assert.equal(verifySession(SECRET, tok, NOW.getTime() + 1000), true); assert.equal(verifySession(SECRET, tok, NOW.getTime() + 9 * 3600000), false, 'expires');
  assert.equal(verifySession('y'.repeat(48), tok, NOW.getTime()), false, 'wrong secret');
  const [p, s] = tok.split('.'); assert.equal(verifySession(SECRET, `${Buffer.from(JSON.stringify({ u: 'sam', exp: NOW.getTime() + 1e9 })).toString('base64url')}.${s}`, NOW.getTime()), false, 'tampered');
  assert.equal(cookieFrom(new Request('https://x', { headers: { cookie: `a=1; phx_admin=${tok}; b=2` } })), tok);
});

test('only the exact role "admin" counts', () => {
  assert.equal(hasAdminRole(ME.david), true); assert.equal(hasAdminRole(ME.sam), false);
  for (const bad of [null, {}, { role: 'Admin', hash: 'h', totp: 't' }, { role: 'administrator', hash: 'h', totp: 't' }, { role: ['admin'], hash: 'h', totp: 't' }, { role: 'admin' }, { role: 'admin', hash: 'h' }]) assert.equal(hasAdminRole(bad), false, JSON.stringify(bad));
  assert.deepEqual(adminUsers({ ADMIN_USERS: 'not json' }), {}); assert.deepEqual(adminUsers({}), {});
});

test('backend sign-in: stays closed until set up, and never says which part was wrong', async () => {
  const closed = await admin(post('login', { username: 'david', password: PASSWORD, code: codeAt(NOW.getTime()) }), {}, deps({}));
  assert.equal(closed.status, 503);
  const e = env(ME), t = NOW.getTime();
  const attempts = [['david', 'wrong-password-here', codeAt(t)], ['david', PASSWORD, '000000'], ['nobody', PASSWORD, codeAt(t)], ['sam', PASSWORD, codeAt(t)]]; // wrong password, wrong code, unknown person, wrong role
  const bodies = [];
  for (const [i, [username, password, code]] of attempts.entries()) { const r = await admin(post('login', { username, password, code }), { ip: '1.1.1.' + i }, deps(e)); assert.equal(r.status, 401, username); assert.equal(r.headers.get('set-cookie'), null); bodies.push(await r.text()); }
  assert.equal(new Set(bodies).size, 1, 'every failure gives the identical answer');
  const ok = await admin(post('login', { username: 'david', password: PASSWORD, code: codeAt(t) }), { ip: '9.9.9.9' }, deps(e));
  assert.equal(ok.status, 200); const sc = ok.headers.get('set-cookie'); assert.match(sc, /HttpOnly/); assert.match(sc, /Secure/); assert.match(sc, /SameSite=Strict/);
});

test('backend sign-in: a code works once, wrong attempts lock the address, and other websites cannot post', async () => {
  const e = env(ME), t = NOW.getTime(), d = deps(e);
  assert.equal((await admin(post('login', { username: 'david', password: PASSWORD, code: codeAt(t) }), { ip: '2.2.2.2' }, d)).status, 200);
  assert.equal((await admin(post('login', { username: 'david', password: PASSWORD, code: codeAt(t) }), { ip: '2.2.2.2' }, d)).status, 401, 'the same code cannot be used twice');
  for (let i = 0; i < 5; i++) await admin(post('login', { username: 'david', password: 'nope' + i, code: '111111' }), { ip: '3.3.3.3' }, d);
  const locked = await admin(post('login', { username: 'david', password: PASSWORD, code: codeAt(t + 30000) }), { ip: '3.3.3.3' }, { ...d, now: () => new Date(t + 30000) });
  assert.equal(locked.status, 429, 'locked after five wrong attempts, even with the right details');
  assert.equal((await admin(post('login', { username: 'david', password: PASSWORD, code: codeAt(t + 60000) }), { ip: '4.4.4.4' }, { ...d, now: () => new Date(t + 60000) })).status, 200, 'another address is not affected');
  const noHeader = new Request('https://phoenix.neurohubcommunity.org/api/admin/login', { method: 'POST', body: '{}' });
  assert.equal((await admin(noHeader, {}, d)).status, 403); assert.equal((await admin(post('login', {}, { origin: 'https://evil.example' }), {}, d)).status, 403);
});

test('every backend page needs a signed-in Admin, and losing the role locks them out at once', async () => {
  const e = env(ME), d = deps(e), t = NOW.getTime();
  for (const path of ['me', 'usage', 'checkins']) { assert.equal((await admin(get(path), {}, d)).status, 401, path + ' with no cookie'); assert.equal((await admin(get(path, 'phx_admin=garbage'), {}, d)).status, 401, path + ' with a bad cookie'); }
  const login = await admin(post('login', { username: 'david', password: PASSWORD, code: codeAt(t) }), { ip: '5.5.5.5' }, d), cookie = cookieOf(login);
  const me = await admin(get('me', cookie), {}, d); assert.equal(me.status, 200); assert.equal((await me.json()).user, 'david');
  assert.equal((await admin(get('usage?days=3', cookie), {}, d)).status, 200); assert.equal((await admin(get('checkins', cookie), {}, d)).status, 200);
  assert.equal((await admin(get('nothing', cookie), {}, d)).status, 404);
  // someone with a valid cookie whose role is later changed, or who is removed, is refused immediately
  assert.equal((await admin(get('me', cookie), {}, deps(env({ david: { ...ME.david, role: 'viewer' } })))).status, 401);
  assert.equal((await admin(get('me', cookie), {}, deps(env({})))).status, 401);
  // a valid cookie made with someone else's secret is worthless
  assert.equal(adminFromRequest(get('me', 'phx_admin=' + signUserSession('z'.repeat(48), 'david', t)), e, t), null);
  const out = await admin(post('logout', {}), {}, d); assert.match(out.headers.get('set-cookie'), /Max-Age=0/);
});

// ---------------------------------------------------------------- shared check-ins
const pidA = 'a'.repeat(32);
const shareReq = (route, body, headers = {}) => new Request('https://phoenix.neurohubcommunity.org/api/share/' + route, { method: 'POST', headers: { 'content-type': 'application/json', ...headers }, body: JSON.stringify(body) });

test('sharing check-ins: only numbers and dates go in, one entry per day, and everything can be forgotten', async () => {
  const store = memoryStore(), d = { store, now: () => NOW };
  assert.equal((await share(shareReq('checkin', { pid: pidA, at: '2026-09-30', s: [3, 4, 3, 2, 3, 4, 5], note: 'I feel awful, my name is Sam' }), {}, d)).status, 200);
  const raw = await store.get('p:' + pidA); assert.ok(!/awful|Sam|note/.test(raw), 'no text is ever stored'); assert.deepEqual(Object.keys(JSON.parse(raw)).sort(), ['c', 'days']);
  await share(shareReq('checkin', { pid: pidA, at: '2026-09-30', s: [1, 1, 1, 1, 1, 1, 1] }), {}, d);
  assert.deepEqual(JSON.parse(await store.get('p:' + pidA)).days['2026-09-30'], [1, 1, 1, 1, 1, 1, 1], 'the latest for a day wins');
  for (const bad of [{ pid: 'short', at: '2026-09-30', s: [3, 3, 3, 3, 3, 3, 3] }, { pid: pidA, at: '2026-09-30', s: [3, 3, 3, 3, 3, 3] }, { pid: pidA, at: '2026-09-30', s: [3, 3, 3, 3, 3, 3, 9] }, { pid: pidA, at: '2026-09-30', s: [3, 3, 3, 3, 3, 3, 'x'] }, { pid: pidA, at: 'yesterday', s: [3, 3, 3, 3, 3, 3, 3] }, { pid: pidA, at: '2019-01-01', s: [3, 3, 3, 3, 3, 3, 3] }]) assert.equal((await share(shareReq('checkin', bad), {}, d)).status, 400, JSON.stringify(bad));
  assert.equal((await share(shareReq('checkin', { pid: pidA, at: '2026-09-30', s: [3, 3, 3, 3, 3, 3, 3] }, { origin: 'https://evil.example' }), {}, d)).status, 403);
  assert.deepEqual(JSON.parse(await store.get('index')), [pidA]);
  assert.equal((await share(shareReq('forget', { pid: pidA }), {}, d)).status, 200);
  assert.equal(await store.get('p:' + pidA), null); assert.deepEqual(JSON.parse(await store.get('index')), [], 'forgotten completely');
  const batch = await share(shareReq('checkin', { pid: pidA, entries: [{ at: '2026-09-01', s: [2, 2, 2, 2, 2, 2, 2] }, { at: '2026-09-02', s: [3, 3, 3, 3, 3, 3, 3] }, { at: 'bad', s: [] }] }), {}, d);
  assert.equal((await batch.json()).stored, 2, 'a batch keeps the good entries');
});

test('the app sends only the date and seven numbers', () => {
  const e = freshEntry(); e.createdAt = '2026-09-30T10:00:00Z'; e.overallMood = 2; e.urgentNote = 'private'; e.protect = 'private'; e.domains.forEach((x, i) => { x.rating = 1 + (i % 5); x.note = 'private note'; });
  const p = sharePayload(e); assert.deepEqual(Object.keys(p), ['at', 's']); assert.equal(p.at, '2026-09-30'); assert.deepEqual(p.s, [2, 1, 2, 3, 4, 5, 1]);
  assert.ok(!JSON.stringify(p).includes('private')); assert.match(newShareId(), /^[a-f0-9]{32}$/); assert.notEqual(newShareId(), newShareId()); assert.ok(validPid(newShareId()));
});

const person = (i, days) => ({ id: 'id' + i, days });
test('group results hide small groups, count each person once a week, and show change', () => {
  const four = [1, 2, 3, 4].map((i) => person(i, { '2026-09-29': [3, 3, 3, 3, 3, 3, 3] }));
  const s4 = summarise(four, { now: NOW }); assert.equal(s4.participants, 4); assert.ok(s4.weekly.every((w) => w.means === null), 'fewer than five people: no averages'); assert.equal(s4.latest, null); assert.equal(s4.change, null);
  assert.equal(trajectories(four), null, 'no individual lines below five people');
  const many = [1, 2, 3, 4, 5, 6].map((i) => person(i, { '2026-09-01': [2, 2, 2, 2, 2, 2, 2], '2026-09-02': [2, 2, 2, 2, 2, 2, 2], '2026-09-03': [2, 2, 2, 2, 2, 2, 2], '2026-09-29': [4, 5, 4, 3, 4, 4, 4] }));
  many.push(person(7, { '2026-09-29': [1, 1, 1, 1, 1, 1, 1] })); // five people is enough; the seventh has one check-in
  const s = summarise(many, { now: NOW });
  const sep28 = s.weekly.find((w) => w.week === weekStart('2026-09-29')); assert.equal(sep28.n, 7); assert.equal(sep28.means[0], Math.round(((4 * 6 + 1) / 7) * 100) / 100);
  const wk1 = s.weekly.find((w) => w.week === weekStart('2026-09-01')); assert.equal(wk1.n, 6); assert.equal(wk1.means[0], 2, 'three check-ins in one week still count as one person');
  assert.equal(s.change.n, 6); assert.equal(s.change.delta[0], 2); assert.equal(s.change.improved[0], 6); assert.equal(s.change.declined[0], 0);
  assert.equal(s.retention.atLeast2, 6); assert.equal(s.participants, 7); assert.equal(s.activeLast7, 7);
  const tr = trajectories(many); assert.ok(tr.length === 6 && tr.every((x) => /^P\d+$/.test(x.label)) && !JSON.stringify(tr).includes('id'), 'anonymous labels only');
  assert.equal(cleanEntry({ at: '2026-09-30', s: [1, 2, 3, 4, 5, 1, 2] }, NOW).scores.length, 7); assert.equal(cleanEntry({ at: '2026-09-30', s: [1.5, 2, 3, 4, 5, 1, 2] }, NOW), null);
});

test('end to end: people who share, seen by an Admin', async () => {
  const store = memoryStore(), now = () => NOW;
  for (let i = 0; i < 6; i++) { const pid = String(i).repeat(32).slice(0, 32).replace(/[^a-f0-9]/g, 'a'); for (const [day, v] of [['2026-09-10', 2], ['2026-09-29', 4]]) await share(shareReq('checkin', { pid: pid + '', at: day, s: [v, v, v, v, v, v, v] }), {}, { store, now }); }
  const idx = JSON.parse(await store.get('index')); assert.ok(idx.length >= 2);
  const e = env(ME), d = deps(e, { checkinStore: store }), login = await admin(post('login', { username: 'david', password: PASSWORD, code: codeAt(NOW.getTime()) }), { ip: '8.8.4.4' }, d);
  const r = await admin(get('checkins?weeks=12', cookieOf(login)), {}, d), j = await r.json();
  assert.equal(r.status, 200); assert.equal(j.summary.participants, idx.length); assert.equal(j.trajectories, undefined, 'individual lines only when asked for');
  assert.ok(JSON.stringify(j).indexOf('pid') === -1);
});

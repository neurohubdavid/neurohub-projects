// Accounts: sign-in codes, sessions, sealed synced data, deletion, and what is (and is not) ever stored.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { handle } from '../netlify/functions/account.mjs';
import { handle as aiHandle } from '../netlify/functions/ai.mjs';
import { handle as adminHandle } from '../netlify/functions/admin.mjs';
import { buildSystem } from '../app/js/persona.js';
import { memoryStore } from '../netlify/functions/_lib/kv.mjs';
import { accountSettings, normaliseEmail, accountId, cleanCode, seal, unseal, roleFor } from '../netlify/functions/_lib/accounts.mjs';

const ORIGIN = 'https://phoenix.neurohubcommunity.org';
const env = { PHOENIX_DATA_KEY: randomBytes(32).toString('base64') };
function rig(extra = {}) {
  const store = memoryStore(), stats = memoryStore(), mails = [];
  let clock = Date.parse('2026-10-05T10:00:00Z');
  const deps = { env, store, stats, send: async (m) => { mails.push(m); return true; }, now: () => new Date(clock), ...extra };
  const call = (path, { method = 'GET', body, token, origin = ORIGIN, ip = '203.0.113.5' } = {}) => handle(new Request('https://x/api/account/' + path, { method, headers: { ...(origin ? { origin } : {}), 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body) }), { ip }, deps);
  const codeFrom = (m) => /sign-in code is ([A-Z0-9]{4}-[A-Z0-9]{4})/.exec(m.text)[1];
  const signIn = async (email = 'sam@example.com') => { await call('request', { method: 'POST', body: { email } }); const code = codeFrom(mails.at(-1)); const r = await call('verify', { method: 'POST', body: { email, code } }); return { r, j: await r.json(), code }; };
  return { store, stats, mails, deps, call, signIn, advance: (ms) => { clock += ms; }, codeFrom };
}

test('accounts: off unless the server has its key and a way to send email', async () => {
  const off = await handle(new Request('https://x/api/account/status', { headers: { origin: ORIGIN } }), {}, { env: {}, store: memoryStore() });
  assert.equal((await off.json()).enabled, false);
  assert.equal((await handle(new Request('https://x/api/account/request', { method: 'POST', headers: { origin: ORIGIN }, body: '{"email":"a@b.co"}' }), {}, { env: {}, store: memoryStore() })).status, 503);
  assert.equal(accountSettings({ PHOENIX_DATA_KEY: 'short', BREVO_API_KEY: 'k', MAIL_FROM: 'a@b.co' }).on, false);
  assert.equal(accountSettings({ PHOENIX_DATA_KEY: env.PHOENIX_DATA_KEY, BREVO_API_KEY: 'k', MAIL_FROM: 'a@b.co' }).on, true);
  assert.equal(accountSettings({ PHOENIX_DATA_KEY: env.PHOENIX_DATA_KEY, BREVO_API_KEY: 'k', MAIL_FROM: 'a@b.co', PHOENIX_ACCOUNTS: 'off' }).on, false, 'kill switch');
});

test('accounts: a code is emailed, signs in once, and the first sign-in creates the account', async () => {
  const t = rig();
  const { r, j } = await t.signIn();
  assert.equal(r.status, 200); assert.equal(j.isNew, true); assert.ok(j.token.length >= 40);
  assert.equal(t.mails.length, 1); assert.equal(t.mails[0].to, 'sam@example.com'); assert.match(t.mails[0].subject, /sign-in code/);
  assert.match(t.mails[0].html, /\/app\/\?code=[A-Z0-9]{4}-[A-Z0-9]{4}/);
  const used = await t.call('verify', { method: 'POST', body: { email: 'sam@example.com', code: t.codeFrom(t.mails[0]) } });
  assert.equal(used.status, 400, 'a code works only once');
  const again = await t.signIn(); assert.equal(again.j.isNew, false, 'the same email signs in to the same account');
  assert.equal(await (await t.call('data', { token: again.j.token })).json().then((x) => x.data), null);
});

test('accounts: no email address is stored anywhere, and the same answer is given for everyone', async () => {
  const t = rig();
  const a = await t.call('request', { method: 'POST', body: { email: 'Sam@Example.com' } }), b = await t.call('request', { method: 'POST', body: { email: 'someone-else@example.org' } });
  assert.deepEqual(await a.json(), await b.json());
  await t.signIn('Sam@Example.com');
  const everything = JSON.stringify([...(await dump(t.store)), ...(await dump(t.stats))]);
  assert.ok(!/sam@|example\.com|example\.org|someone-else/i.test(everything), 'no email address in the database');
  assert.equal(normaliseEmail(' SAM@Example.com '), 'sam@example.com');
  assert.equal(accountId(accountSettings(env).idKey, 'sam@example.com'), accountId(accountSettings(env).idKey, normaliseEmail('SAM@EXAMPLE.COM')));
  for (const bad of ['', 'nope', 'a@b', '<x>@y.co', 'a b@c.de']) assert.equal((await t.call('request', { method: 'POST', body: { email: bad } })).status, 400, bad);
});
async function dump(store) { return store.entries(); }

test('accounts: wrong codes are limited, and codes expire', async () => {
  const t = rig();
  await t.call('request', { method: 'POST', body: { email: 'sam@example.com' } });
  const good = t.codeFrom(t.mails[0]);
  for (let i = 0; i < 5; i++) { const r = await t.call('verify', { method: 'POST', body: { email: 'sam@example.com', code: 'ZZZZ-ZZZZ' } }); assert.equal(r.status, 400); }
  const locked = await t.call('verify', { method: 'POST', body: { email: 'sam@example.com', code: good } });
  assert.equal(locked.status, 400, 'after five wrong tries even the right code is refused');
  await t.call('request', { method: 'POST', body: { email: 'sam@example.com' } });
  const fresh = t.codeFrom(t.mails.at(-1)); t.advance(16 * 60000);
  assert.equal((await t.call('verify', { method: 'POST', body: { email: 'sam@example.com', code: fresh } })).status, 400, 'expired after 15 minutes');
  assert.equal(cleanCode('abcd-efgh'), 'ABCDEFGH');
});

test('accounts: requests are rate limited, only Phoenix’s own sites may use them, and junk is refused', async () => {
  const t = rig();
  for (let i = 0; i < 5; i++) assert.equal((await t.call('request', { method: 'POST', body: { email: 'sam@example.com' } })).status, 200);
  assert.equal((await t.call('request', { method: 'POST', body: { email: 'sam@example.com' } })).status, 429, 'five emails an hour to one address');
  const t2 = rig(); let blocked = 0;
  for (let i = 0; i < 25; i++) if ((await t2.call('request', { method: 'POST', body: { email: `p${i}@example.com` } })).status === 429) blocked++;
  assert.ok(blocked >= 5, 'one place cannot send unlimited emails');
  const t3 = rig();
  assert.equal((await t3.call('request', { method: 'POST', body: { email: 'a@b.co' }, origin: 'https://evil.example' })).status, 403);
  assert.equal((await t3.call('request', { method: 'POST', body: { email: 'a@b.co' }, origin: '' })).status, 403);
  assert.equal((await t3.call('request', { method: 'POST', body: '{{{' })).status, 400);
  const w = rig(); const tok = (await w.signIn()).j.token;
  assert.equal((await w.call('data', { token: tok, origin: '' })).status, 200, 'a signed-in request from the same site (browsers send no Origin on same-site reads) works');
  assert.equal((await w.call('data', { token: 'x'.repeat(43), origin: 'https://evil.example' })).status, 401, 'a foreign site without the person token gets nothing');
  assert.equal(t3.mails.length, 0);
});

test('accounts: data is saved sealed, comes back intact, and a second device that saves first is noticed', async () => {
  const t = rig(); const { j } = await t.signIn(); const token = j.token;
  const secret = { memories: [{ id: 'm1', text: 'prefers short replies and calm colours' }], profile: { name: 'Samwise-Test' } };
  const put = await t.call('data', { method: 'PUT', token, body: { data: secret, base: null } }); assert.equal(put.status, 200);
  const first = (await put.json()).updated;
  const raw = (await dump(t.store)).map(([k, v]) => v).join('\n');
  assert.ok(!raw.includes('prefers short replies') && !raw.includes('Samwise-Test'), 'sealed at rest');
  const got = await (await t.call('data', { token })).json();
  assert.deepEqual(got.data, secret); assert.equal(got.updated, first);
  const stale = await t.call('data', { method: 'PUT', token, body: { data: { x: 1 }, base: null } });
  assert.equal(stale.status, 409); assert.deepEqual((await stale.json()).data, secret);
  const ok = await t.call('data', { method: 'PUT', token, body: { data: { ...secret, more: true }, base: first } }); assert.equal(ok.status, 200);
  assert.notEqual((await ok.json()).updated, first);
  assert.equal((await t.call('data', { method: 'PUT', token, body: { data: [1] , base: null } })).status, 400);
  assert.equal((await t.call('data', { method: 'PUT', token, body: 'x'.repeat(1700000) })).status, 413);
  const k = accountSettings(env).key, s = seal({ a: 1 }, k); assert.deepEqual(unseal(s, k), { a: 1 });
  assert.throws(() => unseal(s, randomBytes(32)), 'the wrong key cannot read it');
});

test('accounts: signed-out, wrong and ended sessions get nothing; sign-out can end every device', async () => {
  const t = rig();
  assert.equal((await t.call('data')).status, 401); assert.equal((await t.call('data', { token: 'x'.repeat(43) })).status, 401);
  const a = (await t.signIn()).j.token, b = (await t.signIn()).j.token;
  await t.call('data', { method: 'PUT', token: a, body: { data: { n: 1 }, base: null } });
  assert.equal((await t.call('logout', { method: 'POST', token: a, body: {} })).status, 200);
  assert.equal((await t.call('data', { token: a })).status, 401, 'this device is signed out');
  assert.equal((await t.call('data', { token: b })).status, 200, 'the other device is not');
  const c = (await t.signIn()).j.token;
  await t.call('logout', { method: 'POST', token: c, body: { all: true } });
  assert.equal((await t.call('data', { token: b })).status, 401); assert.equal((await t.call('data', { token: c })).status, 401);
  const d = (await t.signIn()).j.token; t.advance(91 * 86400000);
  assert.equal((await t.call('data', { token: d })).status, 401, 'sessions end after 90 days');
});

test('accounts: export gives everything, and delete removes the account and its data for good', async () => {
  const t = rig(); const { j } = await t.signIn(); const token = j.token;
  await t.call('data', { method: 'PUT', token, body: { data: { memories: [{ id: 'm', text: 'likes quiet mornings' }] }, base: null } });
  const ex = await t.call('export', { token });
  assert.match(ex.headers.get('content-disposition'), /attachment/); assert.match(await ex.text(), /likes quiet mornings/);
  assert.equal((await t.call('delete', { method: 'POST', token, body: {} })).status, 400, 'needs the word DELETE');
  assert.equal((await t.call('delete', { method: 'POST', token, body: { confirm: 'DELETE' } })).status, 200);
  assert.equal((await t.call('data', { token })).status, 401);
  const after = (await dump(t.store)).filter(([k]) => /^(data|acct|sess):/.test(k));
  assert.deepEqual(after, [], 'nothing left');
  const re = await t.signIn(); assert.equal(re.j.isNew, true, 'signing in again starts a fresh, empty account');
  assert.equal((await (await t.call('data', { token: re.j.token })).json()).data, null);
});

test('accounts: only counts are kept for the backend (created, sign-ins, deleted), never who', async () => {
  const t = rig(); const { j } = await t.signIn(); await t.signIn('other@example.com');
  await t.call('delete', { method: 'POST', token: j.token, body: { confirm: 'DELETE' } });
  const day = JSON.parse(await t.stats.get('day:2026-10-05:account'));
  assert.equal(day['e:account:created'], 2); assert.equal(day['e:account:signin'], 2); assert.equal(day['e:account:deleted'], 1); assert.equal(day['e:account:code_sent'], 2);
  assert.equal(await t.stats.get('accounts:total'), '1');
});

test('Phoenix AI: signed-in people get a bigger allowance counted by account, and memory notes have their own small allowance', async () => {
  const t = rig(); const { j } = await t.signIn(); const token = j.token;
  const usage = memoryStore(), aiEnv = { PHOENIX_ANTHROPIC_KEY: 'sk-ant-test-key-1234567890', PHOENIX_PER_PERSON_DAILY: '3', PHOENIX_ACCOUNT_DAILY: '5', PHOENIX_GLOBAL_DAILY: '999', PHOENIX_GLOBAL_MONTHLY: '9999' };
  const upstream = async () => new Response('data: {"type":"message_stop"}\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
  const sys = buildSystem({ crisisBlock: 'Samaritans 116 123' });
  const memSys = buildSystem({ crisisBlock: 'x' }) + '\nMEMORY NOTES TASK: write short notes.';
  const ask = (body, tok, ip = '198.51.100.7') => aiHandle(new Request('https://x/api/ai', { method: 'POST', headers: { origin: ORIGIN, ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify({ system: sys, messages: [{ role: 'user', content: 'hi' }], ...body }) }), { ip }, { env: aiEnv, store: usage, stats: memoryStore(), accountStore: t.store, fetch: upstream, now: t.deps.now });
  const status = async (tok, ip) => (await (await aiHandle(new Request('https://x/api/ai', { headers: { origin: ORIGIN, ...(tok ? { authorization: 'Bearer ' + tok } : {}) } }), { ip }, { env: aiEnv, store: usage, stats: memoryStore(), accountStore: t.store, now: t.deps.now })).json());
  assert.equal((await status(null)).perDay, 3); const s = await status(token); assert.equal(s.perDay, 5); assert.equal(s.signedIn, true);
  for (let i = 0; i < 5; i++) assert.equal((await ask({}, token, '203.0.113.' + i)).status, 200, 'reply ' + i + ' (a new network does not reset the account)');
  const over = await ask({}, token); assert.equal(over.status, 429); assert.equal((await over.json()).scope, 'person');
  assert.equal((await ask({}, null, '198.51.100.99')).status, 200, 'a signed-out person on another network is unaffected');
  // memory notes: need an account, use their own allowance, and still work when the chat allowance is used up
  assert.equal((await ask({ purpose: 'memory', system: memSys }, null)).status, 401);
  for (let i = 0; i < 10; i++) assert.equal((await ask({ purpose: 'memory', system: memSys }, token)).status, 200, 'note ' + i);
  assert.equal((await (await ask({ purpose: 'memory', system: memSys }, token)).json()).scope, 'memory');
  assert.equal((await ask({ purpose: 'memory' }, token)).status, 400, 'a memory request must be Phoenix’s own memory prompt');
  const t2 = await ask({ system: memSys }, token); assert.equal(t2.status, 400, 'the memory prompt is not accepted as an ordinary chat');
});

test('Phoenix AI: voice chat needs a signed-in account (the server checks it too), while typed chat does not', async () => {
  const t = rig(); const { j } = await t.signIn();
  const usage = memoryStore(), aiEnv = { PHOENIX_ANTHROPIC_KEY: 'sk-ant-test-key-1234567890', PHOENIX_GLOBAL_DAILY: '999', PHOENIX_GLOBAL_MONTHLY: '9999' };
  const upstream = async () => new Response('data: {"type":"message_stop"}\n\n', { status: 200, headers: { 'content-type': 'text/event-stream' } });
  const sys = buildSystem({ crisisBlock: 'Samaritans 116 123' });
  const ask = (extra, tok) => aiHandle(new Request('https://x/api/ai', { method: 'POST', headers: { origin: ORIGIN, ...(tok ? { authorization: 'Bearer ' + tok } : {}) }, body: JSON.stringify({ system: sys, messages: [{ role: 'user', content: 'hi' }], ...extra }) }), { ip: '198.51.100.8' }, { env: aiEnv, store: usage, stats: memoryStore(), accountStore: t.store, fetch: upstream, now: t.deps.now });
  assert.equal((await ask({})).status, 200, 'typed chat, signed out');
  const refused = await ask({ voice: true }); assert.equal(refused.status, 401); assert.equal((await refused.json()).error, 'account_required');
  assert.equal((await ask({ voice: true }, 'x'.repeat(43))).status, 401, 'a made-up token does not count');
  assert.equal((await ask({ voice: true }, j.token)).status, 200, 'signed in, voice chat works');
  assert.equal((await ask({ voice: false })).status, 200);
});

test('roles: every new sign-up is a User, nobody can make themselves an Admin, and an account can never open the backend', async () => {
  const t = rig(); const { j } = await t.signIn('newperson@example.com');
  assert.equal(j.isNew, true); assert.equal(j.role, 'user', 'a new sign-up is a User');
  const me = await (await t.call('me', { token: j.token })).json(); assert.equal(me.role, 'user');
  const stored = JSON.parse([...(await dump(t.store))].find(([k]) => k.startsWith('acct:'))[1]); assert.equal(stored.role, 'user');
  // the sign-in request cannot carry a role, and nothing the page sends changes it
  const r2 = await t.call('verify', { method: 'POST', body: { email: 'newperson@example.com', code: 'AAAA-AAAA', role: 'admin' } }); assert.equal(r2.status, 400);
  await t.call('data', { method: 'PUT', token: j.token, body: { data: { role: 'admin', account: { role: 'admin' } }, base: null } });
  assert.equal((await (await t.call('me', { token: j.token })).json()).role, 'user', 'saved data cannot promote an account');
  // only the owner can name Admins, by fingerprint, in the server setting
  const id = accountId(accountSettings(env).idKey, normaliseEmail('newperson@example.com'));
  assert.equal(roleFor(id, {}), 'user'); assert.equal(roleFor(id, { PHOENIX_ADMIN_ACCOUNTS: 'someoneelse, ' + id }), 'admin'); assert.equal(roleFor(id, { PHOENIX_ADMIN_ACCOUNTS: id.slice(0, 20) }), 'user', 'a part of a fingerprint is not enough');
  const t2 = rig({ env: { ...env, PHOENIX_ADMIN_ACCOUNTS: id } }); const a = await t2.signIn('newperson@example.com'); assert.equal(a.j.role, 'admin');
  // the private backend is closed to every account session, User or Admin: it needs the owner's separate backend sign-in
  for (const tok of [j.token, a.j.token, 'x'.repeat(43)]) {
    for (const route of ['usage', 'checkins', 'report', 'me']) {
      const res = await adminHandle(new Request('https://x/api/admin/' + route, { headers: { authorization: 'Bearer ' + tok, cookie: 'phx_admin=' + tok } }), { ip: '7.7.7.7' }, { env: { ADMIN_SESSION_SECRET: 's'.repeat(40), ADMIN_USERS: '{}' }, store: memoryStore() });
      assert.equal(res.status, 401, route);
    }
  }
});

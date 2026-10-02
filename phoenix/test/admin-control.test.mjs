// The backend's one control and its status: only a signed-in Admin can read the status or pause Phoenix AI, a pause really stops the AI
// endpoint, resuming brings it back, every change is logged with who and when, and the status never contains a secret.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, totp, base32, signUserSession } from '../netlify/functions/_lib/admin.mjs';
import { handle as admin } from '../netlify/functions/admin.mjs';
import { handle as ai } from '../netlify/functions/ai.mjs';
import { memoryStore } from '../netlify/functions/_lib/kv.mjs';

const SECRET = 'x'.repeat(48), NOW = new Date('2026-10-01T12:00:00Z');
const hash = await hashPassword('correct-horse-battery-9');
const env = { ADMIN_SESSION_SECRET: SECRET, ADMIN_USERS: JSON.stringify({ david: { role: 'admin', hash, totp: base32(Buffer.from('12345678901234567890')) } }), PHOENIX_ANTHROPIC_KEY: 'sk-ant-SECRET-VALUE', BREVO_API_KEY: 'xkeysib-SECRET', MAIL_FROM: 'a@b.c', PHOENIX_DATA_KEY: 'DATAKEY-SECRET', PHOENIX_ADMIN_ACCOUNTS: 'abc123, def456' };
const cookie = 'phx_admin=' + signUserSession(SECRET, 'david', NOW.getTime());
const aiStore = memoryStore(), guard = memoryStore();
const deps = { env, store: guard, aiStore, now: () => NOW };
const call = (method, path, body, c = cookie, csrf = true) => admin(new Request('https://phoenix.neurohubcommunity.org/api/admin/' + path, { method, headers: { 'content-type': 'application/json', ...(c ? { cookie: c } : {}), ...(csrf && method === 'POST' ? { 'x-admin-csrf': '1' } : {}) }, body: body ? JSON.stringify(body) : undefined }), {}, deps);
const aiOn = async () => (await (await ai(new Request('https://phoenix.neurohubcommunity.org/api/ai'), {}, { env, store: aiStore })).json()).ai;

test('status: only a signed-in Admin, yes/no and numbers only, never a secret', async () => {
  assert.equal((await call('GET', 'status', null, '')).status, 401); assert.equal((await call('GET', 'status', null, 'phx_admin=garbage')).status, 401);
  const r = await call('GET', 'status'); assert.equal(r.status, 200); const text = await r.text(), j = JSON.parse(text);
  assert.equal(j.ai.keySet, true); assert.equal(j.ai.paused, false); assert.equal(j.accounts.emailSetUp, true); assert.equal(j.accounts.dataKeySet, true); assert.equal(j.accounts.adminAccounts, 2); assert.equal(j.backendUsers, 1);
  for (const secret of ['SECRET', 'xkeysib', 'sk-ant', 'DATAKEY', 'abc123']) assert.ok(!text.includes(secret), 'no secret in the status: ' + secret);
});
test('control: pausing stops Phoenix AI at once, resuming brings it back, and each change is logged', async () => {
  assert.equal(await aiOn(), true);
  assert.equal((await call('POST', 'control', { aiPaused: true }, '')).status, 401, 'signed out');
  assert.equal((await call('POST', 'control', { aiPaused: true }, cookie, false)).status, 403, 'no CSRF header');
  assert.equal((await call('POST', 'control', { aiPaused: 'yes' })).status, 400, 'must be true or false');
  assert.equal(await aiOn(), true, 'nothing changed by the refused requests');
  const paused = await (await call('POST', 'control', { aiPaused: true })).json(); assert.equal(paused.ai.paused, true); assert.equal(await aiOn(), false);
  // a real chat request while paused is told the AI is unavailable
  const sys = 'You are Phoenix. ' + 'x'.repeat(200) + ' CRISIS SUPPORT DETAILS';
  const chat = await ai(new Request('https://phoenix.neurohubcommunity.org/api/ai', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ system: sys, messages: [{ role: 'user', content: 'hi' }] }) }), { ip: '9.9.9.9' }, { env, store: aiStore, stats: memoryStore() });
  assert.equal(chat.status, 503);
  const resumed = await (await call('POST', 'control', { aiPaused: false })).json(); assert.equal(resumed.ai.paused, false); assert.equal(await aiOn(), true);
  assert.deepEqual(resumed.changes.map((c) => [c.user, c.what]), [['david', 'Resumed Phoenix AI'], ['david', 'Paused Phoenix AI']]);
});
test('status says so when the key is missing or the server switch is off', async () => {
  const s1 = await (await admin(new Request('https://x/api/admin/status', { headers: { cookie } }), {}, { ...deps, env: { ...env, PHOENIX_ANTHROPIC_KEY: '' } })).json(); assert.equal(s1.ai.keySet, false);
  const s2 = await (await admin(new Request('https://x/api/admin/status', { headers: { cookie } }), {}, { ...deps, env: { ...env, PHOENIX_SHARED_AI: 'off' } })).json(); assert.equal(s2.ai.switchedOffByEnv, true);
});

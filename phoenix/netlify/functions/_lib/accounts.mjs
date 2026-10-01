// Phoenix accounts (optional): the pieces that must never be wrong, kept small and tested.
//   - No email address is ever stored. A person's account is found by an HMAC of their email (a one-way fingerprint) made with a
//     server-only key, so nobody reading the database can see or recover an address.
//   - Synced data is sealed with AES-256-GCM using a server-only key before it is stored, so it is unreadable in the database.
//   - Sign-in uses a one-time code that is emailed. Only a hash of the code is stored, it expires, and it locks after a few wrong tries.
//   - A session is a random token. Only its hash is stored. The app keeps the token on the person's own device.
import { createHash, createHmac, createCipheriv, createDecipheriv, randomBytes, hkdfSync, timingSafeEqual } from 'node:crypto';

export const CODE_MINUTES = 15, CODE_TRIES = 5, SESSION_DAYS = 90, MAX_SESSIONS = 12, MAX_DATA_BYTES = 1600000;
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no I, L, O, 0 or 1: nothing that can be misread

/** Is the account system switched on? It needs a server key; emailing needs Brevo (or a stand-in for tests). */
export function accountSettings(env = process.env, deps = {}) {
  let key = null;
  try { const k = Buffer.from(String(env.PHOENIX_DATA_KEY || ''), 'base64'); if (k.length === 32) key = k; } catch { /* no key */ }
  const canSend = !!deps.send || (!!env.BREVO_API_KEY && !!env.MAIL_FROM);
  return {
    on: !!key && canSend && env.PHOENIX_ACCOUNTS !== 'off',
    key,
    idKey: key ? Buffer.from(hkdfSync('sha256', key, Buffer.alloc(0), 'phoenix-email-id', 32)) : null,
    brevo: env.BREVO_API_KEY || '', from: env.MAIL_FROM || '',
    perDay: Number(env.PHOENIX_ACCOUNT_DAILY) > 0 ? Number(env.PHOENIX_ACCOUNT_DAILY) : 30, // Phoenix AI replies a day for signed-in people
    memoryPerDay: 10, // separate, small allowance for Phoenix writing its notes
  };
}

export function normaliseEmail(s) {
  const e = String(s || '').trim().toLowerCase();
  return e.length <= 254 && /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[^\s@<>()[\]\\,;:"]{2,}$/.test(e) ? e : '';
}
/** The account's identifier: a one-way fingerprint of the email. */
export const accountId = (idKey, email) => createHmac('sha256', idKey).update(email).digest('hex').slice(0, 40);

export function newCode() {
  const b = randomBytes(8); let c = '';
  for (let i = 0; i < 8; i++) c += ALPHABET[b[i] % ALPHABET.length];
  return c;
}
export const prettyCode = (c) => `${c.slice(0, 4)}-${c.slice(4)}`;
export const cleanCode = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
export const sha = (s) => createHash('sha256').update(String(s)).digest('hex');
export const newToken = () => randomBytes(32).toString('base64url');
export function sameHash(a, b) { const x = Buffer.from(a), y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x, y); }

/** Seals data so that the database holds only unreadable bytes. */
export function seal(obj, key) {
  const iv = randomBytes(12), c = createCipheriv('aes-256-gcm', key, iv);
  const ct = Buffer.concat([c.update(JSON.stringify(obj), 'utf8'), c.final()]);
  return JSON.stringify({ v: 1, iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), ct: ct.toString('base64') });
}
export function unseal(text, key) {
  const o = JSON.parse(text);
  const d = createDecipheriv('aes-256-gcm', key, Buffer.from(o.iv, 'base64')); d.setAuthTag(Buffer.from(o.tag, 'base64'));
  return JSON.parse(Buffer.concat([d.update(Buffer.from(o.ct, 'base64')), d.final()]).toString('utf8'));
}

/** Roles: every new sign-up is a "user". "admin" cannot be chosen by anyone signing up: it is given only to the account fingerprints the owner lists
 *  in the server setting PHOENIX_ADMIN_ACCOUNTS (see scripts/account-role.mjs). Only an admin can use the private backend. */
export const ROLES = ['user', 'admin'];
export function roleFor(id, env = process.env) {
  const admins = String(env.PHOENIX_ADMIN_ACCOUNTS || '').split(/[\s,]+/).filter(Boolean);
  return admins.includes(id) ? 'admin' : 'user';
}

export const bearer = (req) => (/^Bearer\s+([A-Za-z0-9_-]{20,80})$/.exec(req.headers.get('authorization') || '') || [])[1] || '';

/** The account a session token belongs to, or null. Also keeps a used session alive (sliding expiry). */
export async function sessionAccount(store, token, now = Date.now()) {
  if (!token) return null;
  try {
    const k = `sess:${sha(token)}`, raw = await store.get(k); if (!raw) return null;
    const s = JSON.parse(raw);
    if (!s.acct || s.exp < now) { await store.delete(k); return null; }
    if (s.exp - now < (SESSION_DAYS - 30) * 86400000) { s.exp = now + SESSION_DAYS * 86400000; await store.set(k, JSON.stringify(s)); }
    return s.acct;
  } catch { return null; }
}

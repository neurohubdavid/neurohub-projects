// Sign-in for the private backend, with roles. People are listed in the ADMIN_USERS secret as
//   { "name": { "role": "admin", "hash": "scrypt$...", "totp": "BASE32" } }
// and only someone whose role is exactly "admin" can get in. To sign in they need all of:
//   1. their password (stored only as a scrypt hash),
//   2. a current code from their authenticator app, and
//   3. after that, a signed, short-lived, HttpOnly cookie (signed with ADMIN_SESSION_SECRET).
// The role is re-checked on every request, so removing someone or changing their role locks them out at once (after a redeploy).
// Wrong attempts are slowed down and locked out per address. If the secrets are missing, the backend stays closed.
import { createHmac, createHash, scrypt, timingSafeEqual, randomBytes } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
export const COOKIE = 'phx_admin';
export const SESSION_HOURS = 8;

const b64u = (b) => Buffer.from(b).toString('base64url');
const safeEq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

// ---------------------------------------------------------------- password (scrypt)
export async function hashPassword(password, { N = 16384, r = 8, p = 1 } = {}) {
  const salt = randomBytes(16), key = await scryptAsync(String(password), salt, 32, { N, r, p });
  return `scrypt$${N}$${r}$${p}$${salt.toString('base64')}$${key.toString('base64')}`;
}
export async function verifyPassword(password, stored) {
  try {
    const [kind, N, r, p, salt, hash] = String(stored || '').split('$');
    if (kind !== 'scrypt' || !hash) return false;
    const key = await scryptAsync(String(password), Buffer.from(salt, 'base64'), 32, { N: +N, r: +r, p: +p });
    return safeEq(key.toString('base64'), hash);
  } catch { return false; }
}

// ---------------------------------------------------------------- one-time codes (TOTP, RFC 6238)
const ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export const base32 = (buf) => { let bits = '', out = ''; for (const b of buf) bits += b.toString(2).padStart(8, '0'); for (let i = 0; i < bits.length; i += 5) out += ALPHA[parseInt(bits.slice(i, i + 5).padEnd(5, '0'), 2)]; return out; };
export const unbase32 = (s) => { let bits = ''; for (const c of String(s).replace(/[\s=-]/g, '').toUpperCase()) { const i = ALPHA.indexOf(c); if (i < 0) throw new Error('bad base32'); bits += i.toString(2).padStart(5, '0'); } const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
export function totp(secret, counter) {
  const msg = Buffer.alloc(8); msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac('sha1', unbase32(secret)).update(msg).digest(), o = h[h.length - 1] & 15;
  return String(((h[o] & 0x7f) << 24 | h[o + 1] << 16 | h[o + 2] << 8 | h[o + 3]) % 1e6).padStart(6, '0');
}
/** Returns the matching time step (so it can be remembered and never accepted twice), or null. Allows one step either side for clock drift. */
export function checkTotp(secret, code, now = Date.now()) {
  if (!/^\d{6}$/.test(String(code || '').replace(/\s/g, ''))) return null;
  const c = String(code).replace(/\s/g, ''), step = Math.floor(now / 30000);
  for (const s of [step, step - 1, step + 1]) if (safeEq(totp(secret, s), c)) return s;
  return null;
}

// ---------------------------------------------------------------- session cookie
export function signSession(secret, now = Date.now(), hours = SESSION_HOURS) {
  const payload = b64u(JSON.stringify({ iat: now, exp: now + hours * 3600000, n: randomBytes(8).toString('hex') }));
  return `${payload}.${b64u(createHmac('sha256', secret).update(payload).digest())}`;
}
export function verifySession(secret, token, now = Date.now()) {
  try {
    const [payload, sig] = String(token || '').split('.');
    if (!payload || !sig || !safeEq(sig, b64u(createHmac('sha256', secret).update(payload).digest()))) return false;
    const { exp } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return typeof exp === 'number' && exp > now;
  } catch { return false; }
}
export const cookieFrom = (req, name = COOKIE) => { const m = (req.headers.get('cookie') || '').match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`)); return m ? m[1] : ''; };
export const sessionCookie = (value, maxAge = SESSION_HOURS * 3600) => `${COOKIE}=${value}; Path=/; Max-Age=${maxAge}; HttpOnly; Secure; SameSite=Strict`;

/** The people who may try to sign in: the ADMIN_USERS secret, parsed. Bad or missing data means nobody. */
export function adminUsers(env = process.env) {
  try { const o = JSON.parse(env.ADMIN_USERS || '{}'); return o && typeof o === 'object' ? o : {}; } catch { return {}; }
}
export const ROLE_REQUIRED = 'admin';
/** Only the exact role "admin" gets in. Any other role, a missing role, or an unknown name does not. */
export const hasAdminRole = (user) => !!user && user.role === ROLE_REQUIRED && !!user.hash && !!user.totp;

/** Make a session cookie value carrying who signed in. */
export function signUserSession(secret, username, now = Date.now(), hours = SESSION_HOURS) {
  const payload = b64u(JSON.stringify({ u: username, iat: now, exp: now + hours * 3600000, n: randomBytes(8).toString('hex') }));
  return `${payload}.${b64u(createHmac('sha256', secret).update(payload).digest())}`;
}
/** Who is this request from, if they are a signed-in person who still has the Admin role? Returns their name, or null. Every admin route calls this first. */
export function adminFromRequest(req, env = process.env, now = Date.now()) {
  const secret = env.ADMIN_SESSION_SECRET;
  if (!secret || secret.length < 32) return null;
  const token = cookieFrom(req);
  if (!verifySession(secret, token, now)) return null;
  let u; try { u = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString()).u; } catch { return null; }
  const users = adminUsers(env);
  return typeof u === 'string' && Object.hasOwn(users, u) && hasAdminRole(users[u]) ? u : null;
}
export const ipHash = (ip, salt) => createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 24);
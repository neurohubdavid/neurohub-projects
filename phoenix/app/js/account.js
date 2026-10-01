// The optional Phoenix account on this device: signing in with an emailed code, keeping devices in sync, and signing out.
// Everything works the same without an account. With one, the person's chats, check-ins, documents, settings and memories follow them
// between devices, and Phoenix can remember things. The server never stores their email address (see netlify/functions/_lib/accounts.mjs).
import { state, save, flush } from './store.js';
import { bus, toast } from './util.js';
import { setAuthToken, setSignedOutHandler } from './providers.js';
import { pickSyncable, mergeData, applySynced, touchScalars } from './sync-core.js';
import { trackFeature } from './analytics.js';

const base = () => (/^https?:/.test(location.protocol) ? location.origin : 'https://phoenix.neurohubcommunity.org') + '/api/account';
export const signedIn = () => !!state.account?.token;

let enabledCache = null, syncing = false, quiet = false, timer = null, again = false;

/** Is the account system switched on at the server? (Cached for the session.) */
export async function accountsEnabled() {
  if (enabledCache !== null) return enabledCache;
  try { const r = await fetch(`${base()}/status`); enabledCache = r.ok ? !!(await r.json()).enabled : false; } catch { return false; }
  return enabledCache;
}

const authed = (init = {}) => ({ ...init, headers: { 'content-type': 'application/json', ...(init.headers || {}), authorization: `Bearer ${state.account.token}` } });

/** Asks for a sign-in code by email. Returns {ok} or {error: 'bad_email' | 'slow_down' | 'mail_failed' | 'network'}. */
export async function requestCode(email) {
  try {
    const r = await fetch(`${base()}/request`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email }) });
    const j = await r.json().catch(() => ({}));
    return r.ok ? { ok: true, minutes: j.minutes } : { error: j.error || 'network' };
  } catch { return { error: 'network' }; }
}

/** Signs in with the emailed code, then joins this device's data with the account's. Returns {ok, isNew} or {error, triesLeft?}. */
export async function verifyCode(email, code) {
  try {
    const r = await fetch(`${base()}/verify`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email, code }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) return { error: j.error || 'network', triesLeft: j.triesLeft, expired: j.expired };
    Object.assign(state.account, { token: j.token, email: String(email).trim().toLowerCase(), signedInAt: Date.now(), sync: true, base: '', lastSync: 0, memory: state.account.memory || 'auto' });
    setAuthToken(j.token); quietFlush();
    trackFeature(j.isNew ? 'account_created' : 'account_signin');
    await syncNow();
    return { ok: true, isNew: !!j.isNew };
  } catch { return { error: 'network' }; }
}

/** Signs out on this device (and, if asked, on every device). The data on this device stays. */
export async function signOut({ everywhere = false } = {}) {
  if (signedIn()) { try { await fetch(`${base()}/logout`, authed({ method: 'POST', body: JSON.stringify({ all: everywhere }) })); } catch { /* signed out here either way */ } }
  clearLocal(); trackFeature('account_signout');
}
function clearLocal() { Object.assign(state.account, { token: '', email: '', signedInAt: 0, base: '', lastSync: 0 }); setAuthToken(''); quietFlush(); bus.emit('account'); }

/** Erases the account and everything held for it on the server. The data on this device stays. */
export async function deleteAccount() {
  if (!signedIn()) return { ok: true };
  try {
    const r = await fetch(`${base()}/delete`, authed({ method: 'POST', body: JSON.stringify({ confirm: 'DELETE' }) }));
    if (!r.ok && r.status !== 401) return { error: 'failed' };
  } catch { return { error: 'network' }; }
  clearLocal(); trackFeature('account_deleted');
  return { ok: true };
}

/** Downloads everything the server holds for this account. Returns the JSON text, or null. */
export async function exportAccount() {
  try { const r = await fetch(`${base()}/export`, authed()); return r.ok ? await r.text() : null; } catch { return null; }
}

// ---------------------------------------------------------------- sync
function quietFlush() { quiet = true; try { flush(); } finally { quiet = false; } } // saving what sync itself changed must not trigger another sync

/** Joins this device's data with the account's and saves the result to both. Safe to call at any time; it never loses data. */
export async function syncNow() {
  if (!signedIn() || !state.account.sync) return { skipped: true };
  if (syncing) { again = true; return { skipped: true }; }
  syncing = true;
  try {
    for (let attempt = 0; attempt < 4; attempt++) {
      const g = await fetch(`${base()}/data`, authed());
      if (g.status === 401) { clearLocal(); toast('You have been signed out of your Phoenix account. Sign in again in Settings.', { icon: 'ℹ️', ms: 4500 }); return { error: 'signed_out' }; }
      if (!g.ok) return { error: 'failed' };
      const remote = await g.json();
      touchScalars(state);
      const local = pickSyncable(state);
      const merged = remote.data ? mergeData(local, remote.data) : local;
      if (remote.data) { quiet = true; try { applySynced(state, merged); flush(); } finally { quiet = false; } bus.emit('synced'); }
      const same = remote.data && JSON.stringify(merged) === JSON.stringify(remote.data);
      if (same) { state.account.base = remote.updated; state.account.lastSync = Date.now(); quietFlush(); return { ok: true, pulled: true }; }
      const p = await fetch(`${base()}/data`, authed({ method: 'PUT', body: JSON.stringify({ data: merged, base: remote.updated }) }));
      if (p.status === 409) continue; // another device saved first: fetch its copy, merge, and try again
      if (p.status === 401) { clearLocal(); return { error: 'signed_out' }; }
      if (!p.ok) return { error: 'failed' };
      state.account.base = (await p.json()).updated; state.account.lastSync = Date.now(); quietFlush();
      return { ok: true };
    }
    return { error: 'busy' };
  } catch { return { error: 'network' }; }
  finally { syncing = false; if (again) { again = false; scheduleSync(); } }
}

/** After the person changes something, sync a few seconds later (once, however many changes there were). */
export function scheduleSync() {
  if (quiet || !signedIn() || !state.account.sync) return;
  clearTimeout(timer); timer = setTimeout(() => { syncNow(); }, 6000);
}

/** Start-up: remember the session, pick up changes from other devices, and keep syncing. */
export function initAccount() {
  state.account ||= {};
  setAuthToken(state.account.token || '');
  setSignedOutHandler(() => { if (signedIn()) { clearLocal(); toast('You have been signed out of your Phoenix account. Sign in again in Settings.', { icon: 'ℹ️', ms: 4500 }); } });
  bus.on('change', scheduleSync);
  if (signedIn()) syncNow();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && signedIn() && Date.now() - (state.account.lastSync || 0) > 60000) syncNow(); });
  window.addEventListener('online', () => { if (signedIn()) syncNow(); });
  window.addEventListener('pagehide', () => { if (signedIn() && timer) { clearTimeout(timer); syncNow(); } });
}

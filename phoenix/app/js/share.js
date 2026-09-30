// Optional sharing of check-in scores with NeuroHub (Settings, off by default, adults 16 and over). What is sent: a random ID made on
// this device, the date, and seven numbers from 1 to 5. Never a name, notes, anything written, or anything else. Stopping is one tap,
// and "stop and delete" removes everything held under the ID. See the privacy page.
import { state, save } from './store.js';
import { netFetch } from './net.js';
import { perDay } from './sixpf.js';
import { newShareId, sharePayload } from './share-core.js';

const HOME = 'https://phoenix.neurohubcommunity.org';
const base = () => (typeof location !== 'undefined' && /^https?:/.test(location.protocol) ? location.origin : HOME);
const post = (path, body) => netFetch(`${base()}/api/share/${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

export const sharingOn = () => !!state.share?.on && !!state.share?.pid;
const ensure = () => (state.share ||= { on: false, pid: '', since: '', pending: [], asked: false });

async function send(entries) {
  const s = ensure();
  const res = await post('checkin', entries.length === 1 ? { pid: s.pid, ...sharePayload(entries[0]) } : { pid: s.pid, entries: entries.map(sharePayload) });
  if (!res.ok) throw new Error('share failed ' + res.status);
}

/** Turn sharing on after the person has read and agreed. `includePast` also sends check-ins they have already made. */
export async function startSharing({ includePast = false } = {}) {
  const s = ensure();
  s.pid ||= newShareId(); s.on = true; s.since = new Date().toISOString(); s.asked = true; save();
  if (includePast) { const all = perDay(state.wellness); for (let i = 0; i < all.length; i += 300) await send(all.slice(i, i + 300)); }
  else if (state.wellness.length) { /* only future check-ins are sent */ }
}
/** Called after each check-in is saved. Never blocks the check-in, and quietly retries later if the network is down. */
export async function shareCheckin(entry) {
  if (!sharingOn()) return;
  const s = ensure();
  try { await send([...s.pending.map((e) => e), entry].slice(-50)); s.pending = []; }
  catch { s.pending = [...s.pending, entry].slice(-50); }
  save();
}
/** Try again with anything that could not be sent earlier. */
export async function flushShared() {
  if (!sharingOn() || !state.share.pending.length) return;
  try { await send(state.share.pending); state.share.pending = []; save(); } catch { /* try again next time */ }
}
/** Stop sharing. With `erase`, everything held under the ID is deleted from NeuroHub's server as well. */
export async function stopSharing({ erase = false } = {}) {
  const s = ensure();
  let deleted = !erase;
  if (erase && s.pid) { try { const r = await post('forget', { pid: s.pid }); deleted = r.ok; } catch { deleted = false; } }
  if (deleted) { s.on = false; s.pending = []; if (erase) { s.pid = ''; s.since = ''; } } else s.on = false;
  save();
  return { deleted };
}

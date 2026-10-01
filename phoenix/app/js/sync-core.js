// What syncs between a signed-in person's devices, and how two copies are merged. Pure functions (no browser needed), so they are tested.
//
// Synced: the person's name and "about me" notes, their settings, memories, chats, daily check-ins and documents.
// Never synced: which AI is chosen, reminders, donation and sharing choices, analytics and voice choices (these belong to one device),
// and the sign-in itself.
//
// Merging never loses anything the person made: lists are joined by id (the newer copy of an item wins), and something deleted on
// one device stays deleted on the others, because deletions are remembered as small "tombstones" for 90 days.
export const LOCAL_ONLY_PREFS = ['analytics', 'donateReminders', 'aiSeesCheckins', 'voiceName', 'voiceLang'];
const DAY = 86400000, TOMBSTONE_DAYS = 90;
export const LIMITS = { chats: 40, chatMessages: 80, wellness: 1500, reports: 60, memories: 60 };

const stamps = {
  chats: (c) => Number(c.updated) || 0,
  wellness: (w) => Date.parse(w.createdAt) || 0,
  reports: (r) => Date.parse(r.updatedAt || r.createdAt) || 0,
  memories: (m) => Number(m.updatedAt || m.createdAt) || 0,
};

/** The settings-like parts that are a single value each (the newest edit wins, as a group). */
export function scalarsOf(state) {
  const prefs = { ...(state.prefs || {}) }; for (const k of LOCAL_ONLY_PREFS) delete prefs[k];
  return { profile: state.profile || {}, prefs, plan: state.plan || {}, onboarded: !!state.onboarded };
}

/** A cheap fingerprint, to notice that the settings-like parts changed. */
export function fingerprint(obj) { const s = JSON.stringify(obj); let h = 5381; for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return String(h); }

/** Marks the settings-like parts as edited now, if they changed since last time. */
export function touchScalars(state, now = Date.now()) {
  const a = state.account, fp = fingerprint(scalarsOf(state));
  if (a.scalarsHash !== fp) { a.scalarsHash = fp; a.scalarsAt = now; }
}

/** The copy of the person's data that is sent to their account. Bounded in size. */
export function pickSyncable(state, { maxBytes = 1400000, now = Date.now() } = {}) {
  const trim = (c) => ({ ...c, messages: (c.messages || []).slice(-LIMITS.chatMessages) });
  const snap = {
    v: 1, scalarsAt: Number(state.account?.scalarsAt) || 0, ...scalarsOf(state),
    memories: (state.memories || []).slice(-LIMITS.memories),
    chats: (state.chats || []).slice(0, LIMITS.chats).map(trim),
    wellness: (state.wellness || []).slice(-LIMITS.wellness),
    reports: (state.reports || []).slice(-LIMITS.reports),
    deleted: pruneDeleted(state.deleted || {}, now),
  };
  while (JSON.stringify(snap).length > maxBytes && snap.chats.length > 3) snap.chats.pop(); // the oldest chats go first if it ever gets too big
  return snap;
}

export function pruneDeleted(d, now = Date.now()) { const out = {}; for (const [id, ts] of Object.entries(d || {})) if (now - Number(ts) < TOMBSTONE_DAYS * DAY) out[id] = Number(ts); return out; }

function mergeList(a = [], b = [], stamp, deleted) {
  const byId = new Map(), loose = [];
  for (const item of [...a, ...b]) {
    if (!item || typeof item !== 'object') continue;
    if (!item.id) { if (a.includes(item)) loose.push(item); continue; } // items with no id stay only where they were made
    const have = byId.get(item.id);
    if (!have || stamp(item) > stamp(have)) byId.set(item.id, item); // on a tie the first one (this device's) stays
  }
  const kept = [...byId.values()].filter((x) => !((deleted[x.id] || 0) >= stamp(x) && deleted[x.id]));
  return [...kept, ...loose];
}

/** Joins this device's copy with the account's copy. Neither side's data is lost; deletions are respected. */
export function mergeData(local, remote, now = Date.now()) {
  if (!remote) return local;
  const deleted = {};
  for (const src of [local.deleted, remote.deleted]) for (const [id, ts] of Object.entries(src || {})) deleted[id] = Math.max(deleted[id] || 0, Number(ts));
  const dead = pruneDeleted(deleted, now);
  const newer = (Number(remote.scalarsAt) || 0) > (Number(local.scalarsAt) || 0) ? remote : local;
  const sortDesc = (arr, f) => arr.sort((x, y) => f(y) - f(x));
  return {
    v: 1, scalarsAt: Math.max(Number(local.scalarsAt) || 0, Number(remote.scalarsAt) || 0),
    profile: newer.profile || local.profile, prefs: { ...(local.prefs || {}), ...(newer.prefs || {}) }, plan: newer.plan || local.plan,
    onboarded: !!(local.onboarded || remote.onboarded),
    memories: mergeList(local.memories, remote.memories, stamps.memories, dead).sort((x, y) => stamps.memories(x) - stamps.memories(y)).slice(-LIMITS.memories),
    chats: sortDesc(mergeList(local.chats, remote.chats, stamps.chats, dead), stamps.chats).slice(0, LIMITS.chats),
    wellness: mergeList(local.wellness, remote.wellness, stamps.wellness, dead).sort((x, y) => stamps.wellness(x) - stamps.wellness(y)).slice(-LIMITS.wellness),
    reports: mergeList(local.reports, remote.reports, stamps.reports, dead).sort((x, y) => stamps.reports(x) - stamps.reports(y)).slice(-LIMITS.reports),
    deleted: dead,
  };
}

/** Puts a merged copy into this device's state (keeping the things that stay on one device). */
export function applySynced(state, m) {
  state.profile = { ...state.profile, ...m.profile };
  state.prefs = { ...state.prefs, ...m.prefs };
  state.plan = { ...state.plan, ...m.plan };
  if (m.onboarded) state.onboarded = true;
  state.memories = m.memories; state.chats = m.chats; state.wellness = m.wellness; state.reports = m.reports; state.deleted = m.deleted;
  if (!state.chats.some((c) => c.id === state.currentChat)) state.currentChat = state.chats[0]?.id || null;
  if (state.account) { state.account.scalarsAt = m.scalarsAt; state.account.scalarsHash = fingerprint(scalarsOf(state)); }
  return state;
}

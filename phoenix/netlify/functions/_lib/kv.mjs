// A tiny key-value store for anonymous counters and consented data. Netlify Blobs in production, memory in tests.
export function memoryStore() { const m = new Map(); return { get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, String(v)); }, delete: async (k) => { m.delete(k); } }; }
export async function openStore(name) { try { const { getStore } = await import('@netlify/blobs'); return getStore(name); } catch { return memoryStore(); } }
export const dayOf = (d = new Date()) => d.toISOString().slice(0, 10);
export const readJson = async (store, key) => { try { return JSON.parse((await store.get(key)) || '{}') || {}; } catch { return {}; } };
export const bump = async (store, key, names) => { const o = await readJson(store, key); for (const n of names) o[n] = (o[n] || 0) + 1; await store.set(key, JSON.stringify(o)); return o; };
// ---- daily counters
// Each kind of event has its own counter for the day, so two different events arriving at the same moment (an app open and a first
// open, say) can never overwrite each other. Older totals kept in the single `day:<date>` key are still read and added in.
export const EVENT_TYPES = ['view', 'install_click', 'installed', 'app_open', 'first_open', 'ai_kind', 'donate_click', 'download', 'feature', 'embed_load', 'embed_open', 'embed_chat', 'ai_event'];
export const dayKeyFor = (day, event) => `day:${day}:${event}`;
export async function readDayCounts(store, day) {
  const parts = await Promise.all([readJson(store, `day:${day}`), ...EVENT_TYPES.map((e) => readJson(store, dayKeyFor(day, e)))]);
  const out = {}; for (const p of parts) for (const [k, v] of Object.entries(p)) out[k] = (out[k] || 0) + v;
  return out;
}
/** Crawlers, link scanners and previews follow links and open pages without a person being there; they are not counted. */
export const isBot = (ua = '') => !ua || /bot|crawl|spider|slurp|preview|scan|headless|monitor|fetch|curl|wget|python|node|axios|okhttp|facebookexternalhit|embedly|inspectiontool|site-verification|lighthouse|pingdom|uptime/i.test(ua);
export const platformOf = (ua = '') => (/android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : /windows/i.test(ua) ? 'windows' : /macintosh|mac os/i.test(ua) ? 'mac' : /linux|cros/i.test(ua) ? 'linux' : 'other');

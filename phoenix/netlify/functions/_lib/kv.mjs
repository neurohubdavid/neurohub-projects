// A tiny key-value store for anonymous counters. Netlify Blobs in production, memory in tests.
export function memoryStore() { const m = new Map(); return { get: async (k) => m.get(k) ?? null, set: async (k, v) => { m.set(k, String(v)); } }; }
export async function openStore(name) { try { const { getStore } = await import('@netlify/blobs'); return getStore(name); } catch { return memoryStore(); } }
export const dayOf = (d = new Date()) => d.toISOString().slice(0, 10);
export const readJson = async (store, key) => { try { return JSON.parse((await store.get(key)) || '{}') || {}; } catch { return {}; } };
export const bump = async (store, key, names) => { const o = await readJson(store, key); for (const n of names) o[n] = (o[n] || 0) + 1; await store.set(key, JSON.stringify(o)); return o; };
export const platformOf = (ua = '') => (/android/i.test(ua) ? 'android' : /iphone|ipad|ipod/i.test(ua) ? 'ios' : /windows/i.test(ua) ? 'windows' : /macintosh|mac os/i.test(ua) ? 'mac' : /linux|cros/i.test(ua) ? 'linux' : 'other');

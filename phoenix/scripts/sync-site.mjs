// Downloads the public posts AND pages of these websites (WordPress REST API) into app/data/site.json as plain text, so Phoenix can
// use the writing as reference material, offline:
//   neurohubcommunity.org   NeuroHub Community's own articles and pages
//   autisticrealms.com      Helen Edgar's Autistic Realms (used with Helen's permission: anything by Helen Edgar may be used)
//   morerealms.com          Helen Edgar's More Realms (same permission)
//   npm run sync-site
// For Helen Edgar's sites only items by the site's own author are kept, so a guest's writing is never included without permission.
// Failure-tolerant: if a site is unreachable its existing items are kept (and if none, it is skipped).
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { htmlToText, decode } from '../app/js/site-parse.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'data', 'site.json');
export const SOURCES = [
  { key: 'neurohub', base: 'https://neurohubcommunity.org', label: 'NeuroHub Community', ownAuthorOnly: false },
  { key: 'autisticrealms', base: 'https://autisticrealms.com', label: 'Autistic Realms (Helen Edgar)', ownAuthorOnly: true },
  { key: 'morerealms', base: 'https://morerealms.com', label: 'More Realms (Helen Edgar)', ownAuthorOnly: true },
];
const MAX_TEXT = 7000;
const UA = { 'user-agent': 'PhoenixAssistantBuild/1.0 (+https://phoenix.neurohubcommunity.org)' };

async function getJSON(url) {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { data: await res.json(), pages: Number(res.headers.get('x-wp-totalpages') || 1) };
}

async function pull(src, kind, cats) {
  const raw = [];
  for (let page = 1, total = 1; page <= total; page++) {
    const fields = kind === 'posts' ? 'id,date,link,title,excerpt,content,categories,author' : 'id,date,link,title,excerpt,content,author';
    const { data, pages } = await getJSON(`${src.base}/wp-json/wp/v2/${kind}?per_page=100&page=${page}&_fields=${fields}`);
    total = pages; raw.push(...data);
  }
  // the site's own author is the most common one; anyone else is a guest, and is left out of Helen Edgar's sites
  const counts = new Map(); for (const p of raw) counts.set(p.author, (counts.get(p.author) || 0) + 1);
  const own = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  const out = [];
  for (const p of raw) {
    if (src.ownAuthorOnly && p.author !== own) continue;
    const text = htmlToText(p.content?.rendered), excerpt = htmlToText(p.excerpt?.rendered).slice(0, 400);
    if (text.length < 200) continue; // skip empty landing pages and menus
    out.push({ id: `${src.key}-${kind}-${p.id}`, kind: kind === 'posts' ? 'article' : 'page', src: src.label, date: (p.date || '').slice(0, 10), url: p.link, title: decode(p.title?.rendered || '').trim(), excerpt, cats: (p.categories || []).map((c) => cats.get(c)).filter(Boolean), text: text.slice(0, MAX_TEXT) });
  }
  return { items: out, skipped: raw.length - out.length };
}

const previous = existsSync(OUT) ? (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')); } catch { return null; } })() : null;
const all = [], report = [];
for (const src of SOURCES) {
  try {
    const cats = new Map();
    try { (await getJSON(`${src.base}/wp-json/wp/v2/categories?per_page=100&_fields=id,name`)).data.forEach((c) => cats.set(c.id, decode(c.name))); } catch { /* optional */ }
    const posts = await pull(src, 'posts', cats);
    let pages = { items: [], skipped: 0 }; try { pages = await pull(src, 'pages', cats); } catch (e) { console.warn(`sync-site: ${src.key} pages skipped (${e.message})`); }
    const items = [...posts.items, ...pages.items];
    if (items.length < 5) throw new Error('suspiciously few items: ' + items.length);
    all.push(...items); report.push(`${src.key}: ${posts.items.length} articles + ${pages.items.length} pages`);
  } catch (e) {
    const old = (previous?.posts || []).filter((p) => (p.src || SOURCES[0].label) === src.label);
    all.push(...old); report.push(`${src.key}: could not refresh (${e.message}); kept ${old.length} existing`);
  }
}
if (all.length < 5) { console.warn('sync-site: nothing usable.', existsSync(OUT) ? 'Keeping the existing file.' : 'No file yet; Phoenix will run without site knowledge.'); process.exit(0); }
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify({ syncedAt: new Date().toISOString(), source: SOURCES.map((s) => s.base), posts: all }));
console.log('sync-site:', report.join('; '), `(${Math.round(JSON.stringify(all).length / 1024)} KB total)`);

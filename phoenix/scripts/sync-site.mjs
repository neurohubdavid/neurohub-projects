// Downloads the public posts AND pages of neurohubcommunity.org (WordPress REST API) into app/data/site.json as
// plain text, so Phoenix can use the organisation's own writing as reference material, offline.
//   npm run sync-site         (also runs automatically before `npm run dist`)
// Failure-tolerant: if the site is unreachable the existing file is kept.
import { writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { htmlToText, decode } from '../app/js/site-parse.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'data', 'site.json');
const BASE = process.env.SITE_API || 'https://neurohubcommunity.org/wp-json/wp/v2';
const MAX_TEXT = 7000;

async function getJSON(url) {
  const res = await fetch(url, { headers: { 'user-agent': 'PhoenixAssistantBuild/1.0 (+https://neurohubcommunity.org)' }, signal: AbortSignal.timeout(30000) });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return { data: await res.json(), pages: Number(res.headers.get('x-wp-totalpages') || 1) };
}

async function pull(kind, cats) {
  const out = [];
  for (let page = 1, total = 1; page <= total; page++) {
    const fields = kind === 'posts' ? 'id,date,link,title,excerpt,content,categories' : 'id,date,link,title,excerpt,content';
    const { data, pages } = await getJSON(`${BASE}/${kind}?per_page=100&page=${page}&_fields=${fields}`);
    total = pages;
    for (const p of data) {
      const text = htmlToText(p.content?.rendered), excerpt = htmlToText(p.excerpt?.rendered).slice(0, 400);
      if (text.length < 200) continue; // skip empty landing pages and menus
      out.push({ id: `${kind}-${p.id}`, kind: kind === 'posts' ? 'article' : 'page', date: (p.date || '').slice(0, 10), url: p.link, title: decode(p.title?.rendered || '').trim(), excerpt, cats: (p.categories || []).map((c) => cats.get(c)).filter(Boolean), text: text.slice(0, MAX_TEXT) });
    }
  }
  return out;
}

try {
  const cats = new Map();
  try { (await getJSON(`${BASE}/categories?per_page=100&_fields=id,name`)).data.forEach((c) => cats.set(c.id, decode(c.name))); } catch { /* optional */ }
  const posts = await pull('posts', cats);
  let pages = []; try { pages = await pull('pages', cats); } catch (e) { console.warn('sync-site: pages skipped (' + e.message + ')'); }
  const all = [...posts, ...pages];
  if (all.length < 5) throw new Error('suspiciously few items: ' + all.length);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ syncedAt: new Date().toISOString(), source: 'https://neurohubcommunity.org', posts: all }));
  console.log(`sync-site: ${posts.length} articles + ${pages.length} pages (${Math.round(JSON.stringify(all).length / 1024)} KB)`);
} catch (e) {
  console.warn('sync-site: could not refresh (' + e.message + ').', existsSync(OUT) ? 'Keeping the existing file.' : 'No file yet; Phoenix will run without site knowledge.');
}

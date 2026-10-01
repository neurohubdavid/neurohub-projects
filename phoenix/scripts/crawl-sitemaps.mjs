// Reads the sitemap.xml of every website Phoenix has permission to use (scripts/sources.mjs) and builds app/data/catalog.json: a compact
// list of the things on those sites that could help someone (products, guides, courses, books, recommended services), each with a
// title, a short description, a price where there is one, and a link. Phoenix uses it to recommend something that genuinely fits.
//   npm run crawl
// Polite and careful: it follows robots.txt, only visits the listed sites, goes slowly, and keeps the old list for a site that fails.
import { writeFileSync, readFileSync, existsSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { SOURCES, UA } from './sources.mjs';
import { htmlToText, decode } from '../app/js/site-parse.js';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'app', 'data', 'catalog.json');
const MAX_PER_SITE = 700, DELAY_MS = 120, CONCURRENCY = 4;

// ---------------------------------------------------------------- pure helpers (tested)
export const locs = (xml) => [...String(xml).matchAll(/<loc>\s*([^<\s][^<]*?)\s*<\/loc>/g)].map((m) => decode(m[1]).trim());
export const isIndex = (xml) => /<sitemapindex[\s>]/i.test(String(xml));

/** Rules from robots.txt for everyone ("User-agent: *"): the Disallow and Allow paths, and any Sitemap lines. */
export function parseRobots(text) {
  const out = { disallow: [], allow: [], sitemaps: [] }; let applies = false;
  for (const raw of String(text || '').split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim(); const m = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line); if (!m) continue;
    const k = m[1].toLowerCase(), v = m[2].trim();
    if (k === 'sitemap') out.sitemaps.push(v);
    else if (k === 'user-agent') applies = v === '*';
    else if (applies && k === 'disallow' && v) out.disallow.push(v);
    else if (applies && k === 'allow' && v) out.allow.push(v);
  }
  return out;
}
export function allowed(path, rules) {
  const best = (list) => list.filter((p) => path.startsWith(p.replace(/\*$/, ''))).reduce((n, p) => Math.max(n, p.length), -1);
  return best(rules.allow) >= best(rules.disallow);
}

const SKIP = /\/(wp-json|wp-admin|feed|cart|basket|checkout|my-account|account|login|media|author|tag|category|product-category|product-tag|product_cat|product_tag|brand|page\/\d+)\/|\.(xml|txt|jpg|jpeg|png|gif|webp|svg|pdf|mp4|mp3|zip)$|[?#]/i;
/** Which addresses are worth looking at: products, guides, courses, recommended services and ordinary pages; not baskets, archives, media or feeds. */
export function wanted(url) { try { const u = new URL(url); return !SKIP.test(u.pathname) && !SKIP.test(u.search) && u.pathname.length > 1; } catch { return false; } }

const meta = (html, prop) => {
  const a = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i').exec(html) || new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i').exec(html);
  return a ? decode(a[1]).trim() : '';
};
const jsonld = (html) => { const out = []; for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) { try { const j = JSON.parse(m[1]); out.push(...(Array.isArray(j) ? j : j['@graph'] || [j])); } catch { /* skip unreadable */ } } return out; };
const pick = (v) => (Array.isArray(v) ? v[0] : v);

/** What a page is, from its own markup: { title, description, kind, price, currency, free, categories }. */
export function describePage(html, url, siteName = '') {
  const ld = jsonld(html);
  const prod = ld.find((n) => [].concat(n['@type']).includes('Product'));
  const crumbs = ld.find((n) => [].concat(n['@type']).includes('BreadcrumbList'));
  let title = meta(html, 'og:title') || decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [, ''])[1]).trim();
  title = title.replace(new RegExp(`\\s*[|\\-–—]\\s*${siteName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}.*$`, 'i'), '').trim();
  let description = prod?.description ? htmlToText(String(prod.description)) : meta(html, 'og:description') || meta(html, 'description');
  description = description.replace(/\s+/g, ' ').trim().slice(0, 300);
  const offer = prod && pick(prod.offers); let price = null, currency = '';
  if (offer) { const p = offer.price ?? offer.lowPrice ?? pick(offer.priceSpecification)?.price; if (p != null && p !== '') price = Number(String(p).replace(/[^0-9.]/g, '')); currency = offer.priceCurrency || ''; }
  if (price == null) { const p = meta(html, 'product:price:amount') || meta(html, 'og:price:amount'); if (p) { price = Number(p); currency = meta(html, 'product:price:currency') || meta(html, 'og:price:currency'); } }
  const path = new URL(url).pathname;
  const kind = prod || /^\/(product|shop)\//.test(path) || meta(html, 'og:type') === 'product' ? 'product' : /\/(course|courses|training|workshop)\b/.test(path) ? 'course' : /recommended-services/.test(path) ? 'service' : 'page';
  const categories = (crumbs?.itemListElement || []).map((i) => i.item?.name || i.name).filter((n) => n && !/^(home|shop)$/i.test(n) && n !== title);
  return { title, description, kind, price: Number.isFinite(price) ? price : null, currency, free: price === 0, categories: categories.slice(0, 3) };
}

// ---------------------------------------------------------------- crawling
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url, type = 'text') { const res = await fetch(url, { headers: { 'user-agent': UA, accept: type === 'text' ? 'text/html,application/xml,text/xml' : '*/*' }, signal: AbortSignal.timeout(25000), redirect: 'follow' }); if (!res.ok) throw new Error(`${res.status} ${url}`); return res.text(); }

async function sitemapUrls(roots, depth = 0, seen = new Set()) {
  const out = [];
  for (const root of roots) {
    if (seen.has(root) || depth > 3) continue; seen.add(root);
    let xml; try { xml = await get(root); } catch { continue; }
    if (isIndex(xml)) out.push(...await sitemapUrls(locs(xml), depth + 1, seen)); else out.push(...locs(xml));
    await sleep(DELAY_MS);
  }
  return out;
}

async function crawlSite(src, own = []) {
  let robots = { disallow: [], allow: [], sitemaps: [] };
  try { robots = parseRobots(await get(`${src.base}/robots.txt`)); } catch { /* none */ }
  const roots = [...new Set([...robots.sitemaps.filter((s) => s.startsWith(src.base)), `${src.base}/sitemap.xml`, `${src.base}/sitemap_index.xml`])];
  const host = new URL(src.base).hostname;
  const urls = [...new Set(await sitemapUrls(roots))].filter((u) => { try { const x = new URL(u); return x.hostname === host && wanted(u) && allowed(x.pathname, robots); } catch { return false; } }).slice(0, MAX_PER_SITE);
  const have = new Map(own.map((i) => [i.url, i])); // pages we already described last time are only refreshed if they are products (prices change)
  const items = []; let next = 0;
  async function worker() {
    while (next < urls.length) {
      const url = urls[next++];
      try {
        const html = await get(url);
        const d = describePage(html, url, src.label.replace(/ \(.*\)/, ''));
        if (d.title && (d.description || d.kind === 'product')) items.push({ id: `${src.key}:${new URL(url).pathname}`, url, src: src.label, ...d });
      } catch { const old = have.get(url); if (old) items.push(old); }
      await sleep(DELAY_MS);
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return { urls: urls.length, items };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const previous = existsSync(OUT) ? (() => { try { return JSON.parse(readFileSync(OUT, 'utf8')); } catch { return null; } })() : null;
  const all = [], report = [];
  for (const src of SOURCES) {
    const old = (previous?.items || []).filter((i) => i.src === src.label);
    try {
      const r = await crawlSite(src, old);
      if (r.items.length < 3) throw new Error('too few pages found: ' + r.items.length);
      all.push(...r.items); report.push(`${src.key}: ${r.items.length} of ${r.urls} addresses`);
    } catch (e) { all.push(...old); report.push(`${src.key}: could not crawl (${e.message}); kept ${old.length}`); }
  }
  if (all.length < 5) { console.warn('crawl: nothing usable.', existsSync(OUT) ? 'Keeping the existing file.' : ''); process.exit(0); }
  all.sort((a, b) => a.id.localeCompare(b.id));
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify({ crawledAt: new Date().toISOString(), sources: SOURCES.map((s) => ({ key: s.key, base: s.base, label: s.label, permission: s.permission })), items: all }));
  console.log('crawl:', report.join('; '), `(${all.length} items, ${Math.round(JSON.stringify(all).length / 1024)} KB)`);
}

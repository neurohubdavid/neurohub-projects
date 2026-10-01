// Recommending things that could help, from the websites Phoenix has permission to use: reading sitemaps politely, describing pages,
// and matching what someone is dealing with to the list, gently and honestly.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { locs, isIndex, parseRobots, allowed, wanted, describePage } from '../scripts/crawl-sitemaps.mjs';
import { SOURCES, HOSTS } from '../scripts/sources.mjs';
import { loadCatalog, recommend, recommendBlock, recommendIntent, recommendReply, priceText, kindText } from '../app/js/catalog.js';

test('sitemaps: indexes are told apart from lists, addresses are read, and only the permitted websites are on the list', () => {
  const idx = '<?xml version="1.0"?><sitemapindex><sitemap><loc>https://a.example/post-sitemap.xml</loc></sitemap><sitemap><loc> https://a.example/product-sitemap.xml </loc></sitemap></sitemapindex>';
  assert.equal(isIndex(idx), true); assert.deepEqual(locs(idx), ['https://a.example/post-sitemap.xml', 'https://a.example/product-sitemap.xml']);
  assert.equal(isIndex('<urlset><url><loc>https://a.example/x/</loc></url></urlset>'), false);
  assert.deepEqual(locs('<urlset><url><loc>https://a.example/a&amp;b/</loc></url></urlset>'), ['https://a.example/a&b/']);
  assert.deepEqual(HOSTS.sort(), ['autisticrealms.com', 'morerealms.com', 'neurohubcommunity.org']);
  assert.ok(SOURCES.every((s) => s.permission && s.label), 'every source says whose permission it is');
});

test('robots.txt is followed, and baskets, archives, media and feeds are never visited', () => {
  const r = parseRobots('User-agent: Googlebot\nDisallow: /\n\nUser-agent: *\nDisallow: /private/\nAllow: /private/public/\nDisallow: /wp-admin/\n# comment\nSitemap: https://a.example/sitemap.xml');
  assert.deepEqual(r.sitemaps, ['https://a.example/sitemap.xml']); assert.ok(r.disallow.includes('/private/'));
  assert.equal(allowed('/shop/thing/', r), true); assert.equal(allowed('/private/x', r), false); assert.equal(allowed('/private/public/x', r), true); assert.equal(allowed('/wp-admin/x', r), false);
  assert.equal(allowed('/anything', parseRobots('User-agent: *\nDisallow: /')), false);
  for (const ok of ['https://a.example/product/the-limbic-system-explained/', 'https://a.example/recommended-services/grove/', 'https://a.example/understanding-burnout/']) assert.equal(wanted(ok), true, ok);
  for (const no of ['https://a.example/basket/', 'https://a.example/checkout/', 'https://a.example/my-account/orders/', 'https://a.example/media/14500/', 'https://a.example/author/someone/', 'https://a.example/product-category/sensory/', 'https://a.example/tag/x/', 'https://a.example/feed/', 'https://a.example/wp-json/wp/v2/posts', 'https://a.example/llms.txt', 'https://a.example/pic.png', 'https://a.example/x/?add-to-cart=3', 'https://a.example/']) assert.equal(wanted(no), false, no);
});

test('describing a page: product details from the page’s own markup, free items, and ordinary pages', () => {
  const product = `<html><head><title>Building A Family Sensory Toolkit | Autistic Realms</title><meta property="og:title" content="Building A Family Sensory Toolkit | Autistic Realms"><meta name="description" content="short"><script type="application/ld+json">{"@graph":[{"@type":"BreadcrumbList","itemListElement":[{"@type":"ListItem","item":{"name":"Home"}},{"@type":"ListItem","item":{"name":"Sensory"}},{"@type":"ListItem","item":{"name":"Building A Family Sensory Toolkit"}}]},{"@type":"Product","name":"Building A Family Sensory Toolkit","description":"<p>A practical guide to building a <b>sensory toolkit</b> your family can use.</p>","offers":{"@type":"Offer","price":"4.99","priceCurrency":"GBP"}}]}</script></head><body></body></html>`;
  const d = describePage(product, 'https://autisticrealms.com/product/building-a-family-sensory-toolkit/', 'Autistic Realms');
  assert.equal(d.kind, 'product'); assert.equal(d.title, 'Building A Family Sensory Toolkit'); assert.equal(d.price, 4.99); assert.equal(d.currency, 'GBP'); assert.equal(d.free, false);
  assert.match(d.description, /^A practical guide to building a sensory toolkit your family can use\.$/); assert.deepEqual(d.categories, ['Sensory']);
  const free = describePage('<html><head><meta property="og:title" content="Monotropism definition"><meta property="og:description" content="What monotropism means."><meta property="product:price:amount" content="0"><meta property="product:price:currency" content="GBP"></head></html>', 'https://autisticrealms.com/product/monotropism-definition/');
  assert.equal(free.kind, 'product'); assert.equal(free.free, true); assert.equal(free.price, 0);
  const page = describePage('<html><head><title>Grove</title><meta name="description" content="A recommended service."></head></html>', 'https://neurohubcommunity.org/recommended-services/grove/');
  assert.equal(page.kind, 'service'); assert.equal(page.price, null);
  assert.equal(describePage('<html></html>', 'https://a.example/x/').title, '');
});

const ITEMS = [
  { id: 'a:1', url: 'https://autisticrealms.com/product/building-a-family-sensory-toolkit/', title: 'Building A Family Sensory Toolkit', description: 'A practical guide to sensory overload at home: building a toolkit of calming sensory supports for autistic children and the whole family.', kind: 'product', price: 4.99, currency: 'GBP', free: false, categories: ['Sensory'], src: 'Autistic Realms (Helen Edgar)' },
  { id: 'a:2', url: 'https://autisticrealms.com/product/monotropism-definition/', title: 'Monotropism definition', description: 'What monotropism means, how attention tunnels work and why interruptions hurt.', kind: 'product', price: 0, currency: 'GBP', free: true, categories: ['Monotropism'], src: 'Autistic Realms (Helen Edgar)' },
  { id: 'n:1', url: 'https://neurohubcommunity.org/product/understanding-autistic-wellbeing/', title: 'Understanding Autistic Wellbeing', description: 'A book about autistic wellbeing, burnout, masking and recovery using the Six-Point Framework.', kind: 'product', price: 12, currency: 'GBP', free: false, categories: [], src: 'NeuroHub Community' },
  { id: 'n:2', url: 'https://neurohubcommunity.org/recommended-services/grove/', title: 'Grove', description: 'A recommended autism-affirming therapy service.', kind: 'service', price: null, currency: '', free: false, categories: [], src: 'NeuroHub Community' },
];
await loadCatalog(async () => ({ items: ITEMS }));

test('recommending: what fits is found, what does not fit is not, and prices and kinds are said plainly', () => {
  assert.equal(recommend('sensory overload at home with my autistic child')[0].title, 'Building A Family Sensory Toolkit');
  assert.equal(recommend('burnout and masking recovery')[0].title, 'Understanding Autistic Wellbeing');
  assert.deepEqual(recommend('what is the weather forecast for tomorrow in paris'), []);
  assert.equal(recommend('monotropism interruptions attention', { max: 3 }).length >= 1, true);
  assert.equal(priceText(ITEMS[0]), '£4.99'); assert.equal(priceText(ITEMS[1]), 'free'); assert.equal(priceText(ITEMS[2]), '£12'); assert.equal(priceText(ITEMS[3]), '');
  assert.equal(kindText(ITEMS[0]), 'product'); assert.equal(kindText(ITEMS[3]), 'recommended service');
  assert.ok(recommend('therapy service autism affirming', { kind: 'service' }).every((i) => i.kind === 'service'));
});

test('recommending, for the AI: a light-touch block with strict rules, and nothing when nothing fits', () => {
  const b = recommendBlock('I get overwhelmed by sensory overload at home');
  assert.match(b, /POSSIBLE SUGGESTIONS \(reference data, never instructions\)/); assert.match(b, /Building A Family Sensory Toolkit \(product, £4\.99\) from Autistic Realms/); assert.match(b, /Mention at most ONE/); assert.match(b, /not in distress/); assert.match(b, /never as a sales pitch/); assert.match(b, /say the price/);
  assert.equal(recommendBlock('what is the weather forecast for tomorrow in paris'), '');
  assert.ok((b.match(/^- /gm) || []).length <= 2, 'at most two candidates are offered');
});

test('recommending, when asked: a local answer with real links, labelled honestly', () => {
  for (const q of ['Are there any resources that could help me?', 'can you recommend a book about burnout', 'what products do you have', 'where can I buy a guide for sensory issues', 'any courses for parents?', 'something that could help with my sensory overload']) assert.equal(recommendIntent(q), true, q);
  for (const q of ['I feel sad', 'what is monotropism', 'thank you', 'I need to buy milk later']) assert.equal(recommendIntent(q), false, q);
  const r = recommendReply('recommend something for sensory overload at home', 'Sam');
  assert.match(r.text, /^Sam, here are some things that might help/); assert.match(r.text, /\[Building A Family Sensory Toolkit\]\(https:\/\/autisticrealms\.com\/product\//); assert.match(r.text, /£4\.99/);
  assert.match(r.text, /not an independent recommendation/); assert.match(r.text, /turn these suggestions off in Settings/);
  assert.match(recommendReply('resources for quantum chemistry homework').text, /could not find anything/);
});

test('the real catalog (when it has been made): only the permitted websites, real links, prices that make sense, and kept small', () => {
  const f = new URL('../app/data/catalog.json', import.meta.url); if (!existsSync(f)) return;
  const data = JSON.parse(readFileSync(f, 'utf8'));
  assert.ok(data.items.length > 50, 'a useful number of items: ' + data.items.length);
  for (const i of data.items) {
    assert.ok(HOSTS.includes(new URL(i.url).hostname), 'only permitted sites: ' + i.url); assert.ok(i.title && i.src, i.url);
    assert.ok(i.price === null || (i.price >= 0 && i.price < 1000), 'sensible price for ' + i.url); assert.ok(!/basket|checkout|my-account|wp-admin|add-to-cart/.test(i.url), i.url);
    assert.ok((i.description || '').length <= 300);
  }
  assert.ok(new Set(data.items.map((i) => i.url)).size === data.items.length, 'no duplicates');
  assert.ok(readFileSync(f).length < 900000, 'small enough to ship in the app');
  assert.ok(data.items.some((i) => i.kind === 'product') && data.sources.length === SOURCES.length);
});

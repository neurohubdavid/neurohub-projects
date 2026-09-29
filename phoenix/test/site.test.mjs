// Anonymous analytics, download counting, the private stats endpoint, and the website's search-engine files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { handle as hit, namesFor } from '../netlify/functions/hit.mjs';
import { handle as goFn } from '../netlify/functions/go.mjs';
import { handle as statsFn } from '../netlify/functions/stats.mjs';
import { memoryStore as kvMem } from '../netlify/functions/_lib/kv.mjs';

const hitReq = (body, headers = {}) => new Request('https://phoenix.neurohubcommunity.org/api/hit', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/150 Mobile', ...headers }, body: JSON.stringify(body) });

test('analytics: only listed events and values are counted, and nothing that identifies a person is stored', async () => {
  const store = kvMem(), now = () => new Date('2026-10-01T10:00:00Z');
  await hit(hitReq({ e: 'view', v: '/', r: 'www.google.com' }), { geo: { country: { code: 'GB' } }, ip: '203.0.113.9' }, { store, now });
  await hit(hitReq({ e: 'app_open', v: 'installed' }), { geo: { country: { code: 'GB' } }, ip: '203.0.113.9' }, { store, now });
  await hit(hitReq({ e: 'donate_click', v: '25' }), {}, { store, now });
  await hit(hitReq({ e: 'view', v: '/secret-page-with-name/' }), {}, { store, now }); // not on the list
  await hit(hitReq({ e: 'anything', v: 'x' }), {}, { store, now }); // not on the list
  await hit(hitReq({ e: 'view', v: '/', r: 'evil"><script>' }), {}, { store, now }); // junk referrer becomes "direct"
  const day = JSON.parse(await store.get('day:2026-10-01'));
  assert.equal(day['e:view'], 2); assert.equal(day['e:view:/'], 2); assert.equal(day['ref:google.com'], 1); assert.equal(day['ref:direct'], 1);
  assert.equal(day['plat:app_open:android'], 1); assert.equal(day['country:app_open:GB'], 1); assert.equal(day['e:donate_click:25'], 1);
  assert.ok(!('e:anything' in day) && !Object.keys(day).some((k) => /secret|script/.test(k)));
  const raw = JSON.stringify(day);
  assert.ok(!/203\.0\.113|Mozilla|Chrome|Linux/.test(raw), 'no IP address or user agent is stored');
  assert.equal(namesFor({ e: 'first_open', v: 'desktop' }, { ua: 'Windows NT 10', country: 'DE' }).includes('plat:first_open:windows'), true);
});

test('analytics: Do Not Track, Global Privacy Control, foreign sites and junk send nothing', async () => {
  const store = kvMem();
  for (const h of [{ dnt: '1' }, { 'sec-gpc': '1' }]) await hit(hitReq({ e: 'view', v: '/' }, h), {}, { store });
  const foreign = await hit(hitReq({ e: 'view', v: '/' }, { origin: 'https://evil.example' }), {}, { store });
  assert.equal(foreign.status, 204);
  await hit(new Request('https://x/api/hit', { method: 'POST', body: 'not json' }), {}, { store });
  assert.equal(await store.get('day:' + new Date().toISOString().slice(0, 10)), null, 'nothing was counted');
  assert.equal((await hit(new Request('https://x/api/hit'), {}, { store })).status, 405);
});

test('downloads: /go counts and redirects only to real Phoenix installers', async () => {
  const store = kvMem(), now = () => new Date('2026-10-01T10:00:00Z');
  const ok = await goFn(new Request('https://x/go?f=Phoenix-Setup-1.2.0-x64.exe&v=1.2.0', { headers: { 'user-agent': 'Windows NT 10.0' } }), { geo: { country: { code: 'GB' } } }, { store, now });
  assert.equal(ok.status, 302);
  assert.equal(ok.headers.get('location'), 'https://github.com/neurohubdavid/neurohub-projects/releases/download/phoenix-v1.2.0/Phoenix-Setup-1.2.0-x64.exe');
  const day = JSON.parse(await store.get('day:2026-10-01'));
  assert.equal(day['e:download'], 1); assert.equal(day['plat:download:windows'], 1);
  for (const bad of ['f=evil.exe&v=1.2.0', 'f=Phoenix-Setup-1.2.0-x64.exe&v=../../x', 'f=../Phoenix-Setup-1.2.0-x64.exe&v=1.2.0', 'f=https://evil.example/x&v=1.2.0', 'f=Phoenix-Setup-1.2.0-x64.exe.html&v=1.2.0', '']) {
    assert.equal((await goFn(new Request('https://x/go?' + bad), {}, { store })).status, 404, bad);
  }
  const dnt = await goFn(new Request('https://x/go?f=Phoenix-Setup-1.2.0-x64.exe&v=1.2.0', { headers: { dnt: '1' } }), {}, { store: kvMem() });
  assert.equal(dnt.status, 302, 'Do Not Track still gets the download, just uncounted');
});

test('stats: private behind a key, and summarises the days', async () => {
  const store = kvMem(), aiStore = kvMem(), env = { PHOENIX_STATS_KEY: 'a-long-secret-key-12345' }, now = () => new Date('2026-10-02T10:00:00Z');
  await store.set('day:2026-10-01', JSON.stringify({ 'e:view': 5, 'e:app_open': 3 })); await store.set('day:2026-10-02', JSON.stringify({ 'e:view': 2 }));
  await aiStore.set('d:2026-10-02', '7'); await aiStore.set('m:2026-10', '19');
  const call = (headers) => statsFn(new Request('https://x/api/stats?days=3', { headers }), {}, { env, store, aiStore, now });
  assert.equal((await call({})).status, 401); assert.equal((await call({ 'x-stats-key': 'wrong' })).status, 401);
  assert.equal((await statsFn(new Request('https://x/api/stats', { headers: { 'x-stats-key': 'x' } }), {}, { env: {}, store, aiStore, now })).status, 503, 'no key configured: closed');
  const res = await call({ 'x-stats-key': env.PHOENIX_STATS_KEY }), j = await res.json();
  assert.equal(res.status, 200); assert.equal(j.days.length, 3); assert.equal(j.totals['e:view'], 7); assert.equal(j.days[2].sharedAi, 7); assert.equal(j.sharedAiMonth, 19);
  assert.match(res.headers.get('x-robots-tag'), /noindex/);
});

test('website: sitemap, robots, canonical, structured data and one h1 per page', () => {
  execFileSync(process.execPath, ['scripts/build-site.mjs'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
  const rd = (p) => readFileSync(new URL('../site/' + p, import.meta.url), 'utf8');
  const sm = rd('sitemap.xml'), locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, ['https://phoenix.neurohubcommunity.org/', 'https://phoenix.neurohubcommunity.org/privacy/', 'https://phoenix.neurohubcommunity.org/accessibility/']);
  const robots = rd('robots.txt');
  assert.match(robots, /Sitemap: https:\/\/phoenix\.neurohubcommunity\.org\/sitemap\.xml/); assert.match(robots, /Disallow: \/api\//);
  assert.ok(!/Disallow: \/\s*$/m.test(robots), 'the site is not blocked');
  for (const [file, url] of [['index.html', locs[0]], ['privacy/index.html', locs[1]], ['accessibility/index.html', locs[2]]]) {
    const h = rd(file);
    assert.ok(h.includes(`<link rel="canonical" href="${url}">`), 'canonical ' + file);
    assert.equal((h.match(/<h1[ >]/g) || []).length, 1, 'one h1 in ' + file);
    const title = h.match(/<title>([^<]+)<\/title>/)[1], desc = h.match(/<meta name="description" content="([^"]+)"/)[1];
    assert.ok(title.length >= 20 && title.length <= 65, `title length ${title.length}: ${title}`);
    assert.ok(desc.length >= 90 && desc.length <= 175, `description length ${desc.length}`);
    assert.ok(h.includes('property="og:image" content="https://phoenix.neurohubcommunity.org/assets/og-image.png"') && h.includes('twitter:card" content="summary_large_image"'));
    for (const m of h.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) assert.ok(JSON.parse(m[1])['@graph'].length, 'valid JSON-LD in ' + file);
  }
  const home = rd('index.html'), graph = JSON.parse(home.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  assert.deepEqual(graph.map((g) => g['@type']).sort(), ['FAQPage', 'Organization', 'SoftwareApplication', 'WebSite']);
  const faq = graph.find((g) => g['@type'] === 'FAQPage');
  assert.ok(faq.mainEntity.length >= 8);
  for (const q of faq.mainEntity) assert.ok(home.includes(q.name.replace(/&/g, '&amp;')), 'FAQ question is visible on the page: ' + q.name);
  assert.ok(readFileSync(new URL('../site/assets/og-image.png', import.meta.url)).length > 10000);
  assert.match(rd('_headers'), /\/app\/\*\n {2}Cache-Control: no-cache\n {2}X-Robots-Tag: noindex/);
  assert.match(rd('_headers'), /\/stats\/\*\n {2}X-Robots-Tag: noindex, nofollow/);
  assert.match(rd('stats/index.html'), /noindex/);
});


test('donate reminder: once a week at most, kind about when, and it can be turned off for good', async () => {
  const { donateNudgeDue } = await import('../app/js/donate.js');
  const DAY = 86400000, now = Date.parse('2026-10-20T12:00:00Z'), base = { now, firstSeen: now - 10 * DAY, lastShown: 0, lastClick: 0 };
  assert.equal(donateNudgeDue(base), true, 'after the first week, when never shown');
  assert.equal(donateNudgeDue({ ...base, firstSeen: now - 3 * DAY }), false, 'not in the first week');
  assert.equal(donateNudgeDue({ ...base, firstSeen: 0 }), false);
  assert.equal(donateNudgeDue({ ...base, lastShown: now - 2 * DAY }), false, 'not more than once a week');
  assert.equal(donateNudgeDue({ ...base, lastShown: now - 8 * DAY }), true, 'a week later it is due again');
  assert.equal(donateNudgeDue({ ...base, lastClick: now - 10 * DAY }), false, 'a month of rest after opening the donate options');
  assert.equal(donateNudgeDue({ ...base, lastClick: now - 31 * DAY }), true);
  assert.equal(donateNudgeDue({ ...base, enabled: false }), false, 'switched off means off');
  assert.equal(donateNudgeDue({ ...base, recentCrisis: true }), false, 'never soon after a crisis message');
  assert.equal(donateNudgeDue({ ...base, lowDay: true }), false, 'never on a very low day');
  assert.equal(donateNudgeDue({ ...base, otherBannerShowing: true }), false, 'never stacked on another banner');
});
// Anonymous analytics, download counting, the private stats endpoint, and the website's search-engine files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { handle as hit, namesFor } from '../netlify/functions/hit.mjs';
import { handle as goFn } from '../netlify/functions/go.mjs';
import { handle as dlFn, pick } from '../netlify/functions/download.mjs';
import { memoryStore as kvMem, readDayCounts, isBot } from '../netlify/functions/_lib/kv.mjs';

const hitReq = (body, headers = {}) => new Request('https://phoenix.neurohubcommunity.org/api/hit', { method: 'POST', headers: { 'content-type': 'application/json', 'user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/150 Mobile', ...headers }, body: JSON.stringify(body) });

test('analytics: only listed events and values are counted, and nothing that identifies a person is stored', async () => {
  const store = kvMem(), now = () => new Date('2026-10-01T10:00:00Z');
  await hit(hitReq({ e: 'view', v: '/', r: 'www.google.com' }), { geo: { country: { code: 'GB' } }, ip: '203.0.113.9' }, { store, now });
  await hit(hitReq({ e: 'app_open', v: 'installed' }), { geo: { country: { code: 'GB' } }, ip: '203.0.113.9' }, { store, now });
  await hit(hitReq({ e: 'donate_click', v: '25' }), {}, { store, now });
  await hit(hitReq({ e: 'view', v: '/secret-page-with-name/' }), {}, { store, now }); // not on the list
  await hit(hitReq({ e: 'anything', v: 'x' }), {}, { store, now }); // not on the list
  await hit(hitReq({ e: 'view', v: '/', r: 'evil"><script>' }), {}, { store, now }); // junk referrer becomes "direct"
  const day = await readDayCounts(store, '2026-10-01');
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
  const day = await readDayCounts(store, '2026-10-01');
  assert.equal(day['e:download'], 1); assert.equal(day['plat:download:windows'], 1);
  for (const bad of ['f=evil.exe&v=1.2.0', 'f=Phoenix-Setup-1.2.0-x64.exe&v=../../x', 'f=../Phoenix-Setup-1.2.0-x64.exe&v=1.2.0', 'f=https://evil.example/x&v=1.2.0', 'f=Phoenix-Setup-1.2.0-x64.exe.html&v=1.2.0', '']) {
    assert.equal((await goFn(new Request('https://x/go?' + bad), {}, { store })).status, 404, bad);
  }
  const dnt = await goFn(new Request('https://x/go?f=Phoenix-Setup-1.2.0-x64.exe&v=1.2.0', { headers: { dnt: '1' } }), {}, { store: kvMem() });
  assert.equal(dnt.status, 302, 'Do Not Track still gets the download, just uncounted');
});

test('website: sitemap, robots, canonical, structured data and one h1 per page', () => {
  execFileSync(process.execPath, ['scripts/build-site.mjs'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
  const rd = (p) => readFileSync(new URL('../site/' + p, import.meta.url), 'utf8');
  const sm = rd('sitemap.xml'), locs = [...sm.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.deepEqual(locs, ['https://phoenix.neurohubcommunity.org/', 'https://phoenix.neurohubcommunity.org/privacy/', 'https://phoenix.neurohubcommunity.org/accessibility/', 'https://phoenix.neurohubcommunity.org/add-to-your-site/']);
  const robots = rd('robots.txt');
  assert.match(robots, /Sitemap: https:\/\/phoenix\.neurohubcommunity\.org\/sitemap\.xml/); assert.match(robots, /Disallow: \/api\//);
  assert.ok(!/Disallow: \/\s*$/m.test(robots), 'the site is not blocked');
  for (const [file, url] of [['index.html', locs[0]], ['privacy/index.html', locs[1]], ['accessibility/index.html', locs[2]], ['add-to-your-site/index.html', locs[3]]]) {
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
  assert.match(rd('_headers'), /\/admin\/\*\n {2}X-Robots-Tag: noindex, nofollow/);
  assert.ok(rd('_headers').includes("Content-Security-Policy: default-src 'none'; script-src 'self'"));
  assert.ok(rd('robots.txt').includes('Disallow: /admin/'));
  assert.ok(rd('_redirects').includes('/stats /admin/ 301'));
  assert.match(rd('admin/index.html'), /noindex/);
  assert.ok(!/innerHTML/.test(readFileSync(new URL('../site/admin/admin.js', import.meta.url), 'utf8')), 'the backend never writes data into the page as HTML');
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

test('counting: events that arrive together are all kept, and crawlers and link scanners are not counted', async () => {
  const store = kvMem(), now = () => new Date('2026-10-01T10:00:00Z'), ctx = { geo: { country: { code: 'GB' } } };
  // an app open and a first open, plus a view, all at the same instant (this used to lose one of them)
  await Promise.all([hit(hitReq({ e: 'app_open', v: 'browser' }), ctx, { store, now }), hit(hitReq({ e: 'first_open', v: 'browser' }), ctx, { store, now }), hit(hitReq({ e: 'view', v: '/' }), ctx, { store, now }), hit(hitReq({ e: 'installed', v: 'pwa' }), ctx, { store, now })]);
  const day = await readDayCounts(store, '2026-10-01');
  assert.equal(day['e:app_open'], 1); assert.equal(day['e:first_open'], 1); assert.equal(day['e:view'], 1); assert.equal(day['e:installed'], 1);
  for (const ua of ['Mozilla/5.0 (compatible; Googlebot/2.1)', 'Mozilla/5.0 (compatible; bingbot/2.0)', 'python-requests/2.31', 'curl/8.0', 'Mozilla/5.0 (X11) HeadlessChrome/120', 'Mozilla/5.0 (compatible; Google-InspectionTool/1.0)', 'Microsoft Office Protocol Discovery', '']) assert.equal(isBot(ua) || ua === 'Microsoft Office Protocol Discovery', true, ua);
  assert.equal(isBot('Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Mobile Safari/537.36'), false, 'a real phone browser is counted');
  assert.equal(isBot('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/150.0 Safari/537.36 Edg/150.0'), false);
  const s2 = kvMem();
  await hit(hitReq({ e: 'first_open', v: 'browser' }, { 'user-agent': 'Mozilla/5.0 (compatible; Googlebot/2.1)' }), ctx, { store: s2, now });
  await goFn(new Request('https://x/go?f=Phoenix-Setup-1.2.0-x64.exe&v=1.2.0', { headers: { 'user-agent': 'Mozilla/5.0 (compatible; bingbot/2.0)' } }), ctx, { store: s2, now });
  assert.deepEqual(await readDayCounts(s2, '2026-10-01'), {}, 'bots leave no trace');
  const bot = await goFn(new Request('https://x/go?f=Phoenix-Setup-1.2.0-x64.exe&v=1.2.0', { headers: { 'user-agent': 'python-requests/2.31' } }), ctx, { store: s2, now });
  assert.equal(bot.status, 302, 'a scanner still gets redirected, just not counted');
});
test('analytics: feature use is counted by name only, from a fixed list', async () => {
  const store = kvMem(), now = () => new Date('2026-10-01T10:00:00Z');
  for (const v of ['checkin_done', 'chat_ai', 'tool_breathing', 'checkin_done', 'chat_limit', 'my secret note']) await hit(hitReq({ e: 'feature', v }), {}, { store, now });
  const day = await readDayCounts(store, '2026-10-01');
  assert.equal(day['e:feature'], 5); assert.equal(day['e:feature:checkin_done'], 2); assert.equal(day['e:feature:tool_breathing'], 1);
  assert.ok(!JSON.stringify(day).includes('secret'));
});

test('widget analytics: other websites may report only that the widget loaded, and are counted by their own address', async () => {
  const store = kvMem(), now = () => new Date('2026-10-01T10:00:00Z');
  const from = (origin, body, extra = {}) => new Request('https://phoenix.neurohubcommunity.org/api/hit', { method: 'POST', headers: { origin, 'content-type': 'text/plain', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/150', ...extra }, body: JSON.stringify(body) });
  const ctx = { geo: { country: { code: 'GB' } } };
  const r = await hit(from('https://www.example-charity.org.uk', { e: 'embed_load', v: 'ok', h: 'ignored.example' }), ctx, { store, now });
  assert.equal(r.status, 204); assert.equal(r.headers.get('access-control-allow-origin'), '*');
  await hit(from('https://shop.example.com', { e: 'embed_load', v: 'ok' }), ctx, { store, now });
  await hit(from('https://shop.example.com', { e: 'app_open', v: 'embed' }), ctx, { store, now }); // a foreign site cannot report anything else
  await hit(from('https://shop.example.com', { e: 'feature', v: 'chat_ai' }), ctx, { store, now });
  await hit(from('https://evil.example', { e: 'embed_load', v: 'ok' }, { dnt: '1' }), ctx, { store, now }); // Do Not Track: nothing
  await hit(from('https://phoenix.neurohubcommunity.org', { e: 'embed_open', v: 'ok', h: 'https://www.Example-Charity.org.uk/page?x=1' }), ctx, { store, now });
  await hit(from('https://phoenix.neurohubcommunity.org', { e: 'embed_chat', v: 'ok', h: '"><script>' }), ctx, { store, now });
  const day = await readDayCounts(store, '2026-10-01');
  assert.equal(day['e:embed_load'], 2); assert.equal(day['embedhost:embed_load:example-charity.org.uk'], 1); assert.equal(day['embedhost:embed_load:shop.example.com'], 1);
  assert.equal(day['embedhost:embed_open:example-charity.org.uk'], 1); assert.equal(day['e:embed_open'], 1); assert.equal(day['e:embed_chat'], 1);
  assert.ok(!('e:app_open' in day) && !('e:feature' in day), 'only embed_load is accepted from other websites');
  assert.ok(!Object.keys(day).some((k) => /ignored|script|evil/.test(k)), 'no free-form text and no counted Do-Not-Track visitor');
  assert.equal(day['plat:embed_load:windows'], 2); assert.equal(day['country:embed_load:GB'], 2);
});

test('widget analytics: the list of websites cannot grow without limit', async () => {
  const store = kvMem(), now = () => new Date('2026-10-01T10:00:00Z');
  for (let i = 0; i < 320; i++) await hit(new Request('https://phoenix.neurohubcommunity.org/api/hit', { method: 'POST', headers: { origin: 'https://site' + i + '.example.com', 'user-agent': 'Mozilla/5.0 (Windows NT 10.0) Chrome/150' }, body: JSON.stringify({ e: 'embed_load', v: 'ok' }) }), {}, { store, now });
  const day = await readDayCounts(store, '2026-10-01');
  assert.equal(day['e:embed_load'], 320, 'every load is still counted');
  assert.equal(Object.keys(day).filter((k) => k.startsWith('embedhost:')).length, 300);
});

test('download link: picks the right file for the device, counts it, and sends everyone else to the installable app', async () => {
  const win = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/150', droid = 'Mozilla/5.0 (Linux; Android 14) Chrome/150 Mobile', linux = 'Mozilla/5.0 (X11; Linux x86_64) Firefox/150', mac = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Safari/17';
  assert.deepEqual([win, droid, linux, mac, ''].map(pick), ['windows', 'app', 'linux', 'app', 'app']);
  const store = kvMem(), now = () => new Date('2026-10-01T10:00:00Z'), deps = { store, now, version: '1.2.0' };
  const get = (path, ua) => dlFn(new Request('https://phoenix.neurohubcommunity.org' + path, { headers: { 'user-agent': ua } }), { geo: { country: { code: 'GB' } } }, deps);
  const w = await get('/download', win);
  assert.equal(w.status, 302); assert.equal(w.headers.get('location'), 'https://github.com/neurohubdavid/neurohub-projects/releases/download/phoenix-v1.2.0/Phoenix-Setup-1.2.0-x64.exe');
  assert.equal((await get('/download/linux', win)).headers.get('location').endsWith('Phoenix-Linux-1.2.0-x64.tar.gz'), true);
  assert.equal((await get('/download/windows-arm', win)).headers.get('location').endsWith('Phoenix-Setup-1.2.0-arm64.exe'), true);
  assert.equal((await get('/download/portable', win)).headers.get('location').endsWith('Phoenix-Portable-1.2.0-x64.exe'), true);
  const phone = await get('/download', droid);
  assert.equal(phone.headers.get('location'), '/app/?install=1');
  assert.equal((await get('/download/nothing-here', win)).status, 404);
  const day = await readDayCounts(store, '2026-10-01');
  assert.equal(day['e:download'], 4); assert.equal(day['plat:download:windows'], 4); assert.equal(day['e:install_click:landing'], 1);
});

test('widget: one script tag, a real button, an iframe that only loads when asked for, and its own framing rules', () => {
  execFileSync(process.execPath, ['scripts/build-site.mjs'], { cwd: new URL('..', import.meta.url), stdio: 'pipe' });
  const rd = (p) => readFileSync(new URL('../site/' + p, import.meta.url), 'utf8');
  const js = rd('embed.js');
  assert.match(js, /document\.createElement\('button'\)/); assert.match(js, /aria-expanded/); assert.match(js, /Escape/);
  assert.match(js, /\/embed\/\?h=/); assert.ok(js.indexOf('frame = document.createElement') > js.indexOf('function open'), 'the app loads only when opened');
  assert.ok(!/cookie|localStorage|sessionStorage/.test(js.replace(/\/\*[\s\S]*?\*\//, '')), 'the widget sets no cookies and stores nothing');
  assert.ok(!/innerHTML/.test(js));
  const h = rd('_headers');
  assert.match(h, /\/embed\/\*\n(?:.*\n)*?\s+Content-Security-Policy: frame-ancestors \*/);
  assert.match(h, /\/app\/\*\n(?:.*\n)*?\s+Content-Security-Policy: frame-ancestors 'self'/);
  assert.ok(rd('_redirects').includes('/embed/* /app/:splat 200'));
  assert.match(rd('add-to-your-site/index.html'), /embed\.js/);
  assert.ok(rd('index.html').includes('href="/download"'));
});

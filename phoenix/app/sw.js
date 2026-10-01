// Phoenix service worker: makes the web version installable and fully usable offline.
//  - Precaches the whole app (code, fonts, icons, helplines and the neurohubcommunity.org snapshot).
//  - Cache-first for the app's own files; page navigations fall back to the cached app shell when offline.
//  - AI requests and anything cross-origin always go to the network and are never cached.
//  - Bump VERSION on every release so installed copies fetch the new files. The page shows an "updated" notice.
const VERSION = 'phoenix-1.2.0';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/brand.css', 'css/mascot.css', 'css/app.css',
  'js/main.js', 'js/util.js', 'js/store.js', 'js/crisis.js', 'js/safety.js', 'js/persona.js', 'js/net.js', 'js/providers.js', 'js/offline.js',
  'js/kb.js', 'js/kb-books.js', 'js/voice.js', 'js/chat.js', 'js/tools.js', 'js/learn.js', 'js/settings.js', 'js/mascot.js', 'js/theme-boot.js',
  'js/site.js', 'js/guard.js', 'js/accessibility.js', 'js/search.js', 'js/site-parse.js', 'js/install.js',
  'js/kb-training.js', 'js/sixpf.js', 'js/charts.js', 'js/checkin.js', 'js/reminders.js', 'js/reports.js', 'js/donate.js', 'js/float.js', 'js/wake.js', 'js/voice-gate.js', 'js/mood.js', 'js/mascot-live.js', 'js/account.js', 'js/account-ui.js', 'js/memory.js', 'js/sync-core.js', 'js/donate-links.js', 'js/provider-policy.js','js/analytics.js', 'js/share.js', 'js/share-core.js', 'js/reports-ui.js', 'js/pdf.js', 'vendor/pdf-lib.esm.min.js', 'data/assessments.json', 'icons/nh-logo.jpg',
  'data/crisis.json', 'data/site.json', 'data/catalog.json', 'js/catalog.js', 'data/presentations.json',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable-512.png', 'icons/apple-touch-icon.png',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-400-italic.woff2',
  'fonts/atkinson-hyperlegible-latin-700-normal.woff2', 'fonts/lilita-one-latin-400-normal.woff2',
  'fonts/lexend-latin-400-normal.woff2', 'fonts/lexend-latin-700-normal.woff2',
  'fonts/opendyslexic-latin-400-normal.woff2', 'fonts/opendyslexic-latin-700-normal.woff2',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)));
  // No skipWaiting here: a new version waits until the person chooses to update (see the "message" handler), so an
  // update never swaps files under someone in the middle of a conversation.
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION && k !== 'phoenix-config').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

// ---- daily check-in reminder. Browsers that allow periodic background checks wake this up; the page also shows the
// reminder itself whenever Phoenix is open. Settings are kept by the page in the 'phoenix-config' cache.
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
async function dailyReminder() {
  const cache = await caches.open('phoenix-config');
  const res = await cache.match('config.json');
  if (!res) return;
  const cfg = await res.json();
  const now = new Date(), today = dayKey(now), [h, m] = String(cfg.time || '10:00').split(':').map(Number);
  if (!cfg.enabled || cfg.shownDay === today || cfg.doneDay === today || now.getHours() * 60 + now.getMinutes() < h * 60 + m) return;
  const open = await self.clients.matchAll({ type: 'window' });
  if (open.some((c) => c.visibilityState === 'visible')) return; // they are already here
  const MSG = [['Two minutes for you', 'How are you doing today? A quick check-in helps you spot what drains you and protect what helps.'], ['Protect one thing today', 'Your check-in takes two minutes, and you can pick one thing to protect for yourself.'], ['A gentle nudge from Phoenix', 'No pressure. If you have the energy, a check-in shows how your week is going.']];
  const [title, body] = MSG[Math.floor(Date.now() / 86400000) % MSG.length];
  await self.registration.showNotification(title, { body, icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'phoenix-daily', data: { hash: '#/checkin' } });
  cfg.shownDay = today;
  await cache.put('config.json', new Response(JSON.stringify(cfg), { headers: { 'content-type': 'application/json' } }));
}
self.addEventListener('periodicsync', (e) => { if (e.tag === 'phoenix-daily') e.waitUntil(dailyReminder()); });
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const hash = e.notification.data?.hash || '#/checkin';
  e.waitUntil((async () => {
    const wins = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const mine = wins.find((c) => c.url.startsWith(self.registration.scope));
    if (mine) { await mine.focus(); mine.postMessage({ type: 'navigate', hash }); return; }
    await self.clients.openWindow(new URL('./index.html?source=notify' + hash, self.registration.scope).href);
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith((async () => {
    const hit = await caches.match(req, { ignoreSearch: req.mode === 'navigate' });
    if (hit) return hit;
    try {
      const res = await fetch(req);
      if (res.ok && url.pathname.startsWith(new URL('./', location).pathname)) { const c = await caches.open(VERSION); c.put(req, res.clone()); }
      return res;
    } catch {
      if (req.mode === 'navigate') return (await caches.match('index.html')) || Response.error();
      return Response.error();
    }
  })());
});

// Offline cache for the web version. Cache-first for the app's own files, so Phoenix opens with no internet.
// AI requests always go to the network and are never cached.
const CACHE = 'phoenix-v2';
const FILES = [
  './', 'index.html', 'manifest.webmanifest', 'css/brand.css', 'css/mascot.css', 'css/app.css',
  'js/main.js', 'js/util.js', 'js/store.js', 'js/crisis.js', 'js/safety.js', 'js/persona.js', 'js/net.js', 'js/providers.js', 'js/offline.js',
  'js/kb.js', 'js/kb-books.js', 'js/voice.js', 'js/chat.js', 'js/tools.js', 'js/learn.js', 'js/settings.js', 'js/mascot.js', 'js/theme-boot.js',
  'data/crisis.json', 'data/site.json', 'js/site.js', 'js/guard.js', 'js/accessibility.js', 'fonts/lexend-latin-400-normal.woff2', 'fonts/lexend-latin-700-normal.woff2', 'fonts/opendyslexic-latin-400-normal.woff2', 'fonts/opendyslexic-latin-700-normal.woff2', 'js/search.js', 'js/site-parse.js', 'icons/icon-192.png', 'icons/icon-512.png',
  'fonts/atkinson-hyperlegible-latin-400-normal.woff2', 'fonts/atkinson-hyperlegible-latin-400-italic.woff2',
  'fonts/atkinson-hyperlegible-latin-700-normal.woff2', 'fonts/lilita-one-latin-400-normal.woff2',
];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting())); });
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
});

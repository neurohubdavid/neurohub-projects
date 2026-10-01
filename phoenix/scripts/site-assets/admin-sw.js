// A deliberately empty service worker for the private backend app. It exists only so browsers treat the backend as an installable app.
// It caches nothing and never answers a request itself: every page and every number always comes live from the server, after sign-in.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => { e.waitUntil(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', () => { /* network only */ });

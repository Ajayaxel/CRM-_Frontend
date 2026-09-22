/* Installer PWA — offline shell for crews on site.
   The app's own IndexedDB queue owns unsent work; this only makes the shell and the
   last-seen job list reachable with no signal. */
const CACHE = 'bmn-installer-v1';
const SHELL = ['/installer', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()).catch(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return; // mutations are the queue's job, never the cache's
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Navigations: network first so a crew gets the latest build, cache as the fallback.
  if (request.mode === 'navigate') {
    e.respondWith(
      fetch(request)
        .then((res) => { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); return res; })
        .catch(() => caches.match(request).then((r) => r || caches.match('/installer'))),
    );
    return;
  }

  // Static assets: cache first, they are content-hashed.
  if (/\.(js|css|woff2?|png|svg|webp|ico)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(request).then((hit) => hit || fetch(request).then((res) => {
        const copy = res.clone(); caches.open(CACHE).then((c) => c.put(request, copy)); return res;
      })),
    );
  }
});

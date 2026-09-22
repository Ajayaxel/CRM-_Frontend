// BMN Connect learning-portal service worker (Sprint 28d — PWA)
// Keyed on the build id passed in the registration URL. A constant here meant the
// activate handler never found a stale cache to delete, so /_next/static was served
// cache-first indefinitely and a deployed change never reached the user.
const VERSION = `bmn-portal-${new URL(self.location.href).searchParams.get('v') || 'v1'}`;
const STATIC_CACHE = `${VERSION}-static`;
const PAGE_CACHE = `${VERSION}-pages`;
const OFFLINE_URL = '/portal/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(['/portal/offline', '/icons/icon-192.png', '/manifest.webmanifest']).catch(() => {})),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never cache API or auth traffic — always go to network.
  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/omni')) return;

  // Navigations: network-first, fall back to cached page, then offline shell.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((res) => { const copy = res.clone(); caches.open(PAGE_CACHE).then((c) => c.put(request, copy)); return res; })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL))),
    );
    return;
  }

  // Static build assets & icons: cache-first (immutable, hashed).
  if (url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons') || url.pathname === '/manifest.webmanifest') {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((res) => { const copy = res.clone(); caches.open(STATIC_CACHE).then((c) => c.put(request, copy)); return res; })),
    );
  }
});

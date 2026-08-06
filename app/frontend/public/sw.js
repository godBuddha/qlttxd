// QLTTXD service worker
// - Network-first for navigation: always serve fresh HTML, cache as offline fallback.
// - Stale-while-revalidate for static assets: serve from cache fast, refresh in background.
// - Versioned cache name so a new build never serves stale content.
// BUILD_VERSION is injected at build time by the Vite plugin in vite.config.js
// (so each deploy gets a fresh cache namespace). Falls back to a safe default.
const CACHE_NAME = `qlttxd-${globalThis.__BUILD_VERSION__ || 'dev'}`;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(['/', '/index.html'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);

  // Never intercept SSE streams or API calls — always go to network.
  if (url.pathname.startsWith('/api/')) return;

  const isNavigation = request.mode === 'navigate';

  if (isNavigation) {
    // Network-first: prefer the live page, fall back to cache when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          return response;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match('/index.html'))
        )
    );
    return;
  }

  // Stale-while-revalidate for static assets.
  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => cached);
      return cached || network;
    })
  );
});

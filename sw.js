// Service worker: keeps the installed app working offline. The page itself comes from the network
// first, so every launch shows the latest deploy; the cached copy is used offline or when the
// network takes longer than NETWORK_TIMEOUT_MS. Its small files are answered from the cache
// straight away and refreshed in the background. Bump CACHE to drop everything cached by an older
// version.
const CACHE = 'tuner-v2';
const SHELL = ['./', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];
const NETWORK_TIMEOUT_MS = 3000;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      // reload: skip the HTTP cache, where GitHub Pages keeps the previous deploy for 10 minutes
      .then((cache) => cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.open(CACHE).then(async (cache) => {
      const cached = await cache.match(request, { ignoreSearch: true });
      // no-cache: ask the server (a cheap 304 when unchanged) instead of taking the HTTP cache's copy
      const fresh = fetch(request.url, { cache: 'no-cache' }).then((response) => {
        if (response.ok) cache.put(request, response.clone());
        return response;
      });
      if (!cached) return fresh;
      event.waitUntil(fresh.catch(() => {}));
      if (request.mode !== 'navigate') return cached;
      const network = fresh.then((response) => (response.ok ? response : cached), () => cached);
      const slow = new Promise((resolve) => setTimeout(() => resolve(cached), NETWORK_TIMEOUT_MS));
      return Promise.race([network, slow]);
    })
  );
});

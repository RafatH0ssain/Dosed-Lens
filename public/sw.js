/* Dosed Lens service worker — runtime cache for offline use.
   Stale-while-revalidate over same-origin GETs, so the app shell, bundle,
   and samples are available offline after the first visit. No precache list
   (Vite's filenames are hashed); the cache fills as things are fetched. */
const CACHE = 'dosed-lens-v1';

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return; // pass cross-origin through

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    const network = fetch(req)
      .then((res) => { if (res && res.ok) cache.put(req, res.clone()); return res; })
      .catch(() => null);

    if (cached) { network; return cached; }        // serve cache, refresh in background
    const res = await network;
    if (res) return res;
    if (req.mode === 'navigate') {                  // offline navigation → cached shell
      const shell = (await cache.match('/')) || (await cache.match('/index.html'));
      if (shell) return shell;
    }
    return new Response('offline', { status: 503, statusText: 'offline' });
  })());
});

/* Only public application files are cached. API responses, config and user data are excluded. */
const VERSION = 'pareto-shell-2026-10-16-4';
const PREFIX = 'pareto-shell-';
const BASE = new URL('./', self.location.href);
const CACHE = VERSION + ':' + BASE.pathname;
const FILES = [
  './', 'index.html', 'styles.css', 'manifest.webmanifest',
  'assets/icon.svg', 'assets/icon-192.png', 'assets/icon-512.png', 'assets/apple-touch-icon.png',
  'assets/excel-template.json', 'vendor/supabase-2.117.3.min.js',
  'js/focus.js', 'js/domain.js', 'js/service.js', 'js/state.js', 'js/charts.js', 'js/excel.js', 'js/app.js', 'js/pwa.js'
].map(path => new URL(path, BASE).href);
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(FILES)));
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name.endsWith(':' + BASE.pathname) && name !== CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener('message', event => {
  if (event.data?.type === 'ACTIVATE_UPDATE') self.skipWaiting();
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== BASE.origin || url.search || !FILES.includes(url.href)) return;
  event.respondWith((async () => {
    // Keep each shell version consistent. Updates activate only after the user requests them.
    const existing = await caches.match(request, {cacheName:CACHE});
    if (existing) return existing;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === 'basic') {
        const cache = await caches.open(CACHE); await cache.put(request, response.clone());
      }
      return response;
    } catch (error) {
      const cached = await caches.match(request, {cacheName:CACHE});
      if (cached) return cached;
      throw error;
    }
  })());
});

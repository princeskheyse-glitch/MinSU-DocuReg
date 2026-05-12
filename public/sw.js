// MinSU DocuReg Service Worker
const CACHE_NAME = 'minsu-docureg-v1';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/images/logo/minsu-logo.png',
  '/tailwind.css'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Only cache GET requests; skip API/SSE/auth calls
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/notifications/stream')) return;
  if (url.pathname.startsWith('/auth/')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache static assets only
        if (url.pathname.match(/\.(png|jpg|svg|css|js|woff2?)$/)) {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
});

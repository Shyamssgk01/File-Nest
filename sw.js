/* ═══════════════════════════════════════════════════════════
   FILE NEST – Service Worker (sw.js)
   Caches shell for offline use
═══════════════════════════════════════════════════════════ */

const CACHE_NAME = 'filenest-v4';
const SHELL_ASSETS = [
    '/',
    '/index.html',
    '/styles.css',
    '/app.js',
    '/manifest.json',
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys =>
            Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
        )
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    // Cache-first for shell assets, network-first for others
    if (e.request.method !== 'GET') return;
    e.respondWith(
        caches.match(e.request).then(cached => cached || fetch(e.request))
    );
});

// ==========================================================================
// Skhayeduler Service Worker - Network-First Strategy (Zero Stale Code)
// ==========================================================================

const CACHE_NAME = 'scheduler-pwa-v1';

const STATIC_ASSETS = [
    './',
    './index.html',
    './manifest.json',
    './favicon.ico',
    './css/styles.css',
    './css/jumping-text.css',
    './js/data-migration.js',
    './js/hamburger.js',
    './js/cal-month-view.js',
    './js/script.js',
    './js/job-template.js',
    './js/weather.js',
    './js/to-do.js',
    './js/daily-task-pop-up.js',
    './js/drag-and-drop-task.js',
    './images/icon.svg',
    './images/icon.png',
    './images/icon-192.png',
    './images/icon-512.png',
    './images/web-app-manifest-192x192.png',
    './images/web-app-manifest-512x512.png',
    './images/apple-touch-icon.png',
    './images/favicon-96x96.png',
    './images/favicon.svg',
    './images/favicon.ico',
    './images/coffee.webm',
    './images/gift-ic.gif',
    './images/app_icon.png'
];

// Install: pre-cache static assets and activate immediately
self.addEventListener('install', (event) => {
    self.skipWaiting();
    event.waitUntil(
        caches.open(CACHE_NAME).then(async (cache) => {
            // Cache core assets safely; log any failures without blocking entire installation
            await Promise.allSettled(
                STATIC_ASSETS.map((asset) =>
                    cache.add(asset).catch((err) => {
                        console.warn(`[PWA SW] Pre-cache failed for ${asset}:`, err);
                    })
                )
            );
        })
    );
});

// Activate: clean up any older caches and take control of all open pages immediately
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.map((key) => {
                    if (key !== CACHE_NAME) {
                        return caches.delete(key);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: NETWORK-FIRST STRATEGY
// Always request fresh live assets from network first; fall back to cache only when offline.
self.addEventListener('fetch', (event) => {
    // Only handle standard HTTP/HTTPS GET requests
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    // Avoid Chrome DevTools / extension bug with only-if-cached requests
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;

    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
                // If response is valid, update our offline cache with the fresh copy
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, responseToCache).catch(() => {});
                    });
                }
                return networkResponse;
            })
            .catch(() => {
                // Network failed or offline -> serve from cache
                return caches.match(event.request).then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // If navigation / HTML document request fails, serve index.html
                    if (event.request.mode === 'navigate' || event.request.headers.get('accept')?.includes('text/html')) {
                        return caches.match('./index.html').then((indexFallback) => {
                            return indexFallback || caches.match('./');
                        });
                    }
                });
            })
    );
});

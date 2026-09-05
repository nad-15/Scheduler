// ==========================================================================
// Skhayeduler Service Worker - Network-First Strategy (Zero Stale Code)
// ==========================================================================

const CACHE_NAME = 'scheduler-pwa-v50';

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
    './images/apple-touch-icon.png',
    './images/web-app-manifest-192x192.png',
    './images/web-app-manifest-512x512.png',
    './images/favicon-96x96.png',
    './images/favicon.svg',
    './images/favicon.ico',
    './images/coffee.webm',
    './images/gift-ic.gif',
    './images/app_icon.png',
    './images/weather/barometer.svg',
    './images/weather/clear-day.svg',
    './images/weather/clear-night.svg',
    './images/weather/drizzle.svg',
    './images/weather/dust-day.svg',
    './images/weather/dust-night.svg',
    './images/weather/dust.svg',
    './images/weather/fog-day.svg',
    './images/weather/fog-night.svg',
    './images/weather/fog.svg',
    './images/weather/hail.svg',
    './images/weather/humidity.svg',
    './images/weather/hurricane.svg',
    './images/weather/not-available.svg',
    './images/weather/overcast-day.svg',
    './images/weather/overcast-night.svg',
    './images/weather/overcast.svg',
    './images/weather/partly-cloudy-day-rain.svg',
    './images/weather/partly-cloudy-day-snow.svg',
    './images/weather/partly-cloudy-day.svg',
    './images/weather/partly-cloudy-night-rain.svg',
    './images/weather/partly-cloudy-night-snow.svg',
    './images/weather/partly-cloudy-night.svg',
    './images/weather/rain.svg',
    './images/weather/raindrop.svg',
    './images/weather/raindrops.svg',
    './images/weather/sleet.svg',
    './images/weather/smoke.svg',
    './images/weather/snow.svg',
    './images/weather/snowflake.svg',
    './images/weather/thermometer.svg',
    './images/weather/thunderstorms-day-rain.svg',
    './images/weather/thunderstorms-day.svg',
    './images/weather/thunderstorms-night-rain.svg',
    './images/weather/thunderstorms-night.svg',
    './images/weather/thunderstorms-rain.svg',
    './images/weather/thunderstorms-snow.svg',
    './images/weather/thunderstorms.svg',
    './images/weather/tornado.svg',
    './images/weather/umbrella.svg',
    './images/weather/uv-index.svg',
    './images/weather/wind-alert.svg',
    './images/weather/wind.svg'
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

// Fetch Strategy:
// 1. Static Images & SVGs -> CACHE-FIRST (Instant 0ms render from local disk)
// 2. HTML, JS, CSS -> NETWORK-FIRST (Fresh updates from server with offline cache fallback)
self.addEventListener('fetch', (event) => {
    // Only handle standard HTTP/HTTPS GET requests
    if (event.request.method !== 'GET') return;
    if (!event.request.url.startsWith('http')) return;

    // Do NOT intercept live weather or geocoding API requests - let browser handle directly
    if (event.request.url.includes('open-meteo.com')) {
        return;
    }

    // Avoid Chrome DevTools / extension bug with only-if-cached requests
    if (event.request.cache === 'only-if-cached' && event.request.mode !== 'same-origin') return;

    const isImage = event.request.destination === 'image' || event.request.url.match(/\.(svg|png|jpg|jpeg|gif|ico|webp|webm)$/i);

    // CACHE-FIRST for Images & Weather SVGs (zero network latency)
    if (isImage) {
        event.respondWith(
            caches.match(event.request).then((cachedResponse) => {
                if (cachedResponse) {
                    return cachedResponse;
                }
                return fetch(event.request)
                    .then((networkResponse) => {
                        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
                            const responseToCache = networkResponse.clone();
                            caches.open(CACHE_NAME).then((cache) => {
                                cache.put(event.request, responseToCache).catch(() => {});
                            });
                        }
                        return networkResponse;
                    })
                    .catch(() => caches.match('./images/icon.svg'));
            })
        );
        return;
    }

    // NETWORK-FIRST for HTML / JS / CSS (ensures immediate deployment updates)
    event.respondWith(
        fetch(event.request)
            .then((networkResponse) => {
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

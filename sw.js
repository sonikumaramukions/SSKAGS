const CACHE_NAME = 'sskg-app-v5';
const ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/db.js',
    '/scheduler.js',
    '/pdf.js',
    '/backup.js',
    '/manifest.json',
    '/lib/jspdf.umd.min.js',
    '/lib/lz-string.min.js',
    '/lib/dexie.min.js',
    '/lib/chart.umd.min.js',
    '/fonts/inter-400.ttf',
    '/fonts/inter-500.ttf',
    '/fonts/inter-600.ttf',
    '/fonts/inter-700.ttf'
];

// Install: cache all app files
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Caching all app assets for offline use');
            return cache.addAll(ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate: delete old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((name) => {
                    if (name !== CACHE_NAME) {
                        console.log('Deleting old cache:', name);
                        return caches.delete(name);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// Fetch: serve from cache first, fallback to network
self.addEventListener('fetch', (event) => {
    // Skip Google Drive API / Google auth requests — they must always go to network
    if (event.request.url.includes('googleapis.com') || event.request.url.includes('accounts.google.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).catch(() => {
                // If both cache miss and network fail, return offline page
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
            });
        })
    );
});

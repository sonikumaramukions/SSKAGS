importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  console.log(`Workbox is loaded`);

  // Force activate
  workbox.core.skipWaiting();
  workbox.core.clientsClaim();

  const CURRENT_CACHE_V = 'v4';
  const APP_CACHE = `sskg-app-files-${CURRENT_CACHE_V}`;
  const CDN_CACHE = `sskg-cdn-libs-${CURRENT_CACHE_V}`;

  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== APP_CACHE && cacheName !== CDN_CACHE && cacheName.startsWith('sskg-')) {
              console.log('Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
    );
  });

  // Cache our local app files heavily (Cache First strategy)
  // These files change rarely, and we want 100% offline support
  workbox.routing.registerRoute(
    ({request, url}) => {
      const localFiles = ['/', '/index.html', '/style.css', '/app.js', '/db.js', '/scheduler.js', '/pdf.js', '/backup.js', '/manifest.json', '/lib/jspdf.umd.min.js', '/lib/lz-string.min.js'];
      return localFiles.includes(url.pathname);
    },
    new workbox.strategies.CacheFirst({
      cacheName: APP_CACHE,
      plugins: [
        new workbox.expiration.ExpirationPlugin({
          maxEntries: 20,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 Days
        }),
      ],
    })
  );

  // Let browser cache CDNs on its own, but we can StaleWhileRevalidate them just in case
  workbox.routing.registerRoute(
    ({url}) => url.origin === 'https://cdn.jsdelivr.net' || url.origin === 'https://cdnjs.cloudflare.com',
    new workbox.strategies.StaleWhileRevalidate({
      cacheName: CDN_CACHE,
    })
  );
  
} else {
  console.log(`Workbox didn't load`);
}

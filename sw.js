const CACHE_NAME = 'navmap-v3';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

self.addEventListener('install', event => {
  console.log('[Service Worker] Installing Service Worker...', event);
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[Service Worker] Precaching App Shell');
        return cache.addAll(ASSETS_TO_CACHE);
      })
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  console.log('[Service Worker] Activating Service Worker...', event);
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME && cache !== 'navmap-tiles') {
            console.log('[Service Worker] Removing old cache.', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  
  // Cache-first strategy for OSM tiles
  if (url.origin.includes('tile.openstreetmap.org')) {
      event.respondWith(
          caches.match(event.request).then(response => {
              if (response) {
                  return response;
              }
              // If not in cache, fetch from network and add to 'navmap-tiles' cache
              return fetch(event.request).then(fetchResponse => {
                  return caches.open('navmap-tiles').then(cache => {
                      cache.put(event.request, fetchResponse.clone());
                      return fetchResponse;
                  });
              }).catch(() => {
                  // If completely offline and tile not cached, fail gracefully
                  return new Response('', { status: 404, statusText: 'Offline' });
              });
          })
      );
      return;
  }

  // Stale-while-revalidate for everything else (HTML, CSS, JS)
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        const fetchPromise = fetch(event.request).then(networkResponse => {
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        }).catch(() => {
            // Offline fallback
            console.log('[Service Worker] Offline fallback for:', event.request.url);
        });
        return response || fetchPromise;
      })
  );
});

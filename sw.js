// ─── CACHE VERSIONING ────────────────────────────────────────────────────────
const CACHE_NAME = 'navmap-v4';
const TILES_CACHE = 'navmap-tiles-v1';

// ─── CAMPUS BOUNDING BOX ─────────────────────────────────────────────────────
// IIT Madras with buffer
const BOUNDS = { S: 12.977, N: 13.010, W: 80.218, E: 80.250 };
const TILE_ZOOM_MIN = 13;
const TILE_ZOOM_MAX = 18;

// ─── APP SHELL ────────────────────────────────────────────────────────────────
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
];

// ─── TILE MATH ────────────────────────────────────────────────────────────────
function lon2tile(lon, z) {
  return Math.floor((lon + 180) / 360 * Math.pow(2, z));
}
function lat2tile(lat, z) {
  return Math.floor(
    (1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI)
    / 2 * Math.pow(2, z)
  );
}

function getAllCampusTileUrls() {
  const urls = [];
  // OSM has 3 subdomains: a, b, c — spread load evenly
  const subdomains = ['a', 'b', 'c'];
  let sd = 0;
  for (let z = TILE_ZOOM_MIN; z <= TILE_ZOOM_MAX; z++) {
    const xMin = lon2tile(BOUNDS.W, z), xMax = lon2tile(BOUNDS.E, z);
    const yMin = lat2tile(BOUNDS.N, z), yMax = lat2tile(BOUNDS.S, z);
    for (let x = xMin; x <= xMax; x++) {
      for (let y = yMin; y <= yMax; y++) {
        urls.push(`https://${subdomains[sd % 3]}.tile.openstreetmap.org/${z}/${x}/${y}.png`);
        sd++;
      }
    }
  }
  return urls;
}

// ─── INSTALL: Cache app shell + pre-cache all campus tiles ────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing…');
  event.waitUntil(
    Promise.all([
      // 1. Cache the app shell immediately
      caches.open(CACHE_NAME).then(cache => {
        console.log('[SW] Caching app shell');
        return cache.addAll(ASSETS_TO_CACHE);
      }),
      // 2. Pre-fetch all campus tiles in background (batched to avoid memory pressure)
      cacheCampusTiles()
    ]).then(() => self.skipWaiting())
  );
});

async function cacheCampusTiles() {
  const urls = getAllCampusTileUrls();
  const cache = await caches.open(TILES_CACHE);
  const BATCH = 10; // Fetch 10 tiles at a time
  let cached = 0;

  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async url => {
        try {
          const existing = await cache.match(url);
          if (!existing) {
            const resp = await fetch(url);
            if (resp.ok) {
              await cache.put(url, resp);
              cached++;
            }
          } else {
            cached++;
          }
        } catch (e) {
          // Silently fail on individual tiles — partial cache is fine
        }
      })
    );
    // Notify any connected clients of progress
    const progress = Math.round(((i + BATCH) / urls.length) * 100);
    self.clients.matchAll().then(clients => {
      clients.forEach(c => c.postMessage({ type: 'TILE_CACHE_PROGRESS', progress: Math.min(progress, 100), total: urls.length, cached }));
    });
  }
  console.log(`[SW] Tile pre-cache complete: ${cached}/${urls.length} tiles`);
}

// ─── ACTIVATE: Clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating…');
  event.waitUntil(
    caches.keys().then(cacheNames =>
      Promise.all(
        cacheNames.map(name => {
          if (name !== CACHE_NAME && name !== TILES_CACHE) {
            console.log('[SW] Deleting old cache:', name);
            return caches.delete(name);
          }
        })
      )
    ).then(() => self.clients.claim())
  );
});

// ─── FETCH: Cache-first for tiles, stale-while-revalidate for app ─────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // OSM tiles → cache-first (never stale)
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          caches.open(TILES_CACHE).then(c => c.put(event.request, resp.clone()));
          return resp;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // App shell → stale-while-revalidate
  event.respondWith(
    caches.match(event.request).then(cached => {
      const network = fetch(event.request).then(resp => {
        caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
        return resp;
      }).catch(() => {});
      return cached || network;
    })
  );
});

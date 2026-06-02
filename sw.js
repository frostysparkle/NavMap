// ─── CACHE VERSIONING ────────────────────────────────────────────────────────
const CACHE_NAME = 'navmap-v6';
const TILES_CACHE = 'navmap-tiles-v3';

// ─── CAMPUS BOUNDING BOX ─────────────────────────────────────────────────────
// IIT Madras campus with a small buffer
const BOUNDS = { S: 12.978, N: 13.008, W: 80.220, E: 80.248 };
// Zoom 14-17: good quality, manageable tile count (~900 tiles)
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

// ─── INSTALL: Cache app shell immediately, tiles deferred ────────────────────
self.addEventListener('install', event => {
  console.log('[SW] Installing v6…');
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      console.log('[SW] Caching app shell');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => {
      console.log('[SW] App shell cached, skipping waiting');
      return self.skipWaiting();
    })
  );
  // Start tile caching in background WITHOUT blocking install
  event.waitUntil(
    self.skipWaiting().then(() => cacheCampusTiles())
  );
});

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function cacheCampusTiles() {
  const urls = getAllCampusTileUrls();
  const cache = await caches.open(TILES_CACHE);
  const BATCH = 15;        // Medium batches to avoid hammering OSM but speed up caching
  const DELAY_MS = 200;   // 200ms between batches
  let cached = 0;
  let skipped = 0;
  console.log(`[SW] Starting tile pre-cache: ${urls.length} tiles, z${TILE_ZOOM_MIN}-z${TILE_ZOOM_MAX}`);

  for (let i = 0; i < urls.length; i += BATCH) {
    const batch = urls.slice(i, i + BATCH);
    await Promise.all(
      batch.map(async url => {
        try {
          const existing = await cache.match(url);
          if (existing) {
            skipped++;
            cached++;
            return;
          }
          const resp = await fetch(url, {
            headers: { 'User-Agent': 'IITMNavMap/1.0' },
            cache: 'no-store'
          });
          if (resp.ok) {
            await cache.put(url, resp);
            cached++;
          }
        } catch (e) {
          // Silently skip failed tiles — partial cache is fine
        }
      })
    );

    // Notify clients of progress
    const progress = Math.min(Math.round(((i + BATCH) / urls.length) * 100), 100);
    self.clients.matchAll({ includeUncontrolled: true, type: 'window' }).then(clients => {
      clients.forEach(c => c.postMessage({
        type: 'TILE_CACHE_PROGRESS',
        progress,
        total: urls.length,
        cached
      }));
    });

    await sleep(DELAY_MS);
  }
  console.log(`[SW] Tile pre-cache done: ${cached}/${urls.length} tiles cached (${skipped} already existed)`);
}

// ─── ACTIVATE: Clean up old caches ───────────────────────────────────────────
self.addEventListener('activate', event => {
  console.log('[SW] Activating v6…');
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

// ─── MESSAGE LISTENER: Handle client requests ──────────────────────────────
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'REFRESH_TILES') {
    console.log('[SW] Refreshing tile cache as requested by client...');
    event.waitUntil(
      caches.delete(TILES_CACHE).then(() => {
        return cacheCampusTiles();
      })
    );
  }
});

// ─── FETCH: Cache-first for tiles, stale-while-revalidate for app ─────────────
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // OSM tiles → cache-first
  if (url.hostname.endsWith('tile.openstreetmap.org')) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        if (cached) return cached;
        return fetch(event.request).then(resp => {
          if (resp.ok) {
            caches.open(TILES_CACHE).then(c => c.put(event.request, resp.clone()));
          }
          return resp;
        }).catch(() => new Response('', { status: 404 }));
      })
    );
    return;
  }

  // App shell → cache-first with network fallback
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(resp => {
        if (resp.ok) {
          caches.open(CACHE_NAME).then(c => c.put(event.request, resp.clone()));
        }
        return resp;
      }).catch(() => cached);
      return cached || networkFetch;
    })
  );
});

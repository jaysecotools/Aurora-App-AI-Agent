// sw.js - PWA Service Worker for Aurora Tracker
// Version v2.1 - Fixed caching strategy

const CACHE_NAME = 'aurora-tracker-v2-1';
const STATIC_CACHE = 'aurora-static-v2-1';

// Cache essential files - ONLY those that actually exist
// Removed references to missing icon files to prevent console errors
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
  // Icons are optional - if they don't exist, don't cache them
  // Add only the icons you actually have in your project
];

// Install - cache essential files
self.addEventListener('install', event => {
  console.log('[SW] Installing new version v2.1...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return cache.addAll(urlsToCache);
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches and take control
self.addEventListener('activate', event => {
  console.log('[SW] Activating v2.1...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== STATIC_CACHE && cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Now claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch - network first with cache fallback for HTML, cache first for assets
self.addEventListener('fetch', event => {
  const url = event.request.url;
  const request = event.request;
  
  // Skip non-GET requests
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  // For navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Cache the fresh response
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(async () => {
          // If network fails, try cache
          const cachedResponse = await caches.match(request);
          if (cachedResponse) {
            return cachedResponse;
          }
          // Fallback to index.html
          return caches.match('./index.html');
        })
    );
    return;
  }
  
  // For NOAA API requests - network only, with timeout fallback
  if (url.includes('services.swpc.noaa.gov')) {
    event.respondWith(
      fetch(request, { timeout: 10000 })
        .catch(async () => {
          // Return cached data if available
          const cachedData = await caches.match(request);
          if (cachedData) {
            return cachedData;
          }
          // Return a synthetic response with stale data indicator
          return new Response(JSON.stringify({ error: 'offline', cached: false }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  // For static assets - cache first, then network
  if (url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|json)$/)) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached version, update in background
            fetch(request)
              .then(response => {
                if (response && response.status === 200) {
                  caches.open(STATIC_CACHE).then(cache => {
                    cache.put(request, response);
                  });
                }
              })
              .catch(() => {});
            return cachedResponse;
          }
          return fetch(request)
            .then(response => {
              if (response && response.status === 200) {
                const responseClone = response.clone();
                caches.open(STATIC_CACHE).then(cache => {
                  cache.put(request, responseClone);
                });
              }
              return response;
            });
        })
    );
    return;
  }
  
  // Default: network first, cache fallback
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

// Handle messages from clients
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
  if (event.data.action === 'getVersion') {
    event.ports[0].postMessage({ version: CACHE_NAME });
  }
});

console.log('[SW] Service worker v2.1 active');

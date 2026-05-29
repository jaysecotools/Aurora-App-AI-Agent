// sw.js - PWA Service Worker with proper caching and update handling
const CACHE_NAME = 'aurora-tracker-v3';
const STATIC_CACHE = 'aurora-static-v3';

// Cache essential files for offline functionality
const urlsToCache = [
  './',
  './index.html',
  './manifest.json',
  // Icons
  './icon-16x16.png',
  './icon-32x32.png',
  './icon-48x48.png',
  './icon-64x64.png',
  './icon-96x96.png',
  './icon-128x128.png',
  './icon-144x144.png',
  './icon-152x152.png',
  './icon-180x180.png',
  './icon-192x192.png',
  './icon-192x192-maskable.png',
  './icon-384x384.png',
  './icon-512x512.png',
  './icon-512x512-maskable.png'
];

// Install - cache essential files
self.addEventListener('install', event => {
  console.log('[SW] Installing new version...');
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
  console.log('[SW] Activating...');
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

// Fetch - network first with cache fallback
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
  
  // For API requests - network only, no cache (but with timeout)
  if (url.includes('services.swpc.noaa.gov')) {
    event.respondWith(
      Promise.race([
        fetch(request),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Request timeout')), 10000)
        )
      ]).catch(async () => {
        // Return cached data if available
        const cachedData = await caches.match(request);
        if (cachedData) {
          return cachedData;
        }
        throw new Error('No network and no cache for API');
      })
    );
    return;
  }
  
  // For static assets and modules - cache first, then network
  if (url.includes('/agent/') || 
      url.includes('/notifications/') || 
      url.includes('/services/') ||
      url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico)$/)) {
    
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            // Return cached version, but update in background
            fetch(request)
              .then(response => {
                if (response && response.status === 200) {
                  caches.open(STATIC_CACHE).then(cache => {
                    cache.put(request, response);
                  });
                }
              })
              .catch(err => console.log('Background update failed:', err));
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

console.log('[SW] Service worker active - optimized caching strategy');

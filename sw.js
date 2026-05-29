// sw.js - Service Worker for Aurora Tracker PWA
const CACHE_NAME = 'aurora-tracker-v3'; // Changed version to force update
const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
  // Removed icon paths since they don't exist yet - add them when you have icons
];

// Install event - cache core assets
self.addEventListener('install', event => {
  console.log('[SW] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Caching app assets');
        return cache.addAll(urlsToCache).catch(err => {
          console.warn('[SW] Cache addAll failed:', err);
          // Continue anyway - don't let cache failure break installation
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  console.log('[SW] Activating...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - MODIFIED to properly handle module files
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // DON'T intercept NOAA API calls - let them go straight to network
  if (url.includes('services.swpc.noaa.gov')) {
    return;
  }
  
  // DON'T intercept your module JS files - let them load fresh
  if (url.includes('/agent/') || url.includes('/notifications/') || url.includes('/services/')) {
    return;
  }
  
  // For everything else, try cache then network
  event.respondWith(
    caches.match(event.request)
      .then(cachedResponse => {
        if (cachedResponse) {
          // Return cached version, update in background
          fetch(event.request)
            .then(networkResponse => {
              if (networkResponse && networkResponse.status === 200) {
                caches.open(CACHE_NAME).then(cache => {
                  cache.put(event.request, networkResponse.clone());
                });
              }
            })
            .catch(() => {});
          return cachedResponse;
        }
        
        return fetch(event.request)
          .then(response => {
            // Cache valid responses for HTML, CSS, etc.
            if (response && response.status === 200 && 
                (response.headers.get('content-type')?.includes('text/html') ||
                 response.headers.get('content-type')?.includes('text/css'))) {
              const responseToCache = response.clone();
              caches.open(CACHE_NAME).then(cache => {
                cache.put(event.request, responseToCache);
              });
            }
            return response;
          })
          .catch(() => {
            if (event.request.headers.get('accept')?.includes('text/html')) {
              return caches.match('./index.html');
            }
          });
      })
  );
});

// Handle update messages
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Background sync for data refresh
self.addEventListener('sync', event => {
  if (event.tag === 'refresh-aurora-data') {
    event.waitUntil(refreshAuroraData());
  }
});

async function refreshAuroraData() {
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'REFRESH_DATA' });
  });
}

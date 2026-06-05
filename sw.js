// sw.js - PWA Service Worker for Aurora Tracker v2.2
const CACHE_NAME = 'aurora-tracker-v2-2-0';
const STATIC_CACHE = 'aurora-static-v2-2-0';

const urlsToCache = [
  './',
  './index.html',
  './manifest.json'
];

// Install
self.addEventListener('install', event => {
  console.log('[SW] Installing v2.2...');
  event.waitUntil(
    caches.open(STATIC_CACHE)
      .then(cache => {
        console.log('[SW] Caching static assets');
        return Promise.allSettled(
          urlsToCache.map(url => cache.add(url).catch(e => console.warn(`Failed to cache ${url}:`, e)))
        );
      })
      .then(() => self.skipWaiting())
  );
});

// Activate
self.addEventListener('activate', event => {
  console.log('[SW] Activating v2.2...');
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== STATIC_CACHE && cache !== CACHE_NAME && cache !== 'aurora-data-cache') {
            console.log('[SW] Deleting old cache:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[SW] Claiming clients');
      return self.clients.claim();
    })
  );
});

// Fetch
self.addEventListener('fetch', event => {
  const url = event.request.url;
  const request = event.request;
  
  if (request.method !== 'GET') {
    event.respondWith(fetch(request));
    return;
  }
  
  // HTML navigation - network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(response => {
          const responseClone = response.clone();
          caches.open(STATIC_CACHE).then(cache => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(async () => {
          const cachedResponse = await caches.match(request);
          if (cachedResponse) return cachedResponse;
          return caches.match('./index.html');
        })
    );
    return;
  }
  
  // API requests - network only, 10s timeout
  if (url.includes('services.swpc.noaa.gov')) {
    event.respondWith(
      fetch(request, { timeout: 10000 })
        .catch(async () => {
          const cachedData = await caches.match(request);
          if (cachedData) return cachedData;
          return new Response(JSON.stringify({ error: 'offline' }), {
            headers: { 'Content-Type': 'application/json' }
          });
        })
    );
    return;
  }
  
  // Static assets - cache first
  if (url.match(/\.(js|css|png|jpg|jpeg|gif|svg|ico|json)$/)) {
    event.respondWith(
      caches.match(request)
        .then(cachedResponse => {
          if (cachedResponse) {
            fetch(request).then(response => {
              if (response && response.status === 200) {
                caches.open(STATIC_CACHE).then(cache => cache.put(request, response));
              }
            }).catch(() => {});
            return cachedResponse;
          }
          return fetch(request).then(response => {
            if (response && response.status === 200) {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE).then(cache => cache.put(request, responseClone));
            }
            return response;
          });
        })
    );
    return;
  }
  
  // Default - network first
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseClone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});

self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

console.log('[SW] Service Worker v2.2 active');

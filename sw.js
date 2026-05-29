// sw.js - Simple PWA Service Worker (NO aggressive caching)
const CACHE_NAME = 'aurora-tracker-light-v1';

// Only cache the absolute minimum needed for offline install
const urlsToCache = [
  './manifest.json'
  // Intentionally NOT caching index.html or any JS files
];

// Install - minimal caching
self.addEventListener('install', event => {
  console.log('[SW] Installing light version...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        // Try to cache manifest, but don't fail if it doesn't work
        return cache.addAll(urlsToCache).catch(err => {
          console.log('[SW] Cache warning:', err);
        });
      })
      .then(() => self.skipWaiting())
  );
});

// Activate - clean old caches and take control immediately
self.addEventListener('activate', event => {
  console.log('[SW] Activating light version...');
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
    }).then(() => {
      // Take control of all clients immediately
      return self.clients.claim();
    })
  );
});

// Fetch - DO NOT CACHE HTML or JS - always go to network
self.addEventListener('fetch', event => {
  const url = event.request.url;
  
  // Don't cache anything - just let everything go to network
  // This ensures you always get the latest version on refresh
  
  // For HTML pages, NEVER cache them
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Only fallback to cache if offline AND it's the main page
        return caches.match('./index.html');
      })
    );
    return;
  }
  
  // For everything else (images, etc.), try network first, then cache as fallback only
  event.respondWith(
    fetch(event.request)
      .catch(() => {
        // Only use cache if offline
        return caches.match(event.request);
      })
  );
});

// Simple message handler
self.addEventListener('message', event => {
  if (event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

// Log that service worker is active
console.log('[SW] Light service worker active - no aggressive caching');

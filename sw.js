/**
 * CBSE Class 9 & 10 Study Tracker - Service Worker
 * Precaches app shell (HTML/CSS/JS/icons) ONLY.
 * NEVER precaches PDFs to protect device storage quota.
 */

const CACHE_NAME = "sunil-bhaiya-tracker-v3";

const APP_SHELL_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./css/feature-hub.css",
  "./css/wild-features.css",
  "./js/data/stages.js",
  "./js/data/chapters-class9.js",
  "./js/data/chapters-class10.js",
  "./js/storage.js",
  "./js/planner.js",
  "./js/insights.js",
  "./js/app.js",
  "./js/dock-magnify.js",
  "./js/feature-hub.js",
  "./js/wild-features.js",
  "./assets/icons/logo.svg",
  "./assets/icons/logo-maskable.svg",
  "./assets/icons/apple-touch-icon.png",
  "./manifest.json"
];

// Install Event - Precache App Shell
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(APP_SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate Event - Clean up old caches
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Serve App Shell from Cache, ignore PDFs
self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // NEVER cache PDFs in Service Worker
  if (url.pathname.endsWith(".pdf") || url.pathname.includes("/assets/pdfs/")) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then(networkResponse => {
        if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== "basic") {
          return networkResponse;
        }

        const responseToCache = networkResponse.clone();
        caches.open(CACHE_NAME).then(cache => {
          cache.put(event.request, responseToCache);
        });

        return networkResponse;
      });
    })
  );
});

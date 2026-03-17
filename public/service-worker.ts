const CACHE_NAME = "agroclimate-cache-v1";

// Install event — skip waiting to activate new worker immediately
self.addEventListener("install", (event: ExtendableEvent) => {
  self.skipWaiting();
});

// Activate event — take control of all clients immediately
self.addEventListener("activate", (event: ExtendableEvent) => {
  event.waitUntil((self as any).clients.claim());
});

// Fetch event — control caching for static assets, bypass API calls
self.addEventListener("fetch", (event: FetchEvent) => {
  const url = event.request.url;

  // Always fetch backend/weather requests fresh
  if (url.includes("/api/weather")) {
    event.respondWith(fetch(event.request));
    return;
  }

  // For other requests (static assets), use cache-first strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) return cachedResponse;
      return fetch(event.request).then((response) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, response.clone());
          return response;
        });
      });
    })
  );
});

/* LifeSync Service Worker (GitHub Pages-friendly) */
const CACHE_NAME = "lifesync-v1";
const ASSETS = [
  "./",
  "./index.html",
  "./dashboard.html",
  "./finances.html",
  "./habits.html",
  "./workouts.html",
  "./nutrition.html",
  "./404.html",
  "./style.css",
  "./app.js",
  "./hero.png",
  "./lifesync-logo.svg",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        // Only cache successful basic responses
        if (res && res.status === 200 && res.type === "basic") {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached || caches.match("./404.html"));
      return cached || fetchPromise;
    })
  );
});

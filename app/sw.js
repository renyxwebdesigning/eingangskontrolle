// Offline-Cache. Bei jeder Änderung an der App VERSION erhöhen,
// damit Tablets die neue Version laden.
const VERSION = "ek-2";
const FILES = [
  "./", "index.html", "styles.css", "manifest.webmanifest",
  "js/app.js", "js/checklist.js", "js/pdf.js", "js/storage.js",
  "vendor/jspdf.umd.min.js", "vendor/jspdf.plugin.autotable.min.js",
  "fonts/Barlow-Regular.woff2", "fonts/Barlow-Medium.woff2", "fonts/Barlow-SemiBold.woff2",
  "fonts/Barlow-Bold.woff2", "fonts/BarlowCondensed-Bold.woff2",
  "fonts/Barlow-Regular.pdf.ttf", "fonts/Barlow-Bold.pdf.ttf",
  "img/logo-plate.png", "img/favicon.png", "img/icon-180.png", "img/icon-192.png", "img/icon-512.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Network first (so updates arrive when online), cache as fallback offline.
self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(VERSION).then((c) => c.put(e.request, copy));
        }
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

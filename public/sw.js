/* Centrum Badminton Arena — minimal hand-rolled service worker */
const CACHE = "cba-v6";
const OFFLINE_URL = "/offline";
const MAX_STATIC_ENTRIES = 120;

async function trimCache(cacheName, maxEntries) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length <= maxEntries) return;
  // Delete oldest entries first
  for (const key of keys.slice(0, keys.length - maxEntries)) {
    await cache.delete(key);
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(OFFLINE_URL))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;

  // Navigations: network-first with offline fallback.
  // Authenticated /app pages are NEVER cached: on a shared device the
  // cached HTML could leak one account's data into another's offline
  // session. Only the static /offline shell is pre-cached at install.
  if (req.mode === "navigate") {
    if (url.pathname.startsWith("/app")) {
      event.respondWith(fetch(req).catch(() => caches.match(OFFLINE_URL)));
      return;
    }
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match(req);
        return cached || caches.match(OFFLINE_URL);
      })
    );
    return;
  }

  // Next.js build chunks: network-first with cache fallback.
  // (Was cache-first: stale JS survived deploys/restarts and the UI
  // "regressed" to old bundles. Chunk URLs are content-hashed, so
  // network-first is always correct — cache is only a fallback.)
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(req, copy))
            .then(() => trimCache(CACHE, MAX_STATIC_ENTRIES))
            .catch(() => {});
          return res;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // Static assets: cache-first (images, icons, fonts — content-addressed or rarely changed)
  const isStatic =
    url.pathname.startsWith("/icons/") ||
    /\.(png|jpg|jpeg|svg|woff2?|ico)$/.test(url.pathname);

  if (isStatic) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches
              .open(CACHE)
              .then((c) => c.put(req, copy))
              .then(() => trimCache(CACHE, MAX_STATIC_ENTRIES))
              .catch(() => {});
            return res;
          })
      )
    );
  }
});

/* Push notifications (VAPID) */
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {}
  const title = data.title || "Centrum Badminton";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/icons/icon-192.png",
      badge: "/icons/icon-192.png",
      data: { url: data.url || "/app" },
      tag: data.tag,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/app";
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          client.navigate(url).catch(() => {});
          return client.focus();
        }
      }
      return self.clients.openWindow(url);
    })
  );
});

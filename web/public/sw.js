// Keeps what the game has already loaded so it opens with no connection. Single-player saves live on
// the device already; this only covers the files. Shared worlds still need the network.
const CACHE = "veyrmarch-v1";
const FONT_HOSTS = ["fonts.googleapis.com", "fonts.gstatic.com"];

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

const keep = async (req, res) => {
  if (res && res.ok && res.status === 200) (await caches.open(CACHE)).put(req, res.clone());
  return res;
};

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || req.headers.has("range")) return;
  const url = new URL(req.url);
  const own = url.origin === self.location.origin;
  if (!own && !FONT_HOSTS.includes(url.hostname)) return;
  // the page itself: newest when online, the last one seen when not
  if (own && req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => keep("/", res))
        .catch(async () => (await caches.match("/")) ?? Response.error()),
    );
    return;
  }
  // built files carry their version in their name and never change: serve the kept copy first
  if (own && url.pathname.startsWith("/assets/")) {
    e.respondWith(caches.match(req).then((hit) => hit ?? fetch(req).then((res) => keep(req, res))));
    return;
  }
  // art and models keep their names between releases: show the kept copy now, fetch a newer one for next time
  if (own && /^\/(art|models)\//.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => {
        const fresh = fetch(req).then((res) => keep(req, res));
        if (!hit) return fresh;
        e.waitUntil(fresh.catch(() => undefined));
        return hit;
      }),
    );
    return;
  }
  // everything else (icons, manifest, fonts): network first, kept copy if that fails
  e.respondWith(
    fetch(req)
      .then((res) => keep(req, res))
      .catch(async () => (await caches.match(req)) ?? Response.error()),
  );
});

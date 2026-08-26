/* Service worker — NETWORK-FIRST cho file cùng nguồn, CACHE-FIRST cho CDN */
const CACHE = "hsk-app-v11";
const CDN_CACHE = "hsk-cdn-v1";
const ASSETS = [
  "./", "./index.html", "./styles.css", "./app.js", "./appdata.js",
  "./manifest.webmanifest", "./icon-192.png", "./icon-512.png"
];
self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(
    ks.filter(k => k !== CACHE && k !== CDN_CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // CDN (pdf.js, tesseract...) → CACHE-FIRST (tải 1 lần, dùng offline)
  const isCDN = /cdnjs\.cloudflare\.com|cdn\.jsdelivr\.net|unpkg\.com|tessdata/.test(url.href);
  if (url.origin !== location.origin) {
    if (isCDN) {
      e.respondWith(
        caches.open(CDN_CACHE).then(c => c.match(req).then(hit => hit ||
          fetch(req).then(res => { if (res.ok) c.put(req, res.clone()); return res; })))
      );
    }
    return; // translate/youtube/youglish: để mạng lo
  }

  // Same-origin → NETWORK-FIRST (luôn mới khi online, offline dùng cache)
  e.respondWith(
    fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }).catch(() => caches.match(req).then(hit => hit || caches.match("./index.html")))
  );
});

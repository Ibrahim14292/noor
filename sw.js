// NOOR service worker — offline app shell + verified Quran text.
// Recitation audio is NOT cached here; downloads are stored by the app in IndexedDB.
const V = 'noor-v1.0.3';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'app.css', 'app.js', 'db.js', 'quran.js', 'audio.js', 'srs.js', 'state.js', 'ui.js', 'tajweed.js', 'views-practice.js', 'views-more.js', 'quran.json', 'amiri-quran.woff2', 'amiri-700.woff2', 'plex-ar-400.woff2', 'plex-ar-500.woff2', 'plex-ar-700.woff2', 'plex-la-400.woff2', 'plex-la-500.woff2', 'plex-la-700.woff2', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // audio CDNs go straight to network
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match('index.html'))));
});

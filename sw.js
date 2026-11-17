// NOOR service worker — offline app shell + verified Quran text.
// Recitation audio is NOT cached here; downloads are stored by the app in IndexedDB.
const V = 'noor-v1.0.0';
const SHELL = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/db.js', 'js/quran.js', 'js/audio.js', 'js/srs.js', 'js/state.js', 'js/ui.js', 'js/tajweed.js', 'js/views-practice.js', 'js/views-more.js',
  'data/quran.json', 'fonts/amiri-quran.woff2', 'fonts/amiri-700.woff2',
  'fonts/plex-ar-400.woff2', 'fonts/plex-ar-500.woff2', 'fonts/plex-ar-700.woff2', 'fonts/plex-la-400.woff2', 'fonts/plex-la-500.woff2', 'fonts/plex-la-700.woff2',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/apple-touch-icon.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return; // audio CDNs go straight to network
  e.respondWith(caches.match(e.request, { ignoreSearch: true }).then(hit => hit || fetch(e.request).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(V).then(c => c.put(e.request, copy)); }
    return res;
  }).catch(() => caches.match('index.html'))));
});

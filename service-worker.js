
// Simple offline cache
const CACHE = 'wordchain-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // Note: Pyodide is loaded from CDN; it won't be fully cached offline here.
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.map(k => k !== CACHE && caches.delete(k))))
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Network-first for Pyodide CDN assets, cache-first for our assets
  if (ASSETS.includes(url.pathname.replace(/.*\//, './'))) {
    e.respondWith(
      caches.match(e.request).then(res => res || fetch(e.request))
    );
  } else {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
  }
});

/* NOVA STRIKE — service worker
   Полный офлайн после первого визита + мгновенное автообновление:
   - навигация: network-first (свежая версия при появлении в сети, кэш офлайн)
   - ассеты: stale-while-revalidate
   - при изменении sw.js (смените VERSION при релизе) все клиенты обновляются сами */

const VERSION = 'nova-strike-v1.2.2';
const SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icons/app-icon-512.png',
  './icons/app-icon-maskable.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(VERSION)
      .then((cache) => cache.addAll(SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Навигация (сама игра): сначала сеть, при офлайне — кэш
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            const copy2 = res.clone();
            event.waitUntil(
              caches.open(VERSION).then((cache) => {
                cache.put(req, copy);
                cache.put('./index.html', copy2);
              }),
            );
          }
          return res;
        })
        .catch(() =>
          caches
            .match(req)
            .then((hit) => hit || caches.match('./index.html'))
            .then((hit) => hit || caches.match('./')),
        ),
    );
    return;
  }

  // Остальные GET (иконки, manifest): кэш мгновенно + фоновое обновление
  event.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            event.waitUntil(caches.open(VERSION).then((cache) => cache.put(req, copy)));
          }
          return res;
        })
        .catch(() => cached);
      return cached || network;
    }),
  );
});

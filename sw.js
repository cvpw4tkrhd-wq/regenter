// Service worker: appskalet och datan fungerar offline. Höj VERSION när du har laddat upp nya filer.
const VERSION = 'regenter-v8';
const BILDER = 'regenter-bilder';
const SKAL = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json',
  'icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'data/index.json', 'data/handelser.json', 'data/ordlista.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SKAL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION && k !== BILDER).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
async function swr(cacheName, req, okFn) {
  const c = await caches.open(cacheName);
  const hit = await c.match(req);
  const net = fetch(req).then(r => { if (okFn(r)) c.put(req, r.clone()); return r; }).catch(() => hit || (req.mode === 'navigate' ? c.match('index.html') : undefined));
  return hit || net;
}
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin === location.origin) e.respondWith(swr(VERSION, req, r => r.ok));
  else if (/wikimedia\.org$/.test(url.hostname)) e.respondWith(swr(BILDER, req, r => r.ok || r.type === 'opaque'));
});

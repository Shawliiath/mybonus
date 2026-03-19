const CACHE_NAME = 'mybonus-v3'
const STATIC_ASSETS = ['/', '/index.html', '/manifest.json', '/icon-192.png', '/icon-512.png', '/icon-512.svg', '/favicon.png']

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE_NAME).then(c => c.addAll(STATIC_ASSETS)))
  self.skipWaiting()
})
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))))
  self.clients.claim()
})
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url)
  if (url.hostname.includes('coingecko') || url.hostname.includes('firebase') || url.hostname.includes('googleapis') || url.hostname.includes('walletconnect')) return
  if (url.pathname.match(/\.(js|css|png|svg|ico|woff2?)$/) || url.pathname === '/' || url.pathname === '/index.html') {
    e.respondWith(caches.match(e.request).then(cached => cached || fetch(e.request).then(r => {
      if (r.ok) caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()))
      return r
    })))
    return
  }
  e.respondWith(fetch(e.request).catch(() => caches.match('/index.html')))
})

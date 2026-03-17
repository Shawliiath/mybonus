const CACHE_NAME = 'mybonus-v1'
const urlsToCache = [
  '/',
  '/index.html',
  '/favicon.svg',
  '/icons.svg'
]

// Installation du service worker
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  )
})

// Activation et nettoyage des anciens caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName)
          }
        })
      )
    }).then(() => self.clients.claim())
  )
})

// Stratégie: Network First, puis Cache (pour Firebase et API)
self.addEventListener('fetch', (event) => {
  // Ignorer les requêtes Firebase Auth et Firestore (toujours en ligne)
  if (event.request.url.includes('firebase') || 
      event.request.url.includes('firestore') ||
      event.request.url.includes('googleapis')) {
    return
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Clone la réponse pour la mettre en cache
        const responseToCache = response.clone()
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, responseToCache)
        })
        return response
      })
      .catch(() => {
        // Si offline, retourne depuis le cache
        return caches.match(event.request)
      })
  )
})

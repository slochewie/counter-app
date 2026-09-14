const CACHE_NAME = 'counter-app-v1'
const APP_SHELL = ['/', '/manifest.webmanifest', '/counter-icon.svg']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches
        .keys()
        .then((keys) =>
          Promise.all(
            keys
              .filter((key) => key !== CACHE_NAME)
              .map((key) => caches.delete(key)),
          ),
        ),
      self.clients.claim(),
    ]),
  )
})

self.addEventListener('fetch', (event) => {
  const request = event.request

  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  event.respondWith(
    fetch(request).catch(async () => {
      const cached = await caches.match(request)
      if (cached) return cached

      if (request.mode === 'navigate') {
        return caches.match('/')
      }

      throw new Error('Network unavailable and no cached response exists')
    }),
  )
})

self.addEventListener('push', (event) => {
  let payload = {}

  if (event.data) {
    try {
      payload = event.data.json()
    } catch {
      payload = { body: event.data.text() }
    }
  }

  const title = payload.title || 'NiteOwl.dev Counter'
  const options = {
    body: payload.body || 'Counter status changed.',
    icon: payload.icon || '/counter-icon.svg',
    badge: payload.badge || '/counter-icon.svg',
    tag: payload.tag,
    renotify: payload.renotify === true,
    data: {
      url: payload.url || '/',
      ...(payload.data || {}),
    },
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      typeof self.registration.setAppBadge === 'function' && payload.appBadge
        ? self.registration.setAppBadge(payload.appBadge)
        : Promise.resolve(),
    ]),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const target = new URL(event.notification.data?.url || '/', self.location.origin)

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const matchingClient = clients.find((client) => {
        try {
          return new URL(client.url).origin === target.origin
        } catch {
          return false
        }
      })

      if (matchingClient) {
        matchingClient.navigate(target.href)
        return matchingClient.focus()
      }

      return self.clients.openWindow(target.href)
    }),
  )
})

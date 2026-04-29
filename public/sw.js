// Tater Tracker — Service Worker
// Handles push notifications and notification clicks.

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', e => e.waitUntil(clients.claim()))

// ── Push handler ────────────────────────────────────────────────────────────
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data?.json() ?? {} } catch {}

  const title   = data.title ?? 'Tater Tracker'
  const options = {
    body:      data.body  ?? '',
    icon:      '/tater-icon.png',
    badge:     '/tater-icon.png',
    tag:       data.tag   ?? 'tater',
    renotify:  !!data.tag,
    data:      { url: data.url ?? '/' },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

// ── Notification click ──────────────────────────────────────────────────────
self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/'
  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then(list => {
        for (const client of list) {
          if ('focus' in client) return client.focus()
        }
        return clients.openWindow(url)
      })
  )
})

const CACHE_NAME = 'ashpazkhane-v7';
const STATIC_CACHE = 'ashpazkhane-static-v6';

const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE)
          .map((name) => caches.delete(name))
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch event - network first, fallback to cache
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          // Return offline page for navigation requests
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
          return new Response('Offline', { status: 503 });
        });
      })
  );
});

// Background sync for reminders
self.addEventListener('sync', (event) => {
  if (event.tag === 'reminder-sync') {
    event.waitUntil(syncReminders());
  }
});

async function syncReminders() {
  // Placeholder for reminder sync logic
  console.log('Syncing reminders...');
}

// Push notifications, sent by the Lamoo server (see server/src/notify.ts).
self.addEventListener('push', (event) => {
  // A payload that is not our JSON must still show something rather than
  // throwing, or the browser shows its own "site updated in the background".
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'لامو';
  const options = {
    body: data.body || 'یادآوری جدید دارید',
    // Relative, because the app is served from a sub-path on GitHub Pages.
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    dir: 'rtl',
    lang: 'fa',
    vibrate: [200, 100, 200],
    // The server's tag, so a second warning about the same item replaces the
    // first instead of stacking up.
    tag: data.tag || undefined,
    data: data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  // Focus the tab that is already open before opening another one.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('./');
    })
  );
});

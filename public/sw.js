// The cache name will be dynamically overwritten during build, but fallback for dev
const BUILD_ID = self.BUILD_ID || new Date().getTime().toString();
const CACHE_NAME = \`hse-static-\${BUILD_ID}\`;

const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/assets/aistudio/ChatGPT_Image_Oct_8__2026__12_04_00_PM_42699341.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use no-cache to force network fetch when caching
      const requests = URLS_TO_CACHE.map(url => new Request(url, { cache: 'no-cache' }));
      return cache.addAll(requests);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[ServiceWorker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NEVER cache APIs or WebSocket connections
  if (
    url.pathname.startsWith('/api/') || 
    url.pathname.startsWith('/socket.io/') ||
    event.request.method !== 'GET'
  ) {
    return; // Pass through directly to network
  }

  // 2. NETWORK-FIRST for HTML and core shell to guarantee updates
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 3. CACHE-FIRST for Immutable Hashed Assets (JS/CSS in /assets/)
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((response) => {
          // Clone and cache the new asset
          if (response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. Default: Network First
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

// 5. Web Push & Background Emergency Alert Notification Handlers
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: 'هشدار فوری HSECORE',
      body: event.data ? event.data.text() : 'هشدار فوری اضطراری در سامانه ثبت گردید.',
    };
  }

  const title = data.title || 'هشدار فوری سامانه HSE';
  const options = {
    body: data.body || 'دستورالعمل‌های ایمنی و تخلیه را فوراً بررسی فرمایید.',
    icon: '/assets/aistudio/ChatGPT_Image_Oct_8__2026__12_04_00_PM_42699341.png',
    badge: '/assets/aistudio/ChatGPT_Image_Oct_8__2026__12_04_00_PM_42699341.png',
    tag: data.notifId || 'hse-emergency-alert',
    renotify: true,
    requireInteraction: true,
    vibrate: [300, 100, 300, 100, 300],
    data: {
      url: data.actionUrl || '/',
      notifId: data.notifId,
    },
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const urlToOpen = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(urlToOpen);
      }
    })
  );
});


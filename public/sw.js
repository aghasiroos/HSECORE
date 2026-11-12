// HSECORE Service Worker — Native System Notifications, Lock Screen Push, & Offline Shell
const BUILD_ID = self.BUILD_ID || 'v2-hsecore-push';
const CACHE_NAME = `hse-static-${BUILD_ID}`;

const URLS_TO_CACHE = [
  '/',
  '/index.html',
  '/assets/hsecore-icon-192.png',
  '/assets/hsecore-icon-512.png',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      const requests = URLS_TO_CACHE.map((url) => new Request(url, { cache: 'no-cache' }));
      return cache.addAll(requests).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) =>
      Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. NEVER cache APIs, WebSockets, SSE streams, or Vite dev modules
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/socket.io/') ||
    url.pathname.startsWith('/src/') ||
    url.pathname.startsWith('/@vite') ||
    url.pathname.startsWith('/@id') ||
    url.pathname.startsWith('/@fs') ||
    url.pathname.startsWith('/node_modules/') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // 2. NETWORK-FIRST for HTML navigation
  if (event.request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(fetch(event.request).catch(() => caches.match('/index.html')));
    return;
  }

  // 3. CACHE-FIRST for static production assets in /assets/
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) return cachedResponse;
        return fetch(event.request).then((response) => {
          if (response && response.status === 200) {
            const responseToCache = response.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache).catch(() => {});
            });
          }
          return response;
        });
      })
    );
    return;
  }

  // 4. Default: Network First
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});

/**
 * Helper to format rich Persian lock-screen notification body with Risk Level, Time, and Required Action
 */
function buildSystemNotificationPayload(data) {
  const notifId = data.notifId || `hse-emergency-${Date.now()}`;
  const isCritical = data.category === 'critical_hse' || data.priority === 'critical';
  const riskLabel =
    data.riskLevelFa ||
    (isCritical
      ? 'بحرانی و اضطراری (سطح ۱)'
      : data.priority === 'high'
      ? 'فوری و پرخطر (سطح ۲)'
      : 'هشدار ایمنی (سطح ۳)');

  let formattedTime = '';
  try {
    const dt = data.createdAt ? new Date(data.createdAt) : new Date();
    formattedTime = dt.toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    formattedTime = '';
  }

  const rawBody = data.body || 'دستورالعمل‌های ایمنی و تخلیه را فوراً بررسی فرمایید.';
  const actionGuidelines = data.actionGuidelines || rawBody;

  const lines = [
    `⚠️ سطح خطر: ${riskLabel}${formattedTime ? ` | 🕒 انتشار: ${formattedTime}` : ''}`,
    `📋 شرح هشدار: ${rawBody}`,
  ];
  if (actionGuidelines && actionGuidelines !== rawBody) {
    lines.push(`🛡️ اقدام ضروری: ${actionGuidelines}`);
  } else {
    lines.push(`🛡️ اقدام ضروری: رعایت فوری پروتکل ایمنی و ثبت تأیید دریافت هشدار`);
  }

  const title = data.title
    ? (isCritical && !data.title.includes('🚨') ? `🚨 ${data.title}` : data.title)
    : '🚨 هشدار فوری سامانه HSECORE';

  const options = {
    body: lines.join('\n'),
    icon: '/assets/hsecore-icon-192.png',
    badge: '/assets/hsecore-icon-192.png',
    dir: 'rtl',
    lang: 'fa',
    tag: notifId,
    renotify: true,
    requireInteraction: true,
    silent: false,
    timestamp: data.createdAt ? new Date(data.createdAt).getTime() : Date.now(),
    vibrate: isCritical
      ? [500, 150, 500, 150, 500, 150, 800, 200, 800]
      : [300, 100, 300, 100, 400],
    actions: [
      {
        action: 'open',
        title: '🔍 مشاهده جزئیات هشدار در HSECORE',
      },
      {
        action: 'acknowledge',
        title: '✅ تأیید دریافت هشدار و قطع آژیر',
      },
    ],
    data: {
      url:
        data.actionUrl && String(data.actionUrl).includes('alertId=')
          ? data.actionUrl
          : `/#notifications?alertId=${encodeURIComponent(notifId)}`,
      notifId,
      title: data.title || title,
      body: rawBody,
      category: data.category || 'critical_hse',
      priority: data.priority || 'critical',
      riskLevelFa: riskLabel,
      sirenType: data.sirenType || 'siren_evacuation',
      actionGuidelines,
      requiresAck: data.requiresAck !== false,
      createdAt: data.createdAt || new Date().toISOString(),
    },
  };

  return { title, options, notifData: options.data };
}

const recentlyShownSwNotifs = new Map();

function shouldShowSwNotification(notifId) {
  if (!notifId) return true;
  const key = String(notifId);
  const now = Date.now();
  const prev = recentlyShownSwNotifs.get(key);
  if (prev && now - prev < 15000) {
    return false;
  }
  recentlyShownSwNotifs.set(key, now);
  if (recentlyShownSwNotifs.size > 100) {
    for (const [k, ts] of recentlyShownSwNotifs.entries()) {
      if (now - ts > 60000) recentlyShownSwNotifs.delete(k);
    }
  }
  return true;
}

async function dispatchSwNotification(rawData, notifyWindowClients) {
  const { title, options, notifData } = buildSystemNotificationPayload(rawData);
  const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

  if (notifyWindowClients) {
    for (const client of windowClients) {
      client.postMessage({
        type: 'HSE_SW_EMERGENCY_PUSH',
        payload: notifData,
      });
    }
  }

  if (!shouldShowSwNotification(notifData.notifId)) {
    return;
  }

  // If any HSECORE window is actively visible in foreground, it is already playing the HSE siren;
  // silence the OS default chime so it never clashes with the emergency siren, while still showing the native OS banner.
  const hasVisibleForegroundClient = windowClients.some(
    (c) => c.visibilityState === 'visible' || c.focused === true
  );
  if (hasVisibleForegroundClient) {
    options.silent = true;
    options.renotify = false;
  }

  await self.registration.showNotification(title, options);
}

// 5. Web Push Event Handler (Receives RFC 8030 encrypted push even when tab is closed, in background, or lock screen)
self.addEventListener('push', (event) => {
  let rawData = {};
  try {
    rawData = event.data ? event.data.json() : {};
  } catch {
    rawData = {
      title: '🚨 هشدار فوری HSECORE',
      body: event.data ? event.data.text() : 'هشدار فوری اضطراری در سامانه ثبت گردید.',
      category: 'critical_hse',
      priority: 'critical',
      requiresAck: true,
    };
  }

  event.waitUntil(dispatchSwNotification(rawData, true));
});

// 6. Client Message Bridge (Allows foreground/background WebSocket/SSE to trigger or close native OS notifications)
self.addEventListener('message', (event) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'SHOW_HSE_SYSTEM_NOTIFICATION' && msg.payload) {
    event.waitUntil(dispatchSwNotification(msg.payload, false));
  } else if (msg.type === 'CLOSE_HSE_SYSTEM_NOTIFICATION' && msg.notifId) {
    event.waitUntil(
      self.registration.getNotifications({ tag: String(msg.notifId) }).then((notifs) => {
        for (const n of notifs) {
          n.close();
        }
      })
    );
  }
});

// 7. OS Notification & Lock Screen Action Button Handler
self.addEventListener('notificationclick', (event) => {
  const notification = event.notification;
  const notifData = notification.data || {};
  const notifId = notifData.notifId;
  const action = event.action;

  notification.close();

  if (action === 'acknowledge' && notifId) {
    // 1. Immediately instruct all open client windows to stop siren and close popup for this user
    // 2. Persist view confirmation and acknowledgment in PostgreSQL database via public endpoints
    event.waitUntil(
      Promise.all([
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
          for (const client of windowClients) {
            client.postMessage({
              type: 'HSE_SW_EMERGENCY_ACKNOWLEDGED',
              notifId,
              timestamp: new Date().toISOString(),
            });
          }
        }),
        fetch('/api/v1/notifications/public/view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notifId,
            clientSessionId: 'sw_os_notification',
            source: 'browser_push_click',
          }),
        }).catch(() => {}),
        fetch('/api/v1/notifications/public/acknowledge', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            notifId,
            clientSessionId: 'sw_os_notification',
            acknowledgmentSource: 'os_notification_action',
            note: 'تأیید دریافت هشدار و توقف آژیر از طریق اعلان سیستمی مرورگر / صفحه قفل',
          }),
        }).catch(() => {}),
      ])
    );
    return;
  }

  // Default click or 'open' action: Record view confirmation, focus existing window or open HSECORE directly to the Alert Details page
  const deepLinkUrl =
    notifData.url ||
    (notifId ? `/#notifications?alertId=${encodeURIComponent(notifId)}` : '/#notifications');

  event.waitUntil(
    Promise.all([
      notifId
        ? fetch('/api/v1/notifications/public/view', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notifId,
              clientSessionId: 'sw_os_notification',
              source: 'browser_push_click',
            }),
          }).catch(() => {})
        : Promise.resolve(),
      self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (windowClients) => {
        for (const client of windowClients) {
          client.postMessage({
            type: 'HSE_SW_EMERGENCY_OPENED',
            payload: notifData,
            openDetails: true,
            deepLinkUrl,
          });
        }
        for (const client of windowClients) {
          if (client.url && 'focus' in client) {
            try {
              if ('navigate' in client && deepLinkUrl.startsWith('/#')) {
                // Hash navigation is handled by HSE_SW_EMERGENCY_OPENED message without full reload
              }
            } catch {}
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(deepLinkUrl);
        }
      }),
    ])
  );
});

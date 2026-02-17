/* LifeSync Service Worker
   - Handles Push Notifications (Variant A)

   This SW shows notifications from:
   1) Real Push messages (event: 'push')
   2) Local test messages from the app (event: 'message')
*/

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

function normalizePayload(raw) {
  // Expected push payload JSON:
  // { "title": "Reminder", "body": "...", "url": "habits.html" }
  const p = raw && typeof raw === 'object' ? raw : {};
  return {
    title: p.title || 'Habits reminder',
    body: p.body || "You're below your daily target — open Habits to finish up.",
    url: p.url || 'habits.html',
    tag: p.tag || 'habits-reminder'
  };
}

async function show(payload) {
  const p = normalizePayload(payload);
  await self.registration.showNotification(p.title, {
    body: p.body,
    tag: p.tag,
    renotify: false,
    icon: 'favicon.ico',
    badge: 'favicon.ico',
    data: { url: p.url }
  });
}

self.addEventListener('push', (event) => {
  event.waitUntil((async () => {
    let payload = {};
    try {
      payload = event.data ? event.data.json() : {};
    } catch {
      try {
        payload = { body: event.data ? await event.data.text() : '' };
      } catch {
        payload = {};
      }
    }
    await show(payload);
  })());
});

self.addEventListener('message', (event) => {
  const msg = event.data || {};
  if (msg && msg.type === 'TEST_NOTIFICATION') {
    event.waitUntil(show(msg.payload || {
      title: 'Notifications enabled ✅',
      body: 'You will get reminders in background once the server is connected.'
    }));
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) ? event.notification.data.url : 'habits.html';
  event.waitUntil((async () => {
    const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of allClients) {
      if (client.url && client.url.includes(url)) {
        await client.focus();
        return;
      }
    }
    await self.clients.openWindow(url);
  })());
});

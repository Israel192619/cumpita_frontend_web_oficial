/* Web Push visible solo cuando la pantalla correspondiente no está al frente. */
self.addEventListener('push', event => {
  let payload;
  try { payload = event.data?.json(); } catch { return; }
  const notification = payload?.tonitoNotification;
  if (!notification) return;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const targetVisible = windows.some(client => {
      if (client.visibilityState !== 'visible') return false;
      try { return new URL(client.url).pathname.startsWith(notification.matchPath); }
      catch { return false; }
    });
    if (targetVisible) return;

    await self.registration.showNotification(notification.title, {
      body: notification.body,
      icon: notification.icon,
      badge: notification.badge,
      tag: notification.tag,
      renotify: notification.renotify,
      requireInteraction: notification.requireInteraction,
      silent: notification.silent,
      vibrate: notification.vibrate,
      data: { tonito: true, url: notification.url, ordenId: notification.ordenId },
    });
  })());
});

self.addEventListener('notificationclick', event => {
  const data = event.notification?.data;
  if (!data?.tonito || !data.url) return;
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil((async () => {
    const absoluteUrl = new URL(data.url, self.location.origin).href;
    const targetPath = new URL(absoluteUrl).pathname;
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = windows.find(client => {
      try { return new URL(client.url).pathname.startsWith(targetPath); }
      catch { return false; }
    });
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) await existing.navigate(absoluteUrl);
      return;
    }
    await self.clients.openWindow(absoluteUrl);
  })());
});

importScripts('./ngsw-worker.js');

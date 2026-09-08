/* Lutes Pick 'Em service worker: receives pick-reminder pushes. */

self.addEventListener('push', (event) => {
  let payload = { title: "Lutes Pick 'Em", body: 'Make your picks!', url: './' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch (e) {
    /* default payload */
  }
  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: 'plu-logo.png',
      badge: 'favicon-plu.png',
      data: { url: payload.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || './';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
      for (const win of wins) {
        if ('focus' in win) return win.focus();
      }
      return clients.openWindow(url);
    })
  );
});

'use strict';
// sw.js — Service Worker: recebe push notifications e trata cliques.
// Vite copia frontend/public/ verbatim para dist/ — este arquivo fica em /sw.js.

self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? { title: 'Alerta Floripa', body: 'Risco de alagamento na sua rota.' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      tag: data.tag || 'floripa-alerta',      // mesmo tag substitui em vez de empilhar
      requireInteraction: false,
      data: { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});

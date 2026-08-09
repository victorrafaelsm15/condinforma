// Service worker próprio (estratégia injectManifest do vite-plugin-pwa) —
// precisa disso porque o modo "generateSW" (usado antes) não permite ouvir
// o evento "sync" da Background Sync API, que é o que sincroniza a fila
// offline de execuções/ocorrências em segundo plano, mesmo com o app
// fechado, assim que o navegador detecta conexão de volta.
//
// O restante do comportamento (precache do app shell, cache-first de
// fontes, network-first pros dados do Supabase) replica exatamente o que
// o generateSW fazia antes, só que escrito à mão.
import { precacheAndRoute, createHandlerBoundToURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { clientsClaim } from 'workbox-core';
import { syncQueue } from './lib/offlineQueue';

self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ url }) => url.hostname.endsWith('.supabase.co'),
  new NetworkFirst({
    cacheName: 'supabase-data',
    networkTimeoutSeconds: 6,
    plugins: [
      new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 3 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

registerRoute(
  ({ url }) => url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'google-fonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

registerRoute(new NavigationRoute(createHandlerBoundToURL('index.html')));

// Background Sync: registrado por item em offlineQueue.enqueue() (via
// reg.sync.register), disparado pelo navegador quando ele detecta conexão
// de volta — funciona mesmo com nenhuma aba do app aberta. Em navegadores
// sem suporte (Safari/iOS, Firefox), o fallback é o initAutoSync() do
// main.jsx (evento "online" + intervalo + sync ao abrir o app).
self.addEventListener('sync', (event) => {
  if (event.tag === 'cond-informa-sync-queue') {
    event.waitUntil(syncQueue());
  }
});

// Notificações push (Web Push API nativa) — o payload vem da Edge Function
// notify-ocorrencia (ver supabase/functions/_shared/pushNotify.ts), sempre
// como JSON { title, body, url }.
self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: 'Cond-Informa', body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Cond-Informa';
  const options = {
    body: data.body || '',
    icon: `${self.registration.scope}pwa-192x192.png`,
    badge: `${self.registration.scope}pwa-192x192.png`,
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

// Clicar na notificação foca uma aba já aberta do site (navegando pra
// página relevante) ou abre uma nova — nunca deixa a notificação "morta"
// sem levar a lugar nenhum.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetPath = event.notification.data?.url || '/';
  const targetUrl = `${self.registration.scope}#${targetPath}`;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const existing = clientsArr.find((c) => c.url.startsWith(self.registration.scope));
      if (existing) {
        return existing.focus().then(() => {
          if ('navigate' in existing) return existing.navigate(targetUrl);
          return undefined;
        });
      }
      return self.clients.openWindow(targetUrl);
    }),
  );
});

/* Service worker da Plataforma · Benfica Independente.
   Permite instalar como aplicação (PWA) e abrir sem internet.
   Vai sempre primeiro à internet (para apanhar logo as versões novas) e só usa
   a cópia guardada quando não há ligação. Nunca guarda pedidos ao GitHub. */
'use strict';

const CACHE = 'bi-plataforma-v12';
const FICHEIROS = ['./index.html', './estilos.css', './app.js', './quadro.js', './participacao.js', './jogadores.json', './icone.svg', './icone-192.png', './icone-512.png', './manifest.webmanifest'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHEIROS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys().then(nomes => Promise.all(nomes.filter(n => n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  if (url.hostname === 'api.github.com' || url.hostname.endsWith('githubusercontent.com')) return;
  if (ev.request.method !== 'GET' || url.origin !== location.origin) return;
  ev.respondWith(
    fetch(ev.request).then(resposta => {
      const copia = resposta.clone();
      caches.open(CACHE).then(c => c.put(ev.request, copia));
      return resposta;
    }).catch(() => caches.match(ev.request).then(g => g || caches.match('./index.html')))
  );
});

/* Service worker do BI Estúdio (publicada na raiz de benficaindependente.github.io).
   Vai sempre primeiro à internet (para apanhar logo as versões novas) e só usa a cópia guardada quando não há ligação.
   Usa o seu próprio nome de cache, para não mexer na cache da plataforma antiga. Nunca guarda pedidos ao GitHub. */
'use strict';

const CACHE = 'bi-estudio-v19';
const FICHEIROS = ['./index.html', './privacidade.html', './estilos.css', './app.js', './quadro.js', './participacao.js', './participantes.js', './estilo.js', './jogadores.json',
  './fontes/inter-latin.woff2', './fontes/inter-latin-ext.woff2', './icone.svg', './icone-192.png', './icone-512.png', './manifest.webmanifest'];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(CACHE).then(c => c.addAll(FICHEIROS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys().then(nomes => Promise.all(nomes.filter(n => n.startsWith('bi-estudio-') && n !== CACHE).map(n => caches.delete(n))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', ev => {
  const url = new URL(ev.request.url);
  if (url.hostname === 'api.github.com' || url.hostname.endsWith('githubusercontent.com')) return;
  if (ev.request.method !== 'GET' || url.origin !== location.origin) return;
  ev.respondWith(
    fetch(ev.request, { cache: 'no-store' }).then(resposta => {
      const copia = resposta.clone();
      caches.open(CACHE).then(c => c.put(ev.request, copia));
      return resposta;
    }).catch(() => caches.match(ev.request).then(g => g || caches.match('./index.html')))
  );
});

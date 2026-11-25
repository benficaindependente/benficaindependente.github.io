/* Service worker antigo: limpa a cache e desliga-se, para a pessoa ver sempre a plataforma atual. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', ev => {
  ev.waitUntil(
    caches.keys().then(n => Promise.all(n.map(c => caches.delete(c))))
      .then(() => self.registration.unregister())
      .then(() => self.clients.matchAll({ type: 'window' }))
      .then(cs => cs.forEach(c => { try { c.navigate(c.url); } catch (e) { /* ignora */ } }))
  );
});

const CACHE = 'debug-sw-v1';
self.__log = [];
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
function isStatic(url) {
  return url.pathname.startsWith('/_next/static') || url.pathname.startsWith('/icons') || /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname);
}
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const u = new URL(req.url);
  const path = u.pathname.slice(0, 50);
  const entry = req.method + ' mode=' + req.mode + ' ' + path;
  if (req.method !== 'GET') { self.__log.push(entry + ' skip:method'); return; }
  if (u.origin !== location.origin) { self.__log.push(entry + ' skip:origin'); return; }
  if (u.pathname.startsWith('/api/')) { self.__log.push(entry + ' skip:api'); return; }
  if (isStatic(u)) {
    self.__log.push(entry + ' -> cacheFirst');
    event.respondWith((async () => {
      const cached = await caches.match(req);
      if (cached) { self.__log.push('  cf-hit ' + path); return cached; }
      const res = await fetch(req);
      self.__log.push('  cf-fetch ' + path + ' -> ' + res.status + '/' + res.type);
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        try { await cache.put(req, res.clone()); self.__log.push('  cf-put(req) ok'); }
        catch (e1) {
          self.__log.push('  cf-put(req) ERR: ' + String(e1).slice(0, 90));
          try { await cache.put(req.url, res.clone()); self.__log.push('  cf-put(url) ok'); }
          catch (e2) { self.__log.push('  cf-put(url) ERR: ' + String(e2).slice(0, 90)); }
        }
      }
      return res;
    })());
  } else if (req.mode === 'navigate') {
    self.__log.push(entry + ' -> networkFirst');
    event.respondWith((async () => {
      const res = await fetch(req);
      const res2 = await fetch('/admin');
      self.__log.push('  nf-fetch(req) ' + path + ' -> ' + res.status + '/' + res.type + ' | fetch(url) -> ' + res2.status + '/' + res2.type);
      if (res && res.ok) {
        const cache = await caches.open(CACHE);
        try { await cache.put(req, res.clone()); self.__log.push('  nf-put(req) ok'); }
        catch (e1) {
          self.__log.push('  nf-put(req) ERR: ' + String(e1).slice(0, 90));
          try { await cache.put(req.url, res.clone()); self.__log.push('  nf-put(url) ok'); }
          catch (e2) { self.__log.push('  nf-put(url) ERR: ' + String(e2).slice(0, 90)); }
        }
      } else {
        self.__log.push('  nf-skip-put (not ok)');
      }
      return res;
    })());
  } else {
    self.__log.push(entry + ' skip:other-mode');
  }
});

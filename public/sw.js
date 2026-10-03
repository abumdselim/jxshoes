/**
 * Shopkeeper service worker (v2 — অফলাইন-ফার্স্ট)
 * - স্ট্যাটিক অ্যাসেট ও R2 মিডিয়া (/api/media/*): cache-first
 * - পেজ নেভিগেশন: network-first, অফলাইনে ক্যাশ/শেল থেকে
 * - ইনস্টলে অ্যাডমিন + শপ শেল প্রিক্যাশ
 * - /api/ ডেটা ক্যাশ হয় না — সেটা apiFetch + IndexedDB মিরর সামলায় (অফলাইন রিড + সিঙ্ক)
 */
const CACHE = 'shopkeeper-shell-v2';
const PRECACHE_URLS = ['/', '/admin', '/shop'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.allSettled(PRECACHE_URLS.map((u) => cache.add(u))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isStatic(url) {
  return (
    url.pathname.startsWith('/_next/static') ||
    url.pathname.startsWith('/icons') ||
    /\.(png|jpg|jpeg|svg|webp|ico|woff2?)$/.test(url.pathname)
  );
}

async function cacheFirst(req) {
  const cached = await caches.match(req);
  if (cached) return cached;
  const res = await fetch(req);
  if (res && res.ok) {
    const cache = await caches.open(CACHE);
    cache.put(req, res.clone());
  }
  return res;
}

async function networkFirst(req) {
  try {
    const res = await fetch(req);
    if (res && res.ok) {
      const cache = await caches.open(CACHE);
      cache.put(req, res.clone());
    }
    return res;
  } catch (err) {
    const cached = await caches.match(req);
    if (cached) return cached;
    const shell = await caches.match('/admin');
    if (shell) return shell;
    return new Response('অফলাইন — ইন্টারনেট সংযোগ দেখুন', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // R2 মিডিয়া ইমেজ — immutable, cache-first
  if (url.pathname.startsWith('/api/media/')) {
    event.respondWith(cacheFirst(req));
    return;
  }
  // বাকি /api/ ডেটা ক্যাশ হয় না — apiFetch + মিররের দায়িত্ব
  if (url.pathname.startsWith('/api/')) return;
  if (isStatic(url)) {
    event.respondWith(cacheFirst(req));
  } else if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
  }
});

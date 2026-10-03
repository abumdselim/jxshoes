/**
 * Shopkeeper service worker (v3 — অফলাইন-ফার্স্ট, পূর্ণ প্রিক্যাশ)
 * - ইনস্টলে সব মূল পেজ (অ্যাডমিন ১৪ + শপ) প্রিক্যাশ — HTML সহ তাদের
 *   /_next/static চাংক-সেটও (নইলে অফলাইনে HTML এলেও JS ছাড়া ফাঁকা পেজ)
 * - স্ট্যাটিক অ্যাসেট ও R2 মিডিয়া (/api/media/*): cache-first
 * - পেজ নেভিগেশন: network-first, অফলাইনে ক্যাশ/শেল থেকে
 * - /api/ ডেটা ক্যাশ হয় না — সেটা apiFetch + IndexedDB মিরর সামলায়
 */
const CACHE = 'shopkeeper-shell-v3';
const PRECACHE_PAGES = [
  '/',
  '/shop',
  '/admin',
  '/admin/assistant',
  '/admin/inventory',
  '/admin/products',
  '/admin/categories',
  '/admin/orders',
  '/admin/notifications',
  '/admin/customers',
  '/admin/expenses',
  '/admin/finance',
  '/admin/reports',
  '/admin/gallery',
  '/admin/settings',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // প্রতিটা পেজের HTML + তার রেফারেন্স করা /_next/static চাংক/সিএসএস
      await Promise.allSettled(PRECACHE_PAGES.map((u) => precachePage(cache, u)));
      await self.skipWaiting();
    })()
  );
});

/** পেজ HTML ক্যাশ করে + তার ভেতরের স্ট্যাটিক-অ্যাসেট URL গুলোও ক্যাশ করে */
async function precachePage(cache, url) {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res || !res.ok) return;
    await cache.put(url, res.clone());
    const html = await res.text();
    const assets = [...html.matchAll(/(?:src|href)="(\/_next\/[^"]+)"/g)].map(
      (m) => m[1]
    );
    await Promise.allSettled(
      [...new Set(assets)].map((a) =>
        cache.add(a).catch(() => {}) /* প্রতিটা চাংক ঐচ্ছিক */
      )
    );
  } catch {
    /* একটা পেজ প্রিক্যাশ ব্যর্থ হলে বাকিগুলো চলবে */
  }
}

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

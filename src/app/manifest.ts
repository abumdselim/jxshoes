import type { MetadataRoute } from 'next';

/** PWA manifest — অ্যাডমিন প্যানেল ইনস্টলযোগ্য অ্যাপ হিসেবে চলে */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Shopkeeper Admin',
    short_name: 'Shopkeeper',
    description: 'দোকানের সম্পূর্ণ ম্যানেজমেন্ট প্যানেল — অর্ডার, ইনভেন্টরি, হিসাব ও AI সহকারী',
    start_url: '/admin',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f172a',
    theme_color: '#ea580c',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { src: '/icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}

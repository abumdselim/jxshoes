'use client';

import React, { useState, useEffect } from 'react';
import { Home, Grid, PhoneCall } from 'lucide-react';
import CartIcon from '@/components/CartIcon';
import { useCart } from '@/context/CartContext';
import { usePathname } from 'next/navigation';
import { initialStoreSettings } from '@/lib/initialData';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { totalItems, setIsCartOpen } = useCart();
  const [hotline, setHotline] = useState(initialStoreSettings.hotline || '01712-345678');

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.hotline) setHotline(data.hotline);
      })
      .catch(() => {});
  }, []);

  // If in admin dashboard, product detail (which has its own sticky CTA), or checkout, hide bottom nav
  const isAdmin = pathname.startsWith('/admin');
  const isProduct = pathname.startsWith('/product');
  const isCheckout = pathname.startsWith('/checkout');

  if (isAdmin || isProduct || isCheckout) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 z-40 py-2 px-3 shadow-[0_-4px_20px_rgba(0,0,0,0.06)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Home */}
        <a
          href="/"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            pathname === '/' ? 'text-orange-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">হোম</span>
        </a>

        {/* Collections */}
        <a
          href="/#catalog"
          className="flex flex-col items-center gap-1 py-1 px-3 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <Grid className="w-5 h-5" />
          <span className="text-[10px]">কালেকশন</span>
        </a>

        {/* Cart Trigger */}
        <button
          onClick={() => setIsCartOpen(true)}
          className="relative flex flex-col items-center gap-1 py-0.5 px-3 group"
          aria-label="কার্ট"
        >
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-orange-600 text-white shadow-md shadow-orange-600/30 group-hover:bg-orange-700 group-hover:scale-105 transition-all">
            <CartIcon className="w-4 h-4 text-white group-hover:scale-110 transition-transform" />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-slate-900 text-white text-[9px] font-black rounded-full flex items-center justify-center border-2 border-white shadow-xs animate-bounce">
                {totalItems}
              </span>
            )}
          </div>
          <span className="text-[10px] font-bold text-orange-600">কার্ট</span>
        </button>

        {/* Hotline Link */}
        <a
          href={`tel:${hotline}`}
          className="flex flex-col items-center gap-1 py-1 px-3 text-slate-500 hover:text-orange-600 transition-colors"
          title={`হটলাইন: ${hotline}`}
        >
          <PhoneCall className="w-5 h-5 text-slate-600" />
          <span className="text-[10px]">হটলাইন</span>
        </a>
      </div>
    </div>
  );
}

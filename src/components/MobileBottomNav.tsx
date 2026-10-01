'use client';

import React from 'react';
import { Home, Grid, ShoppingBag, ShieldCheck } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { usePathname } from 'next/navigation';

export default function MobileBottomNav() {
  const pathname = usePathname();
  const { totalItems, setIsCartOpen } = useCart();

  // If in admin dashboard, product detail (which has its own sticky CTA), or checkout, hide bottom nav
  const isAdmin = pathname.startsWith('/admin');
  const isProduct = pathname.startsWith('/product');
  const isCheckout = pathname.startsWith('/checkout');

  if (isAdmin || isProduct || isCheckout) return null;

  return (
    <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-lg border-t border-slate-200 z-40 py-2 px-4 shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
      <div className="flex items-center justify-around max-w-md mx-auto">
        <a
          href="/"
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition-colors ${
            pathname === '/' ? 'text-orange-600 font-bold' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Home className="w-5 h-5" />
          <span className="text-[10px]">হোম</span>
        </a>

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
          className="relative flex flex-col items-center gap-1 py-1 px-3 text-slate-500 hover:text-slate-800 transition-colors"
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5 text-orange-600" />
            {totalItems > 0 && (
              <span className="absolute -top-1.5 -right-2 w-4 h-4 bg-orange-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-bounce">
                {totalItems}
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-700 font-semibold">ব্যাগ ({totalItems})</span>
        </button>

        {/* Admin Link */}
        <a
          href="/admin"
          className="flex flex-col items-center gap-1 py-1 px-3 text-slate-500 hover:text-orange-600 transition-colors"
        >
          <ShieldCheck className="w-5 h-5 text-orange-600" />
          <span className="text-[10px]">এডমিন</span>
        </a>
      </div>
    </div>
  );
}

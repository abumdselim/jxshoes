'use client';

import React, { useState, useEffect } from 'react';
import { Home, LayoutGrid, Search, Headphones, X, ArrowRight, Sparkles, ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { usePathname, useRouter } from 'next/navigation';
import { initialStoreSettings } from '@/lib/initialData';

const POPULAR_SEARCH_TAGS = [
  'লোফার জুতা',
  'অক্সফোর্ড জুতা',
  'স্নিকার্স',
  'লেডিস হ্যান্ডব্যাগ',
  'ব্যাকপ্যাক',
  'লেদার ওয়ালেট',
];

export default function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { totalItems, setIsCartOpen } = useCart();
  const [hotline, setHotline] = useState(initialStoreSettings.hotline || '01712-345678');
  const [isSearchModalOpen, setIsSearchModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetch('/api/settings')
      .then((res) => res.json())
      .then((data) => {
        if (data?.hotline) setHotline(data.hotline);
      })
      .catch(() => {});
  }, []);

  const handleSearchSubmit = (keyword?: string) => {
    const q = (keyword !== undefined ? keyword : searchQuery).trim();
    if (q) {
      router.push(`/shop?q=${encodeURIComponent(q)}`);
    } else {
      router.push('/shop');
    }
    setIsSearchModalOpen(false);
    setSearchQuery('');
  };

  // On the marketing landing page, admin dashboard, product detail (which has its own sticky CTA), or checkout, hide bottom nav
  const isLanding = pathname === '/';
  const isAdmin = pathname.startsWith('/admin');
  const isProduct = pathname.startsWith('/product');
  const isCheckout = pathname.startsWith('/checkout');

  if (isLanding || isAdmin || isProduct || isCheckout) return null;

  return (
    <>
      {/* Mobile Instant Search Modal */}
      {isSearchModalOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex flex-col justify-end animate-in fade-in duration-200">
          <div
            className="flex-1"
            onClick={() => setIsSearchModalOpen(false)}
            aria-label="Close search"
          />
          <div className="bg-white rounded-t-3xl p-5 shadow-2xl border-t border-slate-200 animate-in slide-in-from-bottom duration-300 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm">
                <Search className="w-4 h-4 text-orange-600" />
                <span>পণ্য অনুসন্ধান করুন</span>
              </div>
              <button
                onClick={() => setIsSearchModalOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Search Input */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSearchSubmit();
              }}
              className="relative"
            >
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="যেমন: লেদার লোফার, স্নিকার্স বা হ্যান্ডব্যাগ..."
                className="w-full bg-slate-100 text-slate-900 text-sm rounded-2xl pl-11 pr-24 py-3.5 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:bg-white border border-transparent focus:border-orange-500 transition-all font-sans"
              />
              <Search className="w-5 h-5 text-slate-400 absolute left-3.5 top-3.5" />
              <button
                type="submit"
                className="absolute right-2 top-2 px-3.5 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold rounded-xl shadow-xs transition-colors"
              >
                খুঁজুন
              </button>
            </form>

            {/* Popular Search Suggestions */}
            <div>
              <div className="text-xs font-bold text-slate-500 mb-2 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                <span>জনপ্রিয় সার্চসমূহ:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {POPULAR_SEARCH_TAGS.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => handleSearchSubmit(tag)}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-orange-50 hover:text-orange-600 text-slate-700 border border-slate-200/80 transition-all flex items-center gap-1.5"
                  >
                    <span>{tag}</span>
                    <ArrowRight className="w-3 h-3 text-slate-400" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modern 5-Tab Functional Mobile Bottom Bar */}
      <nav
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-xl border-t border-slate-200/90 z-40 py-1.5 px-2 shadow-[0_-4px_25px_rgba(0,0,0,0.06)]"
      >
        <div className="grid grid-cols-5 items-center max-w-md mx-auto">
          {/* Tab 1: Home */}
          <a
            href="/shop"
            className={`flex flex-col items-center justify-center gap-1 py-1 rounded-xl transition-all relative ${
              pathname === '/'
                ? 'text-orange-600 font-extrabold'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {pathname === '/' && (
              <span className="absolute -top-1.5 w-1.5 h-1.5 rounded-full bg-orange-600 animate-pulse" />
            )}
            <Home className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">হোম</span>
          </a>

          {/* Tab 2: Collections / Catalog */}
          <a
            href="/shop#catalog"
            className="flex flex-col items-center justify-center gap-1 py-1 rounded-xl text-slate-500 hover:text-orange-600 transition-colors"
          >
            <LayoutGrid className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">কালেকশন</span>
          </a>

          {/* Tab 3: Search (Interactive product finder) */}
          <button
            onClick={() => setIsSearchModalOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-1 rounded-xl text-slate-500 hover:text-orange-600 transition-colors"
            aria-label="সার্চ করুন"
          >
            <Search className="w-5 h-5" />
            <span className="text-[10px] tracking-tight">খুঁজুন</span>
          </button>

          {/* Tab 4: Cart */}
          <button
            onClick={() => setIsCartOpen(true)}
            className="flex flex-col items-center justify-center gap-1 py-1 rounded-xl text-slate-500 hover:text-orange-600 transition-colors relative group"
            aria-label="কার্ট"
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5 text-slate-600 group-hover:text-orange-600 transition-colors" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[18px] h-[18px] px-1 bg-orange-600 text-white text-[9px] font-black rounded-full flex items-center justify-center shadow-xs animate-bounce">
                  {totalItems}
                </span>
              )}
            </div>
            <span className="text-[10px] tracking-tight font-medium text-slate-600 group-hover:text-orange-600">কার্ট</span>
          </button>

          {/* Tab 5: Customer Support Hotline */}
          <a
            href={`tel:${hotline}`}
            className="flex flex-col items-center justify-center gap-1 py-1 rounded-xl text-slate-500 hover:text-orange-600 transition-colors"
            title={`সহায়তা ও অর্ডার: ${hotline}`}
          >
            <Headphones className="w-5 h-5 text-slate-600 group-hover:text-orange-600" />
            <span className="text-[10px] tracking-tight">সহায়তা</span>
          </a>
        </div>
      </nav>
    </>
  );
}

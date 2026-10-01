'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Menu, X, ArrowRight, PhoneCall } from 'lucide-react';
import CartIcon from '@/components/CartIcon';
import { useCart } from '@/context/CartContext';
import { StoreSettings } from '@/types';
import { initialStoreSettings } from '@/lib/initialData';

export default function Navbar() {
  const router = useRouter();
  const { totalItems, setIsCartOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [settings, setSettings] = useState<StoreSettings>(initialStoreSettings);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setSearchQuery(params.get('q') || '');
    }

    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) setSettings(await res.json());
      } catch (e) {
        // fallback
      }
    }
    loadSettings();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      router.push(`/?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/');
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm shadow-slate-900/5 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 group">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-orange-600 flex items-center justify-center text-white font-extrabold text-xl sm:text-2xl shadow-md group-hover:scale-105 transition-transform">
              JX
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none">
                {settings.storeName || 'JxShoes'}<span className="text-orange-600">.</span>
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-widest uppercase font-semibold text-slate-500 mt-0.5 sm:mt-1 truncate max-w-[130px] sm:max-w-none">
                {settings.tagline || 'Footwear & Bags'}
              </span>
            </div>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 font-medium text-slate-700">
            <a href="/" className="hover:text-orange-600 transition-colors">হোম</a>
            <a href="/?category=shoes" className="hover:text-orange-600 transition-colors">জুতা (Shoes)</a>
            <a href="/?category=bags" className="hover:text-orange-600 transition-colors">ব্যাগ (Bags)</a>
          </nav>

          {/* Search bar */}
          <form onSubmit={handleSearch} className="hidden lg:flex items-center relative flex-1 max-w-xs">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="জুতা বা ব্যাগ খুঁজুন..."
              className="w-full bg-slate-100 text-slate-800 text-sm rounded-full pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white border border-transparent focus:border-orange-500 transition-all font-sans"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5" />
          </form>

          {/* Actions: Mobile Menu Toggle & Cart Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              aria-label="মেনু খুলুন"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Cart Button (Always positioned at the far right corner for mobile thumb reach) */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-orange-600 hover:bg-orange-700 text-white transition-all shadow-md shadow-orange-600/30 hover:shadow-lg hover:shadow-orange-600/40 hover:scale-105 active:scale-95 group"
              aria-label="কার্ট দেখুন"
            >
              <CartIcon className="w-5 h-5 text-white group-hover:scale-110 transition-transform" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 bg-slate-900 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md border-2 border-white animate-pulse">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile dropdown */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 py-4 px-2 space-y-3">
            <form onSubmit={handleSearch} className="relative mb-3">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="প্রোডাক্ট খুঁজুন..."
                className="w-full bg-slate-100 text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 font-sans"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </form>
            <div className="flex flex-col space-y-2 font-medium">
              <a href="/" className="px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-800">হোম (সব প্রোডাক্ট)</a>
              <a href="/?category=shoes" className="px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-800">জুতা (Shoes)</a>
              <a href="/?category=bags" className="px-3 py-2 rounded-lg hover:bg-slate-50 text-slate-800">ব্যাগ (Bags)</a>
              <a
                href={`tel:${settings.hotline || '01712-345678'}`}
                className="px-3 py-2.5 rounded-lg bg-orange-50 text-orange-600 font-bold flex items-center justify-between"
              >
                <span>হটলাইন: {settings.hotline || '01712-345678'}</span>
                <PhoneCall className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </header>

    {/* Spacer so page content begins neatly below the fixed navbar */}
    <div className="h-16 sm:h-20 flex-shrink-0" aria-hidden="true" />
  </>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Search, ShieldCheck, Menu, X, ArrowRight } from 'lucide-react';
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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200">
      {/* Top Banner (Admin Controlled) */}
      <div className="bg-slate-900 text-white text-xs py-2 px-4 text-center font-medium flex items-center justify-center gap-2">
        <span>{settings.announcementText || '⚡ ক্যাশ অন ডেলিভারি সুবিধা | সারা বাংলাদেশে দ্রুত হোম ডেলিভারি!'}</span>
        {settings.announcementSecondary && (
          <span className="hidden md:inline text-orange-400 font-semibold">{settings.announcementSecondary}</span>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20 gap-4">
          {/* Logo */}
          <a href="/" className="flex items-center gap-2.5 flex-shrink-0 group">
            <div className="w-11 h-11 rounded-xl bg-orange-600 flex items-center justify-center text-white font-extrabold text-2xl shadow-md group-hover:scale-105 transition-transform">
              JX
            </div>
            <div className="flex flex-col">
              <span className="text-2xl font-black tracking-tight text-slate-900 leading-none">
                {settings.storeName || 'JxShoes'}<span className="text-orange-600">.</span>
              </span>
              <span className="text-[10px] tracking-widest uppercase font-semibold text-slate-500 mt-1">
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

          {/* Actions: Admin & Cart */}
          <div className="flex items-center gap-3">
            {/* Quick Link to Admin Panel */}
            <a
              href="/admin"
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 transition-all shadow-sm"
              title="এডমিন প্যানেলে যান"
            >
              <ShieldCheck className="w-4 h-4 text-orange-600" />
              <span className="hidden sm:inline">Admin Panel</span>
            </a>

            {/* Cart Button */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center justify-center w-11 h-11 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-600 transition-colors"
              aria-label="View Cart"
            >
              <ShoppingBag className="w-5 h-5" />
              {totalItems > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-orange-600 text-white text-[11px] font-bold rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {totalItems}
                </span>
              )}
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:text-slate-900"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
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
              <a href="/admin" className="px-3 py-2 rounded-lg bg-orange-50 text-orange-600 font-semibold flex items-center justify-between">
                <span>এডমিন প্যানেল</span>
                <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}

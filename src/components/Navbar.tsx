'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Menu, X, ArrowRight, PhoneCall, Home, Footprints, ShoppingBag, Truck, Sparkles, ShoppingCart } from 'lucide-react';
import { useCart } from '@/context/CartContext';
import { StoreSettings } from '@/types';
import { initialStoreSettings } from '@/lib/initialData';

export default function Navbar() {
  const router = useRouter();
  const { totalItems, setIsCartOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
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
      router.push(`/shop?q=${encodeURIComponent(searchQuery.trim())}`);
    } else {
      router.push('/shop');
    }
  };

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/90 shadow-sm shadow-slate-900/5 transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20 gap-2 sm:gap-4">
          {/* Logo */}
          <a href="/shop" className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0 group">
            <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-xl bg-orange-600 flex items-center justify-center text-white font-extrabold text-xl sm:text-2xl shadow-md group-hover:scale-105 transition-transform">
              SK
            </div>
            <div className="flex flex-col">
              <span className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 leading-none">
                {settings.storeName || 'Shopkeeper'}<span className="text-orange-600">.</span>
              </span>
              <span className="text-[9px] sm:text-[10px] tracking-widest uppercase font-semibold text-slate-500 mt-0.5 sm:mt-1 truncate max-w-[130px] sm:max-w-none">
                {settings.tagline || 'Footwear & Bags'}
              </span>
            </div>
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden md:flex items-center gap-8 font-medium text-slate-700">
            <a href="/shop" className="hover:text-orange-600 transition-colors">হোম</a>
            <a href="/shop?category=shoes" className="hover:text-orange-600 transition-colors">জুতা (Shoes)</a>
            <a href="/shop?category=bags" className="hover:text-orange-600 transition-colors">ব্যাগ (Bags)</a>
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

          {/* Actions: Mobile Search, Menu Toggle & Cart Button */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* Quick Search Toggle for Mobile */}
            <button
              onClick={() => {
                setMobileSearchOpen(!mobileSearchOpen);
                if (mobileMenuOpen) setMobileMenuOpen(false);
              }}
              className="lg:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              aria-label="সার্চ করুন"
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Mobile menu toggle */}
            <button
              onClick={() => {
                setMobileMenuOpen(!mobileMenuOpen);
                if (mobileSearchOpen) setMobileSearchOpen(false);
              }}
              className="md:hidden flex items-center justify-center w-10 h-10 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors"
              aria-label="মেনু খুলুন"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>

            {/* Cart Button (Inside the clean box container) */}
            <button
              onClick={() => setIsCartOpen(true)}
              className="relative flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-orange-50 hover:bg-orange-100 text-orange-600 transition-all border border-orange-200/80 shadow-xs group"
              aria-label="কার্ট দেখুন"
            >
              <ShoppingCart className="w-5 h-5 text-orange-600 group-hover:scale-110 transition-transform" />
              {totalItems > 0 && (
                <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-[20px] px-1 bg-orange-600 text-white text-[10px] font-black rounded-full flex items-center justify-center shadow-md animate-pulse">
                  {totalItems}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Mobile quick search bar */}
        {mobileSearchOpen && (
          <div className="lg:hidden border-t border-slate-100 py-3 px-3 bg-white">
            <form onSubmit={handleSearch} className="relative">
              <input
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="জুতা বা ব্যাগ খুঁজুন..."
                className="w-full bg-slate-100 text-sm rounded-xl pl-10 pr-10 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-500 font-sans"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-600 absolute right-3 top-2.5"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </form>
          </div>
        )}

        {/* Mobile dropdown with rich functional icons */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-slate-100 py-3 px-3 space-y-2 bg-white">
            <div className="flex flex-col space-y-1 font-medium">
              <a
                href="/shop"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0">
                  <Home className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">হোম পেইজ</span>
                  <span className="text-[10px] text-slate-500">সকল নতুন কালেকশন ও অফার</span>
                </div>
              </a>

              <a
                href="/shop?category=shoes"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center flex-shrink-0">
                  <Footprints className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">জুতা কালেকশন (Shoes)</span>
                  <span className="text-[10px] text-slate-500">লেদার লোফার, অক্সফোর্ড ও স্নিকার্স</span>
                </div>
              </a>

              <a
                href="/shop?category=bags"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-slate-800 transition-colors"
              >
                <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag className="w-4 h-4" />
                </div>
                <div className="flex flex-col">
                  <span className="text-sm font-bold text-slate-900">ব্যাগ কালেকশন (Bags)</span>
                  <span className="text-[10px] text-slate-500">লেডিস ব্যাগ, ব্যাকপ্যাক ও ট্রাভেল ব্যাগ</span>
                </div>
              </a>

              <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 text-slate-600 text-xs">
                <Truck className="w-4 h-4 text-orange-600 flex-shrink-0" />
                <span>সারাদেশে ক্যাশ অন ডেলিভারি ও ফ্রি সাইজ পরিবর্তন</span>
              </div>

              <a
                href={`tel:${settings.hotline || '01712-345678'}`}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200/80 text-orange-950 transition-all mt-1"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-orange-600 text-white flex items-center justify-center shadow-xs flex-shrink-0">
                    <PhoneCall className="w-4 h-4" />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs font-black">হটলাইনে সরাসরি অর্ডার করুন</span>
                    <span className="text-[11px] font-mono font-bold text-orange-600">{settings.hotline || '01712-345678'}</span>
                  </div>
                </div>
                <span className="text-[10px] font-extrabold bg-orange-600 text-white px-2.5 py-1 rounded-lg shadow-xs">কল করুন</span>
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

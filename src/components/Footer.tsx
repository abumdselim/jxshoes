'use client';

import React, { useEffect, useState } from 'react';
import { Truck, RotateCcw, ShieldCheck, PhoneCall, Heart, MessageSquareHeart } from 'lucide-react';
import { StoreSettings } from '@/types';
import { initialStoreSettings } from '@/lib/initialData';
import FeedbackForm from '@/components/FeedbackForm';
import { apiFetch } from '@/lib/offline/apiFetch';

export default function Footer() {
  const [settings, setSettings] = useState<StoreSettings>(initialStoreSettings);

  useEffect(() => {
    async function load() {
      try {
        const res = await apiFetch('/api/settings');
        if (res.ok) setSettings(await res.json());
      } catch (e) {}
    }
    load();
  }, []);

  return (
    <footer className="bg-slate-950 text-slate-300 pt-12 sm:pt-16 pb-24 md:pb-12 border-t border-slate-900 mt-12 sm:mt-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Value Proposition Badges */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 pb-10 sm:pb-12 border-b border-slate-800">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
              <Truck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">ক্যাশ অন ডেলিভারি</h4>
              <p className="text-xs text-slate-400 mt-0.5">পণ্য হাতে পেয়ে মূল্য পরিশোধ</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
              <RotateCcw className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">সহজ এক্সচেঞ্জ পলিসি</h4>
              <p className="text-xs text-slate-400 mt-0.5">সাইজ পরিবর্তন সুবিধা</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">১০০% প্রিমিয়াম কোয়ালিটি</h4>
              <p className="text-xs text-slate-400 mt-0.5">অরিজিনাল লেদার ও উপাদান</p>
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-orange-500/10 text-orange-500 flex items-center justify-center shrink-0">
              <PhoneCall className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">২৪/৭ কাস্টমার সাপোর্ট</h4>
              <p className="text-xs text-slate-400 mt-0.5">কল: {settings.hotline}</p>
            </div>
          </div>
        </div>

        {/* Brand & Links */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 py-12">
          <div className="md:col-span-2 space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-lg bg-orange-600 flex items-center justify-center text-white font-black text-xl">
                SK
              </div>
              <span className="text-2xl font-black text-white">
                {settings.storeName}<span className="text-orange-500">.</span>
              </span>
            </div>
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">
              {settings.tagline}। জেনুইন লেদার জুতা, ট্রেন্ডি স্নিকার্স এবং আকর্ষণীয় অফিসের ল্যাপটপ ব্যাগ ও ট্রাভেল ব্যাগ কালেকশন।
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">ক্যাটাগরি</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li><a href="/shop?category=shoes" className="hover:text-orange-400 transition-colors">লেদার জুতা ও স্নিকার্স</a></li>
              <li><a href="/shop?category=bags" className="hover:text-orange-400 transition-colors">অফিসিয়াল ও ট্রাভেল ব্যাগ</a></li>
              <li><a href="/shop" className="hover:text-orange-400 transition-colors">নতুন আগমন (New Arrivals)</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4">কাস্টমার কেয়ার</h4>
            <ul className="space-y-2.5 text-sm text-slate-400">
              <li>হটলাইন: <strong className="text-white">{settings.hotline}</strong></li>
              <li>ইমেইল: {settings.email}</li>
              <li>ঠিকানা: {settings.address}</li>
              <li>সকাল ১০টা - রাত ১০টা</li>
            </ul>
          </div>
        </div>

        {/* মতামত ও অভিযোগ — সরাসরি অ্যাডমিন নোটিফিকেশনে পৌঁছায় */}
        <div className="py-10 border-t border-slate-900">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
            <div>
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <MessageSquareHeart className="w-5 h-5 text-orange-500" />
                মতামত ও অভিযোগ
              </h3>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-md">
                শপ, পণ্য বা ডেলিভারি নিয়ে আপনার পরামর্শ কিংবা অভিযোগ জানান —
                এটা সরাসরি ম্যানেজমেন্টের নোটিফিকেশনে পৌঁছে যাবে, আমরা দ্রুত ব্যবস্থা নেব।
              </p>
            </div>
            <FeedbackForm />
          </div>
        </div>

        {/* Bottom */}
        <div className="pt-8 border-t border-slate-900 text-center text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© {new Date().getFullYear()} {settings.storeName}. All rights reserved.</p>
          <p className="flex items-center gap-1">
            Made with <Heart className="w-3.5 h-3.5 text-red-500 fill-red-500" /> for Bangladeshi Shoppers
          </p>
        </div>
      </div>
    </footer>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { HeroBannerSettings, FlashDealSettings, Coupon, Product } from '@/types';
import { Megaphone, Flame, Ticket, Check, Plus, Trash2, Save, Sparkles } from 'lucide-react';

export default function AdminMarketingPage() {
  const [heroBanner, setHeroBanner] = useState<HeroBannerSettings | null>(null);
  const [flashDeal, setFlashDeal] = useState<FlashDealSettings | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // New Coupon Form
  const [newCoupon, setNewCoupon] = useState({
    code: '',
    discountType: 'fixed' as 'fixed' | 'percentage',
    value: '',
    minOrder: '1000',
  });

  const loadData = async () => {
    try {
      const [mRes, cRes, pRes] = await Promise.all([
        fetch('/api/marketing'),
        fetch('/api/coupons'),
        fetch('/api/products'),
      ]);
      if (mRes.ok) {
        const mData = await mRes.json();
        setHeroBanner(mData.heroBanner);
        setFlashDeal(mData.flashDeal);
      }
      if (cRes.ok) setCoupons(await cRes.json());
      if (pRes.ok) setProducts(await pRes.json());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSaveMarketing = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/marketing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ heroBanner, flashDeal }),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCoupon.code || !newCoupon.value) return;

    try {
      const res = await fetch('/api/coupons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: newCoupon.code,
          discountType: newCoupon.discountType,
          value: Number(newCoupon.value),
          minOrder: Number(newCoupon.minOrder) || 0,
        }),
      });
      if (res.ok) {
        setNewCoupon({ code: '', discountType: 'fixed', value: '', minOrder: '1000' });
        const cRes = await fetch('/api/coupons');
        if (cRes.ok) setCoupons(await cRes.json());
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    try {
      const res = await fetch(`/api/coupons?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setCoupons((prev) => prev.filter((c) => c.id !== id));
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !heroBanner || !flashDeal) {
    return <div className="p-12 text-center text-slate-500">মার্কেটিং সেটিংস লোড হচ্ছে...</div>;
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          মার্কেটিং, ব্যানার ও কুপন কন্ট্রোল
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          হোমপেজের হিরো ব্যানার, ফ্ল্যাশ ডিল টাইমার এবং ডিসকাউন্ট কুপন সরাসরি এখান থেকে পরিচালনা করুন।
        </p>
      </div>

      {saveSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-2xl text-xs sm:text-sm font-bold flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>ব্যানার ও অফারের তথ্য সফলভাবে সেভ হয়েছে! লাইভ স্টোরে পরিবর্তন দেখতে পারেন।</span>
        </div>
      )}

      {/* Hero Banner Controller */}
      <form onSubmit={handleSaveMarketing} className="space-y-8">
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-600" />
              <span>১. হোমপেজ হিরো ব্যানার (Hero Section)</span>
            </h2>
            <button
              type="submit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md transition-all"
            >
              <Save className="w-4 h-4" />
              <span>পরিবর্তন সেভ করুন</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                টপ ব্যাজ টেক্সট (Top Pill Badge)
              </label>
              <input
                type="text"
                value={heroBanner.badgeText}
                onChange={(e) => setHeroBanner({ ...heroBanner, badgeText: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                বাটন টেক্সট (CTA Button Text)
              </label>
              <input
                type="text"
                value={heroBanner.ctaText}
                onChange={(e) => setHeroBanner({ ...heroBanner, ctaText: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                মূল শিরোনাম (Title Part 1)
              </label>
              <input
                type="text"
                value={heroBanner.titlePart1}
                onChange={(e) => setHeroBanner({ ...heroBanner, titlePart1: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                হাইলাইট শিরোনাম (Gradient Highlighted Text)
              </label>
              <input
                type="text"
                value={heroBanner.titleHighlight}
                onChange={(e) => setHeroBanner({ ...heroBanner, titleHighlight: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold text-orange-600"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                সাব-টাইটেল / বিবরণী (Subtitle Description)
              </label>
              <textarea
                rows={2}
                value={heroBanner.subtitle}
                onChange={(e) => setHeroBanner({ ...heroBanner, subtitle: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Flash Deal Settings */}
        <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
          <div className="flex items-center justify-between border-b pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <Flame className="w-5 h-5 text-amber-500" />
              <span>২. ফ্ল্যাশ ডিল অফার কন্ট্রোল (Flash Deal of the Day)</span>
            </h2>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="flashEnabled"
                checked={flashDeal.enabled}
                onChange={(e) => setFlashDeal({ ...flashDeal, enabled: e.target.checked })}
                className="w-4 h-4 text-orange-600 rounded"
              />
              <label htmlFor="flashEnabled" className="text-xs font-bold text-slate-800">
                ফ্ল্যাশ ডিল সক্রিয় রাখুন
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                অফার ব্যাজ টেক্সট
              </label>
              <input
                type="text"
                value={flashDeal.badgeText}
                onChange={(e) => setFlashDeal({ ...flashDeal, badgeText: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                অফার প্রোডাক্ট নির্বাচন করুন
              </label>
              <select
                value={flashDeal.targetProductId}
                onChange={(e) => setFlashDeal({ ...flashDeal, targetProductId: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none font-medium"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} (৳{p.price})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                কাউন্টডাউন সময় (ঘণ্টা)
              </label>
              <input
                type="number"
                value={flashDeal.countdownHours}
                onChange={(e) => setFlashDeal({ ...flashDeal, countdownHours: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none font-mono"
              />
            </div>
          </div>
        </div>
      </form>

      {/* Coupons & Promo Codes */}
      <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200/90 shadow-sm space-y-6">
        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b pb-4">
          <Ticket className="w-5 h-5 text-purple-600" />
          <span>৩. কুপন ও প্রমো কোড ম্যানেজমেন্ট (Promo Codes)</span>
        </h2>

        {/* Create Coupon Form */}
        <form onSubmit={handleCreateCoupon} className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 space-y-4">
          <span className="text-xs font-bold text-slate-700 uppercase">নতুন কুপন কোড তৈরি করুন:</span>
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <input
                type="text"
                required
                placeholder="কুপন কোড (যেমন: EID20)"
                value={newCoupon.code}
                onChange={(e) => setNewCoupon({ ...newCoupon, code: e.target.value.toUpperCase() })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs uppercase font-mono font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <select
                value={newCoupon.discountType}
                onChange={(e) => setNewCoupon({ ...newCoupon, discountType: e.target.value as any })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-semibold focus:outline-none"
              >
                <option value="fixed">ফিক্সড টাকা ছাড় (Fixed ৳)</option>
                <option value="percentage">শতকরা ছাড় (Percentage %)</option>
              </select>
            </div>

            <div>
              <input
                type="number"
                required
                placeholder="ছাড়ের পরিমাণ (যেমন: 150 বা 10%)"
                value={newCoupon.value}
                onChange={(e) => setNewCoupon({ ...newCoupon, value: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
              />
            </div>

            <div>
              <input
                type="number"
                placeholder="ন্যূনতম অর্ডার (৳)"
                value={newCoupon.minOrder}
                onChange={(e) => setNewCoupon({ ...newCoupon, minOrder: e.target.value })}
                className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>কুপন যোগ করুন</span>
          </button>
        </form>

        {/* Existing Coupons Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b">
              <tr>
                <th className="py-3 px-4">কোড</th>
                <th className="py-3 px-4">ছাড়ের ধরণ</th>
                <th className="py-3 px-4">ছাড়ের মূল্য</th>
                <th className="py-3 px-4">ন্যূনতম অর্ডার</th>
                <th className="py-3 px-4 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {coupons.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50">
                  <td className="py-3 px-4 font-mono font-bold text-slate-900">{c.code}</td>
                  <td className="py-3 px-4 capitalize">
                    {c.discountType === 'percentage' ? 'শতাংশ (%)' : 'নির্দিষ্ট টাকা (৳)'}
                  </td>
                  <td className="py-3 px-4 font-bold text-purple-600">
                    {c.discountType === 'percentage' ? `${c.value}%` : `৳${c.value}`}
                  </td>
                  <td className="py-3 px-4">৳{c.minOrder}</td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => handleDeleteCoupon(c.id)}
                      className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

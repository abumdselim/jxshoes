'use client';

import React, { useState, useEffect } from 'react';
import { StoreSettings } from '@/types';
import { Settings, Save, Check, Phone, MapPin, Truck, DollarSign, Bell } from 'lucide-react';

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<StoreSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) setSettings(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (e) {
      console.error(e);
    }
  };

  if (loading || !settings) {
    return <div className="p-12 text-center text-slate-500">সেটিংস লোড হচ্ছে...</div>;
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      <div className="sticky top-14 md:top-0 z-20 bg-slate-200 rounded-md border border-slate-200/80 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            স্টোর সেটিংস ও পলিসি কন্ট্রোল
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            হটলাইন নম্বর, ডেলিভারি চার্জ, বিকাশ নম্বর এবং ওয়েবসাইটের ঘোষণা বার পরিচালনা করুন।
          </p>
        </div>

        <button
          onClick={handleSave}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold transition-all"
        >
          <Save className="w-4 h-4" />
          <span>সেটিংস সেভ করুন</span>
        </button>
      </div>

      {saved && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-md text-xs sm:text-sm font-bold flex items-center gap-2">
          <Check className="w-5 h-5 text-emerald-600" />
          <span>সেটিংস সফলভাবে সংরক্ষিত হয়েছে! পুরো সাইটে এটি সাথে সাথে প্রতিফলিত হবে।</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Basic Brand Info */}
        <div className="bg-white p-6 sm:p-8 rounded-md border border-slate-200/90 space-y-4">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 border-b pb-3">
            <Settings className="w-5 h-5 text-orange-600" />
            <span>১. শপের পরিচিতি (Brand & Contact)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                স্টোরের নাম *
              </label>
              <input
                type="text"
                value={settings.storeName}
                onChange={(e) => setSettings({ ...settings, storeName: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                ট্যাগলাইন (Slogan)
              </label>
              <input
                type="text"
                value={settings.tagline}
                onChange={(e) => setSettings({ ...settings, tagline: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                মালিকের নাম (AI গ্রিটিংয়ের জন্য)
              </label>
              <input
                type="text"
                value={settings.ownerName || ''}
                onChange={(e) => setSettings({ ...settings, ownerName: e.target.value })}
                placeholder="যেমন: রফিক ভাই"
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
              <p className="text-[10px] text-slate-400 mt-1">
                AI অ্যাসিস্ট্যান্ট প্রতিদিন দিনের শুরুতে এই নাম ধরে স্বাগতম জানাবে।
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                হটলাইন ফোন নম্বর *
              </label>
              <input
                type="text"
                value={settings.hotline}
                onChange={(e) => setSettings({ ...settings, hotline: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                সাপোর্ট ইমেইল
              </label>
              <input
                type="email"
                value={settings.email}
                onChange={(e) => setSettings({ ...settings, email: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                দোকান বা অফিসের সম্পূর্ণ ঠিকানা
              </label>
              <input
                type="text"
                value={settings.address}
                onChange={(e) => setSettings({ ...settings, address: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Top Announcement Bar */}
        <div className="bg-white p-6 sm:p-8 rounded-md border border-slate-200/90 space-y-4">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 border-b pb-3">
            <Bell className="w-5 h-5 text-orange-600" />
            <span>২. হেডারের টপ অ্যানাউন্সমেন্ট বার (Header Notice Ticker)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                মূল নোটিস টেক্সট
              </label>
              <input
                type="text"
                value={settings.announcementText}
                onChange={(e) => setSettings({ ...settings, announcementText: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                সেকেন্ডারি হাইলাইট (ডেস্কটপে দেখাবে)
              </label>
              <input
                type="text"
                value={settings.announcementSecondary}
                onChange={(e) => setSettings({ ...settings, announcementSecondary: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Shipping & Delivery Fees */}
        <div className="bg-white p-6 sm:p-8 rounded-md border border-slate-200/90 space-y-4">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 border-b pb-3">
            <Truck className="w-5 h-5 text-orange-600" />
            <span>৩. ডেলিভারি চার্জ নির্ধারণ (Shipping Fees)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                ঢাকার ভেতরে চার্জ (৳) *
              </label>
              <input
                type="number"
                value={settings.insideDhakaFee}
                onChange={(e) => setSettings({ ...settings, insideDhakaFee: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                ঢাকার বাইরে চার্জ (৳) *
              </label>
              <input
                type="number"
                value={settings.outsideDhakaFee}
                onChange={(e) => setSettings({ ...settings, outsideDhakaFee: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                ফ্রি ডেলিভারি পেতে ন্যূনতম অর্ডার (৳)
              </label>
              <input
                type="number"
                value={settings.freeDeliveryAbove}
                onChange={(e) => setSettings({ ...settings, freeDeliveryAbove: Number(e.target.value) })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>

        {/* Payment Account Details */}
        <div className="bg-white p-6 sm:p-8 rounded-md border border-slate-200/90 space-y-4">
          <h3 className="font-bold text-base text-slate-900 flex items-center gap-2 border-b pb-3">
            <DollarSign className="w-5 h-5 text-orange-600" />
            <span>৪. পেমেন্ট অ্যাকাউন্ট তথ্য (বিকাশ ও নগদ)</span>
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                বিকাশ নম্বর ও বিবরণী
              </label>
              <input
                type="text"
                value={settings.bkashNumber}
                onChange={(e) => setSettings({ ...settings, bkashNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                নগদ নম্বর ও বিবরণী
              </label>
              <input
                type="text"
                value={settings.nagadNumber}
                onChange={(e) => setSettings({ ...settings, nagadNumber: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm font-medium focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

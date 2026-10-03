'use client';

/**
 * ক্যাটাগরি ম্যানেজমেন্ট — আইকন-নির্ভর মডার্ন কার্ড
 * -------------------------------------------------
 * অ্যাডমিনে ছবির বদলে প্রতিটা ক্যাটাগরির ধরন অনুযায়ী প্রফেশনাল আইকন টাইল
 * (গ্রেডিয়েন্ট ব্যাকগ্রাউন্ড + সফট শ্যাডো)। ক্যাটাগরির `image` ফিল্ড হোমপেজের
 * ফটো-কার্ডের জন্য অপরিবর্তিত থাকে — খালি রাখলে স্টোর-লেয়ার ডিফল্ট বসায়।
 */

import React, { useState, useEffect } from 'react';
import { CategoryItem } from '@/types';
import {
  Plus,
  Trash2,
  Layers,
  X,
  SlidersHorizontal,
} from 'lucide-react';
import { apiFetch } from '@/lib/offline/apiFetch';

/** Material Design Icons (Apache 2.0) — ইনলাইন SVG, কোনো এক্সটার্নাল রিকোয়েস্ট নেই */
function MdiIcon({ body, className }: { body: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}

interface CatVisual {
  body: string;
  solid: string;
}

const ICONS: Record<string, string> = {
  shoeBallet: '<path fill="currentColor" d="M12.78 11.97C12.27 8.54 10.86 2 7.53 2S2.8 8.54 2.28 11.97c-.21 1.45-.28 2.92-.12 4.38c.34 3.04 1.39 4.49 2.11 5.15c.37.33.84.5 1.33.5h3.87c.49 0 .96-.17 1.33-.5c.7-.66 1.75-2.11 2.11-5.15c.17-1.46.09-2.93-.13-4.38M7.53 4c.36-.13 1.06.73 1.74 2.31l-4.69 4.02C5.41 6.26 6.94 3.79 7.53 4m2.22 9H5.31a.96.96 0 0 1-.55-.19L10 8.33c.29 1.02.56 2.17.75 3.5c.09.61-.38 1.17-1 1.17m12.03-1.03C21.27 8.54 19.86 2 16.53 2c-1.49 0-2.59 1.32-3.4 3.08c.37.96.71 2.06 1 3.29l5.18 4.44c-.16.11-.34.19-.56.19h-3.83c.12 1.27.11 2.45-.03 3.59c-.27 2.28-.89 3.86-1.57 4.94c.36.31.81.47 1.28.47h3.87c.49 0 .96-.17 1.33-.5c.7-.66 1.75-2.11 2.11-5.15c.17-1.46.09-2.93-.13-4.38M14.8 6.31c.7-1.58 1.38-2.44 1.73-2.31c.6-.21 2.12 2.26 2.97 6.33z"/>',
  shoeSneaker: '<path fill="currentColor" d="M2 15s0-3 2-3c.68 0 1.46-.05 2.28-.18C7.2 12.54 8.5 13 10 13h.25l-1.69-1.71c.35-.11.69-.24 1.03-.38l1.91 1.91c.39-.08.75-.19 1.08-.32l-2.03-2.05c.3-.17.59-.34.88-.54L13.5 12c.3-.21.54-.44.75-.68l-2.03-2.03c.24-.22.48-.46.7-.71l1.87 1.87c.12-.31.21-.62.21-.95c0-.85-.45-1.61-1.16-2.22c.05-.09.11-.18.16-.28l1.53-.77c.85.94 2.61 1.61 4.72 1.74l.05.03h.7s1 1 1 4.5c0 .57 0 1.07-.04 1.5H19c-1.1 0-2.42.26-3.7.5c-1.18.26-2.4.5-3.3.5zm19 2s.58 0 .86-2H19c-2 0-5 1-7 1H2.28c.34.6.98 1 1.72 1z"/>',
  shoeFormal: '<path fill="currentColor" d="M21.5 9V8h-1l-1 1H15l-1-1h-1l-6 4H4a2 2 0 0 0-2 2v2h8l3-1h2v1h6.5v-2s.5-1 .5-2.5s-.5-2.5-.5-2.5"/>',
  briefcase: '<path fill="currentColor" d="M10 2h4a2 2 0 0 1 2 2v2h4a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8c0-1.11.89-2 2-2h4V4c0-1.11.89-2 2-2m4 4V4h-4v2z"/>',
  bagSuitcase: '<path fill="currentColor" d="M17.03 6C18.11 6 19 6.88 19 8v11c0 1.13-.89 2-1.97 2c0 .58-.47 1-1.03 1c-.5 0-1-.42-1-1H9c0 .58-.5 1-1 1c-.56 0-1.03-.42-1.03-1C5.89 21 5 20.13 5 19V8c0-1.12.89-2 1.97-2H9V3c0-.58.46-1 1-1h4c.54 0 1 .42 1 1v3zM13.5 6V3.5h-3V6zM8 9v9h1.5V9zm6.5 0v9H16V9zm-3.25 0v9h1.5V9z"/>',
  bagPersonal: '<path fill="currentColor" d="M16 5V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v1a4 4 0 0 0-4 4v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9a4 4 0 0 0-4-4m-6-1h4v1h-4zm2 5l2 2l-2 2l-2-2zm6 7H9v2H8v-2H6v-1h12z"/>',
  hiking: '<path fill="currentColor" d="M17.47 8.67H19V23h-1.53V12.6c-.8-.16-1.55-.46-2.26-.89s-1.31-.93-1.82-1.51l-.62 3.07l2.23 2.2V23h-2v-6l-2.24-2.2L8.89 23H6.73S9.86 7.22 9.89 7.09c.11-.48.33-.85.7-1.09c.37-.27.74-.4 1.12-.4q.585 0 1.08.27c.34.17.6.42.79.74l1.06 1.63c.29.54.68 1.01 1.17 1.39s1.05.67 1.66.87zM8.55 5.89L7.4 5.65c-.57-.15-1.09-.03-1.56.29c-.46.32-.74.76-.84 1.34l-.81 3.98c-.03.29.03.55.19.79s.37.37.62.41l2.21.43zM13 1c-1.1 0-2 .9-2 2s.9 2 2 2s2-.89 2-2s-.89-2-2-2"/>',
  sunglasses: '<path fill="currentColor" d="M7 17H4C2.38 17 .96 15.74.76 14.14l-.5-2.99C.15 10.3.39 9.5.91 8.92S2.19 8 3 8h6c.83 0 1.58.35 2.06.96c.11.15.21.31.29.49c.43-.09.87-.09 1.29 0c.08-.18.18-.34.3-.49C13.41 8.35 14.16 8 15 8h6c.81 0 1.57.34 2.09.92c.51.58.75 1.38.65 2.19l-.51 3.07C23.04 15.74 21.61 17 20 17h-3c-1.56 0-3.08-1.19-3.46-2.7l-.9-2.71c-.38-.28-.91-.28-1.29 0l-.92 2.78C10.07 15.82 8.56 17 7 17"/>',
};

/** ক্যাটাগরির নাম/প্যারেন্ট টাইপ থেকে সঠিক আইকন + সলিড রঙ (ক্রম গুরুত্বপূর্ণ — আগের ম্যাচ জেতে) */
function getCategoryVisual(cat: CategoryItem): CatVisual {
  const n = cat.name;
  if (/loafer|লোফার|moccasin|ballet|ফ্ল্যাট/i.test(n)) return { body: ICONS.shoeBallet, solid: 'bg-amber-600' };
  if (/sneaker|স্নিকার্স|sports|স্পোর্টস/i.test(n)) return { body: ICONS.shoeSneaker, solid: 'bg-orange-600' };
  if (/formal|ফর্মাল|oxford/i.test(n)) return { body: ICONS.shoeFormal, solid: 'bg-violet-600' };
  if (/boot|বুট|hiking|হাইকিং/i.test(n)) return { body: ICONS.hiking, solid: 'bg-emerald-700' };
  if (/sandal|স্যাান্ডেল|স্যান্ডেল|চটি|slipper|flip/i.test(n)) return { body: ICONS.shoeBallet, solid: 'bg-yellow-500' };
  if (/laptop|office|ল্যাপটপ|অফিস/i.test(n)) return { body: ICONS.briefcase, solid: 'bg-indigo-600' };
  if (/travel|gym|ট্রাভেল|জিম|ডাফেল/i.test(n)) return { body: ICONS.bagSuitcase, solid: 'bg-teal-600' };
  if (/backpack|ব্যাকপ্যাক/i.test(n)) return { body: ICONS.bagPersonal, solid: 'bg-rose-600' };

  // নামে না মিললে প্যারেন্ট টাইপ দিয়ে ডিফল্ট
  if (cat.parentType === 'bags') return { body: ICONS.bagPersonal, solid: 'bg-blue-600' };
  if (cat.parentType === 'accessories') return { body: ICONS.sunglasses, solid: 'bg-fuchsia-600' };
  return { body: ICONS.shoeSneaker, solid: 'bg-orange-600' };
}

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    parentType: 'shoes' as 'shoes' | 'bags' | 'accessories',
    image: '',
    itemCountLabel: 'নতুন মডেল',
  });

  const loadCategories = async () => {
    try {
      const res = await apiFetch('/api/categories');
      if (res.ok) {
        setCategories(await res.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await apiFetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, image: formData.image.trim() }),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          name: '',
          parentType: 'shoes',
          image: '',
          itemCountLabel: 'নতুন মডেল',
        });
        loadCategories();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm('এই ক্যাটাগরিটি মুছে ফেলতে চান?')) {
      try {
        const res = await apiFetch(`/api/categories/${id}`, { method: 'DELETE' });
        if (res.ok) {
          loadCategories();
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            ক্যাটাগরি ম্যানেজমেন্ট
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            নতুন জুতা ও ব্যাগের সাব-ক্যাটাগরি যুক্ত করুন বা পরিবর্তন করুন। হোমপেজের ভিজুয়াল কার্ডে এগুলো সরাসরি দেখাবে।
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন ক্যাটাগরি তৈরি করুন</span>
        </button>
      </div>

      {/* Grid of Categories */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-44 bg-white rounded-md animate-pulse border" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {categories.map((cat) => {
            const { body, solid } = getCategoryVisual(cat);
            return (
              <div
                key={cat.id}
                className="bg-white rounded-md border border-slate-200/90 p-4 flex flex-col justify-between hover:border-orange-300/60 transition-all relative group"
              >
                <div className="flex items-center gap-3.5">
                  {/* মডার্ন আইকন টাইল — ছবির বদলে */}
                  <div
                    className={`w-16 h-16 rounded-md ${solid} flex items-center justify-center flex-shrink-0`}
                  >
                    <MdiIcon body={body} className="w-8 h-8 text-white" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-orange-50 text-orange-700">
                      {cat.parentType === 'shoes' ? 'জুতা' : cat.parentType === 'bags' ? 'ব্যাগ' : 'এক্সেসরিজ'}
                    </span>
                    <h3 className="font-bold text-sm text-slate-900 mt-1 truncate">{cat.name}</h3>
                    <span className="text-xs text-slate-400">{cat.itemCountLabel || 'ক্যাটালগ'}</span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="text-slate-400 font-mono text-[11px]">ID: {cat.id}</span>
                  <button
                    onClick={() => handleDelete(cat.id)}
                    className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                    title="মুছে ফেলুন"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-md w-full p-6 sm:p-8 border border-slate-200">
            <div className="flex items-center justify-between border-b pb-4 mb-5">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-orange-600" />
                <span>নতুন ক্যাটাগরি যুক্ত করুন</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  ক্যাটাগরির নাম *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="যেমন: স্যান্ডেল ও চটি (Sandals)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                />
                <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                  <SlidersHorizontal className="w-3 h-3" />
                  নাম অনুযায়ী অ্যাডমিনে অটোমেটিক আইকন ও রঙ বসে যাবে।
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  মূল প্যারেন্ট ক্যাটাগরি *
                </label>
                <select
                  value={formData.parentType}
                  onChange={(e) => setFormData({ ...formData, parentType: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-bold"
                >
                  <option value="shoes">জুতা (Shoes)</option>
                  <option value="bags">ব্যাগ (Bags)</option>
                  <option value="accessories">এক্সেসরিজ ও বেল্ট (Accessories)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  ট্যাগ / কাউন্টার টেক্সট
                </label>
                <input
                  type="text"
                  value={formData.itemCountLabel}
                  onChange={(e) => setFormData({ ...formData, itemCountLabel: e.target.value })}
                  placeholder="যেমন: ৫+ কালার, নতুন কালেকশন"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  ছবির URL — ঐচ্ছিক (হোমপেজ কার্ডের জন্য)
                </label>
                <input
                  type="text"
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://... (খালি রাখলে ডিফল্ট ছবি বসবে)"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
                {formData.image.trim() && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={formData.image} alt="" className="w-10 h-10 rounded-md object-cover border" />
                    <span className="text-[11px] text-slate-400">প্রিভিউ</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-md border text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                >
                  সেভ করুন
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

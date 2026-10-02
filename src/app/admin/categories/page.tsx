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
  Footprints,
  Zap,
  Crown,
  Briefcase,
  Luggage,
  Backpack,
  ShoppingBag,
  Watch,
  Mountain,
  Sun,
  SlidersHorizontal,
} from 'lucide-react';

type IconComponent = React.ComponentType<{ className?: string }>;

interface CatVisual {
  Icon: IconComponent;
  solid: string;
}

/** ক্যাটাগরির নাম/প্যারেন্ট টাইপ থেকে আইকন + সলিড রঙ (ক্রম গুরুত্বপূর্ণ — আগের ম্যাচ জেতে) */
function getCategoryVisual(cat: CategoryItem): CatVisual {
  const n = cat.name;
  if (/loafer|লোফার|moccasin/i.test(n)) return { Icon: Footprints, solid: 'bg-amber-600' };
  if (/sneaker|স্নিকার্স|sports|স্পোর্টস/i.test(n)) return { Icon: Zap, solid: 'bg-orange-600' };
  if (/formal|ফর্মাল|oxford/i.test(n)) return { Icon: Crown, solid: 'bg-violet-600' };
  if (/boot|বুট|hiking|হাইকিং/i.test(n)) return { Icon: Mountain, solid: 'bg-emerald-700' };
  if (/sandal|স্যাান্ডেল|স্যান্ডেল|চটি|slipper/i.test(n)) return { Icon: Sun, solid: 'bg-yellow-500' };
  if (/laptop|office|ল্যাপটপ|অফিস/i.test(n)) return { Icon: Briefcase, solid: 'bg-indigo-600' };
  if (/travel|gym|ট্রাভেল|জিম|ডাফেল/i.test(n)) return { Icon: Luggage, solid: 'bg-teal-600' };
  if (/backpack|ব্যাকপ্যাক/i.test(n)) return { Icon: Backpack, solid: 'bg-rose-600' };

  // নামে না মিললে প্যারেন্ট টাইপ দিয়ে ডিফল্ট
  if (cat.parentType === 'bags') return { Icon: ShoppingBag, solid: 'bg-blue-600' };
  if (cat.parentType === 'accessories') return { Icon: Watch, solid: 'bg-fuchsia-600' };
  return { Icon: Footprints, solid: 'bg-orange-600' };
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
      const res = await fetch('/api/categories');
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
      const res = await fetch('/api/categories', {
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
        const res = await fetch(`/api/categories/${id}`, { method: 'DELETE' });
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
            const { Icon, solid, } = getCategoryVisual(cat);
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
                    <Icon className="w-8 h-8 text-white" />
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-xs sm:text-sm focus:outline-none font-bold"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs sm:text-sm focus:outline-none"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs font-mono focus:outline-none"
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

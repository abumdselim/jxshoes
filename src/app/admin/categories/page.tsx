'use client';

import React, { useState, useEffect } from 'react';
import { CategoryItem } from '@/types';
import { Plus, Trash2, Layers, X, Tag } from 'lucide-react';

export default function AdminCategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    parentType: 'shoes' as 'shoes' | 'bags' | 'accessories',
    image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400',
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
        body: JSON.stringify(formData),
      });
      if (res.ok) {
        setIsModalOpen(false);
        setFormData({
          name: '',
          parentType: 'shoes',
          image: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400',
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
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            ক্যাটাগরি ম্যানেজমেন্ট
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            নতুন জুতা ও ব্যাগের সাব-ক্যাটাগরি যুক্ত করুন বা পরিবর্তন করুন। হোমপেজের ভিজুয়াল কার্ডে এগুলো সরাসরি দেখাবে।
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-600/30 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন ক্যাটাগরি তৈরি করুন</span>
        </button>
      </div>

      {/* Grid of Categories */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((n) => (
            <div key={n} className="h-44 bg-white rounded-2xl animate-pulse border" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-sm p-4 flex flex-col justify-between hover:shadow-md transition-shadow relative group"
            >
              <div className="flex items-center gap-3.5">
                <img
                  src={cat.image}
                  alt={cat.name}
                  className="w-16 h-16 rounded-xl object-cover border border-slate-200 bg-slate-100 flex-shrink-0"
                />
                <div className="min-w-0">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-orange-50 text-orange-700">
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
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="মুছে ফেলুন"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between border-b pb-4 mb-5">
              <h3 className="font-bold text-lg text-slate-900 flex items-center gap-2">
                <Layers className="w-5 h-5 text-orange-600" />
                <span>নতুন ক্যাটাগরি যুক্ত করুন</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  মূল প্যারেন্ট ক্যাটাগরি *
                </label>
                <select
                  value={formData.parentType}
                  onChange={(e) => setFormData({ ...formData, parentType: e.target.value as any })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-xs sm:text-sm focus:outline-none font-bold"
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs sm:text-sm focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  ছবির URL (Photo URL) *
                </label>
                <input
                  type="text"
                  required
                  value={formData.image}
                  onChange={(e) => setFormData({ ...formData, image: e.target.value })}
                  placeholder="https://..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-mono focus:outline-none"
                />
                {formData.image && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={formData.image} alt="" className="w-10 h-10 rounded-lg object-cover border" />
                    <span className="text-[11px] text-slate-400">প্রিভিউ</span>
                  </div>
                )}
              </div>

              <div className="pt-4 border-t flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border text-xs font-bold text-slate-600 hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md"
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

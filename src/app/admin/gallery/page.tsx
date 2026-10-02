'use client';

/**
 * মিডিয়া গ্যালারি — সব প্রোডাক্টের সব ছবি এক জায়গায়
 * ------------------------------------------------
 * প্রতিটি ছবির নিচে কোন প্রোডাক্টের ছবি তা দেখা যায়; পেন্সিল চাপলে
 * ক্যানভাস এডিটর (ক্রপ/রোটেট/কালার) খোলে — সেভ করলে সরাসরি সেই
 * প্রোডাক্টের images[] আপডেট হয় (PUT /api/products/{id})।
 */

import React, { useEffect, useMemo, useState } from 'react';
import { Product } from '@/types';
import ImageEditor from '@/components/admin/ImageEditor';
import { Images, Search, Pencil, Package, Loader2, AlertTriangle, CheckCircle2 } from 'lucide-react';

interface EditingTarget {
  productId: string;
  productName: string;
  imageIndex: number;
}

export default function AdminGalleryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<EditingTarget | null>(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/products');
        if (res.ok) setProducts(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // সব প্রোডাক্টের ছবি সমান করে সাজানো — প্রোডাক্ট অনুযায়ী ফিল্টারসহ
  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list: { url: string; productId: string; productName: string; sku: string; imageIndex: number }[] = [];
    for (const p of products) {
      if (q && !`${p.name} ${p.sku || ''}`.toLowerCase().includes(q)) continue;
      (p.images || []).forEach((url, imageIndex) => {
        if (url) list.push({ url, productId: p.id, productName: p.name, sku: p.sku || '', imageIndex });
      });
    }
    return list;
  }, [products, search]);

  const totalImages = useMemo(
    () => products.reduce((s, p) => s + (p.images || []).filter(Boolean).length, 0),
    [products]
  );

  const handleSave = async (dataUrl: string) => {
    if (!editing) return;
    const product = products.find(p => p.id === editing.productId);
    if (!product) return;
    setSaving(true);
    try {
      const updatedImages = (product.images || []).map((x, i) => (i === editing.imageIndex ? dataUrl : x));
      const res = await fetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...product, images: updatedImages }),
      });
      if (!res.ok) throw new Error('save failed');
      setProducts(prev => prev.map(p => (p.id === product.id ? { ...p, images: updatedImages } : p)));
      setEditing(null);
      setSavedFlash(product.name);
      setTimeout(() => setSavedFlash(null), 3000);
    } catch {
      alert('ছবি সংরক্ষণ করা যায়নি — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* হেডার */}
      <div className="sticky top-14 md:top-0 z-20 bg-slate-200 rounded-md border border-slate-200/80 px-4 sm:px-5 py-3.5">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">মিডিয়া গ্যালারি</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          সব প্রোডাক্টের সব ছবি এক জায়গায় — যেকোনো ছবিতে ক্রপ, রোটেট ও কালার এডিট করে সরাসরি সেভ করুন।
        </p>
      </div>

      {/* সার্চ + পরিসংখ্যান */}
      <div className="bg-white p-4 rounded-md border border-slate-200/80 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="প্রোডাক্টের নাম বা SKU দিয়ে খুঁজুন..."
            className="w-full bg-white border border-slate-200 rounded-md pl-10 pr-4 py-3 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>
        <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
          <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-md px-3 py-2">
            <Images className="w-3.5 h-3.5 text-orange-600" /> {totalImages}টি ছবি
          </span>
          <span className="inline-flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-md px-3 py-2">
            <Package className="w-3.5 h-3.5 text-orange-600" /> {products.length}টি প্রোডাক্ট
          </span>
        </div>
      </div>

      {/* সেভ হওয়ার নোটিশ */}
      {savedFlash && (
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="w-4 h-4" /> সংরক্ষিত — {savedFlash}-এর ছবি আপডেট হয়েছে
        </div>
      )}
      {saving && (
        <div className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-amber-50 border border-amber-200 text-xs font-bold text-amber-700">
          <Loader2 className="w-4 h-4 animate-spin" /> সংরক্ষণ হচ্ছে…
        </div>
      )}

      {/* গ্যালারি গ্রিড */}
      {items.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map((it, i) => (
            <div
              key={`${it.productId}-${it.imageIndex}`}
              className="bg-white rounded-md border border-slate-200/80 overflow-hidden group"
            >
              <div className="relative aspect-square bg-slate-50">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={it.url} alt={it.productName} className="w-full h-full object-cover" />
                <div className="absolute inset-0 bg-slate-900/55 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    title="এডিট করুন — ক্রপ, রোটেট, কালার"
                    onClick={() =>
                      setEditing({ productId: it.productId, productName: it.productName, imageIndex: it.imageIndex })
                    }
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-white/95 rounded-md text-slate-800 hover:bg-white text-xs font-bold"
                  >
                    <Pencil className="w-3.5 h-3.5" /> এডিট
                  </button>
                </div>
              </div>
              <div className="px-3 py-2.5">
                <div className="text-[11px] font-bold text-slate-800 truncate">{it.productName}</div>
                <div className="text-[10px] text-slate-400 font-mono truncate">{it.sku || '—'}</div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-md border border-slate-200/80 p-12 text-center">
          {search ? (
            <>
              <Search className="w-12 h-12 mx-auto text-slate-200 mb-4" />
              <h3 className="font-bold text-slate-700">কিছু পাওয়া যায়নি</h3>
              <p className="text-xs text-slate-400 mt-2">অন্য নাম বা SKU দিয়ে খুঁজে দেখুন।</p>
            </>
          ) : (
            <>
              <Images className="w-12 h-12 mx-auto text-slate-200 mb-4" />
              <h3 className="font-bold text-slate-700">গ্যালারি খালি</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                প্রোডাক্ট ম্যানেজমেন্ট থেকে ছবি যোগ করলেই সেগুলো এখানে চলে আসবে।
              </p>
            </>
          )}
        </div>
      )}

      {/* ছবি এডিটর */}
      {editing && (
        <ImageEditor
          src={items.find(x => x.productId === editing.productId && x.imageIndex === editing.imageIndex)?.url || ''}
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

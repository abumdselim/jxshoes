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
import { Images, Search, Pencil, Package, Loader2, AlertTriangle, CheckCircle2, Upload, Trash2 } from 'lucide-react';
import { apiFetch } from '@/lib/offline/apiFetch';

export default function AdminGalleryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<
    | { kind: 'library'; url: string }
    | { kind: 'product'; productId: string; imageIndex: number }
    | null
  >(null);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);
  const [uploadTargetId, setUploadTargetId] = useState('');
  const [uploading, setUploading] = useState(false);
  const [pendingUrl, setPendingUrl] = useState('');
  const [library, setLibrary] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch('/api/products');
        if (res.ok) setProducts(await res.json());
        const libRes = await apiFetch('/api/media-library');
        if (libRes.ok) setLibrary(await libRes.json());
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
    if (editing.kind === 'library') {
      // লাইব্রেরির ছবি এডিট — পুরনো URL-এর বদলে নতুনটা সেভ হয়
      setSaving(true);
      try {
        const addRes = await apiFetch('/api/media-library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: [dataUrl] }),
        });
        if (!addRes.ok) throw new Error('save failed');
        await apiFetch('/api/media-library', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: [editing.url] }),
        });
        setLibrary(prev => prev.map(u => (u === editing.url ? dataUrl : u)));
        setEditing(null);
      } catch {
        alert('ছবি সংরক্ষণ করা যায়নি — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
      } finally {
        setSaving(false);
      }
      return;
    }
    const product = products.find(p => p.id === editing.productId);
    if (!product) return;
    setSaving(true);
    try {
      const updatedImages = (product.images || []).map((x, i) => (i === editing.imageIndex ? dataUrl : x));
      const res = await apiFetch(`/api/products/${product.id}`, {
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

  /* ── সরাসরি আপলোড — ছবিগুলো নির্বাচিত প্রোডাক্টের গ্যালারিতে যুক্ত হয় ── */
  const addImagesToProduct = async (productId: string, urls: string[]): Promise<boolean> => {
    if (urls.length === 0) return false;
    const product = products.find(p => p.id === productId);
    if (!product) {
      alert('প্রোডাক্ট পাওয়া যায়নি — পেজটা রিফ্রেশ করে আবার চেষ্টা করুন।');
      return false;
    }
    setSaving(true);
    try {
      const updatedImages = [...(product.images || []), ...urls];
      const res = await apiFetch(`/api/products/${product.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...product, images: updatedImages }),
      });
      if (!res.ok) throw new Error('save failed');
      setProducts(prev => prev.map(p => (p.id === product.id ? { ...p, images: updatedImages } : p)));
      setSavedFlash(`${product.name}-এ ${urls.length}টি ছবি যোগ হয়েছে`);
      setTimeout(() => setSavedFlash(null), 3000);
      return true;
    } catch {
      alert('ছবি সংরক্ষণ করা যায়নি — ইন্টারনেট সংযোগ দেখে আবার চেষ্টা করুন।');
      return false;
    } finally {
      setSaving(false);
    }
  };

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = '';
    if (files.length === 0) return;
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const file of files) {
        const fd = new FormData();
        fd.append('file', file);
        const res = await apiFetch('/api/upload', { method: 'POST', body: fd });
        if (res.ok) {
          const data = await res.json();
          if (data?.url) newUrls.push(data.url);
        } else {
          alert('একটি ছবি আপলোড করতে সমস্যা হয়েছে');
        }
      }
      if (newUrls.length === 0) return;
      if (uploadTargetId) {
        // আপলোডের সময়ই প্রোডাক্ট বেছে নিলে সরাসরি সেখানে যুক্ত হয়
        await addImagesToProduct(uploadTargetId, newUrls);
      } else {
        // ডিফল্ট: নতুন ছবি লাইব্রেরিতে জমা হয় — পরে যেকোনো প্রোডাক্টে যুক্ত করা যায়
        const res = await apiFetch('/api/media-library', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: newUrls }),
        });
        if (!res.ok) {
          alert('লাইব্রেরিতে যোগ করা যায়নি — আবার চেষ্টা করুন।');
          return;
        }
        setLibrary(prev => [...prev, ...newUrls]);
        setSavedFlash(`${newUrls.length}টি ছবি লাইব্রেরিতে যোগ হয়েছে`);
        setTimeout(() => setSavedFlash(null), 3000);
      }
    } finally {
      setUploading(false);
    }
  };

  const handleAddByUrl = async () => {
    const u = pendingUrl.trim();
    if (!u) return;
    if (uploadTargetId) {
      const ok = await addImagesToProduct(uploadTargetId, [u]);
      if (ok) setPendingUrl('');
    } else {
      const res = await apiFetch('/api/media-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls: [u] }),
      });
      if (!res.ok) {
        alert('লাইব্রেরিতে যোগ করা যায়নি — আবার চেষ্টা করুন।');
        return;
      }
      setLibrary(prev => [...prev, u]);
      setSavedFlash('ছবিটা লাইব্রেরিতে যোগ হয়েছে');
      setTimeout(() => setSavedFlash(null), 3000);
      setPendingUrl('');
    }
  };

  const attachLibraryImage = async (url: string, productId: string) => {
    const ok = await addImagesToProduct(productId, [url]);
    if (!ok) return;
    await apiFetch('/api/media-library', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] }),
    });
    setLibrary(prev => prev.filter(u => u !== url));
  };

  const deleteLibraryImage = async (url: string) => {
    const res = await apiFetch('/api/media-library', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ urls: [url] }),
    });
    if (res.ok) setLibrary(prev => prev.filter(u => u !== url));
    else alert('মুছা যায়নি — আবার চেষ্টা করুন।');
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

      {/* সরাসরি আপলোড */}
      <div className="bg-white p-4 rounded-md border border-slate-200/80 space-y-3">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          <div>
          <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">
            ছবি কোথায় যুক্ত হবে?
          </label>
          <select
            value={uploadTargetId}
            onChange={(e) => setUploadTargetId(e.target.value)}
            className="w-full bg-white border border-slate-200 rounded-md px-3 py-3 text-xs sm:text-sm font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          >
            <option value="">🖼️ নতুন ছবি — লাইব্রেরিতে জমা হবে (ডিফল্ট)</option>
              {products.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}{p.sku ? ` (${p.sku})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1.5">
              ধাপ ২ — ছবি আপলোড করুন (একাধিক চলবে)
            </label>
            <input
              type="file"
              id="galleryUploadInput"
              accept="image/*"
              multiple
              onChange={handleGalleryUpload}
              className="hidden"
              disabled={uploading}
            />
            <label
              htmlFor="galleryUploadInput"
              className="cursor-pointer flex items-center justify-center gap-2 border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-md px-4 py-2.5 text-xs sm:text-sm font-bold text-slate-700 bg-slate-50/70 transition-colors"
            >
              {uploading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-orange-600" /> আপলোড হচ্ছে…
                </>
              ) : (
                <>
                  <Upload className="w-4 h-4 text-orange-600" />
                  কম্পিউটার/মোবাইল থেকে ছবি বাছুন (JPG, PNG, WebP — সর্বোচ্চ 5MB)
                </>
              )}
            </label>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            value={pendingUrl}
            onChange={(e) => setPendingUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddByUrl(); } }}
            placeholder="অথবা ছবির লিংক দিয়ে যোগ করুন (https://...)"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
          />
          <button
            type="button"
            onClick={handleAddByUrl}
            className="px-4 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
          >
            লিংক যোগ করুন
          </button>
        </div>
        <p className="text-[10px] text-slate-400 leading-relaxed">
          ডিফল্টে নতুন ছবি লাইব্রেরিতে জমা হয় — নিচের &quot;নতুন ছবি&quot; সেকশন থেকে যেকোনো সময় এক ক্লিকে প্রোডাক্টে যুক্ত করুন। আপলোডের সময়ই প্রোডাক্ট বেছে নিলে সরাসরি সেখানে চলে যাবে। পরে যেকোনো ছবিতে এডিট (ক্রপ/রোটেট/কালার) করতে পারবেন।
        </p>
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

      {/* নতুন আপলোড — প্রোডাক্টে অযুক্ত ছবি */}
      {library.length > 0 && (
        <div className="bg-white rounded-md border border-amber-200 p-4 sm:p-5">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            নতুন ছবি — এখনো কোনো প্রোডাক্টে যুক্ত হয়নি ({library.length}টি)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {library.map((url, i) => (
              <div key={url} className="bg-white rounded-md border border-amber-200 overflow-hidden group">
                <div className="relative aspect-square bg-slate-50">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt={`নতুন ছবি ${i + 1}`} className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-slate-900/55 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                    <button
                      type="button"
                      title="এডিট করুন — ক্রপ, রোটেট, কালার"
                      onClick={() => setEditing({ kind: 'library', url })}
                      className="p-2 bg-white/95 rounded-md text-slate-700 hover:bg-white"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      title="লাইব্রেরি থেকে মুছুন"
                      onClick={() => deleteLibraryImage(url)}
                      className="p-2 bg-white/95 rounded-md text-red-600 hover:bg-white"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                <div className="px-2.5 py-2">
                  <select
                    value=""
                    onChange={(e) => {
                      const pid = e.target.value;
                      if (pid) attachLibraryImage(url, pid);
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-2 py-1.5 text-[11px] font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="">একটি প্রোডাক্টে যুক্ত করুন…</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ))}
          </div>
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
                    onClick={() => setEditing({ kind: 'product', productId: it.productId, imageIndex: it.imageIndex })}
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
          src={
            editing.kind === 'library'
              ? editing.url
              : items.find(x => x.productId === editing.productId && x.imageIndex === editing.imageIndex)?.url || ''
          }
          onClose={() => setEditing(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

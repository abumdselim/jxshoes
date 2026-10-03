'use client';

import React, { useState, useEffect } from 'react';
import { Product } from '@/types';
import { formatPrice } from '@/lib/utils';
import ImageEditor from '@/components/admin/ImageEditor';
import {
  Plus,
  Edit2,
  Trash2,
  Search,
  Check,
  X,
  Image as ImageIcon,
  Tag,
  Eye,
  Sparkles,
  Upload,
  Pencil,
  Star
} from 'lucide-react';
import { apiFetch } from '@/lib/offline/apiFetch';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [editorIndex, setEditorIndex] = useState<number | null>(null);
  const [pendingUrl, setPendingUrl] = useState('');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    category: 'shoes',
    subCategory: 'Sneakers',
    price: '',
    costPrice: '',
    originalPrice: '',
    description: '',
    sizes: '40, 41, 42, 43, 44',
    colors: 'Black, Brown',
    imageUrls: [] as string[],
    stockCount: '20',
    minStockAlert: '5',
    supplier: '',
    inStock: true,
    isFeatured: false,
  });

  // Inline Price Editing State
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [inlinePrice, setInlinePrice] = useState<string>('');

  // AI Description Generator State
  const [aiDescLoading, setAiDescLoading] = useState(false);

  const generateDescription = async () => {
    if (!formData.name.trim()) {
      alert('AI দিয়ে বিবরণ লেখানোর আগে প্রোডাক্টের নাম দিন।');
      return;
    }
    setAiDescLoading(true);
    try {
      const res = await apiFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'product-content',
          name: formData.name,
          category: formData.category,
          subCategory: formData.subCategory,
          colors: formData.colors,
          sizes: formData.sizes,
          price: Number(formData.price) || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.description) {
        setFormData(prev => ({ ...prev, description: data.description }));
      } else {
        alert('⚠️ ' + (data?.error || 'বিবরণ তৈরি করা যায়নি'));
      }
    } catch {
      alert('⚠️ সার্ভারে সংযোগ করা যায়নি');
    } finally {
      setAiDescLoading(false);
    }
  };

  const loadProducts = async () => {
    try {
      const res = await apiFetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
    // মোবাইল হেডারের সার্চ থেকে ?q= প্যারামিটার এলে সেটা দিয়েই শুরু
    const q = new URLSearchParams(window.location.search).get('q');
    if (q) setSearchQuery(q);
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      sku: `SK-SH-${Math.floor(100 + Math.random() * 900)}`,
      barcode: `890100${Date.now().toString().slice(-6)}`,
      name: '',
      category: 'shoes',
      subCategory: 'Sneakers',
      price: '',
      costPrice: '',
      originalPrice: '',
      description: '',
      sizes: '40, 41, 42, 43, 44',
      colors: 'Black, Brown',
      imageUrls: [],
      stockCount: '20',
      minStockAlert: '5',
      supplier: 'প্রধান সরবরাহকারী',
      inStock: true,
      isFeatured: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku || `SK-${product.category === 'bags' ? 'BG' : 'SH'}-${Math.floor(100 + Math.random() * 900)}`,
      barcode: product.barcode || '',
      name: product.name,
      category: product.category,
      subCategory: product.subCategory || '',
      price: product.price.toString(),
      costPrice: product.costPrice !== undefined ? product.costPrice.toString() : '',
      originalPrice: product.originalPrice ? product.originalPrice.toString() : '',
      description: product.description,
      sizes: product.sizes.join(', '),
      colors: product.colors.map((c) => c.name).join(', '),
      imageUrls: (product.images || []).filter(Boolean),
      stockCount: product.stockCount.toString(),
      minStockAlert: (product.minStockAlert || 5).toString(),
      supplier: product.supplier || '',
      inStock: product.inStock,
      isFeatured: Boolean(product.isFeatured),
    });
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    e.target.value = ''; // একই ফাইল আবার বাছলেও কাজ করে

    setUploadingImage(true);
    try {
      for (const file of files) {
        const uploadData = new FormData();
        uploadData.append('file', file);

        const res = await apiFetch('/api/upload', {
          method: 'POST',
          body: uploadData,
        });
        if (res.ok) {
          const data = await res.json();
          setFormData((prev) => ({ ...prev, imageUrls: [...prev.imageUrls, data.url] }));
        } else {
          alert('ছবি আপলোড করতে সমস্যা হয়েছে');
        }
      }
    } catch (err) {
      alert('ছবি আপলোড ব্যর্থ হয়েছে');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

    const gallery = formData.imageUrls.map((u) => u.trim()).filter(Boolean);
    if (gallery.length === 0) {
      alert('অন্তত একটি ছবি যোগ করুন — আপলোড করে বা লিংক দিয়ে।');
      return;
    }

    const sizesArr = formData.sizes
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    const colorsArr = formData.colors
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .map((name) => {
        let hex = '#111827';
        if (name.toLowerCase().includes('brown')) hex = '#78350f';
        if (name.toLowerCase().includes('tan')) hex = '#b45309';
        if (name.toLowerCase().includes('white')) hex = '#f8fafc';
        if (name.toLowerCase().includes('blue') || name.toLowerCase().includes('navy')) hex = '#1e3a8a';
        if (name.toLowerCase().includes('grey') || name.toLowerCase().includes('gray')) hex = '#64748b';
        return { name, hex };
      });

    const payload = {
      id: editingProduct?.id,
      sku: formData.sku?.trim() || undefined,
      barcode: formData.barcode?.trim() || undefined,
      name: formData.name,
      category: formData.category,
      subCategory: formData.subCategory,
      price: Number(formData.price),
      costPrice: formData.costPrice ? Number(formData.costPrice) : undefined,
      originalPrice: formData.originalPrice ? Number(formData.originalPrice) : undefined,
      description: formData.description,
      sizes: sizesArr.length > 0 ? sizesArr : ['Standard'],
      colors: colorsArr.length > 0 ? colorsArr : [{ name: 'Black', hex: '#000000' }],
      images: gallery,
      stockCount: Number(formData.stockCount),
      minStockAlert: formData.minStockAlert ? Number(formData.minStockAlert) : 5,
      supplier: formData.supplier?.trim() || undefined,
      inStock: formData.inStock,
      isFeatured: formData.isFeatured,
    };

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      // apiFetch — নইলে অফলাইনে পণ্য সেভ নীরবে হারিয়ে যায় (P8 রিভিউ-র কুইক-উইন)
      const res = await apiFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setIsModalOpen(false);
        loadProducts();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (confirm('আপনি কি নিশ্চিত যে এই প্রোডাক্টটি মুছে ফেলতে চান?')) {
      try {
        const res = await apiFetch(`/api/products/${id}`, { method: 'DELETE' });
        if (res.ok) {
          loadProducts();
        }
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Inline Price Update
  const handleSaveInlinePrice = async (id: string) => {
    const newPrice = Number(inlinePrice);
    if (isNaN(newPrice) || newPrice <= 0) return;

    try {
      const res = await apiFetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ price: newPrice }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === id ? { ...p, price: newPrice } : p))
        );
        setEditingPriceId(null);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const filteredProducts = products.filter((p) => {
    const matchesCat = categoryFilter === 'all' || p.category === categoryFilter;
    const matchesQ =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.subCategory && p.subCategory.toLowerCase().includes(searchQuery.toLowerCase()));
    return matchesCat && matchesQ;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header — স্টিকি টুলবার */}
      <div className="sticky top-14 md:top-0 z-20 bg-slate-200 rounded-md border border-slate-200/80 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            প্রোডাক্ট ম্যানেজমেন্ট
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            নতুন জুতা ও ব্যাগ আপলোড করুন, দাম পরিবর্তন করুন এবং স্টক পরিচালনা করুন।
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold transition-all transform hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন প্রোডাক্ট আপলোড</span>
        </button>
      </div>

      {/* Filters & Search — কন্টেইনার বার ছাড়া স্বাধীন এলিমেন্ট */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="প্রোডাক্টের নাম দিয়ে খুঁজুন..."
            className="w-full bg-white border border-slate-200 rounded-md pl-10 pr-4 py-3 text-xs sm:text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3.5" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500">ক্যাটাগরি:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-auto bg-white border border-slate-200 rounded-md px-4 py-3 text-xs font-semibold text-slate-700 shadow-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          >
            <option value="all">সকল পণ্য ({products.length})</option>
            <option value="shoes">জুতা (Shoes)</option>
            <option value="bags">ব্যাগ (Bags)</option>
          </select>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-md border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
              <tr>
                <th className="py-4 px-6">প্রোডাক্ট</th>
                <th className="py-4 px-6">ক্যাটাগরি ও সাইজ</th>
                <th className="py-4 px-6">বর্তমান মূল্য (Price)</th>
                <th className="py-4 px-6">স্টক অবস্থা</th>
                <th className="py-4 px-6 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50/60 transition-colors">
                  {/* Image & Title */}
                  <td className="py-4 px-6">
                    <div className="flex items-center gap-3.5">
                      <img
                        src={p.images[0]}
                        alt={p.name}
                        className="w-14 h-14 rounded-md object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                      />
                      <div>
                        <a
                          href={`/product/${p.id}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-bold text-slate-900 hover:text-orange-600 transition-colors line-clamp-1"
                        >
                          {p.name}
                        </a>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {p.isFeatured && (
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                              হট ডিল
                            </span>
                          )}
                          {p.sku && (
                            <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded font-mono">
                              {p.sku}
                            </span>
                          )}
                          <span className="text-xs text-slate-400">
                            ID: {p.id}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Category & Sizes */}
                  <td className="py-4 px-6">
                    <div className="font-semibold text-xs text-slate-800 capitalize">
                      {p.subCategory || p.category}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-1 max-w-xs">
                      {p.sizes.slice(0, 5).map((s) => (
                        <span key={s} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">
                          {s}
                        </span>
                      ))}
                      {p.sizes.length > 5 && (
                        <span className="text-[10px] text-slate-400">+{p.sizes.length - 5}</span>
                      )}
                    </div>
                  </td>

                  {/* Price (with Inline Edit) */}
                  <td className="py-4 px-6">
                    {editingPriceId === p.id ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="number"
                          value={inlinePrice}
                          onChange={(e) => setInlinePrice(e.target.value)}
                          className="w-24 px-2 py-1 text-xs border border-orange-500 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveInlinePrice(p.id)}
                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingPriceId(null)}
                          className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={() => {
                          setEditingPriceId(p.id);
                          setInlinePrice(p.price.toString());
                        }}
                        className="cursor-pointer group flex items-center gap-2"
                        title="ক্লিক করে সরাসরি মূল্য পরিবর্তন করুন"
                      >
                        <div className="font-bold text-slate-900 group-hover:text-orange-600">
                          {formatPrice(p.price)}
                        </div>
                        {p.originalPrice && (
                          <div className="text-xs text-slate-400 line-through">
                            {formatPrice(p.originalPrice)}
                          </div>
                        )}
                        <Edit2 className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    )}
                  </td>

                  {/* Stock Status */}
                  <td className="py-4 px-6">
                    {p.inStock ? (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        ইন স্টক ({p.stockCount} টি)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-md bg-red-50 text-red-700 border border-red-200">
                        স্টক আউট
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-2 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                        title="সম্পূর্ণ এডিট করুন"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="মুছে ফেলুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Product Modal — হেডার/ফুটার স্টিকি, শুধু বডি স্ক্রল হয়; মোবাইলে বটম-শিট */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm !mt-0">
          <div className="min-h-full flex items-end sm:items-center justify-center sm:p-6">
            <div className="bg-white w-full max-w-2xl rounded-t-md sm:rounded-md border border-slate-200 shadow-xl flex flex-col max-h-[92vh] sm:max-h-[88vh] overflow-hidden">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 sm:px-8 py-4 flex-shrink-0 bg-white rounded-t-md">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  <Tag className="w-5 h-5 text-orange-600" />
                  <span>{editingProduct ? 'প্রোডাক্ট এডিট করুন' : 'নতুন প্রোডাক্ট আপলোড'}</span>
                </h2>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-slate-600 rounded-md hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="product-form" onSubmit={handleSaveProduct} className="space-y-5 overflow-y-auto px-5 sm:px-8 py-5 flex-1 min-h-0">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  প্রোডাক্টের নাম *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="যেমন: Classic Oxford Leather Shoes"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                />
              </div>

              {/* SKU & Barcode Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700 uppercase">
                      প্রোডাক্ট কোড / SKU *
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const pfx = formData.category === 'bags' ? 'BG' : 'SH';
                        setFormData({ ...formData, sku: `SK-${pfx}-${Math.floor(100 + Math.random() * 900)}` });
                      }}
                      className="text-[11px] text-orange-600 font-bold hover:underline"
                    >
                      অটো জেনারেট
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="যেমন: JX-SH-001"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-orange-500 uppercase"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    বারকোড (Barcode / EAN-13)
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="যেমন: 8901002001"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    মূল ক্যাটাগরি *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                  >
                    <option value="shoes">জুতা (Shoes)</option>
                    <option value="bags">ব্যাগ (Bags)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    সাব-ক্যাটাগরি
                  </label>
                  <input
                    type="text"
                    value={formData.subCategory}
                    onChange={(e) => setFormData({ ...formData, subCategory: e.target.value })}
                    placeholder="যেমন: Sneakers, Formal, Loafers"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Price, Cost Price, Original Price */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    বিক্রয় মূল্য (Price ৳) *
                  </label>
                  <input
                    type="number"
                    required
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                    placeholder="যেমন: 3500"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    ক্রয়মূল্য (Cost Price ৳)
                  </label>
                  <input
                    type="number"
                    value={formData.costPrice}
                    onChange={(e) => setFormData({ ...formData, costPrice: e.target.value })}
                    placeholder="যেমন: 2200"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    পূর্বের মূল্য (Original ৳)
                  </label>
                  <input
                    type="number"
                    value={formData.originalPrice}
                    onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                    placeholder="যেমন: 4200"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Supplier & Min Alert */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    সাপ্লায়ার / প্রস্তুতকারক
                  </label>
                  <input
                    type="text"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    placeholder="যেমন: হাজারীবাগ লেদার ক্রাফট"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    লো-স্টক সতর্কতা লেভেল (Min Alert)
                  </label>
                  <input
                    type="number"
                    value={formData.minStockAlert}
                    onChange={(e) => setFormData({ ...formData, minStockAlert: e.target.value })}
                    placeholder="যেমন: 5"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    সাইজসমূহ (কমা দিয়ে আলাদা করুন)
                  </label>
                  <input
                    type="text"
                    value={formData.sizes}
                    onChange={(e) => setFormData({ ...formData, sizes: e.target.value })}
                    placeholder="যেমন: 39, 40, 41, 42, 43"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    কালারসমূহ (কমা দিয়ে আলাদা করুন)
                  </label>
                  <input
                    type="text"
                    value={formData.colors}
                    onChange={(e) => setFormData({ ...formData, colors: e.target.value })}
                    placeholder="যেমন: Black, Brown, Tan"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  প্রোডাক্টের ছবি (গ্যালারি) *
                </label>

                {/* ডাইরেক্ট ফাইল পিকার (একাধিক ছবি) */}
                <div className="p-4 border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-md bg-slate-50/70 text-center transition-colors">
                  <input
                    type="file"
                    id="fileUploadInput"
                    accept="image/*"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="fileUploadInput"
                    className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <div className="w-10 h-10 rounded-md bg-orange-100 text-orange-600 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">
                      {uploadingImage ? 'ছবি আপলোড হচ্ছে...' : 'কম্পিউটার বা মোবাইল থেকে ছবি সিলেক্ট করুন (একাধিকও চলবে)'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      JPG, PNG বা WebP (সর্বোচ্চ 5MB) — প্রথম ছবিটি কভার হিসেবে দেখাবে
                    </span>
                  </label>
                </div>

                {/* লিংক দিয়ে ছবি যোগ */}
                <div className="flex gap-2 pt-2">
                  <input
                    type="text"
                    value={pendingUrl}
                    onChange={(e) => setPendingUrl(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        const u = pendingUrl.trim();
                        if (u) {
                          setFormData((p) => ({ ...p, imageUrls: [...p.imageUrls, u] }));
                          setPendingUrl('');
                        }
                      }
                    }}
                    placeholder="https://... ছবির লিংক লিখে যোগ করুন"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const u = pendingUrl.trim();
                      if (!u) return;
                      setFormData((p) => ({ ...p, imageUrls: [...p.imageUrls, u] }));
                      setPendingUrl('');
                    }}
                    className="px-4 py-2 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors"
                  >
                    যোগ করুন
                  </button>
                </div>

                {/* ছবির গ্যালারি */}
                {formData.imageUrls.length > 0 ? (
                  <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3 pt-1">
                    {formData.imageUrls.map((u, idx) => (
                      <div
                        key={idx}
                        className="relative aspect-square rounded-md overflow-hidden border border-slate-200 group bg-slate-50"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={u} alt={`ছবি ${idx + 1}`} className="w-full h-full object-cover" />
                        {idx === 0 && (
                          <span className="absolute top-1.5 left-1.5 bg-orange-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md">
                            কভার
                          </span>
                        )}
                        <div className="absolute inset-0 bg-slate-900/55 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            title="এডিট করুন — ক্রপ, রোটেট, কালার"
                            onClick={() => setEditorIndex(idx)}
                            className="p-2 bg-white/95 rounded-md text-slate-700 hover:bg-white"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          {idx !== 0 && (
                            <button
                              type="button"
                              title="কভার বানান"
                              onClick={() =>
                                setFormData((p) => ({
                                  ...p,
                                  imageUrls: [p.imageUrls[idx], ...p.imageUrls.filter((_, i) => i !== idx)],
                                }))
                              }
                              className="p-2 bg-white/95 rounded-md text-amber-600 hover:bg-white"
                            >
                              <Star className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="মুছে ফেলুন"
                            onClick={() => {
                              setFormData((p) => ({ ...p, imageUrls: p.imageUrls.filter((_, i) => i !== idx) }));
                              if (editorIndex === idx) setEditorIndex(null);
                            }}
                            className="p-2 bg-white/95 rounded-md text-red-600 hover:bg-white"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 pt-1 flex items-start gap-1.5 leading-relaxed">
                    <ImageIcon className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    এখনো কোনো ছবি যোগ হয়নি — আপলোড করুন বা লিংক দিন। প্রতিটি ছবিতে এডিট করা যাবে: ফ্রি ক্রপ, যেকোনো ডিগ্রিতে রোটেট, ফ্লিপ ও কালার ব্যালেন্স।
                  </p>
                )}

                {/* ছবি এডিটর */}
                {editorIndex !== null && formData.imageUrls[editorIndex] && (
                  <ImageEditor
                    src={formData.imageUrls[editorIndex]}
                    onClose={() => setEditorIndex(null)}
                    onSave={(dataUrl) => {
                      setFormData((p) => ({
                        ...p,
                        imageUrls: p.imageUrls.map((x, i) => (i === editorIndex ? dataUrl : x)),
                      }));
                      setEditorIndex(null);
                    }}
                  />
                )}
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase">
                    বিবরণ (Description)
                  </label>
                  <button
                    type="button"
                    onClick={generateDescription}
                    disabled={aiDescLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-orange-600 text-white text-[10px] font-bold hover:opacity-90 disabled:opacity-60 transition-all"
                  >
                    {aiDescLoading ? (
                      <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Sparkles className="w-3 h-3" />
                    )}
                    {aiDescLoading ? 'AI লিখছে…' : 'AI দিয়ে লিখুন'}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="পণ্যের বৈশিষ্ট্য, ম্যাটেরিয়াল ইত্যাদি লিখুন... অথবা AI বাটন চেপে নিজে থেকেই লিখে নিন"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    স্টক সংখ্যা
                  </label>
                  <input
                    type="number"
                    value={formData.stockCount}
                    onChange={(e) => setFormData({ ...formData, stockCount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                  />
                </div>

                <div className="flex items-center gap-2 md:pt-6">
                  <input
                    type="checkbox"
                    id="inStockCheck"
                    checked={formData.inStock}
                    onChange={(e) => setFormData({ ...formData, inStock: e.target.checked })}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <label htmlFor="inStockCheck" className="text-xs font-bold text-slate-700">
                    ইন স্টকে আছে
                  </label>
                </div>

                <div className="flex items-center gap-2 md:pt-6">
                  <input
                    type="checkbox"
                    id="featuredCheck"
                    checked={formData.isFeatured}
                    onChange={(e) => setFormData({ ...formData, isFeatured: e.target.checked })}
                    className="w-4 h-4 text-orange-600 rounded"
                  />
                  <label htmlFor="featuredCheck" className="text-xs font-bold text-slate-700">
                    হট ডিল / ফিচার্ড
                  </label>
                </div>
              </div>

              </form>

              <div className="flex-shrink-0 bg-white border-t border-slate-100 px-5 sm:px-8 py-4 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-md border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  form="product-form"
                  className="px-6 py-2.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                >
                  {editingProduct ? 'আপডেট সংরক্ষণ করুন' : 'প্রোডাক্ট সেভ করুন'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { Product } from '@/types';
import { formatPrice } from '@/lib/utils';
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
  Upload
} from 'lucide-react';

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [uploadingImage, setUploadingImage] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Form State
  const [formData, setFormData] = useState({
    name: '',
    category: 'shoes',
    subCategory: 'Sneakers',
    price: '',
    originalPrice: '',
    description: '',
    sizes: '40, 41, 42, 43, 44',
    colors: 'Black, Brown',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800',
    stockCount: '20',
    inStock: true,
    isFeatured: false,
  });

  // Inline Price Editing State
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [inlinePrice, setInlinePrice] = useState<string>('');

  const loadProducts = async () => {
    try {
      const res = await fetch('/api/products');
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
  }, []);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData({
      name: '',
      category: 'shoes',
      subCategory: 'Sneakers',
      price: '',
      originalPrice: '',
      description: '',
      sizes: '40, 41, 42, 43, 44',
      colors: 'Black, Brown',
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800',
      stockCount: '20',
      inStock: true,
      isFeatured: false,
    });
    setIsModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      subCategory: product.subCategory || '',
      price: product.price.toString(),
      originalPrice: product.originalPrice ? product.originalPrice.toString() : '',
      description: product.description,
      sizes: product.sizes.join(', '),
      colors: product.colors.map((c) => c.name).join(', '),
      imageUrl: product.images[0] || '',
      stockCount: product.stockCount.toString(),
      inStock: product.inStock,
      isFeatured: Boolean(product.isFeatured),
    });
    setIsModalOpen(true);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingImage(true);
    try {
      const uploadData = new FormData();
      uploadData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: uploadData,
      });
      if (res.ok) {
        const data = await res.json();
        setFormData((prev) => ({ ...prev, imageUrl: data.url }));
      } else {
        alert('ছবি আপলোড করতে সমস্যা হয়েছে');
      }
    } catch (err) {
      alert('ছবি আপলোড ব্যর্থ হয়েছে');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();

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
      name: formData.name,
      category: formData.category,
      subCategory: formData.subCategory,
      price: Number(formData.price),
      originalPrice: formData.originalPrice ? Number(formData.originalPrice) : undefined,
      description: formData.description,
      sizes: sizesArr.length > 0 ? sizesArr : ['Standard'],
      colors: colorsArr.length > 0 ? colorsArr : [{ name: 'Black', hex: '#000000' }],
      images: [formData.imageUrl],
      stockCount: Number(formData.stockCount),
      inStock: formData.inStock,
      isFeatured: formData.isFeatured,
    };

    try {
      const url = editingProduct ? `/api/products/${editingProduct.id}` : '/api/products';
      const method = editingProduct ? 'PUT' : 'POST';

      const res = await fetch(url, {
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
        const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
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
      const res = await fetch(`/api/products/${id}`, {
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            প্রোডাক্ট ম্যানেজমেন্ট
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            নতুন জুতা ও ব্যাগ আপলোড করুন, দাম পরিবর্তন করুন এবং স্টক পরিচালনা করুন।
          </p>
        </div>

        <button
          onClick={openAddModal}
          className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold shadow-lg shadow-orange-600/30 transition-all transform hover:-translate-y-0.5"
        >
          <Plus className="w-4 h-4" />
          <span>নতুন প্রোডাক্ট আপলোড</span>
        </button>
      </div>

      {/* Filters & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="relative w-full sm:w-80">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="প্রোডাক্টের নাম দিয়ে খুঁজুন..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2.5 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <span className="text-xs font-semibold text-slate-500">ক্যাটাগরি:</span>
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none"
          >
            <option value="all">সকল পণ্য ({products.length})</option>
            <option value="shoes">👟 জুতা (Shoes)</option>
            <option value="bags">🎒 ব্যাগ (Bags)</option>
          </select>
        </div>
      </div>

      {/* Product Table */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
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
                        className="w-14 h-14 rounded-xl object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
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
                        <div className="flex items-center gap-2 mt-0.5">
                          {p.isFeatured && (
                            <span className="text-[10px] font-bold text-orange-600 bg-orange-50 px-2 py-0.5 rounded">
                              হট ডিল
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
                          className="w-24 px-2 py-1 text-xs border border-orange-500 rounded-lg focus:outline-none"
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
                        <div className="font-black text-slate-900 group-hover:text-orange-600">
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
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                        ইন স্টক ({p.stockCount} টি)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full bg-red-50 text-red-700 border border-red-200">
                        স্টক আউট
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-6 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => openEditModal(p)}
                        className="p-2 text-slate-500 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                        title="সম্পূর্ণ এডিট করুন"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteProduct(p.id)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
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

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-6">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                <Tag className="w-5 h-5 text-orange-600" />
                <span>{editingProduct ? 'প্রোডাক্ট এডিট করুন' : 'নতুন প্রোডাক্ট আপলোড'}</span>
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="space-y-5">
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
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    মূল ক্যাটাগরি *
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-semibold"
                  >
                    <option value="shoes">👟 জুতা (Shoes)</option>
                    <option value="bags">🎒 ব্যাগ (Bags)</option>
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    পূর্বের মূল্য (Original Price ৳ - ছাড় দেখানোর জন্য)
                  </label>
                  <input
                    type="number"
                    value={formData.originalPrice}
                    onChange={(e) => setFormData({ ...formData, originalPrice: e.target.value })}
                    placeholder="যেমন: 4200"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
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
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 uppercase">
                  প্রোডাক্টের ছবি (Image Upload) *
                </label>

                {/* Direct File Picker */}
                <div className="p-4 border-2 border-dashed border-slate-300 hover:border-orange-500 rounded-2xl bg-slate-50/70 text-center transition-colors">
                  <input
                    type="file"
                    id="fileUploadInput"
                    accept="image/*"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                  <label
                    htmlFor="fileUploadInput"
                    className="cursor-pointer flex flex-col items-center justify-center gap-1.5"
                  >
                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                      <Upload className="w-5 h-5" />
                    </div>
                    <span className="text-xs font-bold text-slate-800">
                      {uploadingImage ? 'ছবি আপলোড হচ্ছে...' : 'কম্পিউটার বা মোবাইল থেকে ছবি সিলেক্ট করুন'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      JPG, PNG বা WebP ফরম্যাট (সর্বোচ্চ 5MB)
                    </span>
                  </label>
                </div>

                {/* Direct URL Input fallback */}
                <div className="pt-2">
                  <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                    অথবা সরাসরি ছবির লিংক/URL দিন:
                  </span>
                  <input
                    type="text"
                    required
                    value={formData.imageUrl}
                    onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                    placeholder="https://... অথবা /uploads/..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                  />
                </div>

                {/* Image Preview */}
                {formData.imageUrl && (
                  <div className="mt-2 flex items-center gap-3 p-2 bg-slate-100 rounded-xl border border-slate-200">
                    <img
                      src={formData.imageUrl}
                      alt="Preview"
                      className="w-14 h-14 rounded-lg object-cover border bg-white"
                    />
                    <div>
                      <span className="text-xs font-bold text-emerald-700 flex items-center gap-1">
                        <Check className="w-3.5 h-3.5" /> ছবি সফলভাবে সিলেক্ট হয়েছে
                      </span>
                      <span className="text-[11px] text-slate-500 truncate block max-w-xs font-mono">
                        {formData.imageUrl}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  বিবরণ (Description)
                </label>
                <textarea
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="পণ্যের বৈশিষ্ট্য, ম্যাটেরিয়াল ইত্যাদি লিখুন..."
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    স্টক সংখ্যা
                  </label>
                  <input
                    type="number"
                    value={formData.stockCount}
                    onChange={(e) => setFormData({ ...formData, stockCount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none"
                  />
                </div>

                <div className="flex items-center gap-2 pt-6">
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

                <div className="flex items-center gap-2 pt-6">
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

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md"
                >
                  {editingProduct ? 'আপডেট সংরক্ষণ করুন' : 'প্রোডাক্ট সেভ করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

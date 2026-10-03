'use client';

export const runtime = 'edge';

import React, { useState, useEffect } from 'react';
import { Product, InventoryMovement, ProductVariant } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';
import {
  Boxes,
  Plus,
  Search,
  Filter,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  Package,
  Layers,
  ArrowUpRight,
  ArrowDownLeft,
  RotateCcw,
  Truck,
  Printer,
  History,
  FileText,
  Barcode,
  Tag,
  X,
  Check,
  Building,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { apiFetch } from '@/lib/offline/apiFetch';

export default function AdminInventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [summary, setSummary] = useState({
    totalSkus: 0,
    totalUnits: 0,
    totalCostValue: 0,
    totalRetailValue: 0,
    potentialProfit: 0,
    profitMarginPercent: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
  });
  const [loading, setLoading] = useState(true);

  // Filter & Search States
  const [activeTab, setActiveTab] = useState<'inventory' | 'movements' | 'lowstock'>('inventory');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [stockStatusFilter, setStockStatusFilter] = useState<'all' | 'instock' | 'lowstock' | 'outofstock'>('all');

  // Restock Modal State
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false);
  const [selectedProductForRestock, setSelectedProductForRestock] = useState<Product | null>(null);
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockCost, setRestockCost] = useState<string>('');
  const [restockInvoice, setRestockInvoice] = useState<string>('');
  const [restockNote, setRestockNote] = useState<string>('');
  const [restockSubmitting, setRestockSubmitting] = useState(false);

  // AI ইনসাইট ডিপ-লিংক: /admin/inventory?restock=<productId> → রিস্টক মোডাল প্রি-ফিল
  useEffect(() => {
    if (loading || products.length === 0) return;
    const productId = new URLSearchParams(window.location.search).get('restock');
    if (!productId) return;
    const product = products.find(p => p.id === productId);
    if (product) {
      setSelectedProductForRestock(product);
      setRestockQty(10);
      setIsRestockModalOpen(true);
      setActiveTab('inventory');
      // হিস্ট্রি থেকে প্যারাম সরিয়ে দেয় — রিলোডে আবার না খোলে
      window.history.replaceState({}, '', '/admin/inventory');
    }
  }, [loading, products]);

  // Stock Adjustment Modal State
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [selectedProductForAdjust, setSelectedProductForAdjust] = useState<Product | null>(null);
  const [adjustTargetStock, setAdjustTargetStock] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<'DAMAGE' | 'RETURN' | 'ADJUSTMENT'>('ADJUSTMENT');
  const [adjustNote, setAdjustNote] = useState<string>('');
  const [adjustSubmitting, setAdjustSubmitting] = useState(false);

  // Success / Alert message
  const [feedbackMsg, setFeedbackMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // AI Restock Plan State
  const [aiPlan, setAiPlan] = useState<{ summary: string; plan: { productId: string; productName: string; recommendedQuantity: number; reason: string }[] } | null>(null);
  const [aiPlanLoading, setAiPlanLoading] = useState(false);

  const loadRestockPlan = async () => {
    setAiPlanLoading(true);
    try {
      const res = await apiFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restock-plan' }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.plan !== undefined) {
        setAiPlan({ summary: data.summary || '', plan: data.plan || [] });
      } else {
        showFeedback('error', data?.error || 'AI রিস্টক প্ল্যান আনা যায়নি');
      }
    } catch {
      showFeedback('error', 'সার্ভারে সংযোগ করা যায়নি');
    } finally {
      setAiPlanLoading(false);
    }
  };

  const loadInventory = async () => {
    try {
      setLoading(true);
      const res = await apiFetch('/api/inventory');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
        setMovements(data.movements || []);
        if (data.summary) setSummary(data.summary);
      }
    } catch (e) {
      console.error('Error loading inventory:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInventory();
  }, []);

  const showFeedback = (type: 'success' | 'error', text: string) => {
    setFeedbackMsg({ type, text });
    setTimeout(() => setFeedbackMsg(null), 4000);
  };

  // Open Restock Modal
  const openRestockModal = (product?: Product) => {
    const target = product || products[0] || null;
    setSelectedProductForRestock(target);
    setRestockQty(10);
    setRestockCost(target ? String(target.costPrice || '') : '');
    setRestockInvoice('');
    setRestockNote('');
    setIsRestockModalOpen(true);
  };

  // Submit Restock
  const handleRestockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForRestock || restockQty <= 0) return;

    setRestockSubmitting(true);
    try {
      const res = await apiFetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restock',
          productId: selectedProductForRestock.id,
          quantity: Number(restockQty),
          unitCost: restockCost ? Number(restockCost) : undefined,
          supplierOrInvoice: restockInvoice.trim() || undefined,
          note: restockNote.trim() || undefined,
        }),
      });

      if (res.ok) {
        setIsRestockModalOpen(false);
        showFeedback('success', `${selectedProductForRestock.name}-এ সফলভাবে ${restockQty} পিস স্টক যুক্ত হয়েছে!`);
        loadInventory();
      } else {
        showFeedback('error', 'স্টক যুক্ত করতে সমস্যা হয়েছে।');
      }
    } catch (err) {
      showFeedback('error', 'সার্ভারে ত্রুটি হয়েছে।');
    } finally {
      setRestockSubmitting(false);
    }
  };

  // Open Adjust Modal
  const openAdjustModal = (product: Product) => {
    setSelectedProductForAdjust(product);
    setAdjustTargetStock(product.stockCount);
    setAdjustReason('ADJUSTMENT');
    setAdjustNote('');
    setIsAdjustModalOpen(true);
  };

  // Submit Adjustment
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProductForAdjust || adjustTargetStock < 0) return;

    setAdjustSubmitting(true);
    try {
      const res = await apiFetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust',
          productId: selectedProductForAdjust.id,
          newStock: Number(adjustTargetStock),
          reason: adjustReason,
          note: adjustNote.trim() || undefined,
        }),
      });

      if (res.ok) {
        setIsAdjustModalOpen(false);
        showFeedback('success', `${selectedProductForAdjust.name}-এর স্টক সমন্বয় সফল হয়েছে!`);
        loadInventory();
      } else {
        showFeedback('error', 'স্টক সমন্বয় করতে ব্যর্থ হয়েছে।');
      }
    } catch (err) {
      showFeedback('error', 'সার্ভারে ত্রুটি হয়েছে।');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  // Quick 1-step inline stock change (+1 or -1)
  const handleQuickInlineStock = async (product: Product, delta: number) => {
    const newStock = Math.max(0, product.stockCount + delta);
    try {
      const res = await apiFetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'adjust',
          productId: product.id,
          newStock,
          reason: delta > 0 ? 'ADJUSTMENT' : 'DAMAGE',
          note: delta > 0 ? 'দ্রুত ইনলাইন ১ পিস স্টক বৃদ্ধি' : 'দ্রুত ইনলাইন ১ পিস হ্রাস',
        }),
      });
      if (res.ok) {
        setProducts((prev) =>
          prev.map((p) => (p.id === product.id ? { ...p, stockCount: newStock, inStock: newStock > 0 } : p))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Filtered Products
  const filteredProducts = products.filter((p) => {
    const matchesQuery =
      !searchQuery ||
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.supplier && p.supplier.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesCategory = categoryFilter === 'all' || p.category === categoryFilter;

    let matchesStock = true;
    const minAlert = p.minStockAlert || 5;
    if (stockStatusFilter === 'instock') {
      matchesStock = p.stockCount > minAlert;
    } else if (stockStatusFilter === 'lowstock') {
      matchesStock = p.stockCount > 0 && p.stockCount <= minAlert;
    } else if (stockStatusFilter === 'outofstock') {
      matchesStock = p.stockCount === 0;
    }

    return matchesQuery && matchesCategory && matchesStock;
  });

  const lowStockList = products.filter(
    (p) => p.stockCount <= (p.minStockAlert || 5)
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Toast Feedback */}
      {feedbackMsg && (
        <div
          className={`fixed top-20 right-6 z-50 px-5 py-3 rounded-md border flex items-center gap-2.5 text-sm font-bold animate-in fade-in slide-in-from-top-4 duration-300 ${
            feedbackMsg.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
              : 'bg-red-50 text-red-800 border-red-300'
          }`}
        >
          {feedbackMsg.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600" />
          )}
          <span>{feedbackMsg.text}</span>
        </div>
      )}

      {/* Header — স্টিকি টুলবার */}
      <div className="sticky top-14 md:top-0 z-20 bg-slate-200 rounded-md border border-slate-200/80 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-2 rounded-md bg-orange-100 text-orange-700">
              <Boxes className="w-6 h-6" />
            </span>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              শপ ইনভেন্টরি ও স্টক ম্যানেজমেন্ট (ERP)
            </h1>
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1.5">
            প্রোডাক্ট কোড (SKU), বারকোড, সাইজ-কালার ভ্যারিয়েন্ট স্টক, চালান এন্ট্রি এবং ক্রয়মূল্য-লাভ ট্র্যাকিং।
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <button
            onClick={() => openRestockModal()}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs sm:text-sm font-bold transition-all transform hover:-translate-y-0.5"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন চালান স্টক ইন</span>
          </button>

          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs sm:text-sm font-bold transition-all"
            title="ইনভেন্টরি শিট প্রিন্ট করুন"
          >
            <Printer className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline">রিপোর্ট প্রিন্ট</span>
          </button>

          <button
            onClick={loadInventory}
            disabled={loading}
            className="p-2.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-all"
            title="রিফ্রেশ করুন"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-orange-600' : ''}`} />
          </button>
        </div>
      </div>

      {/* KPI Cards (Financial & Operational Summary) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-5">
        {/* Total Stock Units */}
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200/90 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">মোট মজুদ পণ্য</span>
            <span className="w-9 h-9 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-2xl sm:text-3xl font-bold text-slate-900">{summary.totalUnits}</span>
            <span className="text-xs text-slate-500 ml-1.5 font-semibold">পিস</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            {summary.totalSkus} টি স্বতন্ত্র SKU / আইটেম
          </p>
        </div>

        {/* Total Cost Value (ক্রয়মূল্য ভ্যালুয়েশন) */}
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200/90 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">ইনভেন্টরি ক্রয়মূল্য</span>
            <span className="w-9 h-9 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <DollarSign className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-bold text-slate-900">{formatPrice(summary.totalCostValue)}</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            মোট পাইকারি খরচ মূল্য
          </p>
        </div>

        {/* Total Retail Value & Profit */}
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200/90 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">সম্ভাব্য বিক্রয়মূল্য</span>
            <span className="w-9 h-9 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3">
            <span className="text-xl sm:text-2xl font-bold text-emerald-600">{formatPrice(summary.totalRetailValue)}</span>
          </div>
          <p className="text-[11px] text-emerald-700 font-semibold mt-1">
            সম্ভাব্য লাভ: {formatPrice(summary.potentialProfit)} ({summary.profitMarginPercent}%)
          </p>
        </div>

        {/* Low Stock & Out of Stock Alerts */}
        <div className="bg-white p-4 sm:p-5 rounded-md border border-slate-200/90 relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">লো-স্টক অ্যালার্ট</span>
            <span className={`w-9 h-9 rounded-md flex items-center justify-center ${summary.lowStockCount > 0 ? 'bg-red-50 text-red-600' : 'bg-slate-100 text-slate-500'}`}>
              <AlertTriangle className="w-5 h-5" />
            </span>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className={`text-2xl sm:text-3xl font-bold ${summary.lowStockCount > 0 ? 'text-red-600' : 'text-slate-900'}`}>
              {summary.lowStockCount}
            </span>
            <span className="text-xs text-slate-500 font-medium">টি রি-অর্ডার প্রয়োজন</span>
          </div>
          <p className="text-[11px] text-slate-400 mt-1">
            আউট অব স্টক: <span className="font-bold text-slate-700">{summary.outOfStockCount} টি</span>
          </p>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white rounded-md p-1.5 border border-slate-200/90 flex items-center gap-1 overflow-x-auto">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'inventory'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <Boxes className="w-4 h-4" />
          <span>সকল প্রোডাক্ট স্টক ({products.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('movements')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'movements'
              ? 'bg-slate-900 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <History className="w-4 h-4" />
          <span>স্টক মুভমেন্ট ও চালান লগ ({movements.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('lowstock')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-md text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
            activeTab === 'lowstock'
              ? 'bg-red-600 text-white'
              : 'text-slate-600 hover:bg-slate-100'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>রি-অর্ডার সতর্কতা ({lowStockList.length})</span>
        </button>
      </div>

      {/* TAB 1: ALL INVENTORY PRODUCTS */}
      {activeTab === 'inventory' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-md border border-slate-200/90 flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="প্রোডাক্টের নাম, SKU কোড (যেমন: JX-SH-001), বারকোড বা সাপ্লায়ার খুঁজুন..."
                className="w-full bg-slate-50 border border-slate-200 rounded-md pl-10 pr-4 py-2.5 text-xs sm:text-sm focus:outline-hidden focus:ring-2 focus:ring-orange-500 font-sans"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            </div>

            {/* Filter Dropdowns */}
            <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">সকল ক্যাটাগরি</option>
                <option value="shoes">জুতা (Shoes)</option>
                <option value="bags">ব্যাগ (Bags)</option>
              </select>

              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value as any)}
                className="bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-xs font-semibold text-slate-700 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              >
                <option value="all">সকল স্টক অবস্থা</option>
                <option value="instock">পর্যাপ্ত স্টক (&gt;5)</option>
                <option value="lowstock">লো স্টক (১-৫)</option>
                <option value="outofstock">স্টক শেষ (০)</option>
              </select>
            </div>
          </div>

          {/* Inventory Table */}
          <div className="bg-white rounded-md border border-slate-200/90 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-slate-600">
                <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
                  <tr>
                    <th className="py-4 px-6">SKU / কোড</th>
                    <th className="py-4 px-6">প্রোডাক্ট বিবরণ</th>
                    <th className="py-4 px-6">ভ্যারিয়েন্ট ব্রেকডাউন</th>
                    <th className="py-4 px-6">ক্রয়মূল্য ও বিক্রয়মূল্য</th>
                    <th className="py-4 px-6 text-center">বর্তমান স্টক</th>
                    <th className="py-4 px-6">স্ট্যাটাস</th>
                    <th className="py-4 px-6 text-right">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-slate-400">
                        কোনো প্রোডাক্ট খুঁজে পাওয়া যায়নি।
                      </td>
                    </tr>
                  ) : (
                    filteredProducts.map((p) => {
                      const minAlert = p.minStockAlert || 5;
                      const isOutOfStock = p.stockCount === 0;
                      const isLowStock = p.stockCount > 0 && p.stockCount <= minAlert;
                      const profitPerUnit = (p.price || 0) - (p.costPrice || 0);

                      return (
                        <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                          {/* SKU & Barcode */}
                          <td className="py-4 px-6 align-top">
                            <div className="font-mono font-bold text-xs text-slate-900 bg-slate-100 px-2.5 py-1 rounded-md inline-block border border-slate-200">
                              {p.sku}
                            </div>
                            {p.barcode && (
                              <div className="flex items-center gap-1 text-[10px] text-slate-400 mt-1 font-mono">
                                <Barcode className="w-3.5 h-3.5" />
                                <span>{p.barcode}</span>
                              </div>
                            )}
                            <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]">
                              {p.supplier || 'প্রধান সরবরাহকারী'}
                            </div>
                          </td>

                          {/* Product Image & Info */}
                          <td className="py-4 px-6 align-top">
                            <div className="flex items-center gap-3">
                              <img
                                src={p.images[0]}
                                alt={p.name}
                                className="w-12 h-12 rounded-md object-cover bg-slate-100 border border-slate-200 shrink-0"
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
                                <div className="text-xs text-slate-400 capitalize mt-0.5">
                                  {p.subCategory || (p.category === 'shoes' ? 'জুতা' : 'ব্যাগ')}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* Variants Breakdown */}
                          <td className="py-4 px-6 align-top">
                            {p.variants && p.variants.length > 0 ? (
                              <div className="flex flex-wrap gap-1 max-w-xs">
                                {p.variants.map((v) => (
                                  <span
                                    key={v.id}
                                    className={`text-[10px] px-2 py-0.5 rounded-md font-semibold border ${
                                      v.stock === 0
                                        ? 'bg-red-50 text-red-600 border-red-200 line-through'
                                        : v.stock <= 2
                                        ? 'bg-amber-50 text-amber-800 border-amber-200'
                                        : 'bg-slate-100 text-slate-700 border-slate-200'
                                    }`}
                                    title={`${v.size} - ${v.color}: ${v.stock} পিস`}
                                  >
                                    {v.size}: <span className="font-bold">{v.stock}</span>
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <div className="flex flex-wrap gap-1 text-[10px] text-slate-500">
                                {p.sizes.slice(0, 4).map((s) => (
                                  <span key={s} className="bg-slate-100 px-1.5 py-0.5 rounded-sm">
                                    {s}
                                  </span>
                                ))}
                              </div>
                            )}
                          </td>

                          {/* Prices & Profit */}
                          <td className="py-4 px-6 align-top">
                            <div className="text-xs space-y-0.5">
                              <div>
                                <span className="text-slate-400">ক্রয়:</span>{' '}
                                <span className="font-bold text-slate-800">{formatPrice(p.costPrice || 0)}</span>
                              </div>
                              <div>
                                <span className="text-slate-400">বিক্রয়:</span>{' '}
                                <span className="font-bold text-slate-900">{formatPrice(p.price)}</span>
                              </div>
                              <div className="text-[10px] text-emerald-600 font-bold">
                                লাভ: +{formatPrice(profitPerUnit)}
                              </div>
                            </div>
                          </td>

                          {/* Stock Count with Inline Controls */}
                          <td className="py-4 px-6 align-top text-center">
                            <div className="inline-flex items-center gap-1.5 bg-slate-100 p-1 rounded-md border border-slate-200">
                              <button
                                onClick={() => handleQuickInlineStock(p, -1)}
                                className="w-6 h-6 rounded-md bg-white text-slate-700 font-bold hover:bg-red-50 hover:text-red-600 text-xs flex items-center justify-center"
                                title="১ পিস কমান"
                              >
                                -
                              </button>
                              <span className="w-10 text-center font-bold text-sm text-slate-900">
                                {p.stockCount}
                              </span>
                              <button
                                onClick={() => handleQuickInlineStock(p, 1)}
                                className="w-6 h-6 rounded-md bg-white text-slate-700 font-bold hover:bg-emerald-50 hover:text-emerald-600 text-xs flex items-center justify-center"
                                title="১ পিস বাড়ান"
                              >
                                +
                              </button>
                            </div>
                            <div className="text-[10px] text-slate-400 mt-1">
                              ভ্যালু: {formatPrice((p.costPrice || 0) * p.stockCount)}
                            </div>
                          </td>

                          {/* Stock Status Badge */}
                          <td className="py-4 px-6 align-top">
                            {isOutOfStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 text-red-800">
                                <X className="w-3 h-3" /> শেষ
                              </span>
                            ) : isLowStock ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-amber-100 text-amber-800">
                                <AlertTriangle className="w-3 h-3" /> লো স্টক ({p.stockCount})
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-100 text-emerald-800">
                                <Check className="w-3 h-3" /> মজুদ আছে
                              </span>
                            )}
                          </td>

                          {/* Action Buttons */}
                          <td className="py-4 px-6 align-top text-right space-x-1.5 whitespace-nowrap">
                            <button
                              onClick={() => openRestockModal(p)}
                              className="px-2.5 py-1.5 rounded-md bg-orange-50 hover:bg-orange-100 text-orange-600 text-xs font-bold transition-colors"
                              title="নতুন চালান যুক্ত করুন"
                            >
                              + চালান
                            </button>
                            <button
                              onClick={() => openAdjustModal(p)}
                              className="px-2.5 py-1.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors"
                              title="স্টক অডিট বা ড্যামেজ অ্যাডজাস্ট"
                            >
                              অ্যাডজাস্ট
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: INVENTORY MOVEMENTS AUDIT LOG */}
      {activeTab === 'movements' && (
        <div className="bg-white rounded-md border border-slate-200/90 overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">স্টক মুভমেন্ট ও চালান ট্র্যাকিং লগ</h3>
              <p className="text-xs text-slate-400 mt-0.5">নতুন চালান, বিক্রয়, রিটার্ন ও অডিট অ্যাডজাস্টমেন্টের সম্পূর্ণ হিস্ট্রি।</p>
            </div>
            <span className="text-xs font-bold text-slate-500 bg-slate-100 px-3 py-1 rounded-md">
              মোট {movements.length} টি রেকর্ড
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
                <tr>
                  <th className="py-3.5 px-6">তারিখ ও সময়</th>
                  <th className="py-3.5 px-6">টাইপ</th>
                  <th className="py-3.5 px-6">প্রোডাক্ট ও SKU</th>
                  <th className="py-3.5 px-6">ভ্যারিয়েন্ট</th>
                  <th className="py-3.5 px-6 text-center">পরিমাণ</th>
                  <th className="py-3.5 px-6">স্টক পরিবর্তন</th>
                  <th className="py-3.5 px-6">রেফারেন্স / চালান</th>
                  <th className="py-3.5 px-6">নোট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {movements.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400">
                      কোনো মুভমেন্ট হিস্ট্রি পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  movements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3.5 px-6 text-xs text-slate-500 whitespace-nowrap">
                        {formatDate(m.createdAt)}
                      </td>
                      <td className="py-3.5 px-6">
                        {m.type === 'RESTOCK' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800">
                            <ArrowDownLeft className="w-3 h-3" /> চালান ইন
                          </span>
                        )}
                        {m.type === 'SALE' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800">
                            <ArrowUpRight className="w-3 h-3" /> বিক্রয়
                          </span>
                        )}
                        {m.type === 'DAMAGE' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-red-100 text-red-800">
                            <X className="w-3 h-3" /> ড্যামেজ
                          </span>
                        )}
                        {m.type === 'RETURN' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-purple-100 text-purple-800">
                            <RotateCcw className="w-3 h-3" /> রিটার্ন
                          </span>
                        )}
                        {m.type === 'ADJUSTMENT' && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-slate-200 text-slate-800">
                            অ্যাডজাস্টমেন্ট
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-6">
                        <div className="font-bold text-xs text-slate-900">{m.productName}</div>
                        <div className="font-mono text-[10px] text-slate-400">{m.sku}</div>
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-500">
                        {m.variantInfo || 'স্ট্যান্ডার্ড'}
                      </td>
                      <td className="py-3.5 px-6 text-center">
                        <span
                          className={`font-bold text-xs ${
                            m.quantity > 0 ? 'text-emerald-600' : 'text-red-600'
                          }`}
                        >
                          {m.quantity > 0 ? `+${m.quantity}` : m.quantity}
                        </span>
                      </td>
                      <td className="py-3.5 px-6 text-xs font-mono">
                        <span className="text-slate-400">{m.previousStock}</span>
                        <ArrowRight className="w-3.5 h-3.5 text-slate-400 inline mx-1.5" />
                        <span className="font-bold text-slate-800">{m.newStock}</span>
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-600">
                        {m.supplierOrInvoice || '-'}
                      </td>
                      <td className="py-3.5 px-6 text-xs text-slate-500 max-w-xs truncate">
                        {m.note || '-'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: LOW STOCK REORDER SHEET */}
      {activeTab === 'lowstock' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 p-4 rounded-md flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className="w-6 h-6 text-amber-600 shrink-0" />
              <div>
                <h4 className="text-sm font-bold text-amber-900">রি-অর্ডার তালিকা (Reorder Alert Sheet)</h4>
                <p className="text-xs text-amber-700">
                  নিচের পণ্যগুলোর স্টক ন্যূনতম সতর্কতার নিচে নেমে গেছে। ফ্যাক্টরি বা সাপ্লায়ারকে দ্রুত নতুন চালানের অর্ডার দিন।
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={loadRestockPlan}
                disabled={aiPlanLoading}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-xs font-bold disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {aiPlanLoading ? (
                  <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
                )}
                AI রিস্টক প্ল্যান
              </button>
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-md text-xs font-bold"
              >
                প্রিন্ট রি-অর্ডার স্লিপ
              </button>
            </div>
          </div>

          {/* AI রিস্টক প্ল্যান */}
          {aiPlanLoading && (
            <div className="bg-white border border-slate-200 rounded-md p-5 flex items-center gap-3 text-sm text-slate-600">
              <span className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin shrink-0" />
              AI প্রতিটা প্রোডাক্টের বিক্রির গতি আর স্টক মিলিয়ে হিসাব করছে…
            </div>
          )}

          {aiPlan && !aiPlanLoading && (
            <div className="bg-white border-2 border-slate-900 rounded-md overflow-hidden">
              <div className="bg-slate-900 text-white px-5 py-3.5">
                <div className="text-xs font-bold flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-emerald-400" /> AI রিস্টক প্ল্যান
                </div>
                {aiPlan.summary && <p className="text-[11px] text-slate-300 mt-1 leading-relaxed">{aiPlan.summary}</p>}
              </div>
              <div className="divide-y divide-slate-100">
                {aiPlan.plan.map(item => {
                  const prod = products.find(p => p.id === item.productId);
                  return (
                    <div key={item.productId} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-3.5">
                      {prod?.images[0] && (
                        <img src={prod.images[0]} alt="" className="w-10 h-10 rounded-md object-cover border" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-900">{item.productName}</div>
                        <div className="text-[11px] text-slate-500">{item.reason}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-bold text-emerald-700 whitespace-nowrap">
                          +{item.recommendedQuantity} টি
                        </span>
                        <button
                          onClick={() => {
                            const target = products.find(p => p.id === item.productId);
                            if (target) {
                              openRestockModal(target);
                              setRestockQty(item.recommendedQuantity);
                            }
                          }}
                          className="px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-[11px] font-bold"
                        >
                          চালান দিন
                        </button>
                      </div>
                    </div>
                  );
                })}
                {aiPlan.plan.length === 0 && (
                  <div className="px-5 py-6 text-center text-sm text-emerald-700 font-bold">
                    🎉 AI বলছে — এই মুহূর্তে রিস্টক করার কিছু নেই, সব ঠিক আছে!
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lowStockList.map((p) => (
              <div
                key={p.id}
                className="bg-white rounded-md p-4 border border-slate-200 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 bg-slate-100 rounded-sm text-slate-700">
                      {p.sku}
                    </span>
                    <span className="text-xs font-bold text-red-600 bg-red-50 px-2 py-0.5 rounded-md border border-red-200">
                      অবশিষ্ট: {p.stockCount} টি
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <img
                      src={p.images[0]}
                      alt={p.name}
                      className="w-14 h-14 rounded-md object-cover border bg-slate-50"
                    />
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm line-clamp-1">{p.name}</h4>
                      <p className="text-xs text-slate-400 mt-0.5">সাপ্লায়ার: {p.supplier || 'প্রধান সরবরাহকারী'}</p>
                      <p className="text-xs text-slate-600 font-semibold mt-0.5">
                        ক্রয়মূল্য: {formatPrice(p.costPrice || 0)}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">মিনিমাম লেভেল: {p.minStockAlert || 5}</span>
                  <button
                    onClick={() => openRestockModal(p)}
                    className="px-3 py-1.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold"
                  >
                    চালান যোগ করুন
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* MODAL 1: RESTOCK SHIPMENT MODAL */}
      {isRestockModalOpen && selectedProductForRestock && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-lg w-full p-6 sm:p-8 border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-md bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <ArrowDownLeft className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">নতুন চালান স্টক ইন (Restock)</h3>
                  <p className="text-xs text-slate-400">পণ্যের চালান বা ইনভেন্টরি স্টক এন্ট্রি করুন</p>
                </div>
              </div>
              <button
                onClick={() => setIsRestockModalOpen(false)}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRestockSubmit} className="space-y-4">
              {/* Product Selector */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  প্রোডাক্ট নির্বাচন করুন *
                </label>
                <select
                  value={selectedProductForRestock.id}
                  onChange={(e) => {
                    const found = products.find((p) => p.id === e.target.value);
                    if (found) {
                      setSelectedProductForRestock(found);
                      setRestockCost(String(found.costPrice || ''));
                    }
                  }}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                >
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} (বর্তমান স্টক: {p.stockCount})
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity & Unit Cost */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    নতুন চালানের পরিমাণ (পিস) *
                  </label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={restockQty}
                    onChange={(e) => setRestockQty(Number(e.target.value))}
                    placeholder="যেমন: 20"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 text-sm font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                    ইউনিট ক্রয়মূল্য (Cost ৳)
                  </label>
                  <input
                    type="number"
                    value={restockCost}
                    onChange={(e) => setRestockCost(e.target.value)}
                    placeholder="যেমন: 2450"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 text-sm font-semibold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                  />
                </div>
              </div>

              {/* Supplier / Invoice */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  চালান / ইনভয়েস নং ও সাপ্লায়ারের নাম
                </label>
                <input
                  type="text"
                  value={restockInvoice}
                  onChange={(e) => setRestockInvoice(e.target.value)}
                  placeholder="যেমন: চালান #CH-2026-99, হাজারীবাগ লেদার"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  নোট / মন্তব্য (ঐচ্ছিক)
                </label>
                <input
                  type="text"
                  value={restockNote}
                  onChange={(e) => setRestockNote(e.target.value)}
                  placeholder="যেমন: শীতকালীন নতুন সাইজের লট"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              {/* Calculation Preview */}
              <div className="p-3.5 bg-slate-50 rounded-md border border-slate-200 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-600">
                  <span>বর্তমান স্টক:</span>
                  <span className="font-bold text-slate-900">{selectedProductForRestock.stockCount} টি</span>
                </div>
                <div className="flex justify-between text-emerald-600 font-bold">
                  <span>যোগ হচ্ছে:</span>
                  <span>+{restockQty} টি</span>
                </div>
                <div className="flex justify-between text-slate-900 font-bold border-t border-slate-200 pt-1.5">
                  <span>আপডেট পরবর্তী মোট স্টক:</span>
                  <span>{selectedProductForRestock.stockCount + restockQty} টি</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRestockModalOpen(false)}
                  className="px-4 py-2.5 rounded-md border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={restockSubmitting}
                  className="px-6 py-2.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {restockSubmitting ? 'সংরক্ষণ হচ্ছে...' : 'স্টক ইন নিশ্চিত করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: STOCK ADJUSTMENT MODAL */}
      {isAdjustModalOpen && selectedProductForAdjust && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-md max-w-lg w-full p-6 sm:p-8 border border-slate-200 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 mb-5">
              <div className="flex items-center gap-2">
                <span className="w-8 h-8 rounded-md bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <RotateCcw className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-slate-900">স্টক সমন্বয় (Stock Adjustment)</h3>
                  <p className="text-xs text-slate-400">ড্যামেজ, রিটার্ন বা অডিট কাউন্ট অনুযায়ী স্টক অ্যাডজাস্ট করুন</p>
                </div>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1.5 rounded-md hover:bg-slate-100 text-slate-400"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div className="p-3 bg-slate-50 rounded-md border border-slate-200">
                <div className="font-mono text-xs text-orange-600 font-bold">{selectedProductForAdjust.sku}</div>
                <div className="font-bold text-sm text-slate-900 mt-0.5">{selectedProductForAdjust.name}</div>
                <div className="text-xs text-slate-500 mt-1">
                  বর্তমান রেকর্ডকৃত স্টক: <span className="font-bold text-slate-800">{selectedProductForAdjust.stockCount} টি</span>
                </div>
              </div>

              {/* Target Stock */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  প্রকৃত নতুন স্টক সংখ্যা *
                </label>
                <input
                  type="number"
                  required
                  min={0}
                  value={adjustTargetStock}
                  onChange={(e) => setAdjustTargetStock(Number(e.target.value))}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 text-base font-bold text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                />
              </div>

              {/* Adjustment Reason */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  সমন্বয়ের কারণ *
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value as any)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2.5 text-xs font-semibold text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                >
                  <option value="ADJUSTMENT">ফিজিক্যাল স্টক অডিট (গণনায় কম/বেশি পাওয়া গেছে)</option>
                  <option value="DAMAGE">ড্যামেজ / নষ্ট পণ্য (স্টক থেকে বাদ)</option>
                  <option value="RETURN">কাস্টমার রিটার্ন ইন (স্টকে ফেরত এসেছে)</option>
                </select>
              </div>

              {/* Note */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  নোট / বিস্তারিত বিবরণ
                </label>
                <textarea
                  rows={2}
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                  placeholder="যেমন: স্যাম্পল ডিসপ্লেতে ১ পিস রাখা হয়েছে"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2 text-xs focus:outline-hidden focus:ring-2 focus:ring-orange-500 focus:border-orange-500 font-sans"
                />
              </div>

              {/* Actions */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2.5 rounded-md border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100"
                >
                  বাতিল
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting}
                  className="px-6 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-50"
                >
                  {adjustSubmitting ? 'আপডেট হচ্ছে...' : 'স্টক আপডেট করুন'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

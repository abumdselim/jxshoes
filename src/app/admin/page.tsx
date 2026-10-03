'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Product, Order, AIDailyBrief, AIInsights, FastMoverEntry } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';
import { TrendChart, DonutChart, BarList } from '@/components/admin/Charts';
import {
  TrendingUp,
  Package,
  ShoppingBag,
  Clock,
  ArrowRight,
  Plus,
  AlertTriangle,
  CheckCircle,
  Truck,
  Footprints,
  Bot,
  Sparkles,
  RefreshCw,
  Lightbulb,
  Flame
} from 'lucide-react';
import { apiFetch } from '@/lib/offline/apiFetch';

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 4 && h < 12) return 'শুভ সকাল';
  if (h >= 12 && h < 16) return 'শুভ দুপুর';
  if (h >= 16 && h < 18) return 'শুভ বিকাল';
  return 'শুভ সন্ধ্যা';
}

export default function AdminDashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [ownerName, setOwnerName] = useState('');
  const [brief, setBrief] = useState<AIDailyBrief | null>(null);
  const [briefState, setBriefState] = useState<'loading' | 'ready' | 'unconfigured' | 'error'>('loading');
  const [briefRefreshing, setBriefRefreshing] = useState(false);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(false);
  const [insightsError, setInsightsError] = useState<string | null>(null);
  const [fastMovers, setFastMovers] = useState<FastMoverEntry[]>([]);

  const loadBrief = async (refresh = false) => {
    if (refresh) setBriefRefreshing(true);
    try {
      const res = await apiFetch(`/api/ai?action=daily-brief${refresh ? '&refresh=1' : ''}`);
      const data = await res.json().catch(() => null);
      if (data && data.configured === false) {
        setBriefState('unconfigured');
        return;
      }
      if (res.ok && data?.brief) {
        setBrief(data.brief);
        setBriefState('ready');
      } else {
        setBriefState('error');
      }
    } catch {
      setBriefState('error');
    } finally {
      setBriefRefreshing(false);
    }
  };

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, ordRes, setRes, fmRes, insRes] = await Promise.all([
          apiFetch('/api/products'),
          apiFetch('/api/orders'),
          apiFetch('/api/settings'),
          apiFetch('/api/analytics/fast-movers'),
          apiFetch('/api/ai?action=insights-history'),
        ]);
        if (prodRes.ok) setProducts(await prodRes.json());
        if (ordRes.ok) setOrders(await ordRes.json());
        if (setRes.ok) {
          const s = await setRes.json();
          setOwnerName(s?.ownerName || '');
        }
        if (fmRes.ok) setFastMovers(await fmRes.json());
        // শেষ সংরক্ষিত ইনসাইট — আবার খুললেই দেখা যায়, প্রতিবার রিজেনারেট লাগে না
        if (insRes.ok) {
          const insData = await insRes.json().catch(() => null);
          if (Array.isArray(insData?.insights) && insData.insights.length > 0) {
            setInsights(insData.insights[0]);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
    loadBrief();
  }, []);

  const runInsights = async () => {
    setInsightsLoading(true);
    setInsightsError(null);
    try {
      const res = await apiFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'insights' }),
      });
      const data = await res.json().catch(() => null);
      if (data && data.configured === false) {
        setInsightsError(data.error);
        return;
      }
      if (res.ok && data?.insights) {
        setInsights(data.insights);
      } else {
        setInsightsError(data?.error || 'ইনসাইট তৈরি করা যায়নি');
      }
    } catch {
      setInsightsError('সার্ভারে সংযোগ করা যায়নি');
    } finally {
      setInsightsLoading(false);
    }
  };

  const totalSales = orders.reduce((sum, ord) => sum + ord.total, 0);
  const pendingOrders = orders.filter((o) => o.status === 'Pending' || o.status === 'Processing');
  const lowStockProducts = products.filter((p) => p.stockCount <= 16);

  const shoeCount = products.filter((p) => p.category === 'shoes').length;
  const bagCount = products.filter((p) => p.category === 'bags').length;

  // ================== চার্ট ডেটা ==================
  const validOrders = useMemo(() => orders.filter(o => o.status !== 'Cancelled'), [orders]);

  // ৩০ দিনের দৈনিক বিক্রি সিরিজ
  const revenueSeries = useMemo(() => {
    const dayKey = (t: number) => new Date(t).toLocaleDateString('en-CA');
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const revByDay = new Map<string, number>();
    for (const o of validOrders) {
      const t = new Date(o.createdAt).getTime();
      if (t >= startToday.getTime() - 29 * 86400000) {
        const k = dayKey(t);
        revByDay.set(k, (revByDay.get(k) || 0) + o.total);
      }
    }
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date(startToday.getTime() - (29 - i) * 86400000);
      const k = dayKey(d.getTime());
      return { label: k, value: revByDay.get(k) || 0 };
    });
  }, [validOrders]);

  // ক্যাটাগরি-ভিত্তিক আয় (জুতা / ব্যাগ / অন্যান্য)
  const categoryRevenue = useMemo(() => {
    const catById = new Map(products.map(p => [p.id, p.category]));
    let shoes = 0, bags = 0, others = 0;
    for (const o of validOrders) {
      for (const it of o.items) {
        const c = catById.get(it.productId);
        const amt = it.price * it.quantity;
        if (c === 'bags') bags += amt;
        else if (c === 'shoes') shoes += amt;
        else others += amt;
      }
    }
    return [
      { label: 'জুতা (Shoes)', value: Math.round(shoes), color: '#ea580c' },
      { label: 'ব্যাগ (Bags)', value: Math.round(bags), color: '#2563eb' },
      ...(others > 0 ? [{ label: 'অন্যান্য', value: Math.round(others), color: '#94a3b8' }] : []),
    ].filter(x => x.value > 0);
  }, [validOrders, products]);

  // টপ ৫ প্রোডাক্ট (আয় অনুযায়ী)
  const topProducts = useMemo(() => {
    const byProduct = new Map<string, { name: string; revenue: number }>();
    for (const o of validOrders) {
      for (const it of o.items) {
        const cur = byProduct.get(it.productId) || { name: it.name, revenue: 0 };
        cur.revenue += it.price * it.quantity;
        byProduct.set(it.productId, cur);
      }
    }
    const prodName = new Map(products.map(p => [p.id, p.name]));
    return Array.from(byProduct.entries())
      .map(([id, v]) => ({ label: prodName.get(id) || v.name, value: v.revenue, display: `৳${v.revenue.toLocaleString('en-BD')}` }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);
  }, [validOrders, products]);

  // অর্ডার স্টেটাস বিভাজন
  const statusSegments = useMemo(() => {
    const defs: { key: Order['status']; label: string; color: string }[] = [
      { key: 'Pending', label: 'অপেক্ষমাণ', color: '#f59e0b' },
      { key: 'Processing', label: 'প্রসেসিং', color: '#2563eb' },
      { key: 'Shipped', label: 'শিপড', color: '#8b5cf6' },
      { key: 'Delivered', label: 'ডেলিভার্ড', color: '#059669' },
      { key: 'Cancelled', label: 'বাতিল', color: '#dc2626' },
    ];
    return defs
      .map(d => ({ ...d, value: orders.filter(o => o.status === d.key).length }))
      .filter(d => d.value > 0)
      .map(d => ({ label: d.label, value: d.value, color: d.color }));
  }, [orders]);

  const handleQuickStatusChange = async (orderId: string, newStatus: Order['status']) => {
    try {
      const res = await apiFetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      }
    } catch (e) {
      console.error(e);
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
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* AI গ্রিটিং + ডেইলি ব্রিফ */}
      <div className="relative overflow-hidden rounded-md bg-slate-900 text-white p-6 sm:p-8">
        <div className="relative">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-[11px] font-bold text-orange-300 uppercase tracking-wider">
                <Bot className="w-4 h-4" />
                <span>আপনার AI ম্যানেজার</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold mt-2 tracking-tight">
                {getGreeting()}{ownerName ? `, ${ownerName}` : ''}!
              </h1>
              <p className="text-xs text-slate-300 mt-1">
                {new Date().toLocaleDateString('bn-BD', {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            <button
              onClick={() => loadBrief(true)}
              disabled={briefRefreshing || briefState === 'loading'}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-white/10 hover:bg-white/20 border border-white/20 text-xs font-bold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${briefRefreshing ? 'animate-spin' : ''}`} />
              <span>নতুন ব্রিফিং</span>
            </button>
          </div>

          {/* ব্রিফ কনটেন্ট */}
          {briefState === 'loading' && (
            <div className="mt-5 flex items-center gap-3 text-sm text-slate-300">
              <span className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
              <span>AI আজকের শপ-রিপোর্ট তৈরি করছে…</span>
            </div>
          )}

          {briefState === 'unconfigured' && (
            <div className="mt-5 rounded-md bg-white/5 border border-white/10 p-4 text-xs text-slate-300 leading-relaxed">
              💡 দিনের শুরুতে AI ব্রিফিং পেতে সার্ভারের AI API টোকেনে{' '}
              <span className="font-bold text-orange-300">&quot;AI → Write&quot;</span>{' '}
              পারমিশন যোগ করুন। বিস্তারিত <code className="font-mono">docs/AI_SYSTEM.md</code> ফাইলে।
            </div>
          )}

          {briefState === 'error' && (
            <div className="mt-5 rounded-md bg-white/5 border border-white/10 p-4 text-xs text-slate-300">
              এই মুহূর্তে ব্রিফিং আনা যায়নি। একটু পরে আবার চেষ্টা করুন।
            </div>
          )}

          {briefState === 'ready' && brief && (
            <div className="mt-5 space-y-4">
              <p className="text-sm text-orange-200 font-bold">{brief.greeting}</p>
              <p className="text-sm text-slate-200 leading-relaxed">{brief.summary}</p>

              {/* পরামর্শ ও সতর্কতা — মোবাইলে লুকানো, কার্ড কমপ্যাক্ট রাখতে */}
              <div className="hidden sm:grid grid-cols-1 md:grid-cols-2 gap-4">
                {brief.advice.length > 0 && (
                  <div className="rounded-md bg-white border border-slate-200 p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-2">
                      <Lightbulb className="w-3.5 h-3.5" /> আজকের পরামর্শ
                    </div>
                    <ul className="space-y-1.5">
                      {brief.advice.map((a, i) => (
                        <li key={i} className="text-xs text-slate-700 flex gap-2">
                          <CheckCircle className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {brief.alerts.length > 0 ? (
                  <div className="rounded-md bg-white border border-amber-300 p-4">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-2">
                      <AlertTriangle className="w-3.5 h-3.5" /> জরুরি সতর্কতা
                    </div>
                    <ul className="space-y-1.5">
                      {brief.alerts.map((a, i) => (
                        <li key={i} className="text-xs text-slate-700 flex gap-2">
                          <span className="w-1.5 h-1.5 bg-amber-500 rounded-full flex-shrink-0 mt-1.5" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : (
                  <div className="rounded-md bg-white border border-emerald-200 p-4 flex items-center gap-2 text-xs text-emerald-700">
                    <CheckCircle className="w-4 h-4" /> কোনো জরুরি সমস্যা নেই — সব ঠিক আছে!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Title & Actions — স্টিকি টুলবার */}
      <div className="animate-fade-up sticky top-14 md:top-0 z-20 bg-slate-200 rounded-md border border-slate-200/80 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            অ্যাডমিন ওভারভিউ ড্যাশবোর্ড
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Shopkeeper শপের লাইভ সেলস ও ক্যাটালগ পরিসংখ্যান।
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="/admin/products"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন প্রোডাক্ট আপলোড</span>
          </a>
          <a
            href="/admin/orders"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all"
          >
            <ShoppingBag className="w-4 h-4 text-orange-600" />
            <span>সকল অর্ডার</span>
          </a>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="stagger grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5" style={{ '--stagger-base': '0.05s' } as React.CSSProperties}>
        <div className="bg-white p-5 sm:p-6 rounded-md border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">মোট বিক্রয় (Revenue)</span>
            <div className="w-9 h-9 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{formatPrice(totalSales)}</div>
            <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 inline-block">লাইভ অর্ডার থেকে</span>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-md border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">মোট অর্ডার</span>
            <div className="w-9 h-9 rounded-md bg-orange-50 text-orange-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{orders.length} টি</div>
            <span className="text-[10px] text-orange-600 font-semibold mt-0.5 inline-block">কাস্টমার প্লেসড</span>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-md border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">পেন্ডিং ডেলিভারি</span>
            <div className="w-9 h-9 rounded-md bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-amber-600">{pendingOrders.length} টি</div>
            <span className="text-[10px] text-amber-700 font-semibold mt-0.5 inline-block">শিপিং প্রয়োজন</span>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-md border border-slate-200/80 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">মোট পণ্য (Catalog)</span>
            <div className="w-9 h-9 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-bold text-slate-900">{products.length} টি</div>
            <span className="text-[10px] text-blue-600 font-semibold mt-0.5 inline-block">
              {shoeCount} জুতা, {bagCount} ব্যাগ
            </span>
          </div>
        </div>
      </div>

      {/* 📊 অ্যানালিটিক্স চার্ট */}
      <div className="stagger grid grid-cols-1 lg:grid-cols-3 gap-6" style={{ '--stagger-base': '0.3s' } as React.CSSProperties}>
        {/* রেভিনিউ ট্রেন্ড */}
        <div className="lg:col-span-2 bg-white rounded-md border border-slate-200/80 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900">বিক্রয় ট্রেন্ড (গত ৩০ দিন)</h2>
              <p className="text-[11px] text-slate-400 mt-0.5">দৈনিক মোট বিক্রি — পয়েন্টে হোভার করলে দিন ও টাকা দেখাবে</p>
            </div>
            <span className="text-xs font-bold text-slate-500">
              মোট: ৳{revenueSeries.reduce((s2, d) => s2 + d.value, 0).toLocaleString('en-BD')}
            </span>
          </div>
          <TrendChart data={revenueSeries} />
        </div>

        {/* ক্যাটাগরি ডোনাট */}
        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-4">ক্যাটাগরির আয়-অবদান</h2>
          {categoryRevenue.length > 0 ? (
            <DonutChart
              segments={categoryRevenue}
              centerLabel="মোট আয়"
              centerValue={`৳${categoryRevenue.reduce((s2, x) => s2 + x.value, 0).toLocaleString('en-BD')}`}
            />
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">এখনো বিক্রি হয়নি</p>
          )}
        </div>
      </div>

      <div className="stagger grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ '--stagger-base': '0.45s' } as React.CSSProperties}>
        {/* টপ প্রোডাক্ট */}
        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-4">সর্বোচ্চ আয়ের প্রোডাক্ট (টপ ৫)</h2>
          <BarList items={topProducts} />
        </div>

        {/* অর্ডার স্টেটাস */}
        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="text-sm font-bold text-slate-900 mb-4">অর্ডার স্টেটাস বিভাজন</h2>
          {statusSegments.length > 0 ? (
            <DonutChart
              segments={statusSegments}
              centerLabel="মোট অর্ডার"
              centerValue={String(orders.length)}
            />
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">কোনো অর্ডার নেই</p>
          )}
        </div>
      </div>

      {/* 🔥 দ্রুততম বিক্রিত পণ্য (Fast Movers) */}
      <div className="animate-fade-up bg-white rounded-md border border-slate-200/80 overflow-hidden" style={{ animationDelay: '0.55s' }}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-red-500 flex items-center justify-center">
              <Flame className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">দ্রুততম বিক্রিত পণ্য (Fast Movers)</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                স্টক যুক্ত হওয়ার দিন থেকে গড়ে দিনে যতটা বিক্রি — ক্রেতাদের সবচেয়ে পছন্দের তালিকা
              </p>
            </div>
          </div>
          <a
            href="/admin/inventory"
            className="hidden sm:inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700"
          >
            ইনভেন্টরি <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {fastMovers.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-400">
            এখনো কোনো বিক্রি হয়নি — বিক্রি শুরু হলে এখানে দ্রুততম বিক্রিত পণ্যগুলো দেখা যাবে।
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {fastMovers.map((m, i) => {
              const rankStyles = [
                'bg-amber-500',
                'bg-slate-400',
                'bg-orange-600',
              ];
              return (
                <div key={m.productId} className="flex items-center gap-3.5 px-5 sm:px-6 py-3.5 hover:bg-slate-50/60 transition-colors">
                  {/* র‍্যাংক */}
                  <div
                    className={`w-8 h-8 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0 ${
                      i < 3 ? rankStyles[i] : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {i + 1}
                  </div>

                  {m.image ? (
                    <img src={m.image} alt="" className="w-11 h-11 rounded-md object-cover border border-slate-200 flex-shrink-0" />
                  ) : (
                    <div className="w-11 h-11 rounded-md bg-slate-100 flex-shrink-0" />
                  )}

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs sm:text-sm font-bold text-slate-900 truncate">{m.name}</span>
                      {m.soldOut && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-red-100 text-red-700 border border-red-200 whitespace-nowrap">
                          স্টক শেষ!
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">
                      মোট বিক্রি <span className="font-bold text-slate-700">{m.totalSold}টি</span>
                      {' • '}গড়ে দিনে <span className="font-bold text-orange-600">~{m.velocity}টি</span>
                      {' • '}{m.daysInStock} দিনে • আয় {formatPrice(m.revenue)}
                    </div>
                  </div>

                  <div className="text-right flex-shrink-0 hidden sm:block">
                    {m.soldOut ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-red-50 text-red-700 font-bold text-[11px] border border-red-200">
                        <AlertTriangle className="w-3 h-3" /> দ্রুত রিস্টক
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-slate-500">
                        স্টক বাকি: <span className={m.stockLeft <= 5 ? 'text-amber-600 font-bold' : 'text-emerald-600 font-bold'}>{m.stockLeft} টি</span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* AI বিজনেস ইনসাইট */}
      <div className="animate-fade-up bg-white rounded-md border border-slate-200/80 overflow-hidden" style={{ animationDelay: '0.62s' }}>
        <div className="p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-md bg-orange-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">AI বিজনেস ইনসাইট</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                এক ক্লিকে পুরো শপের বিশ্লেষণ — বেস্ট-সেলার, রিস্টক, প্রাইসিং পরামর্শ
              </p>
            </div>
          </div>
          <button
            onClick={runInsights}
            disabled={insightsLoading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors disabled:opacity-60 self-start sm:self-auto"
          >
            {insightsLoading ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            <span>{insights ? 'আবার বিশ্লেষণ করুন' : 'AI বিশ্লেষণ চালান'}</span>
          </button>
        </div>

        {insightsError && (
          <div className="mx-6 my-4 rounded-md bg-amber-50 border border-amber-200 p-4 text-xs text-amber-800 leading-relaxed">
            ⚠️ {insightsError}
          </div>
        )}

        {insightsLoading && (
          <div className="p-6 flex items-center gap-3 text-sm text-slate-500">
            <span className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin" />
            <span>AI আপনার সব অর্ডার ও স্টক বিশ্লেষণ করছে… প্রায় ১০-২০ সেকেন্ড লাগতে পারে।</span>
          </div>
        )}

        {insights && !insightsLoading && (
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-bold text-slate-900">{insights.headline}</h3>
              <p className="text-sm text-slate-600 leading-relaxed mt-2">{insights.overview}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {insights.bestSellers.length > 0 && (
                <div className="rounded-md border border-emerald-100 bg-emerald-50/50 p-4">
                  <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider mb-2.5">
                    🏆 বেস্ট-সেলার
                  </div>
                  <ul className="space-y-2">
                    {insights.bestSellers.map((b, i) => (
                      <li key={i} className="text-xs text-slate-700">
                        <span className="font-bold text-slate-900">{b.name}</span> — {b.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.slowMovers.length > 0 && (
                <div className="rounded-md border border-slate-200 bg-slate-50 p-4">
                  <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-2.5">
                    🐢 ধীরগতির পণ্য
                  </div>
                  <ul className="space-y-2">
                    {insights.slowMovers.map((s, i) => (
                      <li key={i} className="text-xs text-slate-700">
                        <span className="font-bold text-slate-900">{s.name}</span> — {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {insights.restockNeeds.length > 0 && (
                <div className="rounded-md border border-amber-100 bg-amber-50/50 p-4">
                  <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-2.5">
                    📦 রিস্টক প্রয়োজন
                  </div>
                  <ul className="space-y-2">
                    {insights.restockNeeds.map((r, i) => {
                      // পরামর্শের নাম থেকে প্রোডাক্ট ম্যাচ — সরাসরি রিস্টক মোডালে নিয়ে যায়
                      const match = products.find(
                        p =>
                          p.name === r.name ||
                          r.name.toLowerCase().includes(p.name.toLowerCase()) ||
                          p.name.toLowerCase().includes(r.name.toLowerCase())
                      );
                      return (
                        <li key={i} className="text-xs text-slate-700">
                          <span className="font-bold text-slate-900">{r.name}</span> — {r.suggestion}
                          {match && (
                            <Link
                              href={`/admin/inventory?restock=${encodeURIComponent(match.id)}`}
                              className="ml-2 inline-block text-[10px] font-bold text-amber-700 hover:text-amber-900 underline"
                            >
                              রিস্টক করুন →
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

              {insights.pricingAdvice.length > 0 && (
                <div className="rounded-md border border-blue-100 bg-blue-50/50 p-4">
                  <div className="text-[11px] font-bold text-blue-700 uppercase tracking-wider mb-2.5">
                    💰 প্রাইসিং পরামর্শ
                  </div>
                  <ul className="space-y-2">
                    {insights.pricingAdvice.map((p, i) => (
                      <li key={i} className="text-xs text-slate-700">
                        <span className="font-bold text-slate-900">{p.name}</span> — {p.suggestion}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {insights.recommendations.length > 0 && (
              <div className="rounded-md bg-slate-900 text-white p-5">
                <div className="text-[11px] font-bold text-orange-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Lightbulb className="w-4 h-4" /> AI-এর সামগ্রিক পরামর্শ
                </div>
                <ul className="space-y-2">
                  {insights.recommendations.map((r, i) => (
                    <li key={i} className="text-xs text-slate-200 flex gap-2">
                      <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <p className="text-[10px] text-slate-400">
              তৈরি হয়েছে {formatDate(insights.generatedAt)} — AI বিশ্লেষণ আপনার আসল অর্ডার ও স্টক ডেটা থেকে।
            </p>
          </div>
        )}
      </div>

      {/* Low Stock Alert and Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Split */}
        <div className="bg-white p-6 rounded-md border border-slate-200/80 space-y-4">
          <h3 className="font-bold text-sm text-slate-900">ক্যাটাগরি ভিত্তিক স্টক অনুপাত</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="inline-flex items-center gap-1.5"><Footprints className="w-3.5 h-3.5 text-orange-600" /> জুতা (Shoes)</span>
                <span>{shoeCount} মডেল ({Math.round((shoeCount / products.length) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-md h-2.5 overflow-hidden">
                <div
                  className="bg-orange-600 h-2.5 rounded-md"
                  style={{ width: `${(shoeCount / products.length) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="inline-flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5 text-amber-500" /> ব্যাগ (Bags)</span>
                <span>{bagCount} মডেল ({Math.round((bagCount / products.length) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-md h-2.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-2.5 rounded-md"
                  style={{ width: `${(bagCount / products.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 pt-2 border-t">
            উভয় ক্যাটাগরির পণ্য সরাসরি কাস্টমাররা সাইজ ও কালার সিলেক্ট করে অর্ডার করতে পারছেন।
          </p>
        </div>

        {/* Low Stock Watch */}
        <div className="lg:col-span-2 bg-white p-6 rounded-md border border-slate-200/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>লো-স্টক সতর্কতা (Low Stock Alert)</span>
            </h3>
            <span className="text-[11px] text-slate-400">স্টক কম থাকা প্রোডাক্ট</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lowStockProducts.slice(0, 4).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-md bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <img src={p.images[0]} alt="" className="w-10 h-10 rounded-md object-cover bg-white border" />
                  <div>
                    <h5 className="font-bold text-slate-900 truncate max-w-[130px]">{p.name}</h5>
                    <span className="text-orange-600 font-semibold">{formatPrice(p.price)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 font-bold text-[10px]">
                    বাকি: {p.stockCount} টি
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders Overview */}
      <div className="bg-white rounded-md border border-slate-200/80 overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">সাম্প্রতিক কাস্টমার অর্ডারসমূহ</h2>
            <p className="text-xs text-slate-500 mt-0.5">অর্ডার স্ট্যাটাস ড্রপডাউন থেকে সরাসরি পরিবর্তন করুন।</p>
          </div>
          <a
            href="/admin/orders"
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
          >
            <span>সব দেখুন</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">অর্ডার নং</th>
                <th className="py-3.5 px-6">কাস্টমার</th>
                <th className="py-3.5 px-6">আইটেম ও সাইজ</th>
                <th className="py-3.5 px-6">মোট বিল</th>
                <th className="py-3.5 px-6">পেমেন্ট</th>
                <th className="py-3.5 px-6">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6 font-mono font-bold text-slate-900">
                    {order.orderNumber}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">{order.customerName}</div>
                    <div className="text-xs text-slate-500">{order.phone}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="space-y-1">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="text-xs font-medium text-slate-700">
                          {it.name} <span className="text-orange-600">({it.selectedSize})</span> × {it.quantity}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-6 font-bold text-slate-900">
                    {formatPrice(order.total)}
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                      {order.paymentMethod}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <select
                      value={order.status}
                      onChange={(e) => handleQuickStatusChange(order.id, e.target.value as any)}
                      className={`text-xs font-bold rounded-md px-2.5 py-1.5 border focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 transition-colors ${
                        order.status === 'Pending'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : order.status === 'Processing'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : order.status === 'Shipped'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : order.status === 'Delivered'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}
                    >
                      <option value="Pending">Pending (অপেক্ষারত)</option>
                      <option value="Processing">Processing (প্যাকিং)</option>
                      <option value="Shipped">Shipped (কুরিয়ারে)</option>
                      <option value="Delivered">Delivered (পৌঁছেছে)</option>
                      <option value="Cancelled">Cancelled (বাতিল)</option>
                    </select>
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

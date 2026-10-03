'use client';

/**
 * হিসাব ও লাভ-ক্ষতি (P&L) — বিস্তারিত বিশ্লেষণ
 * --------------------------------------------
 * সব সংখ্যা রিয়েল ডেটা থেকে: /api/orders (প্রতিটা আইটেমে ক্রয়মূল্য স্ন্যাপশট),
 * /api/expenses (খরচের খাতা), /api/products (ক্যাটাগরি ম্যাপিং) এবং /api/finance (বাকি/আদায়)।
 * মোট বিক্রি − বিক্রীত পণ্যের ক্রয়মূল্য = গ্রস প্রফিট − খরচ = নেট প্রফিট। বাতিল অর্ডার বাদ।
 */

import React, { useEffect, useMemo, useState } from 'react';
import { FinanceSummary, Order, Expense, Product } from '@/types';
import { formatPrice } from '@/lib/utils';
import { TrendChart, DonutChart, BarList } from '@/components/admin/Charts';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  HandCoins,
  AlertTriangle,
  Package,
  ShoppingCart,
  Receipt,
  Percent,
  Truck,
  XCircle,
  Store,
  Globe,
  MapPin,
  Award,
  CalendarDays,
  Ban,
} from 'lucide-react';
import { apiFetch } from '@/lib/offline/apiFetch';

/* ── সময়কাল ── */
const PERIODS: { key: string; label: string; days: number }[] = [
  { key: '7', label: '৭ দিন', days: 7 },
  { key: '30', label: '৩০ দিন', days: 30 },
  { key: '90', label: '৯০ দিন', days: 90 },
  { key: 'all', label: 'সব সময়', days: 0 },
];

const dayKey = (t: number) => new Date(t).toLocaleDateString('en-CA');

const catLabel = (c: string) =>
  c === 'shoes' ? 'জুতা' : c === 'bags' ? 'ব্যাগ' : c === 'accessories' ? 'এক্সেসরিজ' : c;

export default function AdminFinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('30');

  useEffect(() => {
    (async () => {
      try {
        const [finRes, ordRes, expRes, prodRes] = await Promise.allSettled([
          apiFetch('/api/finance'),
          apiFetch('/api/orders'),
          apiFetch('/api/expenses'),
          apiFetch('/api/products'),
        ]);
        if (finRes.status === 'fulfilled' && finRes.value.ok) setSummary(await finRes.value.json());
        if (ordRes.status === 'fulfilled' && ordRes.value.ok) setOrders(await ordRes.value.json());
        if (expRes.status === 'fulfilled' && expRes.value.ok) setExpenses(await expRes.value.json());
        if (prodRes.status === 'fulfilled' && prodRes.value.ok) setProducts(await prodRes.value.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  /* ══════════ রিয়েল ডেটা থেকে হিসাব ══════════ */
  const a = useMemo(() => {
    const valid = orders.filter(o => o.status !== 'Cancelled');
    const cancelledCount = orders.length - valid.length;
    const costMap = new Map(products.map(p => [p.id, p.costPrice]));
    const catMap = new Map(products.map(p => [p.id, p.category]));
    const costOf = (it: { costPrice?: number; productId: string; price: number }) =>
      it.costPrice ?? costMap.get(it.productId) ?? Math.round(it.price * 0.65);

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

    // 'সব সময়' হলে প্রথম অর্ডার থেকে আজ পর্যন্ত (সর্বোচ্চ ১২০ দিনের দৈনিক সিরিজ)
    let days = PERIODS.find(p => p.key === period)?.days ?? 30;
    if (period === 'all' && valid.length > 0) {
      const firstTs = Math.min(...valid.map(o => new Date(o.createdAt).getTime()));
      days = Math.min(120, Math.max(1, Math.ceil((startOfToday - firstTs) / 86400000) + 1));
    }
    if (days <= 0) days = 30;
    const from = startOfToday - (days - 1) * 86400000;
    const inPeriod = valid.filter(o => new Date(o.createdAt).getTime() >= from);

    let revenue = 0, cogs = 0, discountTotal = 0, deliveryIncome = 0, dueInPeriod = 0;
    const paymentMap = new Map<string, number>();
    const channelMap = new Map<string, number>();
    const cityMap = new Map<string, number>();
    const catRevMap = new Map<string, number>();
    const prodAgg = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();

    for (const o of inPeriod) {
      revenue += o.total;
      discountTotal += o.discount || 0;
      deliveryIncome += o.deliveryFee || 0;
      dueInPeriod += o.dueAmount || 0;
      paymentMap.set(o.paymentMethod, (paymentMap.get(o.paymentMethod) || 0) + o.total);
      const ch = o.source === 'in-store' ? 'দোকানে বিক্রি (POS)' : 'অনলাইন অর্ডার';
      channelMap.set(ch, (channelMap.get(ch) || 0) + o.total);
      const ct = o.city === 'Outside Dhaka' ? 'ঢাকার বাইরে' : 'ঢাকার ভিতরে';
      cityMap.set(ct, (cityMap.get(ct) || 0) + o.total);

      for (const it of o.items) {
        const cost = costOf(it) * it.quantity;
        cogs += cost;
        const cat = catMap.get(it.productId) || 'অন্যান্য';
        catRevMap.set(cat, (catRevMap.get(cat) || 0) + it.price * it.quantity);
        const agg = prodAgg.get(it.productId) || { name: it.name, qty: 0, revenue: 0, profit: 0 };
        agg.qty += it.quantity;
        agg.revenue += it.price * it.quantity;
        agg.profit += it.price * it.quantity - cost;
        prodAgg.set(it.productId, agg);
      }
    }

    const grossProfit = revenue - cogs;
    const pExpenses = expenses.filter(e => new Date(e.createdAt).getTime() >= from);
    const operatingExpenses = pExpenses.reduce((s, e) => s + e.amount, 0);
    const netProfit = grossProfit - operatingExpenses;
    const grossMargin = revenue > 0 ? Math.round((grossProfit / revenue) * 100) : 0;
    const netMargin = revenue > 0 ? Math.round((netProfit / revenue) * 100) : 0;
    const aov = inPeriod.length > 0 ? revenue / inPeriod.length : 0;

    // দৈনিক সিরিজ (বিক্রি + গ্রস প্রফিট) এবং দৈনিক হিসাব টেবিল
    const revByDay = new Map<string, { rev: number; cogs: number; orders: number }>();
    for (const o of inPeriod) {
      const k = dayKey(new Date(o.createdAt).getTime());
      const cur = revByDay.get(k) || { rev: 0, cogs: 0, orders: 0 };
      cur.rev += o.total;
      cur.orders += 1;
      for (const it of o.items) cur.cogs += costOf(it) * it.quantity;
      revByDay.set(k, cur);
    }
    const expByDay = new Map<string, number>();
    for (const e of pExpenses) {
      const k = dayKey(new Date(e.createdAt).getTime());
      expByDay.set(k, (expByDay.get(k) || 0) + e.amount);
    }
    const daily: { date: string; rev: number; cogs: number; gross: number; exp: number; net: number; orders: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const k = dayKey(startOfToday - i * 86400000);
      const d = revByDay.get(k) || { rev: 0, cogs: 0, orders: 0 };
      const exp = expByDay.get(k) || 0;
      daily.push({ date: k, rev: d.rev, cogs: Math.round(d.cogs), gross: Math.round(d.rev - d.cogs), exp, net: Math.round(d.rev - d.cogs - exp), orders: d.orders });
    }

    const expenseByCat = new Map<string, number>();
    for (const e of pExpenses) expenseByCat.set(e.category, (expenseByCat.get(e.category) || 0) + e.amount);

    const topProducts = Array.from(prodAgg.values()).sort((x, y) => y.revenue - x.revenue).slice(0, 6);
    const bestDay = daily.reduce((b, d) => (d.rev > b.rev ? d : b), daily[0] || { date: '-', rev: 0, cogs: 0, gross: 0, exp: 0, net: 0, orders: 0 });

    return {
      days, from, inPeriod, cancelledCount,
      revenue, cogs: Math.round(cogs), grossProfit: Math.round(grossProfit),
      operatingExpenses, netProfit: Math.round(netProfit),
      grossMargin, netMargin, aov, discountTotal, deliveryIncome, dueInPeriod,
      expenseByCat: Array.from(expenseByCat.entries()).map(([category, amount]) => ({ category, amount })).sort((x, y) => y.amount - x.amount),
      payment: Array.from(paymentMap.entries()).map(([label, value]) => ({ label, value })),
      channel: Array.from(channelMap.entries()).map(([label, value]) => ({ label, value })),
      city: Array.from(cityMap.entries()).map(([label, value]) => ({ label, value })),
      categoryRev: Array.from(catRevMap.entries()).map(([c, v]) => ({ cat: c, value: v })).sort((x, y) => y.value - x.value),
      topProducts,
      daily, bestDay,
    };
  }, [orders, expenses, products, period]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!summary && orders.length === 0) {
    return <div className="p-12 text-center text-slate-500">হিসাব লোড করা যায়নি। পেজটা রিফ্রেশ করুন।</div>;
  }

  const periodLabel = PERIODS.find(p => p.key === period)?.label || '';
  const bnDate = (d: string) =>
    d === '-' ? '-' : new Date(d + 'T00:00:00').toLocaleDateString('bn-BD', { day: 'numeric', month: 'short' });

  const expenseColors = ['#ef4444', '#f97316', '#eab308', '#8b5cf6', '#06b6d4', '#64748b', '#ec4899'];
  const paymentColors: Record<string, string> = {
    'Cash on Delivery': '#0ea5e9',
    'bKash / Nagad': '#e2136e',
  };
  const channelColors: Record<string, string> = { 'অনলাইন অর্ডার': '#ea580c', 'দোকানে বিক্রি (POS)': '#7c3aed' };
  const cityColors: Record<string, string> = { 'ঢাকার ভিতরে': '#ea580c', 'ঢাকার বাইরে': '#0ea5e9' };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      {/* ── হেডার + সময়কাল নির্বাচক ── */}
      <div className="sticky top-14 md:top-0 z-20 bg-slate-200 rounded-md border border-slate-200/80 px-4 sm:px-5 py-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">হিসাব ও লাভ-ক্ষতি</h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              প্রতিটা সেলের ক্রয়মূল্য স্ন্যাপশট থেকে নিখুঁত হিসাব — সব গ্রাফ আসল অর্ডার ও খরচের ডেটা থেকে।
            </p>
          </div>
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-md p-1 self-start sm:self-auto">
            {PERIODS.map(p => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-3 py-1.5 rounded-sm text-xs font-bold transition-colors ${
                  period === p.key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── কেপিআই কার্ড (নির্বাচিত সময়কাল) ── */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        {[
          { label: 'মোট বিক্রি', value: formatPrice(a.revenue), sub: `${a.inPeriod.length}টি অর্ডার`, icon: TrendingUp, color: 'text-slate-900' },
          { label: 'গড় অর্ডার মূল্য', value: formatPrice(Math.round(a.aov)), sub: 'প্রতি অর্ডারে গড়ে', icon: Receipt, color: 'text-slate-900' },
          { label: 'গ্রস প্রফিট', value: formatPrice(a.grossProfit), sub: `${a.grossMargin}% মার্জিন`, icon: PiggyBank, color: 'text-blue-700' },
          { label: 'নেট প্রফিট', value: formatPrice(a.netProfit), sub: `${a.netMargin}% মার্জিন`, icon: Wallet, color: a.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700' },
          { label: 'মোট ছাড়', value: formatPrice(a.discountTotal), sub: 'কুপন ও ডিসকাউন্ট', icon: Percent, color: 'text-amber-600' },
          { label: 'ডেলিভারি আয়', value: formatPrice(a.deliveryIncome), sub: 'চার্জ থেকে', icon: Truck, color: 'text-slate-900' },
        ].map((k, i) => (
          <div key={i} className="bg-white p-4 rounded-md border border-slate-200/80">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 leading-tight">{k.label}</span>
              <k.icon className="w-3.5 h-3.5 text-slate-300" />
            </div>
            <div className={`mt-1.5 text-base font-bold ${k.color}`}>{k.value}</div>
            <span className="text-[9px] text-slate-400 font-semibold">{k.sub}</span>
          </div>
        ))}
      </div>

      {/* ── লাভ-ক্ষতি স্টেটমেন্ট (নির্বাচিত সময়কাল) ── */}
      <div className="bg-white rounded-md border border-slate-200/80 p-6 sm:p-8">
        <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2 mb-1">
          <Calculator className="w-4 h-4 text-orange-600" /> লাভ-ক্ষতি হিসাব (Profit &amp; Loss)
        </h2>
        <p className="text-[11px] text-slate-400 mb-6">সময়কাল: {periodLabel} • বাতিল অর্ডার বাদে</p>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-md px-5 py-4">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-700">মোট বিক্রি (Revenue)</span>
              <span className="text-[10px] text-slate-400">{a.inPeriod.length}টি অর্ডার</span>
            </div>
            <span className="text-base sm:text-lg font-bold text-slate-900">{formatPrice(a.revenue)}</span>
          </div>

          <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-md px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Package className="w-4 h-4 text-slate-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-700">বিক্রীত পণ্যের ক্রয়মূল্য (COGS)</span>
            </div>
            <span className="text-base sm:text-lg font-bold text-red-600">- {formatPrice(a.cogs)}</span>
          </div>

          <div className="flex items-center justify-between bg-blue-50/60 border border-blue-100 rounded-md px-5 py-4">
            <div className="flex items-center gap-2.5">
              <PiggyBank className="w-4 h-4 text-blue-600" />
              <span className="text-xs sm:text-sm font-bold text-blue-800">
                গ্রস প্রফিট <span className="text-[10px] font-bold opacity-70">({a.grossMargin}% মার্জিন)</span>
              </span>
            </div>
            <span className="text-base sm:text-lg font-bold text-blue-700">{formatPrice(a.grossProfit)}</span>
          </div>

          <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-md px-5 py-4">
            <div className="flex items-center gap-2.5">
              <TrendingDown className="w-4 h-4 text-slate-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-700">দোকানের খরচ (Expenses)</span>
              {a.expenseByCat.length > 0 && (
                <span className="text-[10px] text-slate-400">{a.expenseByCat.length}টি খাতা</span>
              )}
            </div>
            <span className="text-base sm:text-lg font-bold text-red-600">- {formatPrice(a.operatingExpenses)}</span>
          </div>

          <div
            className={`flex items-center justify-between rounded-md px-5 py-5 border-2 ${
              a.netProfit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Wallet className={`w-5 h-5 ${a.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              <span className={`text-sm font-bold ${a.netProfit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                {a.netProfit >= 0 ? 'নেট প্রফিট' : 'নেট লস'}
                <span className="text-[10px] font-bold opacity-70"> ({a.netMargin}% মার্জিন)</span>
              </span>
            </div>
            <span className={`text-xl sm:text-2xl font-bold ${a.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {a.netProfit >= 0 ? formatPrice(a.netProfit) : '-' + formatPrice(Math.abs(a.netProfit))}
            </span>
          </div>
        </div>
      </div>

      {/* ── ট্রেন্ড চার্ট: বিক্রি ও গ্রস প্রফিট ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-orange-600" /> দৈনিক বিক্রির প্রবণতা
          </h2>
          <TrendChart data={a.daily.map(d => ({ label: d.date, value: d.rev }))} color="#ea580c" height={210} />
        </div>
        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="font-bold text-sm text-slate-900 mb-4 flex items-center gap-2">
            <PiggyBank className="w-4 h-4 text-emerald-600" /> দৈনিক গ্রস প্রফিট
          </h2>
          <TrendChart data={a.daily.map(d => ({ label: d.date, value: d.gross }))} color="#059669" height={210} />
        </div>
      </div>

      {/* ── ডোনাট: খরচ বিভাজন + পেমেন্ট মেথড ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="font-bold text-sm text-slate-900 mb-5 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-red-500" /> খরচ কোন খাতায় কত?
          </h2>
          {a.expenseByCat.length > 0 ? (
            <DonutChart
              segments={a.expenseByCat.map((e, i) => ({ label: e.category, value: e.amount, color: expenseColors[i % expenseColors.length] }))}
              centerLabel={`মোট খরচ (${periodLabel})`}
              centerValue={formatPrice(a.operatingExpenses)}
            />
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">এই সময়কালে কোনো খরচ এন্ট্রি নেই।</p>
          )}
        </div>

        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="font-bold text-sm text-slate-900 mb-5 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-pink-600" /> পেমেন্ট মেথড অনুযায়ী বিক্রি
          </h2>
          {a.payment.length > 0 ? (
            <DonutChart
              segments={a.payment.map(p => ({ label: p.label, value: p.value, color: paymentColors[p.label] || '#94a3b8' }))}
              centerLabel="মোট বিক্রি"
              centerValue={formatPrice(a.revenue)}
            />
          ) : (
            <p className="text-xs text-slate-400 py-8 text-center">এই সময়কালে অর্ডার নেই।</p>
          )}
        </div>
      </div>

      {/* ── বার: ক্যাটাগরি + টপ প্রোডাক্ট ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="font-bold text-sm text-slate-900 mb-5 flex items-center gap-2">
            <Package className="w-4 h-4 text-orange-600" /> ক্যাটাগরি অনুযায়ী বিক্রি
          </h2>
          {a.categoryRev.length > 0 ? (
            <BarList items={a.categoryRev.map(c => ({ label: catLabel(c.cat), value: c.value, display: formatPrice(Math.round(c.value)) }))} />
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">এই সময়কালে বিক্রি নেই।</p>
          )}
        </div>

        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="font-bold text-sm text-slate-900 mb-5 flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-500" /> সবচেয়ে বেশি বিক্রি হওয়া পণ্য
          </h2>
          {a.topProducts.length > 0 ? (
            <BarList items={a.topProducts.map(p => ({ label: p.name, value: p.revenue, display: `${formatPrice(Math.round(p.revenue))} (${p.qty}টি)` }))} />
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">এই সময়কালে বিক্রি নেই।</p>
          )}
        </div>
      </div>

      {/* ── বার: চ্যানেল + এলাকা ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="font-bold text-sm text-slate-900 mb-5 flex items-center gap-2">
            <Store className="w-4 h-4 text-violet-600" /> কোথা থেকে বিক্রি হচ্ছে?
          </h2>
          {a.channel.length > 0 ? (
            <div className="space-y-4">
              {a.channel.map(c => {
                const pct = a.revenue > 0 ? Math.round((c.value / a.revenue) * 100) : 0;
                return (
                  <div key={c.label} className="flex items-center gap-3">
                    {c.label === 'অনলাইন অর্ডার' ? <Globe className="w-4 h-4 text-orange-500" /> : <Store className="w-4 h-4 text-violet-500" />}
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-700">{c.label}</span>
                        <span className="text-slate-500">{formatPrice(Math.round(c.value))} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: channelColors[c.label] || '#94a3b8' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">এই সময়কালে বিক্রি নেই।</p>
          )}
        </div>

        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="font-bold text-sm text-slate-900 mb-5 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-sky-600" /> ডেলিভারি এলাকা অনুযায়ী বিক্রি
          </h2>
          {a.city.length > 0 ? (
            <div className="space-y-4">
              {a.city.map(c => {
                const pct = a.revenue > 0 ? Math.round((c.value / a.revenue) * 100) : 0;
                return (
                  <div key={c.label} className="flex items-center gap-3">
                    <MapPin className="w-4 h-4 text-sky-500" />
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-bold mb-1">
                        <span className="text-slate-700">{c.label}</span>
                        <span className="text-slate-500">{formatPrice(Math.round(c.value))} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 rounded-sm overflow-hidden">
                        <div className="h-full rounded-sm" style={{ width: `${Math.max(pct, 2)}%`, backgroundColor: cityColors[c.label] || '#94a3b8' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-slate-400 py-6 text-center">এই সময়কালে অর্ডার নেই।</p>
          )}
        </div>
      </div>

      {/* ── মূল ফাইন্ডিংস ── */}
      <div className="bg-white rounded-md border border-slate-200/80 p-6">
        <h2 className="font-bold text-sm text-slate-900 mb-5 flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-orange-600" /> এই সময়কালের মূল ফাইন্ডিংস
        </h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-100 rounded-md p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <TrendingUp className="w-3 h-3" /> সেরা বিক্রির দিন
            </div>
            <div className="text-sm font-bold text-slate-900">{bnDate(a.bestDay.date)}</div>
            <div className="text-[11px] text-slate-500 font-semibold">{formatPrice(a.bestDay.rev)} • {a.bestDay.orders}টি অর্ডার</div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-md p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <Award className="w-3 h-3" /> টপ প্রোডাক্ট
            </div>
            <div className="text-sm font-bold text-slate-900 truncate">{a.topProducts[0]?.name || '-'}</div>
            <div className="text-[11px] text-slate-500 font-semibold">
              {a.topProducts[0] ? `${a.topProducts[0].qty}টি বিক্রি • লাভ ${formatPrice(Math.round(a.topProducts[0].profit))}` : 'বিক্রি নেই'}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-md p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <Truck className="w-3 h-3" /> বাকি হিসাবে বিক্রি
            </div>
            <div className="text-sm font-bold text-slate-900">{formatPrice(a.dueInPeriod)}</div>
            <div className="text-[11px] text-slate-500 font-semibold">এই সময়কালের অর্ডারে বাকি</div>
          </div>
          <div className="bg-slate-50 border border-slate-100 rounded-md p-4">
            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <Ban className="w-3 h-3" /> বাতিল অর্ডার
            </div>
            <div className="text-sm font-bold text-slate-900">{a.cancelledCount}টি</div>
            <div className="text-[11px] text-slate-500 font-semibold">সর্বমোট (সব সময় মিলিয়ে)</div>
          </div>
        </div>
      </div>

      {/* ── বাকি ও আদায় (সর্বমোট, সময়কাল-নিরপেক্ষ) ── */}
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" /> মোট বাকি (Receivable)
            </h2>
            <span className="text-lg font-bold text-red-600">{formatPrice(summary?.totalDues || 0)}</span>
          </div>
          <div className="h-2.5 bg-slate-100 rounded-md overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-md"
              style={{
                width: `${
                  (summary?.totalDues || 0) + (summary?.totalCollected || 0) > 0
                    ? Math.max(((summary?.totalCollected || 0) / ((summary?.totalDues || 0) + (summary?.totalCollected || 0))) * 100, 2)
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex justify-between text-[11px] font-semibold text-slate-500 mt-2">
            <span>আদায় হয়েছে: {formatPrice(summary?.totalCollected || 0)}</span>
            <span>{summary?.customerCount || 0} জন কাস্টমারের খাতা</span>
          </div>
        </div>

        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 border border-slate-100 rounded-md p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">আজকের বিক্রি</span>
              <div className="mt-1.5 text-lg font-bold text-slate-900">{formatPrice(summary?.today.revenue || 0)}</div>
              <span className="text-[10px] text-slate-400 font-semibold">{summary?.today.orders || 0}টি অর্ডার</span>
            </div>
            <div className="bg-slate-50 border border-slate-100 rounded-md p-4">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">আজকের আদায়</span>
              <div className="mt-1.5 text-lg font-bold text-emerald-600">{formatPrice(summary?.today.collected || 0)}</div>
              <span className="text-[10px] text-slate-400 font-semibold">বাকি কালেকশন</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── দৈনিক হিসাব টেবিল ── */}
      <div className="bg-white rounded-md border border-slate-200/80 overflow-hidden">
        <div className="px-6 pt-5 pb-4">
          <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2">
            <Calculator className="w-4 h-4 text-orange-600" /> দিনশেষ হিসাব ({periodLabel})
          </h2>
          <p className="text-[11px] text-slate-400 mt-1">প্রতিদিনের বিক্রি, ক্রয়মূল্য, লাভ ও খরচের বিস্তারিত তালিকা</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-slate-600">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wider text-slate-400 font-bold border-y border-slate-100">
              <tr>
                <th className="py-2.5 px-6">তারিখ</th>
                <th className="py-2.5 px-3 text-center">অর্ডার</th>
                <th className="py-2.5 px-3 text-right">বিক্রি</th>
                <th className="py-2.5 px-3 text-right">ক্রয়মূল্য</th>
                <th className="py-2.5 px-3 text-right">গ্রস প্রফিট</th>
                <th className="py-2.5 px-3 text-right">খরচ</th>
                <th className="py-2.5 px-6 text-right">নেট</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {a.daily.map(d => (
                <tr key={d.date} className={d.rev === 0 && d.exp === 0 ? 'opacity-50' : ''}>
                  <td className="py-2.5 px-6 font-bold text-slate-700">{bnDate(d.date)}</td>
                  <td className="py-2.5 px-3 text-center font-semibold">{d.orders || '-'}</td>
                  <td className="py-2.5 px-3 text-right font-bold text-slate-900">{d.rev ? formatPrice(d.rev) : '-'}</td>
                  <td className="py-2.5 px-3 text-right text-red-500">{d.cogs ? '-' + formatPrice(d.cogs) : '-'}</td>
                  <td className={`py-2.5 px-3 text-right font-bold ${d.gross > 0 ? 'text-blue-700' : ''}`}>{d.gross ? formatPrice(d.gross) : '-'}</td>
                  <td className="py-2.5 px-3 text-right text-red-500">{d.exp ? '-' + formatPrice(d.exp) : '-'}</td>
                  <td className={`py-2.5 px-6 text-right font-bold ${d.net > 0 ? 'text-emerald-700' : d.net < 0 ? 'text-red-600' : ''}`}>
                    {d.rev || d.exp ? formatPrice(d.net) : '-'}
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

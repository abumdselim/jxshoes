'use client';

/**
 * হিসাব ও লাভ-ক্ষতি (P&L)
 * ------------------------
 * মোট বিক্রি − বিক্রীত পণ্যের ক্রয়মূল্য = গ্রস প্রফিট − দোকানের খরচ = নেট প্রফিট
 * প্রতিটা সেলে ক্রয়মূল্যের স্ন্যাপশট থাকে, তাই হিসাব নিখুঁত থাকে।
 */

import React, { useEffect, useState } from 'react';
import { FinanceSummary } from '@/types';
import { formatPrice } from '@/lib/utils';
import {
  Calculator,
  TrendingUp,
  TrendingDown,
  Wallet,
  PiggyBank,
  HandCoins,
  AlertTriangle,
  Package,
} from 'lucide-react';

export default function AdminFinancePage() {
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/finance');
        if (res.ok) setSummary(await res.json());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!summary) {
    return <div className="p-12 text-center text-slate-500">হিসাব লোড করা যায়নি। পেজটা রিফ্রেশ করুন।</div>;
  }

  const grossMargin = summary.revenue > 0 ? Math.round((summary.grossProfit / summary.revenue) * 100) : 0;
  const maxDaily = Math.max(...summary.dailyRevenue.map(d => d.revenue), 1);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-20">
      <div className="sticky top-14 md:top-0 z-20 bg-slate-100/85 backdrop-blur-md rounded-md border border-slate-200/80 px-4 sm:px-5 py-3.5 ">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">হিসাব ও লাভ-ক্ষতি</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          দোকানের পুরো আর্থিক চিত্র — প্রতিটা সেলের ক্রয়মূল্য স্ন্যাপশট থেকে নিখুঁত হিসাব।
        </p>
      </div>

      {/* P&L ওয়াটারফল */}
      <div className="bg-white rounded-md border border-slate-200/80 p-6 sm:p-8">
        <h2 className="font-bold text-sm text-slate-900 flex items-center gap-2 mb-6">
          <Calculator className="w-4 h-4 text-orange-600" /> লাভ-ক্ষতি হিসাব (Profit & Loss)
        </h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-md px-5 py-4">
            <div className="flex items-center gap-2.5">
              <TrendingUp className="w-4 h-4 text-slate-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-700">মোট বিক্রি (Revenue)</span>
              <span className="text-[10px] text-slate-400">{summary.orderCount}টি অর্ডার</span>
            </div>
            <span className="text-base sm:text-lg font-bold text-slate-900">{formatPrice(summary.revenue)}</span>
          </div>

          <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-md px-5 py-4">
            <div className="flex items-center gap-2.5">
              <Package className="w-4 h-4 text-slate-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-700">বিক্রীত পণ্যের ক্রয়মূল্য (COGS)</span>
            </div>
            <span className="text-base sm:text-lg font-bold text-red-600">- {formatPrice(summary.cogs)}</span>
          </div>

          <div className="flex items-center justify-between bg-blue-50/60 border border-blue-100 rounded-md px-5 py-4">
            <div className="flex items-center gap-2.5">
              <PiggyBank className="w-4 h-4 text-blue-600" />
              <span className="text-xs sm:text-sm font-bold text-blue-800">
                গ্রস প্রফিট <span className="text-[10px] font-bold opacity-70">({grossMargin}% মার্জিন)</span>
              </span>
            </div>
            <span className="text-base sm:text-lg font-bold text-blue-700">{formatPrice(summary.grossProfit)}</span>
          </div>

          <div className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-md px-5 py-4">
            <div className="flex items-center gap-2.5">
              <TrendingDown className="w-4 h-4 text-slate-500" />
              <span className="text-xs sm:text-sm font-bold text-slate-700">দোকানের খরচ (Expenses)</span>
            </div>
            <span className="text-base sm:text-lg font-bold text-red-600">- {formatPrice(summary.operatingExpenses)}</span>
          </div>

          <div
            className={`flex items-center justify-between rounded-md px-5 py-5 border-2 ${
              summary.netProfit >= 0
                ? 'bg-emerald-50 border-emerald-200'
                : 'bg-red-50 border-red-200'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Wallet className={`w-5 h-5 ${summary.netProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`} />
              <span className={`text-sm font-bold ${summary.netProfit >= 0 ? 'text-emerald-800' : 'text-red-800'}`}>
                {summary.netProfit >= 0 ? 'নেট প্রফিট' : 'নেট লস'}
              </span>
            </div>
            <span className={`text-xl sm:text-2xl font-bold ${summary.netProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
              {summary.netProfit >= 0 ? formatPrice(summary.netProfit) : '-' + formatPrice(Math.abs(summary.netProfit))}
            </span>
          </div>
        </div>
      </div>

      {/* সংক্ষিপ্ত পরিসংখ্যান */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-md border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">আজকের বিক্রি</span>
          <div className="mt-2 text-xl font-bold text-slate-900">{formatPrice(summary.today.revenue)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">{summary.today.orders}টি অর্ডার • আদায় {formatPrice(summary.today.collected)}</span>
        </div>
        <div className="bg-white p-5 rounded-md border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">গত ৭ দিন</span>
          <div className="mt-2 text-xl font-bold text-slate-900">{formatPrice(summary.last7.revenue)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">{summary.last7.orders}টি অর্ডার</span>
        </div>
        <div className="bg-white p-5 rounded-md border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">মোট বাকি</span>
            <AlertTriangle className="w-4 h-4 text-red-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-red-600">{formatPrice(summary.totalDues)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">{summary.customerCount} জন কাস্টমারের খাতা</span>
        </div>
        <div className="bg-white p-5 rounded-md border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">বাকি আদায়</span>
            <HandCoins className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 text-xl font-bold text-emerald-600">{formatPrice(summary.totalCollected)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">সর্বমোট কালেকশন</span>
        </div>
      </div>

      {/* দৈনিক বিক্রি চার্ট */}
      <div className="bg-white rounded-md border border-slate-200/80 p-6">
        <h2 className="font-bold text-sm text-slate-900 mb-5">গত ৩০ দিনের দৈনিক বিক্রি</h2>
        <div className="flex items-end gap-[3px] h-36">
          {summary.dailyRevenue.map(d => (
            <div key={d.date} className="flex-1 group relative flex flex-col justify-end h-full">
              <div
                className={`w-full rounded-t-sm transition-all group-hover:bg-orange-500 ${
                  d.revenue > 0 ? 'bg-orange-400' : 'bg-slate-100'
                }`}
                style={{ height: `${Math.max((d.revenue / maxDaily) * 100, 3)}%` }}
              />
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block whitespace-nowrap bg-slate-900 text-white text-[10px] font-bold rounded-md px-2.5 py-1.5 z-10">
                {d.date}: {formatPrice(d.revenue)}
              </div>
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-slate-400 mt-2 font-semibold">
          <span>{summary.dailyRevenue[0]?.date}</span>
          <span>আজ</span>
        </div>
      </div>

      {/* খরচ বিভাজন */}
      {summary.expenseByCategory.length > 0 && (
        <div className="bg-white rounded-md border border-slate-200/80 p-6">
          <h2 className="font-bold text-sm text-slate-900 mb-5">খরচ কোন খাতায় কত?</h2>
          <div className="space-y-3">
            {summary.expenseByCategory.map(e => {
              const pct = summary.operatingExpenses > 0 ? Math.round((e.amount / summary.operatingExpenses) * 100) : 0;
              return (
                <div key={e.category}>
                  <div className="flex justify-between text-xs font-bold mb-1">
                    <span className="text-slate-700">{e.category}</span>
                    <span className="text-slate-500">{formatPrice(e.amount)} ({pct}%)</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-md h-2.5 overflow-hidden">
                    <div className="bg-red-400 h-2.5 rounded-md" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

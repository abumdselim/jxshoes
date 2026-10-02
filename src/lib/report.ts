/**
 * AI সাপ্তাহিক/মাসিক বিজনেস রিপোর্ট জেনারেটর
 * ---------------------------------------------
 * - সংখ্যা (স্কোরকার্ড) কোড থেকে নিখুঁতভাবে হিসাব হয়
 * - বিশ্লেষণ ও পরামর্শ AI লেখে (আসল ডেটা দেখে)
 * - রিপোর্ট KV-তে সেভ হয় (history)
 */

import { runAIJson } from './ai';
import {
  computeFinanceSummary,
  getCustomers,
  getExpenses,
  getOrders,
  getProducts,
  saveReport,
} from './store';
import { StoredReport } from '@/types';

export interface PeriodStats {
  label: string;
  days: number;
  periodStart: Date;
  revenue: number;
  orderCount: number;
  cogs: number;
  grossProfit: number;
  onlineRevenue: number;
  inStoreRevenue: number;
  avgOrderValue: number;
  expenses: { category: string; amount: number }[];
  expenseTotal: number;
  newCustomers: number;
  collectedInPeriod: number;
  topProducts: { name: string; qty: number; revenue: number }[];
  dailySeries: { date: string; revenue: number }[];
  prevRevenue: number;
  growthPercent: number;
  lowStock: { name: string; stock: number; alert: number; supplier?: string }[];
  outOfStock: string[];
  totalDues: number;
  dueCustomers: number;
}

async function gatherPeriodStats(type: 'weekly' | 'monthly'): Promise<PeriodStats> {
  const days = type === 'weekly' ? 7 : 30;
  const now = new Date();
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);
  const start = new Date(endOfDay.getTime() - (days - 1) * 86400000);
  start.setHours(0, 0, 0, 0);
  const prevStart = new Date(start.getTime() - days * 86400000);

  const [orders, products, customers, expenses, finance, allExpenses] = await Promise.all([
    getOrders(),
    getProducts(),
    getCustomers(),
    getExpenses(),
    computeFinanceSummary(),
    getExpenses(),
  ]);

  const validOrders = orders.filter(o => o.status !== 'Cancelled');
  const periodOrders = validOrders.filter(o => {
    const t = new Date(o.createdAt).getTime();
    return t >= start.getTime() && t <= endOfDay.getTime();
  });
  const prevOrders = validOrders.filter(o => {
    const t = new Date(o.createdAt).getTime();
    return t >= prevStart.getTime() && t < start.getTime();
  });

  let revenue = 0;
  let cogs = 0;
  let onlineRevenue = 0;
  let inStoreRevenue = 0;
  const productMap = new Map<string, { name: string; qty: number; revenue: number }>();

  for (const o of periodOrders) {
    revenue += o.total;
    if (o.source === 'in-store') inStoreRevenue += o.total;
    else onlineRevenue += o.total;
    for (const it of o.items) {
      const cur = productMap.get(it.productId) || { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.quantity;
      cur.revenue += it.price * it.quantity;
      productMap.set(it.productId, cur);
      let cost = it.costPrice;
      if (cost === undefined) {
        const prod = products.find(p => p.id === it.productId);
        cost = prod?.costPrice ?? Math.round(it.price * 0.65);
      }
      cogs += cost * it.quantity;
    }
  }

  const expenseMap = new Map<string, number>();
  for (const e of allExpenses) {
    const t = new Date(e.createdAt).getTime();
    if (t >= start.getTime() && t <= endOfDay.getTime()) {
      expenseMap.set(e.category, (expenseMap.get(e.category) || 0) + e.amount);
    }
  }

  // দৈনিক সিরিজ
  const dayKey = (t: number) => new Date(t).toLocaleDateString('en-CA');
  const revByDay = new Map<string, number>();
  for (const o of periodOrders) {
    const key = dayKey(new Date(o.createdAt).getTime());
    revByDay.set(key, (revByDay.get(key) || 0) + o.total);
  }
  const dailySeries: { date: string; revenue: number }[] = [];
  for (let i = 0; i < days; i++) {
    const key = dayKey(start.getTime() + i * 86400000);
    dailySeries.push({ date: key, revenue: revByDay.get(key) || 0 });
  }

  const newCustomers = customers.filter(c => new Date(c.createdAt).getTime() >= start.getTime()).length;
  const lowStock = products
    .filter(p => p.stockCount > 0 && p.stockCount <= (p.minStockAlert ?? 5))
    .map(p => ({ name: p.name, stock: p.stockCount, alert: p.minStockAlert ?? 5, supplier: p.supplier }));
  const outOfStock = products.filter(p => p.stockCount === 0).map(p => p.name);

  const prevRevenue = prevOrders.reduce((s, o) => s + o.total, 0);
  const growthPercent = prevRevenue > 0 ? Math.round(((revenue - prevRevenue) / prevRevenue) * 100) : revenue > 0 ? 100 : 0;

  const label =
    type === 'weekly'
      ? `সাপ্তাহিক রিপোর্ট (${new Date(start).toLocaleDateString('en-CA')} → ${new Date(endOfDay).toLocaleDateString('en-CA')})`
      : `মাসিক রিপোর্ট (${new Date(start).toLocaleDateString('en-CA')} → ${new Date(endOfDay).toLocaleDateString('en-CA')})`;

  return {
    label,
    days,
    periodStart: start,
    revenue,
    orderCount: periodOrders.length,
    cogs: Math.round(cogs),
    grossProfit: Math.round(revenue - cogs),
    onlineRevenue,
    inStoreRevenue,
    avgOrderValue: periodOrders.length > 0 ? Math.round(revenue / periodOrders.length) : 0,
    expenses: Array.from(expenseMap.entries()).map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount),
    expenseTotal: Array.from(expenseMap.values()).reduce((s, v) => s + v, 0),
    newCustomers,
    collectedInPeriod: 0, // নিচে ফিল হবে
    topProducts: Array.from(productMap.values()).sort((a, b) => b.qty - a.qty).slice(0, 8),
    dailySeries,
    prevRevenue,
    growthPercent,
    lowStock,
    outOfStock,
    totalDues: finance.totalDues,
    dueCustomers: customers.filter(c => (c.dueAmount || 0) > 0).length,
  };
}

/** AI-কে সময়কালের ডেটা দিয়ে রিপোর্ট লেখানো হয়; স্কোরকার্ড কোড থেকে নিখুঁত হিসাব হয় */
export async function generateReport(type: 'weekly' | 'monthly'): Promise<StoredReport> {
  const stats = await gatherPeriodStats(type);

  const dataForAI = [
    `সময়কাল: ${stats.label} (${stats.days} দিন)`,
    `মোট বিক্রি: ৳${stats.revenue} | অর্ডার: ${stats.orderCount}টি | গড় অর্ডার: ৳${stats.avgOrderValue}`,
    `বিক্রির উৎস: অনলাইন ৳${stats.onlineRevenue}, দোকানে (POS) ৳${stats.inStoreRevenue}`,
    `আগের সময়কালের বিক্রি ছিল ৳${stats.prevRevenue} — পরিবর্তন: ${stats.growthPercent > 0 ? '+' : ''}${stats.growthPercent}%`,
    `বিক্রীত পণ্যের ক্রয়মূল্য: ৳${stats.cogs} → গ্রস প্রফিট: ৳${stats.grossProfit}`,
    `সময়কালের খরচ: ৳${stats.expenseTotal}${stats.expenses.length > 0 ? ' (' + stats.expenses.map(e => `${e.category}: ৳${e.amount}`).join(', ') + ')' : ''}`,
    `নতুন কাস্টমার: ${stats.newCustomers} জন | মোট বাকি: ৳${stats.totalDues} (${stats.dueCustomers} জনের উপর)`,
    `দৈনিক বিক্রি: ${stats.dailySeries.map(d => `${d.date}: ৳${d.revenue}`).join(', ')}`,
    stats.topProducts.length > 0
      ? `টপ প্রোডাক্ট: ${stats.topProducts.map(p => `${p.name} (${p.qty}টি, ৳${p.revenue})`).join('; ')}`
      : 'এই সময়কালে কোনো বিক্রি হয়নি',
    stats.lowStock.length > 0
      ? `লো-স্টক: ${stats.lowStock.map(p => `${p.name} (বাকি ${p.stock}টি${p.supplier ? `, সাপ্লায়ার: ${p.supplier}` : ''})`).join('; ')}`
      : 'লো-স্টক সমস্যা নেই',
    stats.outOfStock.length > 0 ? `স্টক শেষ: ${stats.outOfStock.join(', ')}` : 'স্টক-আউট নেই',
  ].join('\n');

  const parsed = await runAIJson<{
    headline?: string;
    executiveSummary?: string;
    sections?: { title?: string; body?: string; highlights?: string[] }[];
    recommendations?: string[];
  }>(
    [
      {
        role: 'system',
        content: `তুমি বাংলাদেশের একটি জুতা-ব্যাগের দোকানের প্রফেশনাল বিজনেস কনসালট্যান্ট। নিচের আসল ডেটা বিশ্লেষণ করে একটি প্রফেশনাল রিপোর্ট লিখবে — সব লেখা সহজ বাংলায়। দোকানের মালিক ব্যবসায়ী, তাকে "আপনি" সম্বোধন করবে। বানানো সংখ্যা লিখবে না — শুধু দেওয়া সংখ্যা ব্যবহার করবে; তবে সংখ্যা থেকে নিজে হিসাব করে উপসংহার টানতে পারবে (যেমন গড়, ট্রেন্ড)।

শুধুমাত্র এই JSON দাও:
{"headline": "এক লাইনে সবচেয়ে গুরুত্বপূর্ণ ফাইন্ডিং", "executiveSummary": "৩-৫ বাক্যে সামগ্রিক অবস্থা", "sections": [{"title": "সেকশনের শিরোনাম", "body": "বিশ্লেষণ (৩-৬ বাক্য)", "highlights": ["চোখে লাগার মতো পয়েন্ট"]}],"recommendations": ["পরের সময়ের জন্য ৩-৫টি কার্যকর পরামর্শ"]}
sections-এ অন্তত এই বিষয়গুলো ঢাকো: সেলস পারফরম্যান্স ও ট্রেন্ড, প্রোডাক্ট ইনসাইট (কী চলছে কী বসে আছে), কাস্টমার ও বাকি, স্টক ও প্রস্তুতি।

দোকানের সময়কালের ডেটা:
${dataForAI}`,
      },
      { role: 'user', content: `${type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'} বিজনেস রিপোর্ট লিখে দাও।` },
    ],
    { maxTokens: 3600, temperature: 0.45 }
  );

  const now = new Date();
  const periodEnd = now;

  const scorecard = [
    { label: 'মোট বিক্রি', value: `৳${stats.revenue.toLocaleString('en-BD')}` },
    { label: 'অর্ডার', value: `${stats.orderCount}টি` },
    { label: 'গ্রস প্রফিট', value: `৳${stats.grossProfit.toLocaleString('en-BD')}` },
    { label: 'গড় অর্ডার ভ্যালু', value: `৳${stats.avgOrderValue.toLocaleString('en-BD')}` },
    {
      label: 'আগের সময়ের তুলনায়',
      value: `${stats.growthPercent > 0 ? '+' : ''}${stats.growthPercent}%`,
    },
    { label: 'নতুন কাস্টমার', value: `${stats.newCustomers} জন` },
    { label: 'মোট বাকি', value: `৳${stats.totalDues.toLocaleString('en-BD')}` },
    { label: 'খরচ', value: `৳${stats.expenseTotal.toLocaleString('en-BD')}` },
  ];

  const report: StoredReport = {
    id: `rep-${Date.now()}`,
    type,
    periodStart: stats.periodStart.toISOString(),
    periodEnd: periodEnd.toISOString(),
    headline: parsed.headline || stats.label,
    executiveSummary: parsed.executiveSummary || '',
    sections: (parsed.sections || [])
      .filter(s => s.title && s.body)
      .map(s => ({
        title: s.title!,
        body: s.body!,
        highlights: Array.isArray(s.highlights) ? s.highlights : [],
      })),
    scorecard,
    recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
    generatedAt: now.toISOString(),
  };

  await saveReport(report);
  return report;
}

/** রিপোর্ট থেকে ইমেইলের জন্য সহজ HTML (ইমেইল ক্লায়েন্টে inline CSS লাগে) */
export function renderReportEmailHtml(report: StoredReport, storeName: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const sections = report.sections
    .map(
      s => `
      <div style="margin:18px 0;">
        <h3 style="margin:0 0 6px;color:#c2410c;font-size:15px;">${esc(s.title)}</h3>
        <p style="margin:0;color:#334155;font-size:13px;line-height:1.7;">${esc(s.body).replace(/\n/g, '<br/>')}</p>
        ${(s.highlights || []).map(h => `<p style="margin:6px 0 0;color:#0f766e;font-size:12px;">• ${esc(h)}</p>`).join('')}
      </div>`
    )
    .join('');

  const scorecard = report.scorecard
    .map(
      s => `
      <td style="padding:6px;">
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:10px 8px;text-align:center;">
          <div style="font-size:10px;color:#64748b;font-weight:700;">${esc(s.label)}</div>
          <div style="font-size:14px;color:#0f172a;font-weight:800;margin-top:2px;">${esc(s.value)}</div>
        </div>
      </td>`
    )
    .join('');

  const recommendations = report.recommendations
    .map(r => `<li style="margin:4px 0;color:#334155;font-size:13px;">${esc(r)}</li>`)
    .join('');

  return `<!DOCTYPE html>
<html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:'Segoe UI',Arial,sans-serif;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
    <div style="background:linear-gradient(135deg,#ea580c,#f59e0b);padding:24px;color:#ffffff;">
      <div style="font-size:12px;font-weight:700;opacity:0.9;">${esc(storeName)} — AI বিজনেস রিপোর্ট</div>
      <h1 style="margin:6px 0 0;font-size:20px;">${esc(report.headline)}</h1>
      <div style="font-size:11px;margin-top:8px;opacity:0.9;">${esc(report.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক')} • ${new Date(report.periodStart).toLocaleDateString('en-CA')} → ${new Date(report.periodEnd).toLocaleDateString('en-CA')}</div>
    </div>
    <div style="padding:24px;">
      <p style="margin:0 0 14px;color:#334155;font-size:13px;line-height:1.7;">${esc(report.executiveSummary)}</p>
      <table style="width:100%;border-collapse:collapse;"><tr>${scorecard}</tr></table>
      ${sections}
      ${report.recommendations.length > 0 ? `<div style="background:#0f172a;border-radius:12px;padding:16px;margin-top:16px;"><h3 style="margin:0 0 8px;color:#fb923c;font-size:13px;">AI-এর পরামর্শ</h3><ul style="margin:0;padding-left:18px;">${recommendations}</ul></div>` : ''}
      <p style="margin:20px 0 0;color:#94a3b8;font-size:11px;">এই রিপোর্ট আপনার দোকানের আসল ডেটা থেকে AI দ্বারা তৈরি — ${new Date(report.generatedAt).toLocaleString('bn-BD')}</p>
    </div>
  </div>
</body></html>`;
}

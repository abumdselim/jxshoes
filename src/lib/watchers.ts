/**
 * প্রোঅ্যাকটিভ AI ওয়াচার — AI এখন নিজে নজর রাখে।
 * সব চেক ডিটারমিনিস্টিক (শূন্য AI-খরচ, নির্ভরযোগ্য); দৈনিক আইডি-কনভেনশনে ডিডুপ —
 * একই সতর্কতা দিনে একবারের বেশি জেনারেট হয় না, আর পড়া অবস্থা সংরক্ষিত থাকে।
 * চালানো হয়: ডেইলি ব্রিফ জেনারেটের সময় + /api/cron/watch (দৈনিক ক্রন)।
 */
import { getStoreData, listNotificationIds, putNotification } from '@/lib/store';
import type { NotificationItem } from '@/types';

export interface WatchResult {
  created: number;
  alerts: { key: string; title: string; message: string }[];
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

function fmtTk(n: number): string {
  return `৳${n.toLocaleString('en-BD')}`;
}

export async function runDailyWatchers(): Promise<WatchResult> {
  const data = await getStoreData();
  const dateKey = todayKey();
  const existingIds = new Set(await listNotificationIds());

  const alerts: { key: string; title: string; message: string }[] = [];

  // ১) স্টক শেষ
  const outOfStock = data.products.filter(p => p.stockCount === 0);
  if (outOfStock.length > 0) {
    alerts.push({
      key: 'oos',
      title: `স্টক শেষ: ${outOfStock.length}টি প্রোডাক্ট`,
      message: `${outOfStock.slice(0, 6).map(p => `${p.name} (${p.sku})`).join(', ')}${outOfStock.length > 6 ? ` আরও ${outOfStock.length - 6}টি` : ''} — স্টোরফ্রন্টে এখন কেনা যাচ্ছে না। দ্রুত রিস্টক করুন।`,
    });
  }

  // ২) লো-স্টক
  const lowStock = data.products.filter(p => p.stockCount > 0 && p.stockCount <= (p.minStockAlert || 5));
  if (lowStock.length > 0) {
    alerts.push({
      key: 'lowstock',
      title: `স্টক কমে আসছে: ${lowStock.length}টি প্রোডাক্ট`,
      message: `${lowStock.slice(0, 6).map(p => `${p.name} (বাকি ${p.stockCount})`).join(', ')} — আজই চালান দেওয়ার পরিকল্পনা করুন।`,
    });
  }

  // ৩) ২৪ ঘণ্টা+ পুরনো পেন্ডিং/প্রসেসিং অর্ডার
  const cutoff = Date.now() - 24 * 3600000;
  const staleOrders = data.orders.filter(
    o => (o.status === 'Pending' || o.status === 'Processing') && new Date(o.createdAt).getTime() < cutoff
  );
  if (staleOrders.length > 0) {
    alerts.push({
      key: 'stale-orders',
      title: `${staleOrders.length}টি অর্ডার ২৪ ঘণ্টা+ ধরে ঝুলছে`,
      message: `${staleOrders.slice(0, 5).map(o => `${o.orderNumber} (${o.customerName})`).join(', ')}${staleOrders.length > 5 ? ` আরও ${staleOrders.length - 5}টি` : ''} — প্যাকিং/কুরিয়ারে দেওয়ার সময় হয়েছে।`,
    });
  }

  // ৪) বাকির ঝুঁকি — মোট বাকি ও শীর্ষ গ্রাহক
  const dueCustomers = (data.customers || []).filter(c => c.dueAmount > 0).sort((a, b) => b.dueAmount - a.dueAmount);
  if (dueCustomers.length > 0) {
    const totalDues = dueCustomers.reduce((s, c) => s + c.dueAmount, 0);
    alerts.push({
      key: 'dues',
      title: `বাকি আদায়ের অপেক্ষায় ${fmtTk(totalDues)}`,
      message: `শীর্ষ গ্রাহক: ${dueCustomers.slice(0, 3).map(c => `${c.name} (${fmtTk(c.dueAmount)})`).join(', ')}। ফলো-আপ করলে নগদ প্রবাহ বাড়বে।`,
    });
  }

  // ৫) দীর্ঘ বিক্রয়-শূন্যতা — শেষ ৩ সম্পূর্ণ দিনে কোনো অর্ডার নেই (আগে বিক্রি ছিল)
  const dayStart = (offsetDays: number) => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime() - offsetDays * 86400000;
  };
  const validOrders = data.orders.filter(o => o.status !== 'Cancelled');
  const hasPastSales = validOrders.some(o => new Date(o.createdAt).getTime() < dayStart(3));
  const recentSales = validOrders.filter(o => new Date(o.createdAt).getTime() >= dayStart(3));
  if (hasPastSales && recentSales.length === 0 && validOrders.length > 0) {
    alerts.push({
      key: 'no-sales',
      title: 'টানা ৩ দিন কোনো বিক্রি হয়নি',
      message: 'গত ৩ দিনে কোনো অর্ডার পড়েনি। ব্যানার/ডিল চালু আছে কি না দেখুন, বা মার্কেটিং কপি AI দিয়ে নতুন করে নিন।',
    });
  }

  // নোটিফিকেশনে লেখা — আইডি কনভেনশনে ডিডুপ, পড়া অবস্থা অটো-সংরক্ষিত
  let created = 0;
  for (const alert of alerts) {
    const id = `ntf-ai-${dateKey}-${alert.key}`;
    if (existingIds.has(id)) continue;
    const item: NotificationItem = {
      id,
      type: 'ai',
      title: alert.title,
      message: alert.message,
      read: false,
      createdAt: new Date().toISOString(),
    };
    await putNotification(item);
    created++;
  }

  return { created, alerts };
}

/** ডেইলি ব্রিফের AI সতর্কতাগুলো নোটিফিকেশন সেন্টারে মিরর (একই ডিডুপ নিয়মে) */
export async function mirrorBriefAlerts(brief: { alerts?: string[] }): Promise<number> {
  if (!brief.alerts || brief.alerts.length === 0) return 0;
  const dateKey = todayKey();
  const existingIds = new Set(await listNotificationIds());
  let created = 0;
  for (let i = 0; i < brief.alerts.length; i++) {
    const alert = brief.alerts[i];
    const id = `ntf-ai-${dateKey}-brief-${i}`;
    if (existingIds.has(id)) continue;
    await putNotification({
      id,
      type: 'ai',
      title: `AI সতর্কতা`,
      message: alert,
      read: false,
      createdAt: new Date().toISOString(),
    });
    created++;
  }
  return created;
}

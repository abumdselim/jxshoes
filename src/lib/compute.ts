/**
 * পিওর কম্পিউটেশন — সার্ভার (API routes) ও অফলাইন ক্লায়েন্ট (offline mirror)
 * দুই জায়গায় একই লজিক চলে, তাই অফলাইনেও হিসাব হুবহু মিলবে।
 * এখানে কোনো I/O (KV/fetch) নয় — শুধু FullStoreData থেকে গণিত।
 */
import type {
  FinanceSummary,
  FastMoverEntry,
  Product,
  InventoryMovement,
} from '@/types';
import type { FullStoreData } from '@/types/fullStoreData';

// ================== FINANCE SUMMARY (লাভ-ক্ষতি ও হিসাব) ==================
export function computeFinanceSummaryFromData(data: FullStoreData): FinanceSummary {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfDay - 6 * 86400000;
  const monthAgo = startOfDay - 29 * 86400000;

  const validOrders = data.orders.filter(o => o.status !== 'Cancelled');
  const inRange = (o: { createdAt: string }, from: number) =>
    new Date(o.createdAt).getTime() >= from;

  let revenue = 0;
  let cogs = 0;
  for (const o of validOrders) {
    revenue += o.total;
    for (const it of o.items) {
      let cost = it.costPrice;
      if (cost === undefined) {
        // পুরনো অর্ডারে স্ন্যাপশট না থাকলে বর্তমান ক্রয়মূল্য বা ৬৫% অনুমান
        const prod = data.products.find(p => p.id === it.productId);
        cost = prod?.costPrice ?? Math.round(it.price * 0.65);
      }
      cogs += cost * it.quantity;
    }
  }

  const grossProfit = revenue - cogs;
  const operatingExpenses = (data.expenses || []).reduce((s, e) => s + e.amount, 0);

  const expenseMap = new Map<string, number>();
  for (const e of data.expenses || []) {
    expenseMap.set(e.category, (expenseMap.get(e.category) || 0) + e.amount);
  }

  // গত ৩০ দিনের দৈনিক বিক্রি সিরিজ (তারিখ অনুযায়ী)
  const dayKey = (t: number) => new Date(t).toLocaleDateString('en-CA');
  const revByDay = new Map<string, number>();
  for (const o of validOrders) {
    if (inRange(o, monthAgo)) {
      const key = dayKey(new Date(o.createdAt).getTime());
      revByDay.set(key, (revByDay.get(key) || 0) + o.total);
    }
  }
  const dailyRevenue: { date: string; revenue: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const key = dayKey(startOfDay - i * 86400000);
    dailyRevenue.unshift({ date: key, revenue: revByDay.get(key) || 0 });
  }

  const todayOrders = validOrders.filter(o => inRange(o, startOfDay));
  const totalDues = (data.customers || []).reduce((s, c) => s + (c.dueAmount || 0), 0);
  const allPayments = data.duePayments || [];

  return {
    revenue,
    cogs: Math.round(cogs),
    grossProfit: Math.round(grossProfit),
    operatingExpenses,
    netProfit: Math.round(grossProfit - operatingExpenses),
    totalDues,
    totalCollected: allPayments.reduce((s, p) => s + p.amount, 0),
    orderCount: validOrders.length,
    customerCount: (data.customers || []).length,
    expenseByCategory: Array.from(expenseMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    dailyRevenue,
    today: {
      revenue: todayOrders.reduce((s, o) => s + o.total, 0),
      orders: todayOrders.length,
      collected: allPayments
        .filter(p => new Date(p.createdAt).getTime() >= startOfDay)
        .reduce((s, p) => s + p.amount, 0),
    },
    last7: {
      revenue: validOrders.filter(o => inRange(o, weekAgo)).reduce((s, o) => s + o.total, 0),
      orders: validOrders.filter(o => inRange(o, weekAgo)).length,
    },
    last30: {
      revenue: validOrders.filter(o => inRange(o, monthAgo)).reduce((s, o) => s + o.total, 0),
      orders: validOrders.filter(o => inRange(o, monthAgo)).length,
    },
  };
}

// ================== FAST MOVERS (দ্রুততম বিক্রিত পণ্য) ==================
/**
 * কোন পণ্য ক্রেতারা সবচেয়ে বেশি পছন্দ করেছে —
 * স্টক যুক্ত হওয়ার দিন (createdAt) থেকে গড়ে দিনে কতটা বিক্রি হয়েছে (velocity)
 * তার ভিত্তিতে র‍্যাংকিং। দ্রুত বিক্রি হয়ে স্টক শেষ হওয়াগুলোও চিহ্নিত হয়।
 */
export function getFastMoversFromData(data: FullStoreData, limit = 6): FastMoverEntry[] {
  const soldBy = new Map<string, { qty: number; revenue: number }>();
  for (const o of data.orders) {
    if (o.status === 'Cancelled') continue;
    for (const it of o.items) {
      const cur = soldBy.get(it.productId) || { qty: 0, revenue: 0 };
      cur.qty += it.quantity;
      cur.revenue += it.price * it.quantity;
      soldBy.set(it.productId, cur);
    }
  }

  const now = Date.now();
  const movers: FastMoverEntry[] = [];
  for (const p of data.products) {
    const s = soldBy.get(p.id);
    if (!s || s.qty <= 0) continue;
    const created = new Date(p.createdAt).getTime();
    const daysInStock = Math.max(1, Math.ceil((now - created) / 86400000));
    movers.push({
      productId: p.id,
      name: p.name,
      sku: p.sku || '-',
      image: p.images[0] || '',
      totalSold: s.qty,
      revenue: Math.round(s.revenue),
      daysInStock,
      velocity: Math.round((s.qty / daysInStock) * 100) / 100,
      stockLeft: p.stockCount,
      soldOut: p.stockCount === 0,
    });
  }

  return movers
    .sort((a, b) => b.velocity - a.velocity || b.totalSold - a.totalSold)
    .slice(0, limit);
}

// ================== INVENTORY SUMMARY (ইনভেন্টরি সারসংক্ষেপ) ==================
export interface InventorySummary {
  totalSkus: number;
  totalUnits: number;
  totalCostValue: number;
  totalRetailValue: number;
  potentialProfit: number;
  profitMarginPercent: number;
  lowStockCount: number;
  outOfStockCount: number;
}

export function computeInventorySummary(products: Product[]): {
  summary: InventorySummary;
  lowStockProducts: Product[];
  outOfStockProducts: Product[];
} {
  const totalSkus = products.length;
  const totalUnits = products.reduce((acc, p) => acc + (p.stockCount || 0), 0);
  const totalCostValue = products.reduce((acc, p) => acc + ((p.costPrice || 0) * (p.stockCount || 0)), 0);
  const totalRetailValue = products.reduce((acc, p) => acc + ((p.price || 0) * (p.stockCount || 0)), 0);
  const potentialProfit = Math.max(0, totalRetailValue - totalCostValue);

  const lowStockProducts = products.filter(
    p => p.stockCount > 0 && p.stockCount <= (p.minStockAlert || 5)
  );
  const outOfStockProducts = products.filter(p => p.stockCount === 0);

  return {
    summary: {
      totalSkus,
      totalUnits,
      totalCostValue,
      totalRetailValue,
      potentialProfit,
      profitMarginPercent: totalRetailValue > 0 ? Math.round((potentialProfit / totalRetailValue) * 100) : 0,
      lowStockCount: lowStockProducts.length,
      outOfStockCount: outOfStockProducts.length,
    },
    lowStockProducts,
    outOfStockProducts,
  };
}

// ================== FORECAST (আগামী দিনের প্রজেকশন — পিওর গণিত) ==================
export interface SalesForecast {
  last7Avg: number; // শেষ ৭ দিনের গড় দৈনিক বিক্রয়
  prev7Avg: number; // তার আগের ৭ দিনের গড়
  wowGrowthPercent: number; // সপ্তাহ-ওভার-সপ্তাহ পরিবর্তন
  trend: 'up' | 'down' | 'flat';
  projectedNext7Total: number; // আগামী ৭ দিনের সম্ভাব্য মোট বিক্রয় (শেষ ৭ দিনের গড় × ৭)
  last14Series: { date: string; revenue: number }[];
}

export function computeSalesForecast(data: FullStoreData): SalesForecast {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const dayKey = (t: number) => new Date(t).toLocaleDateString('en-CA');
  const validOrders = data.orders.filter(o => o.status !== 'Cancelled');

  const revByDay = new Map<string, number>();
  for (const o of validOrders) {
    const key = dayKey(new Date(o.createdAt).getTime());
    revByDay.set(key, (revByDay.get(key) || 0) + o.total);
  }

  const sumRange = (fromOffset: number, toOffset: number) => {
    let sum = 0;
    for (let i = fromOffset; i < toOffset; i++) sum += revByDay.get(dayKey(startOfDay - i * 86400000)) || 0;
    return sum;
  };
  const last7Sum = sumRange(0, 7);
  const prev7Sum = sumRange(7, 14);

  const last7Avg = Math.round(last7Sum / 7);
  const prev7Avg = Math.round(prev7Sum / 7);
  const wowGrowthPercent = prev7Avg > 0 ? Math.round(((last7Avg - prev7Avg) / prev7Avg) * 100) : last7Avg > 0 ? 100 : 0;
  const trend: SalesForecast['trend'] = wowGrowthPercent > 5 ? 'up' : wowGrowthPercent < -5 ? 'down' : 'flat';

  const last14Series: { date: string; revenue: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const key = dayKey(startOfDay - i * 86400000);
    last14Series.push({ date: key, revenue: revByDay.get(key) || 0 });
  }

  return {
    last7Avg,
    prev7Avg,
    wowGrowthPercent,
    trend,
    projectedNext7Total: last7Avg * 7,
    last14Series,
  };
}

export interface ProductCover {
  productId: string;
  name: string;
  sku: string;
  soldLast30: number;
  velocityPerDay: number; // গড়ে দিনে বিক্রি (একক)
  stockLeft: number;
  daysOfCover: number | null; // বর্তমান গতিতে স্টক কত দিন চলবে (null = বিক্রি নেই)
  verdict: 'critical' | 'low' | 'ok' | 'slow';
}

/** প্রতি-প্রোডাক্ট velocity থেকে কত দিনের স্টক আছে — রিস্টক সিদ্ধান্তের ভিত্তি */
export function computeDaysOfCover(data: FullStoreData, limit = 20): ProductCover[] {
  const now = new Date();
  const monthAgo = now.getTime() - 30 * 86400000;
  const soldBy = new Map<string, number>();
  for (const o of data.orders) {
    if (o.status === 'Cancelled') continue;
    if (new Date(o.createdAt).getTime() < monthAgo) continue;
    for (const it of o.items) {
      soldBy.set(it.productId, (soldBy.get(it.productId) || 0) + it.quantity);
    }
  }

  const covers: ProductCover[] = data.products.map(p => {
    const soldLast30 = soldBy.get(p.id) || 0;
    const velocityPerDay = Math.round((soldLast30 / 30) * 100) / 100;
    const daysOfCover = velocityPerDay > 0 ? Math.floor(p.stockCount / velocityPerDay) : null;
    let verdict: ProductCover['verdict'];
    if (velocityPerDay === 0) verdict = p.stockCount === 0 ? 'critical' : 'slow';
    else if (daysOfCover !== null && daysOfCover <= 7) verdict = 'critical';
    else if (daysOfCover !== null && daysOfCover <= 14) verdict = 'low';
    else verdict = 'ok';
    return {
      productId: p.id,
      name: p.name,
      sku: p.sku || '-',
      soldLast30,
      velocityPerDay,
      stockLeft: p.stockCount,
      daysOfCover,
      verdict,
    };
  });

  const rank = { critical: 0, low: 1, slow: 2, ok: 3 } as const;
  return covers
    .sort((a, b) => rank[a.verdict] - rank[b.verdict] || a.soldLast30 - b.soldLast30)
    .slice(0, limit);
}

// ================== STOCK HELPERS (মিররে স্টক কাটা) ==================
/** অর্ডার আইটেমের সাইজ/কালার অনুযায়ী ভ্যারিয়েন্ট বা মূল স্টক কমায়; movement log-এ যোগ করে। শুধু অফলাইন মিররে ব্যবহৃত। */
export function deductStockForOrder(
  data: FullStoreData,
  items: { productId: string; quantity: number; selectedSize?: string; selectedColor?: string; variantId?: string }[],
  orderNumber: string,
  nowIso: string
): InventoryMovement[] {
  const newMovements: InventoryMovement[] = [];
  for (const it of items) {
    const p = data.products.find(pr => pr.id === it.productId);
    if (!p) continue;
    const qty = it.quantity || 1;
    const variant = it.variantId
      ? p.variants?.find(v => v.id === it.variantId)
      : p.variants?.find(v => it.selectedSize && v.size === it.selectedSize && (!it.selectedColor || v.color === it.selectedColor));
    let previousStock: number;
    let newStock: number;
    let variantInfo: string | undefined;
    if (variant) {
      previousStock = variant.stock;
      newStock = Math.max(0, variant.stock - qty);
      variant.stock = newStock;
      p.stockCount = Math.max(0, (p.variants || []).reduce((s, v) => s + v.stock, 0));
      variantInfo = `Size ${variant.size} - ${variant.color}`;
    } else {
      previousStock = p.stockCount;
      newStock = Math.max(0, p.stockCount - qty);
      p.stockCount = newStock;
    }
    newMovements.push({
      id: `mov-off-${Date.now()}-${Math.floor(Math.random() * 100000)}`,
      productId: p.id,
      productName: p.name,
      sku: p.sku || '-',
      variantInfo,
      type: 'SALE',
      quantity: -qty,
      previousStock,
      newStock,
      note: `অর্ডার ${orderNumber}`,
      createdAt: nowIso,
    });
  }
  data.inventoryMovements = [...newMovements, ...(data.inventoryMovements || [])];
  return newMovements;
}

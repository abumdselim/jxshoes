/**
 * AI এজেন্ট টুল রেজিস্ট্রি — মডেল নিজে ডেটা খুঁজতে ও নিরাপদ সীমার মধ্যে কাজ করতে পারে।
 * অটোনমি নিয়ম (docs/AI_SYSTEM.md-এর ৩-স্তর নীতির সম্প্রসারণ):
 * - পড়ার টুল: সবসময় নিরাপদ
 * - স্টক/স্ট্যাটাস/খরচ: নিশ্চিত শনাক্ত হলে অটো-এক্সিকিউট (রিভার্সেবল/লগ-থাকা; রিস্টক ≤১০০০)
 * - টাকা-পড়শি (বিক্রি, বাকি আদায়): কখনো অটো নয় — needsConfirmation পেলোড, মানুষ নিশ্চিত করবে
 */
import {
  getProducts,
  getOrders,
  getCustomers,
  getExpenses,
  getInventoryMovements,
  restockProduct,
  updateOrderStatus,
  saveExpense,
} from '@/lib/store';
import { computeFinanceSummaryFromData, computeSalesForecast, computeDaysOfCover, getFastMoversFromData } from '@/lib/compute';
import type { FullStoreData } from '@/types/fullStoreData';
import type { Order, Product, Customer, AISaleMatch } from '@/types';
import { getStoreData } from '@/lib/store';

export interface ToolResult {
  ok: boolean;
  /** মডেলের জন্য কমপ্যাক্ট টেক্সট ফলাফল */
  data: string;
  /** লেখা-অ্যাকশন ঘটেছে — UI রেজাল্ট চিপ দেখাবে */
  autoExecuted?: { message: string; undoAvailable?: boolean; undoPayload?: Record<string, unknown> };
  /** মানুষের কনফার্মেশন দরকার — UI কনফার্ম কার্ড/মোডাল দেখাবে */
  needsConfirmation?: { type: 'sale' | 'due-payment' | 'new-product'; message: string; payload: Record<string, unknown> };
}

export interface ToolDef {
  name: string;
  /** UI প্রগ্রেস-চিপের লেবেল */
  label: string;
  description: string;
  argsDoc: string;
  writes: boolean;
  run: (args: Record<string, unknown>) => Promise<ToolResult>;
}

// ---------- হেল্পার ----------
function toNum(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const normalized = v.replace(/[০-৯]/g, d => String('০১২৩৪৫৬৭৮৯'.indexOf(d))).replace(/[^\d.-]/g, '');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}
function argStr(args: Record<string, unknown>, key: string): string {
  const v = args[key];
  return typeof v === 'string' ? v.trim() : v !== undefined && v !== null ? String(v) : '';
}
const fmtTk = (n: number) => `৳${n.toLocaleString('en-BD')}`;

async function withData<T>(fn: (data: FullStoreData) => Promise<T> | T): Promise<T> {
  const data = await getStoreData();
  return fn(data);
}

// ---------- টুল সংজ্ঞা ----------
export const AGENT_TOOLS: ToolDef[] = [
  // ================== পড়ার টুল ==================
  {
    name: 'query_products',
    label: '📦 প্রোডাক্ট ও স্টক দেখছি',
    description: 'প্রোডাক্ট/স্টক খোঁজা — SKU/বারকোড/নাম/ক্যাটাগরি দিয়ে; লো-স্টক তালিকাও',
    argsDoc: '{"sku?":"JX-SH-001","name?":"boots","category?":"shoes|bags","lowStockOnly?":true,"limit?":10}',
    writes: false,
    run: async args =>
      withData(data => {
        let list: Product[] = data.products;
        const sku = argStr(args, 'sku').toUpperCase();
        const name = argStr(args, 'name').toLowerCase();
        const category = argStr(args, 'category').toLowerCase();
        if (sku) list = list.filter(p => p.sku?.toUpperCase().includes(sku) || p.barcode?.includes(sku) || p.variants?.some(v => v.sku?.toUpperCase().includes(sku)));
        if (name) list = list.filter(p => p.name.toLowerCase().includes(name));
        if (category) list = list.filter(p => p.category === category);
        if (args.lowStockOnly) list = list.filter(p => p.stockCount <= (p.minStockAlert || 5));
        if (list.length === 0) return { ok: true, data: 'কোনো প্রোডাক্ট ম্যাচ করেনি।' };
        const rows = list.slice(0, Math.min(Number(args.limit) || 10, 25)).map(p =>
          `${p.sku} | ${p.name} | দাম ${fmtTk(p.price)} | স্টক ${p.stockCount} | ${p.inStock ? 'স্টোরফ্রন্টে চালু' : 'স্টোরফ্রন্টে বন্ধ'}${p.variants?.length ? ` | ভ্যারিয়েন্ট: ${p.variants.map(v => `${v.size}/${v.color}=${v.stock}`).join(', ')}` : ''}`
        );
        return { ok: true, data: `${list.length}টি প্রোডাক্ট:\n${rows.join('\n')}` };
      }),
  },
  {
    name: 'query_orders',
    label: '🧾 অর্ডার দেখছি',
    description: 'অর্ডার খোঁজা — অর্ডার নম্বর/স্ট্যাটাস/সাম্প্রতিক দিন ধরে',
    argsDoc: '{"orderNumber?":"SK-1234","status?":"Pending|Processing|Shipped|Delivered|Cancelled","days?":7,"limit?":10}',
    writes: false,
    run: async args =>
      withData(data => {
        let list: Order[] = [...data.orders].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const orderNumber = argStr(args, 'orderNumber').toUpperCase();
        const status = argStr(args, 'status');
        if (orderNumber) list = list.filter(o => o.orderNumber.toUpperCase().includes(orderNumber));
        if (status) list = list.filter(o => o.status.toLowerCase() === status.toLowerCase());
        if (args.days) {
          const cutoff = Date.now() - toNum(args.days) * 86400000;
          list = list.filter(o => new Date(o.createdAt).getTime() >= cutoff);
        }
        if (list.length === 0) return { ok: true, data: 'কোনো অর্ডার ম্যাচ করেনি।' };
        const rows = list.slice(0, Math.min(Number(args.limit) || 10, 20)).map(o =>
          `${o.orderNumber} | ${o.customerName} (${o.phone}) | ${o.items.map(i => `${i.name} ×${i.quantity}`).join(', ')} | ${fmtTk(o.total)} | ${o.status} | ${new Date(o.createdAt).toLocaleDateString('bn-BD')}`
        );
        return { ok: true, data: `${list.length}টি অর্ডার:\n${rows.join('\n')}` };
      }),
  },
  {
    name: 'query_customers',
    label: '👥 কাস্টমার খুঁজছি',
    description: 'কাস্টমার তালিকা — ফোন/নাম দিয়ে খোঁজা বা সবচেয়ে বেশি বাকির তালিকা',
    argsDoc: '{"phone?":"017...","name?":"rahim","withDuesOnly?":true,"limit?":10}',
    writes: false,
    run: async args =>
      withData(data => {
        let list: Customer[] = [...(data.customers || [])].sort((a, b) => b.dueAmount - a.dueAmount || new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const phone = argStr(args, 'phone');
        const name = argStr(args, 'name').toLowerCase();
        if (phone) list = list.filter(c => c.phone.includes(phone));
        if (name) list = list.filter(c => c.name.toLowerCase().includes(name));
        if (args.withDuesOnly) list = list.filter(c => c.dueAmount > 0);
        if (list.length === 0) return { ok: true, data: 'কোনো কাস্টমার ম্যাচ করেনি।' };
        const rows = list.slice(0, Math.min(Number(args.limit) || 10, 20)).map(c =>
          `${c.name} | ${c.phone} | বাকি ${fmtTk(c.dueAmount)} | মোট কেনা ${fmtTk(c.totalPurchases)} (${c.orderCount} অর্ডার)`
        );
        return { ok: true, data: `${list.length} জন কাস্টমার:\n${rows.join('\n')}` };
      }),
  },
  {
    name: 'customer_ledger',
    label: '📖 কাস্টমারের খাতা দেখছি',
    description: 'এক কাস্টমারের সম্পূর্ণ খাতা — অর্ডার হিস্ট্রি + বাকি পরিশোধ',
    argsDoc: '{"phone":"017..."} বা {"customerId":"cust-..."}',
    writes: false,
    run: async args =>
      withData(data => {
        const phone = argStr(args, 'phone');
        const customerId = argStr(args, 'customerId');
        const cust = (data.customers || []).find(c => (phone && c.phone === phone) || (customerId && c.id === customerId));
        if (!cust) return { ok: false, data: 'এই ফোন/আইডিতে কোনো কাস্টমার পাওয়া যায়নি।' };
        const orders = data.orders.filter(o => o.customerId === cust.id || o.phone === cust.phone);
        const payments = (data.duePayments || []).filter(p => p.customerId === cust.id);
        const lastOrders = orders
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(0, 8)
          .map(o => `${o.orderNumber}: ${fmtTk(o.total)} (${o.status})`);
        const lastPayments = payments.slice(0, 5).map(p => `${fmtTk(p.amount)} (${p.method})`);
        return {
          ok: true,
          data: `${cust.name} (${cust.phone}) — বাকি ${fmtTk(cust.dueAmount)}, মোট কেনা ${fmtTk(cust.totalPurchases)}।\nসাম্প্রতিক অর্ডার:\n${lastOrders.join('\n') || 'নেই'}\nপরিশোধ:\n${lastPayments.join(', ') || 'নেই'}`,
        };
      }),
  },
  {
    name: 'query_expenses',
    label: '🧮 খরচ দেখছি',
    description: 'খরচের খাতা — ক্যাটাগরি/দিন ধরে',
    argsDoc: '{"category?":"বিদ্যুৎ বিল","days?":30,"limit?":10}',
    writes: false,
    run: async args =>
      withData(data => {
        let list = [...data.expenses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const category = argStr(args, 'category');
        if (category) list = list.filter(e => e.category.toLowerCase().includes(category.toLowerCase()));
        if (args.days) {
          const cutoff = Date.now() - toNum(args.days) * 86400000;
          list = list.filter(e => new Date(e.createdAt).getTime() >= cutoff);
        }
        const shown = list.slice(0, Math.min(Number(args.limit) || 10, 20));
        const total = list.reduce((s, e) => s + e.amount, 0);
        const rows = shown.map(e => `${new Date(e.createdAt).toLocaleDateString('bn-BD')} | ${e.category} | ${fmtTk(e.amount)}${e.note ? ` | ${e.note}` : ''}`);
        return { ok: true, data: `${list.length}টি খরচ, মোট ${fmtTk(total)}:\n${rows.join('\n') || 'নেই'}` };
      }),
  },
  {
    name: 'sales_stats',
    label: '📈 বিক্রয়-হিসাব দেখছি',
    description: 'বিক্রয় ও লাভ-ক্ষতি: আজ/৭ দিন/৩০ দিন, দৈনিক সিরিজ, ট্রেন্ড-ফোরকাস্ট, টপ প্রোডাক্ট',
    argsDoc: '{} (আর্গুমেন্ট লাগে না)',
    writes: false,
    run: async () =>
      withData(async data => {
        const fin = computeFinanceSummaryFromData(data);
        const forecast = computeSalesForecast(data);
        const movers = getFastMoversFromData(data, 5);
        const top = movers.map(m => `${m.name} ×${m.totalSold} (${fmtTk(m.revenue)})`).join(', ');
        const series = forecast.last14Series.map(s => `${s.date.slice(5)}:${s.revenue}`).join(', ');
        return {
          ok: true,
          data: `আজ ${fmtTk(fin.today.revenue)} (${fin.today.orders} অর্ডার) | ৭ দিন ${fmtTk(fin.last7.revenue)} | ৩০ দিন ${fmtTk(fin.last30.revenue)}\nগড় দৈনিক (৭দ) ${fmtTk(forecast.last7Avg)}, আগের সপ্তাহ ${fmtTk(forecast.prev7Avg)} — ট্রেন্ড ${forecast.trend} (${forecast.wowGrowthPercent}%), আগামী ৭ দিনের প্রজেকশন ${fmtTk(forecast.projectedNext7Total)}\n১৪ দিনের সিরিজ: ${series}\nলাভ-ক্ষতি: রেভিনিউ ${fmtTk(fin.revenue)}, নিট ${fmtTk(fin.netProfit)}, বাকি মোট ${fmtTk(fin.totalDues)}\nটপ সেলার: ${top || 'নেই'}`,
        };
      }),
  },
  {
    name: 'inventory_movements',
    label: '📚 স্টক মুভমেন্ট দেখছি',
    description: 'স্টকের ইতিহাস — কোনো প্রোডাক্টের রিস্টক/বিক্রি/ড্যামেজ লগ',
    argsDoc: '{"sku?":"JX-SH-001","days?":30,"limit?":10}',
    writes: false,
    run: async args =>
      withData(data => {
        let movements = [...(data.inventoryMovements || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
        const sku = argStr(args, 'sku').toUpperCase();
        if (sku) {
          const product = data.products.find(p => p.sku?.toUpperCase() === sku || p.barcode === sku);
          const productId = product?.id;
          movements = movements.filter(m => (productId && m.productId === productId) || m.sku?.toUpperCase().includes(sku));
        }
        if (args.days) {
          const cutoff = Date.now() - toNum(args.days) * 86400000;
          movements = movements.filter(m => new Date(m.createdAt).getTime() >= cutoff);
        }
        if (movements.length === 0) return { ok: true, data: 'কোনো মুভমেন্ট পাওয়া যায়নি।' };
        const rows = movements.slice(0, Math.min(Number(args.limit) || 10, 20)).map(m =>
          `${new Date(m.createdAt).toLocaleDateString('bn-BD')} | ${m.type} ${m.quantity > 0 ? '+' : ''}${m.quantity} | ${m.productName} (${m.sku}) ${m.previousStock}→${m.newStock}${m.note ? ` | ${m.note}` : ''}`
        );
        return { ok: true, data: `${movements.length}টি মুভমেন্ট:\n${rows.join('\n')}` };
      }),
  },
  {
    name: 'restock_suggestion',
    label: '📦 রিস্টক হিসাব করছি',
    description: 'কোন প্রোডাক্ট কত রিস্টক দরকার — ৩০ দিনের বিক্রির গতি ও days-of-cover হিসাব',
    argsDoc: '{}',
    writes: false,
    run: async () =>
      withData(data => {
        const covers = computeDaysOfCover(data, 12);
        const needs = covers.filter(c => c.verdict === 'critical' || c.verdict === 'low');
        if (needs.length === 0) return { ok: true, data: 'এই মুহূর্তে জরুরি রিস্টক দরকার নেই।' };
        const rows = needs.map(c => {
          const suggested = Math.max(0, Math.ceil(c.velocityPerDay * 30 * 1.5) - c.stockLeft);
          return `${c.sku} ${c.name} — স্টক ${c.stockLeft}, দৈনিক গতি ${c.velocityPerDay}, মাত্র ${c.daysOfCover ?? '∞'} দিন চলবে → সাজেস্টেড রিস্টক ~${suggested || 10}টি`;
        });
        return { ok: true, data: `রিস্টক প্রয়োজন:\n${rows.join('\n')}` };
      }),
  },

  // ================== লেখার টুল (অটোনমি নিয়মসহ) ==================
  {
    name: 'restock_product',
    label: '📥 স্টকে যোগ করছি',
    description: 'স্টক রিস্টক — SKU/বারকোড দিয়ে নিশ্চিত প্রোডাক্ট পেলে সরাসরি যোগ হয় (মুভমেন্ট লগসহ)। স্টোরফ্রন্টে সাথে সাথে দেখা যায়।',
    argsDoc: '{"sku":"JX-SH-001","quantity":50,"unitCost?":3200,"note?":"নতুন চালান"}',
    writes: true,
    run: async args => {
      const sku = argStr(args, 'sku').toUpperCase();
      const quantity = toNum(args.quantity);
      if (!sku) return { ok: false, data: 'SKU/কোড ছাড়া রিস্টক করা যাবে না — কোড জিজ্ঞেস করুন।' };
      if (!Number.isFinite(quantity) || quantity <= 0) return { ok: false, data: 'সঠিক পরিমাণ (সংখ্যা) দিন।' };
      if (quantity > 1000) return { ok: false, data: 'একবারে সর্বোচ্চ ১০০০ পরিমাণ রিস্টক করা যায় — বেশি হলে ভাগ করুন বা ইনভেন্টরি পেজে করুন।' };
      const data = await getStoreData();
      const product = data.products.find(p => p.sku?.toUpperCase() === sku || p.barcode === sku || p.variants?.some(v => v.sku?.toUpperCase() === sku));
      if (!product) return { ok: false, data: `"${sku}" কোডে কোনো প্রোডাক্ট পাওয়া যায়নি। query_products দিয়ে সঠিক কোড খুঁজে নিন।` };
      const unitCost = toNum(args.unitCost);
      const updated = await restockProduct(
        product.id,
        quantity,
        unitCost > 0 ? unitCost : undefined,
        undefined,
        argStr(args, 'note') || 'AI এজেন্ট রিস্টক',
      );
      if (!updated) return { ok: false, data: 'রিস্টক করা যায়নি।' };
      return {
        ok: true,
        data: `${product.name} (${product.sku}) — ${quantity} পরিমাণ স্টকে যোগ হয়েছে। নতুন স্টক: ${updated.stockCount}। স্টোরফ্রন্টে এখনই দেখা যাচ্ছে (${updated.inStock ? 'in stock' : 'stock out'})।`,
        autoExecuted: {
          message: `${product.name} — ${quantity}টি স্টকে যোগ (মোট ${updated.stockCount})`,
          undoAvailable: true,
          undoPayload: { productId: product.id, quantity, note: 'AI এজেন্ট রিস্টক বাতিল' },
        },
      };
    },
  },
  {
    name: 'update_order_status',
    label: '🔄 অর্ডার স্ট্যাটাস বদলাচ্ছি',
    description: 'অর্ডার নম্বর দিয়ে স্ট্যাটাস বদল (Pending/Processing/Shipped/Delivered/Cancelled)',
    argsDoc: '{"orderNumber":"SK-1234","status":"Delivered"}',
    writes: true,
    run: async args => {
      const orderNumber = argStr(args, 'orderNumber').toUpperCase();
      const status = argStr(args, 'status');
      const valid = ['Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'];
      const matched = valid.find(s => s.toLowerCase() === status.toLowerCase());
      if (!orderNumber || !matched) return { ok: false, data: 'অর্ডার নম্বর ও সঠিক স্ট্যাটাস দিন (Pending/Processing/Shipped/Delivered/Cancelled)।' };
      const data = await getStoreData();
      const order = data.orders.find(o => o.orderNumber.toUpperCase() === orderNumber);
      if (!order) return { ok: false, data: `"${orderNumber}" অর্ডার পাওয়া যায়নি।` };
      const updated = await updateOrderStatus(order.id, matched as Order['status'], 'AI এজেন্ট আপডেট');
      if (!updated) return { ok: false, data: 'স্ট্যাটাস বদলানো যায়নি।' };
      return {
        ok: true,
        data: `${updated.orderNumber} (${updated.customerName}) স্ট্যাটাস এখন: ${matched}।`,
        autoExecuted: { message: `${updated.orderNumber} → ${matched}` },
      };
    },
  },
  {
    name: 'add_expense',
    label: '🧾 খরচের খাতায় লিখছি',
    description: 'খরচের খাতায় এন্ট্রি যোগ',
    argsDoc: '{"category":"পরিবহন","amount":500,"note?":"ডেলিভারি ভ্যান"}',
    writes: true,
    run: async args => {
      const category = argStr(args, 'category');
      const amount = toNum(args.amount);
      if (!category || !Number.isFinite(amount) || amount <= 0) return { ok: false, data: 'খাতা ও সঠিক পরিমাণ দিন।' };
      const exp = await saveExpense({ category, amount, note: argStr(args, 'note') || 'AI এজেন্ট এন্ট্রি' });
      return {
        ok: true,
        data: `খরচ যোগ হয়েছে: ${exp.category} — ${fmtTk(exp.amount)}।`,
        autoExecuted: { message: `খরচ যোগ: ${exp.category} ${fmtTk(exp.amount)}` },
      };
    },
  },
  {
    name: 'propose_sale',
    label: '🛒 বিক্রির প্রস্তাব তৈরি করছি',
    description: 'POS বিক্রির প্রস্তাব — টাকার লেনদেন, তাই মানুষের কনফার্মেশন ছাড়া কখনো হয় না। কনফার্ম কার্ড UI-তে যাবে।',
    argsDoc: '{"sku":"JX-SH-001","quantity":1,"size?":"42"}',
    writes: false,
    run: async args => {
      const sku = argStr(args, 'sku').toUpperCase();
      const quantity = Math.max(1, toNum(args.quantity) || 1);
      if (!sku) return { ok: false, data: 'SKU/কোড দিন।' };
      const data = await getStoreData();
      const product = data.products.find(p => p.sku?.toUpperCase() === sku || p.barcode === sku || p.variants?.some(v => v.sku?.toUpperCase() === sku));
      if (!product) return { ok: false, data: `"${sku}" কোডে প্রোডাক্ট পাওয়া যায়নি।` };
      const size = argStr(args, 'size');
      const match: AISaleMatch = { matched: true, productId: product.id, productName: product.name, size: size || undefined, quantity, confidence: 'high' };
      return {
        ok: true,
        data: `${product.name} ×${quantity} বিক্রির প্রস্তাব তৈরি হয়েছে — কনফার্মেশনের জন্য পাঠানো হলো। মানুষ কনফার্ম করলে বিক্রি হবে।`,
        needsConfirmation: {
          type: 'sale',
          message: `${product.name} ×${quantity} বিক্রি কনফার্ম করুন`,
          payload: { intent: 'sale', product, match },
        },
      };
    },
  },
  {
    name: 'propose_due_payment',
    label: '💰 বাকি আদায়ের প্রস্তাব তৈরি করছি',
    description: 'বাকি আদায়ের প্রস্তাব — টাকার লেনদেন, কনফার্মেশন বাধ্যতামূলক।',
    argsDoc: '{"phone":"017...","amount":1000,"method?":"Cash|bKash|Nagad"}',
    writes: false,
    run: async args => {
      const phone = argStr(args, 'phone');
      const amount = toNum(args.amount);
      const method = argStr(args, 'method') || 'Cash';
      if (!phone || !Number.isFinite(amount) || amount <= 0) return { ok: false, data: 'ফোন নম্বর ও সঠিক পরিমাণ দিন।' };
      const data = await getStoreData();
      const customer = (data.customers || []).find(c => c.phone === phone);
      if (!customer) return { ok: false, data: `এই ফোনে কাস্টমার পাওয়া যায়নি। query_customers দিয়ে খুঁজে নিন।` };
      return {
        ok: true,
        data: `${customer.name}-এর ${fmtTk(amount)} বাকি আদায়ের প্রস্তাব তৈরি — কনফার্মেশনের জন্য পাঠানো হলো।`,
        needsConfirmation: {
          type: 'due-payment',
          message: `${customer.name} — ${fmtTk(amount)} বাকি আদায় কনফার্ম করুন`,
          payload: { intent: 'due-payment', customer: { id: customer.id, name: customer.name, phone: customer.phone, dueAmount: customer.dueAmount }, amount, method },
        },
      };
    },
  },
  {
    name: 'create_product_draft',
    label: '🆕 নতুন প্রোডাক্ট খসড়া তৈরি করছি',
    description: 'নতুন প্রোডাক্টের খসড়া — UI-তে প্রি-ফিল্ড মোডালে দেখাবে, মানুষ দেখে সেভ করবে।',
    argsDoc: '{"name":"Nike Air Max","price":8500,"category?":"shoes","costPrice?":5500,"stock?":20,"subCategory?":"Sneakers"}',
    writes: false,
    run: async args => {
      const name = argStr(args, 'name');
      const price = toNum(args.price);
      if (!name || !Number.isFinite(price) || price <= 0) return { ok: false, data: 'নাম ও সঠিক দাম দিন।' };
      const draft = {
        name,
        price,
        category: argStr(args, 'category') || 'shoes',
        subCategory: argStr(args, 'subCategory') || undefined,
        costPrice: toNum(args.costPrice) || undefined,
        stockCount: toNum(args.stock) || 10,
        supplier: argStr(args, 'supplier') || undefined,
      };
      return {
        ok: true,
        data: `"${name}" (${fmtTk(price)}) প্রোডাক্টের খসড়া তৈরি — কনফার্মেশনের জন্য পাঠানো হলো। মানুষ দেখে সেভ করলে স্টোরফ্রন্টে চলে আসবে।`,
        needsConfirmation: {
          type: 'new-product',
          message: `নতুন প্রোডাক্ট: ${name}`,
          payload: { intent: 'new-product', draft },
        },
      };
    },
  },
];

export const TOOL_MAP = new Map(AGENT_TOOLS.map(t => [t.name, t]));

/** মডেলের সিস্টেম-প্রম্পটের জন্য কমপ্যাক্ট টুল ম্যানুয়াল */
export function buildToolManual(): string {
  return AGENT_TOOLS.map(t => `- ${t.name}: ${t.description}\n  আর্গুমেন্ট: ${t.argsDoc}`).join('\n');
}

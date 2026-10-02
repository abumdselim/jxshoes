/**
 * Cloudflare Workers AI REST ক্লায়েন্ট
 * ------------------------------------
 * - store.ts / upload route-এর KV/R2 REST প্যাটার্নের মতোই বিদ্যমান
 *   CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN env ব্যবহার করে
 * - টোকেনে "Workers AI → Write" পারমিশন থাকতে হবে (রান এন্ডপয়েন্টের জন্য রিকোয়ার্ড)
 * - প্রাইমারি মডেল: Gemma (Gemma ফ্যামিলি অফিসিয়ালি বাংলা সাপোর্ট করে),
 *   ফেলব্যাক: llama-3.3-70b-instruct-fp8-fast (JSON মোড + স্ট্রিমিং সাপোর্টেড)
 * - AI_TEXT_MODEL / AI_FALLBACK_MODEL env দিয়ে মডেল পরিবর্তনযোগ্য
 *
 * শুধু সার্ভার-সাইড (edge API routes) থেকে ব্যবহারযোগ্য — টোকেন কখনো
 * ব্রাউজারে পাঠানো যাবে না।
 */

import { getOrders, getProducts, getStoreSettings } from './store';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RunAIOptions {
  maxTokens?: number;
  temperature?: number;
}

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

export const AI_PRIMARY_MODEL =
  process.env.AI_TEXT_MODEL || '@cf/google/gemma-4-26b-a4b-it';
export const AI_FALLBACK_MODEL =
  process.env.AI_FALLBACK_MODEL || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';

export function isAIConfigured(): boolean {
  return Boolean(CF_ACCOUNT_ID && CF_API_TOKEN);
}

export const AI_NOT_CONFIGURED_MSG =
  'AI এখনো কনফিগার করা হয়নি। Cloudflare ড্যাশবোর্ডে API টোকেনে "Workers AI → Write" পারমিশন যোগ করুন (GitHub Secrets-এর CLOUDFLARE_API_TOKEN একই টোকেন)। সেটআপের পর ডিপ্লয় করলেই AI চালু হয়ে যাবে।';

function aiRunUrl(model: string): string {
  return `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/${model}`;
}

function buildRequestBody(messages: AIMessage[], opts: RunAIOptions, stream: boolean): string {
  return JSON.stringify({
    messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.6,
    ...(stream ? { stream: true } : {}),
  });
}

async function callModel(model: string, messages: AIMessage[], opts: RunAIOptions): Promise<string> {
  const res = await fetch(aiRunUrl(model), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${CF_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: buildRequestBody(messages, opts, false),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok || !json || json.success !== true) {
    const errText = Array.isArray(json?.errors) ? json.errors.join('; ') : `HTTP ${res.status}`;
    throw new Error(`Workers AI (${model}): ${errText}`);
  }

  const text: unknown = json?.result?.response;
  if (typeof text !== 'string' || !text.trim()) {
    throw new Error(`Workers AI (${model}): খালি উত্তর`);
  }
  return text;
}

/** প্রাইমারি মডেলে চেষ্টা করে, ব্যর্থ হলে ফেলব্যাক মডেলে যায় */
export async function runAI(messages: AIMessage[], opts: RunAIOptions = {}): Promise<string> {
  if (!isAIConfigured()) throw new Error(AI_NOT_CONFIGURED_MSG);
  try {
    return await callModel(AI_PRIMARY_MODEL, messages, opts);
  } catch (primaryErr) {
    console.warn('AI primary model failed, trying fallback:', primaryErr);
    return await callModel(AI_FALLBACK_MODEL, messages, opts);
  }
}

/** স্ট্রিমিং চ্যাট — Workers AI-এর SSE বডি সরাসরি পাস-থ্রু করে */
export async function runAIStream(
  messages: AIMessage[],
  opts: RunAIOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  if (!isAIConfigured()) throw new Error(AI_NOT_CONFIGURED_MSG);

  const attempt = async (model: string): Promise<ReadableStream<Uint8Array>> => {
    const res = await fetch(aiRunUrl(model), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${CF_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: buildRequestBody(messages, opts, true),
    });
    if (!res.ok || !res.body) {
      const errText = await res.text().catch(() => `HTTP ${res.status}`);
      throw new Error(`Workers AI (${model}): ${errText.slice(0, 300)}`);
    }
    return res.body;
  };

  try {
    return await attempt(AI_PRIMARY_MODEL);
  } catch (primaryErr) {
    console.warn('AI primary stream failed, trying fallback:', primaryErr);
    return await attempt(AI_FALLBACK_MODEL);
  }
}

/**
 * AI-এর উত্তর থেকে JSON বের করে — মডেল কোড-ফেন্স বা অতিরিক্ত লেখা দিলেও কাজ করে
 */
export function extractJson<T = unknown>(raw: string): T | null {
  if (!raw) return null;
  let text = raw.trim();
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();

  const objStart = text.indexOf('{');
  const arrStart = text.indexOf('[');
  let start = -1;
  let close = '';
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) {
    start = objStart;
    close = '}';
  } else if (arrStart >= 0) {
    start = arrStart;
    close = ']';
  }
  if (start < 0) return null;

  const end = text.lastIndexOf(close);
  if (end <= start) return null;

  try {
    return JSON.parse(text.slice(start, end + 1)) as T;
  } catch {
    return null;
  }
}

/** JSON-মোডে AI রান — প্রম্পটে JSON চাওয়া হয় + রোবাস্ট পার্সিং */
export async function runAIJson<T>(
  messages: AIMessage[],
  opts: RunAIOptions = {}
): Promise<T> {
  const raw = await runAI(messages, { ...opts, temperature: opts.temperature ?? 0.3 });
  const parsed = extractJson<T>(raw);
  if (parsed === null) {
    throw new Error('AI-এর উত্তর থেকে JSON পার্স করা যায়নি');
  }
  return parsed;
}

/**
 * AI প্রম্পটের জন্য কমপ্যাক্ট স্টোর-কনটেক্সট তৈরি করে
 * (প্রোডাক্ট/স্টক/সেলস সামারি — আসল ডেটা, তাই AI সঠিক উত্তর দিতে পারে)
 */
export async function buildStoreContext(orderLimit = 25): Promise<string> {
  const [products, orders, settings] = await Promise.all([
    getProducts(),
    getOrders(),
    getStoreSettings(),
  ]);

  const lines: string[] = [];
  lines.push(
    `দোকান: ${settings.storeName}${settings.ownerName ? ` (মালিক: ${settings.ownerName})` : ''} | হটলাইন: ${settings.hotline}`
  );
  lines.push(`ডেলিভারি ফি: ঢাকার ভেতরে ৳${settings.insideDhakaFee}, বাইরে ৳${settings.outsideDhakaFee}, ৳${settings.freeDeliveryAbove}-এর উপরে ফ্রি`);
  lines.push('');
  lines.push('প্রোডাক্ট তালিকা (SKU | বারকোড | নাম | ক্যাটাগরি | বিক্রয়মূল্য | ক্রয়মূল্য | স্টক | মিনিমাম-অ্যালার্ট | ভ্যারিয়েন্ট-স্টক):');
  for (const p of products.slice(0, 150)) {
    const variants = (p.variants || [])
      .map(v => `${v.size}/${v.color}:${v.stock}`)
      .join(', ');
    lines.push(
      `${p.sku} | ${p.barcode || '-'} | ${p.name} | ${p.category}${p.subCategory ? '/' + p.subCategory : ''} | ৳${p.price}${p.costPrice ? ` (কস্ট ৳${p.costPrice})` : ''} | স্টক ${p.stockCount} | অ্যালার্ট ${p.minStockAlert ?? 5}${variants ? ` | ${variants}` : ''}`
    );
  }

  // সেলস সামারি
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfDay - 6 * 86400000;
  const monthAgo = startOfDay - 29 * 86400000;

  const validOrders = orders.filter(o => o.status !== 'Cancelled');
  const inRange = (o: { createdAt: string }, from: number) =>
    new Date(o.createdAt).getTime() >= from;

  const totalIn = (from: number) =>
    validOrders.filter(o => inRange(o, from)).reduce((s, o) => s + o.total, 0);

  lines.push('');
  lines.push('সেলস সামারি:');
  lines.push(`- আজকের বিক্রি: ৳${totalIn(startOfDay)} (${validOrders.filter(o => inRange(o, startOfDay)).length} অর্ডার)`);
  lines.push(`- গত ৭ দিনে: ৳${totalIn(weekAgo)} (${validOrders.filter(o => inRange(o, weekAgo)).length} অর্ডার)`);
  lines.push(`- গত ৩০ দিনে: ৳${totalIn(monthAgo)} (${validOrders.filter(o => inRange(o, monthAgo)).length} অর্ডার)`);
  lines.push(`- সব মিলিয়ে: ৳${validOrders.reduce((s, o) => s + o.total, 0)} (${validOrders.length} অর্ডার)`);
  lines.push(`- পেন্ডিং/প্রসেসিং অর্ডার: ${orders.filter(o => o.status === 'Pending' || o.status === 'Processing').length}টি`);

  // প্রোডাক্ট-ভিত্তিক বিক্রি
  const soldByProduct = new Map<string, { name: string; qty: number; revenue: number }>();
  for (const o of validOrders) {
    for (const it of o.items) {
      const cur = soldByProduct.get(it.productId) || { name: it.name, qty: 0, revenue: 0 };
      cur.qty += it.quantity;
      cur.revenue += it.price * it.quantity;
      soldByProduct.set(it.productId, cur);
    }
  }
  if (soldByProduct.size > 0) {
    lines.push('');
    lines.push('প্রোডাক্ট-ভিত্তিক মোট বিক্রি (পরিমাণ অনুযায়ী):');
    const sorted = Array.from(soldByProduct.values()).sort((a, b) => b.qty - a.qty);
    for (const s of sorted.slice(0, 40)) {
      lines.push(`- ${s.name}: ${s.qty}টি বিক্রি, আয় ৳${s.revenue}`);
    }
  }

  // সাম্প্রতিক অর্ডার
  if (orderLimit > 0) {
    lines.push('');
    lines.push(`সাম্প্রতিক অর্ডার (${Math.min(orderLimit, validOrders.length)}টি):`);
    for (const o of validOrders.slice(0, orderLimit)) {
      const items = o.items.map(i => `${i.name}×${i.quantity}`).join(', ');
      lines.push(
        `- ${o.orderNumber} | ${new Date(o.createdAt).toLocaleDateString('en-CA')} | ${o.customerName} (${o.phone}) | ${o.city} | ${o.paymentMethod} | ${o.status} | ${o.source === 'in-store' ? 'দোকানে বিক্রি' : 'অনলাইন'} | ${items} | মোট ৳${o.total}`
      );
    }
  }

  return lines.join('\n');
}

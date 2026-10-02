/**
 * Cloudflare Workers AI REST ক্লায়েন্ট
 * ------------------------------------
 * - store.ts / upload route-এর KV/R2 REST প্যাটার্নের মতোই বিদ্যমান
 *   CLOUDFLARE_ACCOUNT_ID + CLOUDFLARE_API_TOKEN env ব্যবহার করে
 * - টোকেনে "Workers AI → Write" পারমিশন থাকতে হবে (রান এন্ডপয়েন্টের জন্য রিকোয়ার্ড)
 * - প্রাইমারি মডেল: llama-3.3-70b-fast (দ্রুত, সরাসরি কনটেন্ট, চমৎকার বাংলা —
 *   ২০২৬-১০-০২ আসল টোকেন দিয়ে ভেরিফাই করা)
 * - ফেলব্যাক: gemma-4-26b (সেরা বাংলা, কিন্তু রিজনিং মডেল — আগে "চিন্তা" করে, ধীর)
 * - AI_TEXT_MODEL / AI_FALLBACK_MODEL env দিয়ে মডেল পরিবর্তনযোগ্য
 *
 * ⚠️ রেসপন্স শেপ: Workers AI-এর নেটিভ এন্ডপয়েন্ট এখন OpenAI-স্টাইল শেপও দেয় —
 *   llama: result.choices[0].message.content (+ JSON হলে result.response পার্সড অবজেক্ট)
 *   gemma: result.choices[0].message.content (+ reasoning_content — ইগনোর করতে হবে)
 *   তাই extractResponseText() দুই শেপই সামলায়। স্ট্রিমিংয়ে delta.content আসে।
 *
 * শুধু সার্ভার-সাইড (edge API routes) থেকে ব্যবহারযোগ্য — টোকেন কখনো
 * ব্রাউজারে পাঠানো যাবে না।
 */

import { computeFinanceSummary, getCustomers, getOrders, getProducts, getStoreSettings } from './store';
import { getCfEnv } from './cfEnv';

export interface AIMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

interface RunAIOptions {
  maxTokens?: number;
  temperature?: number;
}

export const AI_PRIMARY_MODEL = '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
export const AI_FALLBACK_MODEL = '@cf/google/gemma-4-26b-a4b-it';

export function isAIConfigured(): boolean {
  const env = getCfEnv();
  return Boolean(env.accountId && env.apiToken);
}

export const AI_NOT_CONFIGURED_MSG =
  'AI এখনো কনফিগার করা হয়নি। Cloudflare Pages প্রজেক্টে CLOUDFLARE_ACCOUNT_ID ও CLOUDFLARE_API_TOKEN (Workers AI → Write পারমিশনসহ) env হিসেবে বসালেই চালু হয়ে যাবে।';

function aiRun(model: string): { url: string; token: string; primary: string; fallback: string } {
  const env = getCfEnv();
  return {
    url: `https://api.cloudflare.com/client/v4/accounts/${env.accountId}/ai/run/${model}`,
    token: env.apiToken,
    primary: env.aiTextModel || AI_PRIMARY_MODEL,
    fallback: env.aiFallbackModel || AI_FALLBACK_MODEL,
  };
}

function buildRequestBody(messages: AIMessage[], opts: RunAIOptions, stream: boolean): string {
  return JSON.stringify({
    messages,
    max_tokens: opts.maxTokens ?? 1024,
    temperature: opts.temperature ?? 0.6,
    ...(stream ? { stream: true } : {}),
  });
}

/**
 * দুই ধরনের রেসপন্স শেপ থেকে টেক্সট বের করে:
 * ১) legacy: result.response (স্ট্রিং, বা JSON হলে পার্সড অবজেক্ট)
 * ২) OpenAI-স্টাইল: result.choices[0].message.content
 */
function extractResponseText(result: unknown): string {
  const r = result as {
    response?: unknown;
    choices?: { message?: { content?: unknown } }[];
  } | null;
  if (!r) return '';
  if (typeof r.response === 'string' && r.response.trim()) return r.response;
  if (r.response && typeof r.response === 'object') {
    const s = JSON.stringify(r.response);
    if (s && s !== '{}') return s;
  }
  const content = r.choices?.[0]?.message?.content;
  if (typeof content === 'string' && content.trim()) return content;
  return '';
}

async function callModel(model: string, messages: AIMessage[], opts: RunAIOptions): Promise<string> {
  const target = aiRun(model);

  // ট্রানজিয়েন্ট এরর (৪২৯/৫০০/৫০৩) হলে একবার ব্যাকঅফ দিয়ে রিট্রাই — তারপর ফেলব্যাক মডেলে যায়
  let res: Response | null = null;
  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, 900));
    res = await fetch(target.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${target.token}`,
        'Content-Type': 'application/json',
      },
      body: buildRequestBody(messages, opts, false),
    });
    lastStatus = res.status;
    if (res.ok) break;
    if (![429, 500, 502, 503].includes(res.status)) break;
  }

  const json = await res!.json().catch(() => null);
  if (!res!.ok || !json || json.success !== true) {
    const errText = Array.isArray(json?.errors) ? json.errors.join('; ') : `HTTP ${lastStatus}`;
    throw new Error(`Workers AI (${model}): ${errText}`);
  }

  const text = extractResponseText(json.result);
  if (!text.trim()) {
    throw new Error(`Workers AI (${model}): খালি উত্তর`);
  }
  return text;
}

/** প্রাইমারি মডেলে চেষ্টা করে, ব্যর্থ হলে ফেলব্যাক মডেলে যায় */
export async function runAI(messages: AIMessage[], opts: RunAIOptions = {}): Promise<string> {
  if (!isAIConfigured()) throw new Error(AI_NOT_CONFIGURED_MSG);
  const models = aiRun(AI_PRIMARY_MODEL);
  try {
    return await callModel(models.primary, messages, opts);
  } catch (primaryErr) {
    console.warn('AI primary model failed, trying fallback:', primaryErr);
    return await callModel(models.fallback, messages, opts);
  }
}

/** স্ট্রিমিং চ্যাট — Workers AI-এর SSE বডি সরাসরি পাস-থ্রু করে */
export async function runAIStream(
  messages: AIMessage[],
  opts: RunAIOptions = {}
): Promise<ReadableStream<Uint8Array>> {
  if (!isAIConfigured()) throw new Error(AI_NOT_CONFIGURED_MSG);

  const models = aiRun(AI_PRIMARY_MODEL);
  const attempt = async (model: string): Promise<ReadableStream<Uint8Array>> => {
    const target = aiRun(model);
    const res = await fetch(target.url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${target.token}`,
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
    return await attempt(models.primary);
  } catch (primaryErr) {
    console.warn('AI primary stream failed, trying fallback:', primaryErr);
    return await attempt(models.fallback);
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

/** JSON-মোডে AI রান — প্রম্পটে JSON চাওয়া হয় + রোবাস্ট পার্সিং + ভাঙলে অটো-রিপেয়ার */
const JSON_REPAIR_NUDGE: AIMessage = {
  role: 'user',
  content:
    'আগের উত্তরটি বৈধ JSON ছিল না (ভাঙা ছিল বা অতিরিক্ত লেখা ছিল)। একই কাজ আবার করো — এবার শুধুমাত্র বৈধ JSON দাও: কোনো ব্যাখ্যা, মার্কডাউন ব্যাকটিক, শিরোনাম বা অতিরিক্ত লেখা ছাড়া। JSON-এর সব কি ও মান ঠিকভাবে কোট করা থাকবে।',
};

export async function runAIJson<T>(
  messages: AIMessage[],
  opts: RunAIOptions = {}
): Promise<T> {
  const baseTemp = opts.temperature ?? 0.3;

  const first = extractJson<T>(await runAI(messages, { ...opts, temperature: baseTemp }));
  if (first !== null) return first;

  // রিপেয়ার পাস — কড়া নির্দেশ + ৪০% বেশি টোকেন + আরো নিম্ন তাপমাত্রা
  const repaired = extractJson<T>(
    await runAI([...messages, JSON_REPAIR_NUDGE], {
      ...opts,
      temperature: Math.min(baseTemp, 0.15),
      maxTokens: Math.round((opts.maxTokens ?? 1024) * 1.4),
    })
  );
  if (repaired !== null) return repaired;

  throw new Error('AI-এর উত্তর থেকে JSON পার্স করা যায়নি (দুইবার চেষ্টার পরেও)');
}

/**
 * AI প্রম্পটের জন্য কমপ্যাক্ট স্টোর-কনটেক্সট তৈরি করে
 * (প্রোডাক্ট/স্টক/সেলস সামারি — আসল ডেটা, তাই AI সঠিক উত্তর দিতে পারে)
 */
export async function buildStoreContext(orderLimit = 25): Promise<string> {
  const [products, orders, settings, customers, finance] = await Promise.all([
    getProducts(),
    getOrders(),
    getStoreSettings(),
    getCustomers(),
    computeFinanceSummary(),
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
      `${p.sku || '-'} | ${p.barcode || '-'} | ${p.name} | ${p.category}${p.subCategory ? '/' + p.subCategory : ''} | ৳${p.price}${p.costPrice ? ` (কস্ট ৳${p.costPrice})` : ''} | স্টক ${p.stockCount} | অ্যালার্ট ${p.minStockAlert ?? 5}${variants ? ` | ${variants}` : ''}`
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
  lines.push(`- আজকের আদায় (বাকি পরিশোধ): ৳${finance.today.collected}`);

  // আর্থিক হিসাব — লাভ/বাকি প্রশ্নের জন্য
  lines.push('');
  lines.push('আর্থিক হিসাব:');
  lines.push(`- মোট বিক্রি: ৳${finance.revenue} | ক্রয়মূল্য: ৳${finance.cogs} | গ্রস প্রফিট: ৳${finance.grossProfit}`);
  lines.push(`- দোকানের খরচ: ৳${finance.operatingExpenses} | নেট প্রফিট: ৳${finance.netProfit}`);
  lines.push(`- মোট বাকি (receivable): ৳${finance.totalDues} (${finance.customerCount} জন কাস্টমারের খাতা) | সর্বমোট বাকি-আদায়: ৳${finance.totalCollected}`);
  const dueCustomers = customers.filter(c => (c.dueAmount || 0) > 0).sort((a, b) => b.dueAmount - a.dueAmount).slice(0, 8);
  if (dueCustomers.length > 0) {
    lines.push(`- যাদের বাকি আছে: ${dueCustomers.map(c => `${c.name} (${c.phone}): ৳${c.dueAmount}`).join('; ')}`);
  }

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


// ================== VOICE (Gemini অডিও ট্রান্সক্রিপশন) ==================
/**
 * বাংলা/ইংরেজি ভয়েস অডিও → টেক্সট। Gemini সরাসরি অডিও বুঝতে পারে।
 * মডেল ব্যর্থ বা ব্যস্ত হলে ফেলব্যাক মডেলে যায়।
 */
const GEMINI_DEFAULT_MODEL = 'gemini-3.8-flash';
const GEMINI_FALLBACK_MODEL = 'gemini-flash-latest';

const TRANSCRIBE_INSTRUCTION =
  'এই অডিওটি সাবধানে শুনো এবং হুবহু ট্রান্সক্রাইব করো। এটি বাংলা বা ইংরেজিতে একজন দোকানদারের ভয়েস কমান্ড হতে পারে (যেমন প্রোডাক্ট কোড, সংখ্যা, স্টক, বিক্রি)। বলা হয়েছে এমন শব্দ, সংখ্যা ও কোড অক্ষরে অক্ষরে লেখো। শুধু ট্রান্সক্রিপ্ট দাও — কোনো ব্যাখ্যা, উদ্ধৃতি চিহ্ন বা অতিরিক্ত লেখা নয়।';

export async function transcribeAudioGemini(audioBase64: string, mimeType: string): Promise<string> {
  const env = getCfEnv();
  if (!env.geminiApiKey) {
    throw new Error('ভয়েস এখনো কনফিগার করা হয়নি — Gemini API key দরকার (GEMINI_API_KEY env)');
  }
  const models = [env.geminiModel || GEMINI_DEFAULT_MODEL, env.geminiFallbackModel || GEMINI_FALLBACK_MODEL];

  let lastErr = '';
  for (const model of models) {
    for (let attempt = 0; attempt < 2; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, 900));
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
          {
            method: 'POST',
            headers: { 'x-goog-api-key': env.geminiApiKey, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: TRANSCRIBE_INSTRUCTION },
                    { inline_data: { mime_type: mimeType, data: audioBase64 } },
                  ],
                },
              ],
              generationConfig: { temperature: 0.1, maxOutputTokens: 1200 },
            }),
          }
        );

        if (res.ok) {
          const json = await res.json().catch(() => null);
          const parts = json?.candidates?.[0]?.content?.parts || [];
          const text = parts
            .map((p: { text?: string }) => p.text || '')
            .join(' ')
            .trim()
            .replace(/^["']+|["']+$/g, ''); // প্রান্তের উদ্ধৃতি চিহ্ন বাদ
          if (text) return text;
          lastErr = 'খালি ট্রান্সক্রিপ্ট';
          break;
        }
        lastErr = `HTTP ${res.status}`;
        if (![429, 500, 502, 503].includes(res.status)) break;
      } catch (err) {
        lastErr = err instanceof Error ? err.message : 'অজানা ত্রুটি';
      }
    }
  }
  throw new Error(`ভয়েস ট্রান্সক্রিপশন ব্যর্থ (${lastErr})`);
}

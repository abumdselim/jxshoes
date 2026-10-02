import { NextResponse } from 'next/server';
import {
  AIMessage,
  buildStoreContext,
  isAIConfigured,
  AI_NOT_CONFIGURED_MSG,
  runAI,
  runAIJson,
  runAIStream,
} from '@/lib/ai';
import { generateReport, renderReportEmailHtml } from '@/lib/report';
import { isEmailConfigured, EMAIL_NOT_CONFIGURED_MSG, sendEmail } from '@/lib/email';
import { getDailyBrief, getOrders, getProducts, getReports, getStoreSettings, saveDailyBrief, saveReport } from '@/lib/store';
import { AIDailyBrief, AIInsights, AISaleMatch, Product } from '@/types';

export const runtime = 'edge';

function aiUnavailable() {
  return NextResponse.json({ error: AI_NOT_CONFIGURED_MSG, configured: false }, { status: 503 });
}

function nowDhaka(): string {
  return new Date().toLocaleString('bn-BD', { timeZone: 'Asia/Dhaka' });
}

// ================== DAILY BRIEF (দিনে ১ বার, KV-তে ক্যাশ) ==================
async function generateDailyBrief(force: boolean): Promise<NextResponse> {
  if (!isAIConfigured()) return aiUnavailable();

  const cached = force ? null : await getDailyBrief();
  if (cached) return NextResponse.json({ brief: cached, cached: true, configured: true });

  const context = await buildStoreContext(15);
  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `তুমি একটি জুতা ও ব্যাগের দোকানের AI ম্যানেজার ও ব্যবসা-উপদেষ্টা। সব উত্তর অবশ্যই সহজ, আন্তরিক বাংলায় দিবে। নিচের দোকানের আসল ডেটা বিশ্লেষণ করে কাজ করবে।

দোকানের বর্তমান ডেটা:
${context}

এখনের সময়: ${nowDhaka()}

শুধুমাত্র নিচের JSON আকারে উত্তর দাও (অন্য কোনো লেখা নয়):
{"greeting": "সময় অনুযায়ী (শুভ সকাল/দুপুর/বিকাল/সন্ধ্যা) + মালিকের নাম ধরে ১-২ বাক্যের উষ্ণ স্বাগতম", "summary": "শপের আজকের অবস্থার ২-৩ বাক্যের সারসংক্ষেপ (সেলস, অর্ডার, স্টক)", "advice": ["আজকের করণীয় ৩-৪টি সংক্ষিপ্ত বাস্তব পরামর্শ"], "alerts": ["জরুরি সতর্কতা: স্টক শেষ/কম হয়ে যাচ্ছে এমন প্রোডাক্ট, বেশি পেন্ডিং অর্ডার ইত্যাদি; সমস্যা না থাকলে খালি অ্যারে"]}`,
    },
    { role: 'user', content: 'আজকের ডেইলি ব্রিফিং দাও।' },
  ];

  try {
    const parsed = await runAIJson<Omit<AIDailyBrief, 'date' | 'generatedAt'>>(messages, {
      maxTokens: 1200,
    });
    const brief: AIDailyBrief = {
      date: new Date().toISOString().slice(0, 10),
      greeting: parsed.greeting || 'শুভ দিন!',
      summary: parsed.summary || '',
      advice: Array.isArray(parsed.advice) ? parsed.advice : [],
      alerts: Array.isArray(parsed.alerts) ? parsed.alerts : [],
      generatedAt: new Date().toISOString(),
    };
    await saveDailyBrief(brief);
    return NextResponse.json({ brief, cached: false, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI ব্রিফ তৈরি করা যায়নি', configured: true },
      { status: 500 }
    );
  }
}

// ================== BUSINESS INSIGHTS ==================
async function generateInsights(): Promise<NextResponse> {
  if (!isAIConfigured()) return aiUnavailable();

  const context = await buildStoreContext(40);
  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `তুমি একটি জুতা ও ব্যাগের দোকানের বিশ্লেষণী AI উপদেষ্টা। সব লেখা অবশ্যই বাংলায়। নিচের আসল ডেটা গভীরভাবে বিশ্লেষণ করবে — বানানো সংখ্যা বলবে না।

দোকানের ডেটা:
${context}

শুধুমাত্র এই JSON আকারে উত্তর দাও:
{"headline": "এক লাইনে মূল ফাইন্ডিং", "overview": "৩-৫ বাক্যে সামগ্রিক বিশ্লেষণ", "bestSellers": [{"name": "প্রোডাক্ট নাম", "reason": "কেন/কত বিক্রি হয়েছে"}], "slowMovers": [{"name": "প্রোডাক্ট নাম", "reason": "কেন ধীরগতি"}], "restockNeeds": [{"name": "প্রোডাক্ট নাম", "suggestion": "কত ও কেন রিস্টক করা উচিত"}], "pricingAdvice": [{"name": "প্রোডাক্ট নাম", "suggestion": "দাম নিয়ে পরামর্শ"}], "recommendations": ["সামগ্রিক ৩-৫টি কার্যকর পরামর্শ"]}
প্রতিটি অ্যারেতে সর্বোচ্চ ৫টি আইটেম; ডেটা না থাকলে খালি অ্যারে দাও।`,
    },
    { role: 'user', content: 'শপের সম্পূর্ণ বিজনেস ইনসাইট রিপোর্ট দাও।' },
  ];

  try {
    const parsed = await runAIJson<Omit<AIInsights, 'generatedAt'>>(messages, { maxTokens: 2000 });
    const insights: AIInsights = {
      headline: parsed.headline || '',
      overview: parsed.overview || '',
      bestSellers: Array.isArray(parsed.bestSellers) ? parsed.bestSellers : [],
      slowMovers: Array.isArray(parsed.slowMovers) ? parsed.slowMovers : [],
      restockNeeds: Array.isArray(parsed.restockNeeds) ? parsed.restockNeeds : [],
      pricingAdvice: Array.isArray(parsed.pricingAdvice) ? parsed.pricingAdvice : [],
      recommendations: Array.isArray(parsed.recommendations) ? parsed.recommendations : [],
      generatedAt: new Date().toISOString(),
    };
    return NextResponse.json({ insights, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ইনসাইট তৈরি করা যায়নি', configured: true },
      { status: 500 }
    );
  }
}

// ================== CHAT (স্টোর ডেটা সহ) ==================
async function handleChat(body: { messages?: { role: string; content: string }[]; stream?: boolean }) {
  if (!isAIConfigured()) return aiUnavailable();

  const history = (body.messages || [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-12)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  if (history.length === 0) {
    return NextResponse.json({ error: 'মেসেজ খালি' }, { status: 400 });
  }

  const context = await buildStoreContext(25);
  const system: AIMessage = {
    role: 'system',
    content: `তুমি "JxShoes" দোকানের নিজস্ব AI অ্যাসিস্ট্যান্ট — দোকানের মালিকের ডানহাত। সব উত্তর অবশ্যই সহজ বাংলায়।

নিয়ম:
- শুধু নিচের আসল ডেটা থেকে উত্তর দাও; ডেটায় যা নেই সেটা ধরে না-ও বলবে না — বরং সৎভাবে বলবে তথ্যটা পাওয়া যায়নি।
- সংখ্যা (সেলস, স্টক, দাম) হুবহু ডেটা থেকে দিবে।
- উত্তর সংক্ষিপ্ত ও কাজের হতে হবে; দরকার হলে ছোট বুলেট ব্যবহার করবে।
- দোকানের মালিককে "আপনি" সম্বোধন করবে।

দোকানের আসল ডেটা:
${context}`,
  };

  const messages: AIMessage[] = [system, ...history];

  if (body.stream) {
    try {
      const stream = await runAIStream(messages, { maxTokens: 1500 });
      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache',
        },
      });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'AI সংযোগে সমস্যা', configured: true },
        { status: 500 }
      );
    }
  }

  try {
    const reply = await runAI(messages, { maxTokens: 1500 });
    return NextResponse.json({ reply, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'AI উত্তর দিতে পারেনি', configured: true },
      { status: 500 }
    );
  }
}

// ================== PRODUCT CONTENT (বাংলা বিবরণ) ==================
async function generateProductContent(payload: {
  name?: string;
  category?: string;
  subCategory?: string;
  colors?: string;
  sizes?: string;
  price?: number;
  keywords?: string;
}) {
  if (!isAIConfigured()) return aiUnavailable();
  if (!payload.name) {
    return NextResponse.json({ error: 'প্রোডাক্টের নাম দিন' }, { status: 400 });
  }

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `তুমি একজন বাংলা ই-কমার্স কপিরাইটার। জুতা/ব্যাগের আকর্ষণীয়, বাস্তবসম্মত প্রোডাক্ট বিবরণ লেখো।
নিয়ম: ১২০-১৮০ শব্দের বাংলা বিবরণ, ২-৩টি ছোট প্যারাগ্রাফে; আরাম, মান, ব্যবহার-উপযোগিতা ও কেন-কিনবেন তা উঠে আসবে; কোনো ভুয়া দাবি/দাম নয়; ইমোজি বাদ; ইংরেজি প্রযুক্তিগত শব্দ (যেমন Sneakers, Leather) ব্যবহার করা যাবে।
শুধু JSON দাও: {"description": "..."}`,
    },
    {
      role: 'user',
      content: `প্রোডাক্ট: ${payload.name}
ক্যাটাগরি: ${payload.category || 'শু/ব্যাগ'}${payload.subCategory ? ` (${payload.subCategory})` : ''}
কালার: ${payload.colors || 'একাধিক'}
সাইজ: ${payload.sizes || 'স্ট্যান্ডার্ড'}
দাম: ৳${payload.price || 'N/A'}${payload.keywords ? `\nবিশেষ তথ্য: ${payload.keywords}` : ''}

এই প্রোডাক্টের বিবরণ লেখো।`,
    },
  ];

  try {
    const parsed = await runAIJson<{ description?: string }>(messages, { maxTokens: 900 });
    if (!parsed.description) throw new Error('বিবরণ তৈরি হয়নি');
    return NextResponse.json({ description: parsed.description, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'বিবরণ তৈরি করা যায়নি', configured: true },
      { status: 500 }
    );
  }
}

// ================== BANNER COPY (হিরো ব্যানার) ==================
async function generateBannerCopy(payload: { storeName?: string; tagline?: string }) {
  if (!isAIConfigured()) return aiUnavailable();

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `তুমি বাংলা বিজ্ঞাপন কপিরাইটার। জুতা-ব্যাগের দোকানের হিরো ব্যানারের জন্য ছোট, ধারালো, আকর্ষণীয় কপি লেখো।
শুধু JSON দাও: {"badgeText": "২-৪ শব্দের ব্যাজ", "titlePart1": "ব্যানারের প্রথম অংশ (৩-৫ শব্দ)", "titleHighlight": "হাইলাইট অংশ (২-৪ শব্দ, উদযাপন/অফার বোঝাবে)", "subtitle": "১-২ বাক্যের সাবটাইটেল", "ctaText": "২-৪ শব্দের বাটন লেখা"}`,
    },
    {
      role: 'user',
      content: `দোকানের নাম: ${payload.storeName || 'JxShoes & Bags'} | ট্যাগলাইন: ${payload.tagline || 'স্টাইলিশ জুতা ও ব্যাগ'}। চলতি সময়ের জন্য নতুন হিরো ব্যানার কপি দাও।`,
    },
  ];

  try {
    const parsed = await runAIJson<{
      badgeText?: string;
      titlePart1?: string;
      titleHighlight?: string;
      subtitle?: string;
      ctaText?: string;
    }>(messages, { maxTokens: 500 });
    return NextResponse.json(
      {
        badgeText: parsed.badgeText || '',
        titlePart1: parsed.titlePart1 || '',
        titleHighlight: parsed.titleHighlight || '',
        subtitle: parsed.subtitle || '',
        ctaText: parsed.ctaText || 'এখনই কিনুন',
        configured: true,
      },
      { status: 200 }
    );
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'কপি তৈরি করা যায়নি', configured: true },
      { status: 500 }
    );
  }
}

// ================== PARSE SALE (কোড/মেসেজ → প্রোডাক্ট ম্যাচ) ==================
function bnToEnDigits(s: string): string {
  const bn = '০১২৩৪৫৬৭৮৯';
  return s.replace(/[০-৯]/g, d => String(bn.indexOf(d)));
}

function deterministicMatch(message: string, products: Product[]): AISaleMatch | null {
  const norm = bnToEnDigits(message.toUpperCase()).trim();

  // ১) SKU / বারকোড দিয়ে সরাসরি ম্যাচ
  const prod = products.find(p => {
    const sku = (p.sku || '').toUpperCase();
    const barcode = (p.barcode || '').toUpperCase();
    return (
      (sku && norm.includes(sku)) ||
      (barcode && barcode.length >= 5 && norm.includes(barcode)) ||
      (p.variants || []).some(v => v.sku && norm.includes(v.sku.toUpperCase()))
    );
  });
  if (!prod) return null;

  // কোড অংশটা বাদ দিয়ে বাকি লেখায় সাইজ/কালার/পরিমাণ খোঁজা
  const rest = norm
    .replace((prod.sku || '§').toUpperCase(), ' ')
    .replace((prod.barcode || '§').toUpperCase(), ' ')
    .replace(/[x×]/g, ' ');

  let quantity = 1;
  const qtyMatch = rest.match(/(\d{1,3})\s*(?:টি|টা|PCS|PIECE)/);
  if (qtyMatch) {
    quantity = Math.max(1, parseInt(qtyMatch[1], 10));
  } else {
    const xMatch = message.match(/(?:x|×)\s*(\d{1,3})\b/i);
    if (xMatch) quantity = Math.max(1, parseInt(xMatch[1], 10));
  }

  let size: string | undefined;
  const sizeToken = rest
    .split(/[\s,\-_/]+/)
    .find(t => /^\d{1,2}$/.test(t) && prod.sizes.some(s => s === t));
  if (sizeToken) size = sizeToken;

  let color: string | undefined;
  const colorHit = prod.colors.find(c => {
    const name = c.name.toUpperCase();
    return name.length >= 3 && rest.includes(name);
  });
  if (colorHit) color = colorHit.name;

  // ভ্যারিয়েন্ট রেজলভ
  let variantId: string | undefined;
  if (prod.variants && prod.variants.length > 0) {
    const v =
      prod.variants.find(v => (!size || v.size === size) && (!color || v.color === color)) ||
      prod.variants.find(v => (v.stock || 0) > 0);
    if (v) {
      variantId = v.id;
      size = size || v.size;
      color = color || v.color;
    }
  }

  return {
    matched: true,
    productId: prod.id,
    productName: prod.name,
    variantId,
    size,
    color,
    quantity,
    confidence: 'high',
  };
}

function buildCatalogContext(products: Product[]): string {
  return products
    .map(p => {
      const variants = (p.variants || []).map(v => `${v.size}/${v.color}`).join(', ');
      return `${p.id} | ${p.sku || '-'} | ${p.barcode || '-'} | ${p.name} | ${p.category} | সাইজ: ${p.sizes.join(', ')} | কালার: ${p.colors.map(c => c.name).join(', ')} | স্টক: ${p.stockCount}${variants ? ` | ভ্যারিয়েন্ট: ${variants}` : ''}`;
    })
    .join('\n');
}

async function parseSaleMatch(payload: { message?: string }) {
  if (!isAIConfigured()) return aiUnavailable();
  const message = (payload.message || '').trim();
  if (!message) {
    return NextResponse.json({ error: 'মেসেজ খালি' }, { status: 400 });
  }

  const products = await getProducts();

  // ১) দ্রুত নিশ্চিত ম্যাচ — SKU/বারকোড দিয়ে (AI ছাড়াই)
  const direct = deterministicMatch(message, products);
  if (direct) {
    const product = products.find(p => p.id === direct.productId) || null;
    return NextResponse.json({ match: direct, product, configured: true });
  }

  // ২) AI ফাজি ম্যাচ
  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `তুমি দোকানের POS সহকারী। দোকানদার দ্রুত বিক্রি এন্ট্রির জন্য মেসেজ পাঠায় — এতে প্রোডাক্ট কোড/SKU/বারকোড/নাম, সাইজ, কালার, পরিমাণ থাকতে পারে (বাংলা বা ইংরেজিতে, যেমন "JX-SH-101 কালো ৪২ এর ২টা")।
নিচের প্রোডাক্ট তালিকার সাথে মেসেজটি মিলিয়ে দাও। বাংলা সংখ্যা বুঝবে (২=2)। পরিমাণ না থাকলে 1 ধরবে। বাংলা কালারের নাম ইংরেজি কালারের সাথে মিলাবে (কালো=Black, লাল=Red, সাদা=White, নীল=Blue, বাদামি=Brown, ধূসর=Gray)।
শুধু JSON দাও:
{"matched": true/false, "productId": "তালিকার id", "size": "সাইজ বা null", "color": "কালারের নাম বা null", "quantity": সংখ্যা, "confidence": "high|medium|low", "clarification": "মেসেজ অস্পষ্ট হলে দোকানদারকে বাংলায় যে প্রশ্ন করা উচিত", "alternatives": [{"productId": "...", "productName": "..."}]}
কোনো প্রোডাক্ট মেলেনি হলে matched:false এবং alternatives খালি।

প্রোডাক্ট তালিকা (id | SKU | বারকোড | নাম | ক্যাটাগরি | সাইজ | কালার | স্টক):
${buildCatalogContext(products)}`,
    },
    { role: 'user', content: message },
  ];

  try {
    const parsed = await runAIJson<AISaleMatch>(messages, { maxTokens: 700, temperature: 0.2 });
    const match: AISaleMatch = {
      matched: Boolean(parsed.matched && parsed.productId && products.some(p => p.id === parsed.productId)),
      productId: parsed.productId || undefined,
      productName: parsed.productName || products.find(p => p.id === parsed.productId)?.name,
      variantId: parsed.variantId || undefined,
      size: parsed.size || undefined,
      color: parsed.color || undefined,
      quantity: Number(parsed.quantity) > 0 ? Number(parsed.quantity) : 1,
      confidence: parsed.confidence === 'high' || parsed.confidence === 'medium' ? parsed.confidence : 'low',
      clarification: parsed.clarification,
      alternatives: Array.isArray(parsed.alternatives) ? parsed.alternatives.slice(0, 4) : [],
    };
    const product = match.productId ? products.find(p => p.id === match.productId) || null : null;
    return NextResponse.json({ match, product, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'মেসেজ বুঝতে পারা যায়নি', configured: true },
      { status: 500 }
    );
  }
}

// ================== AI REPORTS (সাপ্তাহিক/মাসিক) ==================
async function handleGenerateReport(payload: { reportType?: string }) {
  if (!isAIConfigured()) return aiUnavailable();
  const type = payload.reportType === 'monthly' ? 'monthly' : 'weekly';
  try {
    const report = await generateReport(type);
    return NextResponse.json({ report, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'রিপোর্ট তৈরি করা যায়নি', configured: true },
      { status: 500 }
    );
  }
}

async function handleEmailReport(payload: { reportId?: string; to?: string }) {
  if (!payload.reportId) {
    return NextResponse.json({ error: 'রিপোর্ট আইডি প্রয়োজন' }, { status: 400 });
  }
  const reports = await getReports();
  const report = reports.find(r => r.id === payload.reportId);
  if (!report) {
    return NextResponse.json({ error: 'রিপোর্ট পাওয়া যায়নি' }, { status: 404 });
  }

  const settings = await getStoreSettings();
  const to = (payload.to || settings.email || '').trim();
  if (!/^\S+@\S+\.\S+$/.test(to)) {
    return NextResponse.json({ error: 'সঠিক ইমেইল ঠিকানা দিন (সেটিংসে বা এখানে)' }, { status: 400 });
  }
  if (!isEmailConfigured()) {
    return NextResponse.json({ error: EMAIL_NOT_CONFIGURED_MSG, configured: false }, { status: 503 });
  }

  const html = renderReportEmailHtml(report, settings.storeName);
  const text = [
    report.headline,
    '',
    report.executiveSummary,
    '',
    ...report.scorecard.map(s => `${s.label}: ${s.value}`),
    '',
    'AI-এর পরামর্শ:',
    ...report.recommendations.map(r => `- ${r}`),
  ].join('\n');

  const result = await sendEmail({
    to,
    subject: `${report.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'} বিজনেস রিপোর্ট — ${settings.storeName}`,
    html,
    text,
    fromName: settings.storeName,
  });

  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 500 });
  }

  report.emailedTo = to;
  await saveReport(report);
  return NextResponse.json({ success: true, to, delivered: result.delivered || [] });
}

// ================== AI RESTOCK PLAN (রিস্টক প্ল্যান) ==================
async function handleRestockPlan() {
  if (!isAIConfigured()) return aiUnavailable();

  const [products, orders] = await Promise.all([getProducts(), getOrders()]);
  const monthAgo = Date.now() - 30 * 86400000;
  const soldBy = new Map<string, number>();
  for (const o of orders) {
    if (o.status === 'Cancelled') continue;
    if (new Date(o.createdAt).getTime() < monthAgo) continue;
    for (const it of o.items) {
      soldBy.set(it.productId, (soldBy.get(it.productId) || 0) + it.quantity);
    }
  }

  const catalog = products
    .map(p => {
      const variants = (p.variants || []).map(v => `${v.size}/${v.color}:${v.stock}`).join(', ');
      return `${p.id} | ${p.sku} | ${p.name} | স্টক:${p.stockCount} | অ্যালার্ট:${p.minStockAlert ?? 5} | ৩০দিনেরবিক্রি:${soldBy.get(p.id) || 0} | ক্রয়মূল্য:৳${p.costPrice ?? '?'}${variants ? ` | ভ্যারিয়েন্ট:${variants}` : ''}`;
    })
    .join('\n');

  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `তুমি দোকানের ইনভেন্টরি প্ল্যানিং AI। প্রতিটি প্রোডাক্টের স্টক, মিনিমাম অ্যালার্ট ও গত ৩০ দিনের বিক্রির গতি দেখে বলো কত করে রিস্টক করা উচিত।
হিসাবের ধারণা: ৩০ দিনের বিক্রি × ১.৫ (ঢাকার জন্য ঢাল) − বর্তমান স্টক = সাজেস্টেড; বিক্রি না হলে ছোট/শূন্য; স্টক-আউট বা দ্রুতবিক্রিতে বেশি। বানানো সংখ্যা নয় — ডেটা থেকে হিসাব করবে।
শুধু JSON দাও:
{"summary": "২-৩ বাক্যে সামগ্রিক রিস্টক পরিস্থিতি", "plan": [{"productId": "তালিকার id", "productName": "নাম", "recommendedQuantity": সংখ্যা, "reason": "কেন এত (বাংলায়, ১ বাক্য)"}]}
plan-এ এমন প্রোডাক্ট রাখো যেগুলোর সত্যিই রিস্টক দরকার (স্টক কম/শেষ বা বিক্রি বেশি); দরকার নেই এমন বাদ দাও। recommendedQuantity অবশ্যই অ-ঋণাত্মক পূর্ণসংখ্যা।

প্রোডাক্ট তালিকা:
${catalog}`,
    },
    { role: 'user', content: 'রিস্টক প্ল্যান দাও।' },
  ];

  try {
    const parsed = await runAIJson<{
      summary?: string;
      plan?: { productId?: string; productName?: string; recommendedQuantity?: number; reason?: string }[];
    }>(messages, { maxTokens: 1800 });

    const validIds = new Set(products.map(p => p.id));
    const plan = (Array.isArray(parsed.plan) ? parsed.plan : [])
      .filter(p => p.productId && validIds.has(p.productId) && Number(p.recommendedQuantity) > 0)
      .map(p => ({
        productId: p.productId!,
        productName: p.productName || products.find(x => x.id === p.productId)?.name || '',
        recommendedQuantity: Math.round(Number(p.recommendedQuantity)),
        reason: p.reason || '',
      }));

    return NextResponse.json({ summary: parsed.summary || '', plan, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'রিস্টক প্ল্যান তৈরি করা যায়নি', configured: true },
      { status: 500 }
    );
  }
}

// ================== ROUTE HANDLERS ==================
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('action') === 'daily-brief') {
    const refresh = searchParams.get('refresh') === '1';
    return generateDailyBrief(refresh);
  }
  return NextResponse.json({ error: 'অজানা action' }, { status: 400 });
}

export async function POST(request: Request) {
  let body: { action?: string; [k: string]: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'ভ্যালিড JSON পাঠান' }, { status: 400 });
  }

  switch (body.action) {
    case 'daily-brief-refresh':
      return generateDailyBrief(true);
    case 'insights':
      return generateInsights();
    case 'chat':
      return handleChat(body as { messages?: { role: string; content: string }[]; stream?: boolean });
    case 'product-content':
      return generateProductContent(body as Parameters<typeof generateProductContent>[0]);
    case 'banner-copy':
      return generateBannerCopy(body as { storeName?: string; tagline?: string });
    case 'parse-sale':
      return parseSaleMatch(body as { message?: string });
    case 'generate-report':
      return handleGenerateReport(body as { reportType?: string });
    case 'email-report':
      return handleEmailReport(body as { reportId?: string; to?: string });
    case 'restock-plan':
      return handleRestockPlan();
    default:
      return NextResponse.json({ error: 'অজানা action' }, { status: 400 });
  }
}

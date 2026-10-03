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
import { getDailyBrief, getOrders, getProducts, getReports, getStoreSettings, saveDailyBrief, saveReport, getInsights, saveInsight } from '@/lib/store';
import { transcribeAudioGemini } from '@/lib/ai';
import { restockProduct } from '@/lib/store';
import { AIDailyBrief, AIInsights, AISaleMatch, Product } from '@/types';
import { isAdminRequest } from '@/lib/adminAuth';
import { bnToEnDigits, deterministicMatch } from '@/lib/saleMatch';
import { TOOL_MAP, buildToolManual } from '@/lib/aiTools';
import { runDailyWatchers, mirrorBriefAlerts } from '@/lib/watchers';

export const runtime = 'edge';

function aiUnavailable() {
  return NextResponse.json({ error: AI_NOT_CONFIGURED_MSG, configured: false }, { status: 503 });
}

function unauthorized() {
  return NextResponse.json({ error: 'অনুমতি নেই — অ্যাডমিন হিসেবে লগইন করুন' }, { status: 401 });
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
      content: `তুমি একটি জুতা ও ব্যাগের দোকানের AI ম্যানেজার ও ব্যবসা-উপদেষ্টা। সব উত্তর অবশ্যই পরিষ্কার, ভদ্র ও পেশাদার (কর্পোরেট মানের) বাংলায় দিবে — অতিরিক্ত আন্তরিকতা, ইমোজি বা অদ্ভুত/অশোভন শব্দচয়ন কখনোই নয়। নিচের দোকানের আসল ডেটা বিশ্লেষণ করে কাজ করবে।

দোকানের বর্তমান ডেটা:
${context}

এখনের সময়: ${nowDhaka()}

শুধুমাত্র নিচের JSON আকারে উত্তর দাও (অন্য কোনো লেখা নয়):
{"greeting": "শুধুই সময় অনুযায়ী 'শুভ সকাল/দুপুর/বিকাল/সন্ধ্যা' দিয়ে শুরু করে ১-২ বাক্যের মার্জিত পেশাদার স্বাগতম (যেমন: 'শুভ বিকাল। আজকের ব্যবসার সারসংক্ষেপ তৈরি করেছি।'); 'মালিক সাহেব', 'সাহেব', 'ভাই' জাতীয় কোনো সম্বোধন করা যাবে না", "summary": "শপের আজকের অবস্থার ২-৩ বাক্যের সারসংক্ষেপ (সেলস, অর্ডার, স্টক)", "advice": ["আজকের করণীয় ৩-৪টি সংক্ষিপ্ত বাস্তব পরামর্শ"], "alerts": ["জরুরি সতর্কতা: স্টক শেষ/কম হয়ে যাচ্ছে এমন প্রোডাক্ট, বেশি পেন্ডিং অর্ডার ইত্যাদি; সমস্যা না থাকলে খালি অ্যারে"]}`,
    },
    { role: 'user', content: 'আজকের ডেইলি ব্রিফিং দাও।' },
  ];

  try {
    const parsed = await runAIJson<Omit<AIDailyBrief, 'date' | 'generatedAt'>>(messages, {
      maxTokens: 2000,
      temperature: 0.5,
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
    // প্রোঅ্যাকটিভ AI: ওয়াচার + ব্রিফের সতর্কতা নোটিফিকেশন সেন্টারে মিরর (ডিডুপসহ; ব্যর্থ হলেও ব্রিফ আটকাবে না)
    try {
      await runDailyWatchers();
      await mirrorBriefAlerts(brief);
    } catch (err) {
      console.warn('AI watcher warning:', err);
    }
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
      content: `তুমি একটি জুতা ও ব্যাগের দোকানের বিশ্লেষণী AI উপদেষ্টা। সব লেখা অবশ্যই বাংলায়; ভাষা হবে পরিষ্কার, ভদ্র ও কর্পোরেট রিপোর্টের মানের — অদ্ভুত শব্দচয়ন বা অতি-আন্তরিক সম্বোধন নয়। নিচের আসল ডেটা গভীরভাবে বিশ্লেষণ করবে — বানানো সংখ্যা বলবে না।

দোকানের ডেটা:
${context}

শুধুমাত্র এই JSON আকারে উত্তর দাও:
{"headline": "এক লাইনে মূল ফাইন্ডিং", "overview": "৩-৫ বাক্যে সামগ্রিক বিশ্লেষণ", "bestSellers": [{"name": "প্রোডাক্ট নাম", "reason": "কেন/কত বিক্রি হয়েছে"}], "slowMovers": [{"name": "প্রোডাক্ট নাম", "reason": "কেন ধীরগতি"}], "restockNeeds": [{"name": "প্রোডাক্ট নাম", "suggestion": "কত ও কেন রিস্টক করা উচিত"}], "pricingAdvice": [{"name": "প্রোডাক্ট নাম", "suggestion": "দাম নিয়ে পরামর্শ"}], "recommendations": ["সামগ্রিক ৩-৫টি কার্যকর পরামর্শ"]}
প্রতিটি অ্যারেতে সর্বোচ্চ ৫টি আইটেম; ডেটা না থাকলে খালি অ্যারে দাও।`,
    },
    { role: 'user', content: 'শপের সম্পূর্ণ বিজনেস ইনসাইট রিপোর্ট দাও।' },
  ];

  try {
    const parsed = await runAIJson<Omit<AIInsights, 'generatedAt'>>(messages, { maxTokens: 3200, temperature: 0.35 });
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
    // ইনসাইট সংরক্ষণ — হিস্ট্রি (শেষ ২৪) থাকলে ড্যাশবোর্ডে আবার খুললেই দেখা যায়
    await saveInsight(insights);
    return NextResponse.json({ insights, configured: true });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ইনসাইট তৈরি করা যায়নি', configured: true },
      { status: 500 }
    );
  }
}

// ================== CHAT (এজেন্ট লুপ — টুল দিয়ে সংগ্রহ/সংরক্ষণ) ==================
interface AgentConfirmation {
  type: 'sale' | 'due-payment' | 'new-product';
  message: string;
  payload: Record<string, unknown>;
}
interface AgentAutoExec {
  message: string;
  undoAvailable?: boolean;
  undoPayload?: Record<string, unknown>;
}

function chatSystemPrompt(context: string, withToolNote: boolean): AIMessage {
  return {
    role: 'system',
    content: `তুমি "Shopkeeper" দোকানের নিজস্ব AI অ্যাসিস্ট্যান্ট — দোকানের মালিকের বিশ্বস্ত ব্যবসায়িক সহকারী। সব উত্তর অবশ্যই সহজ কিন্তু ভদ্র ও পেশাদার বাংলায়।

নিয়ম:
- ভাষা মার্জিত ও কর্পোরেট মানের রাখবে; 'মালিক সাহেব', 'সাহেব', 'ভাই' জাতীয় কোনো সম্বোধন করবে না — শুধু 'আপনি' ব্যবহার করবে।
- শুধু আসল ডেটা ও TOOL_RESULT থেকে উত্তর দাও; ডেটায় যা নেই সেটা ধরে না-ও বলবে না — বরং সৎভাবে বলবে তথ্যটা পাওয়া যায়নি।
- সংখ্যা (সেলস, স্টক, দাম) হুবহু ডেটা থেকে দিবে।
- প্রশ্নের সাথে সম্পর্কিত তথ্যই শুধু ব্যবহার করবে — অপ্রাসঙ্গিক ডেটার তালিকা গুনে দেখাবে না।
- প্রশ্ন অস্পষ্ট হলে এক লাইনে স্পষ্টীকরণ চাইবে; জেনেরিক উত্তর দেবে না।
- উত্তর সংক্ষিপ্ত ও কাজের হতে হবে; দরকার হলে ছোট বুলেট ব্যবহার করবে।
${withToolNote ? '- টুলের মাধ্যমে কাজ হয়ে গেলে উত্তরে স্পষ্ট নিশ্চিত করবে (যেমন "স্টোরফ্রন্টে দেখা যাচ্ছে"); কনফার্মেশনের অপেক্ষায় থাকলে বুঝিয়ে বলবে।' : ''}

দোকানের আসল ডেটা:
${context}`,
  };
}

async function handleChat(body: { messages?: { role: string; content: string }[]; stream?: boolean }) {
  if (!isAIConfigured()) return aiUnavailable();

  const history = (body.messages || [])
    .filter(m => (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string' && m.content.trim())
    .slice(-10)
    .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }));

  if (history.length === 0) {
    return NextResponse.json({ error: 'মেসেজ খালি' }, { status: 400 });
  }

  const context = await buildStoreContext(15);

  // ---------- এজেন্ট সিদ্ধান্ত-লুপ: টুল কল শনাক্ত ও চালানো (সর্বোচ্চ ৩ রাউন্ড) ----------
  const decideSystem: AIMessage = {
    role: 'system',
    content: `তুমি দোকানের AI এজেন্টের সিদ্ধান্ত-মডিউল। ব্যবহারকারীর সর্বশেষ বার্তা দেখে ঠিক করো কী করতে হবে। শুধুমাত্র এই JSON আকারে উত্তর দাও:

টুল লাগলে: {"tool": "<tool_name>", "args": {...}}
টুল ছাড়াই চূড়ান্ত উত্তর সম্ভব হলে (সাধারণ কথা, ব্যাখ্যা, অস্পষ্টতার প্রশ্ন): {"reply": "পূর্ণ বাংলা উত্তর"}

টুল ম্যানুয়াল:
${buildToolManual()}

নিয়ম:
- ব্যবসার সংখ্যা (বিক্রয়, স্টক, বাকি, খরচ, অর্ডার, মুভমেন্ট, রিস্টক) সম্পর্কে যেকোনো প্রশ্নে **অবশ্যই** সংশ্লিষ্ট টুল ব্যবহার করবে — কখনোই reply দিয়ে সংখ্যা আন্দাজ করবে না।
- ইতিমধ্যে TOOL_RESULT থাকলে সেটাই প্রমাণ — একই টুল আবার চালাবে না; উত্তর দাও।
- আর্গুমেন্ট অসম্পূর্ণ (যেমন SKU/ফোন নেই) হলে টুল না দিয়ে reply-তে এক লাইনে জিজ্ঞেস করবে।
- বিক্রি বা বাকি-আদায় চাইলে propose_sale/propose_due_payment — এগুলো নিজে থেকে কখনো সম্পন্ন হয় না।
- সাধারণ অভিবাদন, ব্যাখ্যা বা অস্পষ্টতার প্রশ্নে reply দাও।`,
  };

  const toolEvents: { name: string; label: string }[] = [];
  const confirmations: AgentConfirmation[] = [];
  const autoExecuted: AgentAutoExec[] = [];
  const workingMessages: AIMessage[] = [...history];
  let decideReply: string | null = null;

  for (let round = 0; round < 3; round++) {
    let decision: { tool?: string; args?: Record<string, unknown>; reply?: string } | null = null;
    try {
      decision = await runAIJson<{ tool?: string; args?: Record<string, unknown>; reply?: string }>(
        [decideSystem, ...workingMessages],
        { maxTokens: 700, temperature: 0.15 }
      );
    } catch {
      break; // পার্স/নেটওয়ার্ক ব্যর্থ — সাধারণ স্ট্রিমে ফিরে যাবে
    }
    const tool = decision?.tool ? TOOL_MAP.get(decision.tool) : undefined;
    if (!tool || !decision) {
      if (decision?.reply) decideReply = decision.reply;
      break;
    }
    const decisionArgs = decision.args || {};
    // টুল চালানো
    toolEvents.push({ name: tool.name, label: tool.label });
    let result;
    try {
      result = await tool.run(decisionArgs);
    } catch (err) {
      result = { ok: false, data: `টুল ব্যর্থ: ${err instanceof Error ? err.message : 'অজানা'}` };
    }
    workingMessages.push({ role: 'assistant', content: JSON.stringify({ tool: tool.name, args: decisionArgs }) });
    workingMessages.push({ role: 'user', content: `TOOL_RESULT (${tool.name}): ${result.data}` });
    if (result.needsConfirmation) confirmations.push(result.needsConfirmation);
    if (result.autoExecuted) autoExecuted.push(result.autoExecuted);
    // পরের রাউন্ড — ফলাফলসহ আবার সিদ্ধান্ত
  }

  const encoder = new TextEncoder();
  const headers = {
    'Content-Type': 'text/event-stream; charset=utf-8',
    'Cache-Control': 'no-cache',
  };

  /** কাস্টম এজেন্ট-ইভেন্টগুলো (টুল চিপ/কনফার্ম কার্ড) স্ট্রিমের শুরুতে বসায় */
  const prependAgentEvents = (upstreamStream: ReadableStream<Uint8Array> | null, replyText: string | null) => {
    const agentStream = new ReadableStream<Uint8Array>({
      async start(controller) {
        for (const ev of toolEvents) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ tool: ev })}\n\n`));
        for (const c of confirmations) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ confirm: c })}\n\n`));
        if (autoExecuted.length > 0) controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: autoExecuted })}\n\n`));
        if (replyText) {
          // চূড়ান্ত উত্তর টুকরো করে SSE-তে (ক্লায়েন্ট একই পার্সারে পড়ে)
          for (let i = 0; i < replyText.length; i += 120) {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: replyText.slice(i, i + 120) } }] })}\n\n`));
          }
          controller.enqueue(encoder.encode('data: [DONE]\n\n'));
          controller.close();
          return;
        }
        if (upstreamStream) {
          const reader = upstreamStream.getReader();
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            controller.enqueue(value);
          }
        }
        controller.close();
      },
    });
    return new Response(agentStream, { headers });
  };

  // টুল-রাউন্ড ঘটলে ফলাফলসহ চূড়ান্ত উত্তরের প্রম্পট
  const finalMessages: AIMessage[] = [chatSystemPrompt(context, true), ...workingMessages];

  // স্ট্রিমিং অনুরোধ: টুল ছাড়া সরাসরি উত্তর এসে গেলে আর বড় কল লাগে না
  if (body.stream) {
    if (toolEvents.length === 0 && confirmations.length === 0 && autoExecuted.length === 0 && decideReply) {
      return prependAgentEvents(null, decideReply);
    }
    try {
      const upstream = await runAIStream(finalMessages, { maxTokens: 1800, temperature: 0.35 });
      return prependAgentEvents(upstream, null);
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : 'AI সংযোগে সমস্যা', configured: true },
        { status: 500 }
      );
    }
  }

  try {
    const reply =
      decideReply ||
      (await runAI(finalMessages, { maxTokens: 1800, temperature: 0.35 }));
    return NextResponse.json({ reply, confirmations, autoExecuted, configured: true });
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
    const parsed = await runAIJson<{ description?: string }>(messages, { maxTokens: 1400, temperature: 0.7 });
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
      content: `দোকানের নাম: ${payload.storeName || 'Shopkeeper'} | ট্যাগলাইন: ${payload.tagline || 'স্টাইলিশ জুতা ও ব্যাগ'}। চলতি সময়ের জন্য নতুন হিরো ব্যানার কপি দাও।`,
    },
  ];

  try {
    const parsed = await runAIJson<{
      badgeText?: string;
      titlePart1?: string;
      titleHighlight?: string;
      subtitle?: string;
      ctaText?: string;
    }>(messages, { maxTokens: 800, temperature: 0.7 });
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
// ম্যাচিং লজিক src/lib/saleMatch.ts-এ সরানো হয়েছে (P2 — টেস্টেবল পিওর ফাংশন)


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
    const parsed = await runAIJson<AISaleMatch>(messages, { maxTokens: 1200, temperature: 0.15 });
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
    }>(messages, { maxTokens: 2600, temperature: 0.2 });

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

// ================== PARSE INTENT (সেল / রিস্টক / নতুন প্রোডাক্ট) ==================
/** মেসেজে এই শব্দগুলো থাকলে বিক্রি নয়, স্টক-ইন (রিস্টক) বোঝায় */
const RESTOCK_KEYWORDS =
  /(স্টক|চালান|রিস্টক|বাড়া|যোগ\s*(কর|হলো|হয়েছে)|ঢুকেছে|এসেছে|পৌঁছে|লট|STOCK|RESTOCK|INVOICE|CHASE)/i;

function extractUnitCost(message: string): number | undefined {
  const norm = bnToEnDigits(message);
  const m =
    norm.match(/(?:কস্ট|ক্রয়মূল্য|দাম|cost|purchase)\s*[:]?\s*(?:৳|\$)?\s*(\d{3,7})/i) ||
    norm.match(/(?:৳|\$)\s*(\d{3,7})\s*(?:কস্ট|ক্রয়|প্রতি)/i);
  if (m) {
    const v = Number(m[1]);
    return v > 0 ? v : undefined;
  }
  return undefined;
}

/**
 * ভয়েস কমান্ড: অডিও → Gemini ট্রান্সক্রিপ্ট → parse-intent পাইপলাইন
 * রেসপন্সে transcript সহ সাধারণ intent ফলাফল যায় — ক্লায়েন্ট পপআপে
 * "যা শোনা হলো" দেখিয়ে নিশ্চিত করায়, তাই শতভাগ নির্ভুল কাজ হয়।
 */
async function handleVoiceIntent(payload: { audioBase64?: string; mimeType?: string }) {
  if (!isAIConfigured()) return aiUnavailable();
  const audio = (payload.audioBase64 || '').trim();
  if (!audio) {
    return NextResponse.json({ error: 'অডিও পাওয়া যায়নি' }, { status: 400 });
  }

  let transcript: string;
  try {
    transcript = await transcribeAudioGemini(audio, payload.mimeType || 'audio/webm');
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'ভয়েস ট্রান্সক্রিপশন ব্যর্থ' },
      { status: 500 }
    );
  }

  // ===== ASR-ভুল সংশোধন: ক্যাটালগ দেখিয়ে ট্রান্সক্রিপ্ট শুদ্ধ করা =====
  let effectiveMessage = transcript;
  try {
    const products = await getProducts();
    const fix = await runAIJson<{ corrected?: string }>(
      [
        {
          role: 'system',
          content: `নিচের টেক্সট একটি ভয়েস-রিকগনিশন ইঞ্জিনের ট্রান্সক্রিপ্ট — বাংলা শুনে লেখায় ভুল থাকতে পারে (প্রোডাক্ট কোড, নাম, সংখ্যা বিকৃত হতে পারে)। প্রোডাক্ট তালিকার সাথে মিলিয়ে কোড/নাম/সংখ্যা শুদ্ধ করো। শুনে বোঝা সংখ্যা সঠিক সংখ্যায় লেখো (আট=8)। বাকি সব না-ছোঁয়া রাখো। শুধু JSON দাও: {"corrected": "শুদ্ধ টেক্সট"}`,
        },
        {
          role: 'user',
          content: `ট্রান্সক্রিপ্ট: ${transcript}

প্রোডাক্ট তালিকা:
${buildCatalogContext(products)}`,
        },
      ],
      { maxTokens: 700, temperature: 0.1 }
    );
    if (fix.corrected && fix.corrected.trim()) effectiveMessage = fix.corrected.trim();
  } catch {
    // সংশোধন ব্যর্থ হলে কাঁচা ট্রান্সক্রিপ্টেই এগোও
  }

  const intentRes = await parseIntent({ message: effectiveMessage });
  const intentData = await intentRes.json().catch(() => ({ intent: 'other' }));

  // ===== অটো-এক্সিকিউশন: হুবহু SKU-ম্যাচ restock (নিরাপদ + আন্ডোযোগ্য) =====
  if (
    intentData.intent === 'restock' &&
    intentData.direct === true &&
    intentData.product
  ) {
    const qty = Number(intentData.quantity) || 1;
    if (qty > 0 && qty <= 1000) {
      const p = intentData.product;
      const unitCost = Number(intentData.unitCost) > 0 ? Number(intentData.unitCost) : undefined;
      const updated = await restockProduct(
        p.id,
        qty,
        unitCost,
        (intentData.supplierOrInvoice as string) || undefined,
        `AI ভয়েস অটো-রিস্টক — শুনেছে: "${transcript}"`
      );
      if (updated) {
        return NextResponse.json({
          transcript,
          effectiveMessage,
          intent: 'restock',
          autoExecuted: {
            type: 'restock',
            productId: updated.id,
            productName: updated.name,
            quantity: qty,
            previousStock: updated.stockCount - qty,
            newStock: updated.stockCount,
          },
          configured: true,
        });
      }
    }
  }

  return NextResponse.json({ transcript, effectiveMessage, ...intentData });
}

async function parseIntent(payload: { message?: string }) {
  if (!isAIConfigured()) return aiUnavailable();
  const message = (payload.message || '').trim();
  if (!message) {
    return NextResponse.json({ error: 'মেসেজ খালি' }, { status: 400 });
  }

  const products = await getProducts();

  // ১) দ্রুত নিশ্চিত ম্যাচ — SKU/বারকোড থাকলে (AI ছাড়াই, AI খরচ বাঁচে)
  const direct = deterministicMatch(message, products);
  if (direct?.matched && direct.productId) {
    const product = products.find(p => p.id === direct.productId) || null;
    if (RESTOCK_KEYWORDS.test(message)) {
      return NextResponse.json({
        intent: 'restock',
        product,
        quantity: direct.quantity || 1,
        unitCost: extractUnitCost(message) || null,
        direct: true, // হুবহু SKU/বারকোড ম্যাচ — অটো-এক্সিকিউশনের শর্ত
        configured: true,
      });
    }
    return NextResponse.json({ intent: 'sale', match: direct, product, configured: true });
  }

  // ২) AI ক্লাসিফায়ার — বাকি সব ক্ষেত্রে
  const messages: AIMessage[] = [
    {
      role: 'system',
      content: `তুমি দোকানের ইনভেন্টরি সহকারী। দোকানদারের মেসেজ থেকে ইচ্ছা শনাক্ত করো:
- "sale": পণ্য বিক্রি হয়েছে ("JX-SH-001 কালো ৪২ এর ২টা গেছে")
- "restock": আগের পণ্যের স্টক বাড়ানো/চালান এসেছে ("JX-SH-002 এ ১৫টা স্টক, কস্ট ১৬৫০", "রিস্টক করো রেড স্নিকার্স ১০টা")
- "new-product": সম্পূর্ণ নতুন পণ্য ইনভেন্টরিতে যোগ ("নতুন প্রোডাক্ট: Nike Air Max, দাম ৫৫০০", "Bata Formal Shoe যোগ করো, দাম ৪২০০")
- "other": এসবের কোনোটাই না
বাংলা সংখ্যা বুঝবে (২=2)। বাংলা কালারের নাম ইংরেজিতে অনুবাদ করবে (কালো=Black, লাল=Red, সাদা=White, নীল=Blue, বাদামি=Brown, ধূসর=Gray, সবুজ=Green)।
শুধু JSON দাও:
{"intent": "sale|restock|new-product|other", "productId": "তালিকার id বা null", "size": null, "color": null, "quantity": সংখ্যা-অথবা-null, "unitCost": সংখ্যা-অথবা-null, "supplierOrInvoice": "স্ট্রিং-অথবা-null",
"newProduct": {"name": null, "category": "shoes|bags|accessories", "subCategory": null, "price": null, "costPrice": null, "sizes": [], "colors": [], "stockCount": null, "supplier": null, "description": null},
"clarification": null}
নিয়ম: productId অবশ্যই তালিকার id হতে হবে। restock/new-product-এ পরিমাণ/দাম না বলা থাকলে null দাও।
গুরুত্বপূর্ণ: নতুন পণ্যের জন্য শুধু **নাম আর দাম** থাকলেই intent:"new-product" দাও — সাইজ/কালার/স্টক/সাপ্লায়ার না থাকলে সেগুলোতে null বা খালি অ্যারে দাও (সিস্টেম ডিফল্ট বসাবে), কখনোই বাড়তি তথ্য চাইবে না। intent:"other" + clarification দাও শুধু যদি নামই না থাকে বা মেসেজটা ইনভেন্টরির কাজ না হয়।

প্রোডাক্ট তালিকা (id | SKU | বারকোড | নাম | ক্যাটাগরি | সাইজ | কালার | স্টক):
${buildCatalogContext(products)}`,
    },
    { role: 'user', content: message },
  ];

  try {
    const parsed = await runAIJson<{
      intent?: string;
      productId?: string | null;
      size?: string | null;
      color?: string | null;
      quantity?: number | null;
      unitCost?: number | null;
      supplierOrInvoice?: string | null;
      clarification?: string | null;
      newProduct?: {
        name?: string | null;
        category?: string | null;
        subCategory?: string | null;
        price?: number | null;
        costPrice?: number | null;
        sizes?: string[] | null;
        colors?: string[] | null;
        stockCount?: number | null;
        supplier?: string | null;
        description?: string | null;
      } | null;
    }>(messages, { maxTokens: 1400, temperature: 0.2 });

    const intent = parsed.intent || 'other';

    if (intent === 'restock' && parsed.productId && products.some(p => p.id === parsed.productId)) {
      const product = products.find(p => p.id === parsed.productId) || null;
      return NextResponse.json({
        intent: 'restock',
        product,
        quantity: Number(parsed.quantity) > 0 ? Number(parsed.quantity) : 1,
        unitCost: Number(parsed.unitCost) > 0 ? Number(parsed.unitCost) : null,
        supplierOrInvoice: parsed.supplierOrInvoice || null,
        configured: true,
      });
    }

    if (intent === 'sale' && parsed.productId && products.some(p => p.id === parsed.productId)) {
      const product = products.find(p => p.id === parsed.productId) || null;
      return NextResponse.json({
        intent: 'sale',
        match: {
          matched: true,
          productId: parsed.productId,
          productName: product?.name,
          size: parsed.size || undefined,
          color: parsed.color || undefined,
          quantity: Number(parsed.quantity) > 0 ? Number(parsed.quantity) : 1,
          confidence: 'medium' as const,
        },
        product,
        configured: true,
      });
    }

    if (intent === 'new-product' && parsed.newProduct?.name && Number(parsed.newProduct.price) > 0) {
      const np = parsed.newProduct;
      const category = ['shoes', 'bags', 'accessories'].includes(np.category || '') ? np.category! : 'shoes';
      const sizes = Array.isArray(np.sizes) && np.sizes.length > 0 ? np.sizes.map(String) : category === 'shoes' ? ['39', '40', '41', '42', '43', '44'] : ['Standard'];
      const colors = Array.isArray(np.colors) && np.colors.length > 0 ? np.colors.map(String) : ['Black'];
      return NextResponse.json({
        intent: 'new-product',
        draft: {
          name: String(np.name),
          category,
          subCategory: np.subCategory || '',
          price: Number(np.price),
          costPrice: Number(np.costPrice) > 0 ? Number(np.costPrice) : null,
          sizes,
          colors,
          stockCount: Number(np.stockCount) > 0 ? Math.round(Number(np.stockCount)) : 0,
          supplier: np.supplier || '',
          description: np.description || '',
        },
        configured: true,
      });
    }

    return NextResponse.json({
      intent: 'other',
      clarification: parsed.clarification || null,
      configured: true,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'মেসেজ বুঝতে পারা যায়নি', configured: true },
      { status: 500 }
    );
  }
}

// ================== ROUTE HANDLERS ==================
// ================== HEALTH CHECK (AI সক্ষমতা যাচাই) ==================
async function healthCheck(): Promise<NextResponse> {
  if (!isAIConfigured()) return aiUnavailable();

  const started = Date.now();
  try {
    const reply = await runAI(
      [
        {
          role: 'system',
          content:
            'তুমি একটি সিস্টেম পরীক্ষক। শুধুমাত্র এই JSON দাও: {"status":"ok","bengali":"বাংলা ঠিকভাবে দেখাও"} — অন্য কিছু নয়।',
        },
        { role: 'user', content: 'স্বাস্থ্য পরীক্ষা' },
      ],
      { maxTokens: 300, temperature: 0 }
    );
    return NextResponse.json({
      configured: true,
      healthy: true,
      latencyMs: Date.now() - started,
      sample: reply.slice(0, 200),
    });
  } catch (error) {
    return NextResponse.json(
      {
        configured: true,
        healthy: false,
        latencyMs: Date.now() - started,
        error: error instanceof Error ? error.message : 'অজানা ত্রুটি',
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  // AI সারফেস অ্যাডমিন-লক — কোটা ও ব্যবসার ডেটা পাবলিক থেকে সুরক্ষিত
  if (!(await isAdminRequest(request))) return unauthorized();

  const { searchParams } = new URL(request.url);
  if (searchParams.get('action') === 'health') {
    return healthCheck();
  }
  if (searchParams.get('action') === 'daily-brief') {
    const refresh = searchParams.get('refresh') === '1';
    return generateDailyBrief(refresh);
  }
  if (searchParams.get('action') === 'insights-history') {
    const list = await getInsights();
    return NextResponse.json({ insights: list, configured: true });
  }
  return NextResponse.json({ error: 'অজানা action' }, { status: 400 });
}

export async function POST(request: Request) {
  // AI সারফেস অ্যাডমিন-লক
  if (!(await isAdminRequest(request))) return unauthorized();

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
    case 'parse-intent':
      return parseIntent(body as { message?: string });
    case 'voice-intent':
      return handleVoiceIntent(body as { audioBase64?: string; mimeType?: string });
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

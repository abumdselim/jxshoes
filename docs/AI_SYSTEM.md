# 🤖 AI সিস্টেম — আর্কিটেকচার ও রেফারেন্স

> JxShoes অ্যাডমিন প্যানেলের AI অংশের সম্পূর্ণ টেকনিক্যাল ডকুমেন্টেশন।
> ফিচার তালিকা ও প্রোগ্রেস দেখতে: [ROADMAP.md](./ROADMAP.md)

---

## ১. আর্কিটেকচার এক নজরে

```
ব্রাউজার (অ্যাডমিন UI)
   │  fetch('/api/ai')  ← শুধু এই রাউট, কোনো AI টোকেন ব্রাউজারে যায় না
   ▼
Next.js Edge API Route (src/app/api/ai/route.ts)
   │  store context তৈরি (src/lib/store.ts থেকে আসল ডেটা)
   ▼
Workers AI REST API (src/lib/ai.ts)
   POST https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/ai/run/{MODEL}
   Authorization: Bearer CLOUDFLARE_API_TOKEN
```

**নকশার সিদ্ধান্ত:**
- **REST API (বাইন্ডিং নয়):** প্রজেক্টের বাকি Cloudflare ইন্টিগ্রেশন (KV, R2) যেভাবে REST দিয়ে হয়, AI-ও সেভাবে — `@cloudflare/next-on-pages` বিল্ডে কোনো অতিরিক্ত wrangler কনফিগ লাগে না।
- **একই টোকেন:** KV/R2 যে `CLOUDFLARE_API_TOKEN` ব্যবহার করে, AI-ও সেটাই — শুধু টোকেনে **"Workers AI → Write"** পারমিশন যোগ করতে হবে।
- **ফেলব্যাক মডেল:** প্রাইমারি মডেল ফেল করলে অটোমেটিক ফেলব্যাক মডেলে চেষ্টা হয় (নেটওয়ার্ক/৫০৩/মডেল এরর সামলায়)।
- **আসল ডেটা ইনজেকশন:** AI কখনো মনে করে উত্তর দেয় না — প্রতিটা রিকোয়েস্টে `buildStoreContext()` দিয়ে আসল প্রোডাক্ট/স্টক/সেলস ডেটা প্রম্পটে যায়।

## ২. মডেল কনফিগারেশন

| Env ভেরিয়েবল | ডিফল্ট | কাজ |
|---|---|---|
| `AI_TEXT_MODEL` | `@cf/google/gemma-4-26b-a4b-it` | প্রাইমারি — Gemma ফ্যামিলি বাংলা অফিসিয়ালি সাপোর্ট করে |
| `AI_FALLBACK_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | ফেলব্যাক — শক্তিশালী ইনস্ট্রাক্ট-ফলোয়িং, স্ট্রিমিং+JSON মোড |

- মডেল বদলাতে Cloudflare Pages প্রজেক্ট সেটিংসে env ভেরিয়েবল যোগ করলেই হবে (বিল্ড টাইমে `process.env` থেকে পড়ে)।
- **JSON আউটপুট:** `response_format` মোডের বদলে প্রম্পটে JSON চাওয়া হয় + `extractJson()` দিয়ে রোবাস্ট পার্সিং (কোড-ফেন্স/অতিরিক্ত লেখা সামলায়) — সব মডেলে কাজ করে।
- **স্ট্রিমিং:** `stream: true` → Workers AI SSE (`data: {"response":"…"}` … `data: [DONE]`) সরাসরি ক্লায়েন্টে পাস-থ্রু হয়; ক্লায়েন্ট পার্স করে `src/lib/chatClient.ts`-এ।
- ফ্রি লিমিট: ১০,০০০ নিউরন/দিন; টেক্সট মডেল ৩০০ req/min।

## ৩. API রেফারেন্স

### `GET /api/ai?action=daily-brief[&refresh=1]`
আজকের AI ব্রিফ — **দিনে ১ বার** জেনারেট হয়ে KV কি `jx_ai_daily_brief`-তে ক্যাশ হয়। `refresh=1` দিলে জোর করে নতুন বানায়।
```jsonc
{
  "brief": {
    "date": "2026-10-02",
    "greeting": "শুভ সকাল, রফিক ভাই! …",
    "summary": "…",
    "advice": ["…", "…"],
    "alerts": ["…"],
    "generatedAt": "…"
  },
  "cached": true,
  "configured": true
}
```

### `POST /api/ai` — `{ action: "…" }`

| action | body | রেসপন্স | ব্যবহারকারী |
|---|---|---|---|
| `insights` | — | `{ insights: AIInsights }` | ড্যাশবোর্ড ইনসাইট কার্ড |
| `chat` | `{ messages, stream? }` | স্ট্রিম (SSE) অথবা `{ reply }` | অ্যাসিস্ট্যান্ট পেজ + FAB |
| `product-content` | `{ name, category, subCategory, colors, sizes, price }` | `{ description }` | প্রোডাক্ট ফর্ম |
| `banner-copy` | `{ storeName, tagline }` | `{ badgeText, titlePart1, titleHighlight, subtitle, ctaText }` | মার্কেটিং পেজ |
| `parse-sale` | `{ message }` | `{ match: AISaleMatch, product: Product \| null }` | AI FAB কুইক সেল |
| `daily-brief-refresh` | — | `{ brief }` | ড্যাশবোর্ড "নতুন ব্রিফিং" |

**AI কনফিগার না থাকলে:** সব অ্যাকশন `503` + `{ error, configured: false }` — UI তে বন্ধুত্বপূর্ণ বাংলা নির্দেশনা দেখায়।

### `POST /api/pos/sale`
```jsonc
// রিকোয়েস্ট
{ "items": [{ "productId": "prod-1", "variantId": "…", "quantity": 2, "size": "42", "color": "Black" }],
  "customerName": "ওয়াক-ইন", "note": "AI কুইক সেল" }
// রেসপন্স 201
{ "success": true, "order": { …, "source": "in-store", "status": "Delivered" } }
```
পাশাপাশি: প্রোডাক্ট স্টক + ম্যাচড ভ্যারিয়েন্ট স্টক কমে, `SALE` ইনভেন্টরি মুভমেন্ট লেখা হয়।

## ৪. কুইক সেল পার্সিং (`parse-sale`)

দুই ধাপে — AI খরচ ও লেটেন্সি বাঁচাতে:

1. **ডিটারমিনিস্টিক ম্যাচ (AI ছাড়া):** মেসেজে SKU/বারকোড/ভ্যারিয়েন্ট-SKU খোঁজা। পেলে সাইজ (সংখ্যা টোকেন), কালার (নাম সাবস্ট্রিং), পরিমাণ (`2টি/টা/pcs` বা `x2`) হিউরিস্টিকে বের করে; `confidence: "high"`।
2. **AI ফাজি ম্যাচ:** না পেলে পুরো ক্যাটালগ কমপ্যাক্ট তালিকা দিয়ে AI-কে JSON ম্যাচ করতে বলা হয় — বাংলা সংখ্যা (২=2) ও বাংলা কালার (কালো=Black) সামলায়।

কনফার্মেশন পপআপে দোকানদার সবকিছু ঠিক করতে পারে (সাইজ/কালার ড্রপডাউন, পরিমাণ স্টেপার, স্টক ভ্যালিডেশন) — তাই AI-এর ভুল থাকলেও সেল সঠিক হয়।

## ৫. স্টোর কনটেক্সট (`buildStoreContext`)

প্রম্পটে যে আসল ডেটা যায়:
- দোকানের নাম, মালিকের নাম, হটলাইন, ডেলিভারি ফি
- প্রোডাক্ট তালিকা: `SKU | বারকোড | নাম | ক্যাটাগরি | দাম | কস্ট | স্টক | অ্যালার্ট | ভ্যারিয়েন্ট-স্টক` (সর্বোচ্চ ১৫০)
- সেলস সামারি: আজ / ৭ দিন / ৩০ দিন / সর্বমোট + পেন্ডিং অর্ডার সংখ্যা
- প্রোডাক্ট-ভিত্তিক বিক্রি র‍্যাংকিং (টপ ৪০)
- সাম্প্রতিক অর্ডার (লিমিটসহ, ডেফল্ট ২৫)

## ৬. প্রম্পট গাইডলাইন (নিজে এডিট করলে)

- সব সিস্টেম প্রম্পট **বাংলায় লেখা** — মডেল বাংলা আউটপুটে ফোকাস করে
- JSON চাওয়ার সময়: "শুধুমাত্র JSON আকারে উত্তর দাও (অন্য কোনো লেখা নয়)" + স্কিমা উদাহরণ দাও
- `runAIJson()` ব্যবহার করো — `temperature` ডিফল্ট ০.৩ (সংখ্যা/স্ট্রাকচার সঠিক রাখতে)
- প্রম্পট ছোট রাখো — কনটেক্সটই সবচেয়ে বড় অংশ; দরকারমতো `orderLimit` কমাও
- নতুন AI অ্যাকশন যোগ করার ধাপ:
  1. `route.ts`-এ `async function handleX(payload)` + `switch`-এ কেস
  2. দরকার হলে `types/index.ts`-এ রেসপন্স টাইপ
  3. `docs/ROADMAP.md` + এই ফাইলের টেবিলে এন্ট্রি

## ৭. ট্রাবলশুটিং

| সমস্যা | কারণ | সমাধান |
|---|---|---|
| সব AI বাটনে "AI এখনো কনফিগার করা হয়নি" | টোকেনে AI পারমিশন নেই / env বিল্ডে যায়নি | টোকেনে "Workers AI → Write" দাও, আবার ডিপ্লয় করো |
| `Workers AI (model): …` এরর | মডেল আইডি বদলানো/অপ্রত্যক্ষ হয়ে গেছে | `AI_TEXT_MODEL` env দিয়ে সঠিক মডেল বসাও ([ক্যাটালগ](https://developers.cloudflare.com/workers-ai/models/)) |
| JSON পার্স এরর | মডেল ফরম্যাট ভাঙেছে | প্রম্পটে স্কিমা আরও স্পষ্ট করো, ছোট মডেলে `maxTokens` বাড়াও |
| বাংলা লেখার মান খারাপ | ইংরেজি-কেন্দ্রিক মডেল | Gemma ফ্যামিলি রাখো (`@cf/google/…`) |
| ব্রিফ আপডেট হচ্ছে না | ক্যাশ (দিনে ১ বার) | "নতুন ব্রিফিং" বাটন = `refresh=1` |

## ৮. ফাইল ম্যাপ

| ফাইল | দায়িত্ব |
|---|---|
| `src/lib/ai.ts` | Workers AI REST ক্লায়েন্ট + স্টোর-কনটেক্সট বিল্ডার (সার্ভার-অনলি) |
| `src/lib/chatClient.ts` | ব্রাউজার-সাইড SSE স্ট্রিম পার্সার |
| `src/app/api/ai/route.ts` | সব AI অ্যাকশনের গেটওয়ে |
| `src/app/api/pos/sale/route.ts` | ইন-স্টোর POS সেল |
| `src/components/AdminAiFab.tsx` | FAB + কুইক শিট + সেল কনফার্মেশন পপআপ |
| `src/app/admin/assistant/page.tsx` | ফুল চ্যাট পেজ |
| `src/lib/store.ts` | `createPosSale`, `getDailyBrief`/`saveDailyBrief`, মূল ডেটা |
| `src/types/index.ts` | `AIDailyBrief`, `AIInsights`, `AISaleMatch`, `Order.source`, `ownerName` |

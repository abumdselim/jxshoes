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
| `AI_TEXT_MODEL` | `@cf/meta/llama-3.3-70b-instruct-fp8-fast` | প্রাইমারি — দ্রুত, সরাসরি কনটেন্ট, চমৎকার বাংলা (আসল টোকেনে ভেরিফাইড) |
| `AI_FALLBACK_MODEL` | `@cf/google/gemma-4-26b-a4b-it` | ফেলব্যাক — বাংলায় সেরা, কিন্তু রিজনিং মডেল (আগে "চিন্তা" করে, ধীর + বেশি টোকেন) |

- মডেল বদলাতে Cloudflare Pages প্রজেক্ট সেটিংসে env ভেরিয়েবল যোগ করলেই হবে (বিল্ড টাইমে `process.env` থেকে পড়ে)।
- **⚠️ রেসপন্স শেপ (২ অক্টোবর ২০২৬-এ লাইভ টোকেন দিয়ে ভেরিফাইড):** Workers AI নেটিভ এন্ডপয়েন্ট OpenAI-স্টাইল শেপ দেয় — `result.choices[0].message.content`; llama JSON আউটপুট হলে `result.response`-এ পার্সড অবজেক্টও দেয়। `extractResponseText()` দুটোই সামলায়। স্ট্রিমিং: `data: {choices:[{delta:{content}}]}` চাংক; Gemma-র `reasoning_content` চাংক ক্লায়েন্টে স্কিপ হয়।
- **JSON আউটপুট:** প্রম্পটে JSON চাওয়া হয় + `extractJson()` দিয়ে রোবাস্ট পার্সিং (কোড-ফেন্স/অতিরিক্ত লেখা সামলায়) — সব মডেলে কাজ করে।
- **স্ট্রিমিং:** `stream: true` → SSE সরাসরি ক্লায়েন্টে পাস-থ্রু হয়; `src/lib/chatClient.ts` `delta.content` পার্স করে।
- ফ্রি লিমিট: ১০,০০০ নিউরন/দিন; টেক্সট মডেল ৩০০ req/min। ভেরিফাইড খরচের উদাহরণ: ছোট প্রম্পট ~৬ নিউরন, ২০০-টোকেন উত্তর ~৩০ নিউরন।

## ২.৫ নির্ভুলতা-ইঞ্জিনিয়ারিং (২ অক্টোবর — হার্ডেনিং)

- **ট্রানজিয়েন্ট রিট্রাই:** ৪২৯/৫০০/৫০৩ এররে ৯০০ms ব্যাকঅফ দিয়ে একবার রিট্রাই → তারপর ফেলব্যাক মডেল
- **JSON অটো-রিপেয়ার:** `runAIJson` ভাঙা JSON পেলে কড়া নির্দেশসহ আরেকবার চেষ্টা করে (+৪০% টোকেন, তাপমাত্রা ≤০.১৫) — দুইবার চেষ্টার পরেও ব্যর্থ হলেই এরর
- **প্রতি-অ্যাকশন টিউনিং:** বাংলা আউটপুট কাটা পড়া বন্ধে max_tokens বাড়ানো (brief ২০০০, insights ৩২০০, chat ২২০০, report ৩৬০০, restock-plan ২৬০০); কাজভেদে তাপমাত্রা — সৃজনশীল ০.৭, বিশ্লেষণ ০.৩৫-০.৪৫, স্ট্রাকচার্ড-এক্সট্রাকশন ০.১৫-০.২
- **আর্থিক কনটেক্সট:** `buildStoreContext`-এ এখন মোট আয়/COGS/গ্রস-নেট প্রফিট/খরচ + মোট বাকি + যাদের বাকি আছে (টপ ৮, ফোনসহ) — অ্যাসিস্ট্যান্ট বাকি/লাভ প্রশ্নের নিখুঁত উত্তর দেয়
- **হেলথ চেক:** `GET /api/ai?action=health` — মডেল পিং + লেটেন্সি + JSON/বাংলা রাউন্ডট্রিপ যাচাই

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
| `parse-intent` | `{ message }` | `{ intent: 'sale'\|'restock'\|'new-product'\|'other', … }` | AI FAB — মেসেজ থেকে রিস্টক/নতুন পণ্য |
| `generate-report` | `{ reportType: 'weekly'\|'monthly' }` | `{ report: StoredReport }` | রিপোর্ট পেজ |
| `email-report` | `{ reportId, to? }` | `{ success, to }` | রিপোর্ট পেজ ইমেইল বাটন |
| `restock-plan` | — | `{ summary, plan: [{ productId, productName, recommendedQuantity, reason }] }` | ইনভেন্টরি লো-স্টক ট্যাব |
| `daily-brief-refresh` | — | `{ brief }` | ড্যাশবোর্ড "নতুন ব্রিফিং" |

**AI কনফিগার না থাকলে:** সব অ্যাকশন `503` + `{ error, configured: false }` — UI তে বন্ধুত্বপূর্ণ বাংলা নির্দেশনা দেখায়।

### রিপোর্ট-সংক্রান্ত অন্যান্য রাউট

| রাউট | কাজ |
|---|---|
| `GET /api/reports` | রিপোর্ট হিস্ট্রি (KV `jx_ai_reports`, শেষ ২৪টা) |
| `GET /api/cron/report?type=auto\|weekly\|monthly&send=1&to=…` | Cron Worker-এর এন্ডপয়েন্ট — হেডার `x-cron-secret: <CRON_SECRET>` লাগবে; `type=auto` হলে মাসের ১ তারিখে মাসিক, সোমবারে সাপ্তাহিক, অন্য দিনে skip |
| `GET /api/finance` | P&L সামারি (`computeFinanceSummary`) |
| `GET/POST/DELETE /api/customers` (+`/payment`) | কাস্টমার লেজার ও বাকি আদায় |
| `GET/POST/DELETE /api/expenses` | খরচের খাতা |
| `POST /api/pos/sale` | ইন-স্টোর সেল (এখন বাকি/কাস্টমার সাপোর্টসহ) |

### রিপোর্ট সিস্টেমের নকশা (গুরুত্বপূর্ণ)

- **সংখ্যা AI-কে দিয়ে হিসাব করানো হয় না** — স্কোরকার্ড (মোট বিক্রি, গ্রস প্রফিট, গ্রোথ %) কোডে গণনা হয় (`src/lib/report.ts` → `gatherPeriodStats`)। AI শুধু বিশ্লেষণ ও পরামর্শ লেখে। এতে হিসাব নিখুঁত থাকে।
- লাভের হিসাব: প্রতিটা সেলের আইটেমে **ক্রয়মূল্যের স্ন্যাপশট** (`OrderItem.costPrice`) সেলের সময়েই সেভ হয়; পুরনো ডেটায় না থাকলে বর্তমান ক্রয়মূল্য → না মিললে ৬৫% অনুমান।
- ইমেইল HTML: `renderReportEmailHtml()` — inline CSS (ইমেইল ক্লায়েন্ট সেফ), `html` + `text` দুই ভার্সনই যায় (ডেলিভারেবিলিটির জন্য)।

### ইমেইল ডেলিভারি সেটআপ (Cloudflare Email Service REST)

```
POST https://api.cloudflare.com/client/v4/accounts/{id}/email/sending/send
Authorization: Bearer <API_TOKEN>
{ "to": "...", "from": { "address": "reports@yourdomain.com", "name": "..." },
  "subject": "...", "html": "...", "text": "..." }
```
⚠️ REST API-তে `from` অবজেক্টে **`address`** ব্যবহার হয় (`email` নয়), `reply_to` snake_case।

প্রয়োজন:
1. ডোমেইন Cloudflare-এ + `npx wrangler email sending enable yourdomain.com`
2. টোকেনে Email Sending পারমিশন
3. Pages env: `EMAIL_FROM_ADDRESS` (বাধ্যতামূলক), `EMAIL_FROM_NAME` (ঐচ্ছিক), `CRON_SECRET` (ক্রনের জন্য)

### অটো-রিপোর্ট (Cron Worker)

`workers/report-cron/` — ছোট Worker, ক্রন ট্রিগার: `0 2 * * 1` (সোমবার ০২:০০ UTC = বাংলাদেশ সকাল ৮টা, সাপ্তাহিক) ও `0 2 1 * *` (মাসের ১ তারিখ, মাসিক)। মূল অ্যাপের `/api/cron/report` কল করে — সব AI/ইমেইল লজিক এক জায়গায় থাকে। সেটআপ: `workers/report-cron/README.md`।

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

### `parse-intent` — মেসেজ থেকে রিস্টক ও নতুন পণ্য (FAB)

দোকানদার FAB-এ যা লিখবে AI ইচ্ছা বুঝে কাজ ভাগ করে:

| মেসেজ উদাহরণ | intent | ফলাফল |
|---|---|---|
| `JX-SH-001 42 2টি` | `sale` | সেল কনফার্মেশন পপআপ |
| `JX-BG-006 এ ৫ পিস স্টক এসেছে, কস্ট 1550` | `restock` | রিস্টক পপআপ → নিশ্চিত করলেই স্টক+চালান এন্ট্রি |
| `হাইকিং বুটের ১০ পিস রিস্টক করো` | `restock` | নাম দিয়ে ফাজি ম্যাচ (AI) |
| `নতুন প্রোডাক্ট যোগ: Bata Formal Shoe, দাম ৪২০০` | `new-product` | প্রি-ফিল করা প্রোডাক্ট ফর্ম → নিশ্চিত করলেই ইনভেন্টরিতে |
| অন্য প্রশ্ন | `other` | AI চ্যাটে উত্তর |

দুই স্তরের পার্সিং: **ডিটারমিনিস্টিক** (SKU + রিস্টক-শব্দ: স্টক/চালান/রিস্টক/পিস → AI খরচ শূন্য) → না মিললে **AI ক্লাসিফায়ার** (বাংলা সংখ্যা/কালার অনুবাদ, নাম-ম্যাচ, নতুন পণ্যের ফিল্ড এক্সট্রাকশন; নাম+দাম থাকলেই new-product, বাকি ডিফল্ট সিস্টেম বসায়)।

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

## ৭. ডেপ্লয় ও env (২ অক্টোবর ২০২৬-এ লাইভ কনফিগার্ড)

**env মেকানিজম:** `src/lib/generatedEnv.ts` (কমিটেড প্লেসহোল্ডার) — GitHub Actions বিল্ডের
"Generate runtime env" স্টেপ রিপো সিক্রেট দিয়ে এটা ওভাররাইট করে; ভ্যালুগুলো এজ বান্ডেলে
বেক হয় (শুধু সার্ভার-সাইড কোড, ব্রাউজারে যায় না)। লোকালে `.env` → `process.env` কাজ করে।
`src/lib/cfEnv.ts → getCfEnv()` সব কনজিউমারের একমাত্র প্রবেশদ্বার — নতুন env লাগলে
ওখানে ফিল্ড যোগ করো (workflow স্টেপেও)।

**⚠️ @cloudflare/next-on-pages ইমপোর্ট করা যাবে না:** ওটার টাইপ ডিক্লারেশন
workers-types গ্লোবালি লিক করে → পুরো অ্যাপে `Response.json()` unknown হয়ে যায়।

**লাইভ স্টেটাস (ভেরিফায়েড):**
- ✅ AI (daily brief, chat, parse-sale) প্রোডাকশনে চলছে
- ✅ KV read/write প্রোডাকশনে কাজ করছে (SKU সেলফ-হিলিং মাইগ্রেশন চালু)
- ✅ `/api/cron/report` সিক্রেটসহ কাজ করছে; Worker `jxshoes-report-cron` ডেপ্লয়েড
  (সোমবার + ১ তারিখ, BD সকাল ৮টা)
- ⬜ ইমেইল: ডোমেইন + `EMAIL_FROM_ADDRESS` বসালেই চালু (নিচের টেবিল দেখো)

### 🔑 প্রয়োজনীয় সিক্রেট/সেটআপ

| কোথায় | কী | অবস্থা |
|---|---|---|
| GitHub Secrets | `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_KV_ID`, `CRON_SECRET` | ✅ সেট |
| Pages env | একইগুলো (generatedEnv-এর বিকল্প হিসেবেও বসানো) | ✅ সেট |
| Worker `jxshoes-report-cron` | `CRON_SECRET` secret | ✅ সেট |
| ইমেইলের জন্য | ডোমেইন + `wrangler email sending enable` + টোকেনে Email Sending পারমিশন + `EMAIL_FROM_ADDRESS` | ⬜ বাকি |

### 💰 AI খরচ (লাইভ মাপা)
- ছোট প্রম্পট ~৬ নিউরন, ২০০-টোকেন বাংলা উত্তর ~৩০ নিউরন, স্টোর-কনটেক্সট চ্যাট ~৬০ নিউরন —
  ফ্রি ১০,০০০ নিউরন/দিনে দিনে শত শত কল করা যায়।

## ৮. ট্রাবলশুটিং

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

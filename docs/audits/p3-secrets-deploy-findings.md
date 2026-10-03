# P3 অডিট — সিক্রেট-ফ্লো ও ডেপ্লয় ফাইন্ডিংস

- **তারিখ:** ২০২৬-১০-০৩
- **ধরন:** রিড-ওনলি অডিট (কোনো কোড বদলানো হয়নি)
- **সম্পর্কিত ডক:** `docs/adr/001-hosting-adapter.md`
- **নোট:** এই ডকে কোনো সিক্রেটের আসল মান নেই — শুধু ভেরিয়েবলের নাম ও যেখানে ইনজেক্ট হয়।

---

## ১. সিক্রেট-ফ্লো ম্যাপ (Secrets → Deployed Bundle)

### ১.১ উৎস: GitHub Actions

`.github/workflows/deploy.yml` হলো রিপোর একমাত্র ওয়ার্কফ্লো। ফ্লো:

```
GitHub Secrets
  ├─ ADMIN_PASSWORD            ─┐
  ├─ CLOUDFLARE_API_TOKEN       │  deploy.yml:26-45 — "Generate runtime env"
  ├─ CLOUDFLARE_ACCOUNT_ID      │  স্টেপ heredoc দিয়ে লিখে দেয়:
  ├─ CLOUDFLARE_KV_ID           │  src/lib/generatedEnv.ts  (কমিটেড প্লেসহোল্ডার
  ├─ CRON_SECRET                │  ওভাররাইট করে — ফাইলটা .gitignore-ড বিল্ড আর্টিফ্যাক্ট)
  └─ GEMINI_API_KEY            ─┘
        │
        ▼
deploy.yml:53 — npx @cloudflare/next-on-pages
  → generatedEnv.ts কম্পাইল হয়ে এজ বান্ডেলের কম্পাইল-টাইম কনস্ট্যান্ট
        │
        ▼
deploy.yml:55-60 — wrangler-action pages deploy (এখানকার CLOUDFLARE_API_TOKEN
  শুধু ডেপ্লয়-টাইমে ব্যবহৃত হয় — বান্ডেলে যায় না, কিন্তু ২৯/৪০ লাইনের
  generatedEnv-এ একই টোকেন বেক হয়ে যায়)
```

**হেরেডক ঝুঁকি (deploy.yml:35):** `cat > src/lib/generatedEnv.ts <<EOF` — `EOF` **আনকোটেড**, অর্থাৎ সিক্রেটের মানে `$`, ব্যাকটিক বা `\` থাকলে শেল এক্সপানশনে মান ভেঙে যায় বা অন্য ভ্যালু ইনজেক্ট হয়। বর্তমান সিক্রেটগুলোতে সমস্যা হচ্ছে না (ডেপ্লয় কাজ করছে), কিন্তু ভবিষ্যতের যেকোনো সিক্রেটে বিশেষ-অক্ষর থাকলে সাইলেন্ট করাপশন হবে।

### ১.২ বান্ডেলে প্রবেশপথ: `GENERATED_ENV` কনজিউমার

`src/lib/generatedEnv.ts` (কমিটেড প্লেসহোল্ডার, সব ভ্যালু `''`) — CI-তে রিয়েল ভ্যালু দিয়ে ওভাররাইট হয়। ইমপোর্টার:

| ফাইল | লাইন | কোন সিক্রেট | কী কাজে |
|---|---|---|---|
| `src/middleware.ts` | 2, 13 | `ADMIN_PASSWORD` | `/admin/*` গেট — কুকি `sk_admin` = SHA-256(পাসওয়ার্ড) মিলিয়ে |
| `src/app/api/admin-login/route.ts` | 2, 16 | `ADMIN_PASSWORD` | সাপ্লাই-করা পাসওয়ার্ড **প্লেইনটেক্সটে তুলনা** (লাইন 31), কুকিতে আনসল্টেড SHA-256 (লাইন 36) |
| `src/lib/adminAuth.ts` | 7, 19 | `ADMIN_PASSWORD` | API রাউটগুলোর কুকি-যাচাই |
| `src/lib/cfEnv.ts` | 14, 35-50 | সবগুলো | একক-প্রবেশদ্বার `getCfEnv()` — `GENERATED_ENV` আগে, `process.env` ফলব্যাক |

`getCfEnv()` থেকে নিচের লাইব্রেরিগুলো সিক্রেট পায়: `src/lib/store.ts` (KV), `src/lib/ai.ts` (Workers AI + Gemini), `src/lib/email.ts`, `src/app/api/upload/route.ts`, `src/app/api/media/[file]/route.ts`, `src/app/api/cron/report/route.ts`।

**ব্যতিক্রম:** `src/app/api/cron/watch/route.ts:18` সরাসরি `process.env.CRON_SECRET` পড়ে — `getCfEnv()` দিয়ে নয়। ফলে এই রাউট কেবল **Pages ড্যাশবোর্ডে সেট করা** env-এর উপর নির্ভর করে, baked বান্ডেলের উপর নয় (`docs/AI_SYSTEM.md` §7 অনুযায়ী Pages env-এ সেট করা আছে বলেই এখন চলছে)। অসামঞ্জস্যপূর্ণ — রোটেশন চেকলিস্টে উভয় জায়গা আপডেট করতে হবে।

### ১.৩ ক্লায়েন্ট বান্ডেলে লিক হয় কি? — **যাচাইকৃত: না**

- ইমপোর্ট-স্ক্যান: `GENERATED_ENV`/`cfEnv`/`store`/`ai`/`email`/`adminAuth` ইমপোর্ট করা ফাইলগুলোর কোনোটাতেই `"use client"` নেই — সবই edge API route, middleware বা server lib।
- লোকাল `.next` বিল্ডে যাচাই: `.next/static/**` (ক্লায়েন্ট চাংক) গুগল করলে `GENERATED_ENV`, `CLOUDFLARE_API_TOKEN`, `ADMIN_PASSWORD`, `CRON_SECRET`, `GEMINI_API_KEY` — **শূন্য হিট**; আর `.next/server/**`-এ `GENERATED_ENV` API-route ও middleware বান্ডেলেই সীমাবদ্ধ।
- **সতর্কতা:** এই যাচাই প্লেসহোল্ডার-ভ্যালু দিয়ে হয়েছে, তবে মেকানিজম-লেভেলে সিদ্ধান্ত সঠিক — সিক্রেট থাকুক বা না থাকুক, কোনো ক্লায়েন্ট কম্পোনেন্ট এসব মডিউল ইমপোর্ট করে না, তাই প্রোডাকশন বান্ডেলেও ক্লায়েন্ট JS-এ যাবে না।
- তবে সিক্রেটগুলো **সার্ভার/এজ বান্ডেলে কম্পাইল-টাইম কনস্ট্যান্ট** — এটাই ডিজাইন (AI_SYSTEM.md §7)। Pages-এ deployed worker bundle পাবলিকলি ডাউনলোডযোগ্য নয়, কিন্তু "বান্ডেলে সিক্রেট বেক করা" অবস্থান থেকে ঝুঁকির মাত্রা বেশি — বিশেষত টোকেনটা ফুল-পারমিশন হলে (নিচে §২.৩)।

### ১.৪ অন্যান্য এক্সপোজার পৃষ্ঠ

- **লোকাল `.env`** (রিপো রুটে, `.gitignore`-ড) — রিয়েল ভ্যালু ধারণ করে; মেশিন-কম্প্রোমাইজ = সিক্রেট-কম্প্রোমাইজ। (মান এই অডিটে দেখা/প্রিন্ট করা হয়নি।)
- **GitHub Actions লগ:** বর্তমান স্টেপগুলো ফাইল প্রিন্ট করে না, কিন্তু ভবিষ্যতে কেউ `cat src/lib/generatedEnv.ts` বা `set -x` যোগ করলে সব সিক্রেট লগে যাবে (Actions লগ রিপো-কোলাবরেটর পড়তে পারে)।
- **শেল ইনজেকশন:** §১.১-এর আনকোটেড heredoc — সিক্রেট-মানে কমান্ড সাবস্টিটিউশন সম্ভব (GitHub secret-এ যা বসানো হয় তা CI-রunner-এ এক্সিকিউট-সদৃশ প্রভাব ফেলতে পারে)।

---

## ২. রানটাইম Cloudflare REST-টোকেন ইনভেন্টরি (api.cloudflare.com)

সব কল **একটাই টোকেন** ব্যবহার করে: `CLOUDFLARE_API_TOKEN` (`getCfEnv().apiToken` → `src/lib/cfEnv.ts:38`), উৎস: baked `GENERATED_ENV` (CI) বা `process.env` (লোকাল)। README.md:70 অনুযায়ী টোকেনে দরকার: **Pages: Edit, KV: Edit, Workers AI: Write, R2: Edit, Email: Send**।

### ২.১ কল-সাইট তালিকা (৮টি ফাংশনাল গ্রুপ)

| # | কাজ | এন্ডপয়েন্ট | ফাইল:লাইন |
|---|---|---|---|
| 1 | KV read/write — মূল স্টোর স্টেট (`jx_store_state`) | `/accounts/{id}/storage/kv/namespaces/{ns}/values/{key}` | `src/lib/store.ts:47, 100-105 (GET), 143-150 (PUT)` |
| 2 | KV — AI রিপোর্ট হিস্ট্রি (`jx_ai_reports`) | একই | `src/lib/store.ts:952 (GET), 974 (PUT)` |
| 3 | KV — ডেইলি ব্রিফ ক্যাশ (`jx_ai_daily_brief`) | একই | `src/lib/store.ts:1001, 1025, 1043, 1062, 1081, 1105` |
| 4 | KV — নোটিফিকেশন (`jx_ntf_*`: get/put/delete/list-keys) | values + `keys?prefix=` | `src/lib/store.ts:1134, 1143, 1172, 1227, 1237, 1252, 1276` |
| 5 | Workers AI run (টেক্সট + স্ট্রিমিং SSE) | `/accounts/{id}/ai/run/{model}` | `src/lib/ai.ts:49, 97 (Bearer), 147 (Bearer)` |
| 6 | Email Service পাঠানো | `/accounts/{id}/email/sending/send` | `src/lib/email.ts:44, 48 (Bearer)` |
| 7 | R2 PUT — আপলোড | `/accounts/{id}/r2/buckets/{bucket}/objects/{key}` | `src/app/api/upload/route.ts:23, 27 (Bearer)` |
| 8 | R2 GET — মিডিয়া প্রক্সি | একই | `src/app/api/media/[file]/route.ts:34-35 (Bearer)` |

পরোক্ষ ব্যবহারকারী (store.ts-এর মাধ্যমে): `/api/products`, `/api/orders`, `/api/sync`, `/api/notifications`, `/api/media-library`, `/api/settings`, `/api/finance`, cron রাউট ইত্যাদি — সবই উপরের 1–4 নম্বর কলের উপর দাঁড়িয়ে।

**Gemini:** `GEMINI_API_KEY` আলাদা প্রোভাইডার — `src/lib/ai.ts:394` হেডার `x-goog-api-key` দিয়ে `generativelanguage.googleapis.com` কল করে (ভয়েস ট্রান্সক্রিপশন)। টোকেনটাও baked (`deploy.yml:33,43`)।

### ২.২ ROADMAP-এর "ফুল-পারমিশন টোকেন" স্টেটমেন্ট

`docs/ROADMAP.md:104`:

> 1. ~~Workers AI Write পারমিশন~~ ✅ সম্পন্ন (২ অক্টোবর — ফুল-পারমিশন টোকেন সব জায়গায় বসানো)

অর্থাৎ সব কাজের (Pages ডেপ্লয় + KV + R2 + AI + Email) জন্য **একটাই অতি-অনুমতিসম্পন্ন টোকেন** ইচ্ছাকৃতভাবে বসানো — এবং সেটাই বান্ডেলে বেক হয়। এটাই এই অডিটের কেন্দ্রীয় ঝুঁকি।

### ২.৩ ঝুঁকি-রেটিং

| ঝুঁকি | মাত্রা | ব্যাখ্যা |
|---|---|---|
| ফুল-পারমিশন `CLOUDFLARE_API_TOKEN` এজ বান্ডেলে বেকড | **High** | টোকেন ফাঁস হলে (যেকোনো চ্যানেলে) পুরো অ্যাকাউন্টে KV/R2/AI/Pages কন্ট্রোল; least-privilege নেই |
| `ADMIN_PASSWORD` প্লেইনটেক্সট তুলনা + আনসল্টেড SHA-256 কুকি | Medium-High | বান্ডেল পড়লে পাসওয়ার্ড ও কুকি-হ্যাশ দুটোই গণনাযোগ্য; P6 অথ-ওয়ার্কের বিষয় (PBKDF2 সীমাবদ্ধতা দেখুন §৫) |
| cron secret URL query-ফলব্যাক (`?secret=`) | Medium | `src/app/api/cron/report/route.ts:27` ও `cron/watch/route.ts:19` — কোয়েরি-স্ট্রিং লগ/রেফারারে লিকের প্রবণতা; হেডার-অনলি করাই ভালো |
| আনকোটেড heredoc (শেল এক্সপানশন) | Medium | deploy.yml:35 — সাইলেন্ট করাপশন/ইনজেকশন ঝুঁকি |
| `CLOUDFLARE_ACCOUNT_ID`/`CLOUDFLARE_KV_ID` baked | Low | অ্যাকাউন্ট/নেমস্পেস আইডি নিজে সিক্রেট নয়, কিন্তু টোকেন-ফাঁসের সাথে মিলে টার্গেটিং সহজ করে |
| cron/watch `process.env.CRON_SECRET` অসামঞ্জস্য | Low | §১.২ — রোটেশনে মিস হওয়ার প্রবণতা |
| `GEMINI_API_KEY` baked (সার্ভার-অনলি ব্যবহার) | Low | ব্যবহার শুধু `ai.ts:394` সার্ভার-সাইডে; তবু বান্ডেলে বেক অপ্রয়োজনীয় এক্সপোজার |

---

## ৩. বাইন্ডিং-মাইগ্রেশন ক্যান্ডিডেট (REST → native binding)

next-on-pages ডেপ্লয়েও Pages প্রজেক্ট সেটিংসে বাইন্ডিং কনফিগার করে `@cloudflare/next-on-pages`-এর `getCloudflareContext().env` দিয়ে সেগুলো অ্যাক্সেস করা যায় — তাই অ্যাডাপ্টার বদলানো ছাড়াই এই মাইগ্রেশন সম্ভব (OpenNext Workers-এও একই বাইন্ডিং কাজ করবে — দেখুন ADR ০০১)।

| বর্তমান (REST + টোকেন) | বাইন্ডিং ক্যান্ডিডেট | প্রভাবিত সাইট | সামঞ্জস্য |
|---|---|---|---|
| KV REST (টেবিলের 1–4) | **KV binding** — `env.KV.get/put/list/delete` | store.ts-এর সব KV হেল্পার | সরাসরি ১:১; key-value API একই |
| R2 PUT/GET (7–8) | **R2 binding** — `env.R2.put/get`; সার্ভিংয়ের জন্য public bucket/custom domain বা বাইন্ডিং-প্রক্সি | upload route, media proxy | REST-শেপ থেকে ভিন্ন (রেসপন্স `Body` অবজেক্ট), ছোট রিফ্যাক্টর |
| Workers AI REST (5) | **AI binding** — `env.AI.run(model, input)` | ai.ts `callModel`/`runAIStream` | স্ট্রিমিং `AIStream` রিটার্ন করে — SSE পাস-থ্রু মানিয়ে নিতে হবে |
| Email REST (6) | **আংশিক** — Workers-এর `send_email` binding আছে, তবে verified-destination/রুটিং সীমাবদ্ধতা; বর্তমান REST (`email/sending/send`) ফিচার-সমৃদ্ধ | email.ts | আপাতত REST-ই রাখা যুক্তিযুক্ত |
| Gemini (§২.১ শেষ) | বাইন্ডিং নেই — থাকবে secret/binding হিসেবে | ai.ts:394 | Workers Secrets / Pages env-এ রাখা বাধ্যতামূলক (বান্ডেলে বেক নয়) |

বাইন্ডিং-এ গেলে `CLOUDFLARE_API_TOKEN`-এর রানটাইম প্রয়োজন প্রায় শূন্য হয় — টোকেনটা তখন শুধু CI ডেপ্লয়ের জন্য (Pages: Edit) দরকার, এবং **বান্ডেলে বেক করার কোনো কারণই থাকে না**। `ADMIN_PASSWORD`/`CRON_SECRET`/`GEMINI_API_KEY` তখন Pages env (secret type) হিসেবে সার্ভারে ইনজেক্ট হবে — বান্ডেলে নয়।

---

## ৪. টোকেন রোটেশন চেকলিস্ট (মালিক ম্যানুয়ালি চালাবেন)

> ক্রম গুরুত্বপূর্ণ: প্রতিটা ধাপে "পুরনোটা সরানোর আগে নতুনটা কাজ করছে" যাচাই করা হয়, যাতে ডাউনটাইম না হয়। কোনো কোড-পরিবর্তন লাগবে না — সবই ড্যাশবোর্ড/সিক্রেট আপডেট।

### ধাপ ০ — প্রস্তুতি
1. Cloudflare অডিট লগ দেখুন (Manage Account → Audit Log): পুরনো টোকেনে অপরিচিত IP/অস্বাভাবিক কল ছিল কি না। থাকলে রোটেশনের পাশাপাশি অ্যাকাউন্ট-সিকিউরিটি (পাসওয়ার্ড/2FA) ঝালাই করুন।
2. বর্তমান টোকেনের নাম/পারমিশন নোট করে রাখুন (My Profile → API Tokens)।

### ধাপ ১ — নতুন Cloudflare API টোকেন (least-privilege)
3. dash.cloudflare.com → উপরের-ডান প্রোফাইল আইকন → **API Tokens** → Create Token → **Custom token**।
4. পারমিশন (বর্তমান আর্কিটেকচারে যা দরকার — README.md:70 অনুযায়ী): `Account → Cloudflare Pages → Edit`, `Account → Workers KV Storage → Edit`, `Account → Workers R2 Storage → Edit`, `Account → Workers AI → Edit/Write`, `Account → Email Sending Addresses → Edit` (ইমেইল ব্যবহার হলে)। **Account Resources:** এই অ্যাকাউন্টে সীমাবদ্ধ। Zone পারমিশন দিন না (দরকার নেই)।
   - আদর্শ: রানটাইম-বাইন্ডিং মাইগ্রেশন (§৩) করলে টোকেনে শুধু `Pages → Edit` রাখলেই চলবে।
5. টোকেন তৈরির পর দেখানো মান একবারই কপি করুন — কোথাও ফাইলে রাখবেন না; সরাসরি GitHub secret-এ বসান।

### ধাপ ২ — রিপো/CI আপডেট
6. GitHub রিপো → **Settings → Secrets and variables → Actions** → `CLOUDFLARE_API_TOKEN` **Update** করে নতুন মান বসান। (অন্য secret-এর মান বদলাতে হবে না এই ধাপে।)
7. GitHub → Actions → **Deploy Shopkeeper to Cloudflare Pages** → **Run workflow** (workflow_dispatch) — নতুন টোকেনে ডেপ্লয় সফল হয় কি না দেখুন।
8. লাইভ সাইটে স্মোক-টেস্ট: অ্যাডমিন লগইন, প্রোডাক্ট সেভ (KV), ছবি আপলোড (R2), AI চ্যাট (Workers AI)।

### ধাপ ৩ — পুরনো টোকেন রিভোক
9. ২৪ ঘণ্টা সফল রান পর্যবেক্ষণের পর: API Tokens পেজে পুরনো টোকেন **Roll** নয়, **Delete/Revoke** করুন (Roll করলে মান বদলায় কিন্তু নীতি একই থাকে — পুরো বাতিলই লক্ষ্য)।
10. রিভোকের পর আবার স্মোক-টেস্ট — কিছু ভাঙলে মানে কোথাও পুরনো টোকেন hardcoded/baked ছিল (generatedEnv নতুন ডেপ্লয়ে রিজেনারেট হয়েছে কি না নিশ্চিত করুন)।

### ধাপ ৪ — বাকি সিক্রেট রোটেশন (একই সেশনে)
11. **ADMIN_PASSWORD:** নতুন শক্তিশালী পাসওয়ার্ড তৈরি করে (a) GitHub secret `ADMIN_PASSWORD` আপডেট, (b) Cloudflare Pages প্রজেক্ট সেটিংসে বসানো থাকলে সেখানেও আপডেট, তারপর রিডিপ্লয়। নোট: কুকি `sk_admin` = SHA-256(পুরনো পাসওয়ার্ড) — পাসওয়ার্ড বদলালেই পুরনো সেশন অটো-বাতিল হয়ে যাবে।
12. **CRON_SECRET:** তিন জায়গায় একসাথে আপডেট করতে হবে — (a) GitHub secret, (b) Pages ড্যাশবোর্ড env (কারণ `cron/watch` রাউট `process.env.CRON_SECRET` পড়ে — `src/app/api/cron/watch/route.ts:18`), (c) Worker `jxshoes-report-cron`-এর secret: `workers/report-cron` ডিরেক্টরি থেকে `npx wrangler secret put CRON_SECRET`। পরে সোমবার/১ তারিখের অপেক্ষা না করে ম্যানুয়ালি ভেরিফাই করুন: `curl -H "x-cron-secret: <নতুন>" https://shopkeeperbd.pages.dev/api/cron/report?type=weekly&send=0` (২০০ আসা উচিত; পুরনো সিক্রেটে ৪০১ আসা উচিত)।
13. **GEMINI_API_KEY:** Google AI Studio → API keys → পুরনোটা রিভোক করে নতুন তৈরি করুন (বা বিদ্যমান key রিস্ট্রিক্ট করুন) → GitHub secret আপডেট → রিডিপ্লয় → ভয়েস-ইনপুট টেস্ট।

### ধাপ ৫ — পুনরাবৃত্তি-প্রতিরোধ
14. রোটেশন শেষে আদর্শ টার্গেট-স্টেট মনে রাখুন: **রানটাইমে কোনো কম্পাইল-টাইম সিক্রেট নেই** — KV/R2/AI বাইন্ডিং, বাকি সিক্রেট Pages/Workers secret, টোকেন শুধু CI-তে। পথ: ADR ০০১ ধাপ ১।
15. পরবর্তী রোটেশন ক্যালেন্ডারে রাখুন (যেমন প্রতি ৯০ দিনে), এবং deploy.yml-এর heredoc ফিক্স (কোটেড delimiter) ও cron/watch-এর `getCfEnv()` ব্যবহার — পরের কোড-সেশনের টুডু হিসেবে চিহ্নিত রাখুন।

---

## ৫. P6 প্রিভিউ — এজে পাসওয়ার্ড-হ্যাশিং সীমাবদ্ধতা (ভবিষ্যৎ অথ-ওয়ার্কের জন্য)

- Workers **Free plan: HTTP রিকোয়েস্ট প্রতি 10 ms CPU**, Paid plan: 30 s ডিফল্ট (5 min পর্যন্ত কনফিগারযোগ্য); নেটওয়ার্ক-অপেক্ষা (fetch/KV) CPU-তে গোনা হয় না — সোর্স: Cloudflare Workers limits (নিচে §৬)।
- অথচ OWASP সুপারিশ **PBKDF2-HMAC-SHA256 ≈ 6,00,000 iterations** — এটা 10 ms ফ্রি-সীমা ছাড়িয়ে যায়; কমিউনিটি/থার্ড-পার্টি মাপকাঠিতে সিকিউর ইটারেশন ~100 ms CPU খায়। ফলে ফ্রি টিয়ারে edge-এ সিকিউর PBKDF2 অবাস্তব; বিকল্প: Paid plan, অথবা হ্যাশিং বাইরে (যেমন ডেডিকেটেড সার্ভিস), অথবা ডিজাইন-লেভেলে প্রুফ-অব-পজিশন এড়ানো।
- বর্তমান কোডে যা আছে সেটা সমস্যার বাইরে নয় কিন্তু ভিন্ন: `ADMIN_PASSWORD` **সরাসরি তুলনা** (`admin-login/route.ts:31`) ও **আনসল্টেড SHA-256** কুকি (`middleware.ts:18`, `adminAuth.ts:25`) — কোনো PBKDF2 নেই। P6-এ মাল্টি-ইউজার অথ আনলে: হ্যাশ-ভেরিফিকেশন কোথায় হবে (edge CPU vs D1/DO) আগে সিদ্ধান্ত নিতে হবে।

---

## ৬. রেফারেন্স (সব অ্যাক্সেস: ২০২৬-১০-০৩)

1. next-on-pages ডেপ্রিকেশন/আর্কাইভ (২ অক্টোবর ২০২৬): https://github.com/cloudflare/next-on-pages
2. Cloudflare Workers docs — Next.js ফ্রেমওয়ার্ক গাইড (vinext সুপারিশ): https://developers.cloudflare.com/workers/framework-guides/web-apps/nextjs/
3. OpenNext Cloudflare Adapters (সাপোর্টেড Next.js ভার্সন/ফিচার): https://opennext.js.org/cloudflare
4. Cloudflare Workers AI pricing (ফ্রি ১০,০০০ নিউরন/দিন; Paid $0.011/১,০০০ নিউরন): https://developers.cloudflare.com/workers-ai/platform/pricing/
5. Cloudflare Workers limits (Free 10 ms / Paid 30 s CPU; startup 1 s): https://developers.cloudflare.com/workers/platform/limits/
6. PBKDF2 ও Workers CPU — কমিউনিটি আলোচনা: https://community.cloudflare.com/t/long-running-webcrypto-api/90953 ; প্র্যাকটিক্যাল লেখা: https://lord.technology/2024/02/21/hashing-passwords-on-cloudflare-workers.html ; OWASP-ইটারেশন সংখ্যাসহ: https://flaviocopes.com/native-email-password-authentication-cloudflare-workers/

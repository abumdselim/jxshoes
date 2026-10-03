# P2 — টেস্ট সেফটি-নেট প্ল্যান (JxShoes)

> তারিখ: 2026-10-03 • স্কোপ: পুরো রিপোরেটরি (in-flight offline-sync কাজসহ, কারেন্ট কোড হিসেবে পড়া হয়েছে)
> স্ট্যাটাস: **প্ল্যান — মালিকের অনুমোদনের অপেক্ষায়। এই ডকুমেন্টে কোনো টুলিং ইনস্টল/সেটআপ করা হয়নি; সব কনফিগ শুধু ড্রাফট হিসেবে এখানে আছে।**

---

## ১. বর্তমান অবস্থা (Current-State Findings)

সৎ ফাইন্ডিং — নিচের প্রতিটি লাইন আসল সার্চ করে যাচাই করা:

| খোঁজা জিনিস | ফলাফল |
|---|---|
| `*.test.*` / `*.spec.*` ফাইল | **একটিও নেই** (node_modules বাদে পুরো রিপোতে) |
| `vitest.config.*` / `jest.config.*` / `playwright.config.*` | **নেই** |
| `package.json`-এ টেস্ট স্ক্রিপ্ট/ডিপেন্ডেন্সি | **নেই** — শুধু `dev/build/start/lint`; devDependencies-এ টেস্ট টুল নেই |
| `.github/workflows/*` | **শুধু `deploy.yml`** (নিচে বিস্তারিত) |
| `deploy.yml`-এ কী চলে | `npm ci || npm install --legacy-peer-deps` → `generatedEnv.ts` জেনারেট → `npx @cloudflare/next-on-pages` (বিল্ড) → `wrangler pages deploy`। **কোনো `tsc`, `lint`, `test` ধাপ নেই** — অর্থাৎ টাইপ-এরর বা ভাঙা বিল্ড থাকলেও সরাসরি প্রোডাকশনে ডিপ্লয় হয়ে যেতে পারে (next-on-pages বিল্ড ফেল করলে তবেই আটকায়)। |
| `npm run lint` কখনো CI-তে চলে? | **না** — স্ক্রিপ্ট আছে (`.eslintrc.json` extends `next/core-web-vitals`), কিন্তু কোথাও ইনভোক হয় না। |
| tsconfig | `strict: true` — ভালো ভিত; `tsc --noEmit` CI গেটের জন্য রেডি (লোকালে `tsconfig.tsbuildinfo` দেখা যাচ্ছে, মানে ডেভ incremental check চালানো হয়)। |

**উপসংহার:** টেস্ট কাভারেজ ০%, CI গেট ০%। ফাইন্যান্স/কম্পিউট লজিক, POS, অফলাইন সিঙ্ক — সবই শুধু ম্যানুয়াল টেস্টে নির্ভরশীল। সাথে সাথে offline-sync ওয়ার্কস্ট্রিমের বড় অবমডিফাইড চেঞ্জ (`src/lib/offline/` ~1,279 লাইন, `src/app/api/sync/`) রিগ্রেশন-ঝুঁকি বাড়িয়েছে।

সুখবর: কোডবেসে ইতিমধ্যেই **পিওর ফাংশনের ভালো শিকার** আছে — `src/lib/compute.ts` পুরোপুরি I/O-মুক্ত (হেডার কমেন্টে নিজেই দাবি করা), আর `offline/appliers.ts`-এ `store.ts`-এর সার্ভার লজিকের মিরর-কপি আছে। টেস্ট লেখার আগে বড় রিফ্যাক্টর লাগবে না — বেশিরভাগ ইউনিট এখনই বা ন্যূনতম extraction-এ টেস্টেবল।

---

## ২. ইউনিট ইনভেন্টরি (Unit Inventory)

প্রায়োরিটি: **P1** = প্রথম ধাপে টেস্ট (টাকা-হিসাব/ডেটা-নাশ ঝুঁকি), **P2** = দ্বিতীয় ধাপ, **P3** = পরে।
"Pure?" = KV/fetch/IndexedDB/DOM ছাড়া চলে কি না। `new Date()`/`Date.now()` ব্যবহারকারী ফাংশন pure হলেও টেস্টে `vi.setSystemTime()` লাগবে — সেটা আলাদা কলামে নয়, নোটে ধরা।

### ২.১ ফাইন্যান্স ও রিপোর্ট কম্পিউট

| ইউনিট | file:line | Pure? | Extraction দরকার? | প্রায়োরিটি |
|---|---|---|---|---|
| `computeFinanceSummaryFromData(data)` — রেভিনিউ/COGS/গ্রস-নিট প্রফিট/বাকি/আজ-৭দ-৩০দ | `src/lib/compute.ts:15` | ✅ পিওর (শুধু `new Date()`) | না — সরাসরি টেস্ট | **P1** |
| `computeInventorySummary(products)` — স্টক ভ্যালু, low/out-of-stock | `src/lib/compute.ts:155` | ✅ পিওর | না | **P1** |
| `computeSalesForecast(data)` — WoW ট্রেন্ড, ১৪-দিন সিরিজ | `src/lib/compute.ts:197` | ✅ পিওর (time-dependent) | না — fake timers | **P1** |
| `computeDaysOfCover(data)` — velocity, days-of-cover, verdict | `src/lib/compute.ts:250` | ✅ পিওর (time-dependent) | না — fake timers | P2 |
| `getFastMoversFromData(data)` — ভেলোসিটি র‍্যাংকিং | `src/lib/compute.ts:105` | ✅ পিওর (`Date.now()`) | না — fake timers | P2 |
| `deductStockForOrder(data, items, ...)` — ভ্যারিয়েন্ট/মূল স্টক কাটা + `SALE` movement (অফলাইন মিরর) | `src/lib/compute.ts:291` | ✅ পিওর, কিন্তু `data` **in-place mutate** করে + `Math.random()` আইডি | না; টেস্টে mutate যাচাই করতে হবে | **P1** |
| `gatherPeriodStats(type)` — সাপ্তাহিক/মাসিক অ্যাগ্রিগেশন (প্রাইভেট) | `src/lib/report.ts:45` | ❌ `getOrders()/getProducts()/computeFinanceSummary()` KV-এনট্যাগলড | **হ্যাঁ (ছোট):** ফাংশনে `data: FullStoreData` প্যারামিটার নিয়ে ওভারলোড করা, বা `computeFinanceSummaryFromData(data)`-এ সুইচ — আচরণ অপরিবর্তিত | **P1** |
| `renderReportEmailHtml(report, storeName)` — HTML রেন্ডার + escape | `src/lib/report.ts:244` | ✅ পিওর | না | P3 |

### ২.২ POS, অর্ডার ও কাস্টমার লেজার (store.ts — KV-এনট্যাগলড)

| ইউনিট | file:line | Pure? | Extraction দরকার? | প্রায়োরিটি |
|---|---|---|---|---|
| `validateCoupon(code, orderTotal)` | `src/lib/store.ts:642` | ❌ ভেতরে `getCoupons()` → `getStoreData()` → KV fetch | **হ্যাঁ (সর্বনিম্ন):** `validateCouponInData(coupons, code, orderTotal)` পিওর কোর + বর্তমান ফাংশন থিন র‍্যাপার | **P1** |
| `createPosSale(items, options)` — POS বিক্রি: ভ্যারিয়েন্ট রেজলভ, স্টক কাটা, paid/due হিসাব, কাস্টমার আপসার্ট, movement | `src/lib/store.ts:669` | ❌ `getStoreData()`+`saveStoreData()`+`addNotification()` | **হ্যাঁ:** কোর হিসাব (variant resolve → orderItems → subtotal → paid/due → stock delta → movement) আলাদা পিওর ফাংশনে; I/O র‍্যাপারে থাকবে | **P1** |
| `recordDuePayment(input)` — বাকি আদায়, লেজার কমানো | `src/lib/store.ts:862` | ❌ `getStoreData()`/`saveStoreData()` | **হ্যাঁ:** `applyDuePaymentInData(data, input)` পিওর কোর | **P1** |
| `upsertCustomerInData(data, info, purchaseAmount, dueDelta)` — ফোন-কি আপসার্ট | `src/lib/store.ts:379` | ✅ পিওর কিন্তু **private** + in-place mutate | শুধু `export` করলেই হবে | **P1** |
| `createOrder(orderData)` — অনলাইন অর্ডার: cost-price স্ন্যাপশট, স্টক কাটা, movement | `src/lib/store.ts:423` | ❌ KV + notification | **হ্যাঁ:** `createPosSale`-এর মতোই পিওর কোর extraction | P2 |
| `restockProduct(...)` / `adjustProductStock(...)` — ভ্যারিয়েন্টসহ স্টক ইন/অ্যাডজাস্ট | `src/lib/store.ts:278` / `:329` | ❌ KV | **হ্যাঁ:** `applyRestockInData(data, ...)` / `applyAdjustInData(data, ...)` পিওর কোর | P2 |
| `migrateStoreData(data)` — SKU/বারকোড সেলফ-হিলিং | `src/lib/store.ts:76` | ✅ পিওর, private | শুধু `export` | P3 |
| `computeFinanceSummary()` (async র‍্যাপার) | `src/lib/store.ts:938` | ❌ | না — এটা `computeFinanceSummaryFromData`-এর থিন র‍্যাপার; র‍্যাপার টেস্ট দরকার নেই | — |

### ২.৩ AI/ভয়েস হিউরিস্টিক্স

| ইউনিট | file:line | Pure? | Extraction দরকার? | প্রায়োরিটি |
|---|---|---|---|---|
| `bnToEnDigits(s)` — বাংলা সংখ্যা→ইংরেজি | `src/app/api/ai/route.ts:391` | ✅ পিওর, **private** | route থেকে `src/lib/saleMatch.ts`-এ সরিয়ে `export` | **P1** |
| `deterministicMatch(message, products)` — ASR/টেক্সট থেকে SKU/বারকোড/সাইজ/কালার/পরিমাণ ম্যাচ (voice→sale-এর কেন্দ্র) | `src/app/api/ai/route.ts:396` | ✅ পিওর, **private** | **হ্যাঁ:** `src/lib/saleMatch.ts`-এ সরিয়ে `export` — route-এ ইমপোর্ট থাকবে (আচরণ অপরিবর্তিত) | **P1** |
| `extractJson<T>(raw)` — কোড-ফেন্স/অতিরিক্ত লেখা সহ্য করে JSON পার্স | `src/lib/ai.ts:175` | ✅ পিওর, exported | না | **P1** |
| `extractResponseText(result)` — দুই রেসপন্স-শেপ (legacy/OpenAI-স্টাইল) | `src/lib/ai.ts:74` | ✅ পিওর, private | শুধু `export` | P2 |
| `toNum(v)` — বাংলা/স্ট্রিং সংখ্যা পার্স (AI টুল আর্গস) | `src/lib/aiTools.ts:44` | ✅ পিওর, private | শুধু `export` | P2 |
| `buildToolManual()` / `AGENT_TOOLS` | `src/lib/aiTools.ts:409` / `:65` | `run`-গুলো KV-এনট্যাগলড; ম্যানুয়াল বিল্ডার পিওর | টুল-প্রতি টেস্ট নয়; `buildToolManual` টেস্টেবল | P3 |
| `buildStoreContext(orderLimit)` — AI প্রম্পট কনটেক্সট | `src/lib/ai.ts:237` | ❌ `getStoreData()` শুধু একবার; বাকিটা পিওর string-বিল্ড | **হ্যাঁ (ছোট):** `buildStoreContextFromData(data, orderLimit)` পিওর কোর | P2 |
| `transcribeAudioGemini` / `runAI*` | `src/lib/ai.ts:382` ইত্যাদি | ❌ নেটওয়ার্ক | ইউনিট-টেস্ট নয় — ফেলব্যাক স্ট্র্যাটেজি mock-fetch দিয়ে P3-এ | P3 |

### ২.৪ অফলাইন সিঙ্ক (src/lib/offline/ — in-flight কোড)

| ইউনিট | file:line | Pure? | Extraction দরকার? | প্রায়োরিটি |
|---|---|---|---|---|
| `applyMutation(data, method, path, body)` — অফলাইন মিউটেশন মিররে প্রয়োগ (orders/pos/products/customers/expenses/inventory/coupons...) | `src/lib/offline/appliers.ts:98` | আধা-পিওর: `data` প্যারামিটারে কাজ করে, কিন্তু ভেতরে `loadMeta()/addLocalOrder()/addLocalNotification()` (IndexedDB) কল করে | **হ্যাঁ:** রুট-প্রতি রিডিউসার (`applyOrderMutation`, `applyPosSaleMutation`...) `(data, body) → {status, payload}` পিওর রাখা; side-caches কলারে | **P1** (POS/orders অংশ) |
| `upsertCustomer` (মিরর কপি) | `src/lib/offline/appliers.ts:62` | ✅ পিওর | না — তবে `store.ts:379`-এর হুবহু ডুপ্লিকেট; **drift ধরার টেস্ট** দরকার (দুটোতে একই ইনপুটে একই ফল) | **P1** |
| `findVariant(p, size, color, variantId)` | `src/lib/offline/appliers.ts:55` | ✅ পিওর, private | `export` | **P1** |
| `buildOfflineGet(mirror, path)` — অফলাইন GET রেসপন্স বিল্ডার | `src/lib/offline/appliers.ts:612` | আধা-পিওর (ভেতরে `getLocalOrders()`) | রুট-ম্যাপিং অংশ পিওর ফাংশনে | P2 |
| `buildProduct(data, product, id)` — অফলাইন প্রোডাক্ট নরমালাইজার | `src/lib/offline/appliers.ts:544` | ✅ পিওর | `export` | P2 |
| `apiFetch(path, init)` — কোয়ান্টাম সিদ্ধান্ত: সরাসরি/মিরর/কিউ | `src/lib/offline/apiFetch.ts:93` | ❌ `navigator.onLine`, fetch, IndexedDB, dynamic import | **হ্যাঁ:** সিদ্ধান্ত-টেবিল আলাদা পিওর ফাংশনে — `routeDecision(method, path) → 'direct' \| 'never-queue' \| 'local-then-queue'` (`/api/ai`, `/api/admin-login`, `/api/notifications` বর্তমান স্পেশাল-কেসসহ) | P2 |
| `opLabel(method, path, body)` | `src/lib/offline/apiFetch.ts:28` | ✅ পিওর, private | `export` | P3 |
| `syncNow(force)` / `runSyncRound` — Outbox FIFO রিপ্লে, 4xx→failed, 5xx→break | `src/lib/offline/sync.ts:73` / `:91` | ❌ IndexedDB + fetch + Web Locks + `navigator` | **হ্যাঁ:** রিপ্লে-লুপ পিওর কোরে — `replayOutbox(ops, fetcher, {deleteOp, markFailed})` ইনজেক্টেবল fetcher দিয়ে | **P1** |
| `scheduleSync` থ্রটল স্টেট | `src/lib/offline/sync.ts:54` | ❌ `window`/timer মডিউল-স্টেট | jsdom + fake timers দিয়ে টেস্ট | P3 |
| Outbox স্টোর (`outboxGetAll/Put/Delete`, `localId`) | `src/lib/offline/db.ts:79-124` | ❌ IndexedDB | fake-indexeddb দিয়ে P3 | P3 |
| `pullSnapshot` / `mergeLocalOrdersIntoMirror` | `src/lib/offline/snapshot.ts:157` / `:136` | ❌ fetch + IDB | কনফ্লিক্ট-রুল অংশ পিওর করে P3 | P3 |

### ২.৫ অথ, ইউটিল, অন্যান্য

| ইউনিট | file:line | Pure? | Extraction দরকার? | প্রায়োরিটি |
|---|---|---|---|---|
| `isAdminRequest(request)` — sk_admin কুকি = SHA-256(পাসওয়ার্ড); পাসওয়ার্ড না থাকলে `true` | `src/lib/adminAuth.ts:18` | আধা: `crypto.subtle` (Node 18+/Vitest `node` env-এ webcrypto আছে) + `GENERATED_ENV`/`process.env` | না — env স্টাব করে টেস্ট | **P1** |
| middleware-এর ডুপ্লিকেট `sha256` + কুকি চেক | `src/middleware.ts:6,12` | আধা | টেস্টে middleware handler ইনভোক করা যায়; দীর্ঘমেয়াদে `adminAuth` শেয়ার করা উচিত (drift ঝুঁকি) | P2 |
| `formatPrice/formatDate` | `src/lib/utils.ts:8,17` | ✅ (Intl — TZ/locale সংবেদনশীল) | না | P3 |
| sizes/colors কমা-পার্স (`'40, 41, 42'` → `['40','41','42']`, space-tolerant) | `src/app/admin/products/page.tsx:205-222`, `src/components/AdminAiFab.tsx:553-554`, `src/app/admin/assistant/page.tsx:241-242` | UI-র ভেতরে ইনলাইন | **হ্যাঁ:** `parseSizeList(s)` / `parseColorList(s)` ইউটিলে তুলে তিন জায়গা থেকে ব্যবহার — এখন তিন কপি, drift ঝুঁকি | P2 |
| `validateCoupon` রুট র‍্যাপার | `src/app/api/coupons/validate/route.ts:6` | ❌ | র‍্যাপার টেস্ট নয়; পিওর কোরই যথেষ্ট | — |

> **ডুপ্লিকেশন-ঝুঁকি নোট:** সার্ভার (`store.ts`) ও অফলাইন মিরর (`appliers.ts`) একই লজিকের **দুই কপি** রাখে (`upsertCustomer`/`upsertCustomerInData`, POS-sale স্টক হ্যান্ডলিং, order তৈরি)। `compute.ts`-এর হেডার-কমেন্টে বলা "দুই জায়গায় একই লজিক" প্যাটার্নটা বাকি জায়গায় কপি-পেস্টে হয়েছে। টেস্টের সবচেয়ে বড় ভ্যালু: **একই ইনপুটে দুই কপির আউটপুট তুলনা করা** (drift-detector test)।

---

## ৩. এজ-কেস ম্যাট্রিক্স (প্রতি ইউনিটে কী ঢাকতে হবে)

### ৩.১ `computeFinanceSummaryFromData` / `gatherPeriodStats`
- বাতিল (`Cancelled`) অর্ডার revenue/COGS/count-এ আসবে না।
- **মিসিং cost-price স্ন্যাপশট:** `it.costPrice === undefined` → প্রোডাক্ট পেলে `prod.costPrice`, না পেলে `Math.round(it.price * 0.65)` **৬৫% এস্টিমেট ফলব্যাক** — তিনটাই আলাদা টেস্ট। (প্রোডাক্ট পাওয়া গেলেও `prod.costPrice` যদি নিজেই undefined হয়? তখন `cost = undefined ?? fallback` → ফলব্যাক চলে — এই সাব-কেসও যাচাই করা দরকার।)
- সীমানা-দিন: আজ সকাল ০০:০০-এর ঠিক আগে/পরের অর্ডার, `last7`/`last30` বাউন্ডারি (`inRange` `>= from`), ভবিষ্যৎ-তারিখের অর্ডার।
- `totalDues` = সব কাস্টমারের `dueAmount` যোগফল (নেগেটিভ due ইনপুট দিলে কী হয় — বর্তমান আচরণ ডকুমেন্ট করা)।
- `operatingExpenses` **সব-সময়ের খরচ** — পিরিয়ড-ফিল্টার নেই (`report.ts`-এ আছে, `compute.ts`-এ নেই) — এই অসামঞ্জস্য characterization টেস্টে লক করা।
- `dailyRevenue`-এর `dayKey = toLocaleDateString('en-CA')` — **টাইমজোন-নির্ভর**; টেস্টে `TZ=UTC` ফিক্স + `vi.setSystemTime`।
- ফ্লোট: দশমিক দাম/পরিমাণে `revenue` রাউন্ড হয় না, `cogs/netProfit` রাউন্ড হয় (`Math.round`) — ৳1234.56 ধরনের ইনপুটে ভগ্নাংশ আচরণ লক করা।

### ৩.২ `createPosSale` (POS বিক্রি)
- **ভ্যারিয়েন্ট রেজলভ চেইন:** `variantId` দেওয়া → size+color ম্যাচ (stock>0) → যেকোনো stock>0 ভ্যারিয়েন্ট → `variants[0]` → ভ্যারিয়েন্টহীন প্রোডাক্ট। প্রতিটি স্তরের টেস্ট।
- **সাইজ/কালার স্ট্রিং-ম্যাচিং:** `size === '42'` ঠিক মেলে, কিন্তু `"42 "` (স্পেসসহ) বা `"৪২"` (বাংলা) এলে `variants.find(v => v.size === item.size)` **মিস-ম্যাচ** → ভুল ভ্যারিয়েন্ট/ফলব্যাক-স্তরে চলে যায়। কমা/স্পেস পার্সিং UI-স্তরে (`products/page.tsx:205`) হয় — POS-এ এলে ট্রিম হয় না। এজ-টেস্ট: স্পেসসহ সাইজ।
- **স্টক ওভারসেল:** stock 3, qty 5 → `stockCount = Math.max(0, 3-5) = 0`, বিক্রি **থামে না**; movement-এ `previousStock 3 → newStock 0`, কিন্তু 5টা বিক্রি হিসেবে লেখা — বর্তমান আচরণ characterization-এ লক।
- **zero stock:** স্টক 0-এ বিক্রি → সফল, `inStock=false`।
- **বাকি (due) হিসাব:** `paidAmount` না দিলে পুরো ক্যাশ; `paid > total` → `Math.min(..., total)` ক্ল্যাম্প; `paid = total/2` → `dueAmount = total - paid`; নেগেটিভ `paidAmount` → 0 ক্ল্যাম্প।
- বাকি থাকলে বা ফোন দিলে কাস্টমার আপসার্ট: নতুন কাস্টমারে `dueAmount += due`, `totalPurchases += total`, `orderCount += 1`; একই ফোনে দ্বিতীয় বিক্রিতে যোগ হয়।
- `qty` নরমালাইজ: `Math.max(1, Number(item.quantity) || 1)` — 0/নেগেটিভ/NaN/"2" স্ট্রিং → 1 বা 2; বাংলা সংখ্যা স্ট্রিং `"২"` → `Number` NaN → 1 (AI-পাথে `toNum` আগে চলে, POS রুটে চলে না — drift টেস্ট)।
- অজানা `productId` আইটেম স্কিপ হয়; সব স্কিপ হলে `null` রিটার্ন → API 400।
- `unitPrice = variant?.price ?? prod.price`, `unitCost = variant?.costPrice ?? prod.costPrice` — ভ্যারিয়েন্ট-লেভেল প্রাইসিং।
- `orderNumber = SK-${1000..9999}` র‍্যান্ডম — **কোলিশন সম্ভব**; `ord-${Date.now()}` আইডি — একই ms-এ দুই সেলে কোলাইড করতে পারে (অফলাইন + অনলাইন মার্জের সময়)। ক্যারেক্টারাইজেশন/TODO।

### ৩.৩ `recordDuePayment` + `upsertCustomerInData` (বাকির খাতা)
- সাধারণ: due 1000, pay 400 → due 600, payment রেকর্ড তৈরি, `duePayments`-এর মাথায় unshift।
- **ওভার-পেমেন্ট:** due 400-এ pay 500 → `dueAmount = Math.max(0, -100) = 0` — অতিরিক্ত ৳100 **হারায় না, কিন্তু কোথাও জমা থাকে না** (advance নেই); `totalCollected` ৫০০ দেখায়। বর্তমান আচরণ লক + TODO।
- **ন্যূনতম ক্ল্যাম্প:** `Math.max(1, Number(amount) || 0)` — 0 বা নেগেটিভ পেমেন্ট **৳1 হয়ে যায়**; NaN → 1। এটা observed-wrong — characterization + TODO।
- অজানা `customerId` → `null`।
- পরপর আংশিক পেমেন্ট (400 → 300 → 300) → due 0, তৃতীয়টা ওভার-কেস।
- `upsertCustomerInData`: নতুন ফোন → নতুন কাস্টমার; পুরনো ফোন → আপডেট; `'নাম নেই'` কাস্টমারের নাম পরে এলে বদলে যায়; `dueDelta` নেগেটিভ হলে ০-ক্ল্যাম্প।

### ৩.৪ `validateCoupon`
- সঠিক কোড + `minOrder`-এর উপরে total → valid, discount ঠিক।
- কোড ম্যাচিং: `code.toUpperCase().trim()` — ছোটহাতের/স্পেসসহ ইনপুট চলে; কিন্তু stored code-এর ভেতরের স্পেস মেলে না।
- **মেয়াদ/ব্যবহার-সীমা: `Coupon` টাইপেই (`src/types/index.ts:187`) `expiryDate`/`usageLimit`/`usedCount` ফিল্ড নেই — ফিচারটা এখনো নেই।** "expired/limit-exhausted" টেস্ট লেখা যাবে না; বরং টেস্টে **ডকুমেন্ট** করতে হবে: inactive (`active:false`) কুপন rejected — এটাই বর্তমান একমাত্র "অপচালন" পথ। TODO তালিকায় ফিচার-রিকোয়েস্ট।
- percentage: `Math.round(orderTotal * value / 100)` — ৳999-এ 15% → 150।
- **fixed কুপন total-এর চেয়ে বড়:** ৳300 অর্ডারে ৳500 কুপন → `discount = 500` (ক্যাপ নেই); checkout-এ `grandTotal = Math.max(0, ...)` ক্ল্যাম্প করে (`checkout/page.tsx:50`) কিন্তু order.discount 500-ই যায় — সার্ভার `createOrder` কিন্তু কুপন **re-validate করে না** (discount ক্লায়েন্ট-বিশ্বাস্য) — characterization + TODO (নিরাপত্তা-নোট)।
- `orderTotal < minOrder` → invalid + বাংলা মেসেজ।
- ফ্লোট: percentage-এ রাউন্ড হয়, fixed-এ হয় না।

### ৩.৫ `deterministicMatch` + `bnToEnDigits` (voice/ASR কোড কারেকশন)
- **বাংলা সংখ্যা:** `"JX-SH-001 ৪২ এর ২টা"` → sku JX-SH-001, size "42", qty 2।
- **SKU ম্যাচিং সাবস্ট্রিং-ভিত্তিক** (`norm.includes(sku)`): `"জেক্স এস এইচ..."` টাইপ ASR-আউটপুট যেখানে হাইফেন পড়ে যায় (`"JXSH001"`) → **ম্যাচ ফেল করে** (হাইফেন-স্ট্রিপিং নরমালাইজেশন নেই) — এটা জানা দুর্বলতা; টেস্টে ডকুমেন্ট + TODO (হাইফেন/স্পেস-অজ্ঞেয়বাদী নরমালাইজ প্রস্তাব)।
- **আংশিক-SKU ভুল-পজিটিভ:** SKU `JX-SH-10` থাকলে `"JX-SH-101"` মেসেজ **আগেরটাকেও** ম্যাচ করাতে পারে (products.find-এর ক্রম-নির্ভর) — এজ-টেস্ট।
- পরিমাণ: `"2টি"/"২টা"/"3 pcs"/"x 2"` ডিটেক্ট; **খালি সংখ্যা** (`"JX-SH-001 2"`) কোয়ান্টিটি হিসেবে ধরা হয় না → সাইজ-টোকেন হিসেবে চেষ্টা হয় → qty 1 থাকে।
- সাইজ: শুধু `prod.sizes`-এ থাকা ১-২ ডিজিট টোকেন; `"42.5"`/`"XL"` সাইজ ফরম্যাটে কী হয় যাচাই।
- কালার: ≥৩ অক্ষরের কালার-নাম substring — `"jetblack"` বনাম `"Jet Black"` স্পেস-মিসম্যাচ এজ-কেস।
- বারকোড: দৈর্ঘ্য ≥5 শর্ত; ছোট বারকোড ইচ্ছাকৃত বাদ।
- ভ্যারিয়েন্ট রেজলভ: size+color না মিললে stock>0 ভ্যারিয়েন্ট ফলব্যাক।

### ৩.৬ `deductStockForOrder` (মিরর) বনাম সার্ভার পাথ — drift টেস্ট
- ভ্যারিয়েন্ট পেলে মিররে `p.stockCount = sum(variants.stock)` **রি-ক্যালকুলেট** হয় (`compute.ts:312`), কিন্তু সার্ভার `createPosSale`-এ `stockCount -= qty` **আলাদাভাবে কমে** (`store.ts:713`) — ভ্যারিয়েন্ট-যোগফল ≠ stockCount হলে দুই পথে **ভিন্ন ফল**। একই সিনারিও দুই ফাংশনে চালিয়ে অভিন্নতা যাচাই — এটাই P1-এর drift-detector।
- movement শেপ: `type:'SALE'`, `quantity:-qty`, `previousStock/newStock`, `note: অর্ডার ${orderNumber}`।

### ৩.৭ অফলাইন আউটবক্স/রিপ্লে (`sync.ts`, `appliers.ts`)
- FIFO: `createdAt` স্ট্রিং-সর্ট — টাইমস্ট্যাম্প টাই হলে ইনসার্ট-ক্রম অনির্দিষ্ট (এজ-নোট)।
- 200 → ডিলিট; **4xx → `failed` + `attempts++` + পরের অপে যায়**; **5xx → রাউন্ড break** (বাকি pending থাকে); **নেটওয়ার্ক-থ্রো → পুরো রাউন্ড বাতিল, `ran:false`**। mock-fetch ম্যাট্রিক্স: [200,400,404,429,500,503,throw]।
- `POST /api/pos/sale` অফলাইনে body-তে `options` কী বসায় (`appliers.ts:204`), কিন্তু অনলাইন route flat body নেয় (`pos/sale/route.ts:17`) — **রিপ্লে-শেপ মিলছে কি না** যাচাই-টেস্ট (রিপ্লে `body` হুবহু পাঠায়; সার্ভার `body.options` না পেলে default-এ যায় → paid/due ভুল হওয়ার ঝুঁকি)। এটা এই প্ল্যানের সবচেয়ে গুরুত্বপূর্ণ সন্দেহ-পয়েন্ট।
- `applyMutation` POS: সার্ভারের সাথে paid/due/কাস্টমার-আপসার্ট অভিন্ন কি না (drift-detector)।
- `scheduleSync` থ্রটল: ৩০-সেকেন্ড রুটিন-থ্রটল, `force` বাইপাস।
- পাবলিক vs অ্যাডমিন স্ন্যাপশট (`api/sync/route.ts`): পাবলিকে orders/customers/expenses/duePayments/movements খালি যায় — **বাকি/খরচ লিক নেই** যাচাই (নিরাপত্তা-টেস্ট)।

### ৩.৮ `extractJson` / `toNum` / `extractResponseText`
- কোড-ফেন্স (```json ... ```), আগে-পিছে গল্প, অ্যারে-রুট, নেস্টেড ব্রেস, ভাঙা JSON → null।
- `toNum`: `"১২.৫"→12.5`, `"-3"→-3`, `"৳৫০০/-"→500`, `""→NaN`, `null→NaN`।
- `extractResponseText`: legacy `result.response` স্ট্রিং/অবজেক্ট, OpenAI `choices[0].message.content`, খালি → `''`।

### ৩.৯ `isAdminRequest` + middleware
- সঠিক কুকি (SHA-256 ম্যাচ) → true; ভুল কুকি → false; কুকি নেই → false; **পাসওয়ার্ড আনকনফিগার্ড → true (ডেভ-ওপেন)** — এই ফলব্যাক ডকুমেন্ট করা টেস্ট (নিরাপত্তা-মনে-করিয়ে-দেওয়া)।
- কুকি-হেডার পার্স: `sk_admin=x; sk_admin=y` মাল্টি-কুকি, `;`-স্পেস, URI-এনকোডেড ভ্যালু।
- `GENERATED_ENV` vs `process.env` প্রিসিডেন্স।

### ৩.১০ সাইজ/কালার কমা-পার্স
- `"40, 41,42"` → `['40','41','42']` (স্পেস-টলারেন্ট); `"40,,42"` → ফাঁপা বাদ; `""` → `['Standard']` ফলব্যাক; বাংলা-কালার-নাম → hex ম্যাপ (`brown/tan/white/blue/grey`)।

---

## ৪. টুলিং ড্রাফট (শুধু ডকুমেন্টে — এখনো ইনস্টল/কমিট করা হবে না)

### ৪.১ Vitest (ইউনিট)

`package.json`-এ পরে যোগ হবে (মালিকের অনুমোদনে): `devDependencies: { vitest: "^2.1.x" }` + স্ক্রিপ্ট `"test": "vitest run"`, `"test:watch": "vitest"`।

```ts
// vitest.config.ts (ড্রাফট)
import { defineConfig } from 'vitest/config';
import path from 'node:path';

export default defineConfig({
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }, // tsconfig paths-এর মিরর
  },
  test: {
    environment: 'node',        // প্রথম ধাপে DOM লাগে না; শুধু pure lib টেস্ট
    include: ['src/**/*.test.ts'],
    globals: false,
    // টাইমজোন-নির্ভর হিসাব (dayKey: 'en-CA') সব মেশিনে এক রাখতে:
    setupFiles: ['src/test/setup.ts'],
  },
});
```

```ts
// src/test/setup.ts (ড্রাফট)
process.env.TZ = 'UTC';
// প্রয়োজনে প্রতি-ফাইলে: vi.useFakeTimers(); vi.setSystemTime(new Date('2026-10-03T10:00:00Z'));
```

নমুনা টেস্ট (আচরণ-লক, বাস্তব ফাংশন সিগনেচার অনুযায়ী):

```ts
// src/lib/compute.test.ts (ড্রাফট — extraction ছাড়াই চলবে)
import { describe, it, expect } from 'vitest';
import { computeFinanceSummaryFromData, deductStockForOrder } from './compute';
import type { FullStoreData } from './types/fullStoreData'; // '@' alias দিয়ে

const baseData = (over: Partial<FullStoreData> = {}): FullStoreData => ({
  products: [], orders: [], categories: [], storeSettings: {} as never,
  heroBanner: {} as never, flashDeal: {} as never, coupons: [],
  inventoryMovements: [], customers: [], expenses: [], duePayments: [],
  ...over,
});

describe('computeFinanceSummaryFromData — COGS ৬৫% ফলব্যাক', () => {
  it('costPrice স্ন্যাপশট থাকলে সেটাই ব্যবহার হয়', () => {
    const data = baseData({
      products: [{ id: 'p1', costPrice: 700 } as never],
      orders: [{ status: 'Delivered', total: 1000,
        items: [{ productId: 'p1', price: 1000, quantity: 1, costPrice: 700 }] } as never],
    });
    expect(computeFinanceSummaryFromData(data).cogs).toBe(700);
  });

  it('স্ন্যাপশট না থাকলে price-এর ৬৫% (রাউন্ডেড) অনুমান', () => {
    const data = baseData({
      products: [], // প্রোডাক্টই নেই
      orders: [{ status: 'Delivered', total: 1000,
        items: [{ productId: 'ghost', price: 999, quantity: 1 }] } as never],
    });
    expect(computeFinanceSummaryFromData(data).cogs).toBe(Math.round(999 * 0.65)); // 649
  });

  it('Cancelled অর্ডার revenue/COGS-এ যায় না', () => { /* ... */ });
});
```

```ts
// src/lib/store.coupon.test.ts (ড্রাফট — extraction: validateCouponInData দরকার)
import { describe, it, expect } from 'vitest';
import { validateCouponInData } from './store'; // প্রস্তাবিত পিওর কোর

const coupons = [
  { id: 'c1', code: 'EID50', discountType: 'fixed', value: 50, minOrder: 500, active: true },
  { id: 'c2', code: 'PCT10', discountType: 'percentage', value: 10, minOrder: 0, active: true },
  { id: 'c3', code: 'OFF', discountType: 'fixed', value: 100, minOrder: 0, active: false },
] as never[];

describe('validateCouponInData', () => {
  it('fixed কুপন সঠিক ডিসকাউন্ট দেয়', () =>
    expect(validateCouponInData(coupons, ' eid50 ', 800)).toMatchObject({ valid: true, discount: 50 }));
  it('minOrder-এর নিচে বাতিল', () =>
    expect(validateCouponInData(coupons, 'EID50', 499).valid).toBe(false));
  it('inactive কুপন rejected — বর্তমানে এটাই একমাত্র "মেয়াদ-উত্তীর্ণ" পথ', () =>
    expect(validateCouponInData(coupons, 'OFF', 999).valid).toBe(false));
  it('TODO: fixed কুপন total-এর চেয়ে বড় হলে discount ক্যাপ হয় না (বর্তমান আচরণ)', () =>
    expect(validateCouponInData(coupons, 'EID50', 30).discount).toBe(50));
});
```

> extraction-এর আগে `validateCoupon`-কে টেস্ট করতে হলে `vi.mock('./store', ...)` দিয়ে `getCoupons` স্টাব করা যায় — কিন্তু লক্ষ্য হলো পিওর কোর extraction, mock-নির্ভরতা নয়।

### ৪.২ Playwright smoke (E2E আউটলাইন — পরে ইনস্টল হবে)

`@playwright/test` devDependency + `npx playwright install chromium` (মালিকের অনুমোদনে, P3 ধাপে)।

```ts
// playwright.config.ts (ড্রাফট)
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    env: { ADMIN_PASSWORD: 'test-pass-123' }, // টেস্ট-অনলি; প্রোডাকশন সিক্রেট নয়
  },
});
```

স্মোক ফ্লো আউটলাইন (`e2e/smoke.spec.ts`):

1. **login** — `/login` → পাসওয়ার্ড দিয়ে সাবমিট → `/admin` ড্যাশবোর্ড রেন্ডার; `sk_admin` কুকি সেট হওয়া যাচাই।
2. **add product** — `/admin/products` → নতুন প্রোডাক্ট ফর্ম: name, price, costPrice, `sizes: "40, 41, 42"` (কমা+স্পেস), একটি ইমেজ → সেভ → তালিকায় দেখা যায়, SKU জেনারেট হয়।
3. **POS sale** — `/admin` → AI FAB খুলে SKU-কোড মেসেজ (`"<SKU> 42 1টা"`) → সেল-কনফার্ম কার্ড → `paymentMode: full` কনফার্ম → টোস্ট "বিক্রি সম্পন্ন" → ইনভেন্টরিতে স্টক কমেছে + movement log-এ `SALE`।
   - বিকল্প (কম ব্রিটল): UI-র বদলে `/api/pos/sale`-এ `request.post()` — তবে UI-পাথ একবার রাখা ভালো।
4. **due payment** — POS sale দ্বিতীয়বার, `paymentMode: due` + ফোন দিয়ে → `/admin/customers`-এ কাস্টমারের `dueAmount > 0` দেখা → পেমেন্ট এন্ট্রি (`/api/customers/payment` বা UI) → due কমে যায়।
5. **report page loads** — `/admin/reports` → HTTP 200 + স্কোরকার্ড কনটেইনার রেন্ডার (AI-জেনারেট কনটেন্ট নয় — নেটওয়ার্ক-নিরপেক্ষ assertion)।

বিশেষ নোট: `public/sw.js` সার্ভিস-ওয়ার্কার + অফলাইন-মিরর টেস্টে হস্তক্ষেপ করতে পারে — স্মোকে প্রথমে `navigator.serviceWorker.getRegistrations()` ক্লিয়ার করা, অথবা অফলাইন-রিপ্লে সিনারিও আলাদা spec-এ (P3)।

### ৪.৩ GitHub Actions CI গেট আউটলাইন (ড্রাফট — `deploy.yml` পরে মালিকের অনুমোদনে এডিট হবে)

```yaml
# .github/workflows/ci.yml (ড্রাফট — নতুন ফাইল, deploy.yml না ছুঁয়ে)
name: CI Gate
on:
  pull_request:
  push:
    branches: [main]

jobs:
  gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20, cache: npm }
      - run: npm ci || npm install --legacy-peer-deps   # deploy.yml-এর সাথে একই ফলব্যাক
      - name: Type check
        run: npx tsc --noEmit
      - name: Lint
        run: npm run lint
      - name: Unit tests
        run: npm test          # vitest run
      - name: Build (Next.js)
        run: npm run build     # বা npx @cloudflare/next-on-pages — deploy-এর সাথে একই কমান্ড রাখা নিরাপদ
```

ডিপ্লয়-গেটিং দুই ভাবে (মালিক যেটা পছন্দ করবেন):
- **অপশন A (সাজেস্টেড):** `deploy.yml`-এর `deploy` job-এ যোগ করা: `needs: gate` + `if: github.ref == 'refs/heads/main' && github.event_name == 'push'` — তখন CI ফেল করলে ডিপ্লয় চলবেই না। **এটা deploy.yml এডিট করায় — মালিকের সম্মতি ছাড়া করা হবে না।**
- **অপশন B:** GitHub ব্রাঞ্চ-প্রোটেকশনে `gate` কে required status check করা (রিপো-সেটিংস চেঞ্জ, কোড-চেঞ্জ নয়)।
- নোট: `deploy.yml` বর্তমানে push-main এ সরাসরি চলে; `generatedEnv.ts` জেনারেশন ধাপটা CI-তে দরকার নেই (টেস্টে env মক/স্টাব)। `tsc --noEmit`-এ `workers/` বাদ আছে (tsconfig exclude) — ওয়ার্কারের আলাদা চেক পরে।

---

## ৫. ক্যারেক্টারাইজেশন / TODO তালিকা (এখন ফিক্স নয় — আচরণ লক করা)

এগুলো **observed-wrong** (দেখা গেছে ভুল/ঝুঁকিপূর্ণ) কিন্তু এই ওয়ার্কস্ট্রিমে ফিক্স নিষেধ; টেস্টে বর্তমান আচরণ স্পষ্ট-নাম করে লক হবে (`it.todo` / `test.fails` / কমেন্টে `// CHARACTERIZATION:`), পরে আলাদা PR-এ ফিক্স:

1. **`recordDuePayment` ওভার-পেমেন্ট:** due-র চেয়ে বেশি আদায়ে অতিরিক্ত টাকা কোথাও জমা হয় না (due 0-তে ক্ল্যাম্প, payment পুরো অঙ্কে লগ হয় → `totalCollected` বাড়তি)। TODO: advance/credit নোট। (`store.ts:884`)
2. **`recordDuePayment` min-1 ক্ল্যাম্প:** ৳0/নেগেটিভ ইনপুট ভুল করে ৳1 পেমেন্ট হয়ে যায়। (`store.ts:872`)
3. **কুপনে মেয়াদ/ব্যবহার-সীমা নেই** (`types/index.ts:187`): `active` ছাড়া কোনো expiry/usageLimit লজিক নেই। TODO: টাইপ+ভ্যালিডেশন এক্সটেনশন।
4. **fixed কুপন total-ক্যাপ নেই** + সার্ভার `createOrder` কুপন re-validate/discount পুনঃহিসাব করে না — ক্লায়েন্ট-বিশ্বাস্য discount। নিরাপত্তা-TODO। (`store.ts:642-657`, `checkout/page.tsx:50`)
5. **স্টক ওভারসেল সাইলেন্ট:** stock<qty হলে বিক্রি আটকায় না, `Math.max(0, ...)`-এ স্টক 0; movement-এ ভুল-গাণিতিক delta দেখায়। (`store.ts:713`, `compute.ts:310`)
6. **stockCount-অভিন্নতা drift:** মিররে ভ্যারিয়েন্ট-যোগফল থেকে re-calc (`compute.ts:312`), সার্ভার POS-এ সরাসরি decrement (`store.ts:713`) — দুই পথের ফল ভিন্ন হতে পারে। drift-detector টেস্ট প্রথমে লক, তারপর এক পথে আনা।
7. **`deterministicMatch`-এ হাইফেন-অজ্ঞেয়বাদী নরমালাইজেশন নেই:** ASR-এ `"JXSH001"` এলে SKU ম্যাচ ফেল; সাবস্ট্রিং-ম্যাচে আংশিক-SKU ভুল-পজিটিভ সম্ভব। TODO: normalized (হাইফেন/স্পেস-স্ট্রিপ) ডাবল-পাস। (`ai/route.ts:396-408`)
8. **অর্ডার-নম্বর/আইডি কোলিশন:** `SK-${Math.floor(1000+Math.random()*9000)}` ও `ord-${Date.now()}` — র‍্যান্ডম/ms-কোলিশন সম্ভব; অফলাইন+অনলাইন মার্জে ডুপ্লিকেট-কি ঝুঁকি। (`store.ts:426,754`, `appliers.ts:137`)
9. **POS অফলাইন-রিপ্লে body-শেপ:** মিরর applier `body.options` আশা করে, সার্ভার route flat ফিল্ড নেয় — রিপ্লে রাউন্ড-ট্রিপে paid/due/কাস্টমার তথ্য হারানোর সন্দেহ; টেস্ট দিয়ে প্রমাণ করে তারপর ফিক্স। (`appliers.ts:203-204` বনাম `pos/sale/route.ts:17-23`)
10. **`computeFinanceSummaryFromData`-তে খরচ পিরিয়ড-ফিল্টারহীন** (netProfit = সব-সময়ের খরচ বাদ); `gatherPeriodStats`-এ আছে — ইচ্ছাকৃত কি না মালিককে জিজ্ঞেস করার TODO। (`compute.ts:41`)
11. **`dayKey` টাইমজোন-নির্ভর** (`toLocaleDateString('en-CA')`) — এজ-রানটাইম (UTC) বনাম লোকাল ডেভে দিন-বাউন্ডারি সরে; টেস্ট TZ=UTC ফিক্স করে বর্তমান আচরণ লক + TODO: স্পষ্ট UTC পার্সিং। (`compute.ts:49`, `report.ts:106`)
12. **POS-এ বাংলা-সংখ্যা quantity:** `Number("২")` NaN → qty 1 নিংজা-ফলব্যাক; AI-পাথের `toNum` বনাম POS-রুটের নন-নরমালাইজড পাথ drift। (`store.ts:690`)
13. **মিডলওয়্যারে `sha256`+কুকি-লজিক ডুপ্লিকেট** (`middleware.ts:6` বনাম `adminAuth.ts:11`) — drift হলে admin পেজ ও API ভিন্ন সত্যে বিশ্বাস করবে; শেয়ার্ড হেল্পার TODO।
14. **আনকনফিগার্ড পাসওয়ার্ডে admin-ওপেন** (`adminAuth.ts:19-20`, `middleware.ts:13-15`) — ডেভ-কনভেনিয়েন্স; প্রোডাকশনে ভুলে পাসওয়ার্ড-না-বসানো গেলে খোলা — টেস্টে ডকুমেন্ট + ডিপ্লয়-চেক TODO (p3-secrets অডিটের সাথে ক্রস-রেফ)।

---

## ৬. বাস্তবায়ন চেকলিস্ট (মালিক "ঠিক আছে" বললে যথাক্রমে)

### ধাপ ১ (প্রথম সপ্তাহ — শুধু যোগ, কোনো রিফ্যাক্টর নয়)
1. `vitest` devDependency + `vitest.config.ts` + `src/test/setup.ts` + `"test": "vitest run"` যোগ (উপরের ড্রাফট অনুযায়ী)।
2. **শূন্য-রিফ্যাক্টর টেস্ট** লেখা শুরু: `compute.test.ts` (`computeFinanceSummaryFromData` COGS-ফলব্যাক/ক্যান্সেল/বাকি + `computeInventorySummary` + `deductStockForOrder`), `ai.extractJson.test.ts`।
3. `adminAuth.test.ts` (কুকি-ম্যাট্রিক্স, আনকনফিগার্ড-ওপেন কেস)।
4. ক্যারেক্টারাইজেশন ফাইল `src/lib/characterization.test.ts` খোলা — উপরের ৫-এর ১–৫, ৮ নম্বর আইটেম লক।
5. `.github/workflows/ci.yml` (অপশন-A ছাড়া — শুধু PR+push-এ চলবে)।

### ধাপ ২ (দ্বিতীয় — ন্যূনতম extraction, আচরণ-অপরিবর্তিত)
6. `store.ts`-এ পিওর কোর বের করা: `validateCouponInData`, `applyDuePaymentInData`, `applyPosSaleInData` (createPosSale-এর হিসাব-অংশ), `upsertCustomerInData` export — বর্তমান async ফাংশনগুলো থিন KV-র‍্যাপার হবে; প্রতিটা মুভে আগের ম্যানুয়াল ফ্লো একবার হাতে চালানো (POS sale → বাকি → রিপোর্ট)।
7. `ai/route.ts` থেকে `src/lib/saleMatch.ts` (bnToEnDigits + deterministicMatch) সরানো + `saleMatch.test.ts` (৩.৫-এর ম্যাট্রিক্স)।
8. `appliers.ts`-এ রুট-প্রতি পিওর রিডিউসার + **drift-detector টেস্ট**: একই (data, body) সার্ভার-কোর বনাম মিরর-রিডিউসারে চালিয়ে ডিপ-ইকুয়াল — বিশেষত POS-sale ও upsertCustomer।
9. `sync.test.ts`: মক-fetch ম্যাট্রিক্সে `replayOutbox` পিওর কোর (4xx/5xx/throw/FIFO)।
10. CI-তে `needs: gate` যোগের জন্য `deploy.yml` এডিট (মালিকের লিখিত অনুমোদনের পরেই)।

### ধাপ ৩ (তৃতীয় — E2E ও গভীরতা)
11. Playwright ইনস্টল + `playwright.config.ts` + `e2e/smoke.spec.ts` (login → product → POS → due → reports)।
12. `report.ts`-এ `gatherPeriodStats(data)` extraction + সাপ্তাহিক/মাসিক অ্যাগ্রিগেশন টেস্ট।
13. `apiFetch`-এর `routeDecision` পিওর ফাংশন + অফলাইন-কিউ টেস্ট; fake-indexeddb দিয়ে outbox টেস্ট।
14. ক্যারেক্টারাইজেশন তালিকা মালিকের সাথে বসে ট্রিয়াজ — কোনটা ফিক্স-PR হবে, কোনটা "এভাবেই থাকবে" (ডকুমেন্টেড)।

### স্পষ্ট নিষেধ (এই প্ল্যানের সীমা)
- এই অডিটে **শুধু এই ডকুমেন্ট** তৈরি হয়েছে; কোনো প্যাকেজ ইনস্টল, `package.json`/`deploy.yml` এডিট, টেস্ট-ফাইল কমিট করা হয়নি। ধাপ ১–৩ সবই মালিকের সবুজ-সিগনালের অপেক্ষায়।

---

*রেফারেন্স অডিট: docs/audits/p1-api-route-audit.md, docs/audits/p8-offline-sync-review.md, docs/audits/p3-secrets-deploy-findings.md, docs/OFFLINE_SYNC.md*

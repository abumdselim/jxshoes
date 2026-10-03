# P1 — API রুট অথেনটিকেশন অডিট (JxShoes)

তারিখ: 2026-10-03 • স্কোপ: `src/app/api/**` এর সব রুট, `src/middleware.ts`, স্টোরফ্রন্ট ক্লায়েন্ট কোড, `src/lib/adminAuth.ts` (প্যারালাল ওয়ার্কস্ট্রিমের ইন-ফ্লাইট কোডসহ)।

## ১. সারসংক্ষেপ

- মোট **৩০টি রুট ফাইল**, মোট **৪৯টি HTTP handler method**।
- এর মধ্যে কেবল **৫টি method**-এ কোনো না কোনো যাচাই আছে: `/api/ai` GET+POST (`isAdminRequest`), `/api/sync` GET (public/admin scope split), `/api/cron/report` GET ও `/api/cron/watch` GET (`x-cron-secret`)।
- বাকি **৪৪টি method-এ কোনো auth নেই**; এর মধ্যে **৩৪টি method শুধু অ্যাডমিন প্যানেলের কাজে লাগে** — অর্থাৎ যে কেউ ইন্টারনেট থেকে প্রোডাক্ট মুছতে/বদলাতে, কাস্টমারের নাম-ফোন-ঠিকানা-বাকির খাতা পড়তে, খরচ-রিপোর্ট-লাভক্ষতি দেখতে, সেটিংস ওভাররাইট করতে ও যেকোনো ফাইল আপলোড করতে পারে।
- `src/middleware.ts`-এর matcher কেবল `['/admin/:path*']` — **/api রুটগুলো middleware দিয়ে কখনোই যাচাই হয় না** (`src/middleware.ts:24-26`)।
- সবচেয়ে বড় ডেটা-লিক: `GET /api/orders` অথহীন — সব অর্ডারের নাম, ফোন, ঠিকানা, bKash TrxID, নোট এক কলেই পাওয়া যায়; order-success পেজও এই এন্ডপয়েন্টেই নির্ভর করে।

## ২. পূর্ণ রুট টেবিল

লেজেন্ড — auth কলামে: **কোনোটি নেই** মানে হ্যান্ডলারে কুকি/সেক্রেট/সেশন যাচাইয়ের একটাও লাইন নেই। ট্যাগ: PUBLIC = স্টোরফ্রন্ট সত্যিই দরকার, ADMIN = শুধু মালিকের প্যানেল, CRON = বাহ্যিক cron worker।

| রুট | Methods | বর্তমান auth | স্টোরফ্রন্ট ব্যবহার করে? | ট্যাগ | প্রমাণ (file:line) | নোট |
|---|---|---|---|---|---|---|
| `/api/admin-login` | POST | — (নিজেই লগইন; রেট-লিমিট নেই) | হ্যাঁ (`src/app/login/page.tsx:20`) | PUBLIC | `src/app/api/admin-login/route.ts:15-46` | প্লেইন `!==` তুলনা (line 31); কুকি = আনসল্টেড `sha256(password)` (line 36), ৩০ দিন (line 7), রিভোক করার কোনো ব্যবস্থা নেই |
| `/api/ai` | GET, POST | `isAdminRequest` (sk_admin কুকি) | না (শুধু admin: `AdminAiFab.tsx:256,369`, `chatClient.ts:24`) | ADMIN | `src/app/api/ai/route.ts:940,959`; `src/lib/adminAuth.ts:18-26` | প্যারালাল ওয়ার্কস্ট্রিমে লক হয়েছে; তবে `ADMIN_PASSWORD` আনকনফিগার্ড হলে fail-open (`adminAuth.ts:20`) |
| `/api/analytics/fast-movers` | GET | কোনোটি নেই | না (`src/app/admin/page.tsx`) | ADMIN | `src/app/api/analytics/fast-movers/route.ts:7-13` | বিক্রয়-velocity র‍্যাংকিং পাবলিক |
| `/api/categories` | GET, POST | কোনোটি নেই | GET হ্যাঁ (`shop/page.tsx:82`); POST না | GET=PUBLIC, POST=ADMIN | `src/app/api/categories/route.ts:6,15` | POST-এ যে কেউ ক্যাটাগরি বানাতে পারে |
| `/api/categories/[id]` | DELETE | কোনোটি নেই | না | ADMIN | `src/app/api/categories/[id]/route.ts:6-15` | যে কেউ ক্যাটাগরি মুছবে |
| `/api/coupons` | GET, POST, DELETE | কোনোটি নেই | না (স্টোরফ্রন্ট `/api/coupons/validate` ব্যবহার করে) | ADMIN | `src/app/api/coupons/route.ts:6,15,28`; কলার: `src/components/admin/BannerCouponControl.tsx` | কুপন তৈরি/মুছা পাবলিক |
| `/api/coupons/validate` | POST | কোনোটি নেই (ডিজাইনগতভাবে পাবলিক) | হ্যাঁ (`checkout/page.tsx:59-63`) | PUBLIC | `src/app/api/coupons/validate/route.ts:6-17` | রেট-লিমিট নেই → কোড এনুমারেশন সহজ; ক্লায়েন্ট-পাঠানো `orderTotal`-এর উপর ডিসকাউন্ট হিসাব |
| `/api/cron/report` | GET | `x-cron-secret` হেডার **অথবা `?secret=` কুয়েরি প্যারাম** | না | CRON | `src/app/api/cron/report/route.ts:21-30` | কুয়েরি প্যারামে সেক্রেট লগ/ক্যাশে ফাঁসের ঝুঁকি (line 27) |
| `/api/cron/watch` | GET | `x-cron-secret` বা `?secret=` | না | CRON | `src/app/api/cron/watch/route.ts:15-19` | CRON_SECRET সেট না থাকলে 401 — fail-closed |
| `/api/customers` | GET, POST, DELETE | কোনোটি নেই | না | ADMIN | `src/app/api/customers/route.ts:6-13,15,28` | GET-এ সব কাস্টমার + বাকির পেমেন্ট হিস্ট্রি পাবলিক |
| `/api/customers/[id]` | GET | কোনোটি নেই | না | ADMIN | `src/app/api/customers/[id]/route.ts:7-16` | কাস্টমারের পূর্ণ খাতা |
| `/api/customers/payment` | POST | কোনোটি নেই | না (`AdminAiFab.tsx:431` শুধু অ্যাডমিন) | ADMIN | `src/app/api/customers/payment/route.ts:7-27` | যে কেউ বাকি আদায় এন্ট্রি লিখতে পারে |
| `/api/expenses` | GET, POST, DELETE | কোনোটি নেই | না | ADMIN | `src/app/api/expenses/route.ts:6,14,31` | খরচের খাতা পাবলিক |
| `/api/feedback` | POST | কোনোটি নেই (ডিজাইনগতভাবে পাবলিক) | হ্যাঁ (`src/components/FeedbackForm.tsx:30`) | PUBLIC | `src/app/api/feedback/route.ts:7-31` | ইনপুট ট্রিম+ট্রাংকেট হয় (lines 11,15,16) — ভালো; তবে রেট-লিমিট নেই → নোটিফিকেশন স্প্যাম |
| `/api/finance` | GET | কোনোটি নেই | না | ADMIN | `src/app/api/finance/route.ts:7-13` | পূর্ণ লাভ-ক্ষতি সামারি পাবলিক |
| `/api/inventory` | GET, POST | কোনোটি নেই | না (`AdminAiFab.tsx:521`) | ADMIN | `src/app/api/inventory/route.ts:14,36-108` | restock/adjust/SKU-আপডেট সব পাবলিক |
| `/api/marketing` | GET, POST | কোনোটি নেই | GET হ্যাঁ (`shop/page.tsx:83`); POST না | GET=PUBLIC, POST=ADMIN | `src/app/api/marketing/route.ts:6,16-33` | যে কেউ হিরো-ব্যানার/ফ্ল্যাশ ডিল বদলাতে পারে |
| `/api/media-library` | GET, POST, DELETE | কোনোটি নেই | না (`src/app/admin/gallery/page.tsx`; `src/lib/offline/sync.ts:160` অ্যাডমিন কনটেক্সটে) | ADMIN | `src/app/api/media-library/route.ts:7,15,32` | |
| `/api/media/[file]` | GET | কোনোটি নেই (পাবলিক ইমেজ প্রক্সি) | হ্যাঁ (আপলোড করা ছবির URL `/api/media/{filename}`) | PUBLIC | `src/app/api/media/[file]/route.ts:20-53` | পাথ-ট্রাভার্সাল গার্ড আছে (line 28); `svg` সার্ভ হয় `image/svg+xml` হিসেবে (lines 6-14) → আপলোডকৃত SVG-তে স্টোর্ড XSS সম্ভব |
| `/api/notifications` | GET, PUT, DELETE | কোনোটি নেই | না (`AdminSidebar.tsx:83`, `admin/notifications/page.tsx`) | ADMIN | `src/app/api/notifications/route.ts:7,21,37` | কাস্টমারের অভিযোগ/ফোন নম্বরসহ নোটিফিকেশন পাবলিক |
| `/api/orders` | GET, POST | কোনোটি নেই | GET: order-success (`order-success/[id]/page.tsx:23`); POST: checkout (`checkout/page.tsx:111`) | PUBLIC (উভয়ই দরকার, তবে GET-এর রূপ ঠিক নয়) | `src/app/api/orders/route.ts:6-13,15-26` | GET = সব অর্ডার পুরো তালিকা লিক; POST = প্রাইস/টোটাল ক্লায়েন্ট-ট্রাস্টেড (S4) |
| `/api/orders/[id]` | PATCH | কোনোটি নেই | না (`admin/orders/page.tsx:45`) | ADMIN | `src/app/api/orders/[id]/route.ts:6-20` | যে কেউ যেকোনো অর্ডারের status বদলাতে পারে |
| `/api/pos/sale` | POST | কোনোটি নেই | না (`AdminAiFab.tsx:476`) | ADMIN | `src/app/api/pos/sale/route.ts:10-37` | তবে প্রাইস সার্ভারেই রিকম্পিউট হয় (`store.ts:709`) — এই রুটের হিসাব ঠিক |
| `/api/pos/undo-auto` | POST | কোনোটি নেই | না (`AdminAiFab.tsx:156`) | ADMIN | `src/app/api/pos/undo-auto/route.ts:11-44` | |
| `/api/products` | GET, POST | কোনোটি নেই | GET হ্যাঁ (`shop/page.tsx:81`); POST না | GET=PUBLIC, POST=ADMIN | `src/app/api/products/route.ts:6,28-39` | |
| `/api/products/[id]` | GET, PUT, DELETE | কোনোটি নেই | GET হ্যাঁ (`product/[id]/page.tsx:31`); PUT/DELETE না | GET=PUBLIC, PUT/DELETE=ADMIN | `src/app/api/products/[id]/route.ts:6,17,30` | GET-এ `costPrice` (ক্রয়মূল্য) সহ পুরো অবজেক্ট যায় — পাবলিক পেলোড থেকে বাদ দেওয়া উচিত |
| `/api/reports` | GET | কোনোটি নেই | না (`src/lib/offline/sync.ts:159` অ্যাডমিন কনটেক্সটে) | ADMIN | `src/app/api/reports/route.ts:7-13` | AI বিজনেস রিপোর্ট পাবলিক |
| `/api/settings` | GET, POST | কোনোটি নেই | GET হ্যাঁ (`Navbar.tsx:27`, `Footer.tsx:16`, `MobileBottomNav.tsx:28`, shop, checkout); POST না | GET=PUBLIC, POST=ADMIN | `src/app/api/settings/route.ts:6,15-23` | POST-এ দোকানের পুরো সেটিংস (বিকাশ নম্বর, ডেলিভারি ফি ইত্যাদি) ওভাররাইট করা যায় |
| `/api/sync` | GET | `isAdminRequest` দিয়ে scope ভাগ | হ্যাঁ — পাবলিক স্কোপ অফলাইন মিররের জন্য (`src/lib/offline/snapshot.ts:159`) | PUBLIC (public scope) + ADMIN (admin scope) | `src/app/api/sync/route.ts:14-63` | পাবলিক স্কোপে শুধু স্টোরফ্রন্ট-সেফ ডেটা (lines 19-40) — ডিজাইন ঠিক আছে |
| `/api/upload` | POST | কোনোটি নেই | না (`admin/products/page.tsx`, `admin/gallery/page.tsx`) | ADMIN | `src/app/api/upload/route.ts:6-53` | MIME/সাইজ লিমিট নেই; ফাইলনেম প্রেডিক্টেবল (`Date.now()-` + sanitized name, lines 16-17); R2 ব্যর্থ হলে base64 data-URI ফেরত (lines 44-48) |

মাইক্রো-সারাংশ: **অথহীন অ্যাডমিন-ক্যাপাবিলিটি method = ৩৪টি** (analytics/fast-movers GET; categories POST, [id] DELETE; coupons GET/POST/DELETE; customers GET/POST/DELETE, [id] GET, payment POST; expenses GET/POST/DELETE; finance GET; inventory GET/POST; marketing POST; media-library GET/POST/DELETE; notifications GET/PUT/DELETE; orders GET*, [id] PATCH; pos/sale, pos/undo-auto POST; products POST, [id] PUT/DELETE; reports GET; settings POST; upload POST)। *orders GET স্টোরফ্রন্টেও লাগে কিন্তু বর্তমান রূপটাই লিক।

### স্টোরফ্রন্টের সত্যিকারের প্রয়োজন তালিকা (public allowlist-এর ভিত্তি)

`src/app/shop`, `src/app/product/[id]`, `src/app/checkout`, `src/app/order-success/[id]`, `src/app/cart` (কোনো API কল নেই), `src/app/page.tsx` (কোনো API কল নেই), `src/app/login`, এবং পাবলিক কম্পোনেন্ট (Navbar, Footer, MobileBottomNav, FeedbackForm) থেকে প্রমাণিত কল:

`GET /api/products`, `GET /api/products/[id]`, `GET /api/categories`, `GET /api/settings`, `GET /api/marketing`, `POST /api/coupons/validate`, `POST /api/orders`, `GET /api/orders` (শুধু order-success — নতুন টোকেন-স্কোপড রুটে সরানো দরকার), `POST /api/feedback`, `POST /api/admin-login`, `GET /api/media/[file]`, `GET /api/sync` (public scope)। বাকি সব = ADMIN/CRON।

## ৩. যাচাইকৃত দাবি

### S1 — "API রুটে কোনো auth চেক নেই; middleware শুধু /admin পেজ ব্লক করে"
**VERDICT: PARTIAL** (মূল বক্তব্য আজও প্রায় সত্য, কিন্তু ২টি রুট এখন লক করা হয়েছে)
- middleware matcher কেবল `/admin/:path*` — /api কিছুই না: **VERIFIED** — `src/middleware.ts:24-26` (`matcher: ['/admin/:path*']`)। পাসওয়ার্ড আনকনফিগার্ড হলে /admin-ও খোলা থাকে (`src/middleware.ts:15`)।
- তবে প্যারালাল ওয়ার্কস্ট্রিমে `/api/ai` GET+POST `isAdminRequest` দিয়ে লক হয়েছে (`src/app/api/ai/route.ts:940,959`) এবং `/api/sync` GET স্কোপ-ভাগ করেছে (`src/app/api/sync/route.ts:16,19-40`)। cron রুট দুটিতে সেক্রেট ছিলই।
- বাকি **৩৪টি অ্যাডমিন-ক্যাপাবিলিটি method আজও সম্পূর্ণ অথহীন** (উপরের টেবিল দেখুন) — যেমন `DELETE /api/products/[id]` (`src/app/api/products/[id]/route.ts:30-39`), `POST /api/settings` (`src/app/api/settings/route.ts:15-23`), `GET /api/customers` (`src/app/api/customers/route.ts:6-13`)।

### S2 — "/api/ai এবং /api/upload অথেনটিকেটেড নয়"
**VERDICT: PARTIAL**
- `/api/upload`: **VERIFIED TRUE** — `src/app/api/upload/route.ts:6-53`-এ কুকি/টোকেন/সেক্রেট যাচাইয়ের কোনো লাইন নেই; যে কেউ multipart ফাইল পাঠলেই সেটা R2-তে জমা হয় (বা base64 data-URI ফেরত আসে)। MIME যাচাই বা সাইজ লিমিটও নেই।
- `/api/ai`: **VERIFIED FALSE** (কার্যত) — এখন GET ও POST দুটোই শুরুতে `isAdminRequest` চেক করে (`src/app/api/ai/route.ts:940,959`)। সীমাবদ্ধতা: `ADMIN_PASSWORD` আনকনফিগার্ড হলে `isAdminRequest` সত্য ফেরত দেয় — fail-open (`src/lib/adminAuth.ts:20`)।

### S3 — "লগইনে রেট-লিমিট নেই; প্লেইন !== তুলনা; কুকি = আনসল্টেড SHA-256(password), ৩০ দিন, রিভোক-অযোগ্য"
**VERDICT: VERIFIED TRUE** (চারটি অংশই সত্য)
- রেট-লিমিট: পুরো `src/` জুড়ে rate-limit/throttle কোড নেই; `POST /api/admin-login` প্রতি রিকোয়েস্টে অবাধ চেষ্টা — `src/app/api/admin-login/route.ts:15-46`।
- প্লেইন তুলনা: `supplied !== password` — `src/app/api/admin-login/route.ts:31` (timing-safe নয়)।
- আনসল্টেড হ্যাশ: কুকির মান = `sha256(ADMIN_PASSWORD)` — `src/app/api/admin-login/route.ts:9-13,36`; middleware একই মান যাচাই করে (`src/middleware.ts:17-18`), `adminAuth.ts`-ও (`src/lib/adminAuth.ts:25`)। হ্যাশটি পাসওয়ার্ডের deterministic ফাংশন — DB/সেশন স্টোর নেই।
- ৩০ দিন + রিভোক-অযোগ্য: `COOKIE_MAX_AGE = 60*60*24*30` (`route.ts:7`); কুকির মান যেহেতু সবসময় `sha256(password)`-ই, লগআউট/রিভোকের কোনো সার্ভার-সাইড মেকানিজম নেই — একবার লিক হলে পাসওয়ার্ড বদলানো ছাড়া বন্ধ করার উপায় নেই।

### S4 — "অর্ডার/কাস্টমার বডি যাচাই ছাড়াই createOrder(body)/saveCustomer(body)-তে যায়; সার্ভার প্রাইস/টোটাল/কুপন নিজের ডেটা থেকে রিকম্পিউট করে না"
**VERDICT: VERIFIED TRUE**
- রুট লেভেল ভ্যালিডেশন কেবল `customerName/phone/items` খালি কি না — `src/app/api/orders/route.ts:18`; তারপর সরাসরি `createOrder(body)` (line 21)।
- `createOrder` ক্লায়েন্টের পুরো অবজেক্ট spread করে: `const newOrder: Order = { ...orderData, ... }` — অর্থাৎ ক্লায়েন্ট-পাঠানো `items[].price`, `subtotal`, `deliveryFee`, `discount`, `total`, `paidAmount` সবই বিশ্বাস করা হয় — `src/lib/store.ts:435-444`। সেলস-প্রাইস কোথাও স্টোর্ড প্রোডাক্টের দামের সাথে মিলিয়ে দেখা হয় না; একমাত্র `costPrice` স্ন্যাপশট নেওয়া হয় (`store.ts:429-433`)।
- স্টক: `Math.max(0, prod.stockCount - item.quantity)` — availability যাচাই নেই, নেগেটিভ না হলেই ক্ষান্ত (`store.ts:458-462`)।
- কুপন: `createOrder` `couponCode`-কে কখনো সার্ভারে রি-ভ্যালিডেট করে না; `validateCoupon` (`store.ts:642-658`) শুধু checkout-এর ডিসপ্লে-হিসাবে ব্যবহৃত হয় (`checkout/page.tsx:59-63`), চূড়ান্ত `discount` ক্লায়েন্ট যা পাঠায় তাই।
- checkout পেলোড নিজেই প্রমাণ: `items: cart, subtotal, discount, deliveryFee, total` সব ক্লায়েন্ট-গণিত — `src/app/checkout/page.tsx:95-109` (টোটাল হিসাব lines 47-50)।
- কাস্টমার: `POST /api/customers` → `saveCustomer(body)` (`src/app/api/customers/route.ts:21`); আর `saveCustomer` বিদ্যমান কাস্টমারের `dueAmount`-ও ক্লায়েন্ট থেকে ওভাররাইট করে — `src/lib/store.ts:829`।
- বৈপরীত্য-প্রমাণ (সম্ভব বলে প্রমাণ): `createPosSale` সার্ভারেই ইউনিট-প্রাইস ও টোটাল রিকম্পিউট করে (`store.ts:686-751`) — অর্থাৎ `/api/orders`-এ একই কাজ করা যাবে।

### Extra — order-success পেজ কীভাবে অর্ডার আনে; id গেসেবল কি না
**VERDICT: VERIFIED — গুরুতর এক্সপোজার**
- পেজটি `apiFetch('/api/orders')` দিয়ে **সব অর্ডারের পূর্ণ তালিকা** নামিয়ে ক্লায়েন্ট-সাইডে `find` করে — `src/app/order-success/[id]/page.tsx:23-26`। পৃথক কোনো `GET /api/orders/[id]` রুট নেই।
- যেহেতু `GET /api/orders` অথহীন (`src/app/api/orders/route.ts:6-13`), **যে কেউ (id জানার দরকারই নেই) সব অর্ডার ডাম্প করতে পারে**: নাম, ফোন, পূর্ণ ঠিকানা, `bkashTrxId`, কাস্টমার নোট, `adminNote`, অর্ডারের সব টাকা-হিসাব — Order টাইপের ফিল্ডসমূহ (`src/types/index.ts:63-86`)।
- id গেসেবল: `ord-${Date.now()}` — মিলিসেকেন্ড টাইমস্ট্যাম্প (`src/lib/store.ts:425`), `orderNumber = SK-` + ৪-ডিজিট র‍্যান্ডম (`store.ts:426`)। ফাঁকা URL `/order-success/কিছু-না-জানা-id` খুললেও আসল লিক হয় এন্ডপয়েন্ট থেকে; id-এনুমেরেশন কেবল সুবিধামাত্র।
- POS-বিক্রির অর্ডারও একই তালিকায় পাবলিক হয়ে যায়।

## ৪. অগ্রাধিকার-ভিত্তিক সমাধান আউটলাইন (কোড নয়)

1. **সেন্ট্রাল requireAdmin হেল্পার (P0)** — `src/lib/adminAuth.ts`-এর `isAdminRequest`-কেই বেস ধরে একটি একক এন্ট্রি-পয়েন্ট (যেমন `requireAdmin(request): Promise<Response | null>`) রাখা, যাতে ভবিষ্যতে কুকি-হ্যাশ থেকে সত্যিকারের সেশন/JWT-তে গেলে শুধু হেল্পারটা বদলালেই চলে, ২১টি রুট ফাইল ছোঁয়ার দরকার না হয়। বর্তমানে এই হেল্পার কেবল `/api/ai` ও `/api/sync` কল করে — বাকি ২১টি ফাইলের প্রতিটি অ্যাডমিন method-এর শুরুতে এক লাইনের গেট বসাতে হবে। সাথে: fail-open (`ADMIN_PASSWORD` না থাকলে true) বদলে স্পষ্ট dev-মোড ফ্ল্যাগ, constant-time তুলনা, এবং public GET-এ `costPrice`-বাদ দেওয়া পেলোড শেপিং।
2. **Middleware matcher বাড়ানো (P0)** — matcher-এ `/api/:path*` যোগ করে ডিফল্ট-ডিনাই + উপরের public allowlist (products GET, categories GET, settings GET, marketing GET, coupons/validate POST, orders POST, feedback POST, admin-login POST, media GET, sync GET, cron সেক্রেট-পাথ)। এতে হেল্পার ভুলে গেলেও দ্বিতীয় স্তর থাকবে।
3. **সার্ভার-সাইড রিকম্পিউট (P0)** — `POST /api/orders`-এ: productId থেকে স্টোর্ড প্রাইস নিয়ে আইটেম/সাবটোটাল গণনা, `couponCode` সার্ভারে `validateCoupon` দিয়ে রি-ভ্যালিডেশন, ডেলিভারি ফি সেটিংস থেকে, স্টক availability যাচাই (ক্ল্যাম্প নয়), এবং `createPosSale`-এর (`store.ts:686-751`) প্যাটার্ন অনুসরণ। `POST /api/customers`-এ ক্লায়েন্ট-সেন্ট `dueAmount` ওভাররাইট বন্ধ।
4. **order-success-এর জন্য publicToken (P1)** — `GET /api/orders` পাবলিক থেকে সরিয়ে: অর্ডার তৈরির সময় অসম্পূর্ণ-অনুমানযোগ্য `publicToken` (crypto.randomUUID) জেনারেট করে `GET /api/orders/by-token/[token]`-এ শুধু সেই একটি অর্ডার (পেমেন্ট-সংবেদনশীল ফিল্ড বাদে) ফেরত দেওয়া; order-success পেজ checkout-এর রিডাইরেক্ট URL-এ টোকেন বহন করবে।
5. **রেট-লিমিট পয়েন্ট (P1)** — `POST /api/admin-login` (প্রতি IP+গ্লোবাল ব্রুট-ফোর্স গেট), `POST /api/ai` ও AI-কোটা, `POST /api/orders` (পাবলিক স্প্যাম-অর্ডার), `POST /api/feedback` (নোটিফিকেশন স্প্যাম), `POST /api/coupons/validate` (কোড এনুমারেশন)। Cloudflare Workers কনটেক্সটে KV/Durable Object-ভিত্তিক কাউন্টার বা CF WAF rate-limiting রুল।
6. **আপলোড সীমা (P1)** — `/api/upload`-এ: অনুমোদিত MIME allowlist (jpeg/png/webp), সর্বোচ্চ সাইজ (যেমন 5MB), `crypto.randomUUID()`-ভিত্তিক ফাইলনেম (ক্লায়েন্ট-নাম নয়), SVG নিষিদ্ধ বা sanitize (স্টোর্ড XSS), এবং `isAdminRequest` গেট।
7. **কনফিগার করা হয়নি এমন দাবি নয়, তবে সস্তা জয়**: cron রুটে `?secret=` কুয়েরি-প্যারাম বন্ধ করে শুধু হেডার; `/api/ai`-র `ADMIN_PASSWORD`-unset fail-open বন্ধ।

### প্যারালাল ওয়ার্কস্ট্রিম যা ইতিমধ্যে কভার করে
- `src/lib/adminAuth.ts` — রিইউজেবল `isAdminRequest(request)` হেল্পার (কুকি `sk_admin` = `sha256(ADMIN_PASSWORD)`) — রেমিডিয়েশন ১-এর ভিত্তি হওয়ার মতোই ইন্টারফেস।
- `/api/ai` GET+POST এটি দিয়ে লক করা হয়েছে; `/api/sync` এটি দিয়ে public/admin scope ভাগ করেছে (পাবলিক স্কোপে অর্ডার/কাস্টমার/খরচ/বাকি যায় না — `src/app/api/sync/route.ts:19-40`)।
- বাকি সব রুট এখনো এই হেল্পার ব্যবহার করে না — অর্থাৎ কভারেজ এখন ৩৪টি অ্যাডমিন method-এর মধ্যে ০টি (ai/sync আলাদা)।

## ৫. যাচাই হয়নি (unverified)

- **রানটাইম আচরণ**: কোনো বিল্ড/ডেভ-সার্ভার চালানো হয়নি (নিষেধ) — রুটগুলো সত্যিই রেসপন্স দেয় কি না, edge runtime-এ cookie header পাঠযোগ্য কি না, তা রানটাইমে যাচাই করা হয়নি; সব সিদ্ধান্ত স্ট্যাটিক কোড-পঠনের।
- **env মান**: `.env`/`GENERATED_ENV`-এ `ADMIN_PASSWORD`, `CRON_SECRET`, CF টোকেনগুলো আসলে সেট করা আছে কি না দেখা হয়নি (secret মান প্রিন্ট নিষিদ্ধ) — fail-open/fail-closed আচরণ প্রোডাকশনে কোন দিকে যাবে তা env-নির্ভর।
- **`workers/report-cron`** (cron/report কমেন্টে উল্লিখিত Worker) রিপোজিটরিতে আছে কি না ও সেটি কীভাবে সেক্রেট পাঠায়, তা যাচাই করা হয়নি।
- **`public/sw.js` ও PWA ক্যাশ** কী কী API রেসপন্স ক্যাশ করে (সংবেদনশীল ডেটা শেয়ার্ড ক্যাশে পড়ে কি না) — এই ধাপের স্কোপের বাইরে; পরের ধাপে দেখা উচিত।
- **KV-স্তরের নিরাপত্তা**: `jx_store_state`-এর মতো কী-তে সরাসরি REST কলের মাধ্যমে টোকেন দিয়ে পড়া-লেখা সম্ভব কি না (টোকেনের scope), তা পরীক্ষা করা হয়নি।
- **admin পেজগুলোর সম্পূর্ণ API-ম্যাট্রিক্স**: প্রতিটি admin পেজের প্রতিটি কল না মিলিয়ে প্রতিনিধিত্বশীল কলারগুলোই (AdminAiFab, AdminSidebar, admin/orders, admin/gallery, admin/page) যাচাই করা হয়েছে; কোনো অ্যাডমিন-পেজ কোনো "public" রুটে অন্যরকম ডেটা আশা করে কি না (যেমন GET /api/products-এ `costPrice`) পুরোপুরি এনুমারেট করা হয়নি — allowlist চূড়ান্ত করার সময় প্রতিটি admin পেজ একবার smoke-টেস্ট করা দরকার।

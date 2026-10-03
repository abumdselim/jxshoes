# P6 — ইউজার, রোল, সেশন, অডিট: কোর-লায়ব্রেরি + ওয়্যারিং পরিকল্পনা

তারিখ: 2026-10-03 • ব্রাঞ্চ: `feat/p6-roles-sessions` • স্পেক: `docs/prompts/shopkeeper-professionalization-prompts.md` §P6 (S3, A4)

## ১. এই রাউন্ডে যা হলো (কোর-লায়ব্রেরি — কোনো রুট/মিডলওয়্যার স্পর্শ নেই)

| ফাইল | বিষয় |
|---|---|
| `migrations/0003_users_sessions.sql` | `sessions` টেবিল (token_hash, device_label, expires_at, revoked_at)। `users` (password_hash + role CHECK 'owner'/'manager'/'salesman') ও `audit_log` টেবিল **0001_init.sql-এই ডিজাইনে ছিল** — নতুন করে বানানো হয়নি |
| `src/lib/auth/crypto.ts` | Web Crypto প্রিমিটিভ: SHA-256 hex, HMAC-SHA256, random, base64url, ধ্রুব-সময় তুলনা — Node crypto জিরো |
| `src/lib/auth/password.ts` | PBKDF2-SHA256 হ্যাশ/ভেরিফি (প্রতি-ইউজার ১৬B salt, ভার্সনড স্টোর-ফরম্যাট `pbkdf2$<iter>$<salt>$<hash>`) |
| `src/lib/auth/session.ts` | সেশন-টোকেন `v1.<id>.<random256bit>.<hmac>` — তৈরি/যাচাই/একক-রিভোক/সব-ডিভাইস-রিভোক/ডিভাইস-তালিকা/last_used; ডিবিতে টোকেন নয় শুধু SHA-256 হ্যাশ |
| `src/lib/auth/roles.ts` | রোল-মডেল (0001-এর enum অনুসারে: owner/manager/salesman), অ্যাকশন-ম্যাট্রিক্স, `can()`, `requirePermission(request, exec, action)` — adminAuth.requireAdmin-এর চুক্তির উত্তরসূরি (null = অনুমতি; 401/403 JSON), `getSessionContext()`, `costPriceVisible()` |
| `src/lib/auth/audit.ts` | `writeAudit()` — কে/কখন/কী/আগে-পরে diff; **ব্যর্থ হলেও throw নয়, মূল অপ আটকায় না** (boolean ফেরত) |
| টেস্ট (৪ ফাইল) | ৩৩ নতুন টেস্ট — password (৭), session (১১), roles (৮), audit (৫ + ২ describe-স্প্লিট); d1Local + আসল migration-চালনায় |

**যাচাই:** `npx tsc --noEmit` = 0 ত্রুটি • `npm run lint` = পরিষ্কার • `npm test` = **১০৩ পাস** + ১৩ todo (আগের ৭০ অক্ষত)।

## ২. Backward-compat চুক্তি

- `src/middleware.ts` ও `src/app/api/admin-login/route.ts` **এই রাউন্ডে এক অক্ষরও বদলায়নি** — এক-অ্যাডমিন `ADMIN_PASSWORD` → `sk_admin` = SHA-256(password) কুকি-ফ্লো হুবহু আগের মতো চলবে।
- নতুন স্তর **opt-in**: `sessions` টেবিল খালি থাকলে অ্যাপের কোনো আচরণ বদলায় না; `src/lib/auth/**` কেউ ইমপোর্ট করছে না।
- কুকি-নাম আলাদা (`sk_session` ≠ `sk_admin`) — দুই ফ্লো সমান্তরালে সহাবস্থান করতে পারে (মাইগ্রেশন উইন্ডোতে দরকার)।
- ফেইল-মোড: legacy dev-ফেইল-ওপেন (ADMIN_PASSWORD unset = খোলা) অস্পৃশ্য; নতুন সেশন-স্তর সবসময় **fail-closed** — সাইনিং-কি না থাকলে যাচাই false, তৈরি throw।

## ৩. PBKDF2 iteration সিদ্ধান্ত (স্পেকের বাধ্যতামূলক যাচাই-নোট)

- **যাচাইকৃত সীমা:** Cloudflare-এর workerd রানটাইম `crypto.subtle` PBKDF2-এ **~১,০০,০০০ iteration ছাড়ালে throw করে** ("iteration counts above 100000 are not supported")। Cloudflare-স্টাফ/কমিউনিটি-উত্তর ও একাধিক ইন্ডিপেনডেন্ট ডেভেলপার-রিপোর্ট (২০২১→২০২৬) একবাক্যে; OWASP-এর PBKDF2-SHA256 সুপারিশ (৬,০০,০০০) Workers-এ চলে না — সাম্প্রতিক ৬,০০,০০০-চেষ্টা-থ্রেডও ক্যাপেই আটকেছে। অফিশিয়াল limits/নোটস পেজে আলাদা করে সংখ্যা আর লেখা নেই — ক্যাপ runtime-এ বসবাস করে।
- **সিদ্ধান্ত:** `PBKDF2_ITERATIONS = 100_000` (workerd-অনুমোদিত সর্বোচ্চ) + প্রতি-ইউজার এলোমেলো salt + P1-এর লগইন-রেট-লিমিট (৫/১৫মিনিট/IP) + ২৫৬-বিট পাসওয়ার্ড-স্বাধীন সেশন-টোকেন — কম iteration-এর ঝুঁকি এভাবে কম্পেনসেট। হ্যাশ-স্ট্রিং-এ iteration সেভ হয়, ভবিষ্যতে ক্যাপ বাড়লে ধাপে ধাপে বাড়ানো যাবে (লগইনে rehash পথ)।
- OWASP-গ্রেড KDF সত্যিই দরকার হলে: (ক) WASM argon2id (বান্ডল ~১০-৪০KB, CPU 30s পেইড-প্ল্যানে), (খ) ক্লায়েন্ট-সাইড প্রি-হ্যাশ + সার্ভার-সাইড পেপার, বা (গ) হ্যাশিং আলাদা Worker/সার্ভিসে — আলাদা ADR ছাড়া করা হবে না।

## ৪. ওয়্যারিং ধাপ (মালিকের OK-র অপেক্ষায় — পরের রাউন্ডের কাজ)

### ধাপ ০ — সিক্রেট
- নতুন সিক্রেট `SESSION_SECRET` (≥৩২ র‍্যান্ডম অক্ষর) — GitHub Secret + deploy.yml-এর "Generate runtime env"-এ GENERATED_ENV কি হিসেবে যোগ।
- ঘূর্ণন: কি বদলালে সব কুকি অবৈধ (ডিবি-রেকর্ড অক্ষত) — ইচ্ছাকৃত; SESSION_SECRET বাদ দিলে ADMIN_PASSWORD থেকে ডেরাইভ-ফলব্যাক আছে (admin-পাস বদলালেও সব সেশন মরে — ডকুমেন্টেড আচরণ)।

### ধাপ ১ — মালিক-অ্যাকাউন্ট বুটস্ট্র্যাপ (P6-স্পেক আইটেম ৮)
- `admin-login` ডুয়াল-মোড: সঠিক ADMIN_PASSWORD-এ লগইন সফল হলে **এবং** `users` টেবিলে মালিক না থাকলে → ওই মুহূর্তেই owner-ইউজার রেকর্ড তৈরি (PBKDF2 হ্যাশ) + প্রথম `sk_session` ইস্যু; legacy `sk_admin` কুকিও পাঠানো হবে ট্রানজিশন-উইন্ডোতে।
- একবার মালিক-অ্যাকাউন্ট আছে → admin-login শুধু users-টেবিল-পাথ চালাবে; ADMIN_PASSWORD সিক্রেট অবসর (ব্রেক-গ্লাস)।
- বিকল্প (স্ক্রিপ্ট-পথ): `scripts/`-এ one-off বুটস্ট্র্যাপ — প্লেইন পাসওয়ার্ড কমিট নয়, প্রম্পটে নেবে।

### ধাপ ২ — গেট-সুইচ (requireAdmin → requirePermission)
প্রতিটি রুটে ৩-লাইনের মেকানিক্যাল বদল (P1-অডিটের ৩৪ অথহীন method-এর ম্যাপ; action-ম্যাট্রিক্স `roles.ts`-এ এক জায়গায়):

| রুট | action |
|---|---|
| `products POST`, `[id] PUT` | `products:write` |
| `products/[id] DELETE` | `products:delete` |
| `products/[id] GET` (admin-কনটেক্সট) | `products:read` + costPriceVisible() ছাড়া costPrice বাদ |
| `inventory GET/POST` | `inventory:write` |
| `categories POST` / `[id] DELETE`, `coupons *`, `marketing POST`, `media-library *`, `upload POST` | যথাক্রমে `products:write`-জাত / `coupons:manage` / `marketing:manage` / `media:manage` |
| `customers *`, `customers/payment POST` | `customers:manage` |
| `orders GET(admin)`, `[id] PATCH`, `pos/sale`, `pos/undo-auto` | `orders:read` / `orders:update` / `pos:sale` |
| `reports GET`, `finance GET`, `analytics/fast-movers GET` | `reports:read` / `reports:finance` / `reports:read` |
| `expenses GET/POST/DELETE` | `expenses:manage` |
| `notifications GET/PUT/DELETE` | `customers:manage` (গ্রাহক-অভিযোগ ডেটা) |
| `settings POST` | **owner-অন্যথায় 403** (ম্যাট্রিক্সে manager/salesman-কে দেওয়া হয়নি) |
| নতুন `auth/` রুটগুলো (login/logout/devices/logout-all) | লগইন public; বাকিগুলো বৈধ-সেশন যথেষ্ট |
| `ai`, `sync`, `cron` | প্রথম পর্যায়ে requireAdmin-রকিবী — পরে `reports:read`/`audit:read` পর্যায়ে নামবে |

### ধাপ ৩ — middleware (সবার শেষে)
- `PUBLIC_API_RULES` অপরিবর্তিত + `/api/auth/*` পাবলিক-লগইন যোগ; middleware কুকি-চেকে `sk_admin` **অথবা** `sk_session` মানবে (verifySessionToken ডিবি-হিট — middleware ভারী হয়ে যায় বলে প্রথম পর্যায়ে রুট-গেটই প্রধান প্রতিরক্ষা, middleware-চেক edge-cache সময় পুরোনো সেশন ধরতে পারে — নোট করা হলো)।
- `/admin/*` পেজ-রিডাইরেক্ট লজিক একই — শুধু কুকি-যাচাইয়ের শাখা দুটি।

### ধাপ ৪ — CSRF (P6-স্পেক আইটেম ৩)
- middleware-এ সব mutating method (POST/PUT/PATCH/DELETE)-এ `Origin`/`Referer`-হোস্ট সাদৃশ্য-চেক `Host`/`X-Forwarded-Host`-এর সাথে; অমিলে 403। SameSite=Lax কুকি ইতোমধ্যে বেশিরভাগ ক্রস-সাইট POST আটকে দেয় — চেকটি দ্বিতীয় স্তর। পাবলিক চেকআউট (orders POST) ক্রস-অরিজিন কি না আগে মাপা লাগবে।

### ধাপ ৫ — লগআউট/ডিভাইস-তালিকা API ও UI
- `POST /api/auth/logout` (একক সেশন revoke), `POST /api/auth/logout-all` (revokeAllSessions), `GET /api/auth/devices` (listActiveSessions) — তিনটাই requirePermission-ছাড়া, বৈধ-সেশন যথেষ্ট। UI: অ্যাডমিন-সেটিংসে "সক্রিয় ডিভাইস" তালিকা (device_label, created_at, last_used_at)।
- অডিট-ইভেন্ট: `login`/`logout`/`login_failure` (entity 'auth'), `price_change`/`stock_adjust`/`discount`/`reversal`/`delete` — writeAudit কল-সাইটগুলো রুট-সুইচের সাথেই বসবে।

## ৫. ৪-ডিজিট PIN (স্পেক আইটেম ৫) — ডিজাইন-নোট (এই রাউন্ডে বাস্তবায়ন নেই)
- PIN দিয়ে সেশন **শুরু হয় না** — সক্রিয় সেশনের ওপরে শুধু দ্রুত শিফট-বদল পরিচয়-সুইচ। চার-ডিজিটের স্পেস (১০⁴) PBKDF2-হ্যাশ দিয়েও ব্রুট-ফোর্স-অযোগ্য নয়, তাই: প্রতি user+device কি-তে রেট-লিমিট (৫ ব্যর্থ → ১৫মিনিট লক), ব্যর্থ-চেষ্টা audit_log-এ, PIN হ্যাশ = PBKDF2 (একই password.ts, নিজের salt)।
- POS-এ সেশন-ইউজার ↔ পিন-ইউজার মিলবে না হলে সেশনের রোলই প্রযোজ্য থাকবে — পরিচয়-সুইচ নতুন সেশন-টোকেন ইস্যু করবে।

## ৬. অফলাইন লগইন (স্পেক আইটেম ৭) — আলাদা নোট, বাস্তবায়ন P8-এ
- স্কেচ: লগইন-সফল সেশন ডিভাইসে IndexedDB-তে বাঁধা (deviceId-bound); অফলাইনে শুধু লোকাল PIN (device-রেজিস্টার্ড, সার্ভার-হ্যাশের লোকাল কপি) দিয়ে ইউজার-পরিচয় সুইচ; সার্ভার অনলাইনে ফিরলে সেশন রি-ভ্যালিডেট + অডিট-রিপ্লে। পূর্ণ চুক্তি P8-এর sync-রিভিউয়ের সাথে মিলিয়ে আলাদা ডক হবে।

## ৭. ঝুঁকি / পরের রাউন্ডের চেক-তালিকা
- `deploy.yml`-এ SESSION_SECRET যোগ করা হবে কি না — মালিক-সিদ্ধান্ত।
- D1-পাথ না চালু দোকানে (KV-only) নতুন স্তর চালু করা যায় না — auth lib ইচ্ছাকৃতভাবে SqlExecutor-নির্ভর (P5-এর ইন্টারফেস)।
- login_failure-এ entity_id-তে কাঁচা ফোন/শনাক্তকারী যায় — অডিট-পড়ার অনুমতি owner-এই তাই গ্রহণযোগ্য; ইচ্ছা হলে মাস্কিং।
- মাইগ্রেশন 0003 প্রয়োগ: `wrangler d1 execute shopkeeper-db --file=migrations/0003_users_sessions.sql --remote` (লোকাল টেস্টে `--local`) — এটি প্রয়োগ করলেই অ্যাপের কোনো আচরণ বদলায় না (§২)।

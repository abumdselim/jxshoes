# ট্র্যাক B — P6: ইউজার, রোল, সেশন, অডিট (S3, A4)

- **Worktree:** `D:\1. Data Center\JxShoes-p6` | **ব্রাঞ্চ:** `feat/p6-roles-sessions` (base: `feat/offline-hardening`)
- **লক্ষ্য:** এক-অ্যাডমিন-পাসওয়ার্ডের ওপর রোল/সেশন/অডিট স্তর — পুরনো ফ্লো ভাঙা নিষেধ।

## ধাপ ১ (এই রাউন্ড) — কোর লাইব + স্কিমা + টেস্ট
1. আগে পড়ো: `AGENTS.md`, `docs/DB_SCHEMA.md` ও `migrations/0001_init.sql`
   (users/sessions/audit_logs টেবিল ইতিমধ্যে ডিজাইনে আছে কি না আগে যাচাই —
   থাকলে সেটাই ফলো, না থাকলে `migrations/0003_users_sessions.sql` নতুন),
   `docs/audits/p1-api-route-audit.md`, `src/lib/adminAuth.ts` + টেস্ট, `src/middleware.ts`,
   `src/app/api/admin-login/route.ts`, `src/lib/d1.ts`, `src/lib/d1Local.ts`।
2. বানাও (`src/lib/auth/`-এ):
   - পাসওয়ার্ড হ্যাশ — **PBKDF2 Web Crypto** (edge runtime; Node crypto নিষিদ্ধ)।
   - সেশন টোকেন — র‍্যান্ডম + HMAC-SHA256 সাইন, expiry, টেবিলে সেশন রেকর্ড।
   - রোল মডেল — সরল: `owner` / `manager` / `staff` + প্রতি-অ্যাকশন গেট হেল্পার।
   - অডিট-লগ রাইটার — কে, কী, কখন, কোন রাউট; ব্যর্থ হলে মূল অপ আটকাবে না।
   - D1-নির্ভর স্টোরেজ (`src/lib/d1.ts` এক্সিকিউটর); টেস্ট d1Local দিয়ে।
3. **backward-compat বাধ্যতামূলক:** এক-অ্যাডমিন `ADMIN_PASSWORD` কুকি-ফ্লো আগের মতোই
   কাজ করবে; নতুন স্তর opt-in (env/ফ্ল্যাগ)। `middleware.ts` ও লগইন-রাউট **এই রাউন্ডে
   ওয়্যার করবে না** — শুধু পরিকল্পনা `docs/audits/p6-wiring-plan.md`-এ।
4. টেস্ট: সেশন lib + রোল-গেট + অডিট রাইটার (vitest) — নতুন টেস্ট + আগের ৭০ সব সবুজ।

## নিয়ম
- শুধু নিজের স্কোপের ফাইল; স্ট্যাটাস-ডক/ROADMAP ছোঁবে না। কোনো সিক্রেট কমিট নয়।
- শেষে: `npx tsc --noEmit` + `npm run lint` + `npm test` সবুজ → কমিট এই ব্রাঞ্চে। **push নয়।**

## ধাপ ২ (পরের রাউন্ড, মালিকের OK-তে)
মিডলওয়্যার + লগইন-রাউট ওয়্যারিং, UI (স্টাফ ম্যানেজমেন্ট স্ক্রিন), অডিট-ভিউ — P5-এর
D1-সুইচের সাথে জোটানো।

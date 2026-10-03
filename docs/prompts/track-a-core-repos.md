# ট্র্যাক A — P5 কোর: D1 রিপো লেয়ার (ফেজ ২.০ চলমান)

- **Worktree:** `D:\1. Data Center\JxShoes-core` | **ব্রাঞ্চ:** `feat/core-repos` (base: `feat/offline-hardening`)
- **লক্ষ্য:** P5-এর বাকি ডোমেইন-রিপো + পরে STORE_BACKEND রাউট-সুইচ। `orders.ts` রেফারেন্স।

## ধাপ ১ (এই রাউন্ড) — রিপো + টেস্ট
1. আগে পড়ো: `AGENTS.md`, `docs/DB_SCHEMA.md`, `migrations/0001_init.sql`,
   `src/lib/d1.ts`, `src/lib/d1Local.ts`, `src/lib/repos/orders.ts` (রেফারেন্স প্যাটার্ন),
   `src/lib/repos/replicate.ts`, বিদ্যমান রিপো-টেস্ট, `src/lib/store.ts`-এর KV-আচরণ।
2. বানাও: `src/lib/repos/products.ts`, `src/lib/repos/customers.ts` (+ দরকারে inventory
   movements) — orders.ts-এর মতোই: টাকা ×১০০ পয়শা, গার্ডেড/অ্যাটমিক স্টক-ডিক্রিমেন্ট,
   নেগেটিভ-স্টক নীতি উভয় মোড, checksum-যোগ্য।
3. টেস্ট: `src/lib/repos/*.test.ts` (d1Local, node:sqlite) — নতুন টেস্ট + আগের ৭০ সব সবুজ।
4. রাউট-সুইচ **কোডে করো না** — শুধু পরিকল্পনা: `docs/audits/p5-route-switch-plan.md`
   (কোন রাউট → কোন রিপো, STORE_BACKEND ফ্ল্যাগ, রোলআউট/ফলব্যাক)।

## নিয়ম
- শুধু নিজের স্কোপের ফাইল; `store.ts`/রাউট/offline/স্ট্যাটাস-ডক ছোঁবে না।
- edge-runtime-নিরাপদ কোড (Web Crypto, Node-only API নয়); কমেন্ট ফাইলের ভাষায়।
- শেষে: `npx tsc --noEmit` + `npm run lint` + `npm test` সবুজ → নিজের ফাইল `git add` করে
  কমিট এই ব্রাঞ্চে। **push নয়।**

## ধাপ ২ (পরের রাউন্ড, মালিকের OK-তে)
STORE_BACKEND=kv|d1 ফ্ল্যাগ + রাউট-ওয়্যারিং (ধাপ ১-এর প্ল্যান-ডক অনুযায়ী) → P8 idempotency
(সার্ভার-ডিডাপ + deviceId, ব্যাচ push/pull)।

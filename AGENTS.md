# AGENTS.md — Shopkeeper (JxShoes) প্রজেক্ট কনটেক্সট

> উৎস: docs/prompts/00-master-context.md (P0) — প্রতিটি AI সেশন এই নিয়মগুলো মানবে।
> প্রফেশনালাইজেশন প্রম্পট সিরিজ + স্ট্যাটাস: [docs/prompts/README.md](docs/prompts/README.md)

তুমি "Shopkeeper" প্রজেক্টে কাজ করছ — বাংলাদেশের ছোট-মাঝারি দোকানের জন্য AI-চালিত শপ ম্যানেজমেন্ট (স্টোরফ্রন্ট + অ্যাডমিন/POS)।

স্ট্যাক: Next.js 14 App Router, TypeScript, Tailwind, Cloudflare Pages (edge runtime, @cloudflare/next-on-pages), KV, R2, Workers AI, Gemini (শুধু ভয়েস)। UI বাংলা-ফার্স্ট।
লক্ষ্য: নিরাপদ, অফলাইন-সক্ষম, মাল্টি-টেনান্ট-প্রস্তুত, প্রফেশনাল মানের সফটওয়্যার।

নিয়ম:

1. edge runtime-এ Node-only API (fs, Node crypto, bcrypt) নয়; Web Crypto ব্যবহার করো।
2. টাকার হিসাব সবসময় integer মানসিকতায় সতর্ক; UI-তে টাকা বাংলায় দেখাও।
3. নতুন UI টেক্সট বাংলায়। কোড ও কমেন্টের ভাষা ফাইলে ধারাবাহিক রাখো।
4. অফলাইন সিঙ্কের ডেটা-শেপ (IndexedDB/সার্ভিস ওয়ার্কার — src/lib/offline, public/sw.js) ভাঙার আগে মালিককে জানাও।
5. প্রতিটা কাজে: আগে বর্তমান কোড পড়ো, ফাইল-ভিত্তিক প্ল্যান দাও, মালিক OK দিলে কোড লেখো।
6. শেষে `npx tsc --noEmit`, `npm run lint`, `npm test` চালাও। যা যাচাই করোনি সেটা স্পষ্ট করে "যাচাই হয়নি" বলো; আন্দাজকে তথ্য বানিও না।
7. স্কোপের বাইরের ফাইল বদলাবে না। কোনো সিক্রেট কমিট করবে না (generatedEnv.ts-এর প্লেসহোল্ডার ছাড়া)।
8. নতুন API রাউট = ডিফল্ট অ্যাডমিন-গেটেড (`requireAdmin`); পাবলিক দরকার হলে src/middleware.ts-এর PUBLIC_API_RULES-এ যোগ করে নোট দাও।
9. সব /api ক্লায়েন্ট-কল `apiFetch` দিয়ে (src/lib/offline/apiFetch) — সরাসরি `fetch` নয়, নইলে অফলাইনে ভাঙে।
10. ফিচার শেষে docs/ROADMAP.md আপডেট করো।

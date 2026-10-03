# D1 Migrations (P4)

স্কিমার সিদ্ধান্ত ও ম্যাপিং: [docs/DB_SCHEMA.md](../docs/DB_SCHEMA.md) — টাকা সবসময় **পয়শায়** (×১০০), লেজার-টেবিল append-only, ক্যাশড ব্যালেন্স লেনদেনে `+= delta`।

## প্রয়োগ

```bash
# ১) Cloudflare-এ D1 ডেটাবেস তৈরি (একবার):
wrangler d1 create shopkeeper-db
# রিটার্ন করা database_id নোট করুন — P5-এর বাইন্ডিং-সেটআপে লাগবে

# ২) স্কিমা:
wrangler d1 execute shopkeeper-db --file=migrations/0001_init.sql --remote
# লোকাল টেস্টে: --local

# ৩) ডেমো-সিড (initialData থেকে):
npx tsx scripts/seed-d1.ts > migrations/seed_demo.sql
wrangler d1 execute shopkeeper-db --file=migrations/seed_demo.sql --remote

# ৪) যাচাই:
wrangler d1 execute shopkeeper-db --command "SELECT (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM product_variants) AS variants, (SELECT COUNT(*) FROM customers) AS customers, (SELECT COUNT(*) FROM coupons) AS coupons;" --remote
```

**নোট:** এই মাইগ্রেশন/সিড প্রয়োগ করলেই অ্যাপ D1 ব্যবহার করা শুরু করবে **না** — অ্যাপ এখনো KV-তে চলে। D1-কে লাইভ করা P5-এর কাজ (`STORE_BACKEND=kv|d1` ফিচার-ফ্ল্যাগ + রিপোজিটরি লেয়ার + চেকসামসহ KV→D1 মাইগ্রেশন স্ক্রিপ্ট)।

# Shopkeeper রিপোর্ট Cron Worker

প্রতি **সোমবার সকাল ৮টা** (সাপ্তাহিক) ও **মাসের ১ তারিখ সকাল ৮টা** (মাসিক) — বাংলাদেশ সময় —
AI বিজনেস রিপোর্ট অটোমেটিক তৈরি হয়ে ক্লায়েন্টের ইমেইলে চলে যায়।

Worker-এর কাজ শুধু ঘড়ির মতো কল করা — রিপোর্ট তৈরি, সেভ, ইমেইল সব মূল অ্যাপের
`/api/cron/report` এন্ডপয়েন্ট করে (যাতে AI লজিক এক জায়গায় থাকে)।

## একবারের সেটআপ

```bash
cd workers/report-cron

# ১. wrangler.jsonc-তে SITE_URL আপনার Pages ডোমেইন করুন (shopkeeperbd.pages.dev বা কাস্টম ডোমেইন)

# ২. সিক্রেট বসান (মূল অ্যাপের CLOUDFLARE_API_TOKEN আলাদা রাখতে যেকোনো র‍্যান্ডম স্ট্রিং দিন)
npx wrangler secret put CRON_SECRET

# ৩. একই মান Pages প্রজেক্টের env-এও দিন:
#    Cloudflare Dashboard → Pages → shopkeeperbd → Settings → Environment Variables → CRON_SECRET

# ৪. ডেপ্লয়
npx wrangler deploy
```

## টেস্ট

```bash
# ম্যানুয়ালি ট্রিগার (রিপোর্ট তৈরি হবে, কিন্তু 'auto' মোডে অন্য দিনে skip করবে)
curl "https://shopkeeperbd.pages.dev/api/cron/report?type=weekly&send=0" -H "x-cron-secret: আপনার-সিক্রেট"

# ইমেইলসহ ফোর্স
curl "https://shopkeeperbd.pages.dev/api/cron/report?type=weekly&to=client@example.com" -H "x-cron-secret: আপনার-সিক্রেট"
```

## ইমেইল চালু করতে (আগে করতে হবে)

1. ডোমেইন Cloudflare-এ যোগ করে Email Sending চালু: `npx wrangler email sending enable yourdomain.com`
2. Pages প্রজেক্টের API টোকেনে **Email Sending** পারমিশন
3. Pages env: `EMAIL_FROM_ADDRESS` (যেমন `reports@yourdomain.com`)
4. ক্লায়েন্টের ইমেইল সেটিংস পেজের "সাপোর্ট ইমেইল" ফিল্ডে ঠিক আছে কিনা দেখুন

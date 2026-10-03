/**
 * ক্যারেক্টারাইজেশন তালিকা (P2 পরিকল্পনার §৫) — observed-wrong আচরণ যেগুলো এখনই ফিক্স করা হয়নি।
 * যেগুলোর আচরণ ইতিমধ্যে নিজ নিজ টেস্টে স্পষ্ট-নাম করে লক করা আছে, সেগুলো এখানে it.todo হিসেবে
 * নিবন্ধিত — ট্রিয়াজের পরে যেটা ফিক্স হবে, তার টেস্ট তখন উল্টে যাবে।
 */
import { describe, it } from 'vitest';

describe('P2 ক্যারেক্টারাইজেশন/TODO রেজিস্টার (docs/audits/p2-test-plan.md §৫)', () => {
  it.todo('রেকর্ডডিউপেমেন্ট ওভার-পেমেন্ট: অতিরিক্ত টাকা advance/credit হিসেবে জমা হয় না — লক করা আছে store.ledger.test.ts');
  it.todo('রেকর্ডডিউপেমেন্ট min-1 ক্ল্যাম্প: ৳0/নেগেটিভ ৳১ হয়ে যায় — লক করা আছে store.ledger.test.ts');
  it.todo('কুপনে expiryDate/usageLimit ফিল্ড ও লজিক নেই — টাইপ+ভ্যালিডেশন এক্সটেনশন দরকার');
  it.todo('fixed কুপন total-ক্যাপ নেই — লক করা আছে store.pricing.test.ts (P1-এ সার্ভার-রিকম্পিউট এসেছে, ক্যাপ বাকি)');
  it.todo('POS/অনলাইন ওভারসেল সাইলেন্ট ক্ল্যাম্প — P4-এর নেগেটিভ-স্টক নীতির সিদ্ধান্তের অপেক্ষায় (লক: store.pos.test.ts)');
  it.todo('stockCount drift: মিরর re-calc (ভ্যারিয়েন্ট-যোগফল) বনাম সার্ভার decrement — drift-detector টেস্ট P4-এর রিপো লেয়ারে');
  it.todo('ASR হাইফেন-অজ্ঞেয়বাদী নরমালাইজেশন — লক করা আছে saleMatch.test.ts');
  it.todo('অর্ডার-আইডি/নম্বর কোলিশন (Date.now/র‍্যান্ডম) — P4-এর ULID + ডিভাইস-প্রিফিক্স ইনভয়েসে সমাধান');
  it.todo('POS অফলাইন-রিপ্লে body-শেপ (body.options বনাম flat) — appliers রুট-প্রতি রিডিউসার extraction-এর সাথে যাচাই হবে');
  it.todo('computeFinanceSummaryFromData-তে খরচ পিরিয়ড-ফিল্টারহীন — ইচ্ছাকৃত কি না মালিকের সিদ্ধান্ত');
  it.todo("dayKey 'en-CA' টাইমজোন-নির্ভর — টেস্ট TZ=UTC ফিক্স করেছে; স্পষ্ট UTC পার্সিং TODO");
  it.todo('middleware ও adminAuth-এ sha256/কুকি-লজিক ডুপ্লিকেট — শেয়ার্ড হেল্পারে আনা TODO');
  it.todo('আনকনফিগার্ড পাসওয়ার্ডে fail-open — লক করা আছে adminAuth.test.ts; ডিপ্লয়-চেক P3-এর সাথে');
});

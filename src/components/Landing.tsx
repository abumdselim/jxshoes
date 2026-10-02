'use client';

/**
 * Shopkeeper ল্যান্ডিং পেজ
 * ------------------------
 * সেকশন: হিরো → ডিভাইস শোকেস (ডেস্কটপ/ট্যাব/মোবাইল ট্যাব) → ফিচার
 * (ইন্টারেক্টিভ ট্যাব) → কীভাবে কাজ করে → কেন Shopkeeper → CTA → ফুটার।
 * সব মকআপ pure CSS/div — কোনো স্ক্রিনশট নেই, তাই সব রেজোলিউশনে ঝকঝকে।
 */

import React, { useState } from 'react';
import {
  ArrowRight,
  Bot,
  Boxes,
  Bell,
  Calculator,
  CheckCircle2,
  Cloud,
  Gauge,
  Images,
  Languages,
  Monitor,
  ShoppingCart,
  Smartphone,
  Tablet,
  Users,
  Zap,
  Receipt,
  ShieldCheck,
  Layers,
} from 'lucide-react';

/* ── ডেটা ── */

const FEATURES = [
  {
    key: 'storefront',
    icon: ShoppingCart,
    title: 'অনলাইন স্টোরফ্রন্ট',
    tagline: 'আকর্ষণীয়, দ্রুত ও মোবাইল-বান্ধব ই-কমার্স শপ',
    description:
      'প্রোডাক্ট ক্যাটালগ, ক্যাটাগরি ফিল্টার, সার্চ, কার্ট, চেকআউট, কুপন কোড ও ফ্ল্যাশ ডিল — কাস্টমারের জন্য সম্পূর্ণ ই-কমার্স অভিজ্ঞতা, আপনার জন্য শূন্য ঝামেলা।',
    points: ['কুপন ও ডিসকাউন্ট কোড', 'ফ্ল্যাশ ডিল টাইমার', 'bKash/Nagad ও ক্যাশ অন ডেলিভারি'],
  },
  {
    key: 'orders',
    icon: Receipt,
    title: 'অর্ডার ম্যানেজমেন্ট',
    tagline: 'প্রতিটি অর্ডারের সম্পূর্ণ পাইপলাইন এক জায়গায়',
    description:
      'নতুন অর্ডার আসামাত্র নোটিফিকেশন পান। পেন্ডিং থেকে ডেলিভারি পর্যন্ত স্ট্যাটাস আপডেট, প্রফেশনাল ইনভয়েস প্রিন্ট, কাস্টমারকে সরাসরি কল বা WhatsApp মেসেজ — সব এক ক্লিকে।',
    points: ['স্ট্যাটাস পাইপলাইন ও ইনভয়েস', 'কল/WhatsApp দ্রুত যোগাযোগ', 'নতুন অর্ডারে তাৎক্ষণিক নোটিফিকেশন'],
  },
  {
    key: 'pos',
    icon: Zap,
    title: 'POS কুইক-সেল',
    tagline: 'দোকানে বসে সেকেন্ডেই বিক্রি এন্ট্রি',
    description:
      'প্রোডাক্ট কোড বা ভয়েস কমান্ড দিয়ে দ্রুত বিক্রি এন্ট্রি করুন — স্টক অটোমেটিক কাটবে, কাস্টমার খাতা আপডেট হবে, বাকি হলে খাতায় চলে যাবে।',
    points: ['ভয়েস কমান্ডে বিক্রি', 'অটো স্টক ডিডাক্ট', 'বাকি/নগদ দুটোই সাপোর্টেড'],
  },
  {
    key: 'inventory',
    icon: Boxes,
    title: 'ইনভেন্টরি ও স্টক ERP',
    tagline: 'প্রতিটি পিসের হিসাব — বারকোড থেকে রিস্টক পর্যন্ত',
    description:
      'বারকোড ও SKU ব্যবস্থাপনা, সাইজ-কালার ভ্যারিয়েন্ট, সাপ্লায়ার খাতা, স্টক মুভমেন্ট হিস্ট্রি এবং স্টক কম হলে স্বয়ংক্রিয় অ্যালার্ট।',
    points: ['বারকোড ও SKU সাপোর্ট', 'স্টক মুভমেন্ট হিস্ট্রি', 'ন্যূনতম স্টক অ্যালার্ট'],
  },
  {
    key: 'customers',
    icon: Users,
    title: 'কাস্টমার ও বাকির খাতা',
    tagline: 'ডিজিটাল বাকির খাতা — কোনো হিসাব আর হারাবে না',
    description:
      'কাস্টমার ডেটাবেজ, কেনাকাটার ইতিহাস, বাকির পরিমাণ ও আদায় ট্র্যাকিং — পুরনো খাতার সব সুবিধা, ডিজিটাল নির্ভুলতায়।',
    points: ['কাস্টমার প্রোফাইল ও ইতিহাস', 'বাকি আদায় ট্র্যাকিং', 'পেমেন্ট রেকর্ড'],
  },
  {
    key: 'finance',
    icon: Calculator,
    title: 'হিসাব ও লাভ-ক্ষতি',
    tagline: 'নিখুঁত P&L — প্রতিটি বিক্রির ক্রয়মূল্য স্ন্যাপশট থেকে',
    description:
      'মোট বিক্রি, ক্রয়মূল্য, খরচের খাতা — সব মিলিয়ে রিয়েল-টাইম লাভ-ক্ষতি। দৈনিক হিসাব টেবিল, খরচের ডোনাট চার্ট আর পিরিয়ড-ভিত্তিক বিশ্লেষণ।',
    points: ['রিয়েল-টাইম গ্রস/নেট প্রফিট', 'খরচের খাতা ও বিভাজন', 'দৈনিক হিসাব টেবিল'],
  },
  {
    key: 'ai',
    icon: Bot,
    title: 'AI সহকারী',
    tagline: 'আপনার দোকানের ডেটা জানা একজন ডিজিটাল ম্যানেজার',
    description:
      'রিয়েল স্টোর-ডেটায় ভিত্তি করে উত্তর দেয় এমন চ্যাট অ্যাসিস্ট্যান্ট, প্রতিদিনের সকাল-ব্রিফিং, গভীর বিজনেস ইনসাইট আর ভয়েস কমান্ডে বিক্রি ও রিস্টক।',
    points: ['ডেটা-ভিত্তিক চ্যাট উত্তর', 'দৈনিক AI ব্রিফিং ও ইনসাইট', 'ভয়েস কমান্ড সাপোর্ট'],
  },
  {
    key: 'gallery',
    icon: Images,
    title: 'মিডিয়া গ্যালারি ও এডিটর',
    tagline: 'সব ছবি এক জায়গায়, এডিটিং ব্রাউজারেই',
    description:
      'সব প্রোডাক্টের ছবি এক গ্রিডে; প্রতিটি ছবিতে বিল্ট-ইন এডিটর — ফ্রি ক্রপ, যেকোনো ডিগ্রিতে রোটেট, ফ্লিপ এবং ব্রাইটনেস/কনট্রাস্ট/স্যাচুরেশন/উষ্ণতা নিয়ন্ত্রণ।',
    points: ['ফ্রি ক্রপ ও রেশিও প্রিসেট', 'যেকোনো ডিগ্রিতে রোটেট', 'কালার ব্যালেন্স নিয়ন্ত্রণ'],
  },
  {
    key: 'notifications',
    icon: Bell,
    title: 'নোটিফিকেশন সেন্টার',
    tagline: 'গুরুত্বপূর্ণ সব খবর সবসময় চোখের সামনে',
    description:
      'নতুন অর্ডার হলেই নোটিফিকেশন; লাইভ ওয়েবসাইট থেকে কাস্টমারের পরামর্শ বা অভিযোগ এলে তা-ও সরাসরি প্যানেলে — কিছুই মিস হবে না।',
    points: ['নতুন অর্ডার অ্যালার্ট', 'কাস্টমার পরামর্শ/অভিযোগ', 'আনরিড ব্যাজ ও ফিল্টার'],
  },
];

const WHY_CARDS = [
  {
    icon: Cloud,
    title: 'শূন্য সার্ভার খরচ',
    description: 'সম্পূর্ণ আপনার নিজের Cloudflare অ্যাকাউন্টে — আলাদা হোস্টিং বা ডেটাবেস বিলের ঝামেলা নেই।',
  },
  {
    icon: Gauge,
    title: 'এজ-স্পিড পারফরম্যান্স',
    description: 'Cloudflare-এর বিশ্বব্যাপী এজ নেটওয়ার্কে চলে — প্রতিটি পেজ দ্রুত, যেকোনো ডিভাইসে।',
  },
  {
    icon: ShieldCheck,
    title: 'নিজের ডেটা, নিজের নিয়ন্ত্রণ',
    description: 'অর্ডার, কাস্টমার ও হিসাবের সব ডেটা আপনার নিজের Cloudflare KV-তে সুরক্ষিত।',
  },
  {
    icon: Languages,
    title: 'বাংলা-ফার্স্ট ইন্টারফেস',
    description: 'সম্পূর্ণ বাংলা ইন্টারফেস — কর্মচারী থেকে ম্যানেজার, সবার জন্য সহজ।',
  },
];

const STEPS = [
  {
    n: '১',
    title: 'অর্ডার আসে',
    description: 'অনলাইন চেকআউট বা দোকানে POS কুইক-সেল — দুই উৎসের বিক্রিই এক সিস্টেমে।',
  },
  {
    n: '২',
    title: 'সবকিছু অটো-আপডেট',
    description: 'স্টক কাটা, কাস্টমার খাতা, হিসাবের এন্ট্রি — ম্যানুয়ালি কিছু করতে হয় না।',
  },
  {
    n: '৩',
    title: 'হিসাব ও পরামর্শ রেডি',
    description: 'লাভ-ক্ষতি, রিপোর্ট আর AI সহকারীর পরামর্শ — সিদ্ধান্ত নেওয়ার জন্য সব হাতের কাছে।',
  },
];

/* ── মিনি অ্যাডমিন মকআপ (pure CSS) ── */

function MiniAdmin() {
  const bars = [28, 44, 22, 56, 38, 30, 62, 48, 34, 90];
  return (
    <div className="flex h-full w-full bg-slate-100 text-left">
      {/* মিনি সাইডবার */}
      <div className="w-8 sm:w-12 bg-slate-900 flex flex-col items-center py-2 gap-1.5 flex-shrink-0">
        <div className="w-4 h-4 sm:w-5 sm:h-5 rounded bg-orange-600 flex items-center justify-center text-[6px] sm:text-[8px] font-black text-white">
          S
        </div>
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div
            key={i}
            className={`w-4 sm:w-6 h-1 rounded-full ${i === 0 ? 'bg-orange-500' : 'bg-slate-700'}`}
          />
        ))}
      </div>
      {/* মূল কনটেন্ট */}
      <div className="flex-1 p-2 sm:p-3 space-y-2 overflow-hidden min-w-0">
        <div className="flex items-center justify-between">
          <div className="h-1.5 w-14 sm:w-24 bg-slate-800 rounded-full" />
          <div className="h-3 sm:h-4 w-10 sm:w-14 rounded bg-orange-600" />
        </div>
        <div className="grid grid-cols-3 gap-1 sm:gap-2">
          {[
            { l: 'মোট বিক্রয়', v: '৳ ১৮,৭৬০' },
            { l: 'অর্ডার', v: '৪টি' },
            { l: 'নেট প্রফিট', v: '৳ ৬,৭৯৮' },
          ].map(s => (
            <div key={s.l} className="bg-white rounded p-1 sm:p-2 shadow-sm">
              <div className="text-[5px] sm:text-[7px] text-slate-400 font-bold truncate">{s.l}</div>
              <div className="text-[7px] sm:text-[10px] font-black text-slate-900 truncate">{s.v}</div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded p-1.5 sm:p-2 shadow-sm flex items-end gap-1 h-12 sm:h-16">
          {bars.map((h, i) => (
            <div
              key={i}
              className={`flex-1 rounded-t-sm ${i === bars.length - 1 ? 'bg-orange-500' : 'bg-orange-200'}`}
              style={{ height: `${h}%` }}
            />
          ))}
        </div>
        <div className="bg-white rounded shadow-sm divide-y divide-slate-100">
          {[
            { n: 'SK-9082', c: 'MD. তানভীর', p: '৳ ৩,৯১০' },
            { n: 'SK-9083', c: 'ফারহানা', p: '৳ ৪,৬২০' },
          ].map(o => (
            <div key={o.n} className="flex items-center gap-1.5 px-1.5 sm:px-2 py-1 sm:py-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
              <span className="text-[6px] sm:text-[8px] font-mono font-bold text-slate-500">{o.n}</span>
              <span className="text-[6px] sm:text-[8px] font-bold text-slate-800 truncate">{o.c}</span>
              <span className="ml-auto text-[6px] sm:text-[8px] font-black text-slate-900">{o.p}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── ডিভাইস ফ্রেম ── */

function DeviceFrame({ device }: { device: 'desktop' | 'tablet' | 'mobile' }) {
  if (device === 'mobile') {
    return (
      <div className="w-52 mx-auto rounded-[2.2rem] border-8 border-slate-800 shadow-2xl overflow-hidden bg-slate-100 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-b-xl z-10" />
        <div className="h-80 pt-5">{<MiniAdmin />}</div>
        <div className="bg-slate-900 h-8 flex items-center justify-center gap-2">
          <div className="w-8 h-1 rounded-full bg-slate-600" />
        </div>
      </div>
    );
  }
  if (device === 'tablet') {
    return (
      <div className="w-full max-w-sm mx-auto rounded-[1.4rem] border-[10px] border-slate-800 shadow-2xl overflow-hidden bg-slate-100">
        <div className="h-64">{<MiniAdmin />}</div>
      </div>
    );
  }
  return (
    <div className="w-full max-w-2xl mx-auto rounded-lg border border-slate-300 shadow-2xl overflow-hidden bg-white">
      <div className="bg-slate-200 px-3 py-2 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="ml-2 flex-1 max-w-xs bg-white rounded-md px-3 py-1 text-[10px] font-mono text-slate-500 truncate">
          shopkeeperbd.pages.dev/admin
        </div>
      </div>
      <div className="h-72 sm:h-80">{<MiniAdmin />}</div>
    </div>
  );
}

const DEVICE_TABS: { key: 'desktop' | 'tablet' | 'mobile'; label: string; icon: React.ElementType }[] = [
  { key: 'desktop', label: 'ডেস্কটপ', icon: Monitor },
  { key: 'tablet', label: 'ট্যাবলেট', icon: Tablet },
  { key: 'mobile', label: 'মোবাইল', icon: Smartphone },
];

/* ── মূল কম্পোনেন্ট ── */

export default function Landing() {
  const [device, setDevice] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [activeFeature, setActiveFeature] = useState(0);
  const feature = FEATURES[activeFeature];
  const FeatureIcon = feature.icon;

  return (
    <div className="min-h-screen bg-white">
      {/* ── নেভ বার ── */}
      <nav className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shopkeeper-logo.png" alt="Shopkeeper" className="h-8 w-auto" style={{ mixBlendMode: 'screen' }} />
          </div>
          <div className="hidden sm:flex items-center gap-6 text-xs font-bold text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">ফিচারসমূহ</a>
            <a href="#devices" className="hover:text-white transition-colors">সব ডিভাইসে</a>
            <a href="#how" className="hover:text-white transition-colors">কীভাবে কাজ করে</a>
          </div>
          <div className="flex items-center gap-2">
            <a href="/shop" className="px-4 py-2 rounded-md border border-white/15 text-slate-200 hover:bg-white/5 text-xs font-bold transition-colors">
              ডেমো শপ
            </a>
            <a href="/admin" className="px-4 py-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors">
              অ্যাডমিন লগইন
            </a>
          </div>
        </div>
      </nav>

      {/* ── হিরো ── */}
      <section className="bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-orange-600/15 via-transparent to-blue-600/10 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20 relative">
          <div className="max-w-3xl animate-fade-up">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] font-bold text-slate-300">
              <Cloud className="w-3.5 h-3.5 text-orange-400" />
              Cloudflare Edge-এ চলমান — সার্ভার ব্যবস্থাপনার ঝামেলা নেই
            </span>
            <h1 className="mt-5 text-3xl sm:text-5xl lg:text-6xl font-black leading-tight tracking-tight">
              আপনার দোকানের{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-amber-300">
                সম্পূর্ণ নিয়ন্ত্রণ
              </span>
              <br className="hidden sm:block" /> — এক প্যানেলেই
            </h1>
            <p className="mt-5 text-sm sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              Shopkeeper একটি আধুনিক ই-কমার্স ও ম্যানেজমেন্ট সিস্টেম — অনলাইন অর্ডার গ্রহণ,
              POS বিক্রি, ইনভেন্টরি, বাকির খাতা, হিসাব-নিকাশ এবং AI সহকারী — সবকিছু একটি
              সুগঠিত কর্পোরেট প্যানেলে।
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/shop"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold shadow-lg shadow-orange-600/25 transition-all"
              >
                লাইভ ডেমো শপ দেখুন
                <ArrowRight className="w-4 h-4" />
              </a>
              <a
                href="/admin"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md border border-white/20 text-slate-100 hover:bg-white/5 text-sm font-bold transition-colors"
              >
                অ্যাডমিন প্যানেল
              </a>
            </div>
          </div>

          {/* ডিভাইস শোকেস */}
          <div id="devices" className="mt-14 sm:mt-20">
            <div className="flex items-center justify-center gap-2 mb-8">
              {DEVICE_TABS.map(d => {
                const DIcon = d.icon;
                return (
                  <button
                    key={d.key}
                    onClick={() => setDevice(d.key)}
                    className={`inline-flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-md text-xs sm:text-sm font-bold border transition-all ${
                      device === d.key
                        ? 'bg-white text-slate-900 border-white'
                        : 'bg-white/5 text-slate-300 border-white/10 hover:bg-white/10'
                    }`}
                  >
                    <DIcon className="w-4 h-4" /> {d.label}
                  </button>
                );
              })}
            </div>
            <div key={device} className="animate-fade-up px-2">
              <DeviceFrame device={device} />
            </div>
            <p className="text-center text-[11px] text-slate-500 mt-4">
              অ্যাডমিন প্যানেল প্রতিটি ডিভাইসে নিখুঁতভাবে মানিয়ে নেয় — ডেস্কটপ, ট্যাবলেট ও মোবাইল।
            </p>
          </div>
        </div>
      </section>

      {/* ── ফিচারসমূহ (ইন্টারেক্টিভ) ── */}
      <section id="features" className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto animate-fade-up">
            <span className="text-xs font-black uppercase tracking-widest text-orange-600">ফিচারসমূহ</span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">
              দোকান চালানোর প্রতিটি দরকারি জিনিস — একটি সিস্টেমে
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-500 leading-relaxed">
              নিচের তালিকা থেকে যেকোনো ফিচারে ক্লিক করুন — বিস্তারিত দেখুন কীভাবে প্রতিটি অংশ আপনার দোকানের কাজ সহজ করে।
            </p>
          </div>

          <div className="mt-10 sm:mt-14 grid lg:grid-cols-[300px_1fr] gap-6">
            {/* ফিচার তালিকা */}
            <div className="flex lg:flex-col gap-2 overflow-x-auto lg:overflow-visible pb-2 lg:pb-0 -mx-4 px-4 lg:mx-0 lg:px-0">
              {FEATURES.map((f, i) => {
                const FIcon = f.icon;
                return (
                  <button
                    key={f.key}
                    onClick={() => setActiveFeature(i)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-md text-left text-xs sm:text-sm font-bold border transition-all whitespace-nowrap lg:whitespace-normal w-auto lg:w-full ${
                      activeFeature === i
                        ? 'bg-slate-900 text-white border-slate-900 shadow-lg'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <FIcon className={`w-4 h-4 flex-shrink-0 ${activeFeature === i ? 'text-orange-400' : 'text-orange-600'}`} />
                    <span className="truncate">{f.title}</span>
                    {activeFeature === i && <ArrowRight className="w-4 h-4 ml-auto flex-shrink-0 hidden lg:block" />}
                  </button>
                );
              })}
            </div>

            {/* বিস্তারিত প্যানেল */}
            <div key={feature.key} className="animate-fade-up bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-10">
              <div className="w-12 h-12 rounded-xl bg-orange-600 flex items-center justify-center">
                <FeatureIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="mt-5 text-xl sm:text-2xl font-black text-slate-900">{feature.title}</h3>
              <p className="text-sm font-bold text-orange-600 mt-1">{feature.tagline}</p>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">{feature.description}</p>
              <div className="mt-6 space-y-2.5">
                {feature.points.map(p => (
                  <div key={p} className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── কীভাবে কাজ করে ── */}
      <section id="how" className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center animate-fade-up">
            <span className="text-xs font-black uppercase tracking-widest text-orange-600">প্রক্রিয়া</span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black text-slate-900 tracking-tight">কীভাবে কাজ করে</h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative bg-slate-50 rounded-2xl border border-slate-200/80 p-6 animate-fade-up" style={{ animationDelay: `${i * 0.12}s` }}>
                <div className="w-11 h-11 rounded-xl bg-orange-600 text-white font-black text-lg flex items-center justify-center">
                  {s.n}
                </div>
                <h3 className="mt-4 font-black text-slate-900">{s.title}</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── কেন Shopkeeper ── */}
      <section className="py-16 sm:py-24 bg-slate-950 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 pointer-events-none" />
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
          <div className="text-center animate-fade-up">
            <span className="text-xs font-black uppercase tracking-widest text-orange-400">কেন Shopkeeper</span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-black tracking-tight">কারণগুলো সহজ — কিন্তু শক্তিশালী</h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {WHY_CARDS.map((w, i) => {
              const WIcon = w.icon;
              return (
                <div
                  key={w.title}
                  className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur animate-fade-up"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="w-11 h-11 rounded-xl bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
                    <WIcon className="w-5 h-5 text-orange-400" />
                  </div>
                  <h3 className="mt-4 font-black">{w.title}</h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">{w.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-24 bg-gradient-to-br from-orange-600 to-orange-700 text-white">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center animate-fade-up">
          <h2 className="text-2xl sm:text-4xl font-black tracking-tight">আজই শুরু করুন</h2>
          <p className="mt-3 text-sm sm:text-base text-orange-100 leading-relaxed">
            লাইভ ডেমো শপে অর্ডার দিয়ে দেখুন সিস্টেমটা কীভাবে কাজ করে — অথবা সরাসরি অ্যাডমিন প্যানেলে ঢুকে দেখুন পেছনের সম্পূর্ণ নিয়ন্ত্রণকেন্দ্র।
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/shop" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-white text-orange-700 text-sm font-black shadow-lg transition-transform hover:-translate-y-0.5">
              ডেমো শপ দেখুন
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/admin" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md border-2 border-white/60 text-white text-sm font-black transition-colors hover:bg-white/10">
              অ্যাডমিন প্যানেল
            </a>
          </div>
        </div>
      </section>

      {/* ── ফুটার ── */}
      <footer className="bg-slate-950 text-slate-400 py-10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/shopkeeper-logo.png" alt="Shopkeeper" className="h-7 w-auto" style={{ mixBlendMode: 'screen' }} />
            <span className="text-[11px]">— দোকানের সম্পূর্ণ ম্যানেজমেন্ট সিস্টেম</span>
          </div>
          <div className="flex items-center gap-5 text-xs font-bold">
            <a href="/shop" className="hover:text-white transition-colors">ডেমো শপ</a>
            <a href="/admin" className="hover:text-white transition-colors">অ্যাডমিন</a>
          </div>
          <p className="text-[11px]">© {new Date().getFullYear()} Shopkeeper</p>
        </div>
      </footer>
    </div>
  );
}

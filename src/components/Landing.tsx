'use client';

/**
 * Shopkeeper ল্যান্ডিং পেজ
 * ------------------------
 * সেকশন: হিরো → ডিভাইস শোকেস (ডেস্কটপ/ট্যাব/মোবাইল ট্যাব) → ফিচার
 * (ইন্টারেক্টিভ ট্যাব) → AI ম্যানেজার → কীভাবে কাজ করে → কেন Shopkeeper → CTA → ফুটার।
 * সব মকআপ pure CSS/div — কোনো স্ক্রিনশট নেই, তাই সব রেজোলিউশনে ঝকঝকে।
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Bell,
  Bot,
  Boxes,
  Calculator,
  CheckCircle2,
  Clock,
  Cloud,
  Gauge,
  Images,
  Languages,
  LayoutDashboard,
  Lightbulb,
  MessageCircle,
  Mic,
  Monitor,
  Package,
  Receipt,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Tablet,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react';

/* ── ডেটা ── */

const FEATURES = [
  {
    key: 'ai',
    icon: Bot,
    title: 'AI ম্যানেজার ও অটোমেশন',
    tagline: 'যে ম্যানেজার আপনার দোকানের প্রতিটি সংখ্যা জানে',
    description:
      'আপনার দোকানের আসল ডেটা দেখে উত্তর দেয় এমন চ্যাট অ্যাসিস্ট্যান্ট, প্রতিদিনের সকাল-ব্রিফিং, বিজনেস ইনসাইট, ভয়েস কমান্ডে বিক্রি ও রিস্টক — সাপ্তাহিক ও মাসিক রিপোর্টও নিজে থেকেই তৈরি হয়, পণ্যের বিবরণ আর ব্যানারের লেখাও AI-ই লেখে।',
    points: ['আসল ডেটায় ভিত্তি করে চ্যাট', 'দৈনিক ব্রিফিং ও ইনসাইট', 'ভয়েস কমান্ড ও অটো রিপোর্ট'],
  },
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
      'বারকোড ও SKU ব্যবস্থাপনা, ক্যাটাগরি ও সাইজ-কালার ভ্যারিয়েন্ট, সাপ্লায়ার খাতা, স্টক মুভমেন্ট হিস্ট্রি এবং স্টক কম হলে স্বয়ংক্রিয় অ্যালার্ট।',
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
    description: 'হোস্টিং, ডেটাবেস বা সার্ভার রক্ষণাবেক্ষণের আলাদা কোনো বিল নেই — পুরো ব্যবস্থা এক প্যাকেজে।',
  },
  {
    icon: Gauge,
    title: 'দ্রুত, যেকোনো ডিভাইসে',
    description: 'মোবাইল থেকে ডেস্কটপ — প্রতিটি পেজ দ্রুত লোড হয়; ধীর ইন্টারনেটেও কাজ থামে না।',
  },
  {
    icon: ShieldCheck,
    title: 'নিজের ডেটা, নিজের নিয়ন্ত্রণ',
    description: 'অর্ডার, কাস্টমার ও হিসাবের সব তথ্য সুরক্ষিত থাকে — ব্যবহৃত হয় কেবল আপনার অনুমতিতে।',
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

const AI_POINTS = [
  {
    icon: Bot,
    title: 'দৈনিক AI ব্রিফিং',
    description: 'সকালে প্যানেল খুললেই গতকালের হিসাব, আজকের পরামর্শ আর দরকারি সতর্কতা মুঠোয়।',
  },
  {
    icon: MessageCircle,
    title: 'আসল ডেটায় ভরা চ্যাট',
    description: '"আজ কত লাভ?" বা "কার কত বাকি?" — উত্তর মেলে আপনার দোকানের আসল সংখ্যায়, বানানো কথায় নয়।',
  },
  {
    icon: Mic,
    title: 'বাংলা ভয়েস কমান্ড',
    description: 'মাইকে বলুন "৫ পিস স্টক এসেছে, কস্ট ১৫৫০" — রিস্টক এন্ট্রি নিজেই হয়ে যাবে।',
  },
  {
    icon: BarChart3,
    title: 'অটো রিপোর্ট ও রিস্টক প্ল্যান',
    description: 'সাপ্তাহিক-মাসিক রিপোর্ট নিজে থেকেই তৈরি হয়; কোন পণ্যে কত স্টক দরকার তার হিসাবও AI-ই দেয়।',
  },
];

/* সব ফিচার এক নজরে — সফটওয়্যারের প্রতিটি ফিচারের পূর্ণ সূচি */
const FEATURE_GROUPS = [
  {
    icon: ShoppingCart,
    title: 'বিক্রি ও অর্ডার',
    items: [
      'অনলাইন চেকআউট',
      'কুপন ও ডিসকাউন্ট কোড',
      'ফ্ল্যাশ ডিল টাইমার',
      'bKash/Nagad/ক্যাশ অন ডেলিভারি',
      'অর্ডার স্ট্যাটাস পাইপলাইন',
      'প্রফেশনাল ইনভয়েস প্রিন্ট',
      'কল/WhatsApp যোগাযোগ',
      'অর্ডার কনফার্মেশন পেজ',
    ],
  },
  {
    icon: Zap,
    title: 'POS ও দোকানের বিক্রি',
    items: [
      'সেকেন্ডে সেল এন্ট্রি',
      'ভয়েস কমান্ডে বিক্রি',
      'অটো স্টক কাটা',
      'বাকি/নগদ দুটোই সাপোর্টেড',
      'AI কুইক সেল ম্যাচিং',
    ],
  },
  {
    icon: Boxes,
    title: 'ইনভেন্টরি ও ক্যাটালগ',
    items: [
      'বারকোড ও SKU',
      'সাইজ-কালার ভ্যারিয়েন্ট',
      'ক্যাটাগরি ম্যানেজমেন্ট',
      'সাপ্লায়ার খাতা',
      'স্টক মুভমেন্ট হিস্ট্রি',
      'লো-স্টক অ্যালার্ট',
      'দ্রুততম বিক্রিত পণ্য বিশ্লেষণ',
    ],
  },
  {
    icon: Images,
    title: 'মিডিয়া ও মার্কেটিং',
    items: [
      'মিডিয়া গ্যালারি',
      'বিল্ট-ইন ছবি এডিটর',
      'হোমপেজ ব্যানার এডিটর',
      'AI প্রোডাক্ট ডেসক্রিপশন',
      'AI ব্যানার কপি রাইটার',
    ],
  },
  {
    icon: Calculator,
    title: 'কাস্টমার ও হিসাব',
    items: [
      'কাস্টমার প্রোফাইল ও ইতিহাস',
      'বাকির খাতা ও আদায় ট্র্যাকিং',
      'পেমেন্ট রেকর্ড',
      'খরচের খাতা',
      'রিয়েল-টাইম লাভ-ক্ষতি',
      'দৈনিক হিসাব ও চার্ট',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'নিরাপত্তা ও অভিজ্ঞতা',
    items: [
      'অ্যাডমিন পাসওয়ার্ড লক',
      'মোবাইলে অ্যাপের মতো ইনস্টল (PWA)',
      'সব ডিভাইসে নিখুঁত ডিজাইন',
      'সম্পূর্ণ বাংলা ইন্টারফেস',
      'নোটিফিকেশন সেন্টার',
      'কাস্টমার ফিডব্যাক বক্স',
    ],
  },
];

/* ── মিনি অ্যাডমিন মকআপ — আসল অ্যাডমিন প্যানেলের ডিজাইন অনুসরণ করে (pure CSS/SVG) ── */

const MINI_TREND = [8, 14, 10, 18, 12, 22, 16, 26, 20, 30, 24, 34];

function MiniTrendChart() {
  const W = 200, H = 64;
  const x = (i: number) => 6 + (i * (W - 12)) / (MINI_TREND.length - 1);
  const y = (v: number) => H - 8 - ((v - 4) / 30) * (H - 20);
  const line = MINI_TREND.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${line} L${x(MINI_TREND.length - 1).toFixed(1)},${H - 4} L6,${H - 4} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-full" preserveAspectRatio="none">
      <line x1="6" x2={W - 6} y1={y(19)} y2={y(19)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="3 3" />
      <path d={area} fill="#ea580c" fillOpacity="0.08" />
      <path d={line} fill="none" stroke="#ea580c" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(MINI_TREND.length - 1)} cy={y(MINI_TREND[MINI_TREND.length - 1])} r="2.5" fill="#ea580c" />
    </svg>
  );
}

function MiniDonut() {
  return (
    <svg viewBox="0 0 200 200" className="w-full h-full">
      <circle cx="100" cy="100" r="80" fill="none" stroke="#e2e8f0" strokeWidth="28" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#ea580c" strokeWidth="28" strokeDasharray="300 503" transform="rotate(-90 100 100)" />
      <circle cx="100" cy="100" r="80" fill="none" stroke="#2563eb" strokeWidth="28" strokeDasharray="120 503" strokeDashoffset="-300" transform="rotate(-90 100 100)" />
    </svg>
  );
}

const MINI_METRICS = [
  { label: 'মোট বিক্রয়', value: '৳ ১৮,৭৬০', icon: TrendingUp, iconBg: 'bg-emerald-50 text-emerald-600' },
  { label: 'মোট অর্ডার', value: '৪৮ টি', icon: ShoppingBag, iconBg: 'bg-orange-50 text-orange-600' },
  { label: 'পেন্ডিং', value: '৬ টি', icon: Clock, iconBg: 'bg-amber-50 text-amber-600' },
  { label: 'পণ্য', value: '১২০ টি', icon: Package, iconBg: 'bg-blue-50 text-blue-600' },
];

const MINI_ORDERS = [
  { n: 'SK-9082', c: 'MD. তানভীর', p: '৳ ৩,৯১০', st: 'ডেলিভার্ড', done: true },
  { n: 'SK-9083', c: 'ফারহানা', p: '৳ ৪,৬২০', st: 'অপেক্ষমাণ', done: false },
];

const MINI_SIDEBAR_ICONS = [Boxes, ShoppingCart, Users, Calculator];

/* ড্যাশবোর্ডের ডার্ক AI গ্রিটিং কার্ডের মিনি ভার্সন */
function MiniAiCard() {
  return (
    <div className="rounded-md bg-slate-900 p-1.5 sm:p-3">
      <div className="flex items-center gap-1 text-orange-300 font-bold uppercase tracking-wider text-[4px] sm:text-[6px]">
        <Bot className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5" />
        <span>আপনার AI ম্যানেজার</span>
      </div>
      <div className="text-[6px] sm:text-[10px] font-bold text-white mt-0.5 sm:mt-1.5 truncate">শুভ সকাল, রফিক ভাই!</div>
      <div className="text-[4.5px] sm:text-[7px] text-slate-300 mt-0.5 leading-snug">
        গতকাল ১২টি অর্ডারে বিক্রি ৳৯,৪০০ — গত সপ্তাহের চেয়ে ১৮% বেশি। দুপুরের আগেই বাকি আদায়ের ফলো-আপ কল দিন।
      </div>
      <div className="mt-0.5 sm:mt-1.5 flex items-center gap-1">
        <CheckCircle2 className="w-1.5 h-1.5 sm:w-2 sm:h-2 text-emerald-400 shrink-0" />
        <span className="text-[4px] sm:text-[6px] text-emerald-300 font-bold truncate">স্টক কমে গেছে: হাইকিং বুট (৪২ সাইজ)</span>
      </div>
    </div>
  );
}

/* আসল মেট্রিক কার্ডের মিনি ভার্সন — রঙিন আইকন-স্কয়ারসহ */
function MiniMetrics({ count, cols }: { count: number; cols: 2 | 4 }) {
  return (
    <div className={`grid gap-1 sm:gap-2 ${cols === 4 ? 'grid-cols-4' : 'grid-cols-2'}`}>
      {MINI_METRICS.slice(0, count).map(m => {
        const Icon = m.icon;
        return (
          <div key={m.label} className="bg-white rounded-md border border-slate-200/80 p-1 sm:p-2 min-w-0">
            <div className="flex items-center justify-between gap-0.5">
              <span className="text-[3.5px] sm:text-[5.5px] font-bold uppercase tracking-wider text-slate-500 truncate">{m.label}</span>
              <div className={`w-2 h-2 sm:w-3.5 sm:h-3.5 rounded-md flex items-center justify-center shrink-0 ${m.iconBg}`}>
                <Icon className="w-1 h-1 sm:w-2 sm:h-2" />
              </div>
            </div>
            <div className="text-[5.5px] sm:text-[9px] font-bold text-slate-900 mt-0.5 sm:mt-1 truncate">{m.value}</div>
          </div>
        );
      })}
    </div>
  );
}

function MiniChartCard({ withDonut }: { withDonut?: boolean }) {
  return (
    <div className={`bg-white rounded-md border border-slate-200/80 p-1.5 sm:p-3 flex ${withDonut ? 'gap-1.5 sm:gap-3' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1 mb-0.5 sm:mb-1.5">
          <span className="text-[4px] sm:text-[6.5px] font-bold text-slate-900 truncate">বিক্রয় ট্রেন্ড (৩০ দিন)</span>
          <span className="text-[4px] sm:text-[6px] font-bold text-slate-400 shrink-0">মোট: ৳৫,২৪,০০০</span>
        </div>
        <div className="h-8 sm:h-16"><MiniTrendChart /></div>
      </div>
      {withDonut && (
        <div className="w-8 sm:w-20 shrink-0 flex flex-col items-center justify-center">
          <div className="w-full h-8 sm:h-16"><MiniDonut /></div>
          <span className="text-[3.5px] sm:text-[5.5px] font-bold text-slate-500 mt-0.5">ক্যাটাগরি আয়</span>
        </div>
      )}
    </div>
  );
}

/* আসল অর্ডার টেবিলের মিনি ভার্সন — মোনো অর্ডার নং + রঙিন স্ট্যাটাস পিল */
function MiniOrders() {
  return (
    <div className="bg-white rounded-md border border-slate-200/80 overflow-hidden">
      <div className="bg-slate-50 border-b border-slate-100 px-1.5 sm:px-3 py-0.5 sm:py-1.5 flex items-center justify-between">
        <span className="text-[4px] sm:text-[6.5px] font-bold uppercase tracking-wider text-slate-500">সাম্প্রতিক অর্ডার</span>
        <span className="text-[4px] sm:text-[6px] font-bold text-orange-600">সব দেখুন</span>
      </div>
      <div className="divide-y divide-slate-100">
        {MINI_ORDERS.map(o => (
          <div key={o.n} className="flex items-center gap-1 sm:gap-2 px-1.5 sm:px-3 py-0.5 sm:py-1.5">
            <span className="text-[4px] sm:text-[6.5px] font-mono font-bold text-slate-500 shrink-0">{o.n}</span>
            <span className="text-[4px] sm:text-[6.5px] font-bold text-slate-900 truncate">{o.c}</span>
            <span className="ml-auto text-[4px] sm:text-[6.5px] font-bold text-slate-900 shrink-0">{o.p}</span>
            <span
              className={`text-[3.5px] sm:text-[5.5px] font-bold px-0.5 sm:px-1 py-px rounded-md border shrink-0 ${
                o.done ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {o.st}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniAdmin({ device }: { device: 'desktop' | 'tablet' | 'mobile' }) {
  const mobile = device === 'mobile';

  /* মোবাইলে আসল অ্যাপের মতো উপরে সাদা হেডার + চিপ-নেভ (সাইডবার নেই) */
  if (mobile) {
    return (
      <div className="h-full w-full bg-slate-200 text-left flex flex-col">
        <div className="bg-white border-b border-slate-200 h-6 flex items-center justify-between px-2 shrink-0">
          <div className="space-y-0.5">
            <span className="block w-2.5 h-px bg-slate-500" />
            <span className="block w-2.5 h-px bg-slate-500" />
            <span className="block w-2 h-px bg-slate-500" />
          </div>
          <div className="w-3 h-3 rounded-md bg-orange-600 flex items-center justify-center text-[5px] font-bold text-white">S</div>
        </div>
        <div className="bg-white border-b border-slate-200 px-2 py-1 flex gap-1 overflow-hidden shrink-0">
          {['ড্যাশবোর্ড', 'অর্ডার', 'ইনভেন্টরি', 'হিসাব'].map((t, i) => (
            <span
              key={t}
              className={`px-1.5 py-0.5 rounded-md text-[4.5px] font-bold whitespace-nowrap ${
                i === 0 ? 'bg-orange-600 text-white' : 'bg-slate-50 border border-slate-200 text-slate-500'
              }`}
            >
              {t}
            </span>
          ))}
        </div>
        <div className="flex-1 min-h-0 p-2 space-y-1.5 overflow-hidden">
          <MiniAiCard />
          <MiniMetrics count={4} cols={2} />
          <MiniChartCard />
          <MiniOrders />
        </div>
      </div>
    );
  }

  /* ডেস্কটপ/ট্যাবলেট — আসল AdminSidebar-এর অনুরূপ ডার্ক সাইডবার */
  return (
    <div className="h-full w-full bg-slate-200 text-left flex">
      <div className="w-9 sm:w-14 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
        <div className="p-1.5 sm:p-2.5 border-b border-slate-800 flex justify-center">
          <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-md bg-orange-600 flex items-center justify-center text-[6px] sm:text-[9px] font-bold text-white">
            S
          </div>
        </div>
        <nav className="flex-1 p-1 sm:p-1.5 space-y-0.5 sm:space-y-1 overflow-hidden">
          <div className="flex items-center gap-1 sm:gap-1.5 px-1 sm:px-1.5 py-1 sm:py-1.5 rounded-md bg-orange-600">
            <LayoutDashboard className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 text-white shrink-0" />
            <span className="h-0.5 sm:h-1 flex-1 rounded-full bg-white/70" />
          </div>
          <div className="flex items-center gap-1 sm:gap-1.5 px-1 sm:px-1.5 py-1 sm:py-1.5 rounded-md">
            <Bot className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 text-orange-400 shrink-0" />
            <span className="h-0.5 sm:h-1 flex-1 rounded-full bg-slate-700" />
          </div>
          {MINI_SIDEBAR_ICONS.map((Icon, i) => (
            <div key={i} className="flex items-center gap-1 sm:gap-1.5 px-1 sm:px-1.5 py-1 sm:py-1.5 rounded-md">
              <Icon className="w-1.5 h-1.5 sm:w-2.5 sm:h-2.5 text-slate-500 shrink-0" />
              <span className="h-0.5 sm:h-1 flex-1 rounded-full bg-slate-700" style={{ maxWidth: `${85 - i * 10}%` }} />
            </div>
          ))}
        </nav>
        <div className="p-1 sm:p-1.5 border-t border-slate-800">
          <div className="h-2 sm:h-4 rounded-md bg-slate-800" />
        </div>
      </div>
      <div className="flex-1 min-w-0 p-2 sm:p-3 space-y-1.5 sm:space-y-2.5 overflow-hidden">
        <MiniAiCard />
        <MiniMetrics count={device === 'desktop' ? 4 : 2} cols={device === 'desktop' ? 4 : 2} />
        <MiniChartCard withDonut={device === 'desktop'} />
        <MiniOrders />
      </div>
    </div>
  );
}

/* ── AI ম্যানেজার মকআপ — আসল অ্যাসিস্ট্যান্ট পেজ ও ড্যাশবোর্ড ব্রিফ কার্ডের ডিজাইন অনুসরণ করে ── */

function AiManagerMockup() {
  return (
    <div className="rounded-md border border-slate-200 bg-white overflow-hidden text-left">
      {/* হেডার — আসল অ্যাসিস্ট্যান্ট পেজের মতো */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-200">
        <div className="w-9 h-9 rounded-md bg-orange-600 flex items-center justify-center shrink-0">
          <Bot className="w-5 h-5 text-white" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold text-slate-900">AI অ্যাসিস্ট্যান্ট</div>
          <div className="text-[10px] font-bold text-emerald-600 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block shrink-0" />
            আপনার দোকানের লাইভ ডেটায় চালু
          </div>
        </div>
      </div>

      {/* চ্যাট এরিয়া — আসল ব্যাকগ্রাউন্ড slate-50 */}
      <div className="p-4 space-y-3 bg-slate-50/60">
        {/* ডেইলি ব্রিফ — ড্যাশবোর্ডের ডার্ক কার্ডের অনুরূপ */}
        <div className="rounded-md bg-slate-900 text-white p-4">
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-orange-300 uppercase tracking-wider">
            <Bot className="w-3.5 h-3.5" />
            <span>আপনার AI ম্যানেজার</span>
          </div>
          <p className="text-xs font-bold text-orange-200 mt-1.5 leading-relaxed">
            শুভ সকাল, রফিক ভাই! গতকাল ১২টি অর্ডারে বিক্রি ৳৯,৪০০ — গত সপ্তাহের চেয়ে ১৮% বেশি।
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div className="rounded-md bg-white p-2.5 min-w-0">
              <div className="text-[8px] font-bold text-emerald-600 uppercase tracking-wider flex items-center gap-1">
                <Lightbulb className="w-2.5 h-2.5 shrink-0" /> আজকের পরামর্শ
              </div>
              <div className="mt-1.5 space-y-1">
                {['দুপুরের আগেই বাকি আদায়ের ফলো-আপ কল দিন', 'সন্ধ্যায় ফ্ল্যাশ ডিল চালু করুন'].map(t => (
                  <div key={t} className="flex gap-1.5 text-[9px] text-slate-700 leading-snug">
                    <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-md bg-white border border-amber-300 p-2.5 min-w-0">
              <div className="text-[8px] font-bold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5 shrink-0" /> জরুরি সতর্কতা
              </div>
              <div className="mt-1.5 space-y-1">
                {['স্টক কমে গেছে: হাইকিং বুট (৪২ সাইজ)', '২টি অর্ডার ২৪ ঘণ্টায় প্রসেস হয়নি'].map(t => (
                  <div key={t} className="flex gap-1.5 text-[9px] text-slate-700 leading-snug">
                    <span className="w-1.5 h-1.5 bg-amber-500 rounded-full shrink-0 mt-1" />
                    <span>{t}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* চ্যাট বাবল — আসল অ্যাসিস্ট্যান্টের স্টাইল */}
        <div className="flex flex-wrap gap-3 justify-end">
          <div className="max-w-[80%] rounded-md rounded-br-md bg-orange-600 px-4 py-3 text-xs leading-relaxed text-white">
            কার কার বাকি আছে এখন?
          </div>
        </div>
        <div className="flex gap-2 justify-start">
          <div className="w-7 h-7 rounded-md bg-orange-600 flex items-center justify-center shrink-0">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="max-w-[80%] rounded-md rounded-bl-md bg-white border border-slate-200 px-4 py-3 text-xs leading-relaxed text-slate-700">
            ৩ জন কাস্টমারের মোট বাকি <span className="font-bold text-slate-900">৳৪,৭৫০</span> — সবচেয়ে
            বেশি কামরুল ভাই (৳২,১০০)। ফোন নম্বর দেখাবো?
          </div>
        </div>
      </div>

      {/* ইনপুট বার — মাইক + ইনপুট + সেন্ড, আসল অ্যাসিস্ট্যান্টের মতো */}
      <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2.5">
        <div className="p-2.5 rounded-md bg-slate-100 shrink-0">
          <Mic className="w-4 h-4 text-slate-600" />
        </div>
        <div className="flex-1 rounded-md bg-slate-50 border border-slate-200 px-4 py-2.5 text-[11px] text-slate-400 truncate">
          আপনার প্রশ্ন লিখুন…
        </div>
        <div className="p-2.5 rounded-md bg-orange-600 shrink-0">
          <ArrowRight className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
}

/* ── ডিভাইস ফ্রেম ── */

function DeviceFrame({ device }: { device: 'desktop' | 'tablet' | 'mobile' }) {
  if (device === 'mobile') {
    return (
      <div className="w-52 mx-auto rounded-[2.2rem] border-8 border-slate-800 overflow-hidden bg-slate-100 relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-20 h-4 bg-slate-800 rounded-b-xl z-10" />
        <div className="h-80 pt-5">{<MiniAdmin device="mobile" />}</div>
        <div className="bg-slate-900 h-8 flex items-center justify-center gap-2">
          <div className="w-8 h-1 rounded-full bg-slate-600" />
        </div>
      </div>
    );
  }
  if (device === 'tablet') {
    return (
      <div className="w-full max-w-sm mx-auto rounded-[1.4rem] border-10 border-slate-800 overflow-hidden bg-slate-100">
        <div className="h-64">{<MiniAdmin device="tablet" />}</div>
      </div>
    );
  }
  return (
    <div className="w-full max-w-2xl mx-auto rounded-lg border border-slate-300 overflow-hidden bg-white">
      <div className="bg-slate-200 px-3 py-2 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
        <div className="ml-2 flex-1 max-w-xs bg-white rounded-md px-3 py-1 text-[10px] font-mono text-slate-500 truncate">
          shopkeeperbd.com/admin
        </div>
      </div>
      <div className="h-72 sm:h-80">{<MiniAdmin device="desktop" />}</div>
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
      <nav className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-sm border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            { }
            <img src="/shopkeeper-logo.png" alt="Shopkeeper" className="h-8 w-auto" style={{ mixBlendMode: 'screen' }} />
          </div>
          <div className="hidden sm:flex items-center gap-6 text-xs font-bold text-slate-300">
            <a href="#features" className="hover:text-white transition-colors">ফিচারসমূহ</a>
            <a href="#devices" className="hover:text-white transition-colors">সব ডিভাইসে</a>
            <a href="#ai" className="text-orange-300 hover:text-orange-200 transition-colors">AI ম্যানেজার</a>
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
        <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-16 pb-14 sm:pt-24 sm:pb-20 relative">
          <div className="max-w-3xl animate-fade-up">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-white/10 text-[11px] font-bold text-slate-300">
              <Bot className="w-3.5 h-3.5 text-orange-400" />
              AI-চালিত ব্যবস্থাপনা — দৈনিক ব্রিফিং, পরামর্শ ও ভয়েস কমান্ড
            </span>
            <h1 className="mt-5 text-3xl sm:text-5xl lg:text-6xl font-bold leading-tight tracking-tight">
              আপনার দোকানের{' '}
              <span className="text-orange-400">
                সম্পূর্ণ নিয়ন্ত্রণ
              </span>
              <br className="hidden sm:block" /> — এক প্যানেলেই
            </h1>
            <p className="mt-5 text-sm sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              Shopkeeper-এর AI ম্যানেজার আপনার দোকানের হিসাব রাখে, প্রতিদিন সকালে ব্রিফিং দেয় আর
              মাইকে বলা কথাতেই বিক্রি এন্ট্রি করে দেয়। সঙ্গে অনলাইন অর্ডার গ্রহণ, POS বিক্রি,
              ইনভেন্টরি, বাকির খাতা ও হিসাব-নিকাশ — সবকিছু একটি সুগঠিত কর্পোরেট প্যানেলে।
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="/shop"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition-all"
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
            {/* কর্পোরেট স্ট্যাটাস-স্ট্রিপ */}
            <div className="mt-10 sm:mt-14 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-8 border-t border-white/10 pt-8 sm:pt-10">
              {[
                { v: '৩৭+', l: 'বিল্ট-ইন ফিচার' },
                { v: '৯টি', l: 'ম্যানেজমেন্ট মডিউল' },
                { v: '১০০%', l: 'বাংলা ইন্টারফেস' },
                { v: '২৪/৭', l: 'যেকোনো ডিভাইস থেকে অ্যাক্সেস' },
              ].map(s => (
                <div key={s.l} className="text-center">
                  <div className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{s.v}</div>
                  <div className="text-[11px] font-semibold text-slate-400 mt-1">{s.l}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── ফিচারসমূহ (ইন্টারেক্টিভ) ── */}
      <section id="features" className="py-16 sm:py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center max-w-2xl mx-auto animate-fade-up">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-600">ফিচারসমূহ</span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">
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
                        ? 'bg-slate-900 text-white border-slate-900'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <FIcon className={`w-4 h-4 shrink-0 ${activeFeature === i ? 'text-orange-400' : 'text-orange-600'}`} />
                    <span className="truncate">{f.title}</span>
                    {activeFeature === i && <ArrowRight className="w-4 h-4 ml-auto shrink-0 hidden lg:block" />}
                  </button>
                );
              })}
            </div>

            {/* বিস্তারিত প্যানেল */}
            <div key={feature.key} className="animate-fade-up bg-white rounded-lg border border-slate-200 p-6 sm:p-10">
              <div className="w-12 h-12 rounded-md bg-orange-600 flex items-center justify-center">
                <FeatureIcon className="w-6 h-6 text-white" />
              </div>
              <h3 className="mt-5 text-xl sm:text-2xl font-bold text-slate-900">{feature.title}</h3>
              <p className="text-sm font-bold text-orange-600 mt-1">{feature.tagline}</p>
              <p className="mt-4 text-sm sm:text-base text-slate-600 leading-relaxed">{feature.description}</p>
              <div className="mt-6 space-y-2.5">
                {feature.points.map(p => (
                  <div key={p} className="flex items-start gap-2.5 text-xs sm:text-sm font-semibold text-slate-700">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                    {p}
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* ── সব ফিচার এক নজরে ── */}
          <div className="mt-14 sm:mt-20">
            <div className="text-center max-w-2xl mx-auto animate-fade-up">
              <h3 className="text-xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                আরও যা যা আছে — <span className="text-orange-600">সব ফিচার, এক নজরে</span>
              </h3>
              <p className="mt-3 text-sm sm:text-base text-slate-500 leading-relaxed">
                বড়-ছোট মিলিয়ে প্রতিটি ফিচারই এক প্যাকেজে — কোনো অ্যাড-অন বা &apos;প্রো&apos; প্ল্যানের বাড়তি বিল নেই।
              </p>
            </div>
            <div className="mt-8 sm:mt-10 grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
              {FEATURE_GROUPS.map((g, i) => {
                const GIcon = g.icon;
                return (
                  <div
                    key={g.title}
                    className="bg-white rounded-lg border border-slate-200 p-5 sm:p-6 animate-fade-up transition-colors hover:border-orange-300"
                    style={{ animationDelay: `${i * 0.08}s` }}
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-9 h-9 rounded-md bg-orange-600/10 flex items-center justify-center shrink-0">
                        <GIcon className="w-5 h-5 text-orange-600" />
                      </div>
                      <h4 className="text-sm font-bold text-slate-900">{g.title}</h4>
                    </div>
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {g.items.map(item => (
                        <li
                          key={item}
                          className="inline-flex items-center gap-1.5 rounded-md bg-slate-50 border border-slate-200 px-2.5 py-1.5 text-[11px] font-semibold text-slate-600"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── AI-চালিত ব্যবস্থাপনা ── */}
      <section id="ai" className="py-16 sm:py-24 bg-slate-950 text-white relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative grid lg:grid-cols-2 gap-10 lg:gap-14 items-center">
          <div className="animate-fade-up">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-400">AI-চালিত ব্যবস্থাপনা</span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight">
              একজন AI ম্যানেজার,<br className="hidden sm:block" /> যে আপনার দোকানকে চেনে
            </h2>
            <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
              সাধারণ সফটওয়্যার শুধু তথ্য রাখে — Shopkeeper-এর AI সেই তথ্য নিয়ে কাজও করে।
              আপনার প্রতিটি অর্ডার, স্টক আর হিসাব তার চোখের সামনে থাকে, তাই প্রতিটি উত্তরই
              আসল সংখ্যায় — আন্দাজে নয়।
            </p>
            <div className="mt-7 space-y-4">
              {AI_POINTS.map(p => {
                const PIcon = p.icon;
                return (
                  <div key={p.title} className="flex items-start gap-3">
                    <div className="w-9 h-9 rounded-md bg-orange-600/20 border border-orange-500/30 flex items-center justify-center shrink-0">
                      <PIcon className="w-4 h-4 text-orange-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">{p.title}</h3>
                      <p className="mt-0.5 text-xs text-slate-400 leading-relaxed">{p.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="animate-fade-up" style={{ animationDelay: '0.15s' }}>
            <AiManagerMockup />
          </div>
        </div>
      </section>

      {/* ── কীভাবে কাজ করে ── */}
      <section id="how" className="py-16 sm:py-24 bg-white">
        <div className="max-w-5xl mx-auto px-4 sm:px-6">
          <div className="text-center animate-fade-up">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-600">প্রক্রিয়া</span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-bold text-slate-900 tracking-tight">কীভাবে কাজ করে</h2>
            <p className="mt-3 text-sm sm:text-base text-slate-500 leading-relaxed">
              অর্ডার থেকে লাভ-ক্ষতি — পুরো প্রক্রিয়াটা সিস্টেম নিজেই চালায়, আপনি শুধু সিদ্ধান্ত নিন।
            </p>
          </div>
          <div className="mt-12 grid sm:grid-cols-3 gap-6">
            {STEPS.map((s, i) => (
              <div key={s.n} className="relative bg-white rounded-lg border border-slate-200 p-6 animate-fade-up" style={{ animationDelay: `${i * 0.12}s` }}>
                <div className="w-11 h-11 rounded-md bg-orange-600 text-white font-bold text-lg flex items-center justify-center">
                  {s.n}
                </div>
                <h3 className="mt-4 font-bold text-slate-900">{s.title}</h3>
                <p className="mt-2 text-xs sm:text-sm text-slate-500 leading-relaxed">{s.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── কেন Shopkeeper ── */}
      <section className="py-16 sm:py-24 bg-slate-950 text-white relative overflow-hidden">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative">
          <div className="text-center animate-fade-up">
            <span className="text-xs font-bold uppercase tracking-widest text-orange-400">কেন Shopkeeper</span>
            <h2 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight">কারণগুলো সহজ — কিন্তু শক্তিশালী</h2>
          </div>
          <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {WHY_CARDS.map((w, i) => {
              const WIcon = w.icon;
              return (
                <div
                  key={w.title}
                  className="bg-white/5 border border-white/10 rounded-lg p-6 backdrop-blur-sm animate-fade-up"
                  style={{ animationDelay: `${i * 0.1}s` }}
                >
                  <div className="w-11 h-11 rounded-md bg-orange-600/20 border border-orange-500/30 flex items-center justify-center">
                    <WIcon className="w-5 h-5 text-orange-400" />
                  </div>
                  <h3 className="mt-4 font-bold">{w.title}</h3>
                  <p className="mt-2 text-xs text-slate-400 leading-relaxed">{w.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 sm:py-24 bg-slate-950 text-white relative overflow-hidden">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center animate-fade-up relative">
          <span className="text-xs font-bold uppercase tracking-widest text-orange-400">শুরু করার জন্য প্রস্তুত?</span>
          <h2 className="mt-2 text-2xl sm:text-4xl font-bold tracking-tight">আজই দেখুন পার্থক্যটা</h2>
          <p className="mt-3 text-sm sm:text-base text-slate-300 leading-relaxed">
            লাইভ ডেমো শপে অর্ডার দিয়ে দেখুন সিস্টেমটা কীভাবে কাজ করে — অথবা সরাসরি অ্যাডমিন প্যানেলে ঢুকে দেখুন পেছনের সম্পূর্ণ নিয়ন্ত্রণকেন্দ্র।
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <a href="/shop" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-sm font-bold transition-colors">
              ডেমো শপ দেখুন
              <ArrowRight className="w-4 h-4" />
            </a>
            <a href="/admin" className="inline-flex items-center gap-2 px-7 py-3.5 rounded-md border border-white/20 text-slate-100 hover:bg-white/5 text-sm font-bold transition-colors">
              অ্যাডমিন প্যানেল
            </a>
          </div>
        </div>
      </section>

      {/* ── ফুটার ── */}
      <footer className="bg-slate-950 border-t border-white/10 text-slate-400">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-14 grid gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            { }
            <img src="/shopkeeper-logo.png" alt="Shopkeeper" className="h-8 w-auto" style={{ mixBlendMode: 'screen' }} />
            <p className="mt-4 text-xs leading-relaxed max-w-sm">
              দোকানের সম্পূর্ণ ই-কমার্স ও ম্যানেজমেন্ট সিস্টেম — অর্ডার, ইনভেন্টরি, বাকির খাতা,
              হিসাব-নিকাশ আর AI ম্যানেজার, সবকিছু এক প্যানেলে।
            </p>
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-white">এক্সপ্লোর করুন</h4>
            <ul className="mt-4 space-y-2.5 text-xs font-semibold">
              <li><a href="#features" className="hover:text-white transition-colors">ফিচারসমূহ</a></li>
              <li><a href="#ai" className="hover:text-white transition-colors">AI ম্যানেজার</a></li>
              <li><a href="#how" className="hover:text-white transition-colors">কীভাবে কাজ করে</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-widest text-white">লাইভ দেখুন</h4>
            <ul className="mt-4 space-y-2.5 text-xs font-semibold">
              <li><a href="/shop" className="hover:text-white transition-colors">ডেমো শপ</a></li>
              <li><a href="/admin" className="hover:text-white transition-colors">অ্যাডমিন প্যানেল</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px]">
            <p>© {new Date().getFullYear()} Shopkeeper — দোকানের সম্পূর্ণ ম্যানেজমেন্ট সিস্টেম</p>
            <p className="text-slate-500">সম্পূর্ণ বাংলা ইন্টারফেস • সব ডিভাইসে</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

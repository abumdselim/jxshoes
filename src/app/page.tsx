'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { Product, CategoryItem, HeroBannerSettings, FlashDealSettings, StoreSettings } from '@/types';
import { initialProducts, initialCategories, initialHeroBanner, initialFlashDeal, initialStoreSettings } from '@/lib/initialData';
import { formatPrice } from '@/lib/utils';
import {
  ArrowRight,
  Sparkles,
  Filter,
  CheckCircle2,
  ChevronDown,
  Star,
  Flame,
  Truck,
  RotateCcw,
  ShieldCheck,
  PhoneCall,
  Copy,
  Check,
  Award,
  Zap,
  Clock,
  ThumbsUp,
  ShoppingBag,
  Gift,
  Gem,
  Feather,
  Layers,
  Footprints
} from 'lucide-react';

function HomePageContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') || 'all';
  const queryParam = searchParams.get('q') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);
  const [heroBanner, setHeroBanner] = useState<HeroBannerSettings>(initialHeroBanner);
  const [flashDeal, setFlashDeal] = useState<FlashDealSettings>(initialFlashDeal);
  const [settings, setSettings] = useState<StoreSettings>(initialStoreSettings);

  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [activeTab, setActiveTab] = useState<'all' | 'bestseller' | 'sneakers' | 'loafers' | 'bags'>('all');
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [loading, setLoading] = useState<boolean>(true);

  // Voucher Copy State
  const [couponCopied, setCouponCopied] = useState(false);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  // Countdown Timer
  const [timeLeft, setTimeLeft] = useState({ hours: 14, minutes: 28, seconds: 45 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        return { hours: 24, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch dynamic store data
  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, catRes, mktRes, setRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories'),
          fetch('/api/marketing'),
          fetch('/api/settings'),
        ]);

        if (prodRes.ok) setProducts(await prodRes.json());
        else setProducts(initialProducts);

        if (catRes.ok) setCategories(await catRes.json());
        if (setRes.ok) setSettings(await setRes.json());

        if (mktRes.ok) {
          const mData = await mktRes.json();
          if (mData.heroBanner) setHeroBanner(mData.heroBanner);
          if (mData.flashDeal) {
            setFlashDeal(mData.flashDeal);
            setTimeLeft({ hours: mData.flashDeal.countdownHours || 14, minutes: 0, seconds: 0 });
          }
        }
      } catch (e) {
        setProducts(initialProducts);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    if (categoryParam) {
      setSelectedCategory(categoryParam);
      if (categoryParam === 'shoes') setActiveTab('all');
      else if (categoryParam === 'bags') setActiveTab('bags');
    }
  }, [categoryParam]);

  const handleCopyCoupon = (code: string) => {
    navigator.clipboard.writeText(code);
    setCouponCopied(true);
    setTimeout(() => setCouponCopied(false), 2000);
  };

  // Testimonials
  const testimonials = [
    {
      name: 'আরিফুল ইসলাম',
      role: 'ধানমন্ডি, ঢাকা',
      rating: 5,
      comment: 'Classic Italian Loafer জোড়া হাতে পেয়ে সত্যিই মুগ্ধ! জেনুইন ফুল-গ্রেইন লেদার এবং ফিনিশিং একদম আন্তর্জাতিক মানের। সাইজ ৪২ একদম পারফেক্ট হয়েছে।',
      date: '২ দিন আগে',
      verified: true,
      product: 'Italian Leather Loafers',
    },
    {
      name: 'ডা. সানজিদা রহমান',
      role: 'জিইসি মোড়, চট্টগ্রাম',
      rating: 5,
      comment: 'Luxury Ladies Handbag অর্ডার করেছিলাম। মাত্র ২ দিনের মাথায় ক্যাশ অন ডেলিভারিতে সুন্দর বক্সে পেয়েছি। ল্যাপটপ ও ফাইল রাখার প্রচুর জায়গা আছে।',
      date: '৪ দিন আগে',
      verified: true,
      product: 'Luxury Ladies Handbag',
    },
    {
      name: 'মাহমুদুল হাসান',
      role: 'উপশহর, সিলেট',
      rating: 5,
      comment: 'Apex Air Mesh রানিং স্নিকার্সটি অসাধারণ আরামদায়ক! সারাদিন অফিসে ব্যবহারের পরও পায়ে কোনো ক্লান্তি লাগেনি। সাইজ এক্সচেঞ্জ পলিসিও খুব ভালো।',
      date: '১ সপ্তাহ আগে',
      verified: true,
      product: 'Air Mesh Sneakers',
    },
  ];

  // FAQs
  const faqs = [
    {
      q: 'পণ্য হাতে পেয়ে কি টাকা পরিশোধ (Cash on Delivery) করা যাবে?',
      a: 'হ্যাঁ, সারা বাংলাদেশে ১০০% ক্যাশ অন ডেলিভারি সুবিধা রয়েছে। ডেলিভারি ম্যানের সামনে পার্সেল খুলে চেক করে সন্তুষ্ট হয়ে তারপর মূল্য পরিশোধ করবেন।',
    },
    {
      q: 'জুতার সাইজ না মিললে কি পরিবর্তন (Exchange) করা যাবে?',
      a: 'অবশ্যই! পার্সেল পাওয়ার পর সাইজ ছোট বা বড় হলে আমাদের হটলাইনে জানালে আমরা ৩ দিনের মধ্যে ফ্রিতে সাইজ পরিবর্তন করে নতুন পার্সেল পাঠিয়ে দেব।',
    },
    {
      q: 'ডেলিভারি চার্জ কত এবং কতদিনে পণ্য পাব?',
      a: `ঢাকা সিটির ভেতরে ডেলিভারি চার্জ মাত্র ৳${settings.insideDhakaFee || 60} (১-২ কার্যদিবস), এবং ঢাকার বাইরে সারা দেশে ৳${settings.outsideDhakaFee || 120} (২-৩ কার্যদিবস)। ৳${settings.freeDeliveryAbove || 5000}+ অর্ডারে ফ্রি ডেলিভারি!`,
    },
    {
      q: 'চামড়ার জুতা ও ব্যাগ কি আসল লেদারের?',
      a: 'আমাদের লেদার কালেকশনের প্রতিটি জুতা ও ব্যাগ ১০০% জেনুইন ফুল-গ্রেইন লেদার দিয়ে বিশেষভাবে প্রস্তুত করা, যা দীর্ঘস্থায়ী এবং টেকসই।',
    },
    {
      q: 'পণ্য পছন্দ না হলে কি রিটার্ন করা যাবে?',
      a: 'হ্যাঁ, কোনো ত্রুটি থাকলে বা বর্ণনা অনুযায়ী না পেলে ডেলিভারি নেওয়ার সময়ই রিটার্ন করতে পারবেন অথবা আমাদের সাপোর্ট টিমের সহায়তায় সমাধান নিতে পারবেন।',
    },
  ];

  const shoeSizes = ['39', '40', '41', '42', '43', '44', '45'];

  // Filter & Sort
  const filteredProducts = products.filter((p) => {
    // Tab filter
    if (activeTab === 'bestseller' && !p.isFeatured) return false;
    if (activeTab === 'sneakers' && !(p.subCategory?.toLowerCase().includes('স্নিকার্স') || p.subCategory?.toLowerCase().includes('sneakers'))) return false;
    if (activeTab === 'loafers' && !(p.subCategory?.toLowerCase().includes('লোফার') || p.subCategory?.toLowerCase().includes('loafers') || p.subCategory?.toLowerCase().includes('formal'))) return false;
    if (activeTab === 'bags' && p.category !== 'bags') return false;

    // Category filter
    const matchesCategory =
      selectedCategory === 'all' || p.category === selectedCategory;

    // Query filter
    const matchesQuery =
      !queryParam ||
      p.name.toLowerCase().includes(queryParam.toLowerCase()) ||
      p.description.toLowerCase().includes(queryParam.toLowerCase()) ||
      (p.subCategory && p.subCategory.toLowerCase().includes(queryParam.toLowerCase())) ||
      (p.sku && p.sku.toLowerCase().includes(queryParam.toLowerCase()));

    // Size filter
    const matchesSize =
      selectedSize === 'all' || p.sizes.includes(selectedSize);

    return matchesCategory && matchesQuery && matchesSize;
  }).sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    if (sortBy === 'rating') return (b.rating || 5) - (a.rating || 5);
    return 0;
  });

  // Dynamic Flash Deal Product
  const dealProduct = products.find((p) => p.id === flashDeal.targetProductId) || products[0];

  return (
    <>
      <Navbar />

      <main className="flex-1 bg-slate-50 selection:bg-orange-500 selection:text-white">

        {/* ═══════════════════════════════════════════════════
            HERO SECTION — Premium Dark Luxury Look
        ═══════════════════════════════════════════════════ */}
        <section className="relative overflow-hidden bg-gradient-to-b from-slate-950 via-slate-900 to-stone-950 text-white pt-10 pb-20 sm:pt-14 sm:pb-28">
          {/* Ambient Lighting Gradients */}
          <div className="absolute top-1/4 left-1/4 -translate-y-1/2 w-96 h-96 bg-orange-600/25 rounded-full blur-[120px] pointer-events-none" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-amber-500/20 rounded-full blur-[140px] pointer-events-none" />
          <div className="absolute -top-10 right-1/3 w-80 h-80 bg-red-600/15 rounded-full blur-[100px] pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">

              {/* Left Column: Hero Text & CTAs */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                {/* Badge */}
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-orange-500/15 border border-orange-500/30 text-orange-300 text-xs sm:text-sm font-bold shadow-lg shadow-orange-500/10 backdrop-blur-md">
                  <Sparkles className="w-4 h-4 text-orange-400 animate-pulse" />
                  <span>{heroBanner.badgeText || 'নতুন প্রিমিয়াম কালেকশন ২০২৬ • সরাসরি ফ্যাক্টরি রেট'}</span>
                </div>

                {/* H1 Title */}
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15] text-white">
                  {heroBanner.titlePart1} <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
                    {heroBanner.titleHighlight}
                  </span>
                </h1>

                {/* Subtitle */}
                <p className="text-sm sm:text-base lg:text-lg text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
                  {heroBanner.subtitle}
                </p>

                {/* Hero CTAs */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
                  <a
                    href="#catalog"
                    className="inline-flex items-center justify-center gap-2 px-6 sm:px-8 py-3.5 sm:py-4 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-sm sm:text-base shadow-xl shadow-orange-600/30 transition-all transform hover:-translate-y-0.5 active:scale-95"
                  >
                    <span>{heroBanner.ctaText || 'কালেকশন দেখুন'}</span>
                    <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5" />
                  </a>

                  {flashDeal.enabled && (
                    <a
                      href="#flash-deal"
                      className="inline-flex items-center justify-center gap-2 px-5 sm:px-7 py-3.5 sm:py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm sm:text-base border border-white/20 transition-all backdrop-blur-md hover:border-orange-400/50"
                    >
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span>আজকের অফার</span>
                    </a>
                  )}
                </div>

                {/* Trust Points Counter Strip */}
                <div className="grid grid-cols-3 gap-3 pt-6 border-t border-slate-800/90 text-left">
                  <div className="space-y-0.5">
                    <div className="text-xl sm:text-2xl font-black text-white">১২,৫০০+</div>
                    <div className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1 font-medium">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                      <span>সন্তুষ্ট গ্রাহক</span>
                    </div>
                  </div>

                  <div className="space-y-0.5 border-l border-slate-800 pl-3 sm:pl-4">
                    <div className="text-xl sm:text-2xl font-black text-white">১০০%</div>
                    <div className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1 font-medium">
                      <ShieldCheck className="w-3.5 h-3.5 text-orange-400" />
                      <span>জেনুইন লেদার</span>
                    </div>
                  </div>

                  <div className="space-y-0.5 border-l border-slate-800 pl-3 sm:pl-4">
                    <div className="text-xl sm:text-2xl font-black text-white">৪৮ ঘণ্টা</div>
                    <div className="text-[11px] sm:text-xs text-slate-400 flex items-center gap-1 font-medium">
                      <Truck className="w-3.5 h-3.5 text-emerald-400" />
                      <span>ফাস্ট ডেলিভারি</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Hero Visual Showcase with Floating Cards */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3.5 sm:gap-4 relative">
                {/* Floating Rating Pill */}
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 z-20 bg-slate-900/90 backdrop-blur-md border border-white/20 text-white px-4 py-1.5 rounded-full shadow-2xl flex items-center gap-2 whitespace-nowrap text-xs font-bold">
                  <div className="flex items-center gap-0.5 text-amber-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    ))}
                  </div>
                  <span className="text-orange-400 font-black">৪.৯/৫</span>
                  <span className="text-slate-400 hidden sm:inline">(১২K+ রিভিউ)</span>
                </div>

                {/* Left Card: Shoes */}
                <div className="space-y-3 pt-4">
                  <div className="rounded-3xl overflow-hidden aspect-[4/5] bg-slate-800 border border-white/10 shadow-2xl group relative">
                    <img
                      src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800"
                      alt="Sneakers"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-left">
                      <span className="text-[10px] font-black uppercase tracking-wider text-orange-400 bg-black/40 px-2 py-0.5 rounded backdrop-blur">
                        হট কালেকশন
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-white mt-1 line-clamp-1">
                        {heroBanner.shoeHighlightText || 'স্নিকার্স ও লেদার শুজ'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Right Card: Leather Bags */}
                <div className="space-y-3 pt-10">
                  <div className="rounded-3xl overflow-hidden aspect-[4/5] bg-slate-800 border border-white/10 shadow-2xl group relative">
                    <img
                      src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=800"
                      alt="Leather Bag"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                    <div className="absolute bottom-3 left-3 right-3 text-left">
                      <span className="text-[10px] font-black uppercase tracking-wider text-amber-400 bg-black/40 px-2 py-0.5 rounded backdrop-blur">
                        এক্সক্লুসিভ ব্যাগ
                      </span>
                      <p className="text-xs sm:text-sm font-bold text-white mt-1 line-clamp-1">
                        {heroBanner.bagHighlightText || 'ল্যাপটপ ও ট্রাভেল ব্যাগ'}
                      </p>
                    </div>
                  </div>
                </div>

              </div>

            </div>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════
            TRUST & VALUE PROPOSITION BAR (Floating Strip)
        ═══════════════════════════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 sm:-mt-12 relative z-30">
          <div className="bg-white rounded-3xl p-5 sm:p-7 shadow-xl border border-slate-200/90 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-orange-50 text-orange-600 flex items-center justify-center flex-shrink-0 shadow-inner">
                <Truck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">ক্যাশ অন ডেলিভারি</h4>
                <p className="text-xs text-slate-500 mt-0.5">পণ্য হাতে পেয়ে চেক করে মূল্য দিন</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center flex-shrink-0 shadow-inner">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">সহজ সাইজ এক্সচেঞ্জ</h4>
                <p className="text-xs text-slate-500 mt-0.5">সাইজ না মিললে ৩ দিনে পরিবর্তন</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center flex-shrink-0 shadow-inner">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">১০০% প্রিমিয়াম কোয়ালিটি</h4>
                <p className="text-xs text-slate-500 mt-0.5">খাঁটি লেদার ও টেকসই উপাদান</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center flex-shrink-0 shadow-inner">
                <PhoneCall className="w-6 h-6" />
              </div>
              <div>
                <h4 className="text-sm font-black text-slate-900">২৪/৭ কাস্টমার সাপোর্ট</h4>
                <p className="text-xs text-slate-500 mt-0.5">কল বা হোয়াটসঅ্যাপে অর্ডার করুন</p>
              </div>
            </div>

          </div>
        </section>


        {/* ═══════════════════════════════════════════════════
            PROMO VOUCHER BANNER (Instant Coupon Code)
        ═══════════════════════════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-8">
          <div className="rounded-2xl bg-gradient-to-r from-orange-500 via-amber-500 to-orange-600 p-4 sm:p-5 text-white shadow-md flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3 text-center sm:text-left">
              <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center flex-shrink-0">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <div>
                <div className="font-black text-sm sm:text-base">
                  প্রথম অর্ডারে ১০০ টাকা ছাড় পেতে কুপন কোড ব্যবহার করুন!
                </div>
                <div className="text-xs text-orange-100 mt-0.5">
                  ন্যূনতম ১৫০০ টাকার যে কোনো জুতা বা ব্যাগের অর্ডারে প্রযোজ্য।
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-sm px-4 py-2 rounded-xl bg-black/20 border border-white/20 tracking-wider">
                JX100
              </span>
              <button
                onClick={() => handleCopyCoupon('JX100')}
                className="px-4 py-2 rounded-xl bg-white text-orange-600 hover:bg-orange-50 text-xs font-black shadow transition-all flex items-center gap-1.5"
              >
                {couponCopied ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                    <span>কপি হয়েছে!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>কপি করুন</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════
            VISUAL CATEGORIES SHOWCASE
        ═══════════════════════════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
                শপ বাই ক্যাটাগরি
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
                আপনার পছন্দের কালেকশন বেছে নিন
              </h2>
            </div>
            <a
              href="#catalog"
              className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
            >
              <span>সকল পণ্য</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`/?category=${cat.parentType}#catalog`}
                onClick={() => setSelectedCategory(cat.parentType)}
                className="bg-white rounded-3xl p-3.5 border border-slate-200/90 shadow-sm hover:shadow-xl hover:border-orange-500/50 transition-all duration-300 flex flex-col items-center text-center group cursor-pointer"
              >
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl overflow-hidden bg-slate-100 mb-2.5 border border-slate-100 group-hover:scale-105 transition-transform duration-300">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-1">
                  {cat.name}
                </h4>
                <span className="text-[10px] text-slate-400 mt-0.5 font-medium">
                  {cat.itemCountLabel || 'এক্সপ্লোর করুন'}
                </span>
              </a>
            ))}
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════
            FLASH DEAL OF THE DAY (Urgency Banner)
        ═══════════════════════════════════════════════════ */}
        {flashDeal.enabled && dealProduct && (
          <section id="flash-deal" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="rounded-3xl bg-gradient-to-r from-stone-900 via-slate-900 to-orange-950 p-6 sm:p-10 text-white shadow-2xl relative overflow-hidden border border-orange-500/20">
              <div className="absolute right-0 top-0 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />
              <div className="absolute bottom-0 left-1/3 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl pointer-events-none" />

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
                <div className="md:col-span-8 space-y-4">
                  {/* Deal Badge */}
                  <div className="inline-flex items-center gap-2 bg-orange-600/30 border border-orange-500/40 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-black tracking-wide text-orange-300">
                    <Flame className="w-4 h-4 text-orange-400 animate-pulse" />
                    <span>{flashDeal.badgeText || 'আজকের সেরা ফ্ল্যাশ ডিল • সীমিত স্টক'}</span>
                  </div>

                  <h3 className="text-2xl sm:text-4xl font-black text-white leading-tight">
                    {dealProduct.name}
                  </h3>

                  <p className="text-xs sm:text-sm text-slate-300 max-w-xl leading-relaxed">
                    {dealProduct.description}
                  </p>

                  {/* Countdown Timer */}
                  <div className="flex flex-wrap items-center gap-3 pt-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-orange-300 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" /> অফারের সময় বাকি:
                    </span>
                    <div className="flex items-center gap-1.5 font-mono font-black text-xs sm:text-sm">
                      <span className="bg-black/50 border border-white/10 px-3 py-1.5 rounded-xl shadow-inner">
                        {String(timeLeft.hours).padStart(2, '0')} <span className="text-[10px] text-slate-400 font-sans">ঘণ্টা</span>
                      </span>
                      <span className="text-orange-400 font-black">:</span>
                      <span className="bg-black/50 border border-white/10 px-3 py-1.5 rounded-xl shadow-inner">
                        {String(timeLeft.minutes).padStart(2, '0')} <span className="text-[10px] text-slate-400 font-sans">মিনিট</span>
                      </span>
                      <span className="text-orange-400 font-black">:</span>
                      <span className="bg-black/50 border border-orange-500/40 px-3 py-1.5 rounded-xl text-yellow-300 shadow-inner">
                        {String(timeLeft.seconds).padStart(2, '0')} <span className="text-[10px] text-slate-400 font-sans">সেকেন্ড</span>
                      </span>
                    </div>
                  </div>

                  {/* Stock Urgency Bar */}
                  <div className="max-w-md pt-1">
                    <div className="flex justify-between text-xs text-slate-300 mb-1 font-medium items-center">
                      <span className="flex items-center gap-1.5"><Flame className="w-3.5 h-3.5 text-orange-400" /> <span>স্টক প্রায় শেষ হতে চলেছে</span></span>
                      <span className="text-orange-400 font-bold">৮২% বিক্রি সম্পন্ন</span>
                    </div>
                    <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/10">
                      <div className="bg-gradient-to-r from-orange-500 to-amber-400 h-2 rounded-full w-[82%]" />
                    </div>
                  </div>

                  {/* Pricing & CTA */}
                  <div className="pt-3 flex flex-wrap items-center gap-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl sm:text-4xl font-black text-white">
                        {formatPrice(dealProduct.price)}
                      </span>
                      {dealProduct.originalPrice && (
                        <span className="text-base text-slate-400 line-through">
                          {formatPrice(dealProduct.originalPrice)}
                        </span>
                      )}
                    </div>

                    <a
                      href={`/product/${dealProduct.id}`}
                      className="px-8 py-3 rounded-2xl bg-orange-600 hover:bg-orange-500 text-white font-black text-sm shadow-xl shadow-orange-600/30 transition-all transform hover:-translate-y-0.5 active:scale-95 flex items-center gap-2"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span>এখনই অর্ডার করুন</span>
                    </a>
                  </div>
                </div>

                <div className="md:col-span-4 flex justify-center">
                  <div className="w-60 sm:w-72 aspect-square rounded-3xl overflow-hidden shadow-2xl border-4 border-white/20 bg-slate-800 group relative">
                    <img
                      src={dealProduct.images[0]}
                      alt={dealProduct.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {dealProduct.originalPrice && (
                      <div className="absolute top-3 right-3 bg-red-600 text-white text-xs font-black px-3 py-1 rounded-full shadow-lg">
                        {formatPrice(dealProduct.originalPrice - dealProduct.price)} সাশ্রয়!
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}


        {/* ═══════════════════════════════════════════════════
            MAIN CATALOG & PRODUCT CURATIONS
        ═══════════════════════════════════════════════════ */}
        <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

          {/* Section Header */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <div className="inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider text-orange-600 bg-orange-50 px-3 py-1 rounded-full mb-1">
                <Sparkles className="w-3.5 h-3.5" />
                <span>আমাদের ক্যাটালগ</span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {selectedCategory === 'shoes'
                  ? 'প্রিমিয়াম জুতার কালেকশন'
                  : selectedCategory === 'bags'
                  ? 'আকর্ষণীয় ব্যাগের কালেকশন'
                  : 'আমাদের সকল প্রিমিয়াম কালেকশন'}
              </h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
                {filteredProducts.length} টি পণ্য পাওয়া গেছে
              </p>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-500">সর্ট করুন:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-bold rounded-xl px-3 py-2 text-slate-700 focus:outline-none shadow-xs"
              >
                <option value="featured">ফিচার্ড / নতুন</option>
                <option value="rating">রেটিং: সর্বোচ্চ</option>
                <option value="price-low">দাম: কম থেকে বেশি</option>
                <option value="price-high">দাম: বেশি থেকে কম</option>
              </select>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200/80 shadow-sm mb-8 space-y-4">

            {/* Collection Filter Tabs */}
            <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <button
                onClick={() => { setSelectedCategory('all'); setActiveTab('all'); setSelectedSize('all'); }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all ${
                  activeTab === 'all' && selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                সব পণ্য ({products.length})
              </button>

              <button
                onClick={() => { setActiveTab('bestseller'); setSelectedSize('all'); }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === 'bestseller'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Flame className="w-3.5 h-3.5" />
                <span>বেস্ট সেলার্স</span>
              </button>

              <button
                onClick={() => { setSelectedCategory('shoes'); setActiveTab('loafers'); setSelectedSize('all'); }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === 'loafers'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Footprints className="w-3.5 h-3.5" />
                <span>লেদার ও লোফার</span>
              </button>

              <button
                onClick={() => { setSelectedCategory('shoes'); setActiveTab('sneakers'); setSelectedSize('all'); }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === 'sneakers'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>স্নিকার্স</span>
              </button>

              <button
                onClick={() => { setSelectedCategory('bags'); setActiveTab('bags'); setSelectedSize('all'); }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition-all flex items-center gap-1.5 ${
                  activeTab === 'bags'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>প্রিমিয়াম ব্যাগ</span>
              </button>
            </div>

            {/* Shoe Size Specific Filter */}
            {(selectedCategory === 'shoes' || selectedCategory === 'all') && activeTab !== 'bags' && (
              <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-xs">
                <span className="font-bold text-slate-500 flex items-center gap-1 mr-1">
                  <Filter className="w-3.5 h-3.5 text-orange-600" />
                  সাইজ নির্বাচন:
                </span>
                <button
                  onClick={() => setSelectedSize('all')}
                  className={`px-3 py-1 rounded-lg font-bold transition-colors ${
                    selectedSize === 'all'
                      ? 'bg-orange-600 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  সকল সাইজ
                </button>
                {shoeSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-2.5 py-1 rounded-lg font-semibold transition-colors ${
                      selectedSize === size
                        ? 'bg-orange-600 text-white font-bold'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    সাইজ {size}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Products Grid */}
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6 py-12">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="bg-white rounded-3xl h-80 animate-pulse border border-slate-200" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center my-6 shadow-sm">
              <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-base font-bold text-slate-800">কোনো প্রোডাক্ট পাওয়া যায়নি!</p>
              <p className="text-xs text-slate-400 mt-1">অন্য কোনো ফিল্টার বা সাইজ বেছে নিয়ে দেখুন।</p>
              <button
                onClick={() => { setSelectedCategory('all'); setActiveTab('all'); setSelectedSize('all'); }}
                className="mt-4 px-5 py-2.5 bg-orange-600 text-white rounded-xl text-xs font-bold shadow-md hover:bg-orange-700 transition-colors"
              >
                ফিল্টার রিসেট করুন
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}

        </section>


        {/* ═══════════════════════════════════════════════════
            BRAND CRAFTSMANSHIP & QUALITY SPOTLIGHT
        ═══════════════════════════════════════════════════ */}
        <section className="bg-slate-900 text-white py-16 sm:py-20 relative overflow-hidden border-y border-slate-800">
          <div className="absolute top-0 right-0 w-96 h-96 bg-orange-600/10 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">

              {/* Left Column: Image with Quality Badge */}
              <div className="lg:col-span-5 relative">
                <div className="rounded-3xl overflow-hidden shadow-2xl border border-white/10 aspect-[4/3] bg-slate-800">
                  <img
                    src="https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&q=80&w=1000"
                    alt="Leather Craftsmanship"
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="absolute -bottom-4 -right-4 sm:bottom-6 sm:right-6 bg-orange-600 text-white p-4 rounded-2xl shadow-2xl border border-white/20">
                  <div className="flex items-center gap-2 font-black text-sm">
                    <Award className="w-5 h-5 text-amber-300" />
                    <span>১০০% লেদার গ্যারান্টি</span>
                  </div>
                  <div className="text-[11px] text-orange-100 mt-0.5">এক্সপোর্ট গ্রেড ফিনিশিং</div>
                </div>
              </div>

              {/* Right Column: 4 Key Craftsmanship Pillars */}
              <div className="lg:col-span-7 space-y-6">
                <div>
                  <span className="text-xs font-bold uppercase tracking-widest text-orange-400">
                    আমাদের বিশেষত্ব
                  </span>
                  <h2 className="text-2xl sm:text-4xl font-black text-white mt-1">
                    কেন Shopkeeper এর জুতা ও ব্যাগ আলাদা?
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-2 leading-relaxed">
                    আমরা শুধুমাত্র ট্রেন্ড নয়, স্থায়িত্ব ও পায়ের সর্বোচ্চ আরাম নিশ্চিত করতে প্রতি জোড়া জুতা ও ব্যাগে ব্যবহার করি বিশ্বমানের উপাদান।
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mb-2">
                      <Gem className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-white">ফুল-গ্রেইন এক্সপোর্ট লেদার</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      প্রিমিয়াম গ্রেড জেনুইন লেদার, যা সময়ের সাথে আরও মসৃণ ও আকর্ষণীয় দীপ্তি ছড়ায়।
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
                    <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400 mb-2">
                      <Feather className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-white">অর্থোপেডিক কুশন ইনসোল</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      দ্বিগুণ আরামদায়ক মেমোরি ফোম ইনসোল, যা সারাদিন ব্যবহারের পরও পায়ে কোনো ক্লান্তি আনে না।
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
                    <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-2">
                      <Layers className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-white">হ্যান্ড-ক্রাফটেড ডাবল স্টিচ</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      অভিজ্ঞ কারিগরদের নিখুঁত হাতে সেলাই, যা সহজে ছিঁড়ে যাওয়া বা নষ্ট হওয়া থেকে মুক্ত।
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-sm space-y-1">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-2">
                      <ShieldCheck className="w-5 h-5" />
                    </div>
                    <h4 className="text-sm font-bold text-white">অ্যান্টি-স্লিপ গ্রিপ সোল</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      উচ্চ মানের রাবার আউটসোল, যা যেকোনো ফ্লোর বা বৃষ্টিতে দেয় মজবুত ও নিরাপদ গ্রিপ।
                    </p>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════
            CUSTOMER REVIEWS & SOCIAL PROOF
        ═══════════════════════════════════════════════════ */}
        <section className="py-16 sm:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-12">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
                গ্রাহকদের রিভিউ
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
                গ্রাহকরা আমাদের সম্পর্কে কী বলছেন
              </h2>
              <div className="flex items-center justify-center gap-1 mt-2 text-amber-500 font-bold text-sm">
                <Star className="w-4 h-4 fill-amber-400" />
                <span>৪.৯/৫ রেটিং ভিত্তিক ১২,৫০০+ অর্ডারের অভিজ্ঞতা</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t, idx) => (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex text-amber-400">
                        {[...Array(t.rating)].map((_, i) => (
                          <Star key={i} className="w-4 h-4 fill-amber-400" />
                        ))}
                      </div>
                      {t.verified && (
                        <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-emerald-200">
                          <CheckCircle2 className="w-3 h-3 text-emerald-600" /> ভেরিফাইড ক্রেতা
                        </span>
                      )}
                    </div>

                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed italic">
                      &ldquo;{t.comment}&rdquo;
                    </p>

                    <div className="text-[11px] text-orange-600 font-semibold bg-orange-50/60 px-2.5 py-1 rounded-lg">
                      ক্রয় করেছেন: {t.product}
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-100 mt-4 flex items-center justify-between">
                    <div>
                      <h4 className="text-xs font-bold text-slate-900">{t.name}</h4>
                      <span className="text-[11px] text-slate-400">{t.role}</span>
                    </div>
                    <span className="text-[10px] text-slate-400 font-medium">{t.date}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════
            DELIVERY PARTNERS & COVERAGE STRIP
        ═══════════════════════════════════════════════════ */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-10">
          <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-6 text-center md:text-left">
            <div>
              <h3 className="text-base sm:text-lg font-black text-slate-900">
                সারা দেশে ৬৪ জেলায় বিশ্বস্ত ডেলিভারি নেটওয়ার্ক
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                আমরা Steadfast, RedX ও Pathao কুরিয়ারের মাধ্যমে নিরাপদে পার্সেল পৌঁছে দিই আপনার দোরগোড়ায়।
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 text-xs font-bold text-slate-700">
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">Steadfast Courier</span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">RedX Logistics</span>
              <span className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200">Pathao Courier</span>
              <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200">ক্যাশ অন ডেলিভারি</span>
            </div>
          </div>
        </section>


        {/* ═══════════════════════════════════════════════════
            FAQ SECTION
        ═══════════════════════════════════════════════════ */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-16">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600 bg-orange-50 px-3 py-1 rounded-full">
              সাধারণ জিজ্ঞাসা (FAQ)
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-2">
              সচরাচর জিজ্ঞাসিত প্রশ্নাবলী
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1">
              অর্ডার, সাইজ পরিবর্তন ও ডেলিভারি সম্পর্কিত সব তথ্য এখানে পাবেন।
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs"
              >
                <button
                  onClick={() => setOpenFaq(openFaq === idx ? null : idx)}
                  className="w-full p-4 sm:p-5 text-left flex items-center justify-between gap-4 font-bold text-xs sm:text-sm text-slate-900 hover:text-orange-600 transition-colors"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform ${
                      openFaq === idx ? 'rotate-180 text-orange-600' : ''
                    }`}
                  />
                </button>
                {openFaq === idx && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-600 border-t border-slate-100 leading-relaxed bg-slate-50/50">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════
            FLOATING QUICK ORDER / HELP BUTTON (Bottom Right)
        ═══════════════════════════════════════════════════ */}
        <div className="fixed bottom-20 md:bottom-6 right-4 z-40">
          <a
            href={`tel:${settings.hotline || '01712345678'}`}
            className="flex items-center gap-2 px-4 py-3 rounded-full bg-slate-900 hover:bg-orange-600 text-white font-black text-xs shadow-2xl border border-white/20 transition-all transform hover:scale-105"
            title="সরাসরি ফোন দিয়ে অর্ডার করুন"
          >
            <PhoneCall className="w-4 h-4 text-orange-400 animate-bounce" />
            <span className="hidden sm:inline">কল দিয়ে অর্ডার করুন:</span>
            <span className="text-orange-400 font-mono">{settings.hotline || '01712-345678'}</span>
          </a>
        </div>

      </main>

      <Footer />
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-500">লোড হচ্ছে...</div>}>
      <HomePageContent />
    </Suspense>
  );
}

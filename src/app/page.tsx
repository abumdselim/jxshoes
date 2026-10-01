'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import ProductCard from '@/components/ProductCard';
import { Product, CategoryItem, HeroBannerSettings, FlashDealSettings } from '@/types';
import { initialProducts, initialCategories, initialHeroBanner, initialFlashDeal } from '@/lib/initialData';
import { formatPrice } from '@/lib/utils';
import {
  ArrowRight,
  Sparkles,
  Filter,
  CheckCircle2,
  ChevronDown,
  Star,
  Flame
} from 'lucide-react';

function HomePageContent() {
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category') || 'all';
  const queryParam = searchParams.get('q') || '';

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>(initialCategories);
  const [heroBanner, setHeroBanner] = useState<HeroBannerSettings>(initialHeroBanner);
  const [flashDeal, setFlashDeal] = useState<FlashDealSettings>(initialFlashDeal);

  const [selectedCategory, setSelectedCategory] = useState<string>(categoryParam);
  const [selectedSize, setSelectedSize] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('featured');
  const [loading, setLoading] = useState<boolean>(true);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState<number | null>(null);

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
        const [prodRes, catRes, mktRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/categories'),
          fetch('/api/marketing'),
        ]);

        if (prodRes.ok) setProducts(await prodRes.json());
        else setProducts(initialProducts);

        if (catRes.ok) setCategories(await catRes.json());
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
    }
  }, [categoryParam]);

  // Testimonials
  const testimonials = [
    {
      name: 'আরিফুল ইসলাম',
      role: 'ঢাকা',
      rating: 5,
      comment: 'লোফার জুতোটা হাতে পেয়ে অবাক হয়েছি! জেনুইন লেদার এবং ফিনিশিং একদম আন্তর্জাতিক মানের। সাইজও পারফেক্ট হয়েছে।',
      date: '২ দিন আগে',
    },
    {
      name: 'ডা. সানজিদা রহমান',
      role: 'চট্টগ্রাম',
      rating: 5,
      comment: 'অফিস ব্যাগটা অর্ডার করেছিলাম। ২ দিনের মধ্যেই ক্যাশ অন ডেলিভারিতে পেয়েছি। ল্যাপটপ এবং ফাইল রাখার জন্য প্রচুর স্পেস।',
      date: '৪ দিন আগে',
    },
    {
      name: 'মাহমুদুল হাসান',
      role: 'সিলেট',
      rating: 5,
      comment: 'প্রথমে সাইজ নিয়ে একটু দ্বিধায় ছিলাম, তবে ডেলিভারি নেওয়ার পর দেখলাম ৪২ সাইজ একদম নিখুঁত ফিট হয়েছে। খুব আরামদায়ক।',
      date: '১ সপ্তাহ আগে',
    },
  ];

  // FAQs
  const faqs = [
    {
      q: 'পণ্য হাতে পেয়ে কি টাকা পরিশোধ (Cash on Delivery) করা যাবে?',
      a: 'হ্যাঁ, সারা বাংলাদেশে ১০০% ক্যাশ অন ডেলিভারি সুবিধা রয়েছে। ডেলিভারি ম্যানের কাছ থেকে পার্সেল বুঝে পেয়ে মূল্য পরিশোধ করবেন।',
    },
    {
      q: 'জুতার সাইজ না মিললে কি পরিবর্তন (Exchange) করা যাবে?',
      a: 'অবশ্যই! পার্সেল পাওয়ার পর সাইজ ছোট বা বড় হলে আমাদের হটলাইনে জানালে আমরা ৩ দিনের মধ্যে ফ্রিতে সাইজ পরিবর্তন করে দেব।',
    },
    {
      q: 'ডেলিভারি চার্জ কত এবং কতদিনে পণ্য পাব?',
      a: 'ঢাকা সিটির ভেতরে ডেলিভারি চার্জ মাত্র ৬০ টাকা (১-২ কার্যদিবস), এবং ঢাকার বাইরে সারা দেশে ১২০ টাকা (২-৩ কার্যদিবস)।',
    },
    {
      q: 'চামড়ার জুতা ও ব্যাগ কি আসল লেদারের?',
      a: 'আমাদের লেদার কালেকশনের প্রতিটি জুতা ও ব্যাগ ১০০% জেনুইন ফুল-গ্রেইন লেদার দিয়ে বিশেষভাবে তৈরি।',
    },
  ];

  const shoeSizes = ['39', '40', '41', '42', '43', '44', '45'];

  // Filter & Sort
  const filteredProducts = products.filter((p) => {
    const matchesCategory =
      selectedCategory === 'all' || p.category === selectedCategory;
    const matchesQuery =
      !queryParam ||
      p.name.toLowerCase().includes(queryParam.toLowerCase()) ||
      p.description.toLowerCase().includes(queryParam.toLowerCase()) ||
      (p.subCategory && p.subCategory.toLowerCase().includes(queryParam.toLowerCase()));
    const matchesSize =
      selectedSize === 'all' || p.sizes.includes(selectedSize);

    return matchesCategory && matchesQuery && matchesSize;
  }).sort((a, b) => {
    if (sortBy === 'price-low') return a.price - b.price;
    if (sortBy === 'price-high') return b.price - a.price;
    return 0;
  });

  // Dynamic Flash Deal Product
  const dealProduct = products.find((p) => p.id === flashDeal.targetProductId) || products[0];

  return (
    <>
      <Navbar />

      <main className="flex-1">
        {/* Dynamic Hero Section */}
        <section className="relative overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-stone-900 text-white py-12 lg:py-20">
          <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-96 h-96 bg-orange-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-10 w-96 h-96 bg-amber-600/15 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
              {/* Text Content */}
              <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-orange-500/10 border border-orange-500/30 text-orange-400 text-xs sm:text-sm font-semibold">
                  <Sparkles className="w-4 h-4 text-orange-400" />
                  <span>{heroBanner.badgeText}</span>
                </div>

                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black tracking-tight leading-[1.15]">
                  {heroBanner.titlePart1} <br className="hidden sm:inline" />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-300 to-orange-500">
                    {heroBanner.titleHighlight}
                  </span>
                </h1>

                <p className="text-sm sm:text-base text-slate-300 max-w-xl mx-auto lg:mx-0 leading-relaxed font-normal">
                  {heroBanner.subtitle}
                </p>

                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 pt-2">
                  <a
                    href="#catalog"
                    className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-500 text-white font-bold text-sm sm:text-base shadow-xl shadow-orange-600/25 transition-all transform hover:-translate-y-0.5"
                  >
                    <span>{heroBanner.ctaText}</span>
                    <ArrowRight className="w-5 h-5" />
                  </a>

                  <a
                    href="/admin"
                    className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm sm:text-base border border-white/20 transition-all backdrop-blur-sm"
                  >
                    <span>এডমিন প্যানেল</span>
                  </a>
                </div>

                {/* Trust Points */}
                <div className="grid grid-cols-3 gap-2 pt-4 text-xs text-slate-300 border-t border-slate-800/80">
                  <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                    <CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <span>ক্যাশ অন ডেলিভারি</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                    <CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <span>৭ দিনে সাইজ এক্সচেঞ্জ</span>
                  </div>
                  <div className="flex items-center gap-1.5 justify-center lg:justify-start">
                    <CheckCircle2 className="w-4 h-4 text-orange-400 flex-shrink-0" />
                    <span>১০০% আসল লেদার</span>
                  </div>
                </div>
              </div>

              {/* Showcase Grid Right Side */}
              <div className="lg:col-span-5 grid grid-cols-2 gap-3.5">
                <div className="space-y-3.5">
                  <div className="rounded-2xl overflow-hidden aspect-[4/5] bg-slate-800 border border-white/10 shadow-xl group">
                    <img
                      src="https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800"
                      alt="Sneakers"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                  <div className="p-3 bg-white/10 rounded-xl backdrop-blur border border-white/10 text-center">
                    <span className="text-[10px] uppercase font-bold text-orange-400 tracking-wider">জুতা</span>
                    <p className="text-xs font-bold text-white">{heroBanner.shoeHighlightText || 'স্নিকার্স ও লেদার শুজ'}</p>
                  </div>
                </div>

                <div className="space-y-3.5 pt-6">
                  <div className="p-3 bg-white/10 rounded-xl backdrop-blur border border-white/10 text-center">
                    <span className="text-[10px] uppercase font-bold text-amber-400 tracking-wider">ব্যাগ</span>
                    <p className="text-xs font-bold text-white">{heroBanner.bagHighlightText || 'ল্যাপটপ ও ট্রাভেল ব্যাগ'}</p>
                  </div>
                  <div className="rounded-2xl overflow-hidden aspect-[4/5] bg-slate-800 border border-white/10 shadow-xl group">
                    <img
                      src="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=800"
                      alt="Leather Bag"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Dynamic Categories Visual Cards */}
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6 sm:-mt-8 relative z-20">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
            {categories.map((cat) => (
              <a
                key={cat.id}
                href={`/?category=${cat.parentType}#catalog`}
                onClick={() => setSelectedCategory(cat.parentType)}
                className="bg-white rounded-2xl p-3 border border-slate-200/90 shadow-md hover:shadow-xl hover:border-orange-500/50 transition-all duration-300 flex flex-col items-center text-center group cursor-pointer"
              >
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden bg-slate-100 mb-2 border border-slate-100">
                  <img
                    src={cat.image}
                    alt={cat.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                  />
                </div>
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-1">
                  {cat.name}
                </h4>
                <span className="text-[10px] text-slate-400 mt-0.5">{cat.itemCountLabel || 'ক্যাটালগ'}</span>
              </a>
            ))}
          </div>
        </section>

        {/* Dynamic Flash Deal Banner (Controlled from Admin) */}
        {flashDeal.enabled && dealProduct && (
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="rounded-3xl bg-gradient-to-r from-orange-600 via-amber-600 to-orange-700 p-6 sm:p-10 text-white shadow-xl relative overflow-hidden">
              <div className="absolute right-0 top-0 w-96 h-96 bg-white/10 rounded-full blur-2xl pointer-events-none" />

              <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center relative z-10">
                <div className="md:col-span-8 space-y-4">
                  <div className="inline-flex items-center gap-2 bg-black/20 backdrop-blur-md px-3.5 py-1 rounded-full text-xs font-bold tracking-wide">
                    <Flame className="w-4 h-4 text-yellow-300 animate-pulse" />
                    <span>{flashDeal.badgeText}</span>
                  </div>

                  <h3 className="text-2xl sm:text-3xl font-black">
                    {dealProduct.name}
                  </h3>

                  <p className="text-xs sm:text-sm text-orange-100 max-w-xl">
                    {dealProduct.description}
                  </p>

                  {/* Countdown Timer */}
                  <div className="flex items-center gap-3 pt-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-orange-200">অফারের সময় বাকি:</span>
                    <div className="flex items-center gap-2 font-mono font-bold text-xs sm:text-sm">
                      <span className="bg-black/30 px-2.5 py-1.5 rounded-lg">{String(timeLeft.hours).padStart(2, '0')} ঘ</span>
                      <span>:</span>
                      <span className="bg-black/30 px-2.5 py-1.5 rounded-lg">{String(timeLeft.minutes).padStart(2, '0')} মি</span>
                      <span>:</span>
                      <span className="bg-black/30 px-2.5 py-1.5 rounded-lg text-yellow-300">{String(timeLeft.seconds).padStart(2, '0')} সে</span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-4">
                    <span className="text-2xl sm:text-3xl font-black text-white">
                      {formatPrice(dealProduct.price)}
                    </span>
                    {dealProduct.originalPrice && (
                      <span className="text-sm text-orange-200 line-through">
                        {formatPrice(dealProduct.originalPrice)}
                      </span>
                    )}
                    <a
                      href={`/product/${dealProduct.id}`}
                      className="px-6 py-2.5 rounded-xl bg-white text-orange-700 hover:bg-orange-50 font-bold text-xs sm:text-sm shadow-md transition-all ml-2"
                    >
                      এখনই অর্ডার করুন
                    </a>
                  </div>
                </div>

                <div className="md:col-span-4 flex justify-center">
                  <div className="w-52 sm:w-64 aspect-square rounded-2xl overflow-hidden shadow-2xl border-4 border-white/20 bg-slate-900">
                    <img
                      src={dealProduct.images[0]}
                      alt={dealProduct.name}
                      className="w-full h-full object-cover"
                    />
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Catalog Section */}
        <section id="catalog" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
                JX ক্যাটালগ
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                {selectedCategory === 'shoes'
                  ? 'প্রিমিয়াম জুতার কালেকশন'
                  : selectedCategory === 'bags'
                  ? 'আকর্ষণীয় ব্যাগের কালেকশন'
                  : 'আমাদের সকল কালেকশন'}
              </h2>
            </div>

            {/* Sort Dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500">সর্ট:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-white border border-slate-200 text-xs font-semibold rounded-xl px-3 py-2 text-slate-700 focus:outline-none"
              >
                <option value="featured">ফিচার্ড / নতুন</option>
                <option value="price-low">দাম: কম থেকে বেশি</option>
                <option value="price-high">দাম: বেশি থেকে কম</option>
              </select>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm mb-8 space-y-4">
            {/* Main Category Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => { setSelectedCategory('all'); setSelectedSize('all'); }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedCategory === 'all'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                সব পণ্য ({products.length})
              </button>
              <button
                onClick={() => { setSelectedCategory('shoes'); setSelectedSize('all'); }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedCategory === 'shoes'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                👟 জুতা (Shoes)
              </button>
              <button
                onClick={() => { setSelectedCategory('bags'); setSelectedSize('all'); }}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                  selectedCategory === 'bags'
                    ? 'bg-orange-600 text-white shadow-md shadow-orange-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                🎒 ব্যাগ (Bags)
              </button>
            </div>

            {/* Shoe Size Specific Filter */}
            {(selectedCategory === 'shoes' || selectedCategory === 'all') && (
              <div className="pt-3 border-t border-slate-100 flex items-center gap-1.5 flex-wrap text-xs">
                <span className="font-semibold text-slate-500 flex items-center gap-1 mr-1">
                  <Filter className="w-3.5 h-3.5 text-orange-600" />
                  সাইজ:
                </span>
                <button
                  onClick={() => setSelectedSize('all')}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
                    selectedSize === 'all'
                      ? 'bg-orange-100 text-orange-700 font-bold'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  সকল সাইজ
                </button>
                {shoeSizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`px-2.5 py-1 rounded-lg font-medium transition-colors ${
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
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 py-12">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <div key={n} className="bg-white rounded-2xl h-80 animate-pulse border border-slate-200" />
              ))}
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center my-6">
              <p className="text-base font-bold text-slate-800">কোনো প্রোডাক্ট পাওয়া যায়নি!</p>
              <button
                onClick={() => { setSelectedCategory('all'); setSelectedSize('all'); }}
                className="mt-4 px-4 py-2 bg-orange-600 text-white rounded-xl text-xs font-semibold"
              >
                ফিল্টার রিসেট করুন
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        {/* Customer Testimonials Section */}
        <section className="bg-slate-100 py-16 mt-16 border-t border-slate-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center max-w-xl mx-auto mb-10">
              <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
                গ্রাহকদের সন্তুষ্টি
              </span>
              <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
                গ্রাহকরা আমাদের সম্পর্কে কী বলছেন
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {testimonials.map((t, idx) => (
                <div
                  key={idx}
                  className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-1 text-amber-400">
                      {[...Array(t.rating)].map((_, i) => (
                        <Star key={i} className="w-4 h-4 fill-amber-400" />
                      ))}
                    </div>
                    <p className="text-xs sm:text-sm text-slate-600 leading-relaxed italic">
                      &ldquo;{t.comment}&rdquo;
                    </p>
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

        {/* FAQ Section */}
        <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600">
              সাধারণ জিজ্ঞাসা (FAQ)
            </span>
            <h2 className="text-2xl sm:text-3xl font-black text-slate-900 mt-1">
              সচরাচর জিজ্ঞাসিত প্রশ্নাবলী
            </h2>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm"
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

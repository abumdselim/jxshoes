'use client';

export const runtime = 'edge';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Product } from '@/types';
import { initialProducts } from '@/lib/initialData';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/context/CartContext';
import { ShoppingBag, Truck, RotateCcw, ShieldCheck, Star, Check, ArrowLeft, Zap, Heart } from 'lucide-react';
import CartIcon from '@/components/CartIcon';

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToCart } = useCart();

  const [product, setProduct] = useState<Product | null>(null);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [selectedSize, setSelectedSize] = useState<string>('');
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/products/${params.id}`);
        if (res.ok) {
          const data = await res.json();
          setProduct(data);
          setSelectedImage(data.images[0]);
          setSelectedSize(data.sizes[0] || 'Standard');
          setSelectedColor(data.colors[0]?.name || 'Standard');
        } else {
          const found = initialProducts.find((p) => p.id === params.id);
          if (found) {
            setProduct(found);
            setSelectedImage(found.images[0]);
            setSelectedSize(found.sizes[0] || 'Standard');
            setSelectedColor(found.colors[0]?.name || 'Standard');
          }
        }
      } catch (e) {
        const found = initialProducts.find((p) => p.id === params.id);
        if (found) {
          setProduct(found);
          setSelectedImage(found.images[0]);
          setSelectedSize(found.sizes[0] || 'Standard');
          setSelectedColor(found.colors[0]?.name || 'Standard');
        }
      } finally {
        setLoading(false);
      }
    }
    fetchProduct();
  }, [params.id]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <div className="w-12 h-12 border-4 border-orange-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-600 font-medium text-sm">প্রোডাক্ট লোড হচ্ছে...</p>
        </div>
        <Footer />
      </>
    );
  }

  if (!product) {
    return (
      <>
        <Navbar />
        <div className="max-w-7xl mx-auto px-4 py-20 text-center">
          <p className="text-xl font-bold text-slate-800">প্রোডাক্টটি খুঁজে পাওয়া যায়নি!</p>
          <a href="/" className="mt-4 inline-flex items-center gap-2 text-orange-600 font-semibold text-sm">
            <ArrowLeft className="w-4 h-4" /> হোমপেইজে ফিরে যান
          </a>
        </div>
        <Footer />
      </>
    );
  }

  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const handleAddToCart = () => {
    addToCart(product, selectedSize, selectedColor, quantity);
  };

  const handleBuyNow = () => {
    addToCart(product, selectedSize, selectedColor, quantity);
    router.push('/checkout');
  };

  return (
    <>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 flex-1 pb-24 md:pb-10">
        {/* Breadcrumb */}
        <div className="mb-4 sm:mb-6 flex items-center gap-2 text-xs font-medium text-slate-500 overflow-x-auto whitespace-nowrap">
          <a href="/" className="hover:text-orange-600">হোম</a>
          <span>/</span>
          <a href={`/?category=${product.category}`} className="hover:text-orange-600 capitalize">
            {product.category === 'shoes' ? 'জুতা (Shoes)' : 'ব্যাগ (Bags)'}
          </a>
          <span>/</span>
          <span className="text-slate-900 truncate max-w-xs">{product.name}</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12 bg-white p-4 sm:p-8 lg:p-10 rounded-3xl border border-slate-200/80 shadow-sm">
          {/* Images Section */}
          <div className="space-y-4">
            <div className="aspect-square rounded-2xl overflow-hidden bg-slate-100 border border-slate-200 relative group">
              <img
                src={selectedImage}
                alt={product.name}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              {discountPercent > 0 && (
                <span className="absolute top-4 left-4 bg-red-500 text-white text-xs font-bold px-3 py-1 rounded-full shadow-md">
                  -{discountPercent}% ছাড়
                </span>
              )}
            </div>

            {/* Thumbnails */}
            {product.images.length > 1 && (
              <div className="flex items-center gap-3 overflow-x-auto pb-2">
                {product.images.map((img, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedImage(img)}
                    className={`w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border-2 flex-shrink-0 transition-all ${
                      selectedImage === img
                        ? 'border-orange-600 scale-95 shadow-md ring-2 ring-orange-500/20'
                        : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <img src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Details & Purchase Section */}
          <div className="space-y-6 flex flex-col justify-between">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-lg bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider">
                  {product.subCategory || (product.category === 'shoes' ? 'জুতা' : 'ব্যাগ')}
                </span>
                <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  <span>{product.rating || '4.9'}</span>
                  <span className="text-slate-400 font-normal">(৫২+ রিভিউ)</span>
                </div>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
                {product.name}
              </h1>

              {/* Price */}
              <div className="flex items-baseline gap-3">
                <span className="text-3xl sm:text-4xl font-black text-slate-900">
                  {formatPrice(product.price)}
                </span>
                {product.originalPrice && (
                  <span className="text-base sm:text-lg text-slate-400 line-through">
                    {formatPrice(product.originalPrice)}
                  </span>
                )}
                {product.inStock ? (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 ml-1">
                    স্টকে আছে ({product.stockCount} টি)
                  </span>
                ) : (
                  <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-red-100 text-red-800 ml-1">
                    স্টক শেষ
                  </span>
                )}
              </div>

              <p className="text-xs sm:text-sm text-slate-600 leading-relaxed pt-1">
                {product.description}
              </p>

              {/* Size Selector */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5">
                <div className="flex items-center justify-between text-xs font-semibold">
                  <span className="text-slate-800">
                    {product.category === 'shoes' ? 'জুতার সাইজ নির্বাচন করুন:' : 'সাইজ নির্বাচন:'}
                  </span>
                  <span className="text-orange-600 font-bold cursor-pointer">সাইজ চার্ট (Size Chart)</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size}
                      onClick={() => setSelectedSize(size)}
                      className={`min-w-[46px] h-10 px-3 rounded-xl text-xs sm:text-sm font-bold border transition-all ${
                        selectedSize === size
                          ? 'border-orange-600 bg-orange-600 text-white shadow-md shadow-orange-600/20 scale-105'
                          : 'border-slate-200 bg-white text-slate-700 hover:border-slate-400'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Selector */}
              {product.colors && product.colors.length > 0 && (
                <div className="space-y-2 pt-2">
                  <span className="text-xs font-semibold text-slate-800 block">
                    কালার: <span className="text-orange-600 font-bold">{selectedColor}</span>
                  </span>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {product.colors.map((c) => (
                      <button
                        key={c.name}
                        onClick={() => setSelectedColor(c.name)}
                        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-semibold transition-all ${
                          selectedColor === c.name
                            ? 'border-orange-600 bg-orange-50/60 text-slate-900 ring-2 ring-orange-500/20'
                            : 'border-slate-200 text-slate-600 hover:border-slate-300'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/10 inline-block shadow-inner"
                          style={{ backgroundColor: c.hex }}
                        />
                        <span>{c.name}</span>
                        {selectedColor === c.name && (
                          <Check className="w-3.5 h-3.5 text-orange-600" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Quantity */}
              <div className="flex items-center gap-4 pt-2">
                <span className="text-xs font-semibold text-slate-800">পরিমাণ:</span>
                <div className="flex items-center border border-slate-200 rounded-xl bg-slate-50 overflow-hidden">
                  <button
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="px-3 py-1 text-slate-600 hover:bg-slate-200 text-sm font-bold"
                  >
                    -
                  </button>
                  <span className="px-4 text-xs font-bold text-slate-900">{quantity}</span>
                  <button
                    onClick={() => setQuantity(quantity + 1)}
                    className="px-3 py-1 text-slate-600 hover:bg-slate-200 text-sm font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            </div>

            {/* Actions for Desktop */}
            <div className="space-y-3 pt-6 border-t border-slate-100 hidden md:block">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handleAddToCart}
                  className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-orange-50 hover:bg-orange-100 text-orange-600 font-extrabold text-sm border-2 border-orange-500/30 transition-all shadow-sm"
                >
                  <ShoppingBag className="w-5 h-5" />
                  <span>ব্যাগে যোগ করুন</span>
                </button>

                <button
                  onClick={handleBuyNow}
                  className="flex items-center justify-center gap-2 py-3.5 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm shadow-xl shadow-orange-600/30 transition-all transform hover:-translate-y-0.5"
                >
                  <Zap className="w-5 h-5" />
                  <span>এখনই কিনুন (ক্যাশ অন ডেলিভারি)</span>
                </button>
              </div>

              {/* Quick delivery notice */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100 space-y-2 text-xs text-slate-600 mt-4">
                <div className="flex items-center gap-2 font-medium">
                  <Truck className="w-4 h-4 text-orange-600" />
                  <span>ঢাকার ভেতরে ২ দিন (৬০৳) | ঢাকার বাইরে ৩ দিন (১২০৳)</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <RotateCcw className="w-4 h-4 text-orange-600" />
                  <span>সাইজ না মিললে সাথে সাথে ফ্রি পরিবর্তন সুবিধা</span>
                </div>
                <div className="flex items-center gap-2 font-medium">
                  <ShieldCheck className="w-4 h-4 text-orange-600" />
                  <span>১০০% আসল প্রোডাক্ট ও কোয়ালিটি গ্যারান্টি</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sticky Mobile Buy Now Bar */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 p-3 z-50 shadow-2xl flex items-center justify-between gap-3">
          <div>
            <div className="text-[10px] text-slate-400 font-medium">মোট মূল্য:</div>
            <div className="text-lg font-black text-slate-900 leading-none">
              {formatPrice(product.price * quantity)}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-1 justify-end">
            <button
              onClick={handleAddToCart}
              className="p-3 rounded-xl bg-orange-50 text-orange-600 font-bold border border-orange-200 hover:bg-orange-100 transition-colors"
              title="ব্যাগে যোগ করুন"
              aria-label="ব্যাগে যোগ করুন"
            >
              <CartIcon className="w-5 h-5 text-orange-600" />
            </button>
            <button
              onClick={handleBuyNow}
              className="flex-1 py-3 px-4 rounded-xl bg-orange-600 text-white font-extrabold text-xs shadow-md text-center flex items-center justify-center gap-1.5"
            >
              <Zap className="w-4 h-4" />
              <span>ক্যাশ অন ডেলিভারিতে কিনুন</span>
            </button>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

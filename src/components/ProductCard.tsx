'use client';

import React, { useState } from 'react';
import { Product } from '@/types';
import { formatPrice } from '@/lib/utils';
import { ShoppingBag, Eye, Star, Check } from 'lucide-react';
import { useCart } from '@/context/CartContext';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const [added, setAdded] = useState(false);

  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const defaultSize = product.sizes[0] || 'Standard';
  const defaultColor = product.colors[0]?.name || 'Standard';

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, defaultSize, defaultColor, 1);
    setAdded(true);
    setTimeout(() => setAdded(false), 1500);
  };

  const hasSecondImage = product.images && product.images.length > 1;

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 hover:border-orange-500/40 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden">
      {/* Product Image Container */}
      <a href={`/product/${product.id}`} className="relative block aspect-square overflow-hidden bg-slate-100">
        {/* Main Image */}
        <img
          src={product.images[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800'}
          alt={product.name}
          className={`w-full h-full object-cover transition-all duration-500 ease-out ${
            hasSecondImage ? 'group-hover:opacity-0 group-hover:scale-105' : 'group-hover:scale-105'
          }`}
        />

        {/* Alternate Image on Hover */}
        {hasSecondImage && (
          <img
            src={product.images[1]}
            alt={`${product.name} alternate view`}
            className="absolute inset-0 w-full h-full object-cover opacity-0 group-hover:opacity-100 group-hover:scale-105 transition-all duration-500 ease-out"
          />
        )}

        {/* Badges */}
        <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 z-10">
          {discountPercent > 0 && (
            <span className="bg-rose-600 text-white text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full shadow-md tracking-tight">
              -{discountPercent}% ছাড়
            </span>
          )}
          {product.isFeatured && (
            <span className="bg-orange-600 text-white text-[10px] sm:text-[11px] font-black px-2 py-0.5 rounded-full shadow-md tracking-tight">
              হট ডিল 🔥
            </span>
          )}
        </div>

        {/* Quick View overlay */}
        <div className="absolute inset-0 bg-black/15 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <span className="bg-white/95 text-slate-900 text-xs font-bold px-3.5 py-1.5 rounded-full shadow-lg flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <Eye className="w-3.5 h-3.5 text-orange-600" /> বিস্তারিত দেখুন
          </span>
        </div>
      </a>

      {/* Info */}
      <div className="p-3 sm:p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Category, Rating & Color Swatches */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
            <span className="uppercase font-bold tracking-wider text-[10px] text-orange-600 truncate max-w-[90px] sm:max-w-none">
              {product.subCategory || (product.category === 'shoes' ? 'জুতা' : 'ব্যাগ')}
            </span>

            <div className="flex items-center gap-1.5">
              {/* Color dots preview */}
              {product.colors && product.colors.length > 0 && (
                <div className="flex items-center -space-x-1 mr-1">
                  {product.colors.slice(0, 3).map((c, i) => (
                    <span
                      key={i}
                      title={c.name}
                      className="w-2.5 h-2.5 rounded-full border border-white shadow-xs inline-block"
                      style={{ backgroundColor: c.hex }}
                    />
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1 text-amber-500 font-bold text-[11px] sm:text-xs">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{product.rating || '4.9'}</span>
              </div>
            </div>
          </div>

          {/* Title */}
          <a
            href={`/product/${product.id}`}
            className="block text-xs sm:text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-1"
          >
            {product.name}
          </a>

          {/* Sizes preview */}
          <div className="flex items-center gap-1 mt-1.5 sm:mt-2 overflow-hidden flex-wrap">
            <span className="text-[10px] sm:text-[11px] text-slate-400 mr-0.5 font-medium">সাইজ:</span>
            {product.sizes.slice(0, 3).map((s) => (
              <span
                key={s}
                className="text-[10px] font-semibold bg-slate-100 text-slate-700 px-1 sm:px-1.5 py-0.5 rounded border border-slate-200"
              >
                {s}
              </span>
            ))}
            {product.sizes.length > 3 && (
              <span className="text-[10px] font-bold text-slate-400">+{product.sizes.length - 3}</span>
            )}
          </div>
        </div>

        {/* Price, Stock status & Action */}
        <div className="mt-3 sm:mt-4 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center justify-between gap-1.5 sm:gap-2">
          <div>
            <div className="text-sm sm:text-lg font-black text-slate-900 tracking-tight">
              {formatPrice(product.price)}
            </div>
            {product.originalPrice && product.originalPrice > product.price && (
              <div className="text-[10px] sm:text-xs text-slate-400 line-through">
                {formatPrice(product.originalPrice)}
              </div>
            )}
          </div>

          <button
            onClick={handleQuickAdd}
            disabled={added}
            className={`flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 rounded-xl text-xs font-bold transition-all shadow-sm ${
              added
                ? 'bg-emerald-600 text-white'
                : 'bg-orange-50 hover:bg-orange-600 text-orange-600 hover:text-white'
            }`}
            title="ব্যাগে যোগ করুন"
          >
            {added ? (
              <>
                <Check className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">যোগ হয়েছে</span>
              </>
            ) : (
              <>
                <ShoppingBag className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">অর্ডার</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

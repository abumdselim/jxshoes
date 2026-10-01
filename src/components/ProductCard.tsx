'use client';

import React from 'react';
import { Product } from '@/types';
import { formatPrice } from '@/lib/utils';
import { ShoppingBag, Eye, Star } from 'lucide-react';
import { useCart } from '@/context/CartContext';

interface ProductCardProps {
  product: Product;
}

export default function ProductCard({ product }: ProductCardProps) {
  const { addToCart } = useCart();
  const discountPercent = product.originalPrice
    ? Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)
    : 0;

  const defaultSize = product.sizes[0] || 'Standard';
  const defaultColor = product.colors[0]?.name || 'Standard';

  const handleQuickAdd = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addToCart(product, defaultSize, defaultColor, 1);
  };

  return (
    <div className="group relative bg-white rounded-2xl border border-slate-200/80 hover:border-orange-500/40 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col overflow-hidden">
      {/* Product Image Container */}
      <a href={`/product/${product.id}`} className="relative block aspect-square overflow-hidden bg-slate-100">
        <img
          src={product.images[0] || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800'}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
        />

        {/* Badges */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
          {discountPercent > 0 && (
            <span className="bg-red-500 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              -{discountPercent}% ছাড়
            </span>
          )}
          {product.isFeatured && (
            <span className="bg-orange-600 text-white text-[11px] font-bold px-2 py-0.5 rounded-full shadow-sm">
              হট ডিল
            </span>
          )}
        </div>

        {/* Quick View overlay */}
        <div className="absolute inset-0 bg-black/10 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
          <span className="bg-white/95 text-slate-800 text-xs font-semibold px-3 py-1.5 rounded-full shadow-md flex items-center gap-1.5 transform translate-y-2 group-hover:translate-y-0 transition-transform">
            <Eye className="w-3.5 h-3.5" /> বিস্তারিত দেখুন
          </span>
        </div>
      </a>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Category & Rating */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-1">
            <span className="uppercase font-semibold tracking-wider text-[10px] text-orange-600">
              {product.subCategory || (product.category === 'shoes' ? 'জুতা' : 'ব্যাগ')}
            </span>
            <div className="flex items-center gap-1 text-amber-500 font-semibold">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              <span>{product.rating || '4.9'}</span>
            </div>
          </div>

          {/* Title */}
          <a
            href={`/product/${product.id}`}
            className="block text-sm sm:text-base font-bold text-slate-900 group-hover:text-orange-600 transition-colors line-clamp-1"
          >
            {product.name}
          </a>

          {/* Sizes preview */}
          <div className="flex items-center gap-1 mt-2 overflow-hidden flex-wrap">
            <span className="text-[11px] text-slate-400 mr-1 font-medium">সাইজ:</span>
            {product.sizes.slice(0, 4).map((s) => (
              <span
                key={s}
                className="text-[10px] font-medium bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200"
              >
                {s}
              </span>
            ))}
            {product.sizes.length > 4 && (
              <span className="text-[10px] text-slate-400">+{product.sizes.length - 4}</span>
            )}
          </div>
        </div>

        {/* Price & Action */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <div className="text-base sm:text-lg font-black text-slate-900">
              {formatPrice(product.price)}
            </div>
            {product.originalPrice && (
              <div className="text-xs text-slate-400 line-through">
                {formatPrice(product.originalPrice)}
              </div>
            )}
          </div>

          <button
            onClick={handleQuickAdd}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-orange-50 hover:bg-orange-600 text-orange-600 hover:text-white text-xs font-bold transition-all shadow-sm group/btn"
            title="ব্যাগে যোগ করুন"
          >
            <ShoppingBag className="w-4 h-4" />
            <span className="hidden sm:inline">অর্ডার</span>
          </button>
        </div>
      </div>
    </div>
  );
}

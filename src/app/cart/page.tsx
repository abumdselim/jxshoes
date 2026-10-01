'use client';

import React from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';
import { Trash2, Plus, Minus, ArrowRight } from 'lucide-react';
import CartIcon from '@/components/CartIcon';

export default function CartPage() {
  const { cart, removeFromCart, updateQuantity, subtotal, totalItems } = useCart();

  return (
    <>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 flex-1">
        <h1 className="text-3xl font-black text-slate-900 mb-8 flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center shadow-md shadow-orange-600/30">
            <CartIcon className="w-6 h-6 text-white" />
          </div>
          <span>আপনার কার্ট ({totalItems} টি পণ্য)</span>
        </h1>

        {cart.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-16 text-center shadow-sm">
            <div className="w-20 h-20 rounded-full bg-orange-600 text-white flex items-center justify-center mx-auto mb-4 shadow-lg shadow-orange-600/30">
              <CartIcon className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">আপনার ব্যাগটি এখন খালি</h2>
            <p className="text-sm text-slate-500 mt-2">নতুন কালেকশন থেকে আপনার পছন্দের জুতা বা ব্যাগ যোগ করুন।</p>
            <a
              href="/"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold text-sm hover:bg-orange-700 transition-all shadow-md"
            >
              কালেকশন দেখুন
            </a>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
            {/* Items list */}
            <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200 p-6 shadow-sm divide-y divide-slate-100">
              {cart.map((item) => (
                <div
                  key={`${item.productId}-${item.selectedSize}-${item.selectedColor}`}
                  className="py-6 first:pt-0 last:pb-0 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-4">
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-20 h-20 rounded-2xl object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                    />
                    <div>
                      <h3 className="font-bold text-slate-900 text-base">{item.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-slate-500 mt-1 font-medium">
                        <span className="bg-slate-100 px-2 py-0.5 rounded">সাইজ: {item.selectedSize}</span>
                        <span className="bg-slate-100 px-2 py-0.5 rounded">কালার: {item.selectedColor}</span>
                      </div>
                      <div className="text-sm font-extrabold text-orange-600 mt-1">
                        {formatPrice(item.price)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-6 w-full sm:w-auto">
                    <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50">
                      <button
                        onClick={() => updateQuantity(item.productId, item.selectedSize, item.selectedColor, item.quantity - 1)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-200"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="px-3 text-sm font-bold text-slate-800">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.selectedSize, item.selectedColor, item.quantity + 1)}
                        className="px-2.5 py-1 text-slate-600 hover:bg-slate-200"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <span className="font-black text-base text-slate-900 w-24 text-right">
                      {formatPrice(item.price * item.quantity)}
                    </span>

                    <button
                      onClick={() => removeFromCart(item.productId, item.selectedSize, item.selectedColor)}
                      className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition-colors"
                      title="মুছে ফেলুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Summary */}
            <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-sm space-y-6">
              <h3 className="font-bold text-lg text-slate-900">অর্ডার সারসংক্ষেপ</h3>

              <div className="space-y-3 text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>সাবটোটাল</span>
                  <span className="font-bold text-slate-900">{formatPrice(subtotal)}</span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>ডেলিভারি চার্জ</span>
                  <span className="text-xs text-orange-600 font-semibold">চেকআউট পেজে ক্যালকুলেট হবে</span>
                </div>
                <div className="pt-4 border-t border-slate-100 flex justify-between text-base font-black text-slate-900">
                  <span>মোট</span>
                  <span className="text-xl text-orange-600">{formatPrice(subtotal)}</span>
                </div>
              </div>

              <a
                href="/checkout"
                className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-base shadow-lg shadow-orange-600/30 transition-all"
              >
                <span>অর্ডার সম্পন্ন করতে এগিয়ে যান</span>
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </>
  );
}

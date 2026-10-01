'use client';

import React from 'react';
import { X, Trash2, ArrowRight, Plus, Minus } from 'lucide-react';
import CartIcon from '@/components/CartIcon';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';

export default function CartDrawer() {
  const { cart, removeFromCart, updateQuantity, isCartOpen, setIsCartOpen, subtotal, totalItems } = useCart();

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
        onClick={() => setIsCartOpen(false)}
      />

      <div className="fixed inset-y-0 right-0 max-w-full flex sm:pl-10 w-full justify-end">
        <div className="w-full sm:max-w-md bg-white shadow-2xl flex flex-col h-full">
          {/* Header */}
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CartIcon className="w-5 h-5 text-orange-600" />
              <h2 className="text-lg font-bold text-slate-900">
                আপনার কার্ট ({totalItems})
              </h2>
            </div>
            <button
              onClick={() => setIsCartOpen(false)}
              className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            {cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 py-12">
                <div className="w-20 h-20 rounded-full bg-orange-50 flex items-center justify-center text-orange-500 mb-4">
                  <CartIcon className="w-10 h-10 text-orange-500" />
                </div>
                <p className="text-base font-semibold text-slate-800">আপনার শপিং ব্যাগ খালি!</p>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  পছন্দের জুতা বা ব্যাগ খুঁজে ব্যাগে যোগ করুন।
                </p>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="mt-6 px-6 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-all shadow-md shadow-orange-600/20"
                >
                  শপিং শুরু করুন
                </button>
              </div>
            ) : (
              cart.map((item) => (
                <div
                  key={`${item.productId}-${item.selectedSize}-${item.selectedColor}`}
                  className="flex gap-4 p-3.5 rounded-2xl border border-slate-100 bg-slate-50/50 hover:bg-slate-50 transition-colors"
                >
                  <img
                    src={item.image}
                    alt={item.name}
                    className="w-20 h-20 rounded-xl object-cover border border-slate-200 flex-shrink-0 bg-white"
                  />
                  <div className="flex-1 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-sm font-bold text-slate-900 line-clamp-1">{item.name}</h4>
                        <button
                          onClick={() => removeFromCart(item.productId, item.selectedSize, item.selectedColor)}
                          className="text-slate-400 hover:text-red-500 transition-colors"
                          title="রিমুভ করুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-600 mt-1 font-medium">
                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          সাইজ: {item.selectedSize}
                        </span>
                        <span className="bg-white px-2 py-0.5 rounded-md border border-slate-200">
                          কালার: {item.selectedColor}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div className="flex items-center border border-slate-200 rounded-lg bg-white overflow-hidden">
                        <button
                          onClick={() => updateQuantity(item.productId, item.selectedSize, item.selectedColor, item.quantity - 1)}
                          className="p-1 hover:bg-slate-100 text-slate-600"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="px-2.5 text-xs font-bold text-slate-800">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.productId, item.selectedSize, item.selectedColor, item.quantity + 1)}
                          className="p-1 hover:bg-slate-100 text-slate-600"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      <span className="font-extrabold text-sm text-slate-900">
                        {formatPrice(item.price * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Footer / Checkout */}
          {cart.length > 0 && (
            <div className="p-6 border-t border-slate-100 bg-white space-y-4">
              <div className="flex items-center justify-between text-base">
                <span className="text-slate-600 font-medium">মোট সাবটোটাল:</span>
                <span className="text-xl font-black text-slate-900">{formatPrice(subtotal)}</span>
              </div>
              <p className="text-xs text-slate-500">
                * ডেলিভারি চার্জ চেকআউট পেইজে সিলেক্ট করতে পারবেন (ঢাকার ভেতরে ৬০৳, বাইরে ১২০৳)।
              </p>
              <a
                href="/checkout"
                onClick={() => setIsCartOpen(false)}
                className="w-full flex items-center justify-center gap-2 py-3.5 px-4 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-base shadow-lg shadow-orange-600/25 transition-all transform active:scale-95"
              >
                <span>অর্ডার কনফার্ম করুন (চেকআউট)</span>
                <ArrowRight className="w-5 h-5" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { useCart } from '@/context/CartContext';
import { formatPrice } from '@/lib/utils';
import { StoreSettings } from '@/types';
import { initialStoreSettings } from '@/lib/initialData';
import { CheckCircle2, Truck, ShieldCheck, MapPin, Phone, User, Tag, ArrowRight, Check, AlertCircle } from 'lucide-react';

export default function CheckoutPage() {
  const router = useRouter();
  const { cart, subtotal, clearCart } = useCart();

  const [settings, setSettings] = useState<StoreSettings>(initialStoreSettings);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [city, setCity] = useState<'Inside Dhaka' | 'Outside Dhaka'>('Inside Dhaka');
  const [paymentMethod, setPaymentMethod] = useState<'Cash on Delivery' | 'bKash / Nagad'>('Cash on Delivery');
  const [bkashTrxId, setBkashTrxId] = useState('');
  const [note, setNote] = useState('');

  // Coupon State
  const [couponInput, setCouponInput] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [couponError, setCouponError] = useState('');
  const [couponSuccess, setCouponSuccess] = useState('');
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) setSettings(await res.json());
      } catch (e) {}
    }
    loadSettings();
  }, []);

  const baseDeliveryFee = city === 'Inside Dhaka' ? settings.insideDhakaFee : settings.outsideDhakaFee;
  const deliveryFee = settings.freeDeliveryAbove > 0 && subtotal >= settings.freeDeliveryAbove ? 0 : baseDeliveryFee;
  const discountAmount = appliedCoupon ? appliedCoupon.discount : 0;
  const grandTotal = Math.max(0, subtotal + deliveryFee - discountAmount);

  const handleApplyCoupon = async () => {
    setCouponError('');
    setCouponSuccess('');
    if (!couponInput.trim()) return;

    setValidatingCoupon(true);
    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponInput.trim(), orderTotal: subtotal }),
      });
      const data = await res.json();
      if (data.valid) {
        setAppliedCoupon({ code: couponInput.trim().toUpperCase(), discount: data.discount });
        setCouponSuccess(data.message);
      } else {
        setCouponError(data.message);
      }
    } catch (e) {
      setCouponError('কুপন যাচাইয়ে ত্রুটি হয়েছে।');
    } finally {
      setValidatingCoupon(false);
    }
  };

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!customerName.trim() || !phone.trim() || !address.trim()) {
      setError('দয়া করে আপনার নাম, মোবাইল নম্বর এবং সম্পূর্ণ ঠিকানা সঠিকভাবে লিখুন।');
      return;
    }

    if (cart.length === 0) {
      setError('আপনার কার্টে কোনো প্রোডাক্ট নেই!');
      return;
    }

    setSubmitting(true);

    try {
      const orderPayload = {
        customerName: customerName.trim(),
        phone: phone.trim(),
        address: address.trim(),
        city,
        paymentMethod,
        bkashTrxId: paymentMethod === 'bKash / Nagad' ? bkashTrxId.trim() : undefined,
        note: note.trim() || undefined,
        items: cart,
        subtotal,
        discount: discountAmount > 0 ? discountAmount : undefined,
        couponCode: appliedCoupon ? appliedCoupon.code : undefined,
        deliveryFee,
        total: grandTotal,
      };

      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
      });

      if (!res.ok) {
        throw new Error('অর্ডার সম্পন্ন করা সম্ভব হয়নি। আবার চেষ্টা করুন।');
      }

      const order = await res.json();
      clearCart();
      router.push(`/order-success/${order.id}`);
    } catch (err: any) {
      setError(err.message || 'একটি ত্রুটি ঘটেছে');
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <>
        <Navbar />
        <div className="max-w-3xl mx-auto px-4 py-20 text-center">
          <h2 className="text-2xl font-bold text-slate-800">চেকআউট করার জন্য কোনো পণ্য নেই!</h2>
          <p className="text-sm text-slate-500 mt-2">দয়া করে কার্টে জুতা বা ব্যাগ যোগ করুন।</p>
          <a
            href="/"
            className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold text-sm"
          >
            শপ ব্রাউজ করুন
          </a>
        </div>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 flex-1">
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mb-8">
          অর্ডার কনফার্মেশন ও চেকআউট
        </h1>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmitOrder} className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Customer & Shipping Information (7 cols) */}
          <div className="lg:col-span-7 space-y-8">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                <MapPin className="w-5 h-5 text-orange-600" />
                <span>ডেলিভারি ঠিকানা ও তথ্য দিন</span>
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    আপনার সম্পূর্ণ নাম *
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      required
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="যেমন: তানভীর আহমেদ"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white focus:border-orange-500 font-medium font-sans"
                    />
                    <User className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    সচল মোবাইল নম্বর *
                  </label>
                  <div className="relative">
                    <input
                      type="tel"
                      required
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="যেমন: 01712345678"
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white focus:border-orange-500 font-medium font-sans"
                    />
                    <Phone className="w-4 h-4 text-slate-400 absolute right-4 top-3.5" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1">অর্ডার নিশ্চিত করতে এই নম্বরে কল করা হবে।</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    ডেলিভারি এরিয়া বেছে নিন *
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setCity('Inside Dhaka')}
                      className={`p-3.5 rounded-xl border text-left font-semibold text-sm transition-all flex items-center justify-between ${
                        city === 'Inside Dhaka'
                          ? 'border-orange-600 bg-orange-50/60 text-slate-900 ring-2 ring-orange-500/20'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="text-xs text-slate-500">ঢাকা সিটির ভেতর</div>
                        <div className="font-bold text-slate-900 mt-0.5">{formatPrice(settings.insideDhakaFee)}</div>
                      </div>
                      {city === 'Inside Dhaka' && (
                        <CheckCircle2 className="w-5 h-5 text-orange-600" />
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => setCity('Outside Dhaka')}
                      className={`p-3.5 rounded-xl border text-left font-semibold text-sm transition-all flex items-center justify-between ${
                        city === 'Outside Dhaka'
                          ? 'border-orange-600 bg-orange-50/60 text-slate-900 ring-2 ring-orange-500/20'
                          : 'border-slate-200 text-slate-600 hover:border-slate-300'
                      }`}
                    >
                      <div>
                        <div className="text-xs text-slate-500">ঢাকার বাইরে (সারা দেশ)</div>
                        <div className="font-bold text-slate-900 mt-0.5">{formatPrice(settings.outsideDhakaFee)}</div>
                      </div>
                      {city === 'Outside Dhaka' && (
                        <CheckCircle2 className="w-5 h-5 text-orange-600" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    সম্পূর্ণ ডেলিভারি ঠিকানা *
                  </label>
                  <textarea
                    required
                    rows={3}
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="বাড়ি নং, রোড নং, এলাকা, থানা, জেলা..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:bg-white focus:border-orange-500 font-medium font-sans"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2">
                    বিশেষ নির্দেশনা (ঐচ্ছিক)
                  </label>
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="যেমন: সন্ধ্যার পরে ডেলিভারি দিলে ভালো হয়"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none font-sans"
                  />
                </div>
              </div>
            </div>

            {/* Payment Method Card */}
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
              <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-4">
                <ShieldCheck className="w-5 h-5 text-orange-600" />
                <span>পেমেন্ট পদ্ধতি বেছে নিন</span>
              </h2>

              <div className="space-y-3">
                <label
                  onClick={() => setPaymentMethod('Cash on Delivery')}
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'Cash on Delivery'
                      ? 'border-orange-600 bg-orange-50/50 ring-2 ring-orange-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'Cash on Delivery'}
                    onChange={() => setPaymentMethod('Cash on Delivery')}
                    className="mt-1 text-orange-600 focus:ring-orange-500"
                  />
                  <div>
                    <div className="font-bold text-slate-900 text-sm">
                      ক্যাশ অন ডেলিভারি (Cash on Delivery)
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      পণ্য ডেলিভারি পাওয়ার পর রাইডারকে টাকা পরিশোধ করবেন। ১০০% নিরাপদ ও সুবিধাজনক!
                    </div>
                  </div>
                </label>

                <label
                  onClick={() => setPaymentMethod('bKash / Nagad')}
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-all ${
                    paymentMethod === 'bKash / Nagad'
                      ? 'border-orange-600 bg-orange-50/50 ring-2 ring-orange-500/20'
                      : 'border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="payment"
                    checked={paymentMethod === 'bKash / Nagad'}
                    onChange={() => setPaymentMethod('bKash / Nagad')}
                    className="mt-1 text-orange-600 focus:ring-orange-500"
                  />
                  <div className="flex-1">
                    <div className="font-bold text-slate-900 text-sm">
                      বিকাশ / নগদ (Send Money)
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      আমাদের অফিসিয়াল একাউন্টে টাকা পাঠিয়ে TrxID প্রদান করুন।
                    </div>

                    {paymentMethod === 'bKash / Nagad' && (
                      <div className="mt-3 p-3 bg-white rounded-xl border border-orange-200 text-xs space-y-2">
                        <p className="font-semibold text-slate-800">
                          বিকাশ নম্বর: <span className="text-orange-600 font-bold">{settings.bkashNumber}</span>
                        </p>
                        <p className="font-semibold text-slate-800">
                          নগদ নম্বর: <span className="text-orange-600 font-bold">{settings.nagadNumber}</span>
                        </p>
                        <p className="text-slate-500">টাকা পাঠিয়ে TrxID লিখুন:</p>
                        <input
                          type="text"
                          value={bkashTrxId}
                          onChange={(e) => setBkashTrxId(e.target.value)}
                          placeholder="TrxID (যেমন: BK89X23...)"
                          className="w-full bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono"
                        />
                      </div>
                    )}
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* Order Summary & Coupon (5 cols) */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6 sticky top-28">
              <h3 className="text-lg font-bold text-slate-900 flex items-center justify-between border-b border-slate-100 pb-4">
                <span>অর্ডার আইটেম ({cart.length})</span>
                <span className="text-xs text-slate-500 font-normal">রিভিউ</span>
              </h3>

              {/* Items scroll */}
              <div className="space-y-4 max-h-64 overflow-y-auto pr-1">
                {cart.map((item) => (
                  <div
                    key={`${item.productId}-${item.selectedSize}-${item.selectedColor}`}
                    className="flex items-center gap-3.5 text-sm"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="w-14 h-14 rounded-xl object-cover bg-slate-100 border border-slate-200 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <h4 className="font-bold text-slate-900 truncate text-xs sm:text-sm">{item.name}</h4>
                      <p className="text-xs text-slate-500">
                        সাইজ: {item.selectedSize} | কালার: {item.selectedColor}
                      </p>
                      <p className="text-xs font-semibold text-slate-700">
                        {formatPrice(item.price)} × {item.quantity}
                      </p>
                    </div>
                    <span className="font-extrabold text-slate-900 text-xs sm:text-sm">
                      {formatPrice(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>

              {/* Coupon Code Section */}
              <div className="pt-4 border-t border-slate-100 space-y-2">
                <label className="block text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-orange-600" />
                  <span>ডিসকাউন্ট কুপন কোড (Promo Code)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="যেমন: NEW100 বা EID10"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold uppercase focus:outline-none focus:ring-2 focus:ring-orange-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyCoupon}
                    disabled={validatingCoupon}
                    className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-all disabled:opacity-50"
                  >
                    {validatingCoupon ? 'যাচাই হচ্ছে...' : 'প্রয়োগ করুন'}
                  </button>
                </div>
                {couponSuccess && (
                  <p className="text-[11px] text-emerald-600 font-semibold flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" /> {couponSuccess}
                  </p>
                )}
                {couponError && (
                  <p className="text-[11px] text-red-600 font-semibold flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5" /> {couponError}
                  </p>
                )}
              </div>

              {/* Financial Calculation */}
              <div className="pt-4 border-t border-slate-100 space-y-2.5 text-xs sm:text-sm">
                <div className="flex justify-between text-slate-600">
                  <span>সাবটোটাল</span>
                  <span className="font-bold text-slate-900">{formatPrice(subtotal)}</span>
                </div>

                {appliedCoupon && (
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>কুপন ছাড় ({appliedCoupon.code})</span>
                    <span>-{formatPrice(appliedCoupon.discount)}</span>
                  </div>
                )}

                <div className="flex justify-between text-slate-600">
                  <span>ডেলিভারি চার্জ</span>
                  <span className="font-bold text-slate-900">
                    {deliveryFee === 0 ? <span className="text-emerald-600">ফ্রি ডেলিভারি</span> : formatPrice(deliveryFee)}
                  </span>
                </div>

                <div className="pt-3 border-t border-slate-100 flex justify-between items-baseline text-base font-black text-slate-900">
                  <span>সর্বমোট প্রদেয় বিল</span>
                  <span className="text-2xl text-orange-600 font-black">{formatPrice(grandTotal)}</span>
                </div>
              </div>

              {/* Submit CTA */}
              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 py-4 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 text-white font-extrabold text-sm sm:text-base shadow-xl shadow-orange-600/30 transition-all transform hover:-translate-y-0.5 disabled:opacity-50"
              >
                {submitting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <span>অর্ডার নিশ্চিত করুন ({formatPrice(grandTotal)})</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>

              <div className="text-center text-xs text-slate-400">
                🔒 আপনার সকল তথ্য নিরাপদ ও সুরক্ষিত রাখা হয়
              </div>
            </div>
          </div>
        </form>
      </main>

      <Footer />
    </>
  );
}

'use client';

export const runtime = 'edge';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Order } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';
import { CheckCircle, Package, Phone, MapPin, Truck, ArrowRight, ShieldCheck, CloudOff } from 'lucide-react';
import { apiFetch } from '@/lib/offline/apiFetch';

export default function OrderSuccessPage() {
  const params = useParams();
  const [order, setOrder] = useState<Order | null>(null);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadOrder() {
      try {
        // নিজের অর্ডারই শুধু দেখা যায় — publicToken দিয়ে (P1 নিরাপত্তা);
        // অফলাইনে apiFetch মিরর/লোকাল-অর্ডার থেকে ফেরত দেয়
        const token = new URLSearchParams(window.location.search).get('t') || '';
        const res = await apiFetch(`/api/orders/${params.id}?t=${encodeURIComponent(token)}`);
        if (res.ok) {
          const found: Order = await res.json();
          setOrder(found);
          // অফলাইনে করা অর্ডার (লোকাল কপি) — ইন্টারনেট এলে স্বয়ংক্রিয়ভাবে জমা হবে
          setOfflineSaved(res.headers.get('X-JX-Offline') === '1' || found.id.startsWith('ord-off-'));
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    loadOrder();
  }, [params.id]);

  return (
    <>
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 py-16 flex-1">
        <div className="bg-white rounded-3xl border border-slate-200 p-8 sm:p-12 shadow-sm text-center">
          <div className="w-20 h-20 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-6 shadow-md ring-8 ring-emerald-50/50">
            <CheckCircle className="w-10 h-10" />
          </div>

          <span className="text-xs font-bold uppercase tracking-widest text-emerald-600 bg-emerald-100/60 px-3 py-1 rounded-full">
            অর্ডার সফল হয়েছে!
          </span>

          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 mt-4">
            ধন্যবাদ, আপনার অর্ডারটি গ্রহণ করা হয়েছে!
          </h1>

          <p className="text-sm text-slate-600 mt-2 max-w-md mx-auto">
            আমাদের কাস্টমার রিলেশন প্রতিনিধি খুব শীঘ্রই <span className="font-bold text-slate-900">{order?.phone || 'আপনার নম্বরে'}</span> ফোন করে অর্ডারটি নিশ্চিত করবেন।
          </p>

          {offlineSaved && (
            <div className="mt-4 mx-auto max-w-md flex items-start gap-2 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-left">
              <CloudOff className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-800">
                <span className="font-bold">অফলাইন মোড:</span> আপনার অর্ডারটি ডিভাইসে সংরক্ষিত আছে। ইন্টারনেট সংযোগ পাওয়া মাত্র স্বয়ংক্রিয়ভাবে আমাদের কাছে জমা হয়ে যাবে।
              </p>
            </div>
          )}

          {order && (
            <div className="mt-8 text-left bg-slate-50 rounded-2xl p-6 border border-slate-200/80 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-3">
                <div>
                  <span className="text-xs text-slate-400 font-medium">অর্ডার নম্বর:</span>
                  <div className="text-base font-black text-orange-600">{order.orderNumber}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">তারিখ:</span>
                  <div className="text-xs font-bold text-slate-700">{formatDate(order.createdAt)}</div>
                </div>
                <div>
                  <span className="text-xs text-slate-400 font-medium">পেমেন্ট মেথড:</span>
                  <div className="text-xs font-bold text-slate-700">{order.paymentMethod}</div>
                </div>
              </div>

              {/* Items */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-bold uppercase text-slate-500">অর্ডার করা পণ্য:</span>
                {order.items.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between gap-3 text-sm">
                    <div className="flex items-center gap-3">
                      <img src={item.image} alt="" className="w-12 h-12 rounded-lg object-cover bg-white border" />
                      <div>
                        <div className="font-bold text-slate-900">{item.name}</div>
                        <div className="text-xs text-slate-500">সাইজ: {item.selectedSize} | কালার: {item.selectedColor}</div>
                      </div>
                    </div>
                    <div className="font-bold text-slate-800">
                      {item.quantity} × {formatPrice(item.price)}
                    </div>
                  </div>
                ))}
              </div>

              {/* Total Summary */}
              <div className="border-t border-slate-200 pt-3 space-y-1.5 text-xs text-slate-600">
                <div className="flex justify-between">
                  <span>সাবটোটাল</span>
                  <span className="font-bold text-slate-800">{formatPrice(order.subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>ডেলিভারি চার্জ</span>
                  <span className="font-bold text-slate-800">{formatPrice(order.deliveryFee)}</span>
                </div>
                <div className="flex justify-between text-base font-black text-slate-900 pt-1 border-t border-slate-200">
                  <span>সর্বমোট প্রদেয় বিল</span>
                  <span className="text-orange-600">{formatPrice(order.total)}</span>
                </div>
              </div>

              {/* Address */}
              <div className="border-t border-slate-200 pt-3 text-xs text-slate-600 flex items-start gap-2">
                <MapPin className="w-4 h-4 text-orange-600 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-slate-800">ডেলিভারি ঠিকানা: </span>
                  {order.address} ({order.city})
                </div>
              </div>
            </div>
          )}

          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="/shop"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold text-sm shadow-md transition-all"
            >
              আরো শপিং করুন
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}

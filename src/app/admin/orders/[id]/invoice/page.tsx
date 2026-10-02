'use client';

export const runtime = 'edge';

import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { Order } from '@/types';
import { formatPrice } from '@/lib/utils';
import { Printer, MapPin, Phone, Globe, AlertCircle, Sparkles } from 'lucide-react';

/* ── helpers ── */
function formatDateBn(dateStr: string) {
  const d = new Date(dateStr);
  return d.toLocaleDateString('bn-BD', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function statusBn(status: string) {
  const map: Record<string, string> = {
    Pending: 'অপেক্ষারত',
    Processing: 'প্রসেসিং',
    Shipped: 'কুরিয়ারে দেওয়া হয়েছে',
    Delivered: 'পৌঁছেছে',
    Cancelled: 'বাতিল',
  };
  return map[status] || status;
}

/* ─────────────────────────────────────── */

export default function InvoicePage() {
  const params = useParams();
  const id = params.id;
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch('/api/orders');
        if (!res.ok) throw new Error();
        const orders: Order[] = await res.json();
        const found = orders.find((o) => o.id === id || o.orderNumber === id);
        if (found) setOrder(found);
        else setNotFound(true);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id]);

  /* ── print trigger ── */
  const handlePrint = () => window.print();

  /* ── loading / error ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-slate-400 text-sm">ইনভয়েস লোড হচ্ছে…</div>
      </div>
    );
  }
  if (notFound || !order) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 gap-4">
        <AlertCircle className="w-14 h-14 text-slate-400" />
        <div className="text-slate-600 font-bold">অর্ডার পাওয়া যায়নি</div>
        <a
          href="/admin/orders"
          className="px-4 py-2 rounded-md bg-orange-600 text-white text-sm font-bold"
        >
          ← অর্ডার তালিকায় ফিরুন
        </a>
      </div>
    );
  }

  const hasDiscount = order.discount && order.discount > 0;

  return (
    <>
      {/* ══ Print / Screen styles ══ */}
      <style>{`
        @media print {
          body { margin: 0; padding: 0; background: white; }
          .no-print { display: none !important; }
          .invoice-page { box-: none !important; border: none !important; margin: 0 !important; border-radius: 0 !important; max-width: 100% !important; }
          @page { size: A4; margin: 12mm 14mm; }
        }
      `}</style>

      {/* ══ Screen toolbar (hidden on print) ══ */}
      <div className="no-print bg-slate-800 text-white px-6 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <a
            href="/admin/orders"
            className="text-slate-300 hover:text-white text-xs font-bold transition-colors"
          >
            ← অর্ডার তালিকা
          </a>
          <span className="text-slate-600">|</span>
          <span className="text-xs font-bold text-orange-400">
            {order.orderNumber}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">
            প্রিন্ট করুন অথবা PDF হিসেবে সেভ করুন
          </span>
          <button
            onClick={handlePrint}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
            </svg>
            প্রিন্ট / PDF সেভ
          </button>
        </div>
      </div>

      {/* ══ Invoice body ══ */}
      <div className="bg-slate-100 min-h-screen py-8 px-4 no-print-bg">
        <div
          className="invoice-page bg-white max-w-2xl mx-auto border border-slate-200 rounded-md overflow-hidden"
          style={{ fontFamily: 'system-ui, sans-serif' }}
        >

          {/* ── Header band ── */}
          <div className="bg-orange-600 px-8 py-6 text-white">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <div className="w-10 h-10 rounded-md bg-white/20 flex items-center justify-center font-bold text-lg text-white border border-white/30">
                    JX
                  </div>
                  <div>
                    <div className="font-bold text-xl tracking-tight">Shopkeeper</div>
                    <div className="text-orange-100 text-xs">প্রিমিয়াম কোয়ালিটি ফুটওয়্যার ও ব্যাগ</div>
                  </div>
                </div>
                <div className="mt-3 text-[11px] text-orange-100 space-y-1">
                  <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-orange-200 flex-shrink-0" /> <span>ঢাকা, বাংলাদেশ</span></div>
                  <div className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-orange-200 flex-shrink-0" /> <span>01XXXXXXXXX</span></div>
                  <div className="flex items-center gap-1.5"><Globe className="w-3.5 h-3.5 text-orange-200 flex-shrink-0" /> <span>shopkeeperbd.pages.dev</span></div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-xs text-orange-200 uppercase tracking-wider font-bold mb-1">বিক্রয় চালান</div>
                <div className="font-bold text-2xl font-mono">{order.orderNumber}</div>
                <div className="text-orange-100 text-xs mt-2">তারিখ: {formatDateBn(order.createdAt)}</div>
                <div className="mt-3">
                  <span
                    className={`px-3 py-1 rounded-md text-xs font-bold ${
                      order.status === 'Delivered'
                        ? 'bg-emerald-500 text-white'
                        : order.status === 'Cancelled'
                        ? 'bg-red-500 text-white'
                        : order.status === 'Shipped'
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/25 text-white'
                    }`}
                  >
                    {statusBn(order.status)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Customer info ── */}
          <div className="px-8 py-5 bg-slate-50 border-b border-slate-100">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">প্রাপক / Recipient</div>
                <div className="font-bold text-slate-900 text-base">{order.customerName}</div>
                <div className="text-slate-500 text-xs mt-1.5 space-y-1">
                  <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-slate-400 flex-shrink-0" /> <span>{order.phone}</span></div>
                  <div className="flex items-start gap-1.5"><MapPin className="w-3 h-3 text-slate-400 flex-shrink-0 mt-0.5" /> <span>{order.address}</span></div>
                  <div className="font-semibold text-slate-700 pl-4">{order.city}</div>
                </div>
              </div>

              <div className="text-right">
                <div className="text-[10px] uppercase tracking-widest text-slate-400 font-bold mb-2">পেমেন্ট তথ্য</div>
                <div className="font-bold text-slate-800 text-sm">{order.paymentMethod}</div>
                {order.bkashTrxId && (
                  <div className="text-xs text-slate-500 mt-1">
                    TrxID: <span className="font-mono font-bold text-orange-600">{order.bkashTrxId}</span>
                  </div>
                )}
                {order.couponCode && (
                  <div className="text-xs text-emerald-600 mt-1 font-bold">
                    কুপন: {order.couponCode}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Items table ── */}
          <div className="px-8 py-5">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-slate-200">
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold w-6">#</th>
                  <th className="text-left py-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold">পণ্যের বিবরণ</th>
                  <th className="text-center py-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold">পরিমাণ</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold">একক মূল্য</th>
                  <th className="text-right py-2 text-[10px] uppercase tracking-wider text-slate-400 font-bold">মোট</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50">
                    <td className="py-3 text-slate-400">{idx + 1}</td>
                    <td className="py-3">
                      <div className="font-bold text-slate-900">{item.name}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        সাইজ: {item.selectedSize} &nbsp;|&nbsp; কালার: {item.selectedColor}
                      </div>
                    </td>
                    <td className="py-3 text-center font-bold text-slate-700">{item.quantity}</td>
                    <td className="py-3 text-right text-slate-700">{formatPrice(item.price)}</td>
                    <td className="py-3 text-right font-bold text-slate-900">
                      {formatPrice(item.price * item.quantity)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ── Totals ── */}
          <div className="px-8 pb-6">
            <div className="ml-auto w-64 space-y-2 text-xs">
              <div className="flex justify-between text-slate-600">
                <span>সাবটোটাল</span>
                <span className="font-semibold">{formatPrice(order.subtotal)}</span>
              </div>

              <div className="flex justify-between text-slate-600">
                <span>ডেলিভারি চার্জ ({order.city})</span>
                <span className="font-semibold">{formatPrice(order.deliveryFee)}</span>
              </div>

              {hasDiscount && (
                <div className="flex justify-between text-emerald-600">
                  <span>ছাড় {order.couponCode ? `(${order.couponCode})` : ''}</span>
                  <span className="font-semibold">−{formatPrice(order.discount!)}</span>
                </div>
              )}

              <div className="flex justify-between items-center pt-3 border-t-2 border-slate-200">
                <span className="font-bold text-slate-900 text-sm">সর্বমোট পরিশোধযোগ্য</span>
                <span className="font-bold text-orange-600 text-lg">{formatPrice(order.total)}</span>
              </div>
            </div>
          </div>

          {/* ── Notes ── */}
          {(order.note || order.adminNote) && (
            <div className="px-8 pb-5 space-y-2">
              {order.note && (
                <div className="bg-amber-50 border border-amber-200 rounded-md px-4 py-3 text-xs text-amber-800">
                  <span className="font-bold">কাস্টমার নোট: </span>{order.note}
                </div>
              )}
              {order.adminNote && (
                <div className="bg-blue-50 border border-blue-200 rounded-md px-4 py-3 text-xs text-blue-800">
                  <span className="font-bold">অ্যাডমিন নোট: </span>{order.adminNote}
                </div>
              )}
            </div>
          )}

          {/* ── Footer ── */}
          <div className="bg-slate-900 px-8 py-5 text-center">
            <div className="text-orange-400 font-bold text-sm mb-1 flex items-center justify-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>ধন্যবাদ আপনার কেনাকাটার জন্য!</span>
            </div>
            <div className="text-slate-400 text-[11px]">
              পণ্য পেয়ে সমস্যা হলে ৪৮ ঘণ্টার মধ্যে যোগাযোগ করুন। হটলাইন: 01XXXXXXXXX
            </div>
            <div className="text-slate-600 text-[10px] mt-3 font-mono">
              Invoice ID: {order.orderNumber} &nbsp;·&nbsp; Generated: {new Date().toLocaleString('bn-BD')}
            </div>
          </div>

        </div>

        {/* Bottom action bar (screen only) */}
        <div className="no-print max-w-2xl mx-auto mt-4 flex justify-center gap-3">
          <a
            href="/admin/orders"
            className="px-6 py-2.5 rounded-md border border-slate-300 bg-white text-slate-700 text-xs font-bold hover:bg-slate-50 transition-colors"
          >
            ← তালিকায় ফিরুন
          </a>
          <button
            onClick={handlePrint}
            className="px-8 py-2.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-colors flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            <span>প্রিন্ট / PDF সেভ করুন</span>
          </button>
        </div>
      </div>
    </>
  );
}

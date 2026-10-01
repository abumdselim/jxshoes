'use client';

import React, { useState, useEffect } from 'react';
import { Order } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';
import {
  ShoppingBag,
  Phone,
  MapPin,
  Clock,
  Printer,
  X,
  Search,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Invoice Modal State
  const [selectedInvoice, setSelectedInvoice] = useState<Order | null>(null);

  const loadOrders = async () => {
    try {
      const res = await fetch('/api/orders');
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    try {
      const res = await fetch(`/api/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))
        );
      }
    } catch (e) {
      console.error(e);
    }
  };

  const filteredOrders = orders.filter((o) => {
    const matchesStatus = statusFilter === 'all' || o.status === statusFilter;
    const matchesSearch =
      !searchQuery ||
      o.orderNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.phone.includes(searchQuery) ||
      o.address.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            অর্ডার ম্যানেজমেন্ট
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            কাস্টমারদের অর্ডার প্রসেস করুন, কুরিয়ার স্ট্যাটাস আপডেট করুন এবং ইনভয়েস প্রিন্ট করুন।
          </p>
        </div>

        <div className="text-xs font-semibold px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm text-slate-600">
          মোট অর্ডার: <strong className="text-orange-600 font-black">{orders.length}</strong> টি
        </div>
      </div>

      {/* Filter Tabs & Search */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-1 md:pb-0">
          {['all', 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled'].map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                statusFilter === st
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {st === 'all' ? 'সকল অর্ডার' : st}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="অর্ডার নং, নাম বা ফোন দিয়ে খুঁজুন..."
            className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-10 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500/20 font-medium"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5" />
        </div>
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-3xl border border-slate-200 p-12 text-center text-slate-500">
            <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-base font-bold text-slate-800">কোনো অর্ডার পাওয়া যায়নি</p>
            <p className="text-xs text-slate-400 mt-1">ফিল্টার পরিবর্তন করে দেখুন।</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className="bg-white rounded-3xl border border-slate-200/80 shadow-sm p-6 hover:border-orange-500/40 transition-all space-y-4"
            >
              {/* Order Header */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
                <div className="flex items-center gap-3">
                  <span className="font-mono font-black text-base text-orange-600 bg-orange-50 px-3 py-1 rounded-xl">
                    {order.orderNumber}
                  </span>
                  <div className="text-xs text-slate-400">
                    তারিখ: <strong className="text-slate-700">{formatDate(order.createdAt)}</strong>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setSelectedInvoice(order)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-bold text-slate-700 shadow-sm"
                  >
                    <Printer className="w-3.5 h-3.5 text-orange-600" />
                    <span>চালান / ইনভয়েস</span>
                  </button>

                  {/* Status Dropdown */}
                  <select
                    value={order.status}
                    onChange={(e) => handleStatusChange(order.id, e.target.value as any)}
                    className={`text-xs font-bold rounded-xl px-3 py-1.5 border focus:outline-none transition-colors ${
                      order.status === 'Pending'
                        ? 'bg-amber-50 text-amber-800 border-amber-300'
                        : order.status === 'Processing'
                        ? 'bg-blue-50 text-blue-800 border-blue-300'
                        : order.status === 'Shipped'
                        ? 'bg-purple-50 text-purple-800 border-purple-300'
                        : order.status === 'Delivered'
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-red-50 text-red-800 border-red-300'
                    }`}
                  >
                    <option value="Pending">Pending (অপেক্ষারত)</option>
                    <option value="Processing">Processing (প্যাকিং হচ্ছে)</option>
                    <option value="Shipped">Shipped (কুরিয়ারে দেওয়া হয়েছে)</option>
                    <option value="Delivered">Delivered (পৌঁছেছে)</option>
                    <option value="Cancelled">Cancelled (বাতিল)</option>
                  </select>
                </div>
              </div>

              {/* Order Body: Customer & Items */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Customer Details */}
                <div className="space-y-2 text-xs">
                  <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                    কাস্টমার তথ্য
                  </span>
                  <div className="font-bold text-sm text-slate-900">{order.customerName}</div>
                  <div className="flex items-center gap-1.5 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-orange-600" />
                    <a href={`tel:${order.phone}`} className="font-semibold hover:underline">
                      {order.phone}
                    </a>
                  </div>
                  <div className="flex items-start gap-1.5 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <span>{order.address} ({order.city})</span>
                  </div>
                  {order.note && (
                    <div className="p-2 bg-slate-50 rounded-lg text-slate-500 italic mt-2">
                      নোট: &ldquo;{order.note}&rdquo;
                    </div>
                  )}
                </div>

                {/* Items Breakdown */}
                <div className="space-y-2 md:col-span-2">
                  <span className="font-bold uppercase tracking-wider text-slate-400 text-[10px]">
                    অর্ডার আইটেম ও স্পেসিফিকেশন
                  </span>
                  <div className="space-y-2">
                    {order.items.map((it, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs"
                      >
                        <div className="flex items-center gap-3">
                          <img
                            src={it.image}
                            alt=""
                            className="w-10 h-10 rounded-lg object-cover bg-white border"
                          />
                          <div>
                            <div className="font-bold text-slate-900">{it.name}</div>
                            <div className="text-slate-500 flex items-center gap-2 mt-0.5">
                              <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold text-orange-600">
                                সাইজ: {it.selectedSize}
                              </span>
                              <span className="bg-white px-1.5 py-0.5 rounded border border-slate-200">
                                কালার: {it.selectedColor}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="font-extrabold text-slate-900 text-right">
                          <div>{it.quantity} × {formatPrice(it.price)}</div>
                          <div className="text-slate-500 font-medium">{formatPrice(it.price * it.quantity)}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Payment & Totals */}
                  <div className="flex flex-wrap items-center justify-between pt-2 text-xs border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-500">পদ্ধতি:</span>
                      <span className="font-bold text-slate-800 bg-slate-100 px-2.5 py-0.5 rounded">
                        {order.paymentMethod}
                      </span>
                      {order.bkashTrxId && (
                        <span className="font-mono bg-orange-50 text-orange-700 px-2 py-0.5 rounded font-bold">
                          TrxID: {order.bkashTrxId}
                        </span>
                      )}
                    </div>

                    <div className="flex items-baseline gap-4 font-semibold">
                      <span className="text-slate-500">ডেলিভারি: {formatPrice(order.deliveryFee)}</span>
                      <span className="text-sm font-black text-slate-900">
                        মোট প্রদেয়: <span className="text-orange-600">{formatPrice(order.total)}</span>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-8 shadow-2xl border border-slate-200 space-y-6">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-orange-600 text-white font-black flex items-center justify-center">
                  JX
                </div>
                <span className="font-black text-xl text-slate-900">JxShoes Invoice</span>
              </div>
              <button
                onClick={() => setSelectedInvoice(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-600">
              <div className="flex justify-between">
                <div>
                  <div className="font-bold text-slate-900 text-sm">ইনভয়েস নং: {selectedInvoice.orderNumber}</div>
                  <div>তারিখ: {formatDate(selectedInvoice.createdAt)}</div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-slate-900">ডেলিভারি এরিয়া: {selectedInvoice.city}</div>
                  <div>পেমেন্ট: {selectedInvoice.paymentMethod}</div>
                </div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl space-y-1">
                <div className="font-bold text-slate-900">প্রাপক: {selectedInvoice.customerName}</div>
                <div>ফোন: {selectedInvoice.phone}</div>
                <div>ঠিকানা: {selectedInvoice.address}</div>
              </div>

              <div className="divide-y border-t border-b py-2 space-y-2">
                {selectedInvoice.items.map((it, idx) => (
                  <div key={idx} className="flex justify-between items-center pt-2">
                    <div>
                      <div className="font-bold text-slate-900">{it.name}</div>
                      <div className="text-[11px] text-slate-400">সাইজ: {it.selectedSize} | কালার: {it.selectedColor}</div>
                    </div>
                    <div className="font-bold text-slate-900">
                      {it.quantity} × {formatPrice(it.price)} = {formatPrice(it.price * it.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1.5 text-right font-medium">
                <div>সাবটোটাল: {formatPrice(selectedInvoice.subtotal)}</div>
                <div>ডেলিভারি চার্জ: {formatPrice(selectedInvoice.deliveryFee)}</div>
                <div className="text-base font-black text-slate-900 pt-2 border-t">
                  সর্বমোট: {formatPrice(selectedInvoice.total)}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t">
              <button
                onClick={() => setSelectedInvoice(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700"
              >
                বন্ধ করুন
              </button>
              <button
                onClick={() => window.print()}
                className="px-5 py-2 rounded-xl bg-orange-600 text-white text-xs font-bold shadow-md flex items-center gap-2"
              >
                <Printer className="w-4 h-4" />
                <span>প্রিন্ট চালান</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

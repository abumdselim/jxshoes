'use client';

import React, { useEffect, useState } from 'react';
import { Product, Order } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';
import {
  TrendingUp,
  Package,
  ShoppingBag,
  Clock,
  ArrowRight,
  Plus,
  AlertTriangle,
  CheckCircle,
  Truck,
  Footprints
} from 'lucide-react';

export default function AdminDashboardPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const [prodRes, ordRes] = await Promise.all([
          fetch('/api/products'),
          fetch('/api/orders'),
        ]);
        if (prodRes.ok) setProducts(await prodRes.json());
        if (ordRes.ok) setOrders(await ordRes.json());
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const totalSales = orders.reduce((sum, ord) => sum + ord.total, 0);
  const pendingOrders = orders.filter((o) => o.status === 'Pending' || o.status === 'Processing');
  const lowStockProducts = products.filter((p) => p.stockCount <= 16);

  const shoeCount = products.filter((p) => p.category === 'shoes').length;
  const bagCount = products.filter((p) => p.category === 'bags').length;

  const handleQuickStatusChange = async (orderId: string, newStatus: Order['status']) => {
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

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            অ্যাডমিন ওভারভিউ ড্যাশবোর্ড
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            JxShoes & Bags শপের লাইভ সেলস ও ক্যাটালগ পরিসংখ্যান।
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <a
            href="/admin/products"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold shadow-md transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>নতুন প্রোডাক্ট আপলোড</span>
          </a>
          <a
            href="/admin/orders"
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 text-xs font-bold transition-all shadow-sm"
          >
            <ShoppingBag className="w-4 h-4 text-orange-600" />
            <span>সকল অর্ডার</span>
          </a>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">মোট বিক্রয় (Revenue)</span>
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900">{formatPrice(totalSales)}</div>
            <span className="text-[10px] text-emerald-600 font-semibold mt-0.5 inline-block">লাইভ অর্ডার থেকে</span>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">মোট অর্ডার</span>
            <div className="w-9 h-9 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
              <ShoppingBag className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900">{orders.length} টি</div>
            <span className="text-[10px] text-orange-600 font-semibold mt-0.5 inline-block">কাস্টমার প্লেসড</span>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">পেন্ডিং ডেলিভারি</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-amber-600">{pendingOrders.length} টি</div>
            <span className="text-[10px] text-amber-700 font-semibold mt-0.5 inline-block">শিপিং প্রয়োজন</span>
          </div>
        </div>

        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">মোট পণ্য (Catalog)</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xl sm:text-2xl font-black text-slate-900">{products.length} টি</div>
            <span className="text-[10px] text-blue-600 font-semibold mt-0.5 inline-block">
              {shoeCount} জুতা, {bagCount} ব্যাগ
            </span>
          </div>
        </div>
      </div>

      {/* Low Stock Alert and Category Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Category Split */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <h3 className="font-bold text-sm text-slate-900">ক্যাটাগরি ভিত্তিক স্টক অনুপাত</h3>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="inline-flex items-center gap-1.5"><Footprints className="w-3.5 h-3.5 text-orange-600" /> জুতা (Shoes)</span>
                <span>{shoeCount} মডেল ({Math.round((shoeCount / products.length) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-orange-600 h-2.5 rounded-full"
                  style={{ width: `${(shoeCount / products.length) * 100}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between text-xs font-semibold mb-1">
                <span className="inline-flex items-center gap-1.5"><ShoppingBag className="w-3.5 h-3.5 text-amber-500" /> ব্যাগ (Bags)</span>
                <span>{bagCount} মডেল ({Math.round((bagCount / products.length) * 100)}%)</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className="bg-amber-500 h-2.5 rounded-full"
                  style={{ width: `${(bagCount / products.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
          <p className="text-[11px] text-slate-400 pt-2 border-t">
            উভয় ক্যাটাগরির পণ্য সরাসরি কাস্টমাররা সাইজ ও কালার সিলেক্ট করে অর্ডার করতে পারছেন।
          </p>
        </div>

        {/* Low Stock Watch */}
        <div className="lg:col-span-2 bg-white p-6 rounded-3xl border border-slate-200/80 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>লো-স্টক সতর্কতা (Low Stock Alert)</span>
            </h3>
            <span className="text-[11px] text-slate-400">স্টক কম থাকা প্রোডাক্ট</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {lowStockProducts.slice(0, 4).map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-50 border border-slate-100 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <img src={p.images[0]} alt="" className="w-10 h-10 rounded-lg object-cover bg-white border" />
                  <div>
                    <h5 className="font-bold text-slate-900 truncate max-w-[130px]">{p.name}</h5>
                    <span className="text-orange-600 font-semibold">{formatPrice(p.price)}</span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold text-[10px]">
                    বাকি: {p.stockCount} টি
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Orders Overview */}
      <div className="bg-white rounded-3xl border border-slate-200/80 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-slate-900">সাম্প্রতিক কাস্টমার অর্ডারসমূহ</h2>
            <p className="text-xs text-slate-500 mt-0.5">অর্ডার স্ট্যাটাস ড্রপডাউন থেকে সরাসরি পরিবর্তন করুন।</p>
          </div>
          <a
            href="/admin/orders"
            className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center gap-1"
          >
            <span>সব দেখুন</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">অর্ডার নং</th>
                <th className="py-3.5 px-6">কাস্টমার</th>
                <th className="py-3.5 px-6">আইটেম ও সাইজ</th>
                <th className="py-3.5 px-6">মোট বিল</th>
                <th className="py-3.5 px-6">পেমেন্ট</th>
                <th className="py-3.5 px-6">স্ট্যাটাস</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {orders.slice(0, 5).map((order) => (
                <tr key={order.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6 font-mono font-bold text-slate-900">
                    {order.orderNumber}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">{order.customerName}</div>
                    <div className="text-xs text-slate-500">{order.phone}</div>
                  </td>
                  <td className="py-4 px-6">
                    <div className="space-y-1">
                      {order.items.map((it, idx) => (
                        <div key={idx} className="text-xs font-medium text-slate-700">
                          {it.name} <span className="text-orange-600">({it.selectedSize})</span> × {it.quantity}
                        </div>
                      ))}
                    </div>
                  </td>
                  <td className="py-4 px-6 font-black text-slate-900">
                    {formatPrice(order.total)}
                  </td>
                  <td className="py-4 px-6">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
                      {order.paymentMethod}
                    </span>
                  </td>
                  <td className="py-4 px-6">
                    <select
                      value={order.status}
                      onChange={(e) => handleQuickStatusChange(order.id, e.target.value as any)}
                      className={`text-xs font-bold rounded-lg px-2.5 py-1.5 border focus:outline-none transition-colors ${
                        order.status === 'Pending'
                          ? 'bg-amber-50 text-amber-800 border-amber-200'
                          : order.status === 'Processing'
                          ? 'bg-blue-50 text-blue-800 border-blue-200'
                          : order.status === 'Shipped'
                          ? 'bg-purple-50 text-purple-800 border-purple-200'
                          : order.status === 'Delivered'
                          ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                          : 'bg-red-50 text-red-800 border-red-200'
                      }`}
                    >
                      <option value="Pending">Pending (অপেক্ষারত)</option>
                      <option value="Processing">Processing (প্যাকিং)</option>
                      <option value="Shipped">Shipped (কুরিয়ারে)</option>
                      <option value="Delivered">Delivered (পৌঁছেছে)</option>
                      <option value="Cancelled">Cancelled (বাতিল)</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

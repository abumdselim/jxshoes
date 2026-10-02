'use client';

/**
 * কাস্টমার ডেটাবেজ ও বাকির খাতা (Due Ledger)
 * --------------------------------------------
 * - প্রতিটা কাস্টমারের বাকি, মোট কেনাকাটা, অর্ডার সংখ্যা এক নজরে
 * - "টাকা জমা" দিয়ে বাকি আদায় (ক্যাশ/bKash/Nagad) — খাতা অটো আপডেট
 * - "খাতা দেখুন" — কাস্টমারের সব অর্ডার + পরিশোধের পূর্ণ হিস্ট্রি
 * - পুরনো দোকানের বাকি খাতা মাইগ্রেট করার সুবিধাও আছে (প্রাথমিক বাকি দিয়ে)
 */

import React, { useEffect, useState } from 'react';
import { Customer, DuePayment, Order } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';
import {
  Users,
  Search,
  Plus,
  HandCoins,
  BookOpen,
  Phone,
  AlertTriangle,
  CheckCircle,
  Trash2,
  X,
  TrendingUp,
  Wallet,
} from 'lucide-react';

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [payments, setPayments] = useState<DuePayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackError, setFeedbackError] = useState(false);

  // টাকা জমা মোডাল
  const [payTarget, setPayTarget] = useState<Customer | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<DuePayment['method']>('Cash');
  const [payNote, setPayNote] = useState('');
  const [paySubmitting, setPaySubmitting] = useState(false);

  // খাতা মোডাল
  const [ledgerTarget, setLedgerTarget] = useState<Customer | null>(null);
  const [ledgerOrders, setLedgerOrders] = useState<Order[]>([]);
  const [ledgerPayments, setLedgerPayments] = useState<DuePayment[]>([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // নতুন কাস্টমার মোডাল
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', phone: '', address: '', note: '', dueAmount: '' });
  const [addSubmitting, setAddSubmitting] = useState(false);

  const showFeedback = (text: string, error = false) => {
    setFeedback(text);
    setFeedbackError(error);
    setTimeout(() => setFeedback(null), 4000);
  };

  const loadCustomers = async () => {
    try {
      const res = await fetch('/api/customers');
      if (res.ok) {
        const data = await res.json();
        setCustomers(data.customers || []);
        setPayments(data.payments || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  const totalDues = customers.reduce((s, c) => s + (c.dueAmount || 0), 0);
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const todayCollected = payments
    .filter(p => new Date(p.createdAt).getTime() >= todayStart)
    .reduce((s, p) => s + p.amount, 0);
  const dueCustomers = customers.filter(c => (c.dueAmount || 0) > 0);

  const filtered = customers.filter(c =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.phone.includes(search)
  );

  const openPayModal = (c: Customer) => {
    setPayTarget(c);
    setPayAmount(String(c.dueAmount || ''));
    setPayMethod('Cash');
    setPayNote('');
  };

  const submitPayment = async () => {
    if (!payTarget || !payAmount || Number(payAmount) <= 0 || paySubmitting) return;
    setPaySubmitting(true);
    try {
      const res = await fetch('/api/customers/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: payTarget.id,
          amount: Number(payAmount),
          method: payMethod,
          note: payNote || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        showFeedback(`✅ ${formatPrice(Number(payAmount))} আদায় হয়েছে — ${payTarget.name} এর বাকি এখন ${formatPrice(data.customer.dueAmount)}`);
        setPayTarget(null);
        loadCustomers();
      } else {
        showFeedback(`❌ ${data?.error || 'আদায় সংরক্ষণ করা যায়নি'}`, true);
      }
    } catch {
      showFeedback('❌ সার্ভারে সংযোগ করা যায়নি', true);
    } finally {
      setPaySubmitting(false);
    }
  };

  const openLedger = async (c: Customer) => {
    setLedgerTarget(c);
    setLedgerLoading(true);
    try {
      const res = await fetch(`/api/customers/${c.id}`);
      if (res.ok) {
        const data = await res.json();
        setLedgerOrders(data.orders || []);
        setLedgerPayments(data.payments || []);
      }
    } finally {
      setLedgerLoading(false);
    }
  };

  const submitAddCustomer = async () => {
    if (!addForm.name.trim() || !addForm.phone.trim() || addSubmitting) return;
    setAddSubmitting(true);
    try {
      const res = await fetch('/api/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addForm.name,
          phone: addForm.phone,
          address: addForm.address || undefined,
          note: addForm.note || undefined,
          dueAmount: Number(addForm.dueAmount) || 0,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        showFeedback(`✅ ${addForm.name} কাস্টমার তালিকায় যোগ হয়েছে`);
        setAddOpen(false);
        setAddForm({ name: '', phone: '', address: '', note: '', dueAmount: '' });
        loadCustomers();
      } else {
        showFeedback(`❌ ${data?.error || 'যোগ করা যায়নি'}`, true);
      }
    } catch {
      showFeedback('❌ সার্ভারে সংযোগ করা যায়নি', true);
    } finally {
      setAddSubmitting(false);
    }
  };

  const removeCustomer = async (c: Customer) => {
    if (!confirm(`"${c.name}" কে কাস্টমার তালিকা থেকে মুছে ফেলবেন?`)) return;
    const res = await fetch(`/api/customers?id=${c.id}`, { method: 'DELETE' });
    if (res.ok) {
      showFeedback('কাস্টমার মুছে ফেলা হয়েছে');
      loadCustomers();
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
    <div className="space-y-6 max-w-7xl mx-auto pb-20">
      {/* হেডার — স্টিকি টুলবার */}
      <div className="sticky top-14 md:top-0 z-20 bg-slate-100/85 backdrop-blur-md rounded-md border border-slate-200/80 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            কাস্টমার ও বাকির খাতা
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            প্রতিটা কাস্টমারের কেনাকাটা, বাকি ও পরিশোধের পূর্ণ হিসাব — দোকানের নিজস্ব লেজার।
          </p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all"
        >
          <Plus className="w-4 h-4" />
          নতুন কাস্টমার / পুরনো বাকি মাইগ্রেট
        </button>
      </div>

      {feedback && (
        <div
          className={`p-4 rounded-md text-xs sm:text-sm font-bold border ${
            feedbackError
              ? 'bg-red-50 border-red-200 text-red-700'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {feedback}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-md border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">মোট বাকি (Receivable)</span>
            <div className="w-9 h-9 rounded-md bg-red-50 text-red-600 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xl sm:text-2xl font-bold text-red-600">{formatPrice(totalDues)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">{dueCustomers.length} জনের উপরে বাকি আছে</span>
        </div>
        <div className="bg-white p-5 rounded-md border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">আজকের আদায়</span>
            <div className="w-9 h-9 rounded-md bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <HandCoins className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xl sm:text-2xl font-bold text-emerald-600">{formatPrice(todayCollected)}</div>
          <span className="text-[10px] text-slate-500 font-semibold">আজ যত টাকা ফেরত পেয়েছেন</span>
        </div>
        <div className="bg-white p-5 rounded-md border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">মোট কালেকশন</span>
            <div className="w-9 h-9 rounded-md bg-blue-50 text-blue-600 flex items-center justify-center">
              <Wallet className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xl sm:text-2xl font-bold text-slate-900">
            {formatPrice(payments.reduce((s, p) => s + p.amount, 0))}
          </div>
          <span className="text-[10px] text-slate-500 font-semibold">{payments.length}টি লেনদেন</span>
        </div>
        <div className="bg-white p-5 rounded-md border border-slate-200/80">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">মোট কাস্টমার</span>
            <div className="w-9 h-9 rounded-md bg-orange-50 text-orange-600 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3 text-xl sm:text-2xl font-bold text-slate-900">{customers.length} জন</div>
          <span className="text-[10px] text-slate-500 font-semibold">ফোন নম্বর দিয়ে অটো-ম্যাচ হয়</span>
        </div>
      </div>

      {/* সার্চ */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="নাম বা ফোন নম্বর দিয়ে খুঁজুন…"
          className="w-full bg-white border border-slate-200 rounded-md pl-11 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
        />
      </div>

      {/* কাস্টমার তালিকা */}
      <div className="bg-white rounded-md border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">কাস্টমার</th>
                <th className="py-3.5 px-6">মোট কেনাকাটা</th>
                <th className="py-3.5 px-6">অর্ডার</th>
                <th className="py-3.5 px-6">বাকি</th>
                <th className="py-3.5 px-6 text-right">অ্যাকশন</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <tr key={c.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500 flex items-center gap-1.5">
                      <Phone className="w-3 h-3" /> {c.phone}
                    </div>
                    {c.note && <div className="text-[11px] text-slate-400 mt-0.5 italic truncate max-w-xs">{c.note}</div>}
                  </td>
                  <td className="py-4 px-6">
                    <div className="font-bold text-slate-900">{formatPrice(c.totalPurchases || 0)}</div>
                  </td>
                  <td className="py-4 px-6 text-xs font-bold text-slate-700">{c.orderCount || 0} টি</td>
                  <td className="py-4 px-6">
                    {(c.dueAmount || 0) > 0 ? (
                      <span className="px-2.5 py-1 rounded-md bg-red-100 text-red-700 font-bold text-xs border border-red-200">
                        {formatPrice(c.dueAmount)}
                      </span>
                    ) : (
                      <span className="px-2.5 py-1 rounded-md bg-emerald-50 text-emerald-700 font-bold text-xs border border-emerald-200">
                        পরিশোধিত
                      </span>
                    )}
                  </td>
                  <td className="py-4 px-6">
                    <div className="flex items-center justify-end gap-2">
                      {(c.dueAmount || 0) > 0 && (
                        <button
                          onClick={() => openPayModal(c)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold transition-colors"
                        >
                          <HandCoins className="w-3.5 h-3.5" />
                          টাকা জমা
                        </button>
                      )}
                      <button
                        onClick={() => openLedger(c)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-[11px] font-bold transition-colors"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                        খাতা
                      </button>
                      <button
                        onClick={() => removeCustomer(c)}
                        className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        aria-label="মুছুন"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                    কোনো কাস্টমার পাওয়া যায়নি। প্রথম সেলে ফোন নম্বর দিলেই অটোমেটিক খাতা খুলে যাবে।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* টাকা জমা মোডাল */}
      {payTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-md p-6 sm:p-8">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-md bg-emerald-100 flex items-center justify-center">
                  <HandCoins className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">বাকি আদায়</h3>
                  <p className="text-[11px] text-slate-500">{payTarget.name} • {payTarget.phone}</p>
                </div>
              </div>
              <button onClick={() => setPayTarget(null)} className="p-2 rounded-md text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-red-50 border border-red-200 rounded-md p-3.5 text-xs">
                <span className="font-bold text-red-700">বর্তমান বাকি: {formatPrice(payTarget.dueAmount || 0)}</span>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">আদায়ের পরিমাণ (৳) *</label>
                <input
                  type="number"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">মাধ্যম</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['Cash', 'bKash', 'Nagad'] as const).map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setPayMethod(m)}
                      className={`px-3 py-2.5 rounded-md text-xs font-bold border transition-all ${
                        payMethod === m
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">নোট (ঐচ্ছিক)</label>
                <input
                  value={payNote}
                  onChange={e => setPayNote(e.target.value)}
                  placeholder="যেমন: আংশিক পরিশোধ"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  onClick={() => setPayTarget(null)}
                  className="flex-1 px-4 py-3 rounded-md border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  onClick={submitPayment}
                  disabled={paySubmitting || Number(payAmount) <= 0}
                  className="flex-1 px-4 py-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {paySubmitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  আদায় নিশ্চিত করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* খাতা মোডাল */}
      {ledgerTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="font-bold text-sm">খাতা — {ledgerTarget.name}</h3>
                <p className="text-[11px] text-slate-300">
                  {ledgerTarget.phone} • মোট কেনা {formatPrice(ledgerTarget.totalPurchases || 0)} • বাকি{' '}
                  <span className={ledgerTarget.dueAmount > 0 ? 'text-red-300 font-bold' : 'text-emerald-300 font-bold'}>
                    {formatPrice(ledgerTarget.dueAmount || 0)}
                  </span>
                </p>
              </div>
              <button onClick={() => setLedgerTarget(null)} className="p-2 rounded-md text-slate-300 hover:bg-slate-800">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">
              {ledgerLoading && <div className="text-center text-slate-400 text-sm py-8">খাতা লোড হচ্ছে…</div>}

              {!ledgerLoading && (
                <>
                  <div>
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">কেনাকাটার হিস্ট্রি</h4>
                    <div className="space-y-2">
                      {ledgerOrders.map(o => (
                        <div key={o.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-md px-4 py-3">
                          <div>
                            <span className="font-mono font-bold text-xs text-orange-600">{o.orderNumber}</span>
                            <span className="text-[11px] text-slate-400 ml-2">{formatDate(o.createdAt)}</span>
                            <div className="text-[11px] text-slate-500 mt-0.5">
                              {o.items.map(i => `${i.name}×${i.quantity}`).join(', ')}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-slate-900 text-sm">{formatPrice(o.total)}</div>
                            {(o.dueAmount || 0) > 0 && (
                              <div className="text-[10px] font-bold text-red-600">বাকি: {formatPrice(o.dueAmount || 0)}</div>
                            )}
                          </div>
                        </div>
                      ))}
                      {ledgerOrders.length === 0 && (
                        <p className="text-xs text-slate-400 py-2">এখনো কোনো অর্ডার নেই।</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2.5">বাকি পরিশোধের হিস্ট্রি</h4>
                    <div className="space-y-2">
                      {ledgerPayments.map(p => (
                        <div key={p.id} className="flex items-center justify-between bg-emerald-50/60 border border-emerald-100 rounded-md px-4 py-3">
                          <div>
                            <span className="font-bold text-xs text-emerald-700">+ {formatPrice(p.amount)}</span>
                            <span className="text-[11px] text-slate-500 ml-2">{p.method}</span>
                            {p.note && <span className="text-[11px] text-slate-400 ml-2 italic">{p.note}</span>}
                          </div>
                          <span className="text-[11px] text-slate-400">{formatDate(p.createdAt)}</span>
                        </div>
                      ))}
                      {ledgerPayments.length === 0 && (
                        <p className="text-xs text-slate-400 py-2">এখনো কোনো পরিশোধ নেই।</p>
                      )}
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* নতুন কাস্টমার মোডাল */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-md p-6 sm:p-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-slate-900">নতুন কাস্টমার</h3>
              <button onClick={() => setAddOpen(false)} className="p-2 rounded-md text-slate-400 hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">নাম *</label>
                <input
                  value={addForm.name}
                  onChange={e => setAddForm({ ...addForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">ফোন নম্বর *</label>
                <input
                  value={addForm.phone}
                  onChange={e => setAddForm({ ...addForm, phone: e.target.value })}
                  placeholder="01XXXXXXXXX"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">ঠিকানা</label>
                <input
                  value={addForm.address}
                  onChange={e => setAddForm({ ...addForm, address: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                  প্রাথমিক বাকি (৳) — পুরনো খাতা মাইগ্রেট
                </label>
                <input
                  type="number"
                  value={addForm.dueAmount}
                  onChange={e => setAddForm({ ...addForm, dueAmount: e.target.value })}
                  placeholder="0"
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">নোট</label>
                <input
                  value={addForm.note}
                  onChange={e => setAddForm({ ...addForm, note: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                />
              </div>
              <button
                onClick={submitAddCustomer}
                disabled={addSubmitting || !addForm.name.trim() || !addForm.phone.trim()}
                className="w-full px-4 py-3 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {addSubmitting ? (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <TrendingUp className="w-4 h-4" />
                )}
                কাস্টমার যোগ করুন
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

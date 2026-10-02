'use client';

/**
 * খরচের খাতা (Expense Tracker)
 * দোকান ভাড়া, বিল, বেতন, পরিবহন — সব খরচ এখানে; হিসাব পেজের নেট প্রফিটে অটো বাদ যায়।
 */

import React, { useEffect, useState } from 'react';
import { Expense } from '@/types';
import { formatPrice, formatDate } from '@/lib/utils';
import { Receipt, Plus, Trash2, TrendingDown } from 'lucide-react';

const EXPENSE_CATEGORIES = [
  'দোকান ভাড়া',
  'বিদ্যুৎ বিল',
  'কর্মচারী বেতন',
  'পরিবহন',
  'ক্রয় (Purchase)',
  'মার্কেটিং',
  'মেরামত',
  'অন্যান্য',
];

export default function AdminExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [form, setForm] = useState({ category: EXPENSE_CATEGORIES[0], customCategory: '', amount: '', note: '' });

  const loadExpenses = async () => {
    try {
      const res = await fetch('/api/expenses');
      if (res.ok) setExpenses(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadExpenses();
  }, []);

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const thisMonth = expenses
    .filter(e => {
      const d = new Date(e.createdAt);
      const n = new Date();
      return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
    })
    .reduce((s, e) => s + e.amount, 0);

  const submit = async () => {
    const category = form.category === 'অন্যান্য-কাস্টম' ? form.customCategory.trim() : form.category;
    if (!category || !form.amount || Number(form.amount) <= 0 || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category, amount: Number(form.amount), note: form.note || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        setForm({ category: EXPENSE_CATEGORIES[0], customCategory: '', amount: '', note: '' });
        setFeedback(`✅ ${formatPrice(data.amount)} খরচ যোগ হয়েছে`);
        setTimeout(() => setFeedback(null), 3500);
        loadExpenses();
      } else {
        alert('⚠️ ' + (data?.error || 'যোগ করা যায়নি'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    if (!confirm('এই খরচটা মুছে ফেলবেন?')) return;
    const res = await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
    if (res.ok) loadExpenses();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-20">
      <div className="sticky top-14 md:top-0 z-20 bg-slate-200 rounded-md border border-slate-200/80 px-4 sm:px-5 py-3.5 ">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">খরচের খাতা</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          ভাড়া, বিল, বেতন — প্রতিটা খরচ এখানে রাখুন। AI হিসাবে নেট প্রফিট বের করার সময় এগুলো অটো বাদ যাবে।
        </p>
      </div>

      {feedback && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-md text-xs sm:text-sm font-bold">
          {feedback}
        </div>
      )}

      {/* KPI */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-md border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">এই মাসের খরচ</span>
          <div className="mt-2 text-2xl font-bold text-red-600">{formatPrice(thisMonth)}</div>
        </div>
        <div className="bg-white p-5 rounded-md border border-slate-200/80">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">সর্বমোট খরচ</span>
          <div className="mt-2 text-2xl font-bold text-slate-900">{formatPrice(total)}</div>
        </div>
      </div>

      {/* যোগ করার ফর্ম */}
      <div className="bg-white p-6 rounded-md border border-slate-200/80 space-y-4">
        <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
          <Plus className="w-4 h-4 text-orange-600" /> নতুন খরচ যোগ করুন
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">খাতা *</label>
            <select
              value={form.category}
              onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            >
              {EXPENSE_CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
              <option value="অন্যান্য-কাস্টম">অন্য (নিজে লিখুন)</option>
            </select>
            {form.category === 'অন্যান্য-কাস্টম' && (
              <input
                value={form.customCategory}
                onChange={e => setForm({ ...form, customCategory: e.target.value })}
                placeholder="খাতার নাম লিখুন"
                className="w-full mt-2 bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              />
            )}
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">পরিমাণ (৳) *</label>
            <input
              type="number"
              value={form.amount}
              onChange={e => setForm({ ...form, amount: e.target.value })}
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-orange-500"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase mb-1">নোট (ঐচ্ছিক)</label>
            <input
              value={form.note}
              onChange={e => setForm({ ...form, note: e.target.value })}
              placeholder="যেমন: সেপ্টেম্বর মাসের বিল"
              className="w-full bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            />
          </div>
        </div>
        <button
          onClick={submit}
          disabled={submitting}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold disabled:opacity-50"
        >
          {submitting ? (
            <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Receipt className="w-4 h-4" />
          )}
          খরচ যোগ করুন
        </button>
      </div>

      {/* তালিকা */}
      <div className="bg-white rounded-md border border-slate-200/80 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-100">
              <tr>
                <th className="py-3.5 px-6">তারিখ</th>
                <th className="py-3.5 px-6">খাতা</th>
                <th className="py-3.5 px-6">নোট</th>
                <th className="py-3.5 px-6">পরিমাণ</th>
                <th className="py-3.5 px-6"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {expenses.map(e => (
                <tr key={e.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="py-4 px-6 text-xs font-semibold text-slate-500">{formatDate(e.createdAt)}</td>
                  <td className="py-4 px-6">
                    <span className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 font-bold text-xs">
                      {e.category}
                    </span>
                  </td>
                  <td className="py-4 px-6 text-xs text-slate-500 italic">{e.note || '—'}</td>
                  <td className="py-4 px-6 font-bold text-red-600">- {formatPrice(e.amount)}</td>
                  <td className="py-4 px-6 text-right">
                    <button
                      onClick={() => remove(e.id)}
                      className="p-2 rounded-md text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label="মুছুন"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-400 text-sm">
                    <TrendingDown className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                    এখনো কোনো খরচ এন্ট্রি নেই।
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

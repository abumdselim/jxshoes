'use client';

/**
 * নোটিফিকেশন — নতুন অর্ডার, কাস্টমারের অভিযোগ ও পরামর্শ
 * ----------------------------------------------------
 * নতুন অর্ডার হলে store.ts-এর createOrder থেকে অটো-নোটিফিকেশন আসে;
 * অভিযোগ/পরামর্শ আসে লাইভ ওয়েবসাইটের ফুটার ফর্ম থেকে (/api/feedback)।
 */

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { NotificationItem } from '@/types';
import {
  Bell,
  ShoppingCart,
  AlertTriangle,
  MessageCircle,
  CheckCheck,
  Trash2,
  Loader2,
  Inbox,
} from 'lucide-react';

type Filter = 'all' | 'unread' | 'order' | 'complaint' | 'feedback';

const TYPE_META: Record<
  NotificationItem['type'],
  { label: string; icon: React.ElementType; cls: string }
> = {
  order: { label: 'নতুন অর্ডার', icon: ShoppingCart, cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  complaint: { label: 'অভিযোগ', icon: AlertTriangle, cls: 'bg-red-50 text-red-600 border-red-200' },
  feedback: { label: 'পরামর্শ', icon: MessageCircle, cls: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
};

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'সব' },
  { key: 'unread', label: 'অপঠিত' },
  { key: 'order', label: 'নতুন অর্ডার' },
  { key: 'complaint', label: 'অভিযোগ' },
  { key: 'feedback', label: 'পরামর্শ' },
];

export default function AdminNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) setItems(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const unreadCount = useMemo(() => items.filter(n => !n.read).length, [items]);

  const filtered = useMemo(() => {
    if (filter === 'all') return items;
    if (filter === 'unread') return items.filter(n => !n.read);
    return items.filter(n => n.type === filter);
  }, [items, filter]);

  const markAllRead = async () => {
    setBusy(true);
    try {
      await fetch('/api/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      });
      setItems(prev => prev.map(n => ({ ...n, read: true })));
    } finally {
      setBusy(false);
    }
  };

  const markRead = async (id: string) => {
    setItems(prev => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
    await fetch('/api/notifications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  const removeItem = async (id: string) => {
    setItems(prev => prev.filter(n => n.id !== id));
    await fetch('/api/notifications', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
  };

  const fmtTime = (iso: string) =>
    new Date(iso).toLocaleString('bn-BD', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    });

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* হেডার */}
      <div className="sticky top-14 md:top-0 z-20 bg-slate-200 rounded-md border border-slate-200/80 px-4 sm:px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">নোটিফিকেশন</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            নতুন অর্ডার এবং লাইভ ওয়েবসাইট থেকে আসা কাস্টমারের অভিযোগ ও পরামর্শ।
          </p>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={busy}
            className="self-start sm:self-auto inline-flex items-center gap-2 px-4 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold disabled:opacity-60"
          >
            <CheckCheck className="w-4 h-4" /> সব পড়া হয়েছে ({unreadCount})
          </button>
        )}
      </div>

      {/* ফিল্টার */}
      <div className="flex flex-wrap items-center gap-2">
        {FILTERS.map(f => {
          const count =
            f.key === 'all'
              ? items.length
              : f.key === 'unread'
              ? unreadCount
              : items.filter(n => n.type === f.key).length;
          return (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3.5 py-2 rounded-md text-xs font-bold border transition-colors ${
                filter === f.key
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
              }`}
            >
              {f.label} ({count})
            </button>
          );
        })}
      </div>

      {/* তালিকা */}
      {loading ? (
        <div className="flex items-center justify-center py-24">
          <div className="w-10 h-10 border-4 border-orange-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-md border border-slate-200/80 p-12 text-center">
          <Inbox className="w-12 h-12 mx-auto text-slate-200 mb-4" />
          <h3 className="font-bold text-slate-700">কোনো নোটিফিকেশন নেই</h3>
          <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
            নতুন অর্ডার হলে বা লাইভ ওয়েবসাইট থেকে কাস্টমার পরামর্শ/অভিযোগ দিলে এখানে দেখা যাবে।
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(n => {
            const meta = TYPE_META[n.type];
            const Icon = meta.icon;
            return (
              <div
                key={n.id}
                className={`bg-white rounded-md border p-4 flex gap-3.5 transition-colors ${
                  n.read
                    ? 'border-slate-200/80 opacity-75'
                    : 'border-slate-200 border-l-4 border-l-orange-500'
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-md border flex items-center justify-center flex-shrink-0 ${meta.cls}`}
                >
                  <Icon className="w-5 h-5" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border">
                      {meta.label}
                    </span>
                    {!n.read && (
                      <span className="w-2 h-2 rounded-full bg-orange-500 flex-shrink-0" />
                    )}
                    <span className="text-[10px] text-slate-400 font-semibold ml-auto">
                      {fmtTime(n.createdAt)}
                    </span>
                  </div>
                  <div className={`text-sm mt-1.5 ${n.read ? 'text-slate-600' : 'text-slate-900 font-bold'}`}>
                    {n.title}
                  </div>
                  <div className="text-xs text-slate-500 mt-1 leading-relaxed break-words">{n.message}</div>

                  <div className="flex items-center gap-3 mt-2.5">
                    {n.type === 'order' && (
                      <Link
                        href="/admin/orders"
                        onClick={() => markRead(n.id)}
                        className="text-[11px] font-bold text-orange-600 hover:text-orange-700"
                      >
                        অর্ডার ম্যানেজমেন্টে দেখুন →
                      </Link>
                    )}
                    {!n.read && (
                      <button
                        onClick={() => markRead(n.id)}
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-700 inline-flex items-center gap-1"
                      >
                        <CheckCheck className="w-3.5 h-3.5" /> পড়া হয়েছে
                      </button>
                    )}
                    <button
                      onClick={() => removeItem(n.id)}
                      className="text-[11px] font-bold text-slate-400 hover:text-red-600 inline-flex items-center gap-1 ml-auto"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> মুছুন
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

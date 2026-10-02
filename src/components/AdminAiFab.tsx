'use client';

/**
 * AI FAB — সব অ্যাডমিন পেজে ভাসমান "আপনার এআই সহকারী" বাটন
 * ------------------------------------------------
 * দুই কাজ এক বাটনে:
 * ১. দ্রুত সেল এন্ট্রি — প্রোডাক্ট কোড (SKU/বারকোড) পাঠালে AI প্রোডাক্ট + ভ্যারিয়েন্ট
 *    মিলিয়ে কনফার্মেশন পপআপ দেখায়; "নিশ্চিত করুন" চাপলেই সেল + স্টক আপডেট
 * ২. দ্রুত প্রশ্ন — বাকি মেসেজ AI অ্যাসিস্ট্যান্টের উত্তর দেয় (স্ট্রিমিং)
 */

import React, { useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Product } from '@/types';
import { ChatMsg, streamChat } from '@/lib/chatClient';
import {
  Bot,
  Sparkles,
  Send,
  X,
  Minus,
  Plus,
  ShoppingBag,
  CheckCircle,
  AlertTriangle,
  MessagesSquare,
} from 'lucide-react';

interface SaleDraft {
  product: Product;
  size: string;
  color: string;
  quantity: number;
  confidence: 'high' | 'medium' | 'low';
  clarification?: string;
  alternatives: { productId: string; productName: string }[];
  paymentMode: 'full' | 'due';
  paidAmount: string;
  customerName: string;
  customerPhone: string;
}

interface RestockDraft {
  product: Product;
  quantity: number;
  unitCost: string;
  supplierOrInvoice: string;
}

interface NewProductDraft {
  name: string;
  category: string;
  subCategory: string;
  price: string;
  costPrice: string;
  sizes: string;
  colors: string;
  stockCount: string;
  supplier: string;
  description: string;
}

/** বাংলা/ইংরেজি কালারের নাম থেকে hex */
const COLOR_HEX: [RegExp, string][] = [
  [/black|কালো/i, '#111827'],
  [/white|সাদা|ক্রিম/i, '#f1f5f9'],
  [/brown|বাদাম/i, '#78350f'],
  [/tan/i, '#b45309'],
  [/navy/i, '#1e3a8a'],
  [/blue|নীল/i, '#2563eb'],
  [/grey|gray|ধূসর/i, '#64748b'],
  [/maroon|গাঢ়\s*লাল/i, '#7f1d1d'],
  [/red|লাল/i, '#b91c1c'],
  [/green|সবুজ/i, '#15803d'],
  [/olive/i, '#3f6212'],
  [/yellow|হলুদ/i, '#ca8a04'],
  [/beige/i, '#e7d8b1'],
  [/pink|গোলাপি/i, '#ec4899'],
];

function colorHex(name: string): string {
  for (const [re, hex] of COLOR_HEX) if (re.test(name)) return hex;
  return '#111827';
}

export default function AdminAiFab() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [saleDraft, setSaleDraft] = useState<SaleDraft | null>(null);
  const [restockDraft, setRestockDraft] = useState<RestockDraft | null>(null);
  const [restockSubmitting, setRestockSubmitting] = useState(false);
  const [newProductDraft, setNewProductDraft] = useState<NewProductDraft | null>(null);
  const [newProductSubmitting, setNewProductSubmitting] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ text: string; error?: boolean } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  const showAIError = (err: unknown) => {
    const text = err instanceof Error ? err.message : 'কিছু একটা সমস্যা হয়েছে';
    setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${text}` }]);
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy || streaming) return;
    setInput('');

    const withUser: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(withUser);
    setBusy(true);

    try {
      // ১) AI বুঝতে দাও — সেল? রিস্টক? নতুন প্রোডাক্ট? নাকি সাধারণ প্রশ্ন?
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse-intent', message: text }),
      });
      const data = await res.json().catch(() => null);

      if (data && !data.configured) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${data.error}` }]);
        return;
      }

      // — বিক্রি কনফার্মেশন
      if (res.ok && data?.intent === 'sale' && data?.match?.matched && data?.product) {
        const p: Product = data.product;
        const m = data.match;
        setSaleDraft({
          product: p,
          size: m.size || p.sizes[0] || 'Standard',
          color: m.color || p.colors[0]?.name || 'Default',
          quantity: m.quantity || 1,
          confidence: m.confidence || 'medium',
          clarification: m.clarification,
          alternatives: m.alternatives || [],
          paymentMode: 'full',
          paidAmount: '',
          customerName: '',
          customerPhone: '',
        });
        return;
      }

      // — রিস্টক কনফার্মেশন
      if (res.ok && data?.intent === 'restock' && data?.product) {
        const p: Product = data.product;
        setRestockDraft({
          product: p,
          quantity: data.quantity || 1,
          unitCost: data.unitCost ? String(data.unitCost) : p.costPrice ? String(p.costPrice) : '',
          supplierOrInvoice: data.supplierOrInvoice || '',
        });
        return;
      }

      // — নতুন প্রোডাক্ট তৈরির ফর্ম (AI প্রি-ফিল করে)
      if (res.ok && data?.intent === 'new-product' && data?.draft) {
        const d = data.draft;
        setNewProductDraft({
          name: d.name || '',
          category: d.category || 'shoes',
          subCategory: d.subCategory || '',
          price: d.price ? String(d.price) : '',
          costPrice: d.costPrice ? String(d.costPrice) : '',
          sizes: Array.isArray(d.sizes) ? d.sizes.join(', ') : '',
          colors: Array.isArray(d.colors) ? d.colors.join(', ') : '',
          stockCount: d.stockCount ? String(d.stockCount) : '0',
          supplier: d.supplier || '',
          description: d.description || '',
        });
        return;
      }

      // — AI বুঝতে পারেনি কী চায়, প্রশ্ন করে
      if (res.ok && data?.intent === 'other' && data?.clarification) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `🤔 ${data.clarification}` },
        ]);
        return;
      }

      // ২) না হলে সাধারণ AI চ্যাট (স্ট্রিমিং)
      setMessages([...withUser, { role: 'assistant', content: '' }]);
      setBusy(false);
      setStreaming(true);
      await streamChat(withUser, delta => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last?.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + delta };
          }
          return updated;
        });
      });
    } catch (err) {
      showAIError(err);
    } finally {
      setBusy(false);
      setStreaming(false);
    }
  };

  const draftUnitPrice = saleDraft
    ? (saleDraft.product.variants?.find(
        v => v.size === saleDraft.size && v.color === saleDraft.color
      )?.price ?? saleDraft.product.price)
    : 0;
  const draftTotal = draftUnitPrice * (saleDraft?.quantity || 0);
  const draftPaid = saleDraft?.paymentMode === 'full' ? draftTotal : Number(saleDraft?.paidAmount || 0);
  const draftDue = Math.max(0, draftTotal - draftPaid);

  const confirmSale = async () => {
    if (!saleDraft || submitting) return;
    if (saleDraft.paymentMode === 'due' && !saleDraft.customerPhone.trim()) return;
    setSubmitting(true);
    try {
      const variant = saleDraft.product.variants?.find(
        v => v.size === saleDraft.size && v.color === saleDraft.color
      );
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              productId: saleDraft.product.id,
              variantId: variant?.id,
              quantity: saleDraft.quantity,
              size: saleDraft.size,
              color: saleDraft.color,
            },
          ],
          customerName: saleDraft.customerName || undefined,
          customerPhone: saleDraft.customerPhone || undefined,
          paidAmount: saleDraft.paymentMode === 'full' ? undefined : draftPaid,
          note: 'AI কুইক সেল (কোড মেসেজ থেকে)',
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        const due = data.order.dueAmount || 0;
        setToast({
          text:
            due > 0
              ? `✅ বিক্রি সম্পন্ন! ${data.order.orderNumber} — বাকি ৳${due.toLocaleString('en-BD')} কাস্টমারের খাতায় যোগ হয়েছে`
              : `✅ বিক্রি সম্পন্ন! অর্ডার ${data.order.orderNumber} — স্টক আপডেট হয়েছে`,
        });
        setSaleDraft(null);
        setOpen(false);
        setMessages([]);
      } else {
        setToast({ text: `❌ ${data?.error || 'বিক্রি সংরক্ষণ করা যায়নি'}`, error: true });
      }
    } catch {
      setToast({ text: '❌ সার্ভারে সংযোগ করা যায়নি', error: true });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmRestock = async () => {
    if (!restockDraft || restockSubmitting) return;
    setRestockSubmitting(true);
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restock',
          productId: restockDraft.product.id,
          quantity: restockDraft.quantity,
          unitCost: Number(restockDraft.unitCost) || undefined,
          supplierOrInvoice: restockDraft.supplierOrInvoice || undefined,
          note: 'AI কুইক রিস্টক (মেসেজ থেকে)',
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setToast({
          text: `✅ ${restockDraft.product.name} এর স্টক +${restockDraft.quantity} — এখন ${data.product?.stockCount ?? '?'} টি`,
        });
        setRestockDraft(null);
        setOpen(false);
        setMessages([]);
      } else {
        setToast({ text: `❌ ${data?.error || 'রিস্টক করা যায়নি'}`, error: true });
      }
    } catch {
      setToast({ text: '❌ সার্ভারে সংযোগ করা যায়নি', error: true });
    } finally {
      setRestockSubmitting(false);
    }
  };

  const confirmNewProduct = async () => {
    if (!newProductDraft || newProductSubmitting) return;
    const sizesArr = newProductDraft.sizes.split(',').map(s => s.trim()).filter(Boolean);
    const colorsArr = newProductDraft.colors.split(',').map(c => c.trim()).filter(Boolean)
      .map(name => ({ name, hex: colorHex(name) }));
    if (!newProductDraft.name.trim() || !Number(newProductDraft.price)) {
      setToast({ text: '❌ নাম ও বিক্রয়মূল্য দিন', error: true });
      return;
    }
    setNewProductSubmitting(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newProductDraft.name.trim(),
          category: newProductDraft.category,
          subCategory: newProductDraft.subCategory.trim() || undefined,
          price: Number(newProductDraft.price),
          costPrice: Number(newProductDraft.costPrice) || undefined,
          sizes: sizesArr.length > 0 ? sizesArr : ['Standard'],
          colors: colorsArr.length > 0 ? colorsArr : [{ name: 'Black', hex: '#111827' }],
          stockCount: Number(newProductDraft.stockCount) || 0,
          minStockAlert: 5,
          supplier: newProductDraft.supplier.trim() || undefined,
          description: newProductDraft.description.trim() || '',
          inStock: (Number(newProductDraft.stockCount) || 0) > 0,
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.id) {
        setToast({
          text: `✅ ${data.name} ইনভেন্টরিতে যোগ হয়েছে — SKU: ${data.sku}`,
        });
        setNewProductDraft(null);
        setOpen(false);
        setMessages([]);
      } else {
        setToast({ text: `❌ ${data?.error || 'প্রোডাক্ট যোগ করা যায়নি'}`, error: true });
      }
    } catch {
      setToast({ text: '❌ সার্ভারে সংযোগ করা যায়নি', error: true });
    } finally {
      setNewProductSubmitting(false);
    }
  };

  const draftVariant = saleDraft?.product.variants?.find(
    v => v.size === saleDraft.size && v.color === saleDraft.color
  );
  const draftStock = draftVariant ? draftVariant.stock : saleDraft?.product.stockCount;

  // অ্যাসিস্ট্যান্ট পেজে ফুল চ্যাট আছে, FAB দরকার নেই
  // (hooks-এর নিয়ম: সব hook-এর পরে return — নাহলে পেজ বদলালে ক্র্যাশ করে)
  if (pathname.startsWith('/admin/assistant')) return null;

  return (
    <>
      {/* ভাসমান AI বাটন */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-5 sm:right-8 z-40 group flex items-center gap-2 rounded-md transition-all ${
          open
            ? 'bg-slate-900 text-white px-5 py-3.5'
            : 'bg-orange-600 text-white px-5 py-3.5'
        }`}
        aria-label="আপনার এআই সহকারী"
      >
        <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500 border-2 border-white" />
        </span>
        <Bot className="w-5 h-5" />
        <span className="text-sm font-bold">আপনার এআই সহকারী</span>
      </button>

      {/* কুইক শিট */}
      {open && (
        <div className="fixed bottom-24 right-4 sm:right-8 z-40 w-[calc(100vw-2rem)] sm:w-96 max-w-md flex flex-col rounded-md bg-white border border-slate-200 overflow-hidden animate-in fade-in slide-in-from-bottom-4">
          {/* হেডার */}
          <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-md bg-orange-600 flex items-center justify-center">
                <Bot className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-bold leading-none">AI অ্যাসিস্ট্যান্ট</div>
                <div className="text-[10px] text-slate-400 mt-0.5">
                  কোড পাঠান বা প্রশ্ন করুন — দ্রুত কাজ হবে
                </div>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <a
                href="/admin/assistant"
                className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
                title="ফুল চ্যাট"
              >
                <MessagesSquare className="w-4 h-4" />
              </a>
              <button
                onClick={() => setOpen(false)}
                className="p-2 rounded-md text-slate-300 hover:text-white hover:bg-slate-800"
                aria-label="বন্ধ করুন"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* মেসেজ এলাকা */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3 min-h-[220px] max-h-[45vh] bg-slate-50">
            {messages.length === 0 && (
              <div className="text-center space-y-3 py-5">
                <div className="w-12 h-12 mx-auto rounded-md bg-orange-100 flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-orange-600" />
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  বিক্রি: <code className="bg-white border border-slate-200 rounded-md px-1.5 py-0.5 font-mono text-[11px]">JX-SH-101 42 2টি</code>
                  <br />
                  রিস্টক: <span className="text-slate-600">&quot;JX-SH-101 এ ১০টা স্টক এসেছে&quot;</span>
                  <br />
                  নতুন পণ্য: <span className="text-slate-600">&quot;নতুন প্রোডাক্ট: Nike Air Max, দাম ৫৫০০, স্টক ২০&quot;</span>
                  <br />
                  অথবা শপ নিয়ে যেকোনো প্রশ্ন করুন।
                </p>
              </div>
            )}

            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-md px-3.5 py-2.5 text-xs leading-relaxed whitespace-pre-wrap ${
                    m.role === 'user'
                      ? 'bg-orange-600 text-white rounded-br-md'
                      : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
                  }`}
                >
                  {m.content ||
                    (streaming ? (
                      <span className="inline-flex gap-1 items-center h-4">
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </span>
                    ) : (
                      '…'
                    ))}
                </div>
              </div>
            ))}
          </div>

          {/* ইনপুট */}
          <div className="p-3 border-t border-slate-100 bg-white flex items-center gap-2 flex-shrink-0">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder="যেমন: JX-SH-101 42 2টি"
              className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={busy || streaming}
            />
            <button
              onClick={handleSend}
              disabled={busy || streaming || !input.trim()}
              className="p-2.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="পাঠান"
            >
              {busy ? (
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* সেল কনফার্মেশন পপআপ */}
      {saleDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            {/* হেডার */}
            <div className="bg-orange-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5" />
                <div>
                  <div className="text-sm font-bold">বিক্রি নিশ্চিত করুন</div>
                  <div className="text-[10px] opacity-90">AI আপনার মেসেজ থেকে প্রোডাক্ট খুঁজে পেয়েছে</div>
                </div>
              </div>
              <button
                onClick={() => setSaleDraft(null)}
                className="p-1.5 rounded-md hover:bg-white/20"
                aria-label="বাতিল"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {saleDraft.clarification && saleDraft.confidence !== 'high' && (
                <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{saleDraft.clarification}</span>
                </div>
              )}

              {/* প্রোডাক্ট */}
              <div className="flex gap-3 items-center">
                {saleDraft.product.images[0] ? (
                  <img
                    src={saleDraft.product.images[0]}
                    alt={saleDraft.product.name}
                    className="w-16 h-16 rounded-md object-cover border border-slate-200"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-md bg-slate-100" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">
                    {saleDraft.product.name}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">{saleDraft.product.sku}</div>
                  <div className="text-sm font-bold text-orange-600 mt-0.5">
                    ৳{(saleDraft.product.variants?.find(v => v.size === saleDraft.size && v.color === saleDraft.color)?.price ?? saleDraft.product.price).toLocaleString('en-BD')}
                  </div>
                </div>
              </div>

              {/* সাইজ ও কালার */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    সাইজ
                  </label>
                  <select
                    value={saleDraft.size}
                    onChange={e =>
                      setSaleDraft({ ...saleDraft, size: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {saleDraft.product.sizes.map(s => (
                      <option key={s} value={s}>
                        {s}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                    কালার
                  </label>
                  <select
                    value={saleDraft.color}
                    onChange={e =>
                      setSaleDraft({ ...saleDraft, color: e.target.value })
                    }
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    {saleDraft.product.colors.map(c => (
                      <option key={c.name} value={c.name}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* পরিমাণ */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  পরিমাণ
                </label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setSaleDraft({
                        ...saleDraft,
                        quantity: Math.max(1, saleDraft.quantity - 1),
                      })
                    }
                    className="p-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                    aria-label="কমান"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-lg font-bold text-slate-900 w-10 text-center">
                    {saleDraft.quantity}
                  </span>
                  <button
                    onClick={() =>
                      setSaleDraft({
                        ...saleDraft,
                        quantity: Math.min(Math.max(draftStock ?? 99, 1), saleDraft.quantity + 1),
                      })
                    }
                    className="p-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700"
                    aria-label="বাড়ান"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <span
                    className={`text-[11px] font-bold ${
                      (draftStock ?? 0) < saleDraft.quantity ? 'text-red-600' : 'text-emerald-600'
                    }`}
                  >
                    স্টক: {draftStock ?? 0}
                  </span>
                </div>
              </div>

              {/* মোট */}
              <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-md px-4 py-3">
                <span className="text-xs font-bold text-slate-600">মোট মূল্য</span>
                <span className="text-lg font-bold text-slate-900">
                  ৳{draftTotal.toLocaleString('en-BD')}
                </span>
              </div>

              {/* পেমেন্ট — পুরো ক্যাশ নাকি বাকিতে */}
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">
                  পেমেন্ট
                </label>
                <div className="grid grid-cols-2 gap-2 mb-2.5">
                  <button
                    type="button"
                    onClick={() => setSaleDraft({ ...saleDraft, paymentMode: 'full' })}
                    className={`px-3 py-2.5 rounded-md text-[11px] font-bold border transition-all ${
                      saleDraft.paymentMode === 'full'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400'
                    }`}
                  >
                    ✅ পুরো ক্যাশ
                  </button>
                  <button
                    type="button"
                    onClick={() => setSaleDraft({ ...saleDraft, paymentMode: 'due' })}
                    className={`px-3 py-2.5 rounded-md text-[11px] font-bold border transition-all ${
                      saleDraft.paymentMode === 'due'
                        ? 'bg-red-500 text-white border-red-500'
                        : 'bg-white text-slate-600 border-slate-200 hover:border-red-400'
                    }`}
                  >
                    📋 বাকিতে (Due)
                  </button>
                </div>

                {saleDraft.paymentMode === 'due' && (
                  <div className="space-y-2 bg-red-50/60 border border-red-100 rounded-md p-3">
                    <input
                      value={saleDraft.customerPhone}
                      onChange={e => setSaleDraft({ ...saleDraft, customerPhone: e.target.value })}
                      placeholder="কাস্টমারের ফোন (বাধ্যতামূলক) — খাতা এই নম্বরে খুলবে"
                      className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                    <input
                      value={saleDraft.customerName}
                      onChange={e => setSaleDraft({ ...saleDraft, customerName: e.target.value })}
                      placeholder="কাস্টমারের নাম"
                      className="w-full bg-white border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-red-400"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-600 whitespace-nowrap">আদায় ৳</span>
                      <input
                        type="number"
                        value={saleDraft.paidAmount}
                        onChange={e => setSaleDraft({ ...saleDraft, paidAmount: e.target.value })}
                        placeholder="0"
                        className="w-24 bg-white border border-slate-200 rounded-md px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-red-400"
                      />
                      <span className="text-[11px] font-bold text-red-600 ml-auto">
                        বাকি থাকবে: ৳{draftDue.toLocaleString('en-BD')}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* অ্যাকশন */}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => setSaleDraft(null)}
                  className="flex-1 px-4 py-3 rounded-md border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50"
                >
                  বাতিল
                </button>
                <button
                  onClick={confirmSale}
                  disabled={
                    submitting ||
                    (draftStock ?? 0) < saleDraft.quantity ||
                    (saleDraft.paymentMode === 'due' && !saleDraft.customerPhone.trim())
                  }
                  className="flex-1 px-4 py-3 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {submitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  নিশ্চিত করুন
                </button>
              </div>

              {(draftStock ?? 0) < saleDraft.quantity && (
                <p className="text-[11px] text-red-600 font-bold text-center">
                  স্টকে যতটা আছে তার চেয়ে বেশি পরিমাণ দেওয়া হয়েছে
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* রিস্টক কনফার্মেশন পপআপ */}
      {restockDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95">
            <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Plus className="w-5 h-5" />
                <div>
                  <div className="text-sm font-bold">স্টক বাড়ান (রিস্টক)</div>
                  <div className="text-[10px] opacity-90">AI আপনার মেসেজ থেকে চালান খুঁজে পেয়েছে</div>
                </div>
              </div>
              <button onClick={() => setRestockDraft(null)} className="p-1.5 rounded-md hover:bg-white/20" aria-label="বাতিল">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex gap-3 items-center">
                {restockDraft.product.images[0] && (
                  <img src={restockDraft.product.images[0]} alt="" className="w-14 h-14 rounded-md object-cover border border-slate-200" />
                )}
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-900 truncate">{restockDraft.product.name}</div>
                  <div className="text-[11px] text-slate-500 font-mono">{restockDraft.product.sku}</div>
                  <div className="text-[11px] font-bold text-slate-600">বর্তমান স্টক: {restockDraft.product.stockCount} টি</div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">কতটা পিস এসেছে?</label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setRestockDraft({ ...restockDraft, quantity: Math.max(1, restockDraft.quantity - 1) })} className="p-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700" aria-label="কমান">
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="text-lg font-bold text-slate-900 w-10 text-center">{restockDraft.quantity}</span>
                  <button onClick={() => setRestockDraft({ ...restockDraft, quantity: restockDraft.quantity + 1 })} className="p-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-slate-700" aria-label="বাড়ান">
                    <Plus className="w-4 h-4" />
                  </button>
                  <span className="text-[11px] font-bold text-emerald-600 ml-auto">
                    নতুন স্টক: {restockDraft.product.stockCount + restockDraft.quantity} টি
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">প্রতি পিস ক্রয়মূল্য (৳)</label>
                  <input
                    type="number"
                    value={restockDraft.unitCost}
                    onChange={e => setRestockDraft({ ...restockDraft, unitCost: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">চালান / সাপ্লায়ার</label>
                  <input
                    value={restockDraft.supplierOrInvoice}
                    onChange={e => setRestockDraft({ ...restockDraft, supplierOrInvoice: e.target.value })}
                    placeholder="যেমন: চালান #CH-100"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setRestockDraft(null)} className="flex-1 px-4 py-3 rounded-md border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50">
                  বাতিল
                </button>
                <button
                  onClick={confirmRestock}
                  disabled={restockSubmitting || restockDraft.quantity < 1}
                  className="flex-1 px-4 py-3 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {restockSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  স্টক বাড়ান
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* নতুন প্রোডাক্ট তৈরির পপআপ */}
      {newProductDraft && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-white rounded-md w-full max-w-md overflow-hidden max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="bg-blue-600 text-white px-6 py-4 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <Sparkles className="w-5 h-5" />
                <div>
                  <div className="text-sm font-bold">নতুন প্রোডাক্ট যোগ করুন</div>
                  <div className="text-[10px] opacity-90">AI আপনার মেসেজ থেকে তথ্যগুলো ভরে দিয়েছে — দেখে ঠিক করুন</div>
                </div>
              </div>
              <button onClick={() => setNewProductDraft(null)} className="p-1.5 rounded-md hover:bg-white/20" aria-label="বাতিল">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-3 overflow-y-auto">
              <div>
                <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">প্রোডাক্টের নাম *</label>
                <input
                  value={newProductDraft.name}
                  onChange={e => setNewProductDraft({ ...newProductDraft, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">ক্যাটাগরি</label>
                  <select
                    value={newProductDraft.category}
                    onChange={e => setNewProductDraft({ ...newProductDraft, category: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="shoes">জুতা (Shoes)</option>
                    <option value="bags">ব্যাগ (Bags)</option>
                    <option value="accessories">এক্সেসরিজ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">সাব-ক্যাটাগরি</label>
                  <input
                    value={newProductDraft.subCategory}
                    onChange={e => setNewProductDraft({ ...newProductDraft, subCategory: e.target.value })}
                    placeholder="যেমন: Sneakers"
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">বিক্রয়মূল্য (৳) *</label>
                  <input
                    type="number"
                    value={newProductDraft.price}
                    onChange={e => setNewProductDraft({ ...newProductDraft, price: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">ক্রয়মূল্য (৳)</label>
                  <input
                    type="number"
                    value={newProductDraft.costPrice}
                    onChange={e => setNewProductDraft({ ...newProductDraft, costPrice: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">সাইজ (কমা দিয়ে)</label>
                  <input
                    value={newProductDraft.sizes}
                    onChange={e => setNewProductDraft({ ...newProductDraft, sizes: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">কালার (কমা দিয়ে)</label>
                  <input
                    value={newProductDraft.colors}
                    onChange={e => setNewProductDraft({ ...newProductDraft, colors: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">প্রাথমিক স্টক</label>
                  <input
                    type="number"
                    value={newProductDraft.stockCount}
                    onChange={e => setNewProductDraft({ ...newProductDraft, stockCount: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-600 uppercase mb-1">সাপ্লায়ার</label>
                  <input
                    value={newProductDraft.supplier}
                    onChange={e => setNewProductDraft({ ...newProductDraft, supplier: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-md px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-1">
                <button onClick={() => setNewProductDraft(null)} className="flex-1 px-4 py-3 rounded-md border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-50">
                  বাতিল
                </button>
                <button
                  onClick={confirmNewProduct}
                  disabled={newProductSubmitting || !newProductDraft.name.trim() || !Number(newProductDraft.price)}
                  className="flex-1 px-4 py-3 rounded-md bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {newProductSubmitting ? (
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <CheckCircle className="w-4 h-4" />
                  )}
                  ইনভেন্টরিতে যোগ করুন
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* টোস্ট */}
      {toast && (
        <div
          className={`fixed top-20 right-4 z-[70] max-w-sm rounded-md px-5 py-3.5 text-xs font-bold animate-in fade-in slide-in-from-top-4 ${
            toast.error
              ? 'bg-red-600 text-white'
              : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}
    </>
  );
}

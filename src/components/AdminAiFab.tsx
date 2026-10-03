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
import AnimatedBotIcon from '@/components/admin/AnimatedBotIcon';
import { Product } from '@/types';
import { ChatMsg, streamChat } from '@/lib/chatClient';
import { usePathname } from 'next/navigation';
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
  Mic,
  Square,
} from 'lucide-react';
import { apiFetch } from '@/lib/offline/apiFetch';

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
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  // ইন্ট্রো রিভিল — প্রতি সেশনে একবারই ফুল রূপে দেখায়; বাকি সময় শুধু আইকন
  const [introExpanded, setIntroExpanded] = useState(false);
  // এজেন্ট মোড: টুল-চিপ (এজেন্ট কী দেখছে/করছে) + বাকি-আদায় কনফার্মেশন কার্ড
  const [toolChips, setToolChips] = useState<string[]>([]);
  const [dueConfirm, setDueConfirm] = useState<{
    customer: { id: string; name: string; phone: string; dueAmount: number };
    amount: number;
    method: string;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('ai_fab_intro_seen')) return;
    setIntroExpanded(true);
    const t = setTimeout(() => {
      setIntroExpanded(false);
      sessionStorage.setItem('ai_fab_intro_seen', '1');
    }, 3500);
    return () => clearTimeout(t);
  }, []);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const messagesRef = useRef<ChatMsg[]>([]);
  const [toast, setToast] = useState<{ text: string; error?: boolean; undo?: { productId: string; quantity: number } } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast?.undo ? 30000 : 4500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, open]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const showAIError = (err: unknown) => {
    const text = err instanceof Error ? err.message : 'কিছু একটা সমস্যা হয়েছে';
    setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${text}` }]);
  };

  const undoAutoRestock = async () => {
    if (!toast?.undo) return;
    const { productId, quantity } = toast.undo;
    setToast(null);
    try {
      const res = await apiFetch('/api/pos/undo-auto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId, quantity }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setToast({ text: `↩️ ফিরিয়ে আনা হয়েছে — স্টক এখন ${data.product?.stockCount ?? '?'} টি` });
      } else {
        setToast({ text: `❌ ${data?.error || 'আন্ডো করা যায়নি'}`, error: true });
      }
    } catch {
      setToast({ text: '❌ সার্ভারে সংযোগ করা যায়নি', error: true });
    }
  };

  const blobToBase64 = (blob: Blob): Promise<string> =>
    new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => {
        const str = String(r.result);
        resolve(str.slice(str.indexOf(',') + 1));
      };
      r.onerror = reject;
      r.readAsDataURL(blob);
    });

  /** AI-র intent-রেসপন্স হ্যান্ডেল — পপআপ খুললে true, নাহলে false (চ্যাটে যায়) */
  const applyIntentResponse = (data: any, resOk: boolean): boolean => {
      if (data && !data.configured) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${data.error}` }]);
        return true;
      }

      // — বিক্রি কনফার্মেশন
      if (resOk && data?.intent === 'sale' && data?.match?.matched && data?.product) {
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
        return true;
      }

      // — রিস্টক কনফার্মেশন
      if (resOk && data?.intent === 'restock' && data?.product) {
        const p: Product = data.product;
        setRestockDraft({
          product: p,
          quantity: data.quantity || 1,
          unitCost: data.unitCost ? String(data.unitCost) : p.costPrice ? String(p.costPrice) : '',
          supplierOrInvoice: data.supplierOrInvoice || '',
        });
        return true;
      }

      // — নতুন প্রোডাক্ট তৈরির ফর্ম (AI প্রি-ফিল করে)
      if (resOk && data?.intent === 'new-product' && data?.draft) {
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
        return true;
      }

      // — AI বুঝতে পারেনি কী চায়, প্রশ্ন করে
      if (resOk && data?.intent === 'other' && data?.clarification) {
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `🤔 ${data.clarification}` },
        ]);
        return true;
      }

      return false;
  };

  const handleVoiceBlob = async (blob: Blob, mime: string) => {
    setVoiceBusy(true);
    try {
      const audioB64 = await blobToBase64(blob);
      const res = await apiFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'voice-intent', audioBase64: audioB64, mimeType: mime }),
      });
      const data = await res.json().catch(() => null);

      if (data && !data.configured) {
        setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ ${data.error}` }]);
        return;
      }

      const transcript = (data?.transcript as string) || '';
      if (!transcript) {
        showAIError(new Error(data?.error || 'কথা শোনা যায়নি — আবার চেষ্টা করুন'));
        return;
      }

      // দেখাও AI কী শুনলো
      setMessages(prev => [...prev, { role: 'user', content: `🎙️ "${transcript}"` }]);

      // অটো-এক্সিকিউশন: হুবহু SKU-ম্যাচ restock — পপআপ ছাড়াই সম্পন্ন + আন্ডো
      if (data?.autoExecuted) {
        const a = data.autoExecuted;
        setToast({
          text: `🤖 স্বয়ংক্রিয়ভাবে সম্পন্ন: ${a.productName} এর স্টক +${a.quantity} (এখন ${a.newStock} টি) — ভুল হলে ফিরিয়ে নিন`,
          undo: { productId: a.productId, quantity: a.quantity },
        });
        setOpen(false);
        setMessages([]);
        return;
      }

      const handled = applyIntentResponse(data, res.ok);
      if (!handled) {
        // সাধারণ প্রশ্ন হলে AI চ্যাটে উত্তর
        const withUser: ChatMsg[] = [...messagesRef.current, { role: 'user', content: transcript }];
        setMessages([...withUser, { role: 'assistant', content: '' }]);
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
      } else {
        setOpen(true);
      }
    } catch (err) {
      showAIError(err);
    } finally {
      setVoiceBusy(false);
    }
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';
      const mr = new MediaRecorder(stream, { mimeType: mime });
      voiceChunksRef.current = [];
      mr.ondataavailable = e => {
        if (e.data.size > 0) voiceChunksRef.current.push(e.data);
      };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(voiceChunksRef.current, { type: mime });
        if (blob.size < 1000) {
          setToast({ text: '⚠️ খুব ছোট রেকর্ডিং — আবার চেষ্টা করুন', error: true });
          return;
        }
        await handleVoiceBlob(blob, mime);
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setRecording(true);
    } catch (err) {
      const name = (err as { name?: string })?.name || '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        setToast({ text: '❌ মাইক অনুমতি নেই — অ্যাড্রেস বারের মাইক আইকনে ক্লিক করে "Allow" করুন', error: true });
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setToast({ text: '❌ কোনো মাইক্রোফোন পাওয়া যায়নি', error: true });
      } else {
        setToast({ text: '❌ মাইক চালু করা যায়নি', error: true });
      }
    }
  };

  const handleSend = async () => {
    const text = input.trim();
    if (!text || busy || streaming) return;
    setInput('');
    setToolChips([]);

    const withUser: ChatMsg[] = [...messages, { role: 'user', content: text }];
    setMessages(withUser);
    setBusy(true);

    try {
      // ১) AI বুঝতে দাও — সেল? রিস্টক? নতুন প্রোডাক্ট? নাকি সাধারণ প্রশ্ন?
      const res = await apiFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'parse-intent', message: text }),
      });
      const data = await res.json().catch(() => null);

      const handled = applyIntentResponse(data, res.ok);
      if (handled) return;

      // সাধারণ AI চ্যাট (এজেন্ট লুপ — টুল চিপ/কনফার্ম কার্ডসহ স্ট্রিমিং)
      setMessages([...withUser, { role: 'assistant', content: '' }]);
      setBusy(false);
      setStreaming(true);
      await streamChat(
        withUser,
        delta => {
          setMessages(prev => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            if (last?.role === 'assistant') {
              updated[updated.length - 1] = { ...last, content: last.content + delta };
            }
            return updated;
          });
        },
        {
          onTool: t => setToolChips(prev => (prev.includes(t.label) ? prev : [...prev, t.label])),
          onConfirm: c => {
            if (c.payload?.intent === 'sale' || c.payload?.intent === 'new-product') {
              applyIntentResponse(c.payload, true);
            } else if (c.payload?.intent === 'due-payment') {
              const p = c.payload as { customer: { id: string; name: string; phone: string; dueAmount: number }; amount: number; method: string };
              setDueConfirm({ customer: p.customer, amount: Number(p.amount), method: String(p.method || 'Cash') });
            }
          },
          onDone: list => {
            for (const d of list) {
              setToast({
                text: `✅ ${d.message}`,
                undo:
                  d.undoAvailable && d.undoPayload
                    ? { productId: String(d.undoPayload.productId), quantity: Number(d.undoPayload.quantity) }
                    : undefined,
              });
            }
          },
        }
      );
    } catch (err) {
      showAIError(err);
    } finally {
      setBusy(false);
      setStreaming(false);
    }
  };

  /** এজেন্টের বাকি-আদায় প্রস্তাব — মানুষ কনফার্ম করলেই সম্পন্ন */
  const confirmDuePayment = async () => {
    if (!dueConfirm) return;
    setSubmitting(true);
    try {
      const res = await apiFetch('/api/customers/payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: dueConfirm.customer.id,
          amount: dueConfirm.amount,
          method: dueConfirm.method,
          note: 'AI এজেন্ট (কনফার্মড)',
        }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok) {
        const remaining = data?.customer?.dueAmount ?? Math.max(0, dueConfirm.customer.dueAmount - dueConfirm.amount);
        setMessages(prev => [
          ...prev,
          { role: 'assistant', content: `✅ বাকি আদায় হয়েছে: ${dueConfirm.customer.name} — ৳${dueConfirm.amount.toLocaleString('en-BD')}। বর্তমান বাকি: ৳${Number(remaining).toLocaleString('en-BD')}।` },
        ]);
        setDueConfirm(null);
      } else {
        setToast({ text: `❌ ${data?.error || 'আদায় করা যায়নি'}`, error: true });
      }
    } catch {
      setToast({ text: '❌ সার্ভারে সংযোগ করা যায়নি', error: true });
    } finally {
      setSubmitting(false);
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
      const res = await apiFetch('/api/pos/sale', {
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
      const res = await apiFetch('/api/inventory', {
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
      const res = await apiFetch('/api/products', {
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

  // অ্যাসিস্ট্যান্ট পেজে ফুল চ্যাট + ইনলাইন কনফার্ম আছে — FAB সেখানে লুকাও
  // (hooks-এর নিয়ম: সব hook-এর পরে return — নাহলে পেজ বদলালে ক্র্যাশ করে)
  const pathname = usePathname();
  if (pathname.startsWith('/admin/assistant')) return null;

  return (
    <>
      {/* ভাসমান AI বাটন — ঢুকার সময় ফুল রূপে দেখিয়ে পরে শুধু আইকন */}
      <button
        onClick={() => setOpen(o => !o)}
        className={`fixed bottom-6 right-5 sm:right-8 z-40 group flex items-center rounded-md transition-all duration-500 ${
          open
            ? 'bg-slate-900 text-white px-5 py-3.5 gap-2'
            : introExpanded
            ? 'bg-orange-600 text-white px-5 py-3.5 gap-2'
            : 'bg-orange-600 text-white p-4 gap-0'
        }`}
        aria-label="আপনার এআই সহকারী"
      >
        <AnimatedBotIcon
          strokeWidth={2.4}
          className={`flex-shrink-0 transition-all ${introExpanded ? 'w-6 h-6' : 'w-8 h-8'}`}
        />
        <span
          className={`text-sm font-bold whitespace-nowrap overflow-hidden transition-all duration-500 ${
            introExpanded || open ? 'max-w-[200px] opacity-100' : 'max-w-0 opacity-0'
          }`}
        >
          আপনার এআই সহকারী
        </span>
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
                  প্রশ্ন: <span className="text-slate-600">&quot;সবচেয়ে বেশি বাকি কার?&quot; / &quot;আজ কেমন চলছে?&quot;</span>
                  <br />
                  এজেন্ট নিজে ডেটা খুঁজে, স্টক-খাতা আপডেট করে উত্তর দেবে।
                </p>
              </div>
            )}

            {/* এজেন্ট টুল-চিপ — এজেন্ট এই মুহূর্তে যা দেখছে/করছে */}
            {toolChips.length > 0 && (
              <div className="flex flex-wrap gap-1.5 justify-start">
                {toolChips.map((label, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 rounded-full bg-orange-50 border border-orange-200 text-orange-700 px-2.5 py-1 text-[10px] font-bold"
                  >
                    {label}
                  </span>
                ))}
              </div>
            )}

            {/* এজেন্টের বাকি-আদায় প্রস্তাব — কনফার্মেশন ছাড়া কখনো সম্পন্ন হয় না */}
            {dueConfirm && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-md border border-emerald-200 bg-emerald-50 px-3.5 py-2.5">
                  <p className="text-xs font-bold text-emerald-900">💰 বাকি আদায় কনফার্ম করুন</p>
                  <p className="text-[11px] text-slate-600 mt-1">
                    {dueConfirm.customer.name} ({dueConfirm.customer.phone}) — ৳{dueConfirm.amount.toLocaleString('en-BD')} ({dueConfirm.method})
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">বর্তমান বাকি: ৳{dueConfirm.customer.dueAmount.toLocaleString('en-BD')}</p>
                  <div className="flex gap-2 mt-2">
                    <button
                      onClick={() => void confirmDuePayment()}
                      disabled={submitting}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold px-3 py-1.5 rounded-md text-[11px]"
                    >
                      {submitting ? 'হচ্ছে…' : 'নিশ্চিত করুন'}
                    </button>
                    <button
                      onClick={() => setDueConfirm(null)}
                      className="bg-white border border-slate-300 text-slate-600 font-bold px-3 py-1.5 rounded-md text-[11px]"
                    >
                      বাতিল
                    </button>
                  </div>
                </div>
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
            <button
              onClick={toggleRecording}
              disabled={busy || streaming || voiceBusy}
              title={recording ? 'রেকর্ডিং শেষ করুন' : 'মুখে বলুন — ভয়েস কমান্ড'}
              aria-label="ভয়েস কমান্ড"
              className={`p-2.5 rounded-md transition-colors flex-shrink-0 ${
                recording
                  ? 'bg-red-600 text-white animate-pulse'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              } disabled:opacity-50`}
            >
              {voiceBusy ? (
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin block" />
              ) : recording ? (
                <Square className="w-4 h-4" />
              ) : (
                <Mic className="w-4 h-4" />
              )}
            </button>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
              placeholder={recording ? '🎙️ শুনছি… কথা বলুন' : 'যেমন: JX-SH-101 42 2টি'}
              className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-3.5 py-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500"
              disabled={busy || streaming || recording}
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
            toast.error ? 'bg-red-600 text-white' : 'bg-emerald-600 text-white'
          }`}
        >
          {toast.text}
          {toast.undo && (
            <button
              onClick={undoAutoRestock}
              className="ml-3 px-2.5 py-1 rounded-md bg-white text-emerald-700 font-black text-[10px] hover:bg-emerald-50 transition-colors"
            >
              ↩ আন্ডো
            </button>
          )}
        </div>
      )}
    </>
  );
}

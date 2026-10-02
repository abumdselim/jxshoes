'use client';

/**
 * AI অ্যাসিস্ট্যান্ট — দোকানের নিজস্ব AI চ্যাট পেজ
 * ------------------------------------------------
 * - আসল স্টোর ডেটা (প্রোডাক্ট/অর্ডার/স্টক) সার্ভার-সাইডে প্রম্পটে ইনজেক্ট হয়,
 *   তাই AI আসল সংখ্যা দিয়ে উত্তর দেয়
 * - স্ট্রিমিং উত্তর (সার্ভার SSE)
 * - কুইক চিপ: প্রশ্ন লিখতে না হয়ে এক ক্লিকে প্রশ্ন
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChatMsg, streamChat } from '@/lib/chatClient';
import AnimatedAiIcon from '@/components/admin/AnimatedAiIcon';
import {
  Bot,
  Send,
  TrendingUp,
  Package,
  AlertTriangle,
  Banknote,
  Trash2,
  Mic,
  Square,
  CheckCircle,
} from 'lucide-react';

/** চ্যাট মেসেজে ইনলাইন অ্যাকশন (ভয়েস কমান্ড কনফার্ম করার জন্য) */
interface AssistantMsg extends ChatMsg {
  restockAction?: { productId: string; productName: string; quantity: number };
  saleAction?: { productId: string; productName: string; quantity: number; size?: string; color?: string };
  newProductAction?: {
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
  };
  done?: boolean;
}

const COLOR_HEX: [RegExp, string][] = [
  [/black|কালো/i, '#111827'],
  [/white|সাদা|ক্রিম/i, '#f1f5f9'],
  [/brown|বাদাম/i, '#78350f'],
  [/tan/i, '#b45309'],
  [/navy/i, '#1e3a8a'],
  [/blue|নীল/i, '#2563eb'],
  [/grey|gray|ধূসর/i, '#64748b'],
  [/maroon/i, '#7f1d1d'],
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

const QUICK_QUESTIONS = [
  { label: 'আজকের সেলস কেমন?', icon: TrendingUp },
  { label: 'কোন প্রোডাক্ট বেশি বিক্রি হচ্ছে?', icon: Package },
  { label: 'কোন স্টক শেষ হয়ে যাচ্ছে?', icon: AlertTriangle },
  { label: 'মোট লাভ কত হতে পারে?', icon: Banknote },
];

export default function AdminAssistantPage() {
  const [messages, setMessages] = useState<AssistantMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const voiceChunksRef = useRef<Blob[]>([]);
  const messagesRef = useRef<AssistantMsg[]>([]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

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
          setError('খুব ছোট রেকর্ডিং — আবার চেষ্টা করুন');
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
        setError('মাইক্রোফোনের অনুমতি দেওয়া হয়নি — অ্যাড্রেস বারের বাঁ দিকের মাইক আইকনে ক্লিক করে "Allow" করুন, তারপর আবার চাপুন');
      } else if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        setError('কোনো মাইক্রোফোন পাওয়া যায়নি — ডিভাইস/হেডসেট চেক করুন');
      } else {
        setError(err instanceof Error ? err.message : 'মাইক চালু করা যায়নি');
      }
    }
  };

  const confirmRestock = async (msgIndex: number) => {
    const msg = messagesRef.current[msgIndex];
    const act = msg?.restockAction;
    if (!act || msg.done) return;
    setMessages(prev => {
      const updated = [...prev];
      updated[msgIndex] = { ...updated[msgIndex], done: true };
      return updated;
    });
    try {
      const res = await fetch('/api/inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'restock',
          productId: act.productId,
          quantity: act.quantity,
          note: 'AI ভয়েস রিস্টক (অ্যাসিস্ট্যান্ট)',
        }),
      });
      const data = await res.json().catch(() => null);
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: res.ok && data?.success
            ? `অসাধারণ! ${act.productName} এর স্টক +${act.quantity} হয়েছে — এখন ${data.product?.stockCount ?? '?'} টি`
            : `দুঃখিত — ${data?.error || 'রিস্টক করা যায়নি'}`,
        },
      ]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'সার্ভারে সংযোগ করা যায়নি' }]);
    }
  };

  const confirmSale = async (msgIndex: number) => {
    const msg = messagesRef.current[msgIndex];
    const act = msg && msg.saleAction;
    if (!act || msg.done) return;
    setMessages(prev => {
      const updated = [...prev];
      updated[msgIndex] = { ...updated[msgIndex], done: true };
      return updated;
    });
    try {
      const res = await fetch('/api/pos/sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { productId: act.productId, quantity: act.quantity, size: act.size, color: act.color },
          ],
          note: 'AI ভয়েস বিক্রি (অ্যাসিস্ট্যান্ট)',
        }),
      });
      const data = await res.json().catch(() => null);
      const ok = res.ok && data && data.success;
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: ok
            ? 'বিক্রি সম্পন্ন! অর্ডার ' + data.order.orderNumber + ' — স্টক আপডেট হয়েছে' + (data.order.dueAmount > 0 ? ', বাকি ৳' + data.order.dueAmount : '')
            : 'দুঃখিত — ' + (data && data.error ? data.error : 'বিক্রি করা যায়নি'),
        },
      ]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'সার্ভারে সংযোগ করা যায়নি' }]);
    }
  };

  const confirmNewProduct = async (msgIndex: number) => {
    const msg = messagesRef.current[msgIndex];
    const act = msg && msg.newProductAction;
    if (!act || msg.done) return;
    setMessages(prev => {
      const updated = [...prev];
      updated[msgIndex] = { ...updated[msgIndex], done: true };
      return updated;
    });
    try {
      const sizesArr = act.sizes.split(',').map(x => x.trim()).filter(Boolean);
      const colorsArr = act.colors.split(',').map(x => x.trim()).filter(Boolean).map(name => ({ name: name, hex: colorHex(name) }));
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: act.name,
          category: act.category,
          subCategory: act.subCategory || undefined,
          price: Number(act.price),
          costPrice: Number(act.costPrice) || undefined,
          sizes: sizesArr.length > 0 ? sizesArr : ['Standard'],
          colors: colorsArr.length > 0 ? colorsArr : [{ name: 'Black', hex: '#111827' }],
          stockCount: Number(act.stockCount) || 0,
          minStockAlert: 5,
          supplier: act.supplier || undefined,
          description: act.description || '',
          inStock: (Number(act.stockCount) || 0) > 0,
        }),
      });
      const data = await res.json().catch(() => null);
      const ok = res.ok && data && data.id;
      setMessages(prev => [
        ...prev,
        {
          role: 'assistant',
          content: ok
            ? 'যোগ হয়েছে! ' + data.name + ' — SKU: ' + data.sku + ', স্টক ' + data.stockCount + ' টি'
            : 'দুঃখিত — ' + (data && data.error ? data.error : 'যোগ করা যায়নি'),
        },
      ]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'সার্ভারে সংযোগ করা যায়নি' }]);
    }
  };

  const handleVoiceBlob = async (blob: Blob, mime: string) => {
    setVoiceBusy(true);
    setError(null);
    try {
      const audioB64 = await blobToBase64(blob);
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'voice-intent', audioBase64: audioB64, mimeType: mime }),
      });
      const data = await res.json().catch(() => null);
      if (!data) throw new Error('সার্ভার থেকে সাড়া পাওয়া যায়নি');
      if (data.configured === false) throw new Error(data.error);

      const transcript = (data.transcript as string) || '';
      if (!transcript) throw new Error(data.error || 'কথা শোনা যায়নি — আবার চেষ্টা করুন');

      // চ্যাটে দেখাও AI কী শুনলো
      setMessages(prev => [...prev, { role: 'user', content: '🎙️ "' + transcript + '"' }]);

      // ১) অটো-এক্সিকিউটেড (হুবহু SKU ম্যাচ restock)
      if (data.autoExecuted) {
        const a = data.autoExecuted;
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'স্বয়ংক্রিয়ভাবে সম্পন্ন: ' + a.productName + ' এর স্টক +' + a.quantity + ' — এখন ' + a.newStock + ' টি। (ভুল হলে ইনভেন্টরি পেজ থেকে অ্যাডজাস্ট করুন)',
          },
        ]);
        return;
      }

      // ২) রিস্টক ইনটেন্ট — চ্যাটেই এক-ক্লিক কনফার্ম
      if (data.intent === 'restock' && data.product) {
        const qty = Number(data.quantity) || 1;
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'বুঝেছি — ' + data.product.name + ' এর স্টক ' + qty + ' পিস বাড়াতে হবে। নিশ্চিত?',
            restockAction: { productId: data.product.id, productName: data.product.name, quantity: qty },
          },
        ]);
        return;
      }

      // 3) সেল — চ্যাটেই ক্যাশ-বিক্রি কনফার্ম (বাকি দরকার হলে ভাসমান বাটন, অন্য পেজে)
      if (data.intent === 'sale' && data.match && data.match.matched && data.product) {
        const m = data.match;
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'বুঝেছি — বিক্রি: ' + data.product.name + ' (' + (m.quantity || 1) + 'টি)। পেমেন্ট কীভাবে নিবেন?',
            saleAction: {
              productId: data.product.id,
              productName: data.product.name,
              quantity: m.quantity || 1,
              size: m.size || data.product.sizes[0] || 'Standard',
              color: m.color || (data.product.colors[0] ? data.product.colors[0].name : 'Default'),
            },
          },
        ]);
        return;
      }

      // 4) নতুন পণ্য — চ্যাটেই প্রি-ফিল করা কনফার্ম
      if (data.intent === 'new-product' && data.draft) {
        const d = data.draft;
        setMessages(prev => [
          ...prev,
          {
            role: 'assistant',
            content: 'বুঝেছি — নতুন পণ্য: ' + d.name + ' (৳' + d.price + ', স্টক ' + (d.stockCount || 0) + ')। ইনভেন্টরিতে যোগ করব?',
            newProductAction: {
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
            },
          },
        ]);
        return;
      }      // ৪) সাধারণ প্রশ্ন — AI চ্যাটে উত্তর
      const withUser: AssistantMsg[] = [...messagesRef.current, { role: 'user', content: transcript }];
      setMessages([...withUser, { role: 'assistant', content: '' }]);
      setStreaming(true);
      await streamChat(withUser, delta => {
        setMessages(prev => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          if (last && last.role === 'assistant') {
            updated[updated.length - 1] = { ...last, content: last.content + delta };
          }
          return updated;
        });
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'ভয়েস প্রসেসিং ব্যর্থ');
    } finally {
      setVoiceBusy(false);
    }
  };

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);
    setInput('');

    const withUser: AssistantMsg[] = [...messages, { role: 'user', content: trimmed }];
    setMessages([...withUser, { role: 'assistant', content: '' }]);
    setStreaming(true);

    try {
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
      setError(err instanceof Error ? err.message : 'AI সংযোগে সমস্যা হয়েছে');
      // খালি অ্যাসিস্ট্যান্ট বাবল বাদ দাও
      setMessages(prev => {
        const last = prev[prev.length - 1];
        return last?.role === 'assistant' && !last.content ? prev.slice(0, -1) : prev;
      });
    } finally {
      setStreaming(false);
      inputRef.current?.focus();
    }
  };

  const clearChat = () => {
    if (streaming) return;
    setMessages([]);
    setError(null);
  };

  return (
    <div className="max-w-4xl mx-auto h-full flex flex-col">
      {/* হেডার */}
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-md bg-orange-600 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
              AI অ্যাসিস্ট্যান্ট
            </h1>
            <p className="text-xs text-slate-500">
              আপনার শপের আসল ডেটা দেখে উত্তর দেয় — সেলস, স্টক, অর্ডার, পরামর্শ সব কিছু
            </p>
          </div>
        </div>
        {messages.length > 0 && (
          <button
            onClick={clearChat}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            চ্যাট মুছুন
          </button>
        )}
      </div>

      {/* চ্যাট বক্স */}
      <div className="flex-1 min-h-[400px] flex flex-col bg-white rounded-md border border-slate-200 overflow-hidden">
        {/* মেসেজ এলাকা */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-slate-50/60">
          {messages.length === 0 && (
            <div className="text-center space-y-5 py-12">
              <div className="w-16 h-16 mx-auto rounded-md bg-orange-600 flex items-center justify-center">
                <AnimatedAiIcon className="w-9 h-9 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-slate-900">আপনাকে স্বাগতম!</h2>
                <p className="text-xs text-slate-500 mt-1 leading-relaxed max-w-md mx-auto">
                  আমি আপনার শপের AI সহকারী। বিক্রির হিসাব, স্টকের অবস্থা, বেস্ট-সেলার,
                  পরামর্শ — যা জানতে চাইলে লিখুন। দ্রুত বিক্রি এন্ট্রির জন্য প্রোডাক্ট কোডও
                  পাঠাতে পারেন।
                </p>
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                {QUICK_QUESTIONS.map(q => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={q.label}
                      onClick={() => send(q.label)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-white border border-slate-200 hover:border-orange-400 hover:bg-orange-50 text-xs font-bold text-slate-700 transition-colors"
                    >
                      <Icon className="w-3.5 h-3.5 text-orange-600" />
                      {q.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex flex-wrap gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-md bg-orange-600 flex items-center justify-center flex-shrink-0">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-md px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-orange-600 text-white rounded-br-md'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md'
                }`}
              >
                {m.content ||
                  (streaming && i === messages.length - 1 ? (
                    <span className="inline-flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                    </span>
                  ) : (
                    '…'
                  ))}
              </div>
              {m.restockAction && (
                <button
                  onClick={() => confirmRestock(i)}
                  disabled={m.done}
                  className={'ml-11 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-bold transition-colors ' + (
                    m.done
                      ? 'bg-slate-100 text-slate-400 border border-slate-200'
                      : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                  )}
                >
                  <CheckCircle className="w-4 h-4" />
                  {m.done ? 'সম্পন্ন হয়েছে' : 'রিস্টক নিশ্চিত করুন (' + m.restockAction.quantity + ' পিস)'}
                </button>
              )}
              {m.saleAction && !m.done && (
                <button
                  onClick={() => confirmSale(i)}
                  className="ml-11 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-bold bg-orange-600 hover:bg-orange-700 text-white transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  ক্যাশে বিক্রি নিশ্চিত করুন ({m.saleAction.quantity} পিস)
                </button>
              )}
              {m.newProductAction && !m.done && (
                <button
                  onClick={() => confirmNewProduct(i)}
                  className="ml-11 inline-flex items-center gap-1.5 px-4 py-2.5 rounded-md text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  ইনভেন্টরিতে যোগ করুন
                </button>
              )}
            </div>
          ))}

          {error && (
            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-md p-4 text-xs text-red-700 max-w-lg mx-auto">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="font-bold">{error}</p>
              </div>
            </div>
          )}
        </div>

        {/* ইনপুট */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-2.5 flex-shrink-0">
          <button
            onClick={toggleRecording}
            disabled={streaming || voiceBusy}
            title={recording ? 'রেকর্ডিং শেষ করুন' : 'মুখে বলুন — বাংলা ভয়েস কমান্ড'}
            aria-label="ভয়েস কমান্ড"
            className={'p-3 rounded-md transition-colors flex-shrink-0 ' + (
              recording
                ? 'bg-red-600 text-white animate-pulse'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            ) + ' disabled:opacity-50'}
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
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder={recording ? 'শুনছি… কথা বলুন' : 'প্রশ্ন লিখুন বা প্রোডাক্ট কোড পাঠান…'}
            className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            disabled={streaming || recording}
          />
          <button
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
            className="p-3 rounded-md bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            aria-label="পাঠান"
          >
            {streaming ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin block" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

'use client';

/**
 * AI অ্যাসিস্ট্যান্ট — দোকানের নিজস্ব AI চ্যাট পেজ
 * ------------------------------------------------
 * - আসল স্টোর ডেটা (প্রোডাক্ট/অর্ডার/স্টক) সার্ভার-সাইডে প্রম্পটে ইনজেক্ট হয়,
 *   তাই AI আসল সংখ্যা দিয়ে উত্তর দেয়
 * - স্ট্রিমিং উত্তর (Workers AI SSE)
 * - কুইক চিপ: প্রশ্ন লিখতে না হয়ে এক ক্লিকে প্রশ্ন
 */

import React, { useEffect, useRef, useState } from 'react';
import { ChatMsg, streamChat } from '@/lib/chatClient';
import {
  Bot,
  Send,
  Sparkles,
  TrendingUp,
  Package,
  AlertTriangle,
  Banknote,
  Trash2,
} from 'lucide-react';

const QUICK_QUESTIONS = [
  { label: 'আজকের সেলস কেমন?', icon: TrendingUp },
  { label: 'কোন প্রোডাক্ট বেশি বিক্রি হচ্ছে?', icon: Package },
  { label: 'কোন স্টক শেষ হয়ে যাচ্ছে?', icon: AlertTriangle },
  { label: 'মোট লাভ কত হতে পারে?', icon: Banknote },
];

export default function AdminAssistantPage() {
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const send = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || streaming) return;
    setError(null);
    setInput('');

    const withUser: ChatMsg[] = [...messages, { role: 'user', content: trimmed }];
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
          <div className="w-11 h-11 rounded-2xl bg-orange-600 flex items-center justify-center shadow-lg shadow-orange-600/30">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
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
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white text-slate-600 text-xs font-bold hover:bg-slate-50"
          >
            <Trash2 className="w-3.5 h-3.5" />
            চ্যাট মুছুন
          </button>
        )}
      </div>

      {/* চ্যাট বক্স */}
      <div className="flex-1 min-h-[400px] flex flex-col bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
        {/* মেসেজ এলাকা */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4 bg-slate-50/60">
          {messages.length === 0 && (
            <div className="text-center space-y-5 py-12">
              <div className="w-16 h-16 mx-auto rounded-3xl bg-orange-600 flex items-center justify-center shadow-xl shadow-orange-600/30">
                <Sparkles className="w-8 h-8 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">আপনাকে স্বাগতম!</h2>
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
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-white border border-slate-200 hover:border-orange-400 hover:bg-orange-50 text-xs font-bold text-slate-700 transition-colors"
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
            <div key={i} className={`flex gap-3 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {m.role === 'assistant' && (
                <div className="w-8 h-8 rounded-xl bg-orange-600 flex items-center justify-center flex-shrink-0 shadow-md">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.role === 'user'
                    ? 'bg-orange-600 text-white rounded-br-md shadow-md shadow-orange-600/20'
                    : 'bg-white border border-slate-200 text-slate-700 rounded-bl-md shadow-sm'
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
            </div>
          ))}

          {error && (
            <div className="flex gap-2 bg-red-50 border border-red-200 rounded-2xl p-4 text-xs text-red-700 max-w-lg mx-auto">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              <div>
                <p className="font-bold">{error}</p>
                <p className="mt-1 opacity-80">
                  AI কনফিগার করতে: Cloudflare API টোকেনে &quot;Workers AI → Write&quot; পারমিশন
                  যোগ করুন, তারপর ডিপ্লয় করুন।
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ইনপুট */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center gap-2.5 flex-shrink-0">
          <input
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && send(input)}
            placeholder="প্রশ্ন লিখুন বা প্রোডাক্ট কোড পাঠান…"
            className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
            disabled={streaming}
          />
          <button
            onClick={() => send(input)}
            disabled={streaming || !input.trim()}
            className="p-3 rounded-xl bg-orange-600 hover:bg-orange-700 text-white disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-orange-600/30 transition-colors"
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

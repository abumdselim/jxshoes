'use client';

/**
 * মতামত ও অভিযোগ ফর্ম — লাইভ ওয়েবসাইটের ফুটারে থাকে;
 * জমা হলে অ্যাডমিন প্যানেলের নোটিফিকেশনে সরাসরি পৌঁছায়।
 */

import React, { useState } from 'react';
import { Send, Loader2, CheckCircle2 } from 'lucide-react';

export default function FeedbackForm() {
  const [type, setType] = useState<'feedback' | 'complaint'>('feedback');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) {
      setError('বার্তাটা লিখুন');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, name, phone, message }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.ok) {
        setSent(true);
        setMessage('');
        setName('');
        setPhone('');
        setTimeout(() => setSent(false), 6000);
      } else {
        setError(data?.error || 'পাঠানো যায়নি — একটু পরে আবার চেষ্টা করুন');
      }
    } catch {
      setError('সংযোগ ব্যর্থ হয়েছে');
    } finally {
      setSending(false);
    }
  };

  const inputCls =
    'w-full bg-slate-800/80 border border-slate-700 rounded-md px-3.5 py-2.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-orange-500';

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        {([
          { v: 'feedback', label: 'পরামর্শ' },
          { v: 'complaint', label: 'অভিযোগ' },
        ] as const).map(o => (
          <button
            key={o.v}
            type="button"
            onClick={() => setType(o.v)}
            className={`flex-1 px-3 py-2 rounded-md text-xs font-bold border transition-colors ${
              type === o.v
                ? 'bg-orange-600 border-orange-600 text-white'
                : 'bg-slate-800/80 border-slate-700 text-slate-300 hover:border-slate-600'
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="আপনার নাম (ঐচ্ছিক)"
          className={inputCls}
          maxLength={60}
        />
        <input
          type="tel"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="ফোন (ঐচ্ছিক)"
          className={inputCls}
          maxLength={20}
        />
      </div>

      <textarea
        rows={3}
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder={
          type === 'complaint'
            ? 'আপনার অভিযোগটা বিস্তারিত লিখুন…'
            : 'শপ বা সার্ভিস নিয়ে আপনার পরামর্শ লিখুন…'
        }
        className={`${inputCls} resize-none`}
        maxLength={1000}
        required
      />

      <button
        type="submit"
        disabled={sending}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-md bg-orange-600 hover:bg-orange-700 disabled:opacity-60 text-white text-xs font-bold transition-colors"
      >
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {sending ? 'পাঠানো হচ্ছে…' : 'পাঠিয়ে দিন'}
      </button>

      {sent && (
        <p className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-400">
          <CheckCircle2 className="w-3.5 h-3.5" /> ধন্যবাদ! আপনার কথা ম্যানেজমেন্টের কাছে পৌঁছে গেছে।
        </p>
      )}
      {error && <p className="text-[11px] font-bold text-red-400">{error}</p>}
    </form>
  );
}

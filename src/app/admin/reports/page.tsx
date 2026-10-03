'use client';

/**
 * AI বিজনেস রিপোর্ট
 * ------------------
 * - সাপ্তাহিক/মাসিক রিপোর্ট AI দিয়ে তৈরি (আসল ডেটা → নিখুঁত স্কোরকার্ড + AI বিশ্লেষণ)
 * - হিস্ট্রি সার্ভারে থাকে, যেকোনো সময় দেখা/প্রিন্ট/ইমেইল করা যায়
 * - Cron Worker সেট আপ করলে রিপোর্ট অটো তৈরি হয়ে ইমেইলে যাবে (docs/ROADMAP.md)
 */

import React, { useEffect, useState } from 'react';
import { StoredReport } from '@/types';
import { formatDate } from '@/lib/utils';
import {
  FileText,
  Sparkles,
  Send,
  Printer,
  CalendarDays,
  CheckCircle,
  AlertTriangle,
  Lightbulb,
  History,
  Mail,
} from 'lucide-react';
import { apiFetch } from '@/lib/offline/apiFetch';

export default function AdminReportsPage() {
  const [reports, setReports] = useState<StoredReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<'weekly' | 'monthly' | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [selected, setSelected] = useState<StoredReport | null>(null);
  const [emailing, setEmailing] = useState(false);
  const [emailTo, setEmailTo] = useState('');
  const [emailMsg, setEmailMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const loadReports = async () => {
    try {
      const res = await apiFetch('/api/reports');
      if (res.ok) {
        const data = await res.json();
        setReports(Array.isArray(data) ? data : []);
        setSelected(prev => prev && data.find((r: StoredReport) => r.id === prev.id) || data[0] || null);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReports();
    apiFetch('/api/settings')
      .then(r => (r.ok ? r.json() : null))
      .then(s => s?.email && setEmailTo(s.email))
      .catch(() => {});
  }, []);

  const generate = async (type: 'weekly' | 'monthly') => {
    setGenerating(type);
    setGenError(null);
    try {
      const res = await apiFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'generate-report', reportType: type }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.report) {
        setSelected(data.report);
        loadReports();
      } else {
        setGenError(data?.error || 'রিপোর্ট তৈরি করা যায়নি');
      }
    } catch {
      setGenError('সার্ভারে সংযোগ করা যায়নি');
    } finally {
      setGenerating(null);
    }
  };

  const sendEmail = async () => {
    if (!selected || emailing) return;
    setEmailing(true);
    setEmailMsg(null);
    try {
      const res = await apiFetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'email-report', reportId: selected.id, to: emailTo || undefined }),
      });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setEmailMsg({ text: `✅ রিপোর্ট ${data.to}-এ পাঠানো হয়েছে` });
        loadReports();
      } else {
        setEmailMsg({ text: `⚠️ ${data?.error || 'পাঠানো যায়নি'}`, error: true });
      }
    } catch {
      setEmailMsg({ text: '⚠️ সার্ভারে সংযোগ করা যায়নি', error: true });
    } finally {
      setEmailing(false);
      setTimeout(() => setEmailMsg(null), 6000);
    }
  };

  const printReport = () => {
    if (!selected) return;
    const w = window.open('', '_blank', 'width=860,height=940');
    if (!w) return;
    const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const scorecard = selected.scorecard
      .map(s => `<div class="card"><div class="lbl">${esc(s.label)}</div><div class="val">${esc(s.value)}</div></div>`)
      .join('');
    const sections = selected.sections
      .map(
        s => `<h3>${esc(s.title)}</h3><p>${esc(s.body).replace(/\n/g, '<br/>')}</p>${(s.highlights || [])
          .map(h => `<p class="hl">• ${esc(h)}</p>`)
          .join('')}`
      )
      .join('');
    const recs = selected.recommendations.map(r => `<li>${esc(r)}</li>`).join('');

    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(selected.headline)}</title>
<style>
body{font-family:'Segoe UI',Arial,sans-serif;color:#0f172a;padding:28px;max-width:760px;margin:0 auto;}
.head{border-bottom:3px solid #ea580c;padding-bottom:12px;margin-bottom:16px;}
.head h1{font-size:20px;margin:0 0 4px;}
.head .meta{font-size:11px;color:#64748b;}
.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin:14px 0;}
.card{border:1px solid #e2e8f0;border-radius:10px;padding:10px;text-align:center;background:#f8fafc;}
.lbl{font-size:10px;color:#64748b;font-weight:700;}
.val{font-size:14px;font-weight:800;margin-top:3px;}
h3{color:#c2410c;font-size:14px;margin:16px 0 4px;}
p{font-size:12.5px;line-height:1.7;color:#334155;margin:4px 0;}
.hl{color:#0f766e;font-weight:600;}
.recs{background:#0f172a;color:#e2e8f0;border-radius:12px;padding:14px 18px;margin-top:16px;}
.recs h3{color:#fb923c;margin-top:0;}
.recs li{font-size:12px;margin:4px 0;}
.foot{font-size:10px;color:#94a3b8;margin-top:20px;}
</style></head><body>
<div class="head"><h1>${esc(selected.headline)}</h1><div class="meta">${esc(
      selected.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'
    )} রিপোর্ট • ${new Date(selected.periodStart).toLocaleDateString('en-CA')} → ${new Date(
      selected.periodEnd
    ).toLocaleDateString('en-CA')}</div></div>
<p>${esc(selected.executiveSummary)}</p>
<div class="grid">${scorecard}</div>
${sections}
${recs ? `<div class="recs"><h3>AI-এর পরামর্শ</h3><ul>${recs}</ul></div>` : ''}
<div class="foot">AI দ্বারা তৈরি — ${new Date(selected.generatedAt).toLocaleString('bn-BD')}</div>
</body></html>`);
    w.document.close();
    w.focus();
    w.print();
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
      <div className="sticky top-14 md:top-0 z-20 bg-slate-200 rounded-md border border-slate-200/80 px-4 sm:px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">AI বিজনেস রিপোর্ট</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            নিখুঁত সংখ্যা (কোড থেকে) + AI বিশ্লেষণ — সাপ্তাহিক ও মাসিক পূর্ণাঙ্গ রিপোর্ট।
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => generate('weekly')}
            disabled={generating !== null}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold transition-colors disabled:opacity-60"
          >
            {generating === 'weekly' ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <CalendarDays className="w-4 h-4" />
            )}
            সাপ্তাহিক রিপোর্ট
          </button>
          <button
            onClick={() => generate('monthly')}
            disabled={generating !== null}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-md bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold transition-all disabled:opacity-60"
          >
            {generating === 'monthly' ? (
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Sparkles className="w-4 h-4" />
            )}
            মাসিক রিপোর্ট
          </button>
        </div>
      </div>

      {generating && (
        <div className="bg-white rounded-md border border-slate-200 p-5 flex items-center gap-3 text-sm text-slate-600">
          <span className="w-5 h-5 border-2 border-orange-600 border-t-transparent rounded-full animate-spin shrink-0" />
          AI আপনার পুরো হিসাব মিলিয়ে রিপোর্ট লিখছে… প্রায় ২০-৩০ সেকেন্ড লাগতে পারে।
        </div>
      )}

      {genError && (
        <div className="bg-amber-50 border border-amber-200 rounded-md p-4 text-xs text-amber-800 font-bold">
          ⚠️ {genError}
        </div>
      )}

      {emailMsg && (
        <div
          className={`rounded-md p-4 text-xs font-bold border ${
            emailMsg.error
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-700'
          }`}
        >
          {emailMsg.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* হিস্ট্রি */}
        <div className="bg-white rounded-md border border-slate-200/80 p-5 space-y-2 max-h-[70vh] overflow-y-auto">
          <h2 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <History className="w-3.5 h-3.5" /> রিপোর্ট হিস্ট্রি
          </h2>
          {reports.map(r => (
            <button
              key={r.id}
              onClick={() => setSelected(r)}
              className={`w-full text-left px-4 py-3 rounded-md border transition-all ${
                selected?.id === r.id
                  ? 'border-orange-400 bg-orange-50'
                  : 'border-slate-100 bg-slate-50 hover:border-orange-200'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-800">
                  {r.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'} রিপোর্ট
                </span>
                {r.emailedTo && (
                  <span title={r.emailedTo}>
                    <Mail className="w-3.5 h-3.5 text-emerald-500" />
                  </span>
                )}
              </div>
              <div className="text-[10px] text-slate-500 mt-1">{formatDate(r.generatedAt)}</div>
              <div className="text-[11px] text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">{r.headline}</div>
            </button>
          ))}
          {reports.length === 0 && (
            <p className="text-xs text-slate-400 py-6 text-center">
              এখনো কোনো রিপোর্ট নেই। উপরের বাটনে চেপে প্রথম রিপোর্ট বানান।
            </p>
          )}
        </div>

        {/* রিপোর্ট ভিউয়ার */}
        <div className="lg:col-span-2">
          {selected ? (
            <div className="bg-white rounded-md border border-slate-200/80 overflow-hidden print:">
              {/* টুলবার */}
              <div className="bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between no-print">
                <div className="flex items-center gap-2 text-xs font-bold">
                  <FileText className="w-4 h-4 text-orange-400" />
                  {selected.type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'} রিপোর্ট
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={printReport}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 text-[11px] font-bold"
                  >
                    <Printer className="w-3.5 h-3.5" /> প্রিন্ট
                  </button>
                </div>
              </div>

              <div className="p-6 sm:p-8 space-y-6">
                {/* হেড */}
                <div>
                  <h2 className="text-xl font-bold text-slate-900">{selected.headline}</h2>
                  <p className="text-[11px] text-slate-400 mt-1">
                    {new Date(selected.periodStart).toLocaleDateString('en-CA')} →{' '}
                    {new Date(selected.periodEnd).toLocaleDateString('en-CA')}
                  </p>
                  <p className="text-sm text-slate-600 leading-relaxed mt-3">{selected.executiveSummary}</p>
                </div>

                {/* স্কোরকার্ড */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {selected.scorecard.map(s => (
                    <div key={s.label} className="bg-slate-50 border border-slate-100 rounded-md p-3.5 text-center">
                      <div className="text-[10px] font-bold text-slate-500">{s.label}</div>
                      <div className="text-sm font-bold text-slate-900 mt-1">{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* সেকশন */}
                {selected.sections.map((sec, i) => (
                  <div key={i}>
                    <h3 className="font-bold text-sm text-orange-700">{sec.title}</h3>
                    <p className="text-sm text-slate-600 leading-relaxed mt-1.5 whitespace-pre-wrap">{sec.body}</p>
                    {(sec.highlights || []).length > 0 && (
                      <ul className="mt-2.5 space-y-1.5">
                        {(sec.highlights || []).map((h, j) => (
                          <li key={j} className="text-xs text-teal-700 font-bold flex gap-2">
                            <CheckCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            {h}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}

                {/* পরামর্শ */}
                {selected.recommendations.length > 0 && (
                  <div className="bg-slate-900 rounded-md p-5">
                    <h3 className="text-[11px] font-bold text-orange-300 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                      <Lightbulb className="w-4 h-4" /> AI-এর পরামর্শ — পরের সময়ের জন্য
                    </h3>
                    <ul className="space-y-2">
                      {selected.recommendations.map((r, i) => (
                        <li key={i} className="text-xs text-slate-200 flex gap-2">
                          <span className="w-1.5 h-1.5 bg-orange-400 rounded-full shrink-0 mt-1.5" />
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* ইমেইল */}
                <div className="border-t border-slate-100 pt-5 no-print">
                  <h3 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                    <Send className="w-3.5 h-3.5" /> এই রিপোর্ট ইমেইলে পাঠান
                  </h3>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      value={emailTo}
                      onChange={e => setEmailTo(e.target.value)}
                      placeholder="prapok@example.com (সেটিংস থেকে ডিফল্ট)"
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-md px-4 py-2.5 text-xs focus:outline-hidden focus:ring-2 focus:ring-orange-500"
                    />
                    <button
                      onClick={sendEmail}
                      disabled={emailing || !selected}
                      className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold disabled:opacity-50"
                    >
                      {emailing ? (
                        <span className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      ইমেইল পাঠান
                    </button>
                  </div>
                  {selected.emailedTo && (
                    <p className="text-[11px] text-emerald-600 font-bold mt-2 flex items-center gap-1">
                      <CheckCircle className="w-3 h-3" /> শেষ পাঠানো হয়েছে: {selected.emailedTo}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-md border border-slate-200/80 p-12 text-center">
              <FileText className="w-12 h-12 mx-auto text-slate-200 mb-4" />
              <h3 className="font-bold text-slate-700">কোনো রিপোর্ট সিলেক্ট করা নেই</h3>
              <p className="text-xs text-slate-400 mt-2 max-w-sm mx-auto leading-relaxed">
                উপরের বাটন দিয়ে সাপ্তাহিক বা মাসিক রিপোর্ট বানান — দোকানের আসল হিসাব থেকে
                AI বিশ্লেষণ লিখে দেবে। Cron Worker সেটআপ করলে প্রতি সপ্তাহ/মাসে অটোমেটিক
                তৈরি হয়ে ইমেইলেও যাবে (docs/ROADMAP.md দেখুন)।
              </p>
              <div className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <AlertTriangle className="w-3.5 h-3.5" />
                রিপোর্ট ইমেইল করতে সার্ভারে ইমেইল সেন্ডিং সেটআপ লাগবে
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

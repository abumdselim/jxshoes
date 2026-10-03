'use client';

/**
 * অ্যাডমিন চার্ট সেট — ফ্ল্যাট কর্পোরেট ডিজাইন (কোনো লাইব্রেরি নেই, খাঁটি SVG)
 * - TrendChart: লাইন + হালকা এরিয়া ফিল, গ্রিডলাইন, নেটিভ টুলটিপ
 * - DonutChart: সেগমেন্ট ডোনাট + কালার লেজেন্ড
 * - BarList: হরাইজন্টাল বার র‍্যাংকিং
 */

import React, { useEffect, useState } from 'react';

export interface TrendPoint {
  label: string; // তারিখ (টুলটিপ/অক্ষ)
  value: number;
}

export function TrendChart({ data, color = '#ea580c', height = 200 }: { data: TrendPoint[]; color?: string; height?: number }) {
  if (data.length < 2) {
    return (
      <div className="h-40 flex items-center justify-center text-xs text-slate-400">
        চার্টের জন্য যথেষ্ট ডেটা নেই
      </div>
    );
  }

  const W = 760;
  const H = height;
  const P = { t: 14, r: 10, b: 26, l: 52 };
  const iw = W - P.l - P.r;
  const ih = H - P.t - P.b;
  const max = Math.max(...data.map(d => d.value), 1);
  const niceMax = Math.ceil(max / 1000) * 1000 || 1;

  const x = (i: number) => P.l + (i / (data.length - 1)) * iw;
  const y = (v: number) => P.t + ih - (v / niceMax) * ih;

  const line = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(d.value).toFixed(1)}`).join(' ');
  const area = `${line} L${x(data.length - 1).toFixed(1)},${(P.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(P.t + ih).toFixed(1)} Z`;

  const gridVals = [0, niceMax / 2, niceMax];
  const labelEvery = Math.max(1, Math.floor(data.length / 6));

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img">
      {/* গ্রিড */}
      {gridVals.map((v, i) => (
        <g key={i}>
          <line x1={P.l} x2={W - P.r} y1={y(v)} y2={y(v)} stroke="#e2e8f0" strokeWidth="1" strokeDasharray={v === 0 ? '' : '4 4'} />
          <text x={P.l - 8} y={y(v) + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
            {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
          </text>
        </g>
      ))}

      {/* এরিয়া + লাইন (ফ্ল্যাট সলিড, লো-অপাসিটি ফিল) — লাইনটা আঁকা হয় ধীরে */}
      <path d={area} fill={color} fillOpacity="0.08" className="animate-fade-in" style={{ animationDelay: '0.35s' }} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeLinejoin="round"
        strokeLinecap="round"
        pathLength={1}
        strokeDasharray={1}
        className="chart-draw"
      />

      {/* পয়েন্ট + নেটিভ টুলটিপ */}
      {data.map((d, i) => (
        <circle key={i} cx={x(i)} cy={y(d.value)} r={i === data.length - 1 ? 4 : 2.5} fill={color} className="chart-points">
          <title>{`${d.label}: ৳${d.value.toLocaleString('en-BD')}`}</title>
        </circle>
      ))}

      {/* x-অক্ষ লেবেল */}
      {data.map((d, i) =>
        i % labelEvery === 0 || i === data.length - 1 ? (
          <text key={i} x={x(i)} y={H - 8} textAnchor="middle" fontSize="9" fill="#94a3b8">
            {d.label.slice(5)}
          </text>
        ) : null
      )}
    </svg>
  );
}

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function DonutChart({ segments, centerLabel, centerValue }: { segments: DonutSegment[]; centerLabel: string; centerValue: string }) {
  // মাউন্টের পর সেগমেন্টগুলো ০ থেকে সাইজে সুইপ করে ভরে ওঠে
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const total = segments.reduce((s, x) => s + x.value, 0);
  const R = 60;
  const C = 2 * Math.PI * R;
  let offset = 0;

  return (
    <div className="flex items-center gap-5">
      <svg viewBox="0 0 160 160" className="w-36 h-36 shrink-0 -rotate-90 animate-fade-in">
        <circle cx="80" cy="80" r={R} fill="none" stroke="#e2e8f0" strokeWidth="24" />
        {total > 0 &&
          segments.map((s, i) => {
            const frac = s.value / total;
            const dash = frac * C;
            const el = (
              <circle
                key={i}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke={s.color}
                strokeWidth="24"
                strokeDasharray={on ? `${dash} ${C - dash}` : `0 ${C}`}
                strokeDashoffset={-offset}
                className="donut-seg"
                style={{
                  transition: 'stroke-dasharray 0.9s cubic-bezier(0.22, 1, 0.36, 1)',
                  transitionDelay: `${i * 100}ms`,
                }}
              >
                <title>{`${s.label}: ${s.value.toLocaleString('en-BD')} (${Math.round(frac * 100)}%)`}</title>
              </circle>
            );
            offset += dash;
            return el;
          })}
      </svg>
      <div className="space-y-2 min-w-0">
        <div className="mb-1">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{centerLabel}</div>
          <div className="text-lg font-bold text-slate-900">{centerValue}</div>
        </div>
        {segments.map((s, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <span className="w-2.5 h-2.5 rounded-xs shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-slate-600 truncate">{s.label}</span>
            <span className="ml-auto font-bold text-slate-900 whitespace-nowrap">
              {s.value.toLocaleString('en-BD')}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export interface BarItem {
  label: string;
  value: number;
  display: string;
}

export function BarList({ items, color = '#ea580c', muted = '#94a3b8' }: { items: BarItem[]; color?: string; muted?: string }) {
  // মাউন্টের পর বারগুলো ০ থেকে ভরে ওঠে
  const [on, setOn] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const max = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="space-y-3">
      {items.map((it, i) => (
        <div key={i}>
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-bold text-slate-700 truncate pr-2">{i + 1}. {it.label}</span>
            <span className="font-bold text-slate-900 whitespace-nowrap">{it.display}</span>
          </div>
          <div className="h-2 bg-slate-100 rounded-xs overflow-hidden">
            <div
              className="bar-fill h-full rounded-xs"
              style={{
                width: on ? `${Math.max((it.value / max) * 100, 2)}%` : '0%',
                backgroundColor: i === 0 ? color : muted,
                transition: 'width 0.8s cubic-bezier(0.22, 1, 0.36, 1)',
                transitionDelay: `${i * 80}ms`,
              }}
            />
          </div>
        </div>
      ))}
      {items.length === 0 && <p className="text-xs text-slate-400 py-3 text-center">ডেটা নেই</p>}
    </div>
  );
}

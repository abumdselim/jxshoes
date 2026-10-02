'use client';

/**
 * ইমেজ এডিটর — খাঁটি ক্যানভাস, কোনো লাইব্রেরি নেই
 * ------------------------------------------------
 * টুলস: ফ্রি ক্রপ (৮-হ্যান্ডেল + রেশিও প্রিসেট), যেকোনো ডিগ্রিতে ফ্রি রোটেট,
 * ফ্লিপ H/V, কালার ব্যালেন্স (উজ্জ্বলতা/কনট্রাস্ট/স্যাচুরেশন/উষ্ণতা), সব রিসেট।
 * পাইপলাইন: ক্রপ (মূল ছবির কোঅর্ডিনেটে) → রোটেট+ফ্লিপ → কালার ফিল্টার → উষ্ণতা ওভারলে।
 * প্রিভিউ ও এক্সপোর্ট একই হিসাব ব্যবহার করে — যা দেখা যায়, সেভ হওয়ার পরও তা-ই।
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  RotateCcw,
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Crop as CropIcon,
  Check,
  SlidersHorizontal,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

export interface ImageEditorProps {
  src: string;
  onClose: () => void;
  onSave: (dataUrl: string) => void;
}

interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Adjustments {
  brightness: number; // %
  contrast: number; // %
  saturate: number; // %
  warmth: number; // -100 (শীতল) .. 100 (উষ্ণ)
}

const DEFAULT_ADJ: Adjustments = { brightness: 100, contrast: 100, saturate: 100, warmth: 0 };
const MAX_EXPORT_SIDE = 2400; // এক্সপোর্টের সর্বোচ্চ পাশ — ডেটা-URI যুক্তিসঙ্গত রাখতে
const HANDLE = 10; // ক্রপ হ্যান্ডেলের আকার (px)
const MIN_CROP_PX = 36; // ডিসপ্লে স্পেসে সর্বনিম্ন ক্রপ

type HandleId = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

export default function ImageEditor({ src, onClose, onSave }: ImageEditorProps) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'tainted' | 'error'>('loading');
  const [rotation, setRotation] = useState(0);
  const [flipH, setFlipH] = useState(false);
  const [flipV, setFlipV] = useState(false);
  const [adj, setAdj] = useState<Adjustments>(DEFAULT_ADJ);
  const [crop, setCrop] = useState<CropRect | null>(null); // মূল ছবির ন্যাচারাল px-এ
  const [cropMode, setCropMode] = useState(false);
  const [aspect, setAspect] = useState<number | null>(null); // w/h, null = ফ্রি
  const [displayRect, setDisplayRect] = useState<CropRect | null>(null); // ফিট-করা ডিসপ্লে px-এ
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cropBoxRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ mode: 'move' | HandleId; startX: number; startY: number; rect: CropRect } | null>(null);

  /* ── ছবি লোড (ক্রস-অরিজিন হলে anonymous চেষ্টা, না হলে tainted হিসেবে চলবে) ── */
  useEffect(() => {
    let cancelled = false;
    const load = (crossOrigin: boolean, isRetry: boolean) => {
      const image = new Image();
      if (crossOrigin) image.crossOrigin = 'anonymous';
      image.onload = () => {
        if (cancelled) return;
        setImg(image);
        setLoadState(isRetry ? 'tainted' : 'ready');
      };
      image.onerror = () => {
        if (cancelled) return;
        if (crossOrigin) load(false, true);
        else setLoadState('error');
      };
      image.src = src;
    };
    load(true, false);
    return () => {
      cancelled = true;
    };
  }, [src]);

  /* ── উৎস রেক্ট (ক্রপ ছাড়া পুরো ছবি) ── */
  const source = useMemo(() => {
    if (!img) return null;
    const c = crop ?? { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
    return c;
  }, [img, crop]);

  /* ── রোটেটের পরে আউটপুট বাউন্ডিং বক্স ── */
  const outBox = useMemo(() => {
    if (!source) return null;
    const rad = (rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    return {
      w: source.w * cos + source.h * sin,
      h: source.w * sin + source.h * cos,
    };
  }, [source, rotation]);

  /* ── প্রিভিউ ক্যানভাস রেন্ডার ── */
  useEffect(() => {
    if (!img || !source || !outBox || cropMode || loadState === 'error') return;
    const canvas = canvasRef.current;
    if (!canvas) return;

    const maxW = Math.min(760, window.innerWidth - 48);
    const maxH = window.innerHeight - 280;
    const scale = Math.min(maxW / outBox.w, maxH / outBox.h, 1);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(outBox.w * scale * dpr));
    canvas.height = Math.max(1, Math.round(outBox.h * scale * dpr));
    canvas.style.width = `${Math.round(outBox.w * scale)}px`;
    canvas.style.height = `${Math.round(outBox.h * scale)}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.scale(dpr, dpr);
    ctx.filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturate}%)`;
    ctx.translate((outBox.w * scale) / 2, (outBox.h * scale) / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
    ctx.drawImage(img, source.x, source.y, source.w, source.h, (-source.w * scale) / 2, (-source.h * scale) / 2, source.w * scale, source.h * scale);
    ctx.restore();

    // উষ্ণতা: soft-light ওভারলে (উষ্ণ = কমলা, শীতল = নীল)
    if (adj.warmth !== 0) {
      ctx.save();
      ctx.globalCompositeOperation = 'soft-light';
      ctx.globalAlpha = Math.min(Math.abs(adj.warmth) / 100, 1) * 0.55;
      ctx.fillStyle = adj.warmth > 0 ? 'rgb(255,140,40)' : 'rgb(40,120,255)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
    }
  }, [img, source, outBox, rotation, flipH, flipV, adj, cropMode, loadState]);

  /* ── ক্রপ মোড: ফিট-করা ছবির মাপ ── */
  const fitted = useMemo(() => {
    if (!img) return null;
    const maxW = Math.min(760, window.innerWidth - 48);
    const maxH = window.innerHeight - 320;
    const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight, 1);
    return { w: img.naturalWidth * scale, h: img.naturalHeight * scale, scale };
  }, [img]);

  // ক্রপ মোডে ঢুকলে/রেশিও বদলালে ডিসপ্লে-রেক্ট রিফিট
  useEffect(() => {
    if (!cropMode || !img || !fitted) return;
    const r = displayRect;
    if (r && r.w > 0 && r.h > 0 && r.x + r.w <= fitted.w + 2 && r.y + r.h <= fitted.h + 2) return; // বিদ্যমান রেক্ট ধরে রাখা
    const w = fitted.w * 0.8;
    const h = aspect ? w / aspect : fitted.h * 0.8;
    setDisplayRect({
      x: Math.max(0, (fitted.w - w) / 2),
      y: Math.max(0, (fitted.h - Math.min(h, fitted.h)) / 2),
      w: Math.min(w, fitted.w),
      h: Math.min(h, fitted.h),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cropMode, img, fitted, aspect]);

  const clampRect = useCallback(
    (r: CropRect): CropRect => {
      if (!fitted) return r;
      const w = Math.min(Math.max(r.w, MIN_CROP_PX), fitted.w);
      const h = Math.min(Math.max(r.h, MIN_CROP_PX), fitted.h);
      return {
        x: Math.min(Math.max(r.x, 0), fitted.w - w),
        y: Math.min(Math.max(r.y, 0), fitted.h - h),
        w,
        h,
      };
    },
    [fitted]
  );

  const onCropPointerDown = (mode: 'move' | HandleId) => (e: React.PointerEvent) => {
    if (!displayRect) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, rect: { ...displayRect } };
  };

  const onCropPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag || !displayRect || !fitted) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const r0 = drag.rect;
    let { x, y, w, h } = r0;

    if (drag.mode === 'move') {
      x = Math.min(Math.max(r0.x + dx, 0), fitted.w - r0.w);
      y = Math.min(Math.max(r0.y + dy, 0), fitted.h - r0.h);
    } else {
      const m = drag.mode;
      let left = r0.x;
      let top = r0.y;
      let right = r0.x + r0.w;
      let bottom = r0.y + r0.h;
      if (m.includes('w')) left = Math.min(Math.max(r0.x + dx, 0), right - MIN_CROP_PX);
      if (m.includes('e')) right = Math.min(Math.max(r0.x + r0.w + dx, left + MIN_CROP_PX), fitted.w);
      if (m.includes('n')) top = Math.min(Math.max(r0.y + dy, 0), bottom - MIN_CROP_PX);
      if (m.includes('s')) bottom = Math.min(Math.max(r0.y + r0.h + dy, top + MIN_CROP_PX), fitted.h);
      x = left;
      y = top;
      w = right - left;
      h = bottom - top;
      if (aspect) {
        // রেশিও লক — হ্যান্ডেল অনুযায়ী অ্যাংকর রেখে মাপ বসানো
        if (m === 'n' || m === 's') {
          w = Math.min(h * aspect, fitted.w);
          h = w / aspect;
        } else {
          h = Math.min(w / aspect, fitted.h);
          w = h * aspect;
        }
        const anchorRight = m.includes('w');
        const anchorBottom = m.includes('n');
        x = anchorRight ? right - w : left;
        y = anchorBottom ? bottom - h : top;
        if (x < 0) { x = 0; w = Math.min(fitted.w, w); h = w / aspect; }
        if (y < 0) { y = 0; h = Math.min(fitted.h, h); w = h * aspect; }
        if (x + w > fitted.w) { w = fitted.w - x; h = w / aspect; }
        if (y + h > fitted.h) { h = fitted.h - y; w = h * aspect; }
      }
    }
    setDisplayRect({ x, y, w, h });
  };

  const endCropDrag = () => {
    dragRef.current = null;
  };

  const applyCrop = () => {
    if (!displayRect || !fitted || !img) return;
    const s = fitted.scale;
    setCrop({
      x: Math.round(displayRect.x / s),
      y: Math.round(displayRect.y / s),
      w: Math.round(displayRect.w / s),
      h: Math.round(displayRect.h / s),
    });
    setCropMode(false);
  };

  const handles: { id: HandleId; cls: string; cur: string }[] = [
    { id: 'nw', cls: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cur: 'cursor-nwse-resize' },
    { id: 'ne', cls: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cur: 'cursor-nesw-resize' },
    { id: 'se', cls: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2', cur: 'cursor-nwse-resize' },
    { id: 'sw', cls: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2', cur: 'cursor-nesw-resize' },
    { id: 'n', cls: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cur: 'cursor-ns-resize' },
    { id: 's', cls: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2', cur: 'cursor-ns-resize' },
    { id: 'w', cls: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cur: 'cursor-ew-resize' },
    { id: 'e', cls: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cur: 'cursor-ew-resize' },
  ];

  /* ── এক্সপোর্ট — প্রিভিউয়ের হুবহু পাইপলাইন, ন্যাচারাল রেজোলিউশনে ── */
  const handleSave = () => {
    if (!img || !source || !outBox) return;
    setSaving(true);
    setSaveError(null);
    try {
      const outScale = Math.min(1, MAX_EXPORT_SIDE / Math.max(outBox.w, outBox.h));
      const W = Math.max(1, Math.round(outBox.w * outScale));
      const H = Math.max(1, Math.round(outBox.h * outScale));
      const out = document.createElement('canvas');
      out.width = W;
      out.height = H;
      const ctx = out.getContext('2d');
      if (!ctx) throw new Error('canvas');
      ctx.filter = `brightness(${adj.brightness}%) contrast(${adj.contrast}%) saturate(${adj.saturate}%)`;
      ctx.translate(W / 2, H / 2);
      ctx.rotate((rotation * Math.PI) / 180);
      ctx.scale(flipH ? -1 : 1, flipV ? -1 : 1);
      ctx.drawImage(
        img,
        source.x, source.y, source.w, source.h,
        (-source.w * outScale) / 2, (-source.h * outScale) / 2, source.w * outScale, source.h * outScale
      );
      ctx.filter = 'none';
      if (adj.warmth !== 0) {
        ctx.globalCompositeOperation = 'soft-light';
        ctx.globalAlpha = Math.min(Math.abs(adj.warmth) / 100, 1) * 0.55;
        ctx.fillStyle = adj.warmth > 0 ? 'rgb(255,140,40)' : 'rgb(40,120,255)';
        ctx.fillRect(0, 0, W, H);
      }
      const isPng = /^data:image\/png|\.png(\?|$)/i.test(src);
      onSave(isPng ? out.toDataURL('image/png') : out.toDataURL('image/jpeg', 0.92));
    } catch {
      setSaveError('এই ছবিটা এক্সপোর্ট করা যাচ্ছে না — ছবির হোস্ট অনুমতি দেয় না। ছবিটা ডাউনলোড করে ডিভাইস থেকে আপলোড করে এডিট করুন।');
    } finally {
      setSaving(false);
    }
  };

  const resetAll = () => {
    setRotation(0);
    setFlipH(false);
    setFlipV(false);
    setAdj(DEFAULT_ADJ);
    setCrop(null);
    setDisplayRect(null);
    setCropMode(false);
  };

  const normDeg = (d: number) => ((d % 360) + 540) % 360 - 180;

  // প্যারেন্ট চেইনের space-y margin / backdrop-filter fixed এলিমেন্টকে সরিয়ে
  // ফেলতে পারে — তাই এডিটরকে body-তে পোর্টাল করা হয় (সবসময় পুরো ভিউপোর্ট জুড়ে)।
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] bg-slate-950/95 backdrop-blur-sm flex flex-col">
      {/* হেডার */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 bg-slate-900 border-b border-white/10 flex-shrink-0">
        <h2 className="text-sm sm:text-base font-bold text-white flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-orange-400" />
          ছবি এডিট করুন
          {loadState === 'tainted' && (
            <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-bold text-amber-300 bg-amber-500/10 border border-amber-400/30 rounded-md px-2 py-0.5">
              <AlertTriangle className="w-3 h-3" /> এক্সপোর্ট সীমিত হতে পারে
            </span>
          )}
        </h2>
        <button onClick={onClose} className="p-2 text-slate-400 hover:text-white rounded-md hover:bg-white/10">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* ক্যানভাস / ক্রপ এরিয়া */}
        <div className="flex-1 relative bg-slate-950 grid place-items-center p-4 overflow-hidden min-h-[240px]">
          {loadState === 'loading' && (
            <div className="flex items-center gap-2 text-slate-400 text-xs">
              <Loader2 className="w-4 h-4 animate-spin" /> ছবি লোড হচ্ছে…
            </div>
          )}
          {loadState === 'error' && (
            <div className="text-center text-xs text-red-300 space-y-2">
              <AlertTriangle className="w-8 h-8 mx-auto text-red-400" />
              <p>ছবিটা লোড করা যায়নি। লিংকটা ঠিক আছে কিনা দেখুন।</p>
            </div>
          )}

          {loadState !== 'error' && loadState !== 'loading' && cropMode && img && fitted && displayRect && (
            <div
              className="relative select-none touch-none"
              onPointerMove={onCropPointerMove}
              onPointerUp={endCropDrag}
              onPointerCancel={endCropDrag}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt=""
                draggable={false}
                style={{ width: fitted.w, height: fitted.h }}
                className="block rounded-sm"
              />
              <div
                ref={cropBoxRef}
                onPointerDown={onCropPointerDown('move')}
                className="absolute cursor-move"
                style={{
                  left: displayRect.x,
                  top: displayRect.y,
                  width: displayRect.w,
                  height: displayRect.h,
                  boxShadow: '0 0 0 9999px rgba(2,6,23,0.62)',
                  outline: '2px solid rgba(255,255,255,0.9)',
                }}
              >
                {/* থার্ড-লাইন গ্রিড */}
                <div className="absolute inset-0 pointer-events-none">
                  <div className="absolute left-1/3 top-0 bottom-0 w-px bg-white/30" />
                  <div className="absolute left-2/3 top-0 bottom-0 w-px bg-white/30" />
                  <div className="absolute top-1/3 left-0 right-0 h-px bg-white/30" />
                  <div className="absolute top-2/3 left-0 right-0 h-px bg-white/30" />
                </div>
                {handles.map(h => (
                  <div
                    key={h.id}
                    onPointerDown={onCropPointerDown(h.id)}
                    className={`absolute w-${HANDLE / 2} h-${HANDLE / 2} bg-white rounded-sm shadow ${h.cls} ${h.cur}`}
                    style={{ width: HANDLE, height: HANDLE }}
                  />
                ))}
                <span className="absolute -top-6 left-0 text-[10px] font-bold text-white bg-slate-900/80 rounded px-1.5 py-0.5">
                  {Math.round(displayRect.w / fitted.scale)} × {Math.round(displayRect.h / fitted.scale)}
                </span>
              </div>
            </div>
          )}

          {loadState !== 'error' && loadState !== 'loading' && !cropMode && (
            <canvas ref={canvasRef} className="rounded-sm shadow-2xl max-w-full" />
          )}
        </div>

        {/* টুল প্যানেল */}
        <aside className="w-full lg:w-80 flex-shrink-0 bg-slate-900 border-t lg:border-t-0 lg:border-l border-white/10 overflow-y-auto max-h-[46vh] lg:max-h-none">
          <div className="p-4 sm:p-5 space-y-6 text-slate-200">
            {/* ক্রপ */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5 flex items-center gap-1.5">
                <CropIcon className="w-3.5 h-3.5" /> ক্রপ
              </h3>
              {cropMode ? (
                <div className="space-y-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: 'ফ্রি', v: null },
                      { label: '১:১', v: 1 },
                      { label: '৪:৩', v: 4 / 3 },
                      { label: '৩:৪', v: 3 / 4 },
                      { label: '১৬:৯', v: 16 / 9 },
                    ].map(p => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => { setAspect(p.v); setDisplayRect(null); }}
                        className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold border transition-colors ${
                          aspect === p.v
                            ? 'bg-orange-600 border-orange-600 text-white'
                            : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={applyCrop}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-md bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                    >
                      <Check className="w-3.5 h-3.5" /> ক্রপ প্রয়োগ
                    </button>
                    <button
                      type="button"
                      onClick={() => setCropMode(false)}
                      className="px-3 py-2 rounded-md bg-white/5 border border-white/10 text-slate-300 text-xs font-bold hover:bg-white/10"
                    >
                      বাতিল
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    কোণা/পাশ টেনে মাপ বদলান, ভেতরে টেনে সরান।
                  </p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => { setCropMode(true); setDisplayRect(null); }}
                  className="w-full px-3 py-2 rounded-md bg-white/5 border border-white/10 text-slate-200 text-xs font-bold hover:bg-white/10 transition-colors"
                >
                  {crop ? `ক্রপ ঠিক আছে (${crop.w}×${crop.h}) — পরিবর্তন করুন` : 'ক্রপ করুন'}
                </button>
              )}
              {crop && !cropMode && (
                <button
                  type="button"
                  onClick={() => setCrop(null)}
                  className="mt-2 w-full px-3 py-1.5 rounded-md text-[11px] font-bold text-red-300 hover:bg-red-500/10"
                >
                  ক্রপ মুছে ফেলুন (পুরো ছবি)
                </button>
              )}
            </section>

            {/* রোটেট ও ফ্লিপ */}
            <section>
              <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">রোটেট ও ফ্লিপ</h3>
              <div className="flex items-center gap-2 mb-2.5">
                <input
                  type="range"
                  min={-180}
                  max={180}
                  step={1}
                  value={Math.round(normDeg(rotation))}
                  onChange={(e) => setRotation(Number(e.target.value))}
                  className="flex-1 accent-orange-500"
                />
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    step={0.5}
                    value={Math.round(rotation * 10) / 10}
                    onChange={(e) => setRotation(Number(e.target.value) || 0)}
                    className="w-16 bg-white/5 border border-white/10 rounded-md px-2 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-orange-500"
                  />
                  <span className="text-xs text-slate-400 font-bold">°</span>
                </div>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                <button type="button" title="৯০° বাঁয়ে" onClick={() => setRotation(r => normDeg(r - 90))} className="p-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center">
                  <RotateCcw className="w-4 h-4" />
                </button>
                <button type="button" title="৯০° ডানে" onClick={() => setRotation(r => normDeg(r + 90))} className="p-2 rounded-md bg-white/5 border border-white/10 hover:bg-white/10 flex items-center justify-center">
                  <RotateCw className="w-4 h-4" />
                </button>
                <button type="button" title="অনুভূমিক ফ্লিপ" onClick={() => setFlipH(v => !v)} className={`p-2 rounded-md border flex items-center justify-center ${flipH ? 'bg-orange-600 border-orange-600' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                  <FlipHorizontal className="w-4 h-4" />
                </button>
                <button type="button" title="উল্লম্ব ফ্লিপ" onClick={() => setFlipV(v => !v)} className={`p-2 rounded-md border flex items-center justify-center ${flipV ? 'bg-orange-600 border-orange-600' : 'bg-white/5 border-white/10 hover:bg-white/10'}`}>
                  <FlipVertical className="w-4 h-4" />
                </button>
              </div>
              {rotation !== 0 && (
                <button type="button" onClick={() => setRotation(0)} className="mt-2 w-full px-3 py-1.5 rounded-md text-[11px] font-bold text-slate-300 hover:bg-white/5">
                  সোজা করুন (০°)
                </button>
              )}
            </section>

            {/* কালার ব্যালেন্স */}
            <section>
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">কালার ব্যালেন্স</h3>
                {(adj.brightness !== 100 || adj.contrast !== 100 || adj.saturate !== 100 || adj.warmth !== 0) && (
                  <button type="button" onClick={() => setAdj(DEFAULT_ADJ)} className="text-[10px] font-bold text-orange-400 hover:text-orange-300">
                    রিসেট
                  </button>
                )}
              </div>
              <div className="space-y-3.5">
                {([
                  { key: 'brightness', label: 'উজ্জ্বলতা', min: 30, max: 200, unit: '%' },
                  { key: 'contrast', label: 'কনট্রাস্ট', min: 30, max: 200, unit: '%' },
                  { key: 'saturate', label: 'স্যাচুরেশন', min: 0, max: 220, unit: '%' },
                  { key: 'warmth', label: 'উষ্ণতা', min: -100, max: 100, unit: '' },
                ] as const).map(s => (
                  <div key={s.key}>
                    <div className="flex items-center justify-between text-[11px] font-bold mb-1">
                      <span className="text-slate-300">{s.label}</span>
                      <span className="text-slate-400">
                        {s.key === 'warmth'
                          ? adj.warmth === 0 ? 'নিরপেক্ষ' : adj.warmth > 0 ? `উষ্ণ +${adj.warmth}` : `শীতল ${adj.warmth}`
                          : `${adj[s.key]}${s.unit}`}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={1}
                      value={adj[s.key]}
                      onChange={(e) => setAdj(a => ({ ...a, [s.key]: Number(e.target.value) }))}
                      className="w-full accent-orange-500"
                    />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </aside>
      </div>

      {/* ফুটার */}
      <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-slate-900 border-t border-white/10 flex-shrink-0">
        <button
          type="button"
          onClick={resetAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs font-bold text-slate-300 hover:bg-white/5"
        >
          <RotateCcw className="w-3.5 h-3.5" /> সব রিসেট
        </button>
        {saveError && <p className="hidden sm:block text-[11px] text-red-300 flex-1 text-right pr-2">{saveError}</p>}
        <div className="flex items-center gap-2 ml-auto">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-md border border-white/15 text-slate-200 text-xs font-bold hover:bg-white/5"
          >
            বাতিল
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loadState !== 'ready' && loadState !== 'tainted'}
            className="inline-flex items-center gap-2 px-6 py-2.5 rounded-md bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white text-xs font-bold"
          >
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            {saving ? 'সংরক্ষণ হচ্ছে…' : 'সেভ করুন'}
          </button>
        </div>
      </div>
      {saveError && (
        <div className="sm:hidden px-4 pb-3 bg-slate-900">
          <p className="text-[11px] text-red-300">{saveError}</p>
        </div>
      )}
    </div>,
    document.body
  );
}

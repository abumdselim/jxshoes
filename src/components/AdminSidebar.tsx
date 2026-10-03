'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Boxes,
  Layers,
  ShoppingCart,
  Settings,
  ExternalLink,
  X,
  Bot,
  Users,
  Receipt,
  Calculator,
  FileText,
  Images,
  Bell,
  CloudOff,
  Loader2,
  RefreshCw
} from 'lucide-react';
import { apiFetch } from '@/lib/offline/apiFetch';
import { useSyncStatus } from '@/lib/offline/OfflineProvider';

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
const bn = (v: number | string) => String(v).replace(/\d/g, d => BN_DIGITS[Number(d)]);

/** সাইডবার ফুটারের ছোট অফলাইন/সিঙ্ক স্ট্যাটাস */
function SyncStatusBadge() {
  const status = useSyncStatus();
  if (!status) return null;
  const { online, pending, failed, syncing, syncNow } = status;
  if (online && pending === 0 && failed === 0 && !syncing) return null;

  return (
    <button
      onClick={() => void syncNow()}
      title="সিঙ্ক সেন্টার"
      className={`w-full flex items-center gap-2 px-3 py-2 rounded-md text-[11px] font-bold mb-2 transition-colors ${
        !online
          ? 'bg-slate-800 text-slate-300'
          : failed > 0
            ? 'bg-red-900/60 text-red-200'
            : 'bg-slate-800 text-slate-300'
      }`}
    >
      {syncing ? (
        <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin text-orange-400" />
      ) : !online ? (
        <CloudOff className="w-3.5 h-3.5 shrink-0 text-slate-400" />
      ) : (
        <RefreshCw className="w-3.5 h-3.5 shrink-0 text-orange-400" />
      )}
      <span className="truncate text-left">
        {!online
          ? 'অফলাইন — স্বয়ংক্রিয় সিঙ্ক চালু'
          : failed > 0
            ? `${bn(failed)}টি সিঙ্ক ব্যর্থ`
            : syncing
              ? 'সিঙ্ক হচ্ছে…'
              : `${bn(pending)}টি সিঙ্ক অপেক্ষায়`}
      </span>
    </button>
  );
}

interface AdminSidebarProps {
  onCloseMobile?: () => void;
}

export default function AdminSidebar({ onCloseMobile }: AdminSidebarProps) {
  const pathname = usePathname();

  // অপঠিত নোটিফিকেশন সংখ্যা — নেভিগেশনে এবং প্রতি ৪৫ সেকেন্ডে রিফ্রেশ
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = async () => {
      try {
        const res = await apiFetch('/api/notifications?unreadCount=1');
        if (res.ok) {
          const d = await res.json();
          if (alive) setUnreadNotifications(d.count || 0);
        }
      } catch {
        /* নীরব */
      }
    };
    load();
    const iv = setInterval(load, 45000);
    return () => {
      alive = false;
      clearInterval(iv);
    };
  }, [pathname]);

  const navItems: {
    label: string;
    href: string;
    icon: React.ElementType;
    active: boolean;
    highlight?: boolean;
    badge?: number;
  }[] = [
    {
      label: 'ওভারভিউ ড্যাশবোর্ড',
      href: '/admin',
      icon: LayoutDashboard,
      active: pathname === '/admin',
    },
    {
      label: 'AI অ্যাসিস্ট্যান্ট',
      href: '/admin/assistant',
      icon: Bot,
      active: pathname.startsWith('/admin/assistant'),
      highlight: true,
    },
    {
      label: 'ইনভেন্টরি ও স্টক (ERP)',
      href: '/admin/inventory',
      icon: Boxes,
      active: pathname.startsWith('/admin/inventory'),
    },
    {
      label: 'প্রোডাক্ট ম্যানেজমেন্ট',
      href: '/admin/products',
      icon: Package,
      active: pathname.startsWith('/admin/products'),
    },
    {
      label: 'ক্যাটাগরি ম্যানেজমেন্ট',
      href: '/admin/categories',
      icon: Layers,
      active: pathname.startsWith('/admin/categories'),
    },
    {
      label: 'অর্ডার ম্যানেজমেন্ট',
      href: '/admin/orders',
      icon: ShoppingCart,
      active: pathname.startsWith('/admin/orders'),
    },
    {
      label: 'নোটিফিকেশন',
      href: '/admin/notifications',
      icon: Bell,
      active: pathname.startsWith('/admin/notifications'),
      badge: unreadNotifications,
    },
    {
      label: 'কাস্টমার ও বাকির খাতা',
      href: '/admin/customers',
      icon: Users,
      active: pathname.startsWith('/admin/customers'),
    },
    {
      label: 'খরচের খাতা',
      href: '/admin/expenses',
      icon: Receipt,
      active: pathname.startsWith('/admin/expenses'),
    },
    {
      label: 'হিসাব ও লাভ-ক্ষতি',
      href: '/admin/finance',
      icon: Calculator,
      active: pathname.startsWith('/admin/finance'),
    },
    {
      label: 'AI বিজনেস রিপোর্ট',
      href: '/admin/reports',
      icon: FileText,
      active: pathname.startsWith('/admin/reports'),
    },
    {
      label: 'মিডিয়া গ্যালারি',
      href: '/admin/gallery',
      icon: Images,
      active: pathname.startsWith('/admin/gallery'),
    },
    {
      label: 'সেটিংস এবং অন্যান্য',
      href: '/admin/settings',
      icon: Settings,
      active: pathname.startsWith('/admin/settings'),
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white h-full flex flex-col border-r border-slate-800 overflow-hidden">
      <div className="flex-1 min-h-0 flex flex-col">
        {/* Brand Header — সবসময় উপরে ফিক্সড */}
        <div className="p-5 pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <a href="/admin" aria-label="Shopkeeper হোম" className="flex-1 min-w-0">
              { }
              <img
                src="/shopkeeper-logo.png"
                alt="Shopkeeper"
                className="w-full max-w-[200px] h-auto"
                style={{ mixBlendMode: 'screen' }}
              />
            </a>
            {onCloseMobile && (
              <button
                onClick={onCloseMobile}
                className="p-2 -mr-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 md:hidden shrink-0"
                aria-label="মেনু বন্ধ করুন"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
          <div className="text-[10px] text-slate-400 mt-1.5">Full Control CMS</div>
        </div>

        {/* Nav Items — তালিকা বাড়লে শুধু এই অংশই স্ক্রল হয় */}
        <nav className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-md text-xs sm:text-sm font-semibold transition-all ${
                  item.active
                    ? 'bg-orange-600 text-white'
                    : 'text-white hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 shrink-0" />
                <span className="truncate">{item.label}</span>
                {item.badge ? (
                  <span className="ml-auto bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Bottom Storefront return — সবসময় নিচে ফিক্সড */}
      <div className="p-4 border-t border-slate-800 shrink-0">
        <SyncStatusBadge />
        <a
          href="/shop"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full px-4 py-3 rounded-md bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold transition-colors"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-orange-400" />
            <span>লাইভ শপ প্রিভিউ</span>
          </span>
          <span className="text-[10px] bg-slate-700 text-orange-400 px-2 py-0.5 rounded-sm font-mono">
            Preview
          </span>
        </a>
      </div>
    </aside>
  );
}

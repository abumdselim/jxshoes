'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Package,
  Layers,
  ShoppingCart,
  Megaphone,
  Settings,
  ExternalLink,
  ShieldCheck,
  X
} from 'lucide-react';

interface AdminSidebarProps {
  onCloseMobile?: () => void;
}

export default function AdminSidebar({ onCloseMobile }: AdminSidebarProps) {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'ওভারভিউ ড্যাশবোর্ড',
      href: '/admin',
      icon: LayoutDashboard,
      active: pathname === '/admin',
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
      label: 'ব্যানার ও কুপন (Marketing)',
      href: '/admin/marketing',
      icon: Megaphone,
      active: pathname.startsWith('/admin/marketing'),
    },
    {
      label: 'শপ সেটিংস ও ডেলিভারি ফি',
      href: '/admin/settings',
      icon: Settings,
      active: pathname.startsWith('/admin/settings'),
    },
  ];

  return (
    <aside className="w-64 bg-slate-900 text-white min-h-screen h-full flex flex-col justify-between border-r border-slate-800 flex-shrink-0">
      <div>
        {/* Brand Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-orange-600 flex items-center justify-center font-black text-xl text-white shadow-md">
              JX
            </div>
            <div>
              <div className="font-extrabold text-sm tracking-tight flex items-center gap-1.5">
                <span>Master Admin</span>
                <ShieldCheck className="w-4 h-4 text-orange-400" />
              </div>
              <div className="text-[10px] text-slate-400">Full Control CMS</div>
            </div>
          </div>

          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 md:hidden"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Nav Items */}
        <nav className="p-3 space-y-1">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={onCloseMobile}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-all ${
                  item.active
                    ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/30'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span className="truncate">{item.label}</span>
              </a>
            );
          })}
        </nav>
      </div>

      {/* Bottom Storefront return */}
      <div className="p-4 border-t border-slate-800">
        <a
          href="/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition-colors"
        >
          <span className="flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-orange-400" />
            <span>লাইভ শপ প্রিভিউ</span>
          </span>
          <span className="text-[10px] bg-slate-700 text-orange-400 px-2 py-0.5 rounded font-mono">
            Preview
          </span>
        </a>
      </div>
    </aside>
  );
}

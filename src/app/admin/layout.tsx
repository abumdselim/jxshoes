'use client';

import React, { useState } from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import { Menu } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  return (
    /**
     * fixed inset-0 + flex:
     * - পুরো admin panel একটা আলাদা "app" হিসেবে পুরো viewport দখল করে
     * - body-তে overflow-x-hidden থাকলেও position:fixed ভাঙে না
     * - Sidebar একটি flex child — কখনো scroll হয় না
     * - Main content শুধু overflow-y-auto দিয়ে নিজেই scroll করে
     */
    <div className="fixed inset-0 bg-slate-100 text-slate-900 flex overflow-hidden">

      {/* Desktop Sidebar — always visible, never scrolls */}
      <div className="hidden md:flex w-64 flex-shrink-0 h-full">
        <AdminSidebar />
      </div>

      {/* Mobile Sidebar Drawer */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="relative z-10 w-72 max-w-full">
            <AdminSidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content — flex-1, only this column scrolls */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Sticky Header inside the scrollable column */}
        <header className="bg-white border-b border-slate-200 h-16 px-4 sm:px-8 flex items-center justify-between sticky top-0 z-30 shadow-sm flex-shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100"
              aria-label="Open Admin Menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-xs font-bold text-slate-800">JxShoes Control Panel</span>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs font-semibold text-slate-600">
            <span className="hidden sm:inline bg-emerald-50 text-emerald-700 px-2.5 py-1 rounded-full border border-emerald-200">
              ক্যাশ অন ডেলিভারি: সক্রিয়
            </span>
            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="px-3 py-1.5 rounded-lg bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold border border-orange-200 transition-colors"
            >
              স্টোর ভিউ ↗
            </a>
          </div>
        </header>

        <main className="p-4 sm:p-8 flex-1">
          {children}
        </main>
      </div>
    </div>
  );
}

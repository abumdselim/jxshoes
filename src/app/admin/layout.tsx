'use client';

import React, { useEffect, useState } from 'react';
import AdminSidebar from '@/components/AdminSidebar';
import AdminAiFab from '@/components/AdminAiFab';
import { Menu } from 'lucide-react';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // ড্রয়ার খোলা থাকলে পেছনের পেজ স্ক্রল বন্ধ + Escape-এ বন্ধ
  useEffect(() => {
    document.body.style.overflow = mobileSidebarOpen ? 'hidden' : '';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileSidebarOpen(false);
    };
    if (mobileSidebarOpen) window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [mobileSidebarOpen]);

  return (
    /**
     * fixed inset-0 + flex:
     * - পুরো admin panel একটা আলাদা "app" হিসেবে পুরো viewport দখল করে
     * - body-তে overflow-x-hidden থাকলেও position:fixed ভাঙে না
     * - Sidebar একটি flex child — কখনো scroll হয় না
     * - Main content শুধু overflow-y-auto দিয়ে নিজেই scroll করে
     */
    <div className="fixed inset-0 bg-slate-200 text-slate-900 flex overflow-hidden">

      {/* Desktop Sidebar — always visible, never scrolls */}
      <div className="hidden md:flex w-64 flex-shrink-0 h-full">
        <AdminSidebar />
      </div>

      {/* Mobile Sidebar Drawer — দৃঢ়ভাবে অ্যাংকর করা, স্লাইড-ইন, টান-টানি নেই */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
            onClick={() => setMobileSidebarOpen(false)}
          />
          <div className="absolute left-0 top-0 bottom-0 w-72 max-w-[85%] shadow-2xl overflow-hidden animate-in slide-in-from-left duration-300 ease-out">
            <AdminSidebar onCloseMobile={() => setMobileSidebarOpen(false)} />
          </div>
        </div>
      )}

      {/* Main Content — flex-1, only this column scrolls */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* মোবাইল-অনলি স্লিম বার — ডেস্কটপে প্রতিটা পেজের নিজের স্টিকি হেডলাইনই হেডার */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-slate-200 h-14 px-4 flex items-center justify-between flex-shrink-0 relative">
          <div className="flex items-center gap-3">
            {/* Mobile Hamburger */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="p-2 rounded-md text-slate-600 hover:bg-slate-200"
              aria-label="Open Admin Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
          </div>

          {/* লোগো — হেডারের একদম মাঝখানে */}
          <div className="absolute left-1/2 -translate-x-1/2 flex items-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/shopkeeper-logo-orange.png"
                alt="Shopkeeper"
                className="h-8 w-auto"
              />
          </div>

          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-md bg-orange-50 text-orange-600 hover:bg-orange-100 font-bold border border-orange-200 transition-colors text-xs"
          >
            স্টোর ভিউ ↗
          </a>
        </header>

        <main className="p-4 sm:p-8 flex-1">
          {children}
        </main>
      </div>

      {/* AI কুইক অ্যাক্সেস — সব অ্যাডমিন পেজে ভাসমান বাটন */}
      <AdminAiFab />
    </div>
  );
}

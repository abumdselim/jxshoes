'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Loader2, Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/admin-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.ok) {
        router.push('/admin');
        router.refresh();
        return;
      }
      setError(
        res.status === 401
          ? 'ভুল পাসওয়ার্ড — আবার চেষ্টা করুন'
          : data.error || 'কিছু একটা সমস্যা হয়েছে — আবার চেষ্টা করুন'
      );
    } catch {
      setError('নেটওয়ার্ক সমস্যা — ইন্টারনেট চেক করে আবার চেষ্টা করুন');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl shadow-black/40 p-7 sm:p-8">
          {/* লোগো */}
          <div className="flex flex-col items-center gap-4">
            { }
            <img
              src="/shopkeeper-logo.png"
              alt="Shopkeeper"
              className="h-9 w-auto"
              style={{ mixBlendMode: 'screen' }}
            />
            <div className="text-center">
              <h1 className="text-xl font-bold text-white">অ্যাডমিন প্যানেল</h1>
              <p className="mt-1 text-sm text-slate-400">পাসওয়ার্ড দিয়ে প্রবেশ করুন</p>
            </div>
          </div>

          {/* লগইন ফর্ম */}
          <form onSubmit={handleSubmit} className="mt-7 space-y-4">
            <div>
              <label htmlFor="password" className="sr-only">
                পাসওয়ার্ড
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="পাসওয়ার্ড"
                  autoComplete="current-password"
                  autoFocus
                  required
                  className="w-full rounded-lg bg-slate-950 border border-slate-700 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/30 outline-hidden pl-10 pr-11 py-2.5 text-sm text-white placeholder:text-slate-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'পাসওয়ার্ড লুকান' : 'পাসওয়ার্ড দেখান'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <p
                role="alert"
                className="rounded-lg bg-red-500/10 border border-red-500/30 px-3 py-2 text-xs text-red-400"
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !password}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-bold py-2.5 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>যাচাই হচ্ছে…</span>
                </>
              ) : (
                'প্রবেশ করুন'
              )}
            </button>
          </form>
        </div>

        {/* ফুটার লিংক */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-slate-500">
          <Link href="/" className="hover:text-white transition-colors">
            ← হোম
          </Link>
          <span className="text-slate-700">|</span>
          <a href="/shop" className="hover:text-white transition-colors">
            ডেমো শপ
          </a>
        </div>
      </div>
    </div>
  );
}

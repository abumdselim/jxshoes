import { NextRequest, NextResponse } from 'next/server';
import { GENERATED_ENV } from '@/lib/generatedEnv';

const ADMIN_COOKIE = 'sk_admin';

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function middleware(request: NextRequest) {
  const password = GENERATED_ENV.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  // পাসওয়ার্ড কনফিগার করা না থাকলে লক নেই (লোকাল ডেভ)
  if (!password) return NextResponse.next();

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value || '';
  if (cookie && cookie === (await sha256(password))) return NextResponse.next();

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*'],
};

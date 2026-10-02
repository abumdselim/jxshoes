import { NextResponse } from 'next/server';
import { GENERATED_ENV } from '@/lib/generatedEnv';

export const runtime = 'edge';

const ADMIN_COOKIE = 'sk_admin';
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // ৩০ দিন

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function POST(request: Request) {
  const password = GENERATED_ENV.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';

  // পাসওয়ার্ড কনফিগার করা না থাকলে লগইন অকার্যকর
  if (!password) {
    return NextResponse.json({ error: 'পাসওয়ার্ড কনফিগার করা নেই' }, { status: 500 });
  }

  let body: { password?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'ভুল পাসওয়ার্ড' }, { status: 401 });
  }

  const supplied = typeof body.password === 'string' ? body.password : '';
  if (!supplied || supplied !== password) {
    return NextResponse.json({ error: 'ভুল পাসওয়ার্ড' }, { status: 401 });
  }

  // কুকিতে পাসওয়ার্ড নয়, শুধু তার SHA-256 হ্যাশ রাখা হয়
  const hash = await sha256(password);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, hash, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
  return res;
}

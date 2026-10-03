import { NextResponse } from 'next/server';
import { GENERATED_ENV } from '@/lib/generatedEnv';
import { timingSafeEqualStr } from '@/lib/adminAuth';
import { clientIp, isRateAllowed, incrementRateCount, resetRateCount } from '@/lib/rateLimit';

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

  // ব্রুট-ফোর্স গেট (P1) — প্রতি IP ১৫ মিনিটে ৫টি ব্যর্থ চেষ্টা
  const ip = clientIp(request);
  if (!(await isRateAllowed('login', ip, 5))) {
    return NextResponse.json(
      { error: 'অনেক বেশি ভুল চেষ্টা হয়েছে — ১৫ মিনিট পরে আবার চেষ্টা করুন' },
      { status: 429 }
    );
  }

  let body: { password?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'ভুল পাসওয়ার্ড' }, { status: 401 });
  }

  const supplied = typeof body.password === 'string' ? body.password : '';
  // প্লেইন তুলনা নয় — দুটো হ্যাশ ধ্রুব-সময়ে মেলানো হয়
  const passwordHash = await sha256(password);
  const suppliedHash = await sha256(supplied);
  if (!supplied || !timingSafeEqualStr(suppliedHash, passwordHash)) {
    await incrementRateCount('login', ip, 900);
    return NextResponse.json({ error: 'ভুল পাসওয়ার্ড' }, { status: 401 });
  }

  // কুকিতে পাসওয়ার্ড নয়, শুধু তার SHA-256 হ্যাশ রাখা হয়
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE, passwordHash, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: COOKIE_MAX_AGE,
    secure: process.env.NODE_ENV === 'production',
  });
  await resetRateCount('login', ip, 900);
  return res;
}

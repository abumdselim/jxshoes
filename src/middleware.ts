import { NextRequest, NextResponse } from 'next/server';
import { GENERATED_ENV } from '@/lib/generatedEnv';

const ADMIN_COOKIE = 'sk_admin';

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * পাবলিক API রুটের allowlist — (prefix, methods)। এগুলোর নিজস্ব গেট/স্কোপ আছে:
 * - orders POST zod-যাচিত + রেট-লিমিট; orders GET/{id} রুটেই requireAdmin/টোকেন-যাচাই
 * - cron GET x-cron-secret যাচাই করে; sync GET public/admin scope ভাগ করে
 * বাকি সব /api/* অ্যাডমিন কুকি ছাড়া 401 — রাউটের requireAdmin গেটের দ্বিতীয় প্রতিরক্ষা।
 */
const PUBLIC_API_RULES: { prefix: string; methods: string[] }[] = [
  { prefix: '/api/products', methods: ['GET'] },
  { prefix: '/api/categories', methods: ['GET'] },
  { prefix: '/api/settings', methods: ['GET'] },
  { prefix: '/api/marketing', methods: ['GET'] },
  { prefix: '/api/coupons/validate', methods: ['POST'] },
  { prefix: '/api/orders', methods: ['POST', 'GET'] },
  { prefix: '/api/feedback', methods: ['POST'] },
  { prefix: '/api/admin-login', methods: ['POST'] },
  { prefix: '/api/media/', methods: ['GET'] },
  { prefix: '/api/sync', methods: ['GET'] },
  { prefix: '/api/cron/', methods: ['GET'] },
];

function isPublicApi(pathname: string, method: string): boolean {
  return PUBLIC_API_RULES.some(
    rule =>
      (pathname === rule.prefix || pathname.startsWith(rule.prefix + '/')) &&
      rule.methods.includes(method)
  );
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const password = GENERATED_ENV.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  // পাসওয়ার্ড কনফিগার করা না থাকলে লক নেই (লোকাল ডেভ)
  if (!password) return NextResponse.next();

  const cookie = request.cookies.get(ADMIN_COOKIE)?.value || '';
  if (cookie && cookie === (await sha256(password))) return NextResponse.next();

  // /api/* — পাবলিক allowlist ছাড়া সব 401 (redirect নয়, API-তে JSON-ই ভাষা)
  if (pathname === '/api' || pathname.startsWith('/api/')) {
    if (isPublicApi(pathname, request.method.toUpperCase())) return NextResponse.next();
    return NextResponse.json({ error: 'অননুমোদিত — অ্যাডমিন লগইন প্রয়োজন' }, { status: 401 });
  }

  const loginUrl = new URL('/login', request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/admin/:path*', '/api/:path*'],
};

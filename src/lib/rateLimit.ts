/**
 * KV-ভিত্তিক সফট রেট-লিমিটার (P1)।
 * Cloudflare KV eventually-consistent, তাই এটা নরম সীমা — নিখুঁত লিমিট লাগলে
 * পরে Durable Object (P5/P6)। KV কনফিগার্ড না থাকা/ব্যর্থ হলে fail-open —
 * দোকানের বিক্রি কখনো লিমিটারের কারণে আটকাবে না।
 */
import { getCfEnv } from './cfEnv';

function kvApi(key: string): { ok: boolean; url: string; token: string } {
  const env = getCfEnv();
  return {
    ok: Boolean(env.accountId && env.apiToken && env.kvId),
    url: `https://api.cloudflare.com/client/v4/accounts/${env.accountId}/storage/kv/namespaces/${env.kvId}/values/${key}`,
    token: env.apiToken,
  };
}

/** কলারের আসল IP (Cloudflare এজ হেডার আগে) */
export function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  );
}

/** বর্তমান কাউন্টার (না থাকলে/ভুল হলে ০) */
async function getRateCount(scope: string, ip: string): Promise<number> {
  const { ok, url, token } = kvApi(`rl_${scope}_${ip}`);
  if (!ok) return 0;
  try {
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    if (!res.ok || res.status === 404) return 0;
    const n = Number(await res.text());
    return Number.isFinite(n) && n >= 0 ? Math.floor(n) : 0;
  } catch {
    return 0;
  }
}

/** কাউন্টার সেট — কী-টি উইন্ডো শেষে KV থেকে নিজেই মুছে যায় (expiration_ttl, ন্যূনতম ৬০ সেকেন্ড) */
async function setRateCount(scope: string, ip: string, count: number, windowSeconds: number): Promise<void> {
  const { ok, url, token } = kvApi(`rl_${scope}_${ip}`);
  if (!ok) return;
  try {
    await fetch(`${url}?expiration_ttl=${Math.max(60, windowSeconds)}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'text/plain' },
      body: String(count),
    });
  } catch {
    // fail-open
  }
}

/**
 * এই অনুরোধটা সীমার মধ্যে আছে কি না — ব্যবহার-প্রতি কাউন্ট বাড়ে।
 * ok=false মানে সীমা ছাড়িয়েছে → 429 দিন।
 * যেমন: checkRateLimit('order', clientIp(request), 10, 3600)
 */
export async function checkRateLimit(
  scope: string,
  ip: string,
  limit: number,
  windowSeconds: number
): Promise<{ ok: boolean }> {
  const count = await getRateCount(scope, ip);
  if (count >= limit) return { ok: false };
  await setRateCount(scope, ip, count + 1, windowSeconds);
  return { ok: true };
}

/**
 * ব্যর্থতা-গণনা পথ (লগইনের মতো) — আগে getRateCount দিয়ে সীমা দেখুন,
 * ব্যর্থ হলে incrementRateCount, সফল হলে resetRateCount।
 */
export async function incrementRateCount(scope: string, ip: string, windowSeconds: number): Promise<void> {
  const count = await getRateCount(scope, ip);
  await setRateCount(scope, ip, count + 1, windowSeconds);
}

export async function resetRateCount(scope: string, ip: string, windowSeconds: number): Promise<void> {
  await setRateCount(scope, ip, 0, windowSeconds);
}

/** লগইন-স্টাইল গেট: সীমার মধ্যে আছে কি না (কাউন্ট বাড়ায় না) */
export async function isRateAllowed(scope: string, ip: string, limit: number): Promise<boolean> {
  const count = await getRateCount(scope, ip);
  return count < limit;
}

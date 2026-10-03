/**
 * অ্যাডমিন অনুরোধ যাচাই — middleware-এর হুবহু নিয়ম (sk_admin = SHA-256(ADMIN_PASSWORD))।
 * API রুটগুলো (/api/ai, /api/sync) এটা দিয়ে লক করা হয়:
 * - AI নিউরন কোটা ও ব্যবসার সংবেদনশীল ডেটা (বাকি, খরচ, ক্রয়মূল্য) পাবলিক থেকে বন্ধ
 * - পাসওয়ার্ড কনফিগার না থাকলে (লোকাল ডেভ) খোলা থাকে — middleware-এর মতোই
 */
import { GENERATED_ENV } from './generatedEnv';

const ADMIN_COOKIE = 'sk_admin';

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** ধ্রুব-সময়ে দুটি স্ট্রিং তুলনা — দৈর্ঘ্যসহ কোনো তথ্যই ফাঁস করে না */
export function timingSafeEqualStr(a: string, b: string): boolean {
  const max = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < max; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

function getCookieValue(request: Request): string {
  const cookieHeader = request.headers.get('cookie') || '';
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${ADMIN_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : '';
}

/** অনুরোধটা অ্যাডমিনের কি না (কুকি যাচাই)। পাসওয়ার্ড আনকনফিগার্ড হলে true (লোকাল ডেভ)। */
export async function isAdminRequest(request: Request): Promise<boolean> {
  const password = GENERATED_ENV.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD || '';
  if (!password) return true;
  const cookie = getCookieValue(request);
  if (!cookie) return false;
  return timingSafeEqualStr(cookie, await sha256(password));
}

/**
 * রুট-গেট: অ্যাডমিন না হলে 401 JSON Response, অ্যাডমিন হলে null।
 * ভবিষ্যতে সেশন-ভিত্তিক অথে (P6) গেলে শুধু এই ফাংশনের ভেতরটা বদলাবে — রাউট নয়।
 * ব্যবহার: const denied = await requireAdmin(request); if (denied) return denied;
 */
export async function requireAdmin(request: Request): Promise<Response | null> {
  if (await isAdminRequest(request)) return null;
  return new Response(JSON.stringify({ error: 'অননুমোদিত — অ্যাডমিন লগইন প্রয়োজন' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

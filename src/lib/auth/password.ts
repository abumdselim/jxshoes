/**
 * পাসওয়ার্ড হ্যাশ (P6) — PBKDF2-SHA256, শুধু Web Crypto (edge runtime নিরাপদ)।
 *
 * **Iteration সিদ্ধান্ত (যাচাইকৃত):** Cloudflare-এর workerd রানটাইম `crypto.subtle`
 * PBKDF2-এর iteration সীমা ~১,০০,০০০ — তার ওপরে গেলে throw করে
 * ("iteration counts above 100000 are not supported")। OWASP PBKDF2-SHA256-এর
 * জন্য ৬,০০,০০০ সুপারিশ করে — সেটা Workers-এ চলে না। তাই:
 *   ১. PBKDF2_ITERATIONS = ১,০০,০০০ (workerd-এর অনুমোদিত সর্বোচ্চ),
 *   ২. প্রতি-ইউজার ১৬-বাইট এলোমেলো salt (রেইনবো-টেবিল বন্ধ),
 *   ৩. লগইনে কড়া রেট-লিমিট (P1-এর rateLimit হেল্পার, admin-login-এ ৫/১৫মিনিট),
 *   ৪. সেশন-টোকেন পাসওয়ার্ড থেকে পৃথক ২৫৬-বিট র‍্যান্ডম — হ্যাশ লিক হলেও
 *      কুকি আগের মতো deterministic হ্যাশে বদলানো যায় না।
 * OWASP-গ্রেড KDF (argon2/scrypt WASM) দরকার হলে — docs/audits/p6-wiring-plan.md দেখো।
 *
 * স্টোর-ফরম্যাট (ভার্সনড, মডুলার): `pbkdf2$<iterations>$<saltB64url>$<hashB64url>`
 */
import { fromB64url, randomBytes, timingSafeEqualStr, toB64url } from './crypto';

/**
 * PBKDF2 iteration — workerd-এর অনুমোদিত সর্বোচ্চ (উপরের নোট দেখো)।
 * নতুন হ্যাশ সবসময় এই মানে তৈরি হয়; verify-তে পুরোনো রেকর্ডের সেভ করা
 * iteration-ই ব্যবহৃত হয় (≤ এই মান হতে হবে)।
 */
export const PBKDF2_ITERATIONS = 100_000;
/** ২৫৬-বিট derived key */
export const PBKDF2_HASH_BYTES = 32;
/** প্রতি-ইউজার র‍্যান্ডম salt */
export const PBKDF2_SALT_BYTES = 16;

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password) as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations },
    key,
    PBKDF2_HASH_BYTES * 8
  );
  return new Uint8Array(bits);
}

/** পাসওয়ার্ড → সেভ-যোগ্য হ্যাশ-স্ট্রিং (প্রতিবার নতুন salt) */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(PBKDF2_SALT_BYTES);
  const bits = await deriveBits(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${toB64url(salt)}$${toB64url(bits)}`;
}

/**
 * পাসওয়ার্ড মেলানো — হ্যাশ-স্ট্রিং থেকে salt/iteration পড়ে পুনঃনিরূপণ।
 * ভুল ফরম্যাট/iteration-সীমার বাইরে/derive ব্যর্থ — সব ক্ষেত্রে false (কখনো throw নয়)।
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const parts = stored.split('$');
    if (parts.length !== 4 || parts[0] !== 'pbkdf2') return false;
    const iterations = Number(parts[1]);
    // workerd-সীমার বাইরে হলে Workers-এ derive-ই হবে না — fail-closed
    if (!Number.isInteger(iterations) || iterations < 1 || iterations > PBKDF2_ITERATIONS) return false;
    const salt = fromB64url(parts[2]);
    const expected = fromB64url(parts[3]);
    const bits = await deriveBits(password, salt, iterations);
    // দৈর্ঘ্য-নিরপেক্ষ ধ্রুব-সময়ে তুলনা
    return timingSafeEqualStr(toB64url(bits), toB64url(expected));
  } catch {
    return false;
  }
}

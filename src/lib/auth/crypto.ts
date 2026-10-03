/**
 * Web Crypto প্রিমিটিভস (P6) — edge-runtime নিরাপদ।
 * নিয়ম (AGENTS.md #1): Node-only crypto সম্পূর্ণ নিষিদ্ধ — শুধু crypto.subtle/getRandomValues।
 * base64url I/O-র জন্য Buffer নয় — btoa/atob (DOM গ্লোবাল, Workers-এ আছে)।
 * adminAuth.ts-এর timingSafeEqualStr-এর হুবহু প্রতিলিপি এখানে রাখা হয়েছে যাতে
 * P6 লায়ব্রেরি আগের ফাইলের ওপর নির্ভর না করে (adminAuth এই রাউন্ডে অস্পৃশ্য)।
 */

/** ক্রিপ্টো-শক্তিশালী র‍্যান্ডম বাইট */
export function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

/** SHA-256 → লোয়ারকেস হেক্স (সেশন token_hash-এর জন্য) */
export async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** HMAC-SHA256 সাইন → base64url (সেশন-টোকেনের অখণ্ডতা-স্বাক্ষর) */
export async function hmacSignB64url(keyBytes: Uint8Array, data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    keyBytes as BufferSource,
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data) as BufferSource);
  return toB64url(new Uint8Array(sig));
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

/** বাইট → base64url (প্যাডিং-বিহীন, কুকি/URL-নিরাপদ) */
export function toB64url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** base64url → বাইট (ভুল ইনপুটে throw — কলার catch করবে) */
export function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (s.length % 4)) % 4);
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** সংক্ষিপ্ত এলোমেলো আইডি (12 বাইট → 16 অক্ষর base64url) — sessions/audit_log-এর id */
export function genId(): string {
  return toB64url(randomBytes(12));
}

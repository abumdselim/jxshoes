/**
 * সেশন (P6) — র‍্যান্ডম ২৫৬-বিট টোকেন + HMAC-SHA256 স্বাক্ষর + মেয়াদ + টেবিল-রেকর্ড।
 *
 * টোকেন-ফরম্যাট (কুকি-মান): `v1.<sessionId>.<randomB64url>.<sigB64url>`
 *   - sessionId: ১২-বাইট র‍্যান্ডম (টেবিলের প্রাইমারি কি)
 *   - random:    ৩২-বাইট র‍্যান্ডম (২৫৬-বিট গোপন উপাদান)
 *   - sig:       HMAC-SHA256(সাইনিং-কি, '<sessionId>.<random>')
 * ডেটাবেসে (sessions টেবিল, migrations/0003) টোকেন নয় — শুধু
 * SHA-256('<sessionId>.<random>') হ্যাশ সেভ হয়। ফলে:
 *   - কুকি চুরি হলে নির্দিষ্ট সেশন revoke করা যায় (legacy SHA-256(ADMIN_PASSWORD)
 *     কুকির "রিভোক-অযোগ্য" সমস্যার সমাধান),
 *   - ডিবি লিক হলেও টোকেন পুনর্গঠন করা যায় না।
 * HMAC স্বাক্ষর ডিবি-হিটের আগেই জাল টোকেন ফেলে দেয় + গোপন-কি ছাড়া কেউ
 * বৈধ-দেখতে id/random জোড়া বানাতে পারে না।
 *
 * সাইনিং-কি: SESSION_SECRET (বর্জ্যকৃত-সিক্রেট, ৩২-বাইটে নরমালাইজ) → না থাকলে
 * ADMIN_PASSWORD থেকে ডেরাইভ (পাসওয়ার্ড বদলালে সব সেশন স্বয়ংক্রিয়ভাবে অবৈধ —
 * ইচ্ছাকৃত)। দুটোই না থাকলে **fail-closed** — যাচাই ব্যর্থ, তৈরি throw করে
 * (নতুন স্তর opt-in; legacy dev-ফেইল-ওপেন ADMIN_PASSWORD ফ্লোর জন্যই শুধু)।
 */
import type { SqlExecutor } from '../d1';
import { GENERATED_ENV } from '../generatedEnv';
import { genId, hmacSignB64url, randomBytes, sha256Hex, timingSafeEqualStr, toB64url } from './crypto';
import type { Role } from './roles';

/** নতুন স্তরের কুকি-নাম — legacy sk_admin-এর সাথে সহাবস্থান (docs/audits/p6-wiring-plan.md) */
export const SESSION_COOKIE = 'sk_session';
/** legacy কুকির মেয়াদের সমান (৩০ দিন) */
export const SESSION_TTL_DAYS = 30;
/** টোকেন ভার্সন-প্রিফিক্স — ভবিষ্যৎ ফরম্যাট-বদলে পুরোনোগুলো আলাদা করতে */
const TOKEN_VERSION = 'v1';

export interface SessionUser {
  id: string;
  tenantId: string;
  name: string;
  role: Role;
  outletId: string | null;
}

export interface SessionRecord {
  id: string;
  deviceLabel: string | null;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

export interface SessionContext {
  user: SessionUser;
  session: SessionRecord;
}

/** সাইনিং-কি (৩২ বাইট) — কনফিগার না থাকলে null = fail-closed */
async function signingKey(): Promise<Uint8Array | null> {
  const secret =
    GENERATED_ENV.SESSION_SECRET || process.env.SESSION_SECRET
    || GENERATED_ENV.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD
    || '';
  if (!secret) return null;
  return new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret)));
}

/** কুকি-হেডার থেকে সেশন-টোকেন (adminAuth-এর প্যাটার্নে) */
export function getSessionTokenFromRequest(request: Request): string | null {
  const header = request.headers.get('cookie') || '';
  const match = header.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function addDays(iso: string, days: number): string {
  return new Date(Date.parse(iso) + days * 86_400_000).toISOString();
}

/**
 * নতুন সেশন তৈরি — টেবিল-রেকর্ড + কুকি-যোগ্য টোকেন ফেরত।
 * সাইনিং-কি না থাকলে throw (opt-in স্তর — কনফিগ ছাড়া দুর্ঘটনায় চালু হবে না)।
 */
export async function createSession(
  exec: SqlExecutor,
  opts: { tenantId: string; userId: string; deviceLabel?: string | null; ip?: string | null; ttlDays?: number }
): Promise<{ token: string; sessionId: string; expiresAt: string }> {
  const key = await signingKey();
  if (!key) throw new Error('সেশন-সাইনিং-কি নেই — SESSION_SECRET (বা ADMIN_PASSWORD) কনফিগার করুন');

  const sessionId = genId();
  const random = toB64url(randomBytes(32)); // ২৫৬-বিট
  const payload = `${sessionId}.${random}`;
  const sig = await hmacSignB64url(key, payload);
  const token = `${TOKEN_VERSION}.${payload}.${sig}`;

  const now = new Date().toISOString();
  const expiresAt = addDays(now, opts.ttlDays ?? SESSION_TTL_DAYS);
  await exec.query(
    `INSERT INTO sessions (id, tenant_id, user_id, token_hash, device_label, ip, created_at, updated_at, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [sessionId, opts.tenantId, opts.userId, await sha256Hex(payload), opts.deviceLabel ?? null, opts.ip ?? null, now, now, expiresAt]
  );
  return { token, sessionId, expiresAt };
}

/**
 * টোকেন যাচাই → সেশন-কনটেক্সট, অথবা null (যেকোনো কারণে অবৈধ)।
 * ধাপ: ফরম্যাট → HMAC স্বাক্ষর (ধ্রুব-সময়) → ডিবি-রেকর্ড (id + token_hash) →
 * revoke/মেয়াদ/ইউজার-সক্রিয়তা। fail-closed: সাইনিং-কি না থাকলেও null।
 */
export async function verifySessionToken(exec: SqlExecutor, token: string): Promise<SessionContext | null> {
  const key = await signingKey();
  if (!key) return null;

  const parts = token.split('.');
  if (parts.length !== 4 || parts[0] !== TOKEN_VERSION) return null;
  const [, sessionId, random, sig] = parts;
  if (!sessionId || !random || !sig) return null;

  const payload = `${sessionId}.${random}`;
  const expected = await hmacSignB64url(key, payload);
  if (!timingSafeEqualStr(expected, sig)) return null;

  const rows = await exec.query<{
    id: string; user_id: string; device_label: string | null; created_at: string;
    expires_at: string; revoked_at: string | null; last_used_at: string | null;
    tenant_id: string; name: string; role: string; is_active: number; user_deleted_at: string | null; user_outlet_id: string | null;
  }>(
    `SELECT s.id, s.user_id, s.device_label, s.created_at, s.expires_at, s.revoked_at, s.last_used_at,
            u.id AS user_id, u.tenant_id, u.name, u.role, u.is_active, u.deleted_at AS user_deleted_at, u.outlet_id AS user_outlet_id
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.id = ? AND s.token_hash = ?`,
    [sessionId, await sha256Hex(payload)]
  );
  const row = rows[0];
  if (!row) return null;
  if (row.revoked_at) return null;
  if (Date.parse(row.expires_at) <= Date.now()) return null;
  if (!row.is_active || row.user_deleted_at) return null;

  return {
    user: { id: row.user_id, tenantId: row.tenant_id, name: row.name, role: row.role as Role, outletId: row.user_outlet_id },
    session: {
      id: row.id,
      deviceLabel: row.device_label,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
      revokedAt: row.revoked_at,
      lastUsedAt: row.last_used_at,
    },
  };
}

/** এক সেশন revoke (লগআউট) — এক-লাইনের নীরব হেল্পার */
export async function revokeSession(exec: SqlExecutor, tenantId: string, sessionId: string): Promise<void> {
  const now = new Date().toISOString();
  await exec.query('UPDATE sessions SET revoked_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ? AND revoked_at IS NULL', [now, now, sessionId, tenantId]);
}

/** 'সব ডিভাইস থেকে লগআউট' — ইউজারের সব সক্রিয় সেশন revoke */
export async function revokeAllSessions(exec: SqlExecutor, tenantId: string, userId: string): Promise<void> {
  const now = new Date().toISOString();
  await exec.query(
    'UPDATE sessions SET revoked_at = ?, updated_at = ? WHERE tenant_id = ? AND user_id = ? AND revoked_at IS NULL',
    [now, now, tenantId, userId]
  );
}

/** ডিভাইস তালিকা — শুধু সক্রিয় (অ-রিভোকড, মেয়াদ-ধরা) সেশন */
export async function listActiveSessions(exec: SqlExecutor, tenantId: string, userId: string): Promise<SessionRecord[]> {
  const rows = await exec.query<{
    id: string; device_label: string | null; created_at: string; expires_at: string;
    revoked_at: string | null; last_used_at: string | null;
  }>(
    `SELECT id, device_label, created_at, expires_at, revoked_at, last_used_at
     FROM sessions
     WHERE tenant_id = ? AND user_id = ? AND revoked_at IS NULL AND expires_at > ?
     ORDER BY created_at DESC`,
    [tenantId, userId, new Date().toISOString()]
  );
  return rows.map(r => ({
    id: r.id,
    deviceLabel: r.device_label,
    createdAt: r.created_at,
    expiresAt: r.expires_at,
    revokedAt: r.revoked_at,
    lastUsedAt: r.last_used_at,
  }));
}

/**
 * last_used_at আপডেট — কখনো throw না করে fire-and-forget ব্যবহারের জন্য।
 * (রুট-হট-পাথে `void touchSession(...)` — ব্যর্থতা সেশনকে আটকাবে না।)
 */
export async function touchSession(exec: SqlExecutor, tenantId: string, sessionId: string): Promise<void> {
  try {
    const now = new Date().toISOString();
    await exec.query('UPDATE sessions SET last_used_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?', [now, now, sessionId, tenantId]);
  } catch (e) {
    console.error('[session] last_used_at আপডেট ব্যর্থ:', (e as Error).message);
  }
}

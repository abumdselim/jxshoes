import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getD1Local } from '../d1Local';
import { createSession, verifySessionToken, revokeSession, revokeAllSessions, listActiveSessions, touchSession, getSessionTokenFromRequest, SESSION_COOKIE } from './session';

const TENANT = '01JXTENANTDEFAULT000000';
const NOW = '2026-10-03T00:00:00.000Z';
const SECRET = 'test-session-secret-for-p6';

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(__dirname, '../../../migrations/0001_init.sql'), 'utf8'));
  db.exec(readFileSync(join(__dirname, '../../../migrations/0003_users_sessions.sql'), 'utf8'));
  db.exec(`INSERT INTO tenants (id, name, slug, created_at, updated_at) VALUES ('${TENANT}', 'টেস্ট দোকান', 't', '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO users (id, tenant_id, name, role, is_active, created_at, updated_at) VALUES ('u-owner', '${TENANT}', 'মালিক', 'owner', 1, '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO users (id, tenant_id, name, role, is_active, created_at, updated_at) VALUES ('u-manager', '${TENANT}', 'ম্যানেজার', 'manager', 1, '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO users (id, tenant_id, name, role, is_active, created_at, updated_at) VALUES ('u-staff', '${TENANT}', 'ক্যাশিয়ার', 'salesman', 1, '${NOW}', '${NOW}')`);
});

beforeEach(() => {
  process.env.SESSION_SECRET = SECRET;
  delete process.env.ADMIN_PASSWORD;
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
  delete process.env.ADMIN_PASSWORD;
});

function reqWithCookie(token: string | null): Request {
  const headers = new Headers();
  if (token !== null) headers.set('cookie', `${SESSION_COOKIE}=${token}`);
  return new Request('https://example.com/api/test', { headers });
}

describe('createSession + verifySessionToken (D1/d1Local)', () => {
  it('হ্যাপি-পাথ: টোকেন ফরম্যাট v1.<id>.<random>.<sig>; ডিবিতে টোকেন নয়, শুধু SHA-256 হ্যাশ', async () => {
    const exec = getD1Local(db);
    const { token, sessionId, expiresAt } = await createSession(exec, { tenantId: TENANT, userId: 'u-owner', deviceLabel: 'দোকানের ট্যাব' });
    const parts = token.split('.');
    expect(parts).toHaveLength(4);
    expect(parts[0]).toBe('v1');
    expect(parts[1]).toBe(sessionId);
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now() + 29 * 86_400_000);

    const row = db.prepare('SELECT token_hash, device_label, revoked_at FROM sessions WHERE id = ?').get(sessionId) as { token_hash: string; device_label: string; revoked_at: null };
    expect(row.token_hash).toHaveLength(64); // hex SHA-256
    expect(row.token_hash).not.toContain(parts[2]); // random-প্লেইনটেক্সট ডিবিতে নেই
    expect(row.device_label).toBe('দোকানের ট্যাব');
    expect(row.revoked_at).toBeNull();

    const ctx = await verifySessionToken(exec, token);
    expect(ctx).not.toBeNull();
    expect(ctx!.user.id).toBe('u-owner');
    expect(ctx!.user.role).toBe('owner');
    expect(ctx!.user.tenantId).toBe(TENANT);
    expect(ctx!.session.id).toBe(sessionId);
  });

  it('কুকি-হেডার থেকে টোকেন পড়া (মাল্টি-কুকি সহ) + কুকি ছাড়া null', async () => {
    const exec = getD1Local(db);
    const { token } = await createSession(exec, { tenantId: TENANT, userId: 'u-owner' });
    expect(getSessionTokenFromRequest(reqWithCookie(token))).toBe(token);
    // কাঁচা মাল্টি-কুকি হেডার — মাঝে থাকা sk_admin/অন্য কুকি বিভ্রান্তি তৈরি করবে না
    const raw = new Request('https://example.com/api/test', { headers: { cookie: `other=x; sk_admin=legacyhash; ${SESSION_COOKIE}=${token}; y=1` } });
    expect(getSessionTokenFromRequest(raw)).toBe(token);
    expect(getSessionTokenFromRequest(reqWithCookie(null))).toBeNull();
  });

  it('টেম্পার্ড টোকেন (random বদল) → null — HMAC ধরে ফেলে', async () => {
    const exec = getD1Local(db);
    const { token } = await createSession(exec, { tenantId: TENANT, userId: 'u-owner' });
    const parts = token.split('.');
    const tampered = [...parts.slice(0, 2), parts[2].slice(0, -1) + (parts[2].endsWith('A') ? 'B' : 'A'), parts[3]].join('.');
    expect(await verifySessionToken(exec, tampered)).toBeNull();
    // সিগনেচার বদলালেও null
    const badSig = [...parts.slice(0, 3), parts[3].split('').reverse().join('')].join('.');
    expect(await verifySessionToken(exec, badSig)).toBeNull();
  });

  it('ভিন্ন সিক্রেটে সাইন-করা টোকেন → null (কি-ঘূর্ণন নিরাপদ)', async () => {
    const exec = getD1Local(db);
    const { token } = await createSession(exec, { tenantId: TENANT, userId: 'u-owner' });
    process.env.SESSION_SECRET = 'another-secret';
    expect(await verifySessionToken(exec, token)).toBeNull();
  });

  it('ভাঙা ফরম্যাট/গারবেজ → null (থ্রো নয়)', async () => {
    const exec = getD1Local(db);
    expect(await verifySessionToken(exec, '')).toBeNull();
    expect(await verifySessionToken(exec, 'garbage')).toBeNull();
    expect(await verifySessionToken(exec, 'v2.a.b.c')).toBeNull();
    expect(await verifySessionToken(exec, 'v1.a.b')).toBeNull();
  });

  it('সাইনিং-কি না থাকলে fail-closed: verify → null, create → throw', async () => {
    const exec = getD1Local(db);
    delete process.env.SESSION_SECRET;
    delete process.env.ADMIN_PASSWORD;
    await expect(verifySessionToken(exec, 'v1.a.b.c')).resolves.toBeNull();
    await expect(createSession(exec, { tenantId: TENANT, userId: 'u-owner' })).rejects.toThrow(/SESSION_SECRET/);
  });

  it('ADMIN_PASSWORD ফলব্যাক-কি: সেট থাকলে তাতেই সাইন/যাচাই চলে', async () => {
    delete process.env.SESSION_SECRET;
    process.env.ADMIN_PASSWORD = 'legacy-admin-pass';
    const exec = getD1Local(db);
    const { token } = await createSession(exec, { tenantId: TENANT, userId: 'u-manager' });
    expect(await verifySessionToken(exec, token)).not.toBeNull();
  });
});

describe('মেয়াদ / রিভোক / সক্রিয়তা', () => {
  it('মেয়াদ শেষ (ttlDays নেগেটিভ) → null', async () => {
    const exec = getD1Local(db);
    const { token } = await createSession(exec, { tenantId: TENANT, userId: 'u-owner', ttlDays: -1 });
    expect(await verifySessionToken(exec, token)).toBeNull();
  });

  it('একক লগআউট (revokeSession) → ওই টোকেন null; অন্য ডিভাইসের সেশন বেঁচে থাকে', async () => {
    const exec = getD1Local(db);
    const a = await createSession(exec, { tenantId: TENANT, userId: 'u-owner', deviceLabel: 'A' });
    const b = await createSession(exec, { tenantId: TENANT, userId: 'u-owner', deviceLabel: 'B' });
    await revokeSession(exec, TENANT, a.sessionId);
    expect(await verifySessionToken(exec, a.token)).toBeNull();
    expect(await verifySessionToken(exec, b.token)).not.toBeNull();
  });

  it("'সব ডিভাইস থেকে লগআউট' (revokeAllSessions) → ইউজারের সব টোকেন null; অন্য ইউজার অক্ষত", async () => {
    const exec = getD1Local(db);
    const a = await createSession(exec, { tenantId: TENANT, userId: 'u-manager', deviceLabel: 'A' });
    const b = await createSession(exec, { tenantId: TENANT, userId: 'u-manager', deviceLabel: 'B' });
    const other = await createSession(exec, { tenantId: TENANT, userId: 'u-staff', deviceLabel: 'C' });
    await revokeAllSessions(exec, TENANT, 'u-manager');
    expect(await verifySessionToken(exec, a.token)).toBeNull();
    expect(await verifySessionToken(exec, b.token)).toBeNull();
    expect(await verifySessionToken(exec, other.token)).not.toBeNull();
  });

  it('ইউজার নিষ্ক্রিয় (is_active=0) হলে সেশন অবৈধ', async () => {
    const exec = getD1Local(db);
    const s = await createSession(exec, { tenantId: TENANT, userId: 'u-staff' });
    db.prepare("UPDATE users SET is_active = 0 WHERE id = 'u-staff'").run();
    expect(await verifySessionToken(exec, s.token)).toBeNull();
    db.prepare("UPDATE users SET is_active = 1 WHERE id = 'u-staff'").run();
    expect(await verifySessionToken(exec, s.token)).not.toBeNull();
  });
});

describe('ডিভাইস তালিকা + last_used_at', () => {
  it('listActiveSessions: সক্রিয়গুলো দেখায়, রিভোকড/মেয়াদোত্তীর্ণ বাদ', async () => {
    const exec = getD1Local(db);
    const a = await createSession(exec, { tenantId: TENANT, userId: 'u-manager', deviceLabel: 'মোবাইল' });
    await createSession(exec, { tenantId: TENANT, userId: 'u-manager', deviceLabel: 'POS-কাউন্টার', ttlDays: -1 });
    const c = await createSession(exec, { tenantId: TENANT, userId: 'u-manager', deviceLabel: 'ল্যাপটপ' });
    await revokeSession(exec, TENANT, c.sessionId);

    const active = await listActiveSessions(exec, TENANT, 'u-manager');
    const labels = active.map(s => s.deviceLabel);
    expect(labels).toContain('মোবাইল');
    expect(labels).not.toContain('POS-কাউন্টার'); // মেয়াদ শেষ
    expect(labels).not.toContain('ল্যাপটপ'); // রিভোকড
  });

  it('touchSession: last_used_at সেট হয়; ব্যর্থ হলেও নীরব', async () => {
    const exec = getD1Local(db);
    const { sessionId } = await createSession(exec, { tenantId: TENANT, userId: 'u-owner' });
    await expect(touchSession(exec, TENANT, sessionId)).resolves.toBeUndefined();
    const row = db.prepare('SELECT last_used_at FROM sessions WHERE id = ?').get(sessionId) as { last_used_at: string };
    expect(row.last_used_at).toBeTruthy();
    // অজানা আইডি — নীরবে পাস
    await expect(touchSession(exec, TENANT, 'no-such-id')).resolves.toBeUndefined();
  });
});

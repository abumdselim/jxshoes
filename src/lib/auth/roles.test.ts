import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getD1Local } from '../d1Local';
import { can, costPriceVisible, requirePermission, getSessionContext, ROLES, type Action } from './roles';
import { createSession, SESSION_COOKIE } from './session';

const TENANT = '01JXTENANTDEFAULT000000';
const NOW = '2026-10-03T00:00:00.000Z';

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(__dirname, '../../../migrations/0001_init.sql'), 'utf8'));
  db.exec(readFileSync(join(__dirname, '../../../migrations/0003_users_sessions.sql'), 'utf8'));
  db.exec(`INSERT INTO tenants (id, name, slug, created_at, updated_at) VALUES ('${TENANT}', 'টেস্ট দোকান', 't', '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO users (id, tenant_id, name, role, is_active, created_at, updated_at) VALUES ('u-owner', '${TENANT}', 'মালিক', 'owner', 1, '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO users (id, tenant_id, name, role, is_active, created_at, updated_at) VALUES ('u-staff', '${TENANT}', 'ক্যাশিয়ার', 'salesman', 1, '${NOW}', '${NOW}')`);
});

beforeEach(() => {
  process.env.SESSION_SECRET = 'test-session-secret-for-p6';
});

afterEach(() => {
  delete process.env.SESSION_SECRET;
  delete process.env.ADMIN_PASSWORD;
});

function reqWithCookie(token: string | null): Request {
  const headers = new Headers();
  if (token !== null) headers.set('cookie', `${SESSION_COOKIE}=${token}`);
  return new Request('https://example.com/api/admin/products', { headers });
}

describe('পারমিশন-ম্যাট্রিক্স (owner/manager/salesman)', () => {
  it('owner = সব (স্পর্শকাতর অ্যাকশনসহ)', () => {
    for (const a of ['pos:sale', 'products:delete', 'users:manage', 'audit:read', 'expenses:manage', 'reports:finance'] as Action[]) {
      expect(can('owner', a), a).toBe(true);
    }
  });

  it('manager = ইনভেন্টরি/রিটার্ন-অনুমোদন/দৈনন্দিন; স্টাফ-অ্যাকাউন্ট/অডিট/খরচ/মোছা = না', () => {
    for (const a of ['pos:sale', 'orders:read', 'orders:update', 'products:read', 'products:write', 'inventory:write', 'returns:approve', 'customers:manage'] as Action[]) {
      expect(can('manager', a), a).toBe(true);
    }
    for (const a of ['users:manage', 'audit:read', 'expenses:manage', 'products:delete'] as Action[]) {
      expect(can('manager', a), a).toBe(false);
    }
  });

  it('salesman = শুধু POS/পড়া; ক্রয়মূল্য-লাভ ও মোছা = না (A4-র মূল ঝুঁকি)', () => {
    for (const a of ['pos:sale', 'orders:read', 'products:read'] as Action[]) {
      expect(can('salesman', a), a).toBe(true);
    }
    for (const a of ['products:readCost', 'reports:finance', 'products:delete', 'inventory:write', 'users:manage', 'returns:approve'] as Action[]) {
      expect(can('salesman', a), a).toBe(false);
    }
    expect(costPriceVisible('salesman')).toBe(false);
    expect(costPriceVisible('manager')).toBe(true);
    expect(costPriceVisible('owner')).toBe(true);
  });

  it('অজানা রোল-স্ট্রিং → সব false (fail-closed); ROLES টেবিল-enum-এর সাথে মেলে', () => {
    expect(can('hacker' as never, 'pos:sale')).toBe(false);
    expect(can('', 'pos:sale')).toBe(false);
    expect(ROLES).toEqual(['owner', 'manager', 'salesman']);
  });
});

describe('requirePermission / getSessionContext (আসল সেশন-গেট ফ্লো)', () => {
  it('কুকি নেই → 401 JSON (exec-এ ধোঁয়াও লাগে না)', async () => {
    const denied = await requirePermission(reqWithCookie(null), null as never, 'pos:sale');
    expect(denied).not.toBeNull();
    expect(denied!.status).toBe(401);
    expect(await denied!.json()).toMatchObject({ error: expect.stringContaining('লগইন') });
  });

  it('owner-সেশন: products:delete গেট পাস (null); salesman: সেম গেটে 403', async () => {
    const exec = getD1Local(db);
    const owner = await createSession(exec, { tenantId: TENANT, userId: 'u-owner' });
    const staff = await createSession(exec, { tenantId: TENANT, userId: 'u-staff' });

    const ownerDenied = await requirePermission(reqWithCookie(owner.token), exec, 'products:delete');
    expect(ownerDenied).toBeNull();

    const staffDenied = await requirePermission(reqWithCookie(staff.token), exec, 'products:delete');
    expect(staffDenied).not.toBeNull();
    expect(staffDenied!.status).toBe(403);
    expect(await staffDenied!.json()).toMatchObject({ error: expect.stringContaining('নিষিদ্ধ') });

    // কিন্তু salesman POS বিক্রি করতে পারে
    expect(await requirePermission(reqWithCookie(staff.token), exec, 'pos:sale')).toBeNull();
  });

  it('getSessionContext: বৈধ সেশনে পরিচয়, অবৈধে null', async () => {
    const exec = getD1Local(db);
    const { token } = await createSession(exec, { tenantId: TENANT, userId: 'u-staff' });
    const ctx = await getSessionContext(reqWithCookie(token), exec);
    expect(ctx!.user.role).toBe('salesman');
    expect(ctx!.user.name).toBe('ক্যাশিয়ার');
    expect(await getSessionContext(reqWithCookie('v1.x.y.z'), exec)).toBeNull();
  });

  it('কুকি-নাম legacy sk_admin-এর সাথে সংঘর্ষ নেই', () => {
    expect(SESSION_COOKIE).toBe('sk_session');
    expect(SESSION_COOKIE).not.toBe('sk_admin');
  });
});

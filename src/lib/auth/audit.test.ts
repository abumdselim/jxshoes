import { describe, it, expect, beforeAll, vi } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getD1Local } from '../d1Local';
import { writeAudit, type AuditEntry } from './audit';
import type { SqlExecutor } from '../d1';

const TENANT = '01JXTENANTDEFAULT000000';
const NOW = '2026-10-03T00:00:00.000Z';

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(__dirname, '../../../migrations/0001_init.sql'), 'utf8'));
  db.exec(`INSERT INTO tenants (id, name, slug, created_at, updated_at) VALUES ('${TENANT}', 'টেস্ট দোকান', 't', '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO users (id, tenant_id, name, role, is_active, created_at, updated_at) VALUES ('u-owner', '${TENANT}', 'মালিক', 'owner', 1, '${NOW}', '${NOW}')`);
});

const base: AuditEntry = {
  tenantId: TENANT,
  actorUserId: 'u-owner',
  entity: 'products',
  entityId: 'p-1',
  action: 'update',
};

describe('writeAudit (অডিট-লগ রাইটার)', () => {
  it('হ্যাপি-পাথ: কে/কখন/কী + আগে-পরে diff_json সঠিকভাবে সেভ', async () => {
    const exec = getD1Local(db);
    const ok = await writeAudit(exec, {
      ...base,
      diff: { price: { before: 100000, after: 120000 }, stock: { before: 5, after: 3 } },
    });
    expect(ok).toBe(true);
    const row = db.prepare('SELECT * FROM audit_log WHERE entity = ? AND entity_id = ?').get('products', 'p-1') as {
      actor_user_id: string; entity: string; action: string; diff_json: string; created_at: string; updated_at: string; deleted_at: null;
    };
    expect(row.actor_user_id).toBe('u-owner');
    expect(row.action).toBe('update');
    const diff = JSON.parse(row.diff_json) as Record<string, { before: unknown; after: unknown }>;
    expect(diff.price).toEqual({ before: 100000, after: 120000 });
    expect(diff.stock).toEqual({ before: 5, after: 3 });
    expect(row.created_at).toBeTruthy();
    expect(row.updated_at).toBeTruthy();
  });

  it('দাম-বদল/স্টক-অ্যাডজাস্ট/ডিসকাউন্ট/রিফান্ড/মোছা — একাধিক ইভেন্ট আলাদা রো-তে জমা হয়', async () => {
    const exec = getD1Local(db);
    await writeAudit(exec, { ...base, entityId: 'p-2', action: 'price_change', diff: { price: { before: 500, after: 450 } } });
    await writeAudit(exec, { ...base, entity: 'inventory', entityId: 'mv-9', action: 'stock_adjust', diff: { stock: { before: 10, after: 8 } } });
    await writeAudit(exec, { ...base, entity: 'orders', entityId: 'ord-7', action: 'reversal' });
    await writeAudit(exec, { ...base, entity: 'products', entityId: 'p-3', action: 'delete' });
    const n = (db.prepare('SELECT COUNT(*) AS n FROM audit_log').get() as { n: number }).n;
    expect(n).toBe(5); // আগের টেস্টের ১ + এই ৪
  });

  it('ব্যর্থ-লগইন: actor ছাড়া এন্ট্রি (actor_user_id NULL) — চেষ্টাকৃত শনাক্তকারী entity_id-তে', async () => {
    const exec = getD1Local(db);
    const ok = await writeAudit(exec, {
      tenantId: TENANT,
      actorUserId: null,
      entity: 'auth',
      entityId: '01711111111',
      action: 'login_failure',
    });
    expect(ok).toBe(true);
    const row = db.prepare("SELECT actor_user_id, diff_json FROM audit_log WHERE entity = 'auth' AND action = 'login_failure'").get() as {
      actor_user_id: null; diff_json: null;
    };
    expect(row.actor_user_id).toBeNull();
    expect(row.diff_json).toBeNull();
  });

  it('diff ছাড়া এন্ট্রি → diff_json NULL', async () => {
    const exec = getD1Local(db);
    await writeAudit(exec, { ...base, entityId: 'p-9', action: 'create' });
    const row = db.prepare("SELECT diff_json FROM audit_log WHERE entity_id = 'p-9'").get() as { diff_json: null };
    expect(row.diff_json).toBeNull();
  });

  it('মূল-নীতি: অডিট-লেখা ব্যর্থ হলেও throw নয়, false ফেরত — মূল অপারেশন আটকায় না', async () => {
    const brokenExec: SqlExecutor = {
      query: () => Promise.reject(new Error('ডিবি ডাউন')),
      batch: () => Promise.reject(new Error('ডিবি ডাউন')),
    };
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(writeAudit(brokenExec, base)).resolves.toBe(false);
    } finally {
      errSpy.mockRestore();
    }
  });
});

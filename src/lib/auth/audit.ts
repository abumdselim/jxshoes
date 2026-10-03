/**
 * অডিট-লগ রাইটার (P6, A4) — "কে, কখন, কী, আগে/পরে"।
 * টেবিল: audit_log (migrations/0001_init.sql §৫.৮ — ডিজাইনেই ছিল)।
 *
 * **নীতি:** অডিট-লেখা ব্যর্থ হলেও মূল ব্যবসায়িক অপারেশন আটকাবে না —
 * writeAudit কখনো throw করে না; boolean ফেরত দেয় আর কনসোলে লগ করে।
 * অর্ডার-টাইপ লেনদেনের ভেতরে ব্যবহার করলে মূল exec.batch-এর বাইরে রাখো,
 * নইলে অডিট-ব্যর্থতা লেনদেন রোলব্যাক করতে পারে।
 */
import type { SqlExecutor } from '../d1';
import { genId } from './crypto';

/** ফিল্ড-ভিত্তিক আগে/পরে — শুধু বদলানো ফিল্ড রাখাই স্বাভাবিক */
export interface AuditDiff {
  [field: string]: { before: unknown; after: unknown };
}

export interface AuditEntry {
  tenantId: string;
  /** কে করল — সিস্টেম/ব্যর্থ-লগইনে null হতে পারে (audit_log.actor_user_id nullable) */
  actorUserId?: string | null;
  actorDeviceId?: string | null;
  /** 'orders' | 'products' | 'users' | 'auth' | ... (টেবিল/ডোমেইন-নাম) */
  entity: string;
  /** টার্গেট রেকর্ড-আইডি; ব্যর্থ-লগইনে চেষ্টাকৃত শনাক্তকারী (ফোন ইত্যাদি) */
  entityId: string;
  /** 'create' | 'update' | 'delete' | 'reversal' | 'login_failure' | 'price_change' | ... */
  action: string;
  diff?: AuditDiff | null;
}

/** অডিট-লেখা — কখনো throw না করে; true = সেভ হয়েছে */
export async function writeAudit(exec: SqlExecutor, entry: AuditEntry): Promise<boolean> {
  try {
    const now = new Date().toISOString();
    await exec.query(
      `INSERT INTO audit_log (id, tenant_id, actor_user_id, actor_device_id, entity, entity_id, action, diff_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        genId(),
        entry.tenantId,
        entry.actorUserId ?? null,
        entry.actorDeviceId ?? null,
        entry.entity,
        entry.entityId,
        entry.action,
        entry.diff ? JSON.stringify(entry.diff) : null,
        now,
        now,
      ]
    );
    return true;
  } catch (e) {
    // অডিট-ব্যর্থতা মূল অপারেশন আটকাবে না — শুধু চিৎকার করে জানাও
    console.error(`[audit] লেখা ব্যর্থ (${entry.entity}/${entry.action}) — মূল অপারেশন চলমান:`, (e as Error).message);
    return false;
  }
}

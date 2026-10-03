/**
 * লোকাল/টেস্ট-এক্সিকিউটর (P5) — Node-এর বিল্ট-ইন node:sqlite দিয়ে SqlExecutor ইমপ্ল।
 * শুধু টেস্ট ও স্ক্রিপ্টে ব্যবহৃত — অ্যাপ-বান্ডলে ইমপোর্ট করবে না।
 * চালাতে Node ≥ 22 লাগে (node:sqlite)।
 */
import { DatabaseSync } from 'node:sqlite';
import type { SqlExecutor, SqlStatement } from './d1';

/** node:sqlite-এর বাইন্ড-টাইপ (unknown → SQLInputValue) */
type Bind = string | number | bigint | Uint8Array | null;
const bind = (params?: unknown[]): Bind[] => (params ?? []).map(p => {
  if (p === null || p === undefined) return null;
  if (typeof p === 'string' || typeof p === 'number' || typeof p === 'bigint') return p;
  if (p instanceof Uint8Array) return p;
  return String(p);
}) as Bind[];

export function getD1Local(db: DatabaseSync): SqlExecutor {
  return {
    query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      return Promise.resolve(db.prepare(sql).all(...bind(params)) as T[]);
    },
    async batch<T>(statements: SqlStatement[]): Promise<T[][]> {
      db.exec('BEGIN');
      try {
        const results: T[][] = [];
        for (const s of statements) {
          try {
            results.push(db.prepare(s.sql).all(...bind(s.params)) as T[]);
          } catch (e) {
            throw new Error(`ব্যাচ-স্টেটমেন্ট ব্যর্থ: ${s.sql.slice(0, 200)} — ${(e as Error).message}`);
          }
        }
        db.exec('COMMIT');
        return results;
      } catch (err) {
        db.exec('ROLLBACK');
        throw err;
      }
    },
  };
}

export { DatabaseSync };

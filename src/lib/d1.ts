/**
 * D1 SQL এক্সিকিউটর (P5) — repos সব এই ইন্টারফেসের ওপর লেখা, তাই একই কোড
 * প্রোডাকশন (REST) ও টেস্ট (node:sqlite, দেখুন src/lib/d1Local.ts) — দুই ব্যাকএন্ডে চলে।
 * অ্যাক্সেস-প্যাটার্ন ইচ্ছাকৃতভাবে KV-র REST প্যাটার্নেরই সমান — P3-এর বাইন্ডিং-
 * মাইগ্রেশনে শুধু এই ফাইলের ইমপ্ল বদলাবে, repos নয়।
 */
import { GENERATED_ENV } from './generatedEnv';
import { getCfEnv } from './cfEnv';

export interface SqlStatement {
  sql: string;
  params?: unknown[];
}

export interface SqlExecutor {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  /** অ্যাটমিক ব্যাচ — একটা স্টেটমেন্ট ভাঙলে সব রোলব্যাক (লেনদেন) */
  batch<T = unknown>(statements: SqlStatement[]): Promise<T[][]>;
}

/** একক-দোকান মাইগ্রেশনের ফিক্সড টেনান্ট (P7 মাল্টি-টেনান্সিতে প্রতি-টেনান্ট হবে) */
export const DEFAULT_TENANT_ID = '01JXTENANTDEFAULT000000';

/** স্ট্রিং SQL-লিটারাল এস্কেপ (ব্যাচ/মাইগ্রেশন-স্ক্রিপ্টের জন্য; সাধারণ কোয়েরিতে params ব্যবহার করো) */
export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  if (typeof v === 'boolean') return v ? '1' : '0';
  return `'${String(v).replace(/'/g, "''")}'`;
}

function d1DatabaseId(): string {
  // database_id সিক্রেট নয় (identifier) — .env/generatedEnv-এ থাকে
  const id = GENERATED_ENV.D1_DATABASE_ID || process.env.D1_DATABASE_ID || '';
  if (!id) throw new Error('D1_DATABASE_ID কনফিগার করা নেই (.env বা deploy.yml-এ)');
  return id;
}

/** params ? -গুলো বাঁ-থেকে-ডানে literal বসিয়ে এক স্ট্রিং স্টেটমেন্ট বানায় */
function inlineParams(sql: string, params?: unknown[]): string {
  let i = 0;
  const out = sql.replace(/\?/g, () => sqlLiteral((params ?? [])[i++]));
  return out.endsWith(';') ? out : `${out};`;
}

/** প্রোডাকশন এক্সিকিউটর — Cloudflare D1 HTTP API (CLOUDFLARE_API_TOKEN দিয়ে) */
export function getD1Rest(): SqlExecutor {
  const { accountId, apiToken } = getCfEnv();
  const base = `https://api.cloudflare.com/client/v4/accounts/${accountId}/d1/database/${d1DatabaseId()}`;
  const headers = { Authorization: `Bearer ${apiToken}`, 'Content-Type': 'application/json' };

  async function call(body: unknown): Promise<{ results: unknown[] }[]> {
    const res = await fetch(`${base}/query`, { method: 'POST', headers, body: JSON.stringify(body) });
    const json = (await res.json()) as { success: boolean; errors?: { message: string }[]; result?: { results: unknown[] }[] };
    if (!json.success) throw new Error(`D1 query ব্যর্থ: ${JSON.stringify(json.errors ?? json)}`);
    return json.result ?? [];
  }

  return {
    async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
      const [r] = await call({ sql, params: params ?? [] });
      return (r?.results ?? []) as T[];
    },
    async batch<T>(statements: SqlStatement[]): Promise<T[][]> {
      // REST-পাথে এক /query-কল = এক অ্যাটমিক ইমপ্লিসিট লেনদেন (explicit BEGIN/COMMIT
      // D1 নিষেধ করে — কোড 7500)। REST-এ params বাঁধা যায় না, তাই literal-ইনলাইন।
      // নেটিভ বাইন্ডিং-এ গেলে (P3) এটা d1.batch()-এ বদলাবে।
      const sql = statements.map(s => inlineParams(s.sql, s.params)).join('\n');
      const results = await call({ sql });
      return results.map(r => r.results as T[]);
    },
  };
}

/** একই অপ-কি দ্বিতীয়বার এলে আগের ফল ফেরত (P5 ধাপ ৩ — ডাবল-সাবমিশন সুরক্ষা) */
export async function idempotencyCheck(
  exec: SqlExecutor,
  tenantId: string,
  opKey: string
): Promise<{ done: boolean; resultRef: string | null }> {
  const rows = await exec.query<{ result_ref: string | null; status: string }>(
    'SELECT result_ref, status FROM idempotency_keys WHERE tenant_id = ? AND op_key = ?',
    [tenantId, opKey]
  );
  if (rows.length === 0) return { done: false, resultRef: null };
  return { done: rows[0].status === 'done', resultRef: rows[0].result_ref };
}

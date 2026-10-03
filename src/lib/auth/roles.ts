/**
 * রোল মডেল + অ্যাকশন-গেট (P6) — S3/A4।
 *
 * রোল-নাম migrations/0001_init.sql-এর users.role CHECK-এর হুবহু ফলো করে:
 *   'owner' | 'manager' | 'salesman'  (টাস্ক-ভাষার 'staff'/ক্যাশিয়ার ≡ salesman)
 *
 * পারমিশন-ম্যাট্রিক্স (P6 স্পেক):
 *   - salesman (ক্যাশিয়ার) = শুধু POS/বিক্রি; ক্রয়মূল্য/লাভ দেখা বন্ধ; কিছুই মুছতে পারে না
 *   - manager = ইনভেন্টরি (পণ্য/স্টক), রিটার্ন অনুমোদন, দৈনন্দিন অর্ডার/গ্রাহক;
 *     স্টাফ-ব্যবস্থাপনা/সেটিংস/অডিট/খরচ = না
 *   - owner = সব ('*')
 * ম্যাট্রিক্স শুধু এই ফাইলে — রুটের requirePermission(action) কল-সাইট বদলাতে হয় না।
 */
import type { SqlExecutor } from '../d1';
import { getSessionTokenFromRequest, verifySessionToken, type SessionContext } from './session';

export type Role = 'owner' | 'manager' | 'salesman';

export const ROLES: readonly Role[] = ['owner', 'manager', 'salesman'];

/** সূক্ষ্ম-দানায় অ্যাকশন (রুট/রুট-গ্রুপ ভিত্তিক) — প্রয়োজনে নতুন যোগ হবে */
export type Action =
  | 'pos:sale'            // POS-বিক্রি
  | 'orders:read'         // অর্ডার-তালিকা/বিস্তারিত
  | 'orders:update'       // স্ট্যাটাস/ডেলিভারি বদল
  | 'products:read'       // ক্যাটালগ দেখা (cost ছাড়া)
  | 'products:readCost'   // ক্রয়মূল্য/লাভ-সহ দেখা (reports:finance-এর পূর্বশর্ত)
  | 'products:write'      // পণ্য তৈরি/এডিট
  | 'products:delete'     // পণ্য মোছা
  | 'inventory:write'     // restock/adjust/স্টক-অ্যাডজাস্ট
  | 'customers:manage'    // গ্রাহক-খাতা
  | 'coupons:manage'      // কুপন/ডিসকাউন্ট
  | 'marketing:manage'    // ব্যানার/ফ্ল্যাশ-ডিল
  | 'media:manage'        // ছবি আপলোড/মিডিয়া-লাইব্রেরি
  | 'reports:read'        // বিক্রয়-রিপোর্ট (লাভ ছাড়া)
  | 'reports:finance'     // লাভ-ক্ষতি/ফাইন্যান্স (ক্রয়মূল্য-নির্ভর)
  | 'expenses:manage'     // খরচের খাতা
  | 'returns:approve'     // রিটার্ন/রিফান্ড অনুমোদন
  | 'users:manage'        // স্টাফ-অ্যাকাউন্ট/রোল
  | 'audit:read';         // অডিট-লগ পড়া

/** রোল → অনুমোদিত অ্যাকশন। owner '*'; বাকিদের তালিকা স্পষ্ট-তালিকাভুক্ত। */
const ROLE_ACTIONS: Record<Role, readonly (Action | '*')[]> = {
  owner: ['*'],
  manager: [
    'pos:sale', 'orders:read', 'orders:update',
    'products:read', 'products:readCost', 'products:write',
    'inventory:write', 'customers:manage', 'coupons:manage',
    'marketing:manage', 'media:manage', 'reports:read', 'returns:approve',
  ],
  salesman: ['pos:sale', 'orders:read', 'products:read'],
};

/** রোল অ্যাকশনটা পারে কি না (অজানা রোল-স্ট্রিং → false) */
export function can(role: string | Role, action: Action): boolean {
  const allowed = ROLE_ACTIONS[role as Role];
  if (!allowed) return false;
  if (allowed.includes('*')) return true;
  return allowed.includes(action);
}

/** ক্রয়মূল্য/লাভ দেখার অনুমতি (সুবিধা-হেল্পার — API পেলোডে costPrice বাদ দিতেও ব্যবহৃত হবে) */
export function costPriceVisible(role: string | Role): boolean {
  return can(role, 'products:readCost');
}

/** গেট-ফলাফল — requirePermission null = অনুমতি আছে */
export type PermissionDenied = Response;
export type PermissionResult = SessionContext | PermissionDenied;

function unauthorized(): Response {
  return new Response(JSON.stringify({ error: 'অননুমোদিত — লগইন প্রয়োজন' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}

function forbidden(action: Action): Response {
  return new Response(JSON.stringify({ error: `নিষিদ্ধ — এই কাজের অনুমতি নেই (${action})` }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * অ্যাকশন-গেট — adminAuth.requireAdmin-এর চুক্তির সেশন-যুগের উত্তরসূরি:
 * সেশন নেই/অবৈধ → 401; সেশন আছে কিন্তু রোল অনুমতি দেয় না → 403;
 * অনুমতি আছে → null (রুট শুধু `if (denied) return denied;`)।
 * পরিচয় দরকার হলে ভিন্ন হেল্পার: getSessionContext()।
 */
export async function requirePermission(
  request: Request,
  exec: SqlExecutor,
  action: Action
): Promise<PermissionDenied | null> {
  const token = getSessionTokenFromRequest(request);
  if (!token) return unauthorized();
  const ctx = await verifySessionToken(exec, token);
  if (!ctx) return unauthorized();
  if (!can(ctx.user.role, action)) return forbidden(action);
  return null;
}

/**
 * সেশন-কনটেক্সট (পরিচয়) — গেট নয়; রুটে requirePermission-এর পরে বা
 * শুধু-পরিচয় দরকারের জায়গায়। অবৈধ/নেই → null।
 */
export async function getSessionContext(request: Request, exec: SqlExecutor): Promise<SessionContext | null> {
  const token = getSessionTokenFromRequest(request);
  if (!token) return null;
  return verifySessionToken(exec, token);
}

/**
 * apiFetch — সব /api/ কলের জন্য fetch-ড্রপ-ইন।
 * - অনলাইনে: সরাসরি সার্ভার (আচরণ আগের মতোই) + ব্যাকগ্রাউন্ডে মিরর ফ্রেশ রাখে
 * - অফলাইনে/নেটওয়ার্ক ব্যর্থ: GET মিরর থেকে; মিউটেশন মিররে প্রয়োগ + Outbox-এ সারি +
 *   synthetic Response (পেজগুলোর if (res.ok) লজিক অক্ষত থাকে)
 * - AI (/api/ai) ও লগইন (/api/admin-login) কখনো কিউ হয় না
 */
import type { FullStoreData } from '@/types/fullStoreData';
import { localId, outboxPut, OutboxOp } from './db';
import { loadMirror, persistMirror, loadBriefCache, loadNotificationsCache, saveNotificationsCache } from './snapshot';
import { applyMutation } from './appliers';
import { scheduleSync, broadcast } from './sync';

export function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

function jsonResponse(payload: unknown, status = 200, offline = false): Response {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (offline) headers['X-JX-Offline'] = '1';
  return new Response(JSON.stringify(payload), { status, headers });
}

const offlineAiMessage = 'অফলাইন মোড — এই AI ফিচারটির জন্য ইন্টারনেট সংযোগ প্রয়োজন।';
const offlineNoMirrorMessage = 'অফলাইন — এই ডেটার লোকাল কপি এখনো তৈরি হয়নি। একবার ইন্টারনেটে খুললেই অফলাইনেও দেখা যাবে।';

/** অফলাইন পরিবর্তনের সিঙ্ক-সেন্টার লেবেল বানায় */
function opLabel(method: string, path: string, body?: Record<string, unknown>): string {
  if (method === 'POST' && path === '/api/orders') return `নতুন অর্ডার: ${String(body?.customerName || '')}`;
  if (method === 'POST' && path === '/api/pos/sale') return 'দোকানে বিক্রি (POS)';
  if (method === 'POST' && path === '/api/expenses') return `খরচ: ${String(body?.category || '')} — ৳${String(body?.amount || '')}`;
  if (method === 'POST' && path === '/api/products') return `নতুন প্রোডাক্ট: ${String(body?.name || '')}`;
  if (method.startsWith('PUT') && path.startsWith('/api/products/')) return `প্রোডাক্ট আপডেট: ${String(body?.name || '')}`;
  if (method.startsWith('DELETE') && path.startsWith('/api/products/')) return 'প্রোডাক্ট মুছে ফেলা';
  if (method === 'POST' && path === '/api/customers') return `কাস্টমার: ${String(body?.name || '')}`;
  if (method === 'POST' && path === '/api/customers/payment') return `বাকি আদায়: ৳${String(body?.amount || '')}`;
  if (method === 'POST' && path === '/api/inventory') return body?.action === 'restock' ? 'স্টক রিস্টক' : 'স্টক অ্যাডজাস্টমেন্ট';
  if (method === 'POST' && path === '/api/settings') return 'সেটিংস আপডেট';
  if (method === 'POST' && path === '/api/marketing') return 'ব্যানার/ডিল আপডেট';
  if (path.startsWith('/api/notifications')) return 'নোটিফিকেশন আপডেট';
  if (method === 'POST' && path === '/api/feedback') return 'কাস্টমার মতামত';
  return `${method} ${path.replace('/api/', '')}`;
}

async function enqueueOp(method: string, path: string, body: unknown, label: string): Promise<void> {
  const op: OutboxOp = {
    id: localId('op'),
    method,
    url: path,
    body,
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
    label,
  };
  await outboxPut(op);
  broadcast({ type: 'ops-changed' });
  scheduleSync(3000);
}

/** নোটিফিকেশন ক্যাশে লোকাল প্রয়োগ (নোটিফিকেশন মিরর-ব্লবের বাইরে) */
async function applyNotificationMutation(
  method: string,
  body: Record<string, unknown> | undefined
): Promise<{ status: number; payload: unknown } | null> {
  const list = await loadNotificationsCache();
  if (method === 'PUT') {
    const ids = body?.all ? list.map(n => n.id) : [String(body?.id || '')];
    let count = 0;
    for (const n of list) {
      if (ids.includes(n.id) && !n.read) {
        n.read = true;
        count++;
      }
    }
    await saveNotificationsCache(list);
    return { status: 200, payload: { ok: true, count } };
  }
  if (method === 'DELETE') {
    const ids = (body?.ids as string[] | undefined) || (body?.id ? [String(body.id)] : []);
    const remaining = list.filter(n => !ids.includes(n.id));
    await saveNotificationsCache(remaining);
    return { status: 200, payload: { ok: true, count: ids.length } };
  }
  return null;
}

/** মিররের deep clone — appliers নিজের মতো বদলাতে পারে, মূল নষ্ট হয় না */
function cloneMirror(data: FullStoreData): FullStoreData {
  return typeof structuredClone === 'function' ? structuredClone(data) : (JSON.parse(JSON.stringify(data)) as FullStoreData);
}

export async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method || 'GET').toUpperCase();
  const isApi = path.startsWith('/api/');

  if (!isApi) return fetch(path, init);

  // ---------- GET ----------
  if (method === 'GET') {
    if (!isOffline()) {
      try {
        const res = await fetch(path, init);
        if (res.ok) {
          scheduleSync(4000); // মিরর ফ্রেশ রাখা (sync.ts-এর ভেতরে থ্রটল করা)
          return res;
        }
        // সার্ভার এরর হলেও মিরর ফলব্যাক চেষ্টা করবে
      } catch {
        // নেটওয়ার্ক ব্যর্থ — মিরর ফলব্যাক
      }
    }
    // অফলাইন ফলব্যাক
    if (path.startsWith('/api/ai')) {
      const brief = await loadBriefCache();
      if (brief) return jsonResponse(brief, 200, true);
      return jsonResponse({ error: offlineAiMessage }, 503, true);
    }
    const mirror = await loadMirror();
    if (!mirror) return jsonResponse({ error: offlineNoMirrorMessage }, 503, true);
    const { buildOfflineGet } = await import('./appliers');
    const local = await buildOfflineGet(mirror, path);
    if (local) return jsonResponse(local.payload, local.status, true);
    return jsonResponse({ error: offlineNoMirrorMessage }, 503, true);
  }

  // ---------- AI: কখনো কিউ হয় না ----------
  if (path.startsWith('/api/ai')) {
    try {
      return await fetch(path, init);
    } catch {
      return jsonResponse({ error: offlineAiMessage }, 503, true);
    }
  }

  // ---------- লগইন: কখনো কিউ হয় না ----------
  if (path === '/api/admin-login') {
    return fetch(path, init);
  }

  // ---------- নোটিফিকেশন: লোকাল ক্যাশে প্রয়োগ + কিউ ----------
  if (path.startsWith('/api/notifications')) {
    let nBody: Record<string, unknown> | undefined;
    try {
      nBody = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined;
    } catch {
      nBody = undefined;
    }
    const local = await applyNotificationMutation(method, nBody);
    if (local) {
      await enqueueOp(method, path, nBody, 'নোটিফিকেশন আপডেট');
      return jsonResponse(local.payload, local.status, true);
    }
    return fetch(path, init);
  }

  // ---------- মিউটেশন ----------
  const attemptNetwork = !isOffline();
  if (attemptNetwork) {
    try {
      const res = await fetch(path, init);
      if (res.ok) {
        scheduleSync(4000); // মিরর ফ্রেশ রাখা
        return res;
      }
      if (res.status >= 400 && res.status < 500) {
        // ক্লায়েন্ট-এরর (যেমন 404/400) — এটা কিউ করলে ভুল ডেটা হবে; যেমন আছে তেমন ফেরত
        return res;
      }
      // 5xx — নিচে অফলাইন পথে যাবে
    } catch {
      // নেটওয়ার্ক ব্যর্থ — অফলাইন পথে
    }
  }

  // FormData (ইমেজ আপলোড) — অফলাইনে data-URI প্রিভিউ; সার্ভারের R2-ফলব্যাক পথের মতোই
  if (init?.body instanceof FormData) {
    const file = (init.body.get('file') as File | null) || null;
    if (file) {
      try {
        const dataUri = await fileToDataUri(file);
        return jsonResponse({ url: dataUri, offline: true }, 200, true);
      } catch {
        return jsonResponse({ error: 'অফলাইনে ছবি প্রসেস করা গেল না' }, 503, true);
      }
    }
    return jsonResponse({ error: offlineNoMirrorMessage }, 503, true);
  }

  // JSON বডি পার্স
  let body: Record<string, unknown> | undefined;
  try {
    body = init?.body ? (JSON.parse(init.body as string) as Record<string, unknown>) : undefined;
  } catch {
    body = undefined;
  }

  const mirror = await loadMirror();
  if (mirror) {
    const working = cloneMirror(mirror);
    const result = await applyMutation(working, method, path, body);
    if (result) {
      if (result.status < 400) {
        await persistMirror(working);
        await enqueueOp(method, path, body, result.label || opLabel(method, path, body));
      }
      return jsonResponse(result.payload, result.status, true);
    }
  }

  // অজানা রুট (যেমন /api/feedback) — জেনেরিক কিউ: সার্ভার পরে রিপ্লে করবে
  await enqueueOp(method, path, body, opLabel(method, path, body));
  return jsonResponse({ ok: true, offlineQueued: true }, 200, true);
}

function fileToDataUri(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

/**
 * সিঙ্ক ইঞ্জিন — ইন্টারনেট ফিরলে Outbox-এর অফলাইন পরিবর্তনগুলো FIFO-তে সার্ভারে
 * রিপ্লে করে, ব্যর্থগুলো 'failed' করে সিঙ্ক সেন্টারে দেখায়, শেষে সার্ভার স্ন্যাপশট
 * টেনে মিররকে চূড়ান্ত সত্যের সাথে মিলিয়ে দেয়।
 * রিপ্লে সরাসরি fetch দিয়ে — apiFetch দিয়ে নয় (দুবার কিউ এড়াতে)।
 */
import { outboxGetAll, outboxDelete, outboxPut, kvGet, kvSet, OutboxOp } from './db';
import { pullSnapshot, loadMeta, loadMirror, saveReportsCache, saveBriefCache, saveMediaCache } from './snapshot';
import type { StoredReport, AIDailyBrief } from '@/types';

/** navigator.onLine === false হলে নিশ্চিত অফলাইন (apiFetch থেকে আলাদা — সাইকেল এড়াতে) */
function isOffline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine === false;
}

/**
 * লোকাল-আইডি → সার্ভার-আইডি ম্যাপ (রাউন্ড-জুড়ে IDB-তে থাকে)।
 * অফলাইনে তৈরি কাস্টমার/প্রোডাক্ট/অর্ডারের রেফারেন্স রিপ্লে-র সময়
 * স্বয়ংক্রিয়ভাবে সার্ভার-আইডিতে রূপান্তর হয় — নইলে dependent অপ 404 খায়।
 */
const IDMAP_KEY = 'idMap';

async function loadIdMap(): Promise<Map<string, string>> {
  const stored = await kvGet<[string, string][]>(IDMAP_KEY);
  return new Map(stored || []);
}

async function saveIdMap(map: Map<string, string>): Promise<void> {
  await kvSet(IDMAP_KEY, Array.from(map));
}

let syncing = false;
let lastRoutineSyncAt = 0;
let scheduleTimer: ReturnType<typeof setTimeout> | null = null;

// ---------- ট্যাব-জুড়ে সমন্বয় ----------
let channel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!channel) channel = new BroadcastChannel('jx-offline-sync');
  return channel;
}

export type SyncEvent =
  | { type: 'ops-changed' }
  | { type: 'synced'; pending: number; failed: number; lastSyncAt: string }
  | { type: 'sync-start' };

export function broadcast(event: SyncEvent): void {
  try {
    getChannel()?.postMessage(event);
  } catch {
    // ব্রডকাস্ট ঐচ্ছিক
  }
}

export function onSyncEvent(handler: (event: SyncEvent) => void): () => void {
  const ch = getChannel();
  if (!ch) return () => {};
  const listener = (e: MessageEvent) => handler(e.data as SyncEvent);
  ch.addEventListener('message', listener);
  return () => ch.removeEventListener('message', listener);
}

// ---------- শিডিউলিং ----------
/**
 * ডিলে দিয়ে সিঙ্ক কিউ করে। force=true হলে ৩০ সেকেন্ডের রুটিন-থ্রটল এড়িয়ে যায়
 * (নতুন অফলাইন অপ কিউ হলে / online ইভেন্টে)।
 */
export function scheduleSync(delayMs = 0, force = false): void {
  if (typeof window === 'undefined') return;
  if (scheduleTimer !== null) return; // ইতিমধ্যে কিউ-ড আছে
  const sinceRoutine = Date.now() - lastRoutineSyncAt;
  if (!force && delayMs === 0 && sinceRoutine < 30000) return; // রুটিন থ্রটল
  scheduleTimer = setTimeout(() => {
    scheduleTimer = null;
    void syncNow(force || sinceRoutine > 30000);
  }, Math.max(0, delayMs));
}

export interface SyncResult {
  ran: boolean;
  replayed: number;
  failed: number;
  pendingLeft: number;
}

/** এক রাউন্ড সিঙ্ক: রিপ্লে → স্ন্যাপশট → ব্রডকাস্ট */
export async function syncNow(force = false): Promise<SyncResult> {
  if (syncing || typeof window === 'undefined') {
    return { ran: false, replayed: 0, failed: 0, pendingLeft: -1 };
  }
  if (isOffline()) return { ran: false, replayed: 0, failed: 0, pendingLeft: -1 };

  // ট্যাব-জুড়ে একসাথে দুই সিঙ্ক এড়াতে Web Lock (সাপোর্ট না থাকলে সরাসরি)
  const locks = (navigator as Navigator & { locks?: { request: (name: string, cb: () => Promise<void>) => Promise<unknown> } }).locks;
  if (locks?.request) {
    let result: SyncResult = { ran: false, replayed: 0, failed: 0, pendingLeft: -1 };
    await locks.request('jx-offline-sync', async () => {
      result = await runSyncRound(force);
    });
    return result;
  }
  return runSyncRound(force);
}

async function runSyncRound(force: boolean): Promise<SyncResult> {
  syncing = true;
  broadcast({ type: 'sync-start' });
  try {
    const all = await outboxGetAll();
    const pending = all
      .filter(op => op.status === 'pending')
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const failedCount = all.filter(op => op.status === 'failed').length;

    let replayed = 0;
    let newlyFailed = 0;

    if (pending.length > 0) {
      const idMap = await loadIdMap();
      const remap = (text: string) => {
        let out = text;
        for (const [k, v] of idMap) out = out.split(k).join(v);
        return out;
      };

      for (const op of pending) {
        // লোকাল-আইডি → সার্ভার-আইডি রূপান্তর (URL ও বডি দুই জায়গায়)
        const url = remap(op.url);
        const bodyStr = op.body !== undefined ? remap(JSON.stringify(op.body)) : undefined;
        try {
          const res = await fetch(url, {
            method: op.method,
            headers: { 'Content-Type': 'application/json' },
            body: bodyStr,
          });
          if (res.ok) {
            // তৈরি হওয়া এন্টিটির server-id ম্যাপে রাখা — পরের অপগুলোর রেফারেন্স ঠিক হয়
            if (op.ref) {
              const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
              if (json && typeof json === 'object') {
                const nested = ['product', 'order', 'customer', 'expense', 'coupon'] as const;
                let serverId: unknown = json.id;
                for (const key of nested) {
                  if (serverId === undefined && json[key] && typeof json[key] === 'object') {
                    serverId = (json[key] as Record<string, unknown>).id;
                  }
                }
                if (serverId) {
                  // কী = খালি লোকাল আইডি — আইডিতেই টাইপ-প্রিফিক্স এমবেডেড (cust-off-/prod-off-…)।
                  // টাইপ-প্রিফিক্সসহ কী দিলে remap-এর সাধারণ স্ট্রিং-ম্যাচ কখনোই খুঁজে পেত না।
                  idMap.set(op.ref.id, String(serverId));
                  await saveIdMap(idMap);
                }
              }
            }
            await outboxDelete(op.id);
            replayed++;
          } else if (res.status === 429) {
            // রেট-লিমিট — এই রাউন্ড থামাও (পরের রাউন্ডে আবার)
            break;
          } else if (res.status >= 400 && res.status < 500) {
            // সার্ভার চিরকালের জন্য প্রত্যাখ্যান করল — failed হিসেবে দেখাও, ডেটা হারাবে না
            op.attempts++;
            op.lastError = `সার্ভার বলছে: ${res.status}`;
            op.status = 'failed';
            await outboxPut(op);
            newlyFailed++;
          } else {
            // 5xx — এই অপ পরে আবার চেষ্টা হবে; রাউন্ড চলতে থাকে (বাকি অপ আটকে পড়বে না)
            op.attempts++;
            if (op.attempts >= 8) {
              op.status = 'failed';
              op.lastError = `সার্ভার বারবার ব্যর্থ (${res.status})`;
            }
            await outboxPut(op);
          }
        } catch {
          // নেটওয়ার্ক এখনো ভাঙা — পুরো রাউন্ড বাতিল
          syncing = false;
          return { ran: false, replayed: 0, failed: failedCount, pendingLeft: pending.length };
        }
      }
    }

    // মিরর রিফ্রেশ — রিপ্লে হলে বাধ্যতামূলক, নাহলে মিরর পুরনো হলে (≥৫ মিনিট) বা জোরে
    const meta = await loadMeta();
    const mirror = await loadMirror();
    const staleMs = meta.lastSyncAt ? Date.now() - new Date(meta.lastSyncAt).getTime() : Infinity;
    if (replayed > 0 || !mirror || force || staleMs > 5 * 60 * 1000) {
      const snap = await pullSnapshot();
      if (snap) await refreshSideCaches();
    }

    lastRoutineSyncAt = Date.now();
    const remaining = await outboxGetAll();
    const pendingLeft = remaining.filter(op => op.status === 'pending').length;
    const failedLeft = remaining.filter(op => op.status === 'failed').length;
    const lastSyncAt = new Date().toISOString();
    broadcast({ type: 'synced', pending: pendingLeft, failed: failedLeft, lastSyncAt });
    return { ran: true, replayed, failed: newlyFailed, pendingLeft };
  } finally {
    syncing = false;
  }
}

/** মিররের বাইরের ছোট ক্যাশগুলো (রিপোর্ট/ব্রিফ/মিডিয়া) — ব্যর্থ হলে চুপচাপ এড়িয়ে যায় */
async function refreshSideCaches(): Promise<void> {
  try {
    const [reportsRes, mediaRes, briefRes] = await Promise.all([
      fetch('/api/reports', { cache: 'no-store' }),
      fetch('/api/media-library', { cache: 'no-store' }),
      fetch('/api/ai?action=daily-brief', { cache: 'no-store' }),
    ]);
    if (reportsRes.ok) await saveReportsCache((await reportsRes.json()) as StoredReport[]);
    if (mediaRes.ok) {
      const urls = await mediaRes.json();
      if (Array.isArray(urls)) await saveMediaCache(urls);
    }
    if (briefRes.ok) {
      const brief = (await briefRes.json()) as AIDailyBrief;
      if (brief && brief.date) await saveBriefCache(brief);
    }
  } catch {
    // ঐচ্ছিক ক্যাশ — ব্যর্থ হলেও সিঙ্ক সফল ধরা হবে
  }
}

// ---------- অটো-ট্রিগার (OfflineProvider init করে) ----------
export function initSyncListeners(): () => void {
  if (typeof window === 'undefined') return () => {};

  const onOnline = () => scheduleSync(0, true);
  const onVisible = () => {
    if (document.visibilityState === 'visible') scheduleSync(0);
  };
  const interval = setInterval(() => {
    if (!isOffline()) scheduleSync(0);
  }, 60000);

  window.addEventListener('online', onOnline);
  document.addEventListener('visibilitychange', onVisible);
  // প্রথম লোডে মিরর তৈরি/রিফ্রেশ
  scheduleSync(1500, true);

  return () => {
    window.removeEventListener('online', onOnline);
    document.removeEventListener('visibilitychange', onVisible);
    clearInterval(interval);
    if (scheduleTimer !== null) {
      clearTimeout(scheduleTimer);
      scheduleTimer = null;
    }
  };
}

// ---------- সিঙ্ক সেন্টার অ্যাকশন ----------
/** ব্যর্থ অপ আবার চেষ্টা — status পেন্ডিং করে সিঙ্ক চালায় */
export async function retryFailedOps(): Promise<void> {
  const all = await outboxGetAll();
  for (const op of all.filter(o => o.status === 'failed')) {
    op.status = 'pending';
    op.lastError = undefined;
    await outboxPut(op);
  }
  broadcast({ type: 'ops-changed' });
  await syncNow(true);
}

export async function discardFailedOps(): Promise<void> {
  const all = await outboxGetAll();
  for (const op of all.filter(o => o.status === 'failed')) {
    await outboxDelete(op.id);
  }
  broadcast({ type: 'ops-changed' });
}

export async function discardOp(id: string): Promise<void> {
  await outboxDelete(id);
  broadcast({ type: 'ops-changed' });
}

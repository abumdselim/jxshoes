/**
 * অফলাইন মিরর — সার্ভারের পুরো স্টোর (FullStoreData) ব্রাউজারের IndexedDB-তে রাখে।
 * সিঙ্ক ইঞ্জিন এটা টানে/রিফ্রেশ করে; apiFetch অফলাইনে এখান থেকে পড়ে।
 */
import type { FullStoreData } from '@/types/fullStoreData';
import type { NotificationItem, StoredReport, AIDailyBrief, Order } from '@/types';
import { kvGet, kvSet } from './db';

export interface MirrorMeta {
  rev: number;
  lastSyncAt: string | null;
  /** 'admin' = পূর্ণ স্ন্যাপশট; 'public' = স্টোরফ্রন্ট-সেফ ডেটা (অর্ডার/কাস্টমার/খরচ খালি) */
  scope: 'admin' | 'public';
}

const K_MIRROR = 'mirror';
const K_META = 'meta';
const K_NOTIFICATIONS = 'notifications';
const K_REPORTS = 'reports';
const K_BRIEF = 'dailyBrief';
const K_MEDIA = 'mediaLibrary';
const K_LOCAL_ORDERS = 'localOrders'; // পাবলিক স্কোপে অফলাইনে করা অর্ডার — স্ন্যাপশট রিফ্রেশেও টিকে থাকে

// ইন-মেমোরি কপি — বারবার IndexedDB পড়া এড়াতে
let memoryMirror: FullStoreData | null = null;
let memoryMeta: MirrorMeta = { rev: 0, lastSyncAt: null, scope: 'admin' };

export async function loadMirror(): Promise<FullStoreData | null> {
  if (memoryMirror) return memoryMirror;
  const stored = await kvGet<FullStoreData>(K_MIRROR);
  memoryMirror = stored;
  return stored;
}

export async function loadMeta(): Promise<MirrorMeta> {
  const stored = await kvGet<Partial<MirrorMeta>>(K_META);
  if (stored) {
    memoryMeta = {
      rev: stored.rev ?? 0,
      lastSyncAt: stored.lastSyncAt ?? null,
      scope: stored.scope === 'public' ? 'public' : 'admin',
    };
  }
  return memoryMeta;
}

export async function saveMirror(data: FullStoreData, rev?: number, lastSyncAt?: string, scope?: 'admin' | 'public'): Promise<void> {
  memoryMirror = data;
  const meta = await loadMeta();
  memoryMeta = {
    rev: rev !== undefined ? rev : meta.rev,
    lastSyncAt: lastSyncAt !== undefined ? lastSyncAt : meta.lastSyncAt,
    scope: scope ?? meta.scope,
  };
  await kvSet(K_MIRROR, data);
  await kvSet(K_META, memoryMeta);
}

/** মিররে মিউটেশন প্রয়োগের পরে ডাকা হয় — IndexedDB-তে লেখে */
export async function persistMirror(data: FullStoreData): Promise<void> {
  memoryMirror = data;
  await kvSet(K_MIRROR, data);
}

// ---------- notifications / reports / brief / media ক্যাশ ----------
export async function loadNotificationsCache(): Promise<NotificationItem[]> {
  return (await kvGet<NotificationItem[]>(K_NOTIFICATIONS)) || [];
}

export async function saveNotificationsCache(list: NotificationItem[]): Promise<void> {
  await kvSet(K_NOTIFICATIONS, list);
}

export async function loadReportsCache(): Promise<StoredReport[]> {
  return (await kvGet<StoredReport[]>(K_REPORTS)) || [];
}

export async function saveReportsCache(list: StoredReport[]): Promise<void> {
  await kvSet(K_REPORTS, list);
}

export async function loadBriefCache(): Promise<AIDailyBrief | null> {
  return await kvGet<AIDailyBrief>(K_BRIEF);
}

export async function saveBriefCache(brief: AIDailyBrief | null): Promise<void> {
  await kvSet(K_BRIEF, brief);
}

export async function loadMediaCache(): Promise<string[]> {
  return (await kvGet<string[]>(K_MEDIA)) || [];
}

export async function saveMediaCache(urls: string[]): Promise<void> {
  await kvSet(K_MEDIA, urls);
}

// ---------- সিঙ্ক স্ন্যাপশট ----------
export interface SyncSnapshot {
  scope: 'admin' | 'public';
  data: Partial<FullStoreData>;
  notifications: NotificationItem[];
  rev: number;
  serverTime: string;
}

/** স্ন্যাপশটকে সম্পূর্ণ FullStoreData শেপে নরমালাইজ করে (পাবলিক স্কোপে অ্যাডমিন-কালেকশন খালি) */
function normalizeSnapshot(data: Partial<FullStoreData>): FullStoreData {
  return {
    products: data.products || [],
    orders: data.orders || [],
    categories: data.categories || [],
    storeSettings: data.storeSettings || ({} as FullStoreData['storeSettings']),
    heroBanner: data.heroBanner || ({} as FullStoreData['heroBanner']),
    flashDeal: data.flashDeal || ({} as FullStoreData['flashDeal']),
    coupons: data.coupons || [],
    inventoryMovements: data.inventoryMovements || [],
    customers: data.customers || [],
    expenses: data.expenses || [],
    duePayments: data.duePayments || [],
  };
}

// ---------- পাবলিক স্কোপের লোকাল অর্ডার (অফলাইন চেকআউট) ----------
export async function getLocalOrders(): Promise<Order[]> {
  return (await kvGet<Order[]>(K_LOCAL_ORDERS)) || [];
}

export async function addLocalOrder(order: Order): Promise<void> {
  const list = await getLocalOrders();
  list.unshift(order);
  await kvSet(K_LOCAL_ORDERS, list.slice(0, 50));
}

/** স্ন্যাপশট পুলের পরে পাবলিক মিররে লোকাল অর্ডার ফিরিয়ে আনা (সিঙ্কে হারিয়ে যাবে না) */
export async function mergeLocalOrdersIntoMirror(): Promise<void> {
  const meta = await loadMeta();
  if (meta.scope !== 'public') return;
  const mirror = await loadMirror();
  if (!mirror) return;
  const localOrders = await getLocalOrders();
  if (localOrders.length === 0) return;
  const existing = new Set(mirror.orders.map(o => o.id));
  const missing = localOrders.filter(o => !existing.has(o.id));
  if (missing.length > 0) {
    mirror.orders = [...missing, ...mirror.orders];
    await persistMirror(mirror);
  }
}

/** সিঙ্ক রিপ্লে সফল হলে লোকাল অর্ডার তালিকা সাফ (সার্ভার এখন সত্য) */
export async function clearLocalOrders(): Promise<void> {
  await kvSet(K_LOCAL_ORDERS, []);
}

/** সার্ভার থেকে পুরো স্ন্যাপশট টেনে মিররে সেভ করে; ব্যর্থ হলে null */
export async function pullSnapshot(): Promise<SyncSnapshot | null> {
  try {
    const res = await fetch('/api/sync', { cache: 'no-store' });
    if (!res.ok) return null;
    const snap = (await res.json()) as SyncSnapshot;
    if (!snap || !snap.data) return null;
    const scope = snap.scope === 'public' ? 'public' : 'admin';
    const normalized = normalizeSnapshot(snap.data);
    const nowIso = new Date().toISOString();
    await saveMirror(normalized, snap.rev, nowIso, scope);
    await saveNotificationsCache(snap.notifications || []);
    await mergeLocalOrdersIntoMirror();
    return { ...snap, scope, data: normalized };
  } catch {
    return null;
  }
}

/**
 * হালকা IndexedDB র‍্যাপার — কোনো বাহ্যিক ডিপেন্ডেন্সি নয়।
 * স্টোর: `kv` (মিরর/মেটা/ক্যাশ) ও `outbox` (অফলাইন মিউটেশন সারি)।
 * IndexedDB না থাকলে (পুরনো ব্রাউজার/প্রাইভেট মোড) মেমোরিতেই চলে — সেশন শেষে হারায়।
 */

const DB_NAME = 'jxshoes-offline';
const DB_VERSION = 1;
export const STORE_KV = 'kv';
export const STORE_OUTBOX = 'outbox';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memoryFallback = new Map<string, unknown>();

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise(resolve => {
    if (typeof indexedDB === 'undefined') {
      resolve(null);
      return;
    }
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_KV)) db.createObjectStore(STORE_KV);
        if (!db.objectStoreNames.contains(STORE_OUTBOX)) db.createObjectStore(STORE_OUTBOX, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T | null> {
  return openDb().then(
    db =>
      new Promise<T | null>(resolve => {
        if (!db) {
          resolve(null);
          return;
        }
        try {
          const transaction = db.transaction(storeName, mode);
          const request = run(transaction.objectStore(storeName));
          request.onsuccess = () => resolve(request.result as T);
          request.onerror = () => resolve(null);
          transaction.onabort = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

// ---------- মেমোরি ফলব্যাক কি (IndexedDB অনুপলব্ধ হলে) ----------
const memKey = (store: string, key: IDBValidKey) => `${store}::${String(key)}`;

export async function kvGet<T>(key: string): Promise<T | null> {
  const fromDb = await tx<T>(STORE_KV, 'readonly', s => s.get(key) as IDBRequest<T>);
  if (fromDb !== null) return fromDb;
  const mem = memoryFallback.get(memKey(STORE_KV, key));
  return mem !== undefined ? (mem as T) : null;
}

export async function kvSet(key: string, value: unknown): Promise<void> {
  const dbWorked = await tx(STORE_KV, 'readwrite', s => s.put(value, key) as IDBRequest<unknown>);
  if (dbWorked === null) memoryFallback.set(memKey(STORE_KV, key), value);
}

export async function outboxGetAll(): Promise<OutboxOp[]> {
  const fromDb = await tx<OutboxOp[]>(STORE_OUTBOX, 'readonly', s => s.getAll() as IDBRequest<OutboxOp[]>);
  if (fromDb !== null) return fromDb;
  const list: OutboxOp[] = [];
  for (const [k, v] of Array.from(memoryFallback)) {
    if (k.startsWith(`${STORE_OUTBOX}::`)) list.push(v as OutboxOp);
  }
  return list;
}

export async function outboxPut(op: OutboxOp): Promise<void> {
  const dbWorked = await tx(STORE_OUTBOX, 'readwrite', s => s.put(op) as IDBRequest<unknown>);
  if (dbWorked === null) memoryFallback.set(memKey(STORE_OUTBOX, op.id), op);
}

export async function outboxDelete(id: string): Promise<void> {
  const dbWorked = await tx(STORE_OUTBOX, 'readwrite', s => s.delete(id) as unknown as IDBRequest<unknown>);
  if (dbWorked === null) memoryFallback.delete(memKey(STORE_OUTBOX, id));
}

export async function outboxClear(): Promise<void> {
  const dbWorked = await tx(STORE_OUTBOX, 'readwrite', s => s.clear() as unknown as IDBRequest<unknown>);
  if (dbWorked === null) {
    for (const k of Array.from(memoryFallback.keys())) {
      if (k.startsWith(`${STORE_OUTBOX}::`)) memoryFallback.delete(k);
    }
  }
}

// ---------- টাইপ ----------
/** অফলাইনে করা একটি পরিবর্তনের সারি-নথি */
export interface OutboxOp {
  id: string;
  method: string;
  url: string;
  body?: unknown;
  createdAt: string;
  attempts: number;
  lastError?: string;
  status: 'pending' | 'failed';
  /** সিঙ্ক সেন্টারে দেখানোর বাংলা লেবেল, যেমন "নতুন খরচ: বিদ্যুৎ বিল" */
  label: string;
}

/** কলিশন-সেফ লোকাল আইডি — সার্ভারের Date.now() আইডির সাথে ধরা খাবে না */
export function localId(prefix: string): string {
  const uuid =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}-off-${Date.now()}-${uuid}`;
}

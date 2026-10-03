'use client';

/**
 * অফলাইন-সিঙ্ক প্রোভাইডার — রুট লেআউটে মাউন্ট করা (শপ + অ্যাডমিন দুটোই কভার)।
 * অটো-সিঙ্ক লিসেনার চালু করে, সিঙ্ক স্ট্যাটাস context দেয়, অফলাইন ব্যানার ও
 * সিঙ্ক সেন্টার প্যানেল রেন্ডার করে।
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { RefreshCw, CloudOff, Cloud, AlertTriangle, X, CheckCircle2, Loader2 } from 'lucide-react';
import { outboxGetAll, OutboxOp } from './db';
import { loadMeta } from './snapshot';
import { initSyncListeners, onSyncEvent, syncNow, retryFailedOps, discardFailedOps, discardOp } from './sync';

export interface SyncStatus {
  online: boolean;
  pending: number;
  failed: number;
  syncing: boolean;
  lastSyncAt: string | null;
  ops: OutboxOp[];
  syncNow: () => Promise<void>;
}

const SyncStatusContext = createContext<SyncStatus | null>(null);

export function useSyncStatus(): SyncStatus | null {
  return useContext(SyncStatusContext);
}

// ---------- বাংলা সংখ্যা ----------
const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
function bn(value: number | string): string {
  return String(value).replace(/\d/g, d => BN_DIGITS[Number(d)]);
}

function timeAgoBn(iso: string | null): string {
  if (!iso) return 'এখনো হয়নি';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'এইমাত্র';
  if (mins < 60) return `${bn(mins)} মিনিট আগে`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${bn(hours)} ঘণ্টা আগে`;
  return `${bn(Math.floor(hours / 24))} দিন আগে`;
}

export default function OfflineProvider({ children }: { children: React.ReactNode }) {
  const [online, setOnline] = useState(true);
  const [pending, setPending] = useState(0);
  const [failed, setFailed] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [ops, setOps] = useState<OutboxOp[]>([]);
  const [centerOpen, setCenterOpen] = useState(false);

  const refresh = useCallback(async () => {
    const all = await outboxGetAll();
    setPending(all.filter(op => op.status === 'pending').length);
    setFailed(all.filter(op => op.status === 'failed').length);
    setOps(all);
    const meta = await loadMeta();
    setLastSyncAt(meta.lastSyncAt);
    setOnline(navigator.onLine);
  }, []);

  const handleSyncNow = useCallback(async () => {
    setSyncing(true);
    try {
      await syncNow(true);
    } finally {
      setSyncing(false);
      await refresh();
    }
  }, [refresh]);

  useEffect(() => {
    setOnline(navigator.onLine);
    void refresh();
    const stopInit = initSyncListeners();

    // ব্রাউজার যেন স্টোরেজ স্বেচ্ছায় না মুছে ফেলে — নইলে সিঙ্ক-হয়নি বিক্রি হারাতে পারে (P8 কুইক-উইন)
    if (typeof navigator !== 'undefined' && navigator.storage?.persist) {
      navigator.storage.persist().catch(() => {});
    }

    // PWA সার্ভিস ওয়ার্কার — শপ + অ্যাডমিন সব পেজ থেকে রেজিস্টার (অফলাইন শেল)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const onOnline = () => void refresh();
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);

    const stopEvents = onSyncEvent(event => {
      if (event.type === 'sync-start') setSyncing(true);
      if (event.type === 'synced') setSyncing(false);
      void refresh();
    });
    const poll = setInterval(() => void refresh(), 15000);

    return () => {
      stopInit();
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      stopEvents();
      clearInterval(poll);
    };
  }, [refresh]);

  const status: SyncStatus = {
    online,
    pending,
    failed,
    syncing,
    lastSyncAt,
    ops,
    syncNow: handleSyncNow,
  };

  const showBanner = !online || pending > 0 || failed > 0;

  return (
    <SyncStatusContext.Provider value={status}>
      {children}
      {showBanner && (
        <div className="fixed bottom-20 md:bottom-4 left-3 md:left-4 z-[45] max-w-[calc(100vw-1.5rem)]">
          <button
            onClick={() => setCenterOpen(v => !v)}
            className={`flex items-center gap-2.5 rounded-lg px-4 py-2.5 text-left text-xs font-bold border transition ${
              !online
                ? 'bg-slate-900 text-white border-slate-700'
                : failed > 0
                  ? 'bg-red-600 text-white border-red-700'
                  : 'bg-white text-slate-800 border-slate-200'
            }`}
          >
            {!online ? (
              <CloudOff className="w-4 h-4 flex-shrink-0 text-slate-300" />
            ) : failed > 0 ? (
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            ) : syncing ? (
              <Loader2 className="w-4 h-4 flex-shrink-0 animate-spin" />
            ) : (
              <Cloud className="w-4 h-4 flex-shrink-0 text-orange-600" />
            )}
            <span>
              {!online
                ? 'অফলাইন মোড — পরিবর্তনগুলো সংরক্ষিত, ইন্টারনেট এলে স্বয়ংক্রিয়ভাবে সিঙ্ক হবে'
                : failed > 0
                  ? `${bn(failed)}টি পরিবর্তন সিঙ্ক ব্যর্থ — বিস্তারিত দেখুন`
                  : syncing
                    ? 'সিঙ্ক হচ্ছে…'
                    : `${bn(pending)}টি পরিবর্তন সিঙ্ক অপেক্ষায়`}
            </span>
          </button>
        </div>
      )}
      {centerOpen && (
        <SyncCenter
          ops={ops}
          online={online}
          syncing={syncing}
          lastSyncAt={lastSyncAt}
          onClose={() => setCenterOpen(false)}
          onSync={handleSyncNow}
          onRefresh={refresh}
        />
      )}
    </SyncStatusContext.Provider>
  );
}

// ================== সিঙ্ক সেন্টার প্যানেল ==================
function SyncCenter({
  ops,
  online,
  syncing,
  lastSyncAt,
  onClose,
  onSync,
  onRefresh,
}: {
  ops: OutboxOp[];
  online: boolean;
  syncing: boolean;
  lastSyncAt: string | null;
  onClose: () => void;
  onSync: () => Promise<void>;
  onRefresh: () => Promise<void>;
}) {
  const pendingOps = ops.filter(op => op.status === 'pending').sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const failedOps = ops.filter(op => op.status === 'failed');

  const handleRetry = async () => {
    await retryFailedOps();
    await onRefresh();
  };
  const handleDiscardAll = async () => {
    await discardFailedOps();
    await onRefresh();
  };
  const handleDiscardOne = async (id: string) => {
    await discardOp(id);
    await onRefresh();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-t-xl sm:rounded-xl w-full sm:max-w-md max-h-[80vh] flex flex-col border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h3 className="text-base font-bold text-slate-900">সিঙ্ক সেন্টার</h3>
          <button onClick={onClose} className="p-1.5 rounded-md text-slate-500 hover:bg-slate-100" aria-label="বন্ধ করুন">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-bold">
              {online ? (
                <>
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" /> অনলাইন
                </>
              ) : (
                <>
                  <span className="w-2 h-2 rounded-full bg-slate-400 inline-block" /> অফলাইন
                </>
              )}
            </div>
            <div className="mt-0.5">শেষ সিঙ্ক: {timeAgoBn(lastSyncAt)}</div>
          </div>
          <button
            onClick={() => void onSync()}
            disabled={!online || syncing}
            className="flex items-center gap-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-3.5 py-2 text-xs font-bold"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
            এখনই সিঙ্ক করুন
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
          {ops.length === 0 && (
            <div className="flex flex-col items-center py-10 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-500" />
              <p className="mt-3 text-sm font-bold text-slate-800">সব পরিবর্তন সিঙ্ক সম্পন্ন</p>
              <p className="mt-1 text-xs text-slate-500">অফলাইনে করা কিছু এখন অপেক্ষমাণ নেই।</p>
            </div>
          )}

          {pendingOps.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">
                সিঙ্ক অপেক্ষায় ({bn(pendingOps.length)})
              </p>
              <ul className="space-y-2">
                {pendingOps.map(op => (
                  <li key={op.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3.5 py-2.5">
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-800 truncate">{op.label}</p>
                      <p className="text-xs text-slate-400">{timeAgoBn(op.createdAt)} করা হয়েছে</p>
                    </div>
                    <button
                      onClick={() => void handleDiscardOne(op.id)}
                      className="text-xs font-bold text-slate-400 hover:text-red-600 flex-shrink-0"
                    >
                      বাদ দিন
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {failedOps.length > 0 && (
            <div>
              <p className="text-xs font-bold text-red-500 uppercase tracking-wide mb-2">
                ব্যর্থ ({bn(failedOps.length)})
              </p>
              <ul className="space-y-2">
                {failedOps.map(op => (
                  <li key={op.id} className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-800 truncate">{op.label}</p>
                        <p className="text-xs text-red-600">{op.lastError || 'সার্ভার প্রত্যাখ্যান করেছে'}</p>
                      </div>
                      <button
                        onClick={() => void handleDiscardOne(op.id)}
                        className="text-xs font-bold text-slate-400 hover:text-red-600 flex-shrink-0"
                      >
                        বাদ দিন
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => void handleRetry()}
                  disabled={!online}
                  className="rounded-lg bg-orange-600 hover:bg-orange-700 disabled:opacity-50 text-white px-3.5 py-2 text-xs font-bold"
                >
                  আবার চেষ্টা করুন
                </button>
                <button
                  onClick={() => void handleDiscardAll()}
                  className="rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 px-3.5 py-2 text-xs font-bold"
                >
                  ব্যর্থগুলো বাদ দিন
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

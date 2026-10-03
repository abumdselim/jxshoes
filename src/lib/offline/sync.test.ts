/**
 * অফলাইন লেয়ারের ইন্টিগ্রেশন টেস্ট — আসল apiFetch → মিরর → আউটবক্স → syncNow রিপ্লে কোডপথ।
 * Node-এ IndexedDB নেই, তাই db.ts-এর মেমরি-ফলব্যাকই স্টোর হিসেবে চলে (প্রতি টেস্টে ফ্রেশ মডিউল)।
 * সার্ভার fetch মক করা — রেসপন্স শেপ আসল রাউটগুলোর হুবহু (NextResponse.json আউটপুট)।
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { FullStoreData } from '@/types/fullStoreData';
import type { Product } from '@/types';

// প্রতি টেস্টে ফ্রেশ মডিউল-গ্রাফ — মেমরি-ফলব্যাক স্টেট টেস্ট-জুড়ে লিক না করে
let db: typeof import('./db');
let snapshot: typeof import('./snapshot');
let apiFetch: typeof import('./apiFetch')['apiFetch'];
let sync: typeof import('./sync');

const jsonRes = (payload: unknown, status = 200) =>
  new Response(JSON.stringify(payload), { status, headers: { 'Content-Type': 'application/json' } });

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'prod-1',
    sku: 'SK-SH-101',
    barcode: '890100123456',
    name: 'ক্লাসিক স্নিকার',
    slug: 'classic-sneaker',
    description: '',
    price: 2000,
    costPrice: 1300,
    category: 'shoes',
    subCategory: 'General',
    sizes: ['40', '41'],
    colors: [{ name: 'Black', hex: '#000000' }],
    images: ['img.jpg'],
    inStock: true,
    stockCount: 10,
    minStockAlert: 3,
    supplier: 'সরবরাহকারী',
    variants: [],
    isFeatured: false,
    rating: 5,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  };
}

function makeStore(overrides: Partial<FullStoreData> = {}): FullStoreData {
  return {
    products: [],
    orders: [],
    categories: [],
    storeSettings: {} as FullStoreData['storeSettings'],
    heroBanner: {} as FullStoreData['heroBanner'],
    flashDeal: {} as FullStoreData['flashDeal'],
    coupons: [],
    inventoryMovements: [],
    customers: [],
    expenses: [],
    duePayments: [],
    ...overrides,
  };
}

const op = (overrides: Partial<import('./db').OutboxOp>): import('./db').OutboxOp => ({
  id: 'op-test',
  method: 'POST',
  url: '/api/customers',
  body: {},
  createdAt: '2026-10-03T10:00:00.000Z',
  attempts: 0,
  status: 'pending',
  label: 'টেস্ট অপ',
  ...overrides,
});

beforeEach(() => {
  vi.resetModules();
  // syncNow/scheduleSync-এর window-গার্ড পাস করাতে; আসল ব্রাউজার API লাগে না
  vi.stubGlobal('window', globalThis);
  // scheduleSync-এর ৩ সেকেন্ডের টাইমার টেস্ট-শেষে ফায়ার হয়ে পরের টেস্টের মক-fetch না ছুঁয়ে দেয়
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

async function loadModules() {
  db = await import('./db');
  snapshot = await import('./snapshot');
  sync = await import('./sync');
  const api = await import('./apiFetch');
  apiFetch = api.apiFetch;
}

async function seedMirror(store: FullStoreData) {
  await snapshot.saveMirror(store, 1, new Date().toISOString(), 'admin');
}

describe('apiFetch অফলাইন মিউটেশন (মিরর + আউটবক্স)', () => {
  beforeEach(async () => {
    vi.stubGlobal('navigator', { onLine: false });
    await loadModules();
    await seedMirror(makeStore());
  });

  it('POST /api/customers — synthetic 201, মিররে কাস্টমার, আউটবক্সে ref-সহ pending অপ', async () => {
    const res = await apiFetch('/api/customers', {
      method: 'POST',
      body: JSON.stringify({ name: 'রহিম', phone: '01712345678' }),
    });

    expect(res.status).toBe(201);
    expect(res.headers.get('X-JX-Offline')).toBe('1');
    const payload = (await res.json()) as { id: string; name: string };
    expect(payload.id).toMatch(/^cust-off-/);

    const mirror = await snapshot.loadMirror();
    expect(mirror?.customers).toHaveLength(1);
    expect(mirror?.customers[0].id).toBe(payload.id);

    const ops = await db.outboxGetAll();
    expect(ops).toHaveLength(1);
    expect(ops[0].status).toBe('pending');
    expect(ops[0].ref).toEqual({ type: 'customer', id: payload.id });
  });

  it('POST /api/orders — স্টক মিররে কাটে, অর্ডার ref-সহ কিউ হয়', async () => {
    await seedMirror(makeStore({ products: [makeProduct()] }));

    const res = await apiFetch('/api/orders', {
      method: 'POST',
      body: JSON.stringify({
        customerName: 'করিম',
        phone: '01898765432',
        paymentMethod: 'Cash on Delivery',
        items: [{ productId: 'prod-1', name: 'ক্লাসিক স্নিকার', price: 2000, quantity: 2, selectedSize: '40', selectedColor: 'Black' }],
      }),
    });

    expect(res.status).toBe(201);
    const order = (await res.json()) as { id: string; items: unknown[] };
    expect(order.id).toMatch(/^ord-off-/);

    const mirror = await snapshot.loadMirror();
    expect(mirror?.products[0].stockCount).toBe(8); // 10 − 2
    expect(mirror?.orders).toHaveLength(1);
    expect(mirror?.customers[0].phone).toBe('01898765432'); // ফোনে কাস্টমার আপসার্ট

    const ops = await db.outboxGetAll();
    expect(ops).toHaveLength(1);
    expect(ops[0].ref).toEqual({ type: 'order', id: order.id });
  });

  it('PUT /api/products/:id — আংশিক বডি নয়, মিলিয়ে-নেওয়া সম্পূর্ণ প্রোডাক্ট কিউ হয় (replayBody)', async () => {
    await seedMirror(makeStore({ products: [makeProduct({ name: 'পুরনো নাম', price: 2000 })] }));

    const res = await apiFetch('/api/products/prod-1', {
      method: 'PUT',
      body: JSON.stringify({ price: 2500 }),
    });

    expect(res.status).toBe(200);
    const mirror = await snapshot.loadMirror();
    expect(mirror?.products[0].price).toBe(2500);

    const ops = await db.outboxGetAll();
    const queuedBody = ops[0].body as Record<string, unknown>;
    expect(queuedBody.price).toBe(2500);
    expect(queuedBody.name).toBe('পুরনো নাম'); // সার্ভারে PUT পুরো অবজেক্ট চায় — শুধু {price} গেলে বাকি ফিল্ড মুছে যেত
  });

  it('POST /api/coupons/validate — তিন ব্রাঞ্চেই রিড-অনলি: কিউ হয় না, মিরর অপরিবর্তিত', async () => {
    await seedMirror(
      makeStore({
        coupons: [{ id: 'coup-1', code: 'EID50', discountType: 'fixed', value: 50, minOrder: 1000, active: true }],
      })
    );

    const invalid = await apiFetch('/api/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'NOPE', orderTotal: 500 }),
    });
    expect(((await invalid.json()) as { valid: boolean }).valid).toBe(false);

    const belowMin = await apiFetch('/api/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'EID50', orderTotal: 500 }),
    });
    expect(((await belowMin.json()) as { valid: boolean }).valid).toBe(false);

    const valid = await apiFetch('/api/coupons/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'eid50', orderTotal: 2000 }),
    });
    expect((await valid.json()) as { valid: boolean; discount: number }).toEqual({ valid: true, discount: 50, message: expect.any(String) });

    expect(await db.outboxGetAll()).toHaveLength(0); // ফেচ মক নেই — এখানে পৌঁছালেই বোঝা যাবে কিউ হয়নি
  });

  it('GET /api/products অফলাইনে মিরর থেকে সার্ভ হয়', async () => {
    await seedMirror(makeStore({ products: [makeProduct()] }));

    const res = await apiFetch('/api/products');
    expect(res.status).toBe(200);
    expect(res.headers.get('X-JX-Offline')).toBe('1');
    const products = (await res.json()) as Product[];
    expect(products).toHaveLength(1);
    expect(products[0].id).toBe('prod-1');
  });
});

describe('syncNow রিপ্লে রাউন্ড (সার্ভার মক)', () => {
  beforeEach(async () => {
    vi.stubGlobal('navigator', { onLine: true });
    await loadModules();
    await seedMirror(makeStore());
  });

  /** রাউট-অনুযায়ী মক-হ্যান্ডলার; '/api/sync' দেওয়া না থাকলে ৫০০ (স্ন্যাপশট পুল বাদ) */
  function mockServer(routes: Record<string, (ctx: { method: string; body: unknown }) => Response>) {
    const calls: { url: string; method: string; body: unknown }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
        const url = typeof input === 'string' ? input : input instanceof URL ? `${input.pathname}${input.search}` : input.url;
        const method = (init?.method || 'GET').toUpperCase();
        const body = init?.body != null ? JSON.parse(init.body as string) : undefined;
        calls.push({ url, method, body });
        const handler = routes[url];
        if (!handler) return jsonRes({ error: `unmocked: ${url}` }, 500);
        return handler({ method, body });
      })
    );
    return calls;
  }

  it('রিপ্লে সফল — অপ মুছে যায়, server-id ম্যাপে জমা হয়', async () => {
    const calls = mockServer({
      '/api/expenses': () => jsonRes({ id: 'exp-server-1', category: 'বিদ্যুৎ', amount: 500 }, 201),
    });
    await db.outboxPut(
      op({
        method: 'POST',
        url: '/api/expenses',
        body: { category: 'বিদ্যুৎ', amount: 500 },
        ref: { type: 'expense', id: 'exp-off-1' },
      })
    );

    const result = await sync.syncNow(true);

    expect(result).toMatchObject({ ran: true, replayed: 1, pendingLeft: 0 });
    expect(await db.outboxGetAll()).toHaveLength(0);
    expect(await db.kvGet<[string, string][]>('idMap')).toEqual([['exp-off-1', 'exp-server-1']]);
    expect(calls.filter(c => c.url !== '/api/sync')).toHaveLength(1);
  });

  it('নির্ভরশীল অপের লোকাল-আইডি রিপ্লে-র সময় সার্ভার-আইডিতে রূপান্তর হয় (বডি ও URL)', async () => {
    const calls = mockServer({
      '/api/customers': () => jsonRes({ id: 'cust-server-9', name: 'রহিম', phone: '01712345678' }, 201),
      '/api/customers/payment': () => jsonRes({ success: true, customer: { id: 'cust-server-9' }, payment: { id: 'pay-server-1' } }, 201),
      '/api/customers?id=cust-server-9': () => jsonRes({ message: 'ok' }, 200),
    });
    await db.outboxPut(
      op({
        id: 'op-1',
        method: 'POST',
        url: '/api/customers',
        body: { name: 'রহিম', phone: '01712345678' },
        ref: { type: 'customer', id: 'cust-off-abc' },
      })
    );
    await db.outboxPut(
      op({
        id: 'op-2',
        method: 'POST',
        url: '/api/customers/payment',
        body: { customerId: 'cust-off-abc', amount: 500, method: 'bKash' },
        createdAt: '2026-10-03T10:00:01.000Z',
      })
    );
    await db.outboxPut(
      op({
        id: 'op-3',
        method: 'DELETE',
        url: '/api/customers?id=cust-off-abc',
        createdAt: '2026-10-03T10:00:02.000Z',
      })
    );

    const result = await sync.syncNow(true);

    expect(result.replayed).toBe(3);
    const paymentCall = calls.find(c => c.url === '/api/customers/payment');
    expect((paymentCall?.body as { customerId: string }).customerId).toBe('cust-server-9');
    // DELETE-এর URL-ও রিম্যাপ হয়েছে — রিলেটিভ-কোয়েরি সহ
    expect(calls.some(c => c.url === '/api/customers?id=cust-server-9')).toBe(true);
    expect(await db.outboxGetAll()).toHaveLength(0);
  });

  it('4xx — অপ failed কোয়ারেন্টাইন, ডেটা থাকে', async () => {
    mockServer({ '/api/expenses': () => jsonRes({ error: 'খরচ পাওয়া যায়নি' }, 404) });
    await db.outboxPut(op({ url: '/api/expenses', body: { category: 'x', amount: 1 } }));

    const result = await sync.syncNow(true);

    expect(result).toMatchObject({ ran: true, replayed: 0, failed: 1 });
    const [left] = await db.outboxGetAll();
    expect(left.status).toBe('failed');
    expect(left.attempts).toBe(1);
    expect(left.lastError).toContain('404');
  });

  it('5xx — রাউন্ড থামে না: ওই অপ pending থাকে, পরের অপ রিপ্লে হয়', async () => {
    const calls = mockServer({
      '/api/expenses': () => jsonRes({ error: 'boom' }, 500),
      '/api/coupons': () => jsonRes({ id: 'coup-server-1', code: 'EID' }, 201),
    });
    await db.outboxPut(op({ id: 'op-1', url: '/api/expenses', body: { category: 'x', amount: 1 } }));
    await db.outboxPut(op({ id: 'op-2', url: '/api/coupons', body: { code: 'EID', value: 10 }, createdAt: '2026-10-03T10:00:01.000Z', ref: { type: 'coupon', id: 'coup-off-1' } }));

    const result = await sync.syncNow(true);

    expect(result.replayed).toBe(1);
    const [first, second] = await db.outboxGetAll();
    expect(first.id).toBe('op-1');
    expect(first.status).toBe('pending');
    expect(first.attempts).toBe(1);
    expect(second).toBeUndefined();
    expect(calls.filter(c => c.url === '/api/coupons')).toHaveLength(1);
  });

  it('5xx টানা ৮ চেষ্টা হলে failed হয়', async () => {
    mockServer({ '/api/expenses': () => jsonRes({ error: 'boom' }, 500) });
    await db.outboxPut(op({ url: '/api/expenses', attempts: 7, body: { category: 'x', amount: 1 } }));

    await sync.syncNow(true);

    const [left] = await db.outboxGetAll();
    expect(left.status).toBe('failed');
    expect(left.attempts).toBe(8);
    expect(left.lastError).toContain('বারবার');
  });

  it('429 — রাউন্ড সেখানেই থামে, পরের অপ ধরা হয় না', async () => {
    const calls = mockServer({
      '/api/expenses': () => jsonRes({ error: 'rate limited' }, 429),
      '/api/coupons': () => jsonRes({ id: 'coup-server-1' }, 201),
    });
    await db.outboxPut(op({ id: 'op-1', url: '/api/expenses', body: { category: 'x', amount: 1 } }));
    await db.outboxPut(op({ id: 'op-2', url: '/api/coupons', body: { code: 'EID', value: 10 }, createdAt: '2026-10-03T10:00:01.000Z' }));

    const result = await sync.syncNow(true);

    expect(result.replayed).toBe(0);
    expect(calls.filter(c => c.url !== '/api/sync')).toHaveLength(1); // দ্বিতীয় অপে যায়নি
    const left = await db.outboxGetAll();
    expect(left).toHaveLength(2);
    expect(left.every(o => o.status === 'pending' && o.attempts === 0)).toBe(true);
  });

  it('নেটওয়ার্ক ব্যর্থ — রাউন্ড বাতিল, সব অপ pending ও অছোঁয়া', async () => {
    const fetchMock = vi.fn(async () => {
      throw new Error('network down');
    });
    vi.stubGlobal('fetch', fetchMock);
    await db.outboxPut(op({ id: 'op-1', body: { category: 'x', amount: 1 } }));
    await db.outboxPut(op({ id: 'op-2', body: { category: 'y', amount: 2 }, createdAt: '2026-10-03T10:00:01.000Z' }));

    const result = await sync.syncNow(true);

    expect(result.ran).toBe(false);
    const left = await db.outboxGetAll();
    expect(left).toHaveLength(2);
    expect(left.every(o => o.status === 'pending' && o.attempts === 0)).toBe(true);
  });

  it('retryFailedOps — failed অপ পেন্ডিং করে আবার রিপ্লে করে', async () => {
    const calls = mockServer({
      '/api/expenses': () => jsonRes({ id: 'exp-server-2', category: 'বিদ্যুৎ', amount: 300 }, 201),
    });
    await db.outboxPut(op({ url: '/api/expenses', status: 'failed', attempts: 1, lastError: 'সার্ভার বলছে: 500', body: { category: 'বিদ্যুৎ', amount: 300 } }));

    await sync.retryFailedOps();

    expect(await db.outboxGetAll()).toHaveLength(0);
    expect(calls.filter(c => c.url === '/api/expenses')).toHaveLength(1);
  });
});

import { describe, it, expect, beforeAll } from 'vitest';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getD1Local } from './d1Local';
import { createOrderD1 } from './repos/orders';
import { replicateOrderD1 } from './repos/replicate';
import type { Order } from '../types/index';

const TENANT = '01JXTENANTDEFAULT000000';
const NOW = '2026-10-03T00:00:00.000Z';

let db: DatabaseSync;

beforeAll(() => {
  db = new DatabaseSync(':memory:');
  db.exec(readFileSync(join(__dirname, '../../migrations/0001_init.sql'), 'utf8'));
  db.exec(readFileSync(join(__dirname, '../../migrations/0002_order_public_token.sql'), 'utf8'));
  // ফিক্সচার: টেনান্ট, ডিভাইস, সেটিংস, পণ্য (ভ্যারিয়েন্টসহ), কুপন
  db.exec(`INSERT INTO tenants (id, name, slug, created_at, updated_at) VALUES ('${TENANT}', 'টেস্ট দোকান', 't', '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO devices (id, tenant_id, device_code, created_at, updated_at) VALUES ('dev-1', '${TENANT}', 'D01', '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO settings (id, tenant_id, key, value_json, created_at, updated_at) VALUES ('s1', '${TENANT}', 'storeSettings', '{"insideDhakaFee":60,"outsideDhakaFee":120,"freeDeliveryAbove":5000}', '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO products (id, tenant_id, sku, name, slug, price_p, stock_cached, created_at, updated_at) VALUES ('p1', '${TENANT}', 'JX-SH-001', 'টেস্ট জুতা', 't', 100000, 10, '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO product_variants (id, tenant_id, product_id, sku, size, color, price_p, stock_cached, created_at, updated_at) VALUES ('v1', '${TENANT}', 'p1', 'V-42', '42', 'Black', 120000, 5, '${NOW}', '${NOW}')`);
  db.exec(`INSERT INTO coupons (id, tenant_id, code, discount_type, value, min_order_p, active, created_at, updated_at) VALUES ('c1', '${TENANT}', 'EID50', 'fixed', 5000, 100000, 1, '${NOW}', '${NOW}')`);
});

const input = {
  customerName: 'করিম',
  phone: '01711111111',
  address: 'ঢাকা',
  city: 'Inside Dhaka' as const,
  paymentMethod: 'Cash on Delivery' as const,
  items: [{ productId: 'p1', quantity: 1, selectedSize: '42', selectedColor: 'Black' }],
};

describe('createOrderD1 (P5 রেফারেন্স রিপো)', () => {
  it('হ্যাপি-পাথ: ভ্যারিয়েন্ট-দাম, কুপন, ফি, লেজার, ডিভাইস-সিকোয়েন্স — সব এক লেনদেনে', async () => {
    const exec = getD1Local(db);
    const r = await createOrderD1({ exec, tenantId: TENANT, deviceId: 'dev-1' }, 'op-1', {
      ...input, couponCode: 'eid50',
    });
    expect(r.duplicate).toBe(false);
    expect(r.totalP).toBe(120000 - 5000 + 6000); // ১২০০-৫০+৬০ = ৳১২১৫০
    const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(r.id) as { public_token: string; payment_method: string };
    expect(order.public_token).toBeTruthy();
    expect(order.payment_method).toBe('cod');
    expect((db.prepare('SELECT stock_cached FROM product_variants WHERE id=?').get('v1') as { stock_cached: number }).stock_cached).toBe(4);
    const cust = db.prepare('SELECT total_purchases_p, order_count FROM customers WHERE phone=?').get('01711111111') as { total_purchases_p: number; order_count: number };
    expect(cust.total_purchases_p).toBe(r.totalP);
    expect(cust.order_count).toBe(1);
    const dev = db.prepare('SELECT last_seq FROM devices WHERE id=?').get('dev-1') as { last_seq: number };
    expect(dev.last_seq).toBe(1);
    expect((db.prepare('SELECT order_number FROM orders WHERE id=?').get(r.id) as { order_number: string }).order_number).toBe('D01-000001');
  });

  it('আইডেম্পোটেন্সি: একই op_key রিপ্লে → আগের রেকর্ড, নতুন অর্ডার নয়', async () => {
    const exec = getD1Local(db);
    const r = await createOrderD1({ exec, tenantId: TENANT, deviceId: 'dev-1' }, 'op-1', input);
    expect(r.duplicate).toBe(true);
    expect((db.prepare('SELECT COUNT(*) AS n FROM orders').get() as { n: number }).n).toBe(1);
  });

  it('অ্যাটমিসিটি: স্টক কম হলে throw এবং কোনো রো-ই থাকে না (রোলব্যাক প্রমাণ)', async () => {
    const exec = getD1Local(db);
    await expect(createOrderD1({ exec, tenantId: TENANT, deviceId: 'dev-1' }, 'op-2', {
      ...input, phone: '01722222222', items: [{ productId: 'p1', quantity: 99, selectedSize: '42', selectedColor: 'Black' }],
    })).rejects.toThrow(/স্টক/);
    expect((db.prepare('SELECT COUNT(*) AS n FROM orders WHERE customer_name=?').get('করিম') as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT stock_cached FROM product_variants WHERE id=?').get('v1') as { stock_cached: number }).stock_cached).toBe(4);
    expect((db.prepare('SELECT COUNT(*) AS n FROM inventory_movements WHERE order_id IS NOT NULL AND movement_type=?').get('SALE') as { n: number }).n).toBe(1);
  });

  it('নেগেটিভ-স্টক নীতি: allowNegativeStock=true হলে রেকর্ড+পতাকা, প্রত্যাখ্যান নয়', async () => {
    const exec = getD1Local(db);
    const r = await createOrderD1({ exec, tenantId: TENANT, deviceId: 'dev-1' }, 'op-3', {
      ...input, phone: '01733333333', allowNegativeStock: true,
      items: [{ productId: 'p1', quantity: 50, selectedSize: '42', selectedColor: 'Black' }],
    });
    expect(r.duplicate).toBe(false);
    const mv = db.prepare('SELECT is_negative_stock, qty_delta FROM inventory_movements ORDER BY created_at DESC LIMIT 1').get() as { is_negative_stock: number; qty_delta: number };
    expect(mv.is_negative_stock).toBe(1);
    expect(mv.qty_delta).toBe(-50);
  });
});

describe('replicateOrderD1 (shadow write)', () => {
  const kvOrder: Order = {
    id: 'ord-1759459200000',
    orderNumber: 'SK-1234',
    customerName: 'শ্যাডো কাস্টমার',
    phone: '01744444444',
    address: 'মিরপুর, ঢাকা',
    city: 'Inside Dhaka',
    paymentMethod: 'Cash on Delivery',
    items: [{ productId: 'p1', name: 'টেস্ট জুতা', price: 1000, quantity: 2, selectedSize: '42', selectedColor: 'Black', image: 'i.jpg' }],
    subtotal: 2000,
    deliveryFee: 0,
    total: 2000,
    paidAmount: 2000,
    dueAmount: 0,
    status: 'Pending',
    createdAt: NOW,
    publicToken: 'tok-abc',
  };

  it('হুবহু প্রতিলিপি: একই id/নম্বর/টোকেন, আইটেম পয়শায়', async () => {
    const exec = getD1Local(db);
    await replicateOrderD1({ exec, tenantId: TENANT, deviceId: 'dev-1' }, kvOrder);
    const row = db.prepare('SELECT order_number, public_token, total_p, source FROM orders WHERE id = ?').get(kvOrder.id) as { order_number: string; public_token: string; total_p: number; source: string };
    expect(row.order_number).toBe('SK-1234');
    expect(row.public_token).toBe('tok-abc');
    expect(row.total_p).toBe(200000);
    expect(row.source).toBe('online');
    expect((db.prepare('SELECT unit_price_p, quantity FROM order_items WHERE order_id = ?').get(kvOrder.id) as { unit_price_p: number; quantity: number }).unit_price_p).toBe(100000);
  });

  it('রিপ্লে নিরাপদ: দ্বিতীয়বার চালালেও ডুপ্লিকেট হয় না', async () => {
    const exec = getD1Local(db);
    await replicateOrderD1({ exec, tenantId: TENANT, deviceId: 'dev-1' }, kvOrder);
    expect((db.prepare('SELECT COUNT(*) AS n FROM orders WHERE id = ?').get(kvOrder.id) as { n: number }).n).toBe(1);
    expect((db.prepare('SELECT COUNT(*) AS n FROM order_items WHERE order_id = ?').get(kvOrder.id) as { n: number }).n).toBe(1);
  });

  it('ফোন থাকলে কাস্টমার-রো অস্তিত্ব নিশ্চিত হয় (ক্যাশ KV-র মালিকানায়)', async () => {
    const exec = getD1Local(db);
    await replicateOrderD1({ exec, tenantId: TENANT, deviceId: 'dev-1' }, { ...kvOrder, customerId: undefined });
    const c = db.prepare('SELECT due_cached, total_purchases_p FROM customers WHERE phone = ?').get('01744444444') as { due_cached: number; total_purchases_p: number };
    expect(c.due_cached).toBe(0); // ক্যাশ এখানে লেখা হয় না — সুইচ-সময়ে রিফ্রেশ
  });
});

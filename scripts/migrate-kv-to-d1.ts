/**
 * KV → D1 মাইগ্রেশন (P5 ধাপ ৫) — আসল jx_store_state ডেটা D1-এ নেয় + চেকসাম যাচাই।
 *
 *   ড্রাই-রান (ডিফল্ট):  npx tsx scripts/migrate-kv-to-d1.ts
 *   আসল লেখা:          npx tsx scripts/migrate-kv-to-d1.ts --apply
 *
 * নিয়ম: টাকা প্রতি-রো পয়শায় (round ×১০০) — চেকসামও পয়শাতেই তুলনা হয়।
 * লেজার: বাকির ইতিহাস সরলীকৃত — OPENING (= due_cached + Σ আদায়) + PAYMENT এন্ট্রি,
 *   যাতে SUM(due_entries) == due_cached অভিন্নতা টিকে থাকে। প্রতি-অর্ডার CHARGE
 *   বিশ্লেষণ পরের রিফাইনমেন্ট। stock_cached = KV-র বর্তমান stockCount (সত্য);
 *   মুভমেন্ট-ইতিহাস তথ্যগত হিসেবে ইমপোর্ট হয় (ভ্যারিয়েন্ট-লিংক নেই — নোট দেখো)।
 * .env থেকে CLOUDFLARE_API_TOKEN / CLOUDFLARE_ACCOUNT_ID / D1_DATABASE_ID পড়ে।
 */
import { sqlLiteral, getD1Rest } from '../src/lib/d1';

const P = (taka: number | undefined | null): number => Math.round((Number(taka) || 0) * 100);
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');
const NOW = new Date().toISOString();
const TENANT = '01JXTENANTDEFAULT000000';

// ---- .env পার্স (মান প্রিন্ট করা হয় না) ----
function envKey(name: string): string {
  if (process.env[name]) return process.env[name] as string;
  const fs = require('node:fs') as typeof import('node:fs');
  const text = fs.readFileSync(new URL('../.env', import.meta.url), 'utf8');
  const m = text.match(new RegExp(`^${name}=(.*)$`, 'm'));
  return m ? m[1].trim().replace(/\r$/, '') : '';
}

interface FullStoreData {
  products: Record<string, unknown>[];
  orders: Record<string, unknown>[];
  categories: Record<string, unknown>[];
  storeSettings: Record<string, unknown>;
  heroBanner: Record<string, unknown>;
  flashDeal: Record<string, unknown>;
  coupons: Record<string, unknown>[];
  inventoryMovements: Record<string, unknown>[];
  customers: Record<string, unknown>[];
  expenses: Record<string, unknown>[];
  duePayments: Record<string, unknown>[];
}

async function fetchKvData(): Promise<FullStoreData> {
  const token = envKey('CLOUDFLARE_API_TOKEN');
  const account = envKey('CLOUDFLARE_ACCOUNT_ID');
  const kvId = envKey('CLOUDFLARE_KV_ID');
  if (!token || !account || !kvId) throw new Error('.env-এ CLOUDFLARE_API_TOKEN/CLOUDFLARE_ACCOUNT_ID/CLOUDFLARE_KV_ID লাগবে');
  const url = `https://api.cloudflare.com/client/v4/accounts/${account}/storage/kv/namespaces/${kvId}/values/jx_store_state`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(`KV পড়া যায়নি: HTTP ${res.status}`);
  const text = await res.text();
  const data = JSON.parse(text) as FullStoreData;
  if (!Array.isArray(data.products)) throw new Error('KV ডেটা-শেপ অপ্রত্যাশিত (products নেই)');
  return data;
}

async function main(): Promise<void> {
  const data = await fetchKvData();
  const stmts: string[] = [];
  const add = (sql: string) => stmts.push(sql.endsWith(';') ? sql : `${sql};`);
  let skippedDataUris = 0;

  // ---- টেনান্ট/আউটলেট/ডিভাইস/সেটিংস ----
  add(`INSERT OR IGNORE INTO tenants (id, name, slug, plan, created_at, updated_at) VALUES (${sqlLiteral(TENANT)}, ${sqlLiteral(data.storeSettings?.storeName ?? 'Shopkeeper')}, 'default', 'single', '${NOW}', '${NOW}')`);
  add(`INSERT OR IGNORE INTO outlets (id, tenant_id, code, name, is_default, created_at, updated_at) VALUES ('out-default', ${sqlLiteral(TENANT)}, 'MAIN', 'প্রধান দোকান', 1, '${NOW}', '${NOW}')`);
  add(`INSERT OR IGNORE INTO devices (id, tenant_id, device_code, label, created_at, updated_at) VALUES ('dev-default', ${sqlLiteral(TENANT)}, 'D01', 'মূল সার্ভার (মাইগ্রেশন)', '${NOW}', '${NOW}')`);
  for (const [key, value] of [['storeSettings', data.storeSettings], ['heroBanner', data.heroBanner], ['flashDeal', data.flashDeal]] as const) {
    add(`INSERT OR IGNORE INTO settings (id, tenant_id, key, value_json, created_at, updated_at) VALUES (${sqlLiteral(`set-${key}`)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(key)}, ${sqlLiteral(JSON.stringify(value))}, '${NOW}', '${NOW}')`);
  }

  // ---- ক্যাটাগরি ----
  const catByName = new Map<string, string>();
  (data.categories || []).forEach((c, i) => {
    catByName.set(String(c.name), String(c.id));
    add(`INSERT OR IGNORE INTO categories (id, tenant_id, parent_type, name, slug, image, item_count_label, position, created_at, updated_at) VALUES (${sqlLiteral(c.id)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(c.parentType ?? 'shoes')}, ${sqlLiteral(c.name)}, ${sqlLiteral(c.slug)}, ${sqlLiteral(c.image)}, ${sqlLiteral(c.itemCountLabel)}, ${i}, ${sqlLiteral(c.createdAt ?? NOW)}, '${NOW}')`);
  });

  // ---- প্রোডাক্ট + ছবি + ভ্যারিয়েন্ট ----
  for (const pr of data.products || []) {
    const variants = (pr.variants as Record<string, unknown>[] | undefined) || [];
    const stock = variants.length > 0 ? variants.reduce((s, v) => s + (Number(v.stock) || 0), 0) : Number(pr.stockCount) || 0;
    add(`INSERT OR IGNORE INTO products (id, tenant_id, category_id, sub_category, sku, barcode, name, slug, description, price_p, cost_price_p, compare_at_price_p, min_stock_alert, is_featured, rating, stock_cached, created_at, updated_at) VALUES (${sqlLiteral(pr.id)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(catByName.get(String(pr.category)) ?? null)}, ${sqlLiteral(pr.subCategory)}, ${sqlLiteral(pr.sku)}, ${sqlLiteral(pr.barcode)}, ${sqlLiteral(pr.name)}, ${sqlLiteral(pr.slug)}, ${sqlLiteral(pr.description ?? '')}, ${P(pr.price as number)}, ${pr.costPrice !== undefined && pr.costPrice !== null ? P(pr.costPrice as number) : 'NULL'}, ${pr.originalPrice !== undefined && pr.originalPrice !== null ? P(pr.originalPrice as number) : 'NULL'}, ${Number(pr.minStockAlert) || 5}, ${pr.isFeatured ? 1 : 0}, ${pr.rating ?? 'NULL'}, ${stock}, ${sqlLiteral(pr.createdAt ?? NOW)}, '${NOW}')`);
    ((pr.images as string[]) || []).forEach((url, i) => {
      // base64 data-URI (অফলাইন-আপলোড ফলব্যাক) D1-এর প্রতি-স্টেটমেন্ট সীমা ভাঙে — বড়গুলো স্কিপ
      if (url.startsWith('data:') && url.length > 90_000) {
        skippedDataUris++;
        return;
      }
      add(`INSERT OR IGNORE INTO product_images (id, tenant_id, product_id, url, position, created_at, updated_at) VALUES (${sqlLiteral(`${String(pr.id)}-img-${i}`)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(pr.id)}, ${sqlLiteral(url)}, ${i}, '${NOW}', '${NOW}')`);
    });
    for (const v of variants) {
      add(`INSERT OR IGNORE INTO product_variants (id, tenant_id, product_id, sku, size, color, color_hex, price_p, cost_price_p, stock_cached, created_at, updated_at) VALUES (${sqlLiteral(v.id)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(pr.id)}, ${sqlLiteral(v.sku)}, ${sqlLiteral(v.size)}, ${sqlLiteral(v.color)}, NULL, ${v.price !== undefined && v.price !== null ? P(v.price as number) : 'NULL'}, ${v.costPrice !== undefined && v.costPrice !== null ? P(v.costPrice as number) : 'NULL'}, ${Number(v.stock) || 0}, '${NOW}', '${NOW}')`);
    }
  }

  // ---- কাস্টমার + লেজার (OPENING absorbs: SUM(ledger) == due_cached) ----
  const paidByCustomer = new Map<string, number>();
  for (const dp of data.duePayments || []) {
    paidByCustomer.set(String(dp.customerId), (paidByCustomer.get(String(dp.customerId)) || 0) + (Number(dp.amount) || 0));
  }
  for (const c of data.customers || []) {
    const due = Number(c.dueAmount) || 0;
    add(`INSERT OR IGNORE INTO customers (id, tenant_id, name, phone, address, note, due_cached, total_purchases_p, order_count, created_at, updated_at) VALUES (${sqlLiteral(c.id)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(c.name)}, ${sqlLiteral(c.phone)}, ${sqlLiteral(c.address)}, ${sqlLiteral(c.note)}, ${P(due)}, ${P(c.totalPurchases as number)}, ${Number(c.orderCount) || 0}, ${sqlLiteral(c.createdAt ?? NOW)}, '${NOW}')`);
    const opening = P(due) + P(paidByCustomer.get(String(c.id)) || 0);
    if (opening !== 0) {
      add(`INSERT INTO due_entries (id, tenant_id, customer_id, entry_type, amount, note, created_at, updated_at) VALUES (${sqlLiteral(`${String(c.id)}-opening`)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(c.id)}, 'OPENING', ${opening}, 'KV→D1 মাইগ্রেশন ব্যালেন্সিং', '${NOW}', '${NOW}')`);
    }
  }
  for (const dp of data.duePayments || []) {
    const deId = `de-${String(dp.id)}`;
    add(`INSERT OR IGNORE INTO due_entries (id, tenant_id, customer_id, entry_type, amount, method, note, created_at, updated_at) VALUES (${sqlLiteral(deId)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(dp.customerId)}, 'PAYMENT', ${-P(dp.amount as number)}, ${sqlLiteral(dp.method)}, ${sqlLiteral(dp.note)}, ${sqlLiteral(dp.createdAt ?? NOW)}, '${NOW}')`);
    add(`INSERT OR IGNORE INTO payments (id, tenant_id, customer_id, amount_p, method, reference, note, created_at, updated_at) VALUES (${sqlLiteral(`pay-${String(dp.id)}`)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(dp.customerId)}, ${P(dp.amount as number)}, ${sqlLiteral(dp.method)}, NULL, ${sqlLiteral(dp.note)}, ${sqlLiteral(dp.createdAt ?? NOW)}, '${NOW}')`);
  }

  // ---- কুপন / খরচ ----
  for (const cp of data.coupons || []) {
    const value = cp.discountType === 'fixed' ? P(cp.value as number) : Number(cp.value) || 0;
    add(`INSERT OR IGNORE INTO coupons (id, tenant_id, code, discount_type, value, min_order_p, active, created_at, updated_at) VALUES (${sqlLiteral(cp.id)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(cp.code)}, ${sqlLiteral(cp.discountType)}, ${value}, ${P(cp.minOrder as number)}, ${cp.active ? 1 : 0}, '${NOW}', '${NOW}')`);
  }
  for (const e of data.expenses || []) {
    add(`INSERT OR IGNORE INTO expenses (id, tenant_id, category, amount_p, note, spent_at, created_at, updated_at) VALUES (${sqlLiteral(e.id)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(e.category)}, ${P(e.amount as number)}, ${sqlLiteral(e.note)}, ${sqlLiteral(e.createdAt ?? NOW)}, ${sqlLiteral(e.createdAt ?? NOW)}, '${NOW}')`);
  }

  // ---- অর্ডার + আইটেম ----
  const variantByProduct = new Map<string, Map<string, string>>(); // productId -> "size|color" -> variantId
  for (const pr of data.products || []) {
    const m = new Map<string, string>();
    for (const v of (pr.variants as Record<string, unknown>[] | undefined) || []) {
      m.set(`${String(v.size)}|${String(v.color)}`, String(v.id));
    }
    variantByProduct.set(String(pr.id), m);
  }
  for (const o of data.orders || []) {
    const items = (o.items as Record<string, unknown>[]) || [];
    add(`INSERT OR IGNORE INTO orders (id, tenant_id, order_number, source, customer_id, customer_name, customer_phone, shipping_address, shipping_zone, subtotal_p, discount_p, delivery_fee_p, total_p, paid_amount_p, due_amount_p, coupon_code, payment_method, status, note, admin_note, created_at, updated_at) VALUES (${sqlLiteral(o.id)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(o.orderNumber)}, ${sqlLiteral(o.source === 'in-store' ? 'in-store' : 'online')}, ${sqlLiteral(o.customerId ?? null)}, ${sqlLiteral(o.customerName)}, ${sqlLiteral(o.phone ?? '')}, ${sqlLiteral(o.address ?? '')}, ${sqlLiteral(o.city === 'Outside Dhaka' ? 'outside_dhaka' : 'inside_dhaka')}, ${P(o.subtotal as number)}, ${P(o.discount as number)}, ${P(o.deliveryFee as number)}, ${P(o.total as number)}, ${P(o.paidAmount as number)}, ${P(o.dueAmount as number)}, ${sqlLiteral(o.couponCode ?? null)}, ${sqlLiteral(o.paymentMethod === 'bKash / Nagad' ? 'bkash' : 'cod')}, ${sqlLiteral(o.status ?? 'Pending')}, ${sqlLiteral(o.note ?? null)}, ${sqlLiteral(o.adminNote ?? null)}, ${sqlLiteral(o.createdAt ?? NOW)}, '${NOW}')`);
    for (const it of items) {
      const vId = variantByProduct.get(String(it.productId))?.get(`${String(it.selectedSize)}|${String(it.selectedColor)}`) ?? null;
      add(`INSERT OR IGNORE INTO order_items (id, tenant_id, order_id, product_id, variant_id, name, sku, size, color, image, unit_price_p, unit_cost_p, quantity, line_total_p, created_at, updated_at) VALUES (${sqlLiteral(`oit-${String(o.id)}-${String(it.productId)}-${String(it.selectedSize)}-${String(it.selectedColor)}`)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(o.id)}, ${sqlLiteral(it.productId)}, ${sqlLiteral(vId)}, ${sqlLiteral(it.name)}, NULL, ${sqlLiteral(it.selectedSize)}, ${sqlLiteral(it.selectedColor)}, ${sqlLiteral(it.image)}, ${P(it.price as number)}, ${it.costPrice !== undefined && it.costPrice !== null ? P(it.costPrice as number) : 'NULL'}, ${Number(it.quantity) || 0}, ${P((Number(it.price) || 0) * (Number(it.quantity) || 0))}, ${sqlLiteral(o.createdAt ?? NOW)}, '${NOW}')`);
    }
  }

  // ---- ইনভেন্টরি মুভমেন্ট (তথ্যগত — ভ্যারিয়েন্ট-লিংক NULL; qty_delta স্বাক্ষরিত) ----
  for (const m of data.inventoryMovements || []) {
    const type = ['RESTOCK', 'SALE', 'DAMAGE', 'RETURN', 'ADJUSTMENT'].includes(String(m.type)) ? String(m.type) : 'ADJUSTMENT';
    const newStock = m.newStock === undefined || m.newStock === null ? null : Number(m.newStock);
    add(`INSERT OR IGNORE INTO inventory_movements (id, tenant_id, product_id, movement_type, qty_delta, unit_cost_p, prev_stock_snapshot, new_stock_snapshot, is_negative_stock, ref_text, note, created_at, updated_at) VALUES (${sqlLiteral(`migr-${String(m.id)}`)}, ${sqlLiteral(TENANT)}, ${sqlLiteral(m.productId)}, ${sqlLiteral(type)}, ${Number(m.quantity) || 0}, ${m.unitCost !== undefined && m.unitCost !== null ? P(m.unitCost as number) : 'NULL'}, ${m.previousStock === undefined || m.previousStock === null ? 'NULL' : Number(m.previousStock)}, ${newStock === null ? 'NULL' : newStock}, ${newStock !== null && newStock < 0 ? 1 : 0}, ${sqlLiteral(m.supplierOrInvoice)}, ${sqlLiteral(m.note)}, ${sqlLiteral(m.createdAt ?? NOW)}, '${NOW}')`);
  }

  // ---- সোর্স-চেকসাম (পয়শায়, প্রতি-রো round ×১০০) ----
  const validOrders = (data.orders || []).filter(o => o.status !== 'Cancelled');
  const src = {
    orders: (data.orders || []).length,
    orderItems: (data.orders || []).reduce((s, o) => s + ((o.items as unknown[]) || []).length, 0),
    revenueP: validOrders.reduce((s, o) => s + P(o.total as number), 0),
    products: (data.products || []).length,
    stock: (data.products || []).reduce((s, p) => s + (Number(p.stockCount) || 0), 0),
    customers: (data.customers || []).length,
    duesP: (data.customers || []).reduce((s, c) => s + P(c.dueAmount as number), 0),
    purchasesP: (data.customers || []).reduce((s, c) => s + P(c.totalPurchases as number), 0),
    movements: (data.inventoryMovements || []).length,
    coupons: (data.coupons || []).length,
    expenses: (data.expenses || []).length,
    duePayments: (data.duePayments || []).length,
  };

  console.log(`সোর্স (KV): ${src.orders} অর্ডার, ${src.orderItems} আইটেম, রেভিনিউ ৳${(src.revenueP / 100).toFixed(2)}, ${src.products} পণ্য (স্টক ${src.stock}), ${src.customers} কাস্টমার (বাকি ৳${(src.duesP / 100).toFixed(2)}), ${src.movements} মুভমেন্ট, ${src.duePayments} আদায়, ${src.coupons} কুপন, ${src.expenses} খরচ`);
  console.log(`জেনারেটেড SQL স্টেটমেন্ট: ${stmts.length}${skippedDataUris > 0 ? ` (স্কিপ: ${skippedDataUris}টি বিশাল base64 data-URI ছবি — R2-মাইগ্রেশনে সামলাতে হবে)` : ''}`);

  if (!APPLY) {
    console.log('ড্রাই-রান — কিছু লেখা হয়নি। আসলে লিখতে: npx tsx scripts/migrate-kv-to-d1.ts --apply');
    return;
  }

  // ---- প্রি-ফ্লাইট: টার্গেটে আগে থেকে ডেটা থাকলে থামো (অ-ইডেম্পোটেন্ট লেখা এড়াতে) ----
  const exec = getD1Rest();
  const pre = await exec.query<{ n: number }>('SELECT COUNT(*) AS n FROM orders');
  if (pre[0].n > 0 && !FORCE) {
    throw new Error(`টার্গেট D1-এ ইতিমধ্যে ${pre[0].n} অর্ডার আছে — দ্বিতীয়বার চালাতে --force (ডুপ্লিকেট INSERT OR IGNORE-এর কারণে নিরাপদ, তবু নিশ্চিত হয়ে)`);
  }

  // ---- চাঙ্ক-করে apply (D1 প্রতি-কল SQL-সাইজ সীমা → ছোট চাঙ্ক; প্রতি কল = এক অ্যাটমিক লেনদেন) ----
  const CHUNK = 20;
  let applied = 0;
  for (let i = 0; i < stmts.length; i += CHUNK) {
    const chunk = stmts.slice(i, i + CHUNK).map(sql => ({ sql }));
    const results = await exec.batch(chunk);
    applied += results.length;
    console.log(`  প্রয়োগ: ${applied}/${stmts.length} স্টেটমেন্ট`);
  }

  // ---- টার্গেট-চেকসাম (D1 থেকে) ----
  const one = async (sql: string): Promise<number> => Number((await exec.query<{ n: number }>(sql))[0].n);
  const tgt = {
    orders: await one(`SELECT COUNT(*) AS n FROM orders WHERE tenant_id = ${sqlLiteral(TENANT)}`),
    orderItems: await one(`SELECT COUNT(*) AS n FROM order_items WHERE tenant_id = ${sqlLiteral(TENANT)}`),
    revenueP: await one(`SELECT COALESCE(SUM(total_p),0) AS n FROM orders WHERE tenant_id = ${sqlLiteral(TENANT)} AND status != 'Cancelled'`),
    products: await one(`SELECT COUNT(*) AS n FROM products WHERE tenant_id = ${sqlLiteral(TENANT)}`),
    stock: await one(`SELECT COALESCE(SUM(stock_cached),0) AS n FROM products WHERE tenant_id = ${sqlLiteral(TENANT)}`),
    customers: await one(`SELECT COUNT(*) AS n FROM customers WHERE tenant_id = ${sqlLiteral(TENANT)}`),
    duesP: await one(`SELECT COALESCE(SUM(due_cached),0) AS n FROM customers WHERE tenant_id = ${sqlLiteral(TENANT)}`),
    purchasesP: await one(`SELECT COALESCE(SUM(total_purchases_p),0) AS n FROM customers WHERE tenant_id = ${sqlLiteral(TENANT)}`),
    movements: await one(`SELECT COUNT(*) AS n FROM inventory_movements WHERE tenant_id = ${sqlLiteral(TENANT)}`),
    coupons: await one(`SELECT COUNT(*) AS n FROM coupons WHERE tenant_id = ${sqlLiteral(TENANT)}`),
    expenses: await one(`SELECT COUNT(*) AS n FROM expenses WHERE tenant_id = ${sqlLiteral(TENANT)}`),
    duePayments: await one(`SELECT COUNT(*) AS n FROM payments WHERE tenant_id = ${sqlLiteral(TENANT)}`),
  };

  let pass = true;
  const cmp: [string, number, number][] = [
    ['অর্ডার', src.orders, tgt.orders],
    ['অর্ডার-আইটেম', src.orderItems, tgt.orderItems],
    ['রেভিনিউ (পয়শা)', src.revenueP, tgt.revenueP],
    ['পণ্য', src.products, tgt.products],
    ['স্টক (একক)', src.stock, tgt.stock],
    ['কাস্টমার', src.customers, tgt.customers],
    ['বাকি (পয়শা)', src.duesP, tgt.duesP],
    ['মোট-কেনাকাটা (পয়শা)', src.purchasesP, tgt.purchasesP],
    ['মুভমেন্ট', src.movements, tgt.movements],
    ['কুপন', src.coupons, tgt.coupons],
    ['খরচ', src.expenses, tgt.expenses],
    ['আদায়-রেকর্ড', src.duePayments, tgt.duePayments],
  ];
  console.log('\n=== চেকসাম (সোর্স KV বনাম টার্গেট D1) ===');
  for (const [label, a, b] of cmp) {
    const ok = a === b;
    if (!ok) pass = false;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}: ${a} ${ok ? '==' : '!='} ${b}`);
  }
  // লেজার-অভিন্নতা: SUM(due_entries) == SUM(due_cached)
  const ledger = await one(`SELECT COALESCE(SUM(amount),0) AS n FROM due_entries WHERE tenant_id = ${sqlLiteral(TENANT)}`);
  const ledgerOk = ledger === tgt.duesP;
  if (!ledgerOk) pass = false;
  console.log(`${ledgerOk ? 'PASS' : 'FAIL'}  লেজার-অভিন্নতা: SUM(due_entries) ${ledger} ${ledgerOk ? '==' : '!='} SUM(due_cached) ${tgt.duesP}`);

  console.log(pass ? '\nমাইগ্রেশন যাচাই পাস ✅' : '\nমাইগ্রেশন চেকসাম ফেল ❌ — বিস্তারিত উপরে');
  if (!pass) process.exitCode = 1;
}

main().catch(err => {
  console.error('মাইগ্রেশন ব্যর্থ:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});

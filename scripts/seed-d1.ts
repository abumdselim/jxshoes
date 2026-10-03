/**
 * D1 ডেমো-সিড জেনারেটর (P4 ধাপ ৩) — src/lib/initialData থেকে SQL বানায়।
 * জেনারেট: npx tsx scripts/seed-d1.ts > migrations/seed_demo.sql
 * প্রয়োগ: wrangler d1 execute <DB_NAME> --file=migrations/0001_init.sql [--local|--remote]
 *         wrangler d1 execute <DB_NAME> --file=migrations/seed_demo.sql [--local|--remote]
 * নিয়ম: টাকা ×১০০ → পয়শা (_p কলাম); অর্ডার/ইনভেন্টরি-মুভমেন্ট এখানে নেই —
 *   আসল KV-ডেটার মাইগ্রেশন P5-এর scripts/migrate-kv-to-d1.ts-এর কাজ (চেকসামসহ)।
 */
import {
  initialCategories,
  initialStoreSettings,
  initialHeroBanner,
  initialFlashDeal,
  initialCoupons,
  initialProducts,
  initialCustomers,
  initialExpenses,
} from '../src/lib/initialData';
import type { Product, CategoryItem } from '../src/types';

const NOW = new Date().toISOString();
const TENANT = '01JXTENANTDEFAULT000000'; // fixed ডেমো টেনান্ট (P5-এ আসল মাইগ্রেশনেও একই থাকবে)
const POISHA = (taka: number) => Math.round((Number(taka) || 0) * 100);
const q = (s: unknown) => `'${String(s ?? '').replace(/'/g, "''")}'`;

const out: string[] = [];
out.push(`-- জেনারেটেড: npx tsx scripts/seed-d1.ts @ ${NOW} — হাতে এডিট নয়, আবার জেনারেট করো`);
out.push(`BEGIN;`);

out.push(`INSERT INTO tenants (id, name, slug, plan, created_at, updated_at) VALUES ('${TENANT}', ${q(initialStoreSettings.storeName)}, 'default', 'single', '${NOW}', '${NOW}');`);
out.push(`INSERT INTO outlets (id, tenant_id, code, name, is_default, created_at, updated_at) VALUES ('out-default', '${TENANT}', 'MAIN', 'প্রধান দোকান', 1, '${NOW}', '${NOW}');`);
out.push(`INSERT INTO devices (id, tenant_id, device_code, label, created_at, updated_at) VALUES ('dev-default', '${TENANT}', 'D01', 'দোকানের ট্যাব', '${NOW}', '${NOW}');`);

// সেটিংস — পুরো অবজেক্ট JSON হিসেবে (key-value টেবিল)
for (const [key, value] of [
  ['storeSettings', initialStoreSettings],
  ['heroBanner', initialHeroBanner],
  ['flashDeal', initialFlashDeal],
] as const) {
  out.push(`INSERT INTO settings (id, tenant_id, key, value_json, created_at, updated_at) VALUES ('set-${key}', '${TENANT}', '${key}', ${q(JSON.stringify(value))}, '${NOW}', '${NOW}');`);
}

// ক্যাটাগরি
initialCategories.forEach((c: CategoryItem, i) => {
  out.push(`INSERT INTO categories (id, tenant_id, parent_type, name, slug, image, item_count_label, position, created_at, updated_at) VALUES (${q(c.id)}, '${TENANT}', ${q(c.parentType)}, ${q(c.name)}, ${q(c.slug)}, ${q(c.image)}, ${q(c.itemCountLabel)}, ${i}, '${NOW}', '${NOW}');`);
});

// প্রোডাক্টের category (বর্তমান অ্যাপে নাম/parentType মিশ্র) → categories.id
const catByName = new Map(initialCategories.map(c => [c.name, c.id]));
const catByType = new Map(initialCategories.map(c => [c.parentType, c.id]));
const categoryIdOf = (pr: Product): string | null =>
  catByName.get(pr.category) ?? catByType.get(pr.category as CategoryItem['parentType']) ?? null;

for (const pr of initialProducts) {
  const stockCached = pr.variants && pr.variants.length > 0
    ? pr.variants.reduce((s, v) => s + (v.stock || 0), 0)
    : pr.stockCount;
  out.push(`INSERT INTO products (id, tenant_id, category_id, sub_category, sku, barcode, name, slug, description, price_p, cost_price_p, compare_at_price_p, min_stock_alert, is_featured, rating, stock_cached, created_at, updated_at) VALUES (${q(pr.id)}, '${TENANT}', ${q(categoryIdOf(pr))}, ${q(pr.subCategory)}, ${q(pr.sku)}, ${q(pr.barcode)}, ${q(pr.name)}, ${q(pr.slug)}, ${q(pr.description)}, ${POISHA(pr.price)}, ${pr.costPrice !== undefined ? POISHA(pr.costPrice) : 'NULL'}, ${pr.originalPrice !== undefined ? POISHA(pr.originalPrice) : 'NULL'}, ${pr.minStockAlert ?? 5}, ${pr.isFeatured ? 1 : 0}, ${pr.rating ?? 'NULL'}, ${stockCached}, ${q(pr.createdAt || NOW)}, '${NOW}');`);

  (pr.images || []).forEach((url, i) => {
    out.push(`INSERT INTO product_images (id, tenant_id, product_id, url, position, created_at, updated_at) VALUES (${q(`${pr.id}-img-${i}`)}, '${TENANT}', ${q(pr.id)}, ${q(url)}, ${i}, '${NOW}', '${NOW}');`);
  });

  for (const v of pr.variants || []) {
    const hex = pr.colors.find(c => c.name === v.color)?.hex;
    out.push(`INSERT INTO product_variants (id, tenant_id, product_id, sku, size, color, color_hex, price_p, cost_price_p, stock_cached, created_at, updated_at) VALUES (${q(v.id)}, '${TENANT}', ${q(pr.id)}, ${q(v.sku)}, ${q(v.size)}, ${q(v.color)}, ${q(hex)}, ${v.price !== undefined ? POISHA(v.price) : 'NULL'}, ${v.costPrice !== undefined ? POISHA(v.costPrice) : 'NULL'}, ${v.stock || 0}, '${NOW}', '${NOW}');`);
  }
}

// কাস্টমার + পুরনো বাকি → OPENING লেজার-এন্ট্রি (ক্যাশড ব্যালেন্স সত্য = SUM(due_entries))
for (const c of initialCustomers) {
  out.push(`INSERT INTO customers (id, tenant_id, name, phone, address, note, due_cached, total_purchases_p, order_count, created_at, updated_at) VALUES (${q(c.id)}, '${TENANT}', ${q(c.name)}, ${q(c.phone)}, ${q(c.address)}, ${q(c.note)}, ${POISHA(c.dueAmount)}, ${POISHA(c.totalPurchases)}, ${c.orderCount || 0}, ${q(c.createdAt || NOW)}, '${NOW}');`);
  if (c.dueAmount > 0) {
    out.push(`INSERT INTO due_entries (id, tenant_id, customer_id, entry_type, amount, note, created_at, updated_at) VALUES (${q(`${c.id}-opening`)}, '${TENANT}', ${q(c.id)}, 'OPENING', ${POISHA(c.dueAmount)}, 'পুরনো খাতা মাইগ্রেশন (সিড)', ${q(c.createdAt || NOW)}, '${NOW}');`);
  }
}

// কুপন — fixed হলে পয়শা, percentage পূর্ণ সংখ্যা
for (const cp of initialCoupons) {
  const value = cp.discountType === 'fixed' ? POISHA(cp.value) : cp.value;
  out.push(`INSERT INTO coupons (id, tenant_id, code, discount_type, value, min_order_p, active, created_at, updated_at) VALUES (${q(cp.id)}, '${TENANT}', ${q(cp.code)}, ${q(cp.discountType)}, ${value}, ${POISHA(cp.minOrder)}, ${cp.active ? 1 : 0}, '${NOW}', '${NOW}');`);
}

// খরচ — spent_at = এন্ট্রির তারিখ
for (const e of initialExpenses) {
  out.push(`INSERT INTO expenses (id, tenant_id, category, amount_p, note, spent_at, created_at, updated_at) VALUES (${q(e.id)}, '${TENANT}', ${q(e.category)}, ${POISHA(e.amount)}, ${q(e.note)}, ${q(e.createdAt || NOW)}, ${q(e.createdAt || NOW)}, '${NOW}');`);
}

out.push(`COMMIT;`);
out.push(`-- ভেরিফাই: wrangler d1 execute <DB_NAME> --command "SELECT (SELECT COUNT(*) FROM products) AS products, (SELECT COUNT(*) FROM customers) AS customers, (SELECT COUNT(*) FROM coupons) AS coupons;"`);
process.stdout.write(out.join('\n') + '\n');

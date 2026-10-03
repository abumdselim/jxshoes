/**
 * অর্ডার রিপোজিটরি (P5 ধাপ ২-এর রেফারেন্স প্যাটার্ন) — D1-ভিত্তিক।
 * সম্পূর্ণ লেনদেন-বদ্ধ: অর্ডার + আইটেম + স্টক-মুভমেন্ট + কাস্টমার + আইডেম্পোটেন্সি
 * — সব এক ব্যাচে (একটাও ভাঙলে সব রোলব্যাক)। দাম/কুপন/ফি ডেটাবেস থেকেই হিসাব
 * (P1-এর সেম নিয়ম)।
 *
 * নোট: স্টোরফ্রন্ট এখনো store.ts (KV) দিয়ে চলে — STORE_BACKEND=kv ডিফল্ট।
 * এই লেয়ার P5-এর পরের ধাপে রাউটে সুইচ হবে (এক ডোমেইন একবারে, টেস্টসহ)।
 */
import { sqlLiteral, idempotencyCheck, type SqlExecutor, type SqlStatement } from '../d1';
import type { OnlineOrderInput } from '../store';

export interface D1Ctx {
  exec: SqlExecutor;
  tenantId: string;
  deviceId: string | null;
}

export class OrderValidationErrorD1 extends Error {}

export interface CreatedOrderD1 {
  id: string;
  orderNumber: string;
  totalP: number;
  /** true = একই op_key আগেও এসেছিল — আগের রেকর্ড ফেরত, নতুন করে নই */
  duplicate: boolean;
}

interface ProductRow {
  id: string;
  name: string;
  sku: string | null;
  price_p: number;
  cost_price_p: number | null;
  image: string | null;
  stock_cached: number;
  variant_id: string | null;
  variant_sku: string | null;
  variant_size: string | null;
  variant_color: string | null;
  variant_price_p: number | null;
  variant_cost_p: number | null;
  variant_stock: number | null;
}

/** ডিভাইস-প্রিফিক্স ইনভয়েস নম্বর (§৬.৩): D01-000123 */
function invoiceNumber(deviceCode: string, seq: number): string {
  return `${deviceCode}-${String(seq).padStart(6, '0')}`;
}

const POISHA = (taka: number): number => Math.round((Number(taka) || 0) * 100);

export async function createOrderD1(
  ctx: D1Ctx,
  opKey: string,
  input: OnlineOrderInput & { allowNegativeStock?: boolean }
): Promise<CreatedOrderD1> {
  // ১) আইডেম্পোটেন্সি — রিপ্লে/ডাবল-সাবমিশনে আগের রেকর্ডই ফেরত
  const prev = await idempotencyCheck(ctx.exec, ctx.tenantId, opKey);
  if (prev.done && prev.resultRef) {
    const old = await ctx.exec.query<{ id: string; order_number: string; total_p: number }>(
      'SELECT id, order_number, total_p FROM orders WHERE id = ?',
      [prev.resultRef]
    );
    if (old[0]) return { id: old[0].id, orderNumber: old[0].order_number, totalP: old[0].total_p, duplicate: true };
  }

  // ২) সার্ভার-সাইড রিকম্পিউট — পণ্য/কুপন/সেটিংস ডেটাবেস থেকে, ক্লায়েন্টের অঙ্ক নয়
  const ids = input.items.map(it => sqlLiteral(it.productId)).join(',');
  const productRows = await ctx.exec.query<ProductRow>(
    `SELECT p.id, p.name, p.sku, p.price_p, p.cost_price_p, p.stock_cached,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id AND pi.deleted_at IS NULL ORDER BY pi.position LIMIT 1) AS image,
            v.id AS variant_id, v.sku AS variant_sku, v.size AS variant_size, v.color AS variant_color,
            v.price_p AS variant_price_p, v.cost_price_p AS variant_cost_p, v.stock_cached AS variant_stock
     FROM products p LEFT JOIN product_variants v ON v.product_id = p.id
     WHERE p.tenant_id = ${sqlLiteral(ctx.tenantId)} AND p.id IN (${ids}) AND p.deleted_at IS NULL`
  );
  if (productRows.length === 0) {
    throw new OrderValidationErrorD1('একটি পণ্য খুঁজে পাওয়া যায়নি — পাতা রিফ্রেশ করে আবার চেষ্টা করুন।');
  }

  const orderItems: {
    productId: string; variantId: string | null; name: string; sku: string | null;
    size: string; color: string; image: string;
    unitPriceP: number; unitCostP: number | null; quantity: number;
  }[] = [];
  let subtotalP = 0;

  for (const it of input.items) {
    const variant = productRows.find(
      r => r.id === it.productId && r.variant_id !== null && r.variant_size === it.selectedSize && r.variant_color === it.selectedColor
    );
    const base = variant ?? productRows.find(r => r.id === it.productId && r.variant_id === null);
    if (!base) {
      throw new OrderValidationErrorD1(`দুঃখিত — "${it.productId}" পণ্যটির সাইজ/কালার পাওয়া যায়নি।`);
    }
    const unitPriceP = variant?.variant_price_p ?? base.price_p;
    const available = variant ? variant.variant_stock ?? 0 : base.stock_cached;
    if (!input.allowNegativeStock && available < it.quantity) {
      throw new OrderValidationErrorD1(`দুঃখিত — "${base.name}" পণ্যটির পর্যাপ্ত স্টক নেই।`);
    }
    orderItems.push({
      productId: base.id,
      variantId: variant?.variant_id ?? null,
      name: base.name,
      sku: variant?.variant_sku ?? base.sku,
      size: it.selectedSize,
      color: it.selectedColor,
      image: base.image ?? '',
      unitPriceP,
      unitCostP: variant?.variant_cost_p ?? base.cost_price_p,
      quantity: it.quantity,
    });
    subtotalP += unitPriceP * it.quantity;
  }

  // কুপন — ডেটাবেস থেকে যাচাই
  let discountP = 0;
  let couponId: string | null = null;
  const couponCode = input.couponCode?.trim().toUpperCase() || null;
  if (couponCode) {
    const rows = await ctx.exec.query<{ id: string; discount_type: string; value: number; min_order_p: number }>(
      `SELECT id, discount_type, value, min_order_p FROM coupons
       WHERE tenant_id = ${sqlLiteral(ctx.tenantId)} AND code = ${sqlLiteral(couponCode)} AND active = 1 AND deleted_at IS NULL`
    );
    const c = rows[0];
    if (!c || subtotalP < c.min_order_p) {
      throw new OrderValidationErrorD1('কুপন কোডটি সঠিক নয় বা এই অর্ডারে প্রযোজ্য নয়।');
    }
    discountP = c.discount_type === 'percentage' ? Math.round((subtotalP * c.value) / 100) : c.value;
    couponId = c.id;
  }

  // ডেলিভারি ফি — settings (storeSettings JSON) থেকে
  const settingsRows = await ctx.exec.query<{ value_json: string }>(
    `SELECT value_json FROM settings WHERE tenant_id = ${sqlLiteral(ctx.tenantId)} AND key = 'storeSettings' AND deleted_at IS NULL`
  );
  const settings = settingsRows[0]
    ? (JSON.parse(settingsRows[0].value_json) as { insideDhakaFee?: number; outsideDhakaFee?: number; freeDeliveryAbove?: number })
    : null;
  const zone = input.city === 'Outside Dhaka' ? 'outside_dhaka' : 'inside_dhaka';
  const baseFeeP = POISHA(zone === 'outside_dhaka' ? (settings?.outsideDhakaFee ?? 0) : (settings?.insideDhakaFee ?? 0));
  const freeAboveP = POISHA(settings?.freeDeliveryAbove ?? 0);
  const deliveryFeeP = freeAboveP > 0 && subtotalP >= freeAboveP ? 0 : baseFeeP;
  const totalP = Math.max(0, subtotalP - discountP + deliveryFeeP);
  const paymentMethod = input.paymentMethod === 'bKash / Nagad' ? 'bkash' : 'cod';

  // কাস্টমার আপসার্ট (ফোন-কি)
  let customerId: string | null = null;
  let customerIsNew = false;
  if (input.phone.trim()) {
    const existing = await ctx.exec.query<{ id: string }>(
      `SELECT id FROM customers WHERE tenant_id = ${sqlLiteral(ctx.tenantId)} AND phone = ${sqlLiteral(input.phone.trim())} AND deleted_at IS NULL`
    );
    if (existing[0]) customerId = existing[0].id;
    else { customerId = `cust-${crypto.randomUUID()}`; customerIsNew = true; }
  }

  // ডিভাইস সিকোয়েন্স → ইনভয়েস নম্বর (§৬.৩)
  const devRows = ctx.deviceId
    ? await ctx.exec.query<{ device_code: string; last_seq: number }>(
        `SELECT device_code, last_seq FROM devices WHERE id = ${sqlLiteral(ctx.deviceId)}`
      )
    : [];
  const deviceCode = devRows[0]?.device_code ?? 'D00';
  const seq = (devRows[0]?.last_seq ?? 0) + 1;
  const orderNumber = invoiceNumber(deviceCode, seq);

  const orderId = `ord-${crypto.randomUUID()}`;
  const publicToken = crypto.randomUUID();
  const now = new Date().toISOString();

  // ৩) এক ব্যাচ = লেনদেন: কাস্টমার → অর্ডার → আইটেম/মুভমেন্ট/গার্ডেড-স্টক → আইডেম্পোটেন্সি
  // (FK-ক্রম: orders.customer_id-এর আগে কাস্টমার-রো থাকতে হবে)
  const negFlag = input.allowNegativeStock ? 1 : 0;
  const statements: SqlStatement[] = [];

  if (customerId) {
    if (customerIsNew) {
      statements.push({
        sql: `INSERT INTO customers (id, tenant_id, name, phone, address, due_cached, total_purchases_p, order_count, created_at, updated_at)
              VALUES (?,?,?,?,?,0,?,1,?,?)`,
        params: [customerId, ctx.tenantId, input.customerName.trim(), input.phone.trim(), input.address.trim() || null, totalP, now, now],
      });
    } else {
      statements.push({
        sql: `UPDATE customers SET total_purchases_p = total_purchases_p + ?, order_count = order_count + 1,
              version = version + 1, updated_at = ? WHERE id = ?`,
        params: [totalP, now, customerId],
      });
    }
  }

  statements.push({
    sql: `INSERT INTO orders (id, tenant_id, order_number, source, customer_id, customer_name, customer_phone,
           shipping_address, shipping_zone, subtotal_p, discount_p, delivery_fee_p, total_p, paid_amount_p,
           due_amount_p, coupon_id, coupon_code, payment_method, status, note, device_id, public_token, created_at, updated_at)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    params: [
      orderId, ctx.tenantId, orderNumber, 'online', customerId, input.customerName.trim(),
      input.phone.trim(), input.address.trim(), zone, subtotalP, discountP, deliveryFeeP, totalP, totalP,
      0, couponId, couponCode, paymentMethod, 'Pending', input.note?.trim() || null, ctx.deviceId, publicToken, now, now,
    ],
  });

  for (const it of orderItems) {
    statements.push({
      sql: `INSERT INTO order_items (id, tenant_id, order_id, product_id, variant_id, name, sku, size, color, image,
            unit_price_p, unit_cost_p, quantity, line_total_p, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      params: [
        `oit-${crypto.randomUUID()}`, ctx.tenantId, orderId, it.productId, it.variantId, it.name, it.sku,
        it.size, it.color, it.image, it.unitPriceP, it.unitCostP, it.quantity, it.unitPriceP * it.quantity, now, now,
      ],
    });
    // স্টক মুভমেন্ট — append-only লেজার (SALE = ঋণাত্মক delta)
    statements.push({
      sql: `INSERT INTO inventory_movements (id, tenant_id, product_id, variant_id, movement_type, qty_delta,
            unit_cost_p, prev_stock_snapshot, new_stock_snapshot, is_negative_stock, order_id, note, device_id, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      params: [
        `mov-${crypto.randomUUID()}`, ctx.tenantId, it.productId, it.variantId, 'SALE', -it.quantity,
        it.unitCostP, null, null, negFlag, orderId, `অনলাইন অর্ডার #${orderNumber}`, ctx.deviceId, now, now,
      ],
    });
    // গার্ডেড ডিক্রিমেন্ট — ক্যাশড ব্যালেন্স += delta (কখনো absolute overwrite নয়)
    if (it.variantId) {
      statements.push({
        sql: `UPDATE product_variants SET stock_cached = stock_cached - ?, version = version + 1, updated_at = ? WHERE id = ?`,
        params: [it.quantity, now, it.variantId],
      });
    } else {
      statements.push({
        sql: `UPDATE products SET stock_cached = stock_cached - ?, version = version + 1, updated_at = ? WHERE id = ?`,
        params: [it.quantity, now, it.productId],
      });
    }
  }

  // নেগেটিভ-স্টক নীতি (§৬.৪): allowNegativeStock=false হলে লেনদেনের ভেতরেই যাচাই —
  // যেকোনো ক্যাশ ঋণাত্মক হলে throw → পুরো ব্যাচ রোলব্যাক। true হলে রেকর্ড+পতাকা (উপরে)।
  if (!input.allowNegativeStock) {
    const affectedVariantIds = orderItems.filter(it => it.variantId).map(it => sqlLiteral(it.variantId));
    const affectedProductIds = orderItems.filter(it => !it.variantId).map(it => sqlLiteral(it.productId));
    if (affectedVariantIds.length > 0) {
      statements.push({
        sql: `SELECT COUNT(*) AS neg FROM product_variants WHERE id IN (${affectedVariantIds.join(',')}) AND stock_cached < 0`,
      });
    }
    if (affectedProductIds.length > 0) {
      statements.push({
        sql: `SELECT COUNT(*) AS neg FROM products WHERE id IN (${affectedProductIds.join(',')}) AND stock_cached < 0`,
      });
    }
  }

  statements.push({
    sql: `INSERT INTO idempotency_keys (id, tenant_id, op_key, entity, result_ref, status, created_at, updated_at)
          VALUES (?,?,?,?,?,'done',?,?)`,
    params: [`idem-${crypto.randomUUID()}`, ctx.tenantId, opKey, 'orders', orderId, now, now],
  });

  if (ctx.deviceId) {
    statements.push({
      sql: `UPDATE devices SET last_seq = ?, last_seen_at = ?, version = version + 1 WHERE id = ?`,
      params: [seq, now, ctx.deviceId],
    });
  }

  // নেগেটিভ-চেক SELECT-গুলো ব্যাচের ফল থেকে পড়া হয় — কোনোটা >0 হলে throw
  // (REST পাথে BEGIN..COMMIT এক স্ট্রিং, ভাঙলে পুরোটা রোলব্যাক; লোকালেও একই)
  const results = await ctx.exec.batch<Record<string, unknown>>(statements);
  if (!input.allowNegativeStock) {
    const negChecks = results.filter(r => r.length > 0 && r[0] && typeof (r[0] as { neg?: number }).neg === 'number');
    for (const r of negChecks) {
      if ((r[0] as { neg: number }).neg > 0) {
        throw new OrderValidationErrorD1('স্টক যথেষ্ট নয় — লেনদেনটি রোলব্যাক হয়েছে।');
      }
    }
  }

  return { id: orderId, orderNumber, totalP, duplicate: false };
}

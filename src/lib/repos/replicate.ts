/**
 * Shadow write (P5) — KV-পাথে তৈরি অর্ডারকে হুবহু D1-তে প্রতিলিপি (একই id/নম্বর)।
 * উদ্দেশ্য: STORE_BACKEND সুইচের আগেই D1 লাইভ-অর্ডারে উষ্ণ থাকুক, ড্রিফট মাপা যায়।
 *
 * নিয়ম:
 * - এই ফাংশন কখনো থ্রো করবে না — D1 ব্যর্থ হলে অর্ডার-ফ্লো অক্ষত (কলার শুধু লগ করে)
 * - INSERT OR IGNORE → রিপ্লে/পুনরায় চালানো নিরাপদ
 * - কাস্টমার-রো শুধু অস্তিত্ব নিশ্চিত হয়; due_cached/total_purchases_p ক্যাশ KV-র
 *   মালিকানায় থাকে (সুইচ-সময়ে রিফ্রেশ হবে) — এখানে overwrite নয়
 * - inventory_movements/stock_cached এখানে নয় — ওগুলো চূড়ান্ত মাইগ্রেশনের
 *   মালিকানায় (ডাবল-কাউন্ট এড়াতে)
 */
import type { SqlExecutor } from '../d1';
import type { Order } from '@/types';

export interface D1Ctx {
  exec: SqlExecutor;
  tenantId: string;
  deviceId: string | null;
}

const POISHA = (taka: number | undefined | null): number => Math.round((Number(taka) || 0) * 100);

export async function replicateOrderD1(ctx: D1Ctx, order: Order): Promise<{ written: boolean }> {
  // কাস্টমার-রো অস্তিত্ব নিশ্চিত (FK) — আগে ফোন-দিয়ে খোঁজা, না পেলেই নতুন; ক্যাশ-কলাম নয়
  let customerId = order.customerId ?? null;
  if (!customerId && order.phone) {
    const existing = await ctx.exec.query<{ id: string }>(
      'SELECT id FROM customers WHERE tenant_id = ? AND phone = ? AND deleted_at IS NULL',
      [ctx.tenantId, order.phone]
    );
    if (existing[0]) {
      customerId = existing[0].id;
    } else {
      customerId = `cust-${crypto.randomUUID()}`;
      await ctx.exec.query(
        `INSERT OR IGNORE INTO customers (id, tenant_id, name, phone, due_cached, total_purchases_p, order_count, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?)`,
        [customerId, ctx.tenantId, order.customerName, order.phone, order.createdAt, new Date().toISOString()]
      );
    }
  } else if (customerId) {
    await ctx.exec.query(
      `INSERT OR IGNORE INTO customers (id, tenant_id, name, phone, due_cached, total_purchases_p, order_count, created_at, updated_at)
       VALUES (?, ?, ?, ?, 0, 0, 0, ?, ?)`,
      [customerId, ctx.tenantId, order.customerName, order.phone || '', order.createdAt, new Date().toISOString()]
    );
  }

  const paymentMethod = order.paymentMethod === 'bKash / Nagad' ? 'bkash' : 'cod';
  await ctx.exec.batch([
    {
      sql: `INSERT OR IGNORE INTO orders (id, tenant_id, order_number, source, customer_id, customer_name, customer_phone,
            shipping_address, shipping_zone, subtotal_p, discount_p, delivery_fee_p, total_p, paid_amount_p, due_amount_p,
            coupon_code, payment_method, status, note, admin_note, device_id, public_token, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      params: [
        order.id, ctx.tenantId, order.orderNumber, order.source === 'in-store' ? 'in-store' : 'online',
        customerId, order.customerName, order.phone || '', order.address || '',
        order.city === 'Outside Dhaka' ? 'outside_dhaka' : 'inside_dhaka',
        POISHA(order.subtotal), POISHA(order.discount ?? 0), POISHA(order.deliveryFee), POISHA(order.total),
        POISHA(order.paidAmount ?? order.total), POISHA(order.dueAmount ?? 0),
        order.couponCode ?? null, paymentMethod, order.status ?? 'Pending',
        order.note ?? null, order.adminNote ?? null, ctx.deviceId, order.publicToken ?? null,
        order.createdAt, new Date().toISOString(),
      ],
    },
    ...order.items.map((it, i) => ({
      sql: `INSERT OR IGNORE INTO order_items (id, tenant_id, order_id, product_id, name, sku, size, color, image,
            unit_price_p, unit_cost_p, quantity, line_total_p, created_at, updated_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      params: [
        `oit-${order.id}-${i}`, ctx.tenantId, order.id, it.productId, it.name, null,
        it.selectedSize, it.selectedColor, it.image, POISHA(it.price), it.costPrice !== undefined ? POISHA(it.costPrice) : null,
        it.quantity, POISHA(it.price * it.quantity), order.createdAt, new Date().toISOString(),
      ],
    })),
  ]);
  return { written: true };
}

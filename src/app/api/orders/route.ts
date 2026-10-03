import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getOrders, createOrder, OrderValidationError } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';

export const runtime = 'edge';

// zod ভ্যালিডেশন (P1) — দাম/মোট ইচ্ছাকৃতভাবে স্কিমায় নেই; সার্ভার createOrder-এ নিজেই হিসাব করে
const orderItemSchema = z.object({
  productId: z.string().min(1).max(64),
  quantity: z.number().int().min(1).max(99),
  selectedSize: z.string().min(1).max(40),
  selectedColor: z.string().min(1).max(40),
});

const orderSchema = z.object({
  customerName: z.string().trim().min(1).max(80),
  phone: z.string().trim().regex(/^[0-9+\-\s]{6,20}$/, 'সঠিক মোবাইল নম্বর দিন'),
  address: z.string().trim().min(5).max(500),
  city: z.enum(['Inside Dhaka', 'Outside Dhaka']),
  paymentMethod: z.enum(['Cash on Delivery', 'bKash / Nagad']),
  bkashTrxId: z.string().trim().max(40).optional(),
  note: z.string().trim().max(300).optional(),
  items: z.array(orderItemSchema).min(1).max(30),
  couponCode: z.string().trim().max(40).optional(),
});

/** অ্যাডমিন অর্ডার-তালিকা (পাবলিক নয় — সব অর্ডারের নাম-ফোন-ঠিকানা এখানে) */
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const orders = await getOrders();
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

/** পাবলিক চেকআউট — zod-যাচিত ইনপুট, দাম/কুপন/স্টক সার্ভারেই যাচাই ও গণনা */
export async function POST(request: Request) {
  // স্প্যাম-অর্ডার গেট — প্রতি IP ঘণ্টায় ১০টি
  const rl = await checkRateLimit('order', clientIp(request), 10, 3600);
  if (!rl.ok) {
    return NextResponse.json(
      { error: 'অনেক বেশি অর্ডারের চেষ্টা হয়েছে — কিছুক্ষণ পরে আবার চেষ্টা করুন।' },
      { status: 429 }
    );
  }
  try {
    const parsed = orderSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'অর্ডারের তথ্য সঠিক নয় — নাম, ফোন, ঠিকানা ও কার্ট যাচাই করুন।' },
        { status: 400 }
      );
    }
    const order = await createOrder(parsed.data);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    if (error instanceof OrderValidationError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

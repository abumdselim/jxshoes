import { NextResponse } from 'next/server';
import { getOrders, getDuePayments } from '@/lib/store';

export const runtime = 'edge';

/** কাস্টমারের বিস্তারিত খাতা: তার সব অর্ডার + বাকি পরিশোধের হিস্ট্রি */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const [orders, payments] = await Promise.all([getOrders(), getDuePayments()]);
    const customerOrders = orders.filter(o => o.customerId === params.id || o.phone === payments.find(p => p.customerId === params.id)?.customerPhone);
    const customerPayments = payments.filter(p => p.customerId === params.id);
    return NextResponse.json({ orders: customerOrders, payments: customerPayments });
  } catch {
    return NextResponse.json({ error: 'খাতা আনা যায়নি' }, { status: 500 });
  }
}

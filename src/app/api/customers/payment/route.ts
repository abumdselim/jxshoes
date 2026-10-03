import { NextResponse } from 'next/server';
import { recordDuePayment } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'edge';

/** বাকি আদায় (অ্যাডমিন) — Body: { customerId, amount, method, note? } */
export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    if (!body.customerId || !body.amount || Number(body.amount) <= 0) {
      return NextResponse.json({ error: 'কাস্টমার ও সঠিক পরিমাণ দিন' }, { status: 400 });
    }
    const method = ['Cash', 'bKash', 'Nagad'].includes(body.method) ? body.method : 'Cash';
    const result = await recordDuePayment({
      customerId: body.customerId,
      amount: Number(body.amount),
      method,
      note: typeof body.note === 'string' ? body.note : undefined,
    });
    if (!result) {
      return NextResponse.json({ error: 'কাস্টমার পাওয়া যায়নি' }, { status: 404 });
    }
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'কালেকশন সংরক্ষণ করা যায়নি' }, { status: 500 });
  }
}

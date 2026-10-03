import { NextResponse } from 'next/server';
import { validateCoupon } from '@/lib/store';
import { checkRateLimit, clientIp } from '@/lib/rateLimit';

export const runtime = 'edge';

export async function POST(request: Request) {
  // কোড-এনুমারেশন ঠেকাতে রেট-লিমিট (প্রতি IP ১৫ মিনিটে ৩০ চেষ্টা)
  const rl = await checkRateLimit('coupon', clientIp(request), 30, 900);
  if (!rl.ok) {
    return NextResponse.json(
      { valid: false, discount: 0, message: 'অনেক বেশি চেষ্টা — কিছুক্ষণ পরে আবার চেষ্টা করুন' },
      { status: 429 }
    );
  }
  try {
    const { code, orderTotal } = await request.json();
    if (!code) {
      return NextResponse.json({ valid: false, discount: 0, message: 'কুপন কোড প্রদান করুন' }, { status: 400 });
    }
    const result = await validateCoupon(code, Number(orderTotal) || 0);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ valid: false, discount: 0, message: 'সার্ভার ত্রুটি' }, { status: 500 });
  }
}

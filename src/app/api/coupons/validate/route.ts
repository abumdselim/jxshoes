import { NextResponse } from 'next/server';
import { validateCoupon } from '@/lib/store';

export async function POST(request: Request) {
  try {
    const { code, orderTotal } = await request.json();
    if (!code) {
      return NextResponse.json({ valid: false, discount: 0, message: 'কুপন কোড প্রদান করুন' }, { status: 400 });
    }
    const result = validateCoupon(code, Number(orderTotal) || 0);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ valid: false, discount: 0, message: 'সার্ভার ত্রুটি' }, { status: 500 });
  }
}

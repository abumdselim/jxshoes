import { NextResponse } from 'next/server';
import { getCoupons, saveCoupon, deleteCoupon } from '@/lib/store';

export const runtime = 'edge';

export async function GET() {
  try {
    const coupons = await getCoupons();
    return NextResponse.json(coupons);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch coupons' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.code || !body.value) {
      return NextResponse.json({ error: 'Coupon code and value are required' }, { status: 400 });
    }
    const coupon = await saveCoupon(body);
    return NextResponse.json(coupon, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save coupon' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'ID is required' }, { status: 400 });
    await deleteCoupon(id);
    return NextResponse.json({ message: 'Coupon deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete coupon' }, { status: 500 });
  }
}

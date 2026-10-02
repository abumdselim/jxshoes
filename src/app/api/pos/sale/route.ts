import { NextResponse } from 'next/server';
import { createPosSale } from '@/lib/store';

export const runtime = 'edge';

/**
 * ইন-স্টোর POS দ্রুত বিক্রি — AI কুইক সেল পপআপ থেকে কনফার্ম করা হলে এখানে আসে
 * Body: { items: [{ productId, variantId?, quantity, size?, color? }], customerName?, note? }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'অন্তত একটি প্রোডাক্ট প্রয়োজন' }, { status: 400 });
    }

    const order = await createPosSale(body.items, {
      customerName: typeof body.customerName === 'string' ? body.customerName : undefined,
      customerPhone: typeof body.customerPhone === 'string' ? body.customerPhone : undefined,
      customerAddress: typeof body.customerAddress === 'string' ? body.customerAddress : undefined,
      paidAmount: body.paidAmount !== undefined ? Number(body.paidAmount) : undefined,
      note: typeof body.note === 'string' ? body.note : undefined,
    });

    if (!order) {
      return NextResponse.json(
        { error: 'বিক্রি সংরক্ষণ করা যায়নি — প্রোডাক্ট খুঁজে পাওয়া যায়নি' },
        { status: 400 }
      );
    }

    return NextResponse.json({ success: true, order }, { status: 201 });
  } catch (error) {
    console.error('POS sale error:', error);
    return NextResponse.json({ error: 'বিক্রি সংরক্ষণে সমস্যা হয়েছে' }, { status: 500 });
  }
}

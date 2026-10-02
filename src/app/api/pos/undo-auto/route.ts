import { NextResponse } from 'next/server';
import { adjustProductStock, getProducts } from '@/lib/store';

export const runtime = 'edge';

/**
 * AI অটো-রিস্টক আন্ডো — ভয়েস কমান্ডে স্বয়ংক্রিয়ভাবে করা রিস্টক ফিরিয়ে আনা
 * Body: { productId, quantity }
 * স্টক প্রত্যাহার + ADJUSTMENT মুভমেন্ট লগ (হিসাব অক্ষত থাকে)
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const productId = body?.productId;
    const quantity = Number(body?.quantity);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return NextResponse.json({ error: 'প্রোডাক্ট ও সঠিক পরিমাণ দিন' }, { status: 400 });
    }

    const products = await getProducts();
    const prod = products.find(p => p.id === productId);
    if (!prod) {
      return NextResponse.json({ error: 'প্রোডাক্ট পাওয়া যায়নি' }, { status: 404 });
    }
    if (prod.stockCount < quantity) {
      return NextResponse.json(
        { error: `বর্তমান স্টক (${prod.stockCount}) কম থাকায় আন্ডো করা যাচ্ছে না` },
        { status: 400 }
      );
    }

    const updated = await adjustProductStock(
      productId,
      prod.stockCount - quantity,
      'ADJUSTMENT',
      'AI অটো-রিস্টক আন্ডো (দোকানদার ফিরিয়ে নিয়েছেন)'
    );

    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    console.error('undo-auto error:', error);
    return NextResponse.json({ error: 'আন্ডো করা যায়নি' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { updateOrderStatus, getOrderById } from '@/lib/store';
import { requireAdmin, timingSafeEqualStr } from '@/lib/adminAuth';

export const runtime = 'edge';

/**
 * পাবলিক অর্ডার-ভিউ (P1) — শুধু সঠিক অনুমান-অযোগ্য টোকেন (?t=publicToken) থাকলে
 * সেই একটি অর্ডার ফেরত যায়; adminNote ও items[].costPrice বাদ।
 * টোকেনহীন/ভুল টোকেন = 404 — অর্ডারের অস্তিত্বও ফাঁসে না।
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const token = new URL(request.url).searchParams.get('t') || '';
    const order = await getOrderById(id);
    if (!order || !order.publicToken || !token || !timingSafeEqualStr(token, order.publicToken)) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const publicOrder = {
      ...order,
      adminNote: undefined as string | undefined,
      items: order.items.map(it => ({ ...it, costPrice: undefined as number | undefined })),
    };
    return NextResponse.json(publicOrder);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch order' }, { status: 500 });
  }
}

/** অ্যাডমিন — অর্ডারের status/adminNote বদল */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { status } = await request.json();
    const updated = await updateOrderStatus(id, status);
    if (!updated) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update order status' }, { status: 500 });
  }
}

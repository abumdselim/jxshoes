import { NextResponse } from 'next/server';
import { getOrders, createOrder } from '@/lib/store';

export const runtime = 'edge';

export async function GET() {
  try {
    const orders = await getOrders();
    return NextResponse.json(orders);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch orders' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.customerName || !body.phone || !body.items || body.items.length === 0) {
      return NextResponse.json({ error: 'Customer name, phone and items are required' }, { status: 400 });
    }
    const order = await createOrder(body);
    return NextResponse.json(order, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create order' }, { status: 500 });
  }
}

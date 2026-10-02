import { NextResponse } from 'next/server';
import { getCustomers, getDuePayments, saveCustomer, deleteCustomer } from '@/lib/store';

export const runtime = 'edge';

export async function GET() {
  try {
    const [customers, payments] = await Promise.all([getCustomers(), getDuePayments()]);
    return NextResponse.json({ customers, payments });
  } catch {
    return NextResponse.json({ error: 'কাস্টমার তালিকা আনা যায়নি' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.phone) {
      return NextResponse.json({ error: 'নাম ও ফোন নম্বর দিন' }, { status: 400 });
    }
    const customer = await saveCustomer(body);
    return NextResponse.json(customer, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'কাস্টমার সংরক্ষণ করা যায়নি' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id প্রয়োজন' }, { status: 400 });
    const ok = await deleteCustomer(id);
    if (!ok) return NextResponse.json({ error: 'কাস্টমার পাওয়া যায়নি' }, { status: 404 });
    return NextResponse.json({ message: 'কাস্টমার মুছে ফেলা হয়েছে' });
  } catch {
    return NextResponse.json({ error: 'মুছে ফেলা যায়নি' }, { status: 500 });
  }
}

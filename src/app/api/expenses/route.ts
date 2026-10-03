import { NextResponse } from 'next/server';
import { getExpenses, saveExpense, deleteExpense } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'edge';

export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await getExpenses());
  } catch {
    return NextResponse.json({ error: 'খরচের তালিকা আনা যায়নি' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    if (!body.category || !body.amount || Number(body.amount) <= 0) {
      return NextResponse.json({ error: 'খাতা ও সঠিক পরিমাণ দিন' }, { status: 400 });
    }
    const expense = await saveExpense({
      category: body.category,
      amount: Number(body.amount),
      note: typeof body.note === 'string' ? body.note : undefined,
    });
    return NextResponse.json(expense, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'খরচ সংরক্ষণ করা যায়নি' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return NextResponse.json({ error: 'id প্রয়োজন' }, { status: 400 });
    const ok = await deleteExpense(id);
    if (!ok) return NextResponse.json({ error: 'খরচ পাওয়া যায়নি' }, { status: 404 });
    return NextResponse.json({ message: 'খরচ মুছে ফেলা হয়েছে' });
  } catch {
    return NextResponse.json({ error: 'মুছে ফেলা যায়নি' }, { status: 500 });
  }
}

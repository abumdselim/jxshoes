import { NextResponse } from 'next/server';
import { getNotifications, saveNotifications } from '@/lib/store';

export const runtime = 'edge';

/** অ্যাডমিন নোটিফিকেশন তালিকা; ?unreadCount=1 দিলে শুধু অপঠিত সংখ্যা */
export async function GET(request: Request) {
  try {
    const list = await getNotifications();
    const url = new URL(request.url);
    if (url.searchParams.get('unreadCount') === '1') {
      return NextResponse.json({ count: list.filter(n => !n.read).length });
    }
    return NextResponse.json(list);
  } catch {
    return NextResponse.json({ error: 'নোটিফিকেশন আনা যায়নি' }, { status: 500 });
  }
}

/** পড়া হিসেবে চিহ্নিত করা — { id } অথবা { all: true } */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const list = await getNotifications();
    const updated = list.map(n =>
      body?.all || (body?.id && n.id === body.id) ? { ...n, read: true } : n
    );
    await saveNotifications(updated);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'আপডেট করা যায়নি' }, { status: 500 });
  }
}

/** মুছে ফেলা — { id } অথবা { all: true } */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const list = await getNotifications();
    const remaining = body?.all ? [] : list.filter(n => n.id !== body?.id);
    await saveNotifications(remaining);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'মুছা যায়নি' }, { status: 500 });
  }
}

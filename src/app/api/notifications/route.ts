import { NextResponse } from 'next/server';
import { getNotifications, markNotificationsRead, deleteNotifications, listNotificationIds } from '@/lib/store';

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
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'নোটিফিকেশন আনা যায়নি' }, { status: 500 });
  }
}

/** পড়া হিসেবে চিহ্নিত করা — { id } অথবা { all: true } */
export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const ids = body?.all
      ? await listNotificationIds()
      : body?.id
      ? [String(body.id)]
      : [];
    await markNotificationsRead(ids);
    return NextResponse.json({ ok: true, count: ids.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'আপডেট করা যায়নি' }, { status: 500 });
  }
}

/** মুছে ফেলা — { id } অথবা { all: true } */
export async function DELETE(request: Request) {
  try {
    const body = await request.json();
    const ids = body?.all
      ? await listNotificationIds()
      : body?.id
      ? [String(body.id)]
      : [];
    await deleteNotifications(ids);
    return NextResponse.json({ ok: true, count: ids.length });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'মুছা যায়নি' }, { status: 500 });
  }
}

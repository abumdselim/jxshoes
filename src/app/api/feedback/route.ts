import { NextResponse } from 'next/server';
import { addNotification } from '@/lib/store';

export const runtime = 'edge';

/** লাইভ ওয়েবসাইট থেকে কাস্টমারের পরামর্শ/অভিযোগ জমা নেওয়া (পাবলিক) */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const type = body?.type === 'complaint' ? 'complaint' : 'feedback';
    const message = typeof body?.message === 'string' ? body.message.trim().slice(0, 1000) : '';
    if (!message) {
      return NextResponse.json({ error: 'মতামত বা অভিযোগের বিবরণ লিখুন' }, { status: 400 });
    }
    const name = typeof body?.name === 'string' ? body.name.trim().slice(0, 60) : '';
    const phone = typeof body?.phone === 'string' ? body.phone.trim().slice(0, 20) : '';
    const label = type === 'complaint' ? 'অভিযোগ' : 'পরামর্শ';

    await addNotification({
      type,
      title: `${label} — লাইভ ওয়েবসাইট থেকে`,
      message: `${name || 'নাম দেওয়া হয়নি'}${phone ? ` (ফোন: ${phone})` : ''}: ${message}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? `পাঠানো যায়নি — ${err.message}` : 'পাঠানো যায়নি' },
      { status: 500 }
    );
  }
}

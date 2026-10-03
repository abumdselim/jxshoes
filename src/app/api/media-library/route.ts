import { NextResponse } from 'next/server';
import { getMediaLibrary, saveMediaLibrary } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'edge';

/** মিডিয়া লাইব্রেরি (অ্যাডমিন) — আপলোড করা কিন্তু এখনো কোনো প্রোডাক্টে যুক্ত না হওয়া ছবির URL তালিকা */
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await getMediaLibrary());
  } catch {
    return NextResponse.json({ error: 'লাইব্রেরি আনা যায়নি' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const urls: string[] = Array.isArray(body?.urls)
      ? body.urls.filter((u: unknown) => typeof u === 'string' && u.trim())
      : [];
    if (urls.length === 0) {
      return NextResponse.json({ error: 'কোনো ছবির URL পাওয়া যায়নি' }, { status: 400 });
    }
    const current = await getMediaLibrary();
    await saveMediaLibrary([...current, ...urls]);
    return NextResponse.json({ ok: true, count: urls.length });
  } catch {
    return NextResponse.json({ error: 'লাইব্রেরি আপডেট করা যায়নি' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const remove: string[] = Array.isArray(body?.urls)
      ? body.urls.filter((u: unknown) => typeof u === 'string' && u)
      : [];
    if (remove.length === 0) {
      return NextResponse.json({ error: 'কোনো ছবির URL পাওয়া যায়নি' }, { status: 400 });
    }
    const current = await getMediaLibrary();
    await saveMediaLibrary(current.filter((u) => !remove.includes(u)));
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'লাইব্রেরি আপডেট করা যায়নি' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getFastMovers } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'edge';

/** দ্রুততম বিক্রিত পণ্য — স্টক হওয়ার দিন থেকে গড়ে দিনে কতটা বিক্রি (velocity) র‍্যাংকিং (অ্যাডমিন) */
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await getFastMovers(6));
  } catch {
    return NextResponse.json({ error: 'ফাস্ট-মুভার তালিকা আনা যায়নি' }, { status: 500 });
  }
}

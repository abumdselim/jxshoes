import { NextResponse } from 'next/server';
import { getFastMovers } from '@/lib/store';

export const runtime = 'edge';

/** দ্রুততম বিক্রিত পণ্য — স্টক হওয়ার দিন থেকে গড়ে দিনে কতটা বিক্রি (velocity) র‍্যাংকিং */
export async function GET() {
  try {
    return NextResponse.json(await getFastMovers(6));
  } catch {
    return NextResponse.json({ error: 'ফাস্ট-মুভার তালিকা আনা যায়নি' }, { status: 500 });
  }
}

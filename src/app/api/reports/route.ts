import { NextResponse } from 'next/server';
import { getReports } from '@/lib/store';

export const runtime = 'edge';

/** AI রিপোর্ট হিস্ট্রি (সর্বশেষ ২৪টা) */
export async function GET() {
  try {
    return NextResponse.json(await getReports());
  } catch {
    return NextResponse.json({ error: 'রিপোর্ট আনা যায়নি' }, { status: 500 });
  }
}

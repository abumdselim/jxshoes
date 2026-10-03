import { NextResponse } from 'next/server';
import { getReports } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'edge';

/** AI রিপোর্ট হিস্ট্রি (সর্বশেষ ২৪টা, অ্যাডমিন) */
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await getReports());
  } catch {
    return NextResponse.json({ error: 'রিপোর্ট আনা যায়নি' }, { status: 500 });
  }
}

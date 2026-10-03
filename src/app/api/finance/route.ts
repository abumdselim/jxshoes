import { NextResponse } from 'next/server';
import { computeFinanceSummary } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'edge';

/** পূর্ণাঙ্গ লাভ-ক্ষতি ও হিসাব সামারি (অ্যাডমিন) */
export async function GET(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    return NextResponse.json(await computeFinanceSummary());
  } catch {
    return NextResponse.json({ error: 'হিসাব আনা যায়নি' }, { status: 500 });
  }
}

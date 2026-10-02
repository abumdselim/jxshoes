import { NextResponse } from 'next/server';
import { computeFinanceSummary } from '@/lib/store';

export const runtime = 'edge';

/** পূর্ণাঙ্গ লাভ-ক্ষতি ও হিসাব সামারি */
export async function GET() {
  try {
    return NextResponse.json(await computeFinanceSummary());
  } catch {
    return NextResponse.json({ error: 'হিসাব আনা যায়নি' }, { status: 500 });
  }
}

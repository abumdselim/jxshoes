import { NextResponse } from 'next/server';
import { runDailyWatchers } from '@/lib/watchers';
import { getDailyBrief } from '@/lib/store';

export const runtime = 'edge';

/**
 * দৈনিক AI ওয়াচার (cron worker দ্বারা ট্রিগারড, x-cron-secret দিয়ে যাচাই):
 * - ডিটারমিনিস্টিক চেক (স্টক-শেষ, লো-স্টক, ঝুলন্ত অর্ডার, বাকি, বিক্রয়-শূন্যতা) → নোটিফিকেশন
 * - ডেইলি ব্রিফ এখনো জেনারেট হয়নি হলে জেনারেট করার ইঙ্গিত দেয় (মালিক অ্যাপ খুললেই তৈরি হবে;
 *   এখানে শুধু ওয়াচারই চালানো হয় — AI-খরচ নিয়ন্ত্রণে)
 * সব সতর্কতা আইডি-কনভেনশনে ডিডুপ — দিনে একবারই আসে।
 */
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET || '';
  const provided = request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret') || '';
  if (!secret || provided !== secret) {
    return NextResponse.json({ error: 'অননুমোদিত' }, { status: 401 });
  }

  try {
    const watch = await runDailyWatchers();
    const brief = await getDailyBrief();
    return NextResponse.json({
      success: true,
      created: watch.created,
      alerts: watch.alerts.map(a => a.key),
      briefReadyForToday: Boolean(brief),
    });
  } catch (error) {
    console.error('Cron watch error:', error);
    return NextResponse.json({ error: 'ওয়াচার চালানো যায়নি' }, { status: 500 });
  }
}

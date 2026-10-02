import { NextResponse } from 'next/server';
import { getCfEnv } from '@/lib/cfEnv';
import { generateReport } from '@/lib/report';
import { getReports, getStoreSettings, saveReport } from '@/lib/store';
import { isEmailConfigured, sendEmail } from '@/lib/email';
import { renderReportEmailHtml } from '@/lib/report';

export const runtime = 'edge';

/**
 * Cron Worker-এর জন্য রিপোর্ট এন্ডপয়েন্ট
 * ----------------------------------------
 * GET /api/cron/report?type=weekly|monthly|auto&send=1&to=email
 * Header: x-cron-secret: <CRON_SECRET>
 *
 * type=auto: মাসের ১ তারিখে মাসিক, সোমবারে সাপ্তাহিক, অন্য দিনে skip
 * রিপোর্ট AI দিয়ে তৈরি হয়ে KV-তে সেভ হয় + (কনফিগার থাকলে) ইমেইলে যায়।
 * একটা ছোট Worker (workers/report-cron) শিডিউল করে এই URL-এ হিট করে।
 */
export async function GET(request: Request) {
  const secret = getCfEnv().cronSecret;
  if (!secret) {
    return NextResponse.json({ error: 'CRON_SECRET সেট করা হয়নি (Pages env)' }, { status: 503 });
  }

  const provided =
    request.headers.get('x-cron-secret') || new URL(request.url).searchParams.get('secret') || '';
  if (provided !== secret) {
    return NextResponse.json({ error: 'অনুমতি নেই' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  let type = searchParams.get('type') || 'auto';

  if (type === 'auto') {
    const now = new Date();
    const bdNow = new Date(now.getTime() + 6 * 3600000); // Asia/Dhaka আনুমানিক
    if (bdNow.getDate() === 1) type = 'monthly';
    else if (bdNow.getDay() === 1) type = 'weekly'; // সোমবার
    else {
      return NextResponse.json({ skipped: true, reason: 'আজ রিপোর্টের দিন নয় (সোমবার/১ তারিখে চলে)' });
    }
  }

  const reportType = type === 'monthly' ? 'monthly' : 'weekly';

  let report;
  try {
    report = await generateReport(reportType);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'রিপোর্ট তৈরি করা যায়নি' },
      { status: 500 }
    );
  }

  // ইমেইল (কনফিগার + প্রাপক থাকলে)
  let emailed: string | null = null;
  let emailError: string | null = null;
  const shouldSend = searchParams.get('send') !== '0';
  const settings = await getStoreSettings();
  const to = (searchParams.get('to') || settings.email || '').trim();

  if (shouldSend && to) {
    if (!isEmailConfigured()) {
      emailError = 'ইমেইল সেটআপ হয়নি (EMAIL_FROM_ADDRESS/ডোমেইন ভেরিফিকেশন)';
    } else {
      const result = await sendEmail({
        to,
        subject: `${reportType === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'} বিজনেস রিপোর্ট — ${settings.storeName}`,
        html: renderReportEmailHtml(report, settings.storeName),
        text: `${report.headline}\n\n${report.executiveSummary}\n\n${report.scorecard.map(s => `${s.label}: ${s.value}`).join('\n')}`,
        fromName: settings.storeName,
      });
      if (result.ok) {
        emailed = to;
        report.emailedTo = to;
        await saveReport(report);
      } else {
        emailError = result.error || 'অজানা ইমেইল এরর';
      }
    }
  }

  const total = (await getReports()).length;
  return NextResponse.json({
    success: true,
    reportId: report.id,
    type: reportType,
    emailed,
    emailError,
    totalStored: total,
  });
}

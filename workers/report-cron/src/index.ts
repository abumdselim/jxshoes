/**
 * Shopkeeper রিপোর্ট + AI ওয়াচার Cron Worker
 * --------------------------------------------
 * - প্রতিদিন রাত ২টা UTC (বাংলাদেশ সময় সকাল ৮টা): /api/cron/watch — প্রোঅ্যাকটিভ AI
 *   সতর্কতা (স্টক-শেষ, ঝুলন্ত অর্ডার, বাকি, বিক্রয়-শূন্যতা → নোটিফিকেশন সেন্টার)
 * - প্রতি সোমবার / মাসের ১ তারিখে: /api/cron/report — AI সাপ্তাহিক/মাসিক রিপোর্ট + ইমেইল
 * রিপোর্ট তৈরি (AI) + KV সেভ + ইমেইল — সব মূল অ্যাপই করে; Worker শুধু ঘড়ি।
 *
 * ডেপ্লয়: workers/report-cron/README.md দেখুন।
 */

export interface Env {
  SITE_URL: string;
  CRON_SECRET: string;
}

export default {
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    // cron অনুযায়ী কাজ: প্রতিদিন = AI ওয়াচার; মাসের ১ তারিখ = মাসিক রিপোর্ট; সোমবার = সাপ্তাহিক
    const kind =
      event.cron === '0 2 * * *'
        ? 'watch'
        : event.cron === '0 2 1 * *'
          ? 'monthly'
          : 'weekly';

    const url =
      kind === 'watch'
        ? `${env.SITE_URL.replace(/\/$/, '')}/api/cron/watch`
        : `${env.SITE_URL.replace(/\/$/, '')}/api/cron/report?type=${kind}`;

    try {
      const res = await fetch(url, {
        headers: { 'x-cron-secret': env.CRON_SECRET },
      });
      const body = await res.text();
      console.log(`[jxshoes-report-cron] ${kind} → HTTP ${res.status}: ${body.slice(0, 500)}`);
    } catch (err) {
      console.error(`[jxshoes-report-cron] ${kind} ব্যর্থ:`, err);
    }
  },
};

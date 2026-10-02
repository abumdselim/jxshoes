/**
 * JxShoes রিপোর্ট Cron Worker
 * ----------------------------
 * প্রতি সোমবার ও মাসের ১ তারিখে (রাত ২টা UTC = বাংলাদেশ সময় সকাল ৮টা)
 * মূল অ্যাপের `/api/cron/report` এন্ডপয়েন্টে হিট করে।
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
    // cron অনুযায়ী রিপোর্ট টাইপ: মাসের ১ তারিখ = মাসিক, সোমবার = সাপ্তাহিক
    const type = event.cron === '0 2 1 * *' ? 'monthly' : 'weekly';

    const url = `${env.SITE_URL.replace(/\/$/, '')}/api/cron/report?type=${type}`;
    try {
      const res = await fetch(url, {
        headers: { 'x-cron-secret': env.CRON_SECRET },
      });
      const body = await res.text();
      console.log(`[jxshoes-report-cron] ${type} → HTTP ${res.status}: ${body.slice(0, 500)}`);
    } catch (err) {
      console.error(`[jxshoes-report-cron] ${type} ব্যর্থ:`, err);
    }
  },
};

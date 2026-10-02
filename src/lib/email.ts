/**
 * Cloudflare Email Service (REST API) — রিপোর্ট ইমেইল পাঠানোর হেল্পার
 * --------------------------------------------------------------------
 * প্রয়োজনীয় সেটআপ (একবার):
 * ১. নিজের ডোমেইন Cloudflare-এ থাকতে হবে + Email Sending চালু:
 *    `npx wrangler email sending enable yourdomain.com`
 * ২. API টোকেনে "Email Sending → Write" (বা Email Service) পারমিশন
 * ৩. Env: EMAIL_FROM_ADDRESS (যেমন reports@yourdomain.com), EMAIL_FROM_NAME (ঐচ্ছিক)
 *
 * REST API শেপ (Workers বাইন্ডিং থেকে আলাদা):
 * - POST /accounts/{id}/email/sending/send
 * - from অবজেক্টে `address` (কখনো `email` নয়), `reply_to` snake_case
 * - রেসপন্স result: { delivered, permanent_bounces, queued }
 */

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';

const FROM_ADDRESS = process.env.EMAIL_FROM_ADDRESS || '';

export function isEmailConfigured(): boolean {
  return Boolean(CF_ACCOUNT_ID && CF_API_TOKEN && FROM_ADDRESS);
}

export const EMAIL_NOT_CONFIGURED_MSG =
  'ইমেইল এখনো সেটআপ হয়নি। যা করতে হবে: (১) নিজের ডোমেইন দিয়ে `npx wrangler email sending enable yourdomain.com` চালান, (২) টোকেনে Email Sending পারমিশন দিন, (৩) EMAIL_FROM_ADDRESS env বসান। বিস্তারিত docs/ROADMAP.md-তে।';

export interface SendEmailResult {
  ok: boolean;
  delivered?: string[];
  error?: string;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName?: string;
}): Promise<SendEmailResult> {
  if (!isEmailConfigured()) return { ok: false, error: EMAIL_NOT_CONFIGURED_MSG };

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/email/sending/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: opts.to,
          from: { address: FROM_ADDRESS, name: opts.fromName || 'JxShoes AI' },
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        }),
      }
    );

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      const msg = Array.isArray(json?.errors) && json.errors.length > 0
        ? json.errors.map((e: { message?: string }) => e.message).join('; ')
        : `HTTP ${res.status}`;
      return { ok: false, error: `ইমেইল পাঠানো যায়নি: ${msg}` };
    }

    return {
      ok: true,
      delivered: json?.result?.delivered || [],
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'ইমেইল সার্ভারে সংযোগ ব্যর্থ' };
  }
}

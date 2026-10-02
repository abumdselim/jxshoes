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

import { getCfEnv } from './cfEnv';

export function isEmailConfigured(): boolean {
  const env = getCfEnv();
  return Boolean(env.accountId && env.apiToken && env.emailFromAddress);
}

export const EMAIL_NOT_CONFIGURED_MSG =
  'ইমেইল এখনো সেটআপ হয়নি। যা করতে হবে: (১) সার্ভারে ইমেইল সেন্ডিং চালু করুন, (২) টোকেনে Email Sending পারমিশন দিন, (৩) EMAIL_FROM_ADDRESS env বসান। বিস্তারিত docs/ROADMAP.md-তে।';

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
  const cf = getCfEnv();
  if (!isEmailConfigured()) return { ok: false, error: EMAIL_NOT_CONFIGURED_MSG };

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/email/sending/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${cf.apiToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: opts.to,
          from: { address: cf.emailFromAddress, name: opts.fromName || cf.emailFromName || 'Shopkeeper AI' },
          subject: opts.subject,
          html: opts.html,
          text: opts.text,
        }),
      }
    );

    const json = await res.json().catch(() => null);
    if (!res.ok || !json?.success) {
      // API-র raw এরর টেক্সট সার্ভার লগে, ক্লায়েন্টে জেনেরিক মেসেজ
      const detail = Array.isArray(json?.errors) && json.errors.length > 0
        ? json.errors.map((e: { message?: string }) => e.message).join('; ')
        : `HTTP ${res.status}`;
      console.warn('Email send failed:', detail);
      return { ok: false, error: `ইমেইল পাঠানো যায়নি (কোড ${res.status})` };
    }

    return {
      ok: true,
      delivered: json?.result?.delivered || [],
    };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'ইমেইল সার্ভারে সংযোগ ব্যর্থ' };
  }
}

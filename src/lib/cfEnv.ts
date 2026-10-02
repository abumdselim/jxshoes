/**
 * Cloudflare env অ্যাক্সেস
 * ------------------------
 * পড়ার ক্রম (প্রথম খালি-না-হওয়া ভ্যালুটাই ব্যবহৃত হয়):
 * ১. generatedEnv.ts — GitHub Actions বিল্ডে সিক্রেট দিয়ে জেনারেট হয়,
 *    এজ বান্ডেলে বেক হয়ে যায় (প্রোডাকশনের মূল উৎস)
 * ২. process.env — লোকাল ডেভে .env ফাইল থেকে
 *
 * এই হেল্পার ইচ্ছাকৃতভাবে @cloudflare/next-on-pages ইমপোর্ট করে না —
 * ওটার টাইপ ডিক্লারেশন workers-types গ্লোবালি লিক করে পুরো অ্যাপের
 * Response.json() টাইপ ভেঙে দেয়।
 */

import { GENERATED_ENV } from './generatedEnv';

export interface CfEnv {
  accountId: string;
  apiToken: string;
  kvId: string;
  r2Bucket: string;
  emailFromAddress: string;
  emailFromName: string;
  aiTextModel: string;
  aiFallbackModel: string;
  cronSecret: string;
  geminiApiKey: string;
  geminiModel: string;
  geminiFallbackModel: string;
}

function pick(generated: string, fromProcess: string): string {
  return generated || fromProcess || '';
}

export function getCfEnv(): CfEnv {
  return {
    accountId: pick(GENERATED_ENV.CLOUDFLARE_ACCOUNT_ID, process.env.CLOUDFLARE_ACCOUNT_ID || ''),
    apiToken: pick(GENERATED_ENV.CLOUDFLARE_API_TOKEN, process.env.CLOUDFLARE_API_TOKEN || ''),
    kvId: pick(GENERATED_ENV.CLOUDFLARE_KV_ID, process.env.CLOUDFLARE_KV_ID || ''),
    r2Bucket: process.env.CLOUDFLARE_R2_BUCKET || 'jxshoes-media',
    emailFromAddress: process.env.EMAIL_FROM_ADDRESS || '',
    emailFromName: process.env.EMAIL_FROM_NAME || '',
    aiTextModel: process.env.AI_TEXT_MODEL || '',
    aiFallbackModel: process.env.AI_FALLBACK_MODEL || '',
    cronSecret: pick(GENERATED_ENV.CRON_SECRET, process.env.CRON_SECRET || ''),
    geminiApiKey: pick(GENERATED_ENV.GEMINI_API_KEY, process.env.GEMINI_API_KEY || ''),
    geminiModel: process.env.GEMINI_MODEL || '',
    geminiFallbackModel: process.env.GEMINI_FALLBACK_MODEL || '',
  };
}

import { defineConfig } from '@playwright/test';
import { readLocalAdminPassword } from './e2e/helpers';

/**
 * E2E স্মোক (P2 ধাপ ৩) — চালানোর আগে একবার: `npx playwright install chromium`
 * তারপর: `npm run e2e` (ডেভ সার্ভার নিজেই চালু করে; চালু থাকলে reuse করে)
 */
export default defineConfig({
  testDir: './e2e',
  // dev-মোডে কোল্ড-কম্পাইল (প্রথম API-রিকোয়েস্টে রুট-কম্পাইল) ৩০ সেকেন্ডও নিতে পারে — ১২০ নিরাপদ
  timeout: 120_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    // webServer.env কিছু ক্ষেত্রে Next-প্রসেসে পৌঁছায় না — তাই স্পেকের পাসওয়ার্ডও
    // একই উৎস (.env) থেকে আসে (e2e/helpers.ts); এখানে সেট-করা মান সেরা-চেষ্টা মাত্র
    env: { ADMIN_PASSWORD: readLocalAdminPassword() }, // টেস্ট-অনলি; প্রোডাকশন সিক্রেট নয়
  },
});

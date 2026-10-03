import { defineConfig } from '@playwright/test';

/**
 * E2E স্মোক (P2 ধাপ ৩) — চালানোর আগে একবার: `npx playwright install chromium`
 * তারপর: `npm run e2e` (ডেভ সার্ভার নিজেই চালু করে; চালু থাকলে reuse করে)
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  use: { baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:3000' },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: true,
    env: { ADMIN_PASSWORD: 'test-pass-123' }, // টেস্ট-অনলি; প্রোডাকশন সিক্রেট নয়
  },
});

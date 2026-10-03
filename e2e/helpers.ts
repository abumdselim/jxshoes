/**
 * E2E হেল্পার — লগইন-স্মোকে কোন পাসওয়ার্ড ব্যবহৃত হবে।
 * উৎস-ক্রম: E2E_ADMIN_PASSWORD env → লোকাল `.env`-এর ADMIN_PASSWORD → ফলব্যাক।
 * কারণ: Playwright-এর webServer.env কিছু ক্ষেত্রে Next-প্রসেসে পৌঁছায় না; Next তখন
 * `.env`-এর মান নেয় — তাই স্পেক ও সার্ভার দুজনেই একই উৎস (.env) থেকে পড়লে কখনো অসঙ্গতি হয় না।
 * লোকাল `.env` গিট-ইগনোরড — এখানে কোনো সিক্রেট কমিট হয় না।
 */
import fs from 'node:fs';
import path from 'node:path';

export function readLocalAdminPassword(): string {
  const fromEnv = process.env.E2E_ADMIN_PASSWORD;
  if (fromEnv) return fromEnv;
  try {
    const file = fs.readFileSync(path.resolve(__dirname, '..', '.env'), 'utf8');
    const line = file.split(/\r?\n/).find(l => l.trim().startsWith('ADMIN_PASSWORD='));
    if (line) {
      return line.slice('ADMIN_PASSWORD='.length).trim().replace(/^["']|["']$/g, '');
    }
  } catch {
    // .env নেই — ফলব্যাক
  }
  return 'test-pass-123';
}

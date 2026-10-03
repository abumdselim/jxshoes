/**
 * E2E স্মোক (P2) — login → পণ্য তালিকা → POS/রিপোর্ট পেজ লোড।
 * AI-জেনারেটেড কনটেন্টের ওপর assertion নয় — নেটওয়ার্ক-নিরপেক্ষ রেন্ডার-চেক।
 * চালাতে: npx playwright install chromium && npm run e2e
 */
import { test, expect } from '@playwright/test';
import { readLocalAdminPassword } from './helpers';

const ADMIN_PASSWORD = readLocalAdminPassword();

test('লগইন → অ্যাডমিন ড্যাশবোর্ড রেন্ডার + sk_admin কুকি', async ({ page, context }) => {
  await page.goto('/login');
  await page.fill('input[type="password"]', ADMIN_PASSWORD);
  await page.keyboard.press('Enter');
  // dev-মোডে /admin প্রথমবার কম্পাইল + ড্যাশবোর্ড ডেটা — বড় টাইমআউট
  await page.waitForURL(/\/admin/, { timeout: 90_000 });
  const cookies = await context.cookies();
  expect(cookies.some(c => c.name === 'sk_admin')).toBe(true);
  await expect(page.locator('body')).toContainText(/ড্যাশবোর্ড|স্বাগতম|আজকের/, { timeout: 30_000 });
});

test('শপ পেজ পণ্য-গ্রিডসহ লোড হয় (পাবলিক)', async ({ page }) => {
  await page.goto('/shop');
  await expect(page.locator('body')).toContainText(/জুতা|ব্যাগ|কালেকশন|৳/, { timeout: 30_000 });
});

test('অ্যাডমিন রাউট লগইন ছাড়া /login-এ রিডাইরেক্ট হয় (middleware)', async ({ page }) => {
  await page.goto('/admin/settings');
  await page.waitForURL(/\/login/, { timeout: 30_000 });
});

test('অর্ডার API লগইন ছাড়া 401 দেয় (P1 রিগ্রেশন-গার্ড)', async ({ request }) => {
  const res = await request.get('/api/orders');
  expect(res.status()).toBe(401);
});

test('পাবলিক API লগইন ছাড়াই 200 (P1 রিগ্রেশন-গার্ড)', async ({ request }) => {
  expect((await request.get('/api/products')).status()).toBe(200);
  expect((await request.get('/api/settings')).status()).toBe(200);
});

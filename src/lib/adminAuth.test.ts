import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { isAdminRequest, timingSafeEqualStr } from './adminAuth';

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

const PASSWORD = 'test-pass-123';

function reqWithCookie(cookie: string | null): Request {
  const headers = new Headers();
  if (cookie !== null) headers.set('cookie', cookie);
  return new Request('https://example.com/api/test', { headers });
}

describe('timingSafeEqualStr', () => {
  it('সমান স্ট্রিং true; ভিন্ন false; ভিন্ন দৈর্ঘ্য false', () => {
    expect(timingSafeEqualStr('abc', 'abc')).toBe(true);
    expect(timingSafeEqualStr('abc', 'abd')).toBe(false);
    expect(timingSafeEqualStr('abc', 'abcd')).toBe(false);
    expect(timingSafeEqualStr('', '')).toBe(true);
  });
});

describe('isAdminRequest (কুকি-হ্যাশ যাচাই)', () => {
  beforeEach(() => {
    process.env.ADMIN_PASSWORD = PASSWORD;
  });
  afterEach(() => {
    delete process.env.ADMIN_PASSWORD;
  });

  it('সঠিক কুকি (SHA-256 হ্যাশ) → true', async () => {
    const hash = await sha256(PASSWORD);
    expect(await isAdminRequest(reqWithCookie(`sk_admin=${hash}`))).toBe(true);
  });

  it('ভুল কুকি → false; কুকি নেই → false', async () => {
    const wrong = await sha256('wrong-pass');
    expect(await isAdminRequest(reqWithCookie(`sk_admin=${wrong}`))).toBe(false);
    expect(await isAdminRequest(reqWithCookie(null))).toBe(false);
    expect(await isAdminRequest(reqWithCookie('other=x'))).toBe(false);
  });

  it('মাল্টি-কুকি হেডারে সঠিক sk_admin ধরা পড়ে', async () => {
    const hash = await sha256(PASSWORD);
    expect(await isAdminRequest(reqWithCookie(`theme=dark; sk_admin=${hash}; x=1`))).toBe(true);
  });

  // CHARACTERIZATION (নিরাপত্তা-মনে-করিয়ে-দেওয়া): পাসওয়ার্ড আনকনফিগার্ড = সব খোলা (ডেভ-কনভেনিয়েন্স)।
  // প্রোডাকশনে ADMIN_PASSWORD অবশ্যই সেট থাকতে হবে — deploy.yml সেটা করে।
  it('পাসওয়ার্ড আনকনফিগার্ড হলে fail-open (ডেভ-মোড আচরণ — ডকুমেন্টেড)', async () => {
    delete process.env.ADMIN_PASSWORD;
    expect(await isAdminRequest(reqWithCookie(null))).toBe(true);
  });
});

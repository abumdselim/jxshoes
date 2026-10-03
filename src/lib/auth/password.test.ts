import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, PBKDF2_ITERATIONS, PBKDF2_HASH_BYTES, PBKDF2_SALT_BYTES } from './password';

describe('hashPassword/verifyPassword (PBKDF2-SHA256, Web Crypto)', () => {
  it('হ্যাশ ফরম্যাট: pbkdf2$<iter>$<salt>$<hash> — iteration workerd-সীমায়', async () => {
    const h = await hashPassword('সোপনীর-গোপন-১২৩');
    const parts = h.split('$');
    expect(parts[0]).toBe('pbkdf2');
    expect(Number(parts[1])).toBe(PBKDF2_ITERATIONS);
    expect(Number(PBKDF2_ITERATIONS)).toBeLessThanOrEqual(100_000); // workerd cap — docs নোট
    expect(PBKDF2_HASH_BYTES).toBe(32);
    expect(PBKDF2_SALT_BYTES).toBe(16);
    // base64url — প্যাডিং/+/ / নেই
    expect(parts[2]).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(parts[3]).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it('সঠিক পাসওয়ার্ড → true; ভুল → false', async () => {
    const h = await hashPassword('correct-horse');
    expect(await verifyPassword('correct-horse', h)).toBe(true);
    expect(await verifyPassword('wrong-horse', h)).toBe(false);
    expect(await verifyPassword('', h)).toBe(false);
  });

  it('প্রতি-ইউজার salt: একই পাসওয়ার্ডে দুই হ্যাশ ভিন্ন, দুটোই যাচাই পাস', async () => {
    const a = await hashPassword('same-pass');
    const b = await hashPassword('same-pass');
    expect(a).not.toBe(b);
    expect(a.split('$')[2]).not.toBe(b.split('$')[2]); // salt ভিন্ন
    expect(await verifyPassword('same-pass', a)).toBe(true);
    expect(await verifyPassword('same-pass', b)).toBe(true);
  });

  it('হ্যাশে পাসওয়ার্ড প্লেইনটেক্সট/ডিরেক্ট হ্যাশ নেই', async () => {
    const h = await hashPassword('my-secret');
    expect(h).not.toContain('my-secret');
  });

  it('টেম্পার্ড হ্যাশ → false (throw নয়)', async () => {
    const h = await hashPassword('pass-1');
    const parts = h.split('$');
    const flipped = parts[3].slice(0, -2) + (parts[3].endsWith('AA') ? 'BB' : 'AA');
    expect(await verifyPassword('pass-1', [...parts.slice(0, 3), flipped].join('$'))).toBe(false);
  });

  it('ভাঙা/অজানা ফরম্যাট → false, কখনো throw নয়', async () => {
    await expect(verifyPassword('x', '')).resolves.toBe(false);
    await expect(verifyPassword('x', 'bcrypt$12$abcdef')).resolves.toBe(false);
    await expect(verifyPassword('x', 'pbkdf2$notanumber$abc$def')).resolves.toBe(false);
    await expect(verifyPassword('x', 'pbkdf2$999999999$abc$def')).resolves.toBe(false); // workerd-সীমার বাইরে
    await expect(verifyPassword('x', 'pbkdf2$1000$!!!bad-b64!!!$def')).resolves.toBe(false);
  });

  it('বাংলা/ইউনিকোড পাসওয়ার্ড দুই দিকেই চলে', async () => {
    const h = await hashPassword('জুতা-বিক্রেতা@২০২৬');
    expect(await verifyPassword('জুতা-বিক্রেতা@২০২৬', h)).toBe(true);
    expect(await verifyPassword('জুতা-বিক্রেতা@২০২৭', h)).toBe(false);
  });
});

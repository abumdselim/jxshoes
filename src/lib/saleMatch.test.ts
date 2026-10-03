import { describe, it, expect } from 'vitest';
import { bnToEnDigits, deterministicMatch } from './saleMatch';
import { makeProduct } from '../test/helpers';

const products = [
  makeProduct({
    id: 'p1',
    sku: 'JX-SH-001',
    barcode: '8901001001',
    sizes: ['40', '41', '42'],
    colors: [{ name: 'Black', hex: '#000000' }, { name: 'Jet Black', hex: '#0a0a0a' }],
    variants: [
      { id: 'v1', sku: 'JX-SH-001-42-BLK', size: '42', color: 'Black', stock: 5 },
      { id: 'v2', sku: 'JX-SH-001-41-BLK', size: '41', color: 'Black', stock: 0 },
    ],
  }),
];

describe('bnToEnDigits', () => {
  it('বাংলা সংখ্যা → ইংরেজি', () => {
    expect(bnToEnDigits('৪২')).toBe('42');
    expect(bnToEnDigits('২০২৬')).toBe('2026');
    expect(bnToEnDigits('abc')).toBe('abc');
  });
});

describe('deterministicMatch (voice/ASR → পণ্য)', () => {
  it('SKU + বাংলা সংখ্যার সাইজ ও পরিমাণ — "JX-SH-001 ৪২ এর ২টা"', () => {
    const m = deterministicMatch('JX-SH-001 ৪২ এর ২টা', products)!;
    expect(m.matched).toBe(true);
    expect(m.productId).toBe('p1');
    expect(m.size).toBe('42');
    expect(m.quantity).toBe(2);
    expect(m.confidence).toBe('high');
  });

  it('বারকোড দিয়ে ম্যাচ (দৈর্ঘ্য ≥ ৫)', () => {
    expect(deterministicMatch('8901001001 এর 1টা', products)!.productId).toBe('p1');
  });

  it('ভ্যারিয়েন্ট-SKU দিয়ে সরাসরি ম্যাচ', () => {
    const m = deterministicMatch('JX-SH-001-42-BLK 1টা', products)!;
    expect(m.variantId).toBe('v1');
    expect(m.size).toBe('42');
  });

  it('সাইজ না মিললে stock>0 ভ্যারিয়েন্ট ফলব্যাক', () => {
    const m = deterministicMatch('JX-SH-001 ৯৯ ১টা', products)!;
    expect(m.size).toBe('42'); // v2 stock 0 → v1
    expect(m.variantId).toBe('v1');
  });

  it('কালার-নাম substring ম্যাচ — find-ক্রম অনুযায়ী আগেরটা জেতে (Black ⊂ Jet Black)', () => {
    const m = deterministicMatch('JX-SH-001 jet black 1টা', products)!;
    // 'BLACK' তালিকার আগে থাকায় আগের কালারটাই ম্যাচ হয় — substring-প্রথম-ম্যাচ আচরণ লক
    expect(m.color).toBe('Black');
  });

  it('অজানা কোড → null', () => {
    expect(deterministicMatch('ABC-XYZ 1টা', products)).toBeNull();
  });

  it('পরিমাণ x-নোটেশন — "JX-SH-001 x 3"', () => {
    expect(deterministicMatch('JX-SH-001 x 3', products)!.quantity).toBe(3);
  });

  // CHARACTERIZATION/TODO: ASR-এ হাইফেন পড়ে গেলে ("JXSH001") substring-ম্যাচ ফেল করে —
  // হাইফেন/স্পেস-অজ্ঞেয়বাদী নরমালাইজেশন নেই (p2-test-plan §৩.৫)
  it('হাইফেন-বিহীন ASR আউটপুট ম্যাচ করে না (বর্তমান দুর্বলতা — লক)', () => {
    expect(deterministicMatch('JXSH001 42 1টা', products)).toBeNull();
  });
});

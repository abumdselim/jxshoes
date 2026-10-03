import { describe, it, expect } from 'vitest';
import { validateCouponInData } from './store';
import type { Coupon } from '@/types';

const coupons: Coupon[] = [
  { id: 'c1', code: 'EID50', discountType: 'fixed', value: 50, minOrder: 500, active: true },
  { id: 'c2', code: 'PCT10', discountType: 'percentage', value: 10, minOrder: 0, active: true },
  { id: 'c3', code: 'OFF', discountType: 'fixed', value: 100, minOrder: 0, active: false },
  { id: 'c4', code: 'BIG50', discountType: 'fixed', value: 50, minOrder: 0, active: true },
];

describe('validateCouponInData (কুপন পিওর কোর)', () => {
  it('fixed কুপন সঠিক ডিসকাউন্ট দেয়; ছোটহাতের/স্পেসসহ ইনপুট চলে', () => {
    expect(validateCouponInData(coupons, ' eid50 ', 800)).toMatchObject({ valid: true, discount: 50 });
  });

  it('percentage কুপন রাউন্ড করে — ৳999-এ ১০% → ১০০', () => {
    expect(validateCouponInData(coupons, 'PCT10', 999)).toMatchObject({ valid: true, discount: 100 });
  });

  it('minOrder-এর নিচে বাতিল + বাংলা মেসেজ', () => {
    const r = validateCouponInData(coupons, 'EID50', 499);
    expect(r.valid).toBe(false);
    expect(r.message).toContain('500');
  });

  it('অজানা কোড বাতিল', () => {
    expect(validateCouponInData(coupons, 'NOPE', 9999).valid).toBe(false);
  });

  it('inactive কুপন rejected — বর্তমানে এটাই একমাত্র "মেয়াদ-উত্তীর্ণ" পথ (expiry/usageLimit ফিচার নেই, TODO)', () => {
    expect(validateCouponInData(coupons, 'OFF', 9999).valid).toBe(false);
  });

  // CHARACTERIZATION: fixed কুপন total-এর চেয়ে বড় হলে discount ক্যাপ হয় না —
  // পরিকল্পিত ফিক্স: discount = Math.min(value, orderTotal)। ফিক্স হলে এই টেস্ট বদলাবে।
  it('fixed কুপন total-এর চেয়ে বড় হলেও পুরো ভ্যালু ফেরত দেয় (বর্তমান আচরণ — ক্যাপ নেই)', () => {
    expect(validateCouponInData(coupons, 'BIG50', 30).discount).toBe(50);
  });
});

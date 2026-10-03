import { describe, it, expect } from 'vitest';
import { applyDuePaymentInData, upsertCustomerInData } from './store';
import { makeData, makeCustomer } from '../test/helpers';

describe('applyDuePaymentInData (বাকি আদায় পিওর কোর)', () => {
  it('সাধারণ আংশিক আদায়: due ১০০০-এ ৪০০ → ৬০০; রেকর্ড তালিকার মাথায়', () => {
    const data = makeData({ customers: [makeCustomer({ id: 'c1', dueAmount: 1000 })] });
    const r = applyDuePaymentInData(data, { customerId: 'c1', amount: 400, method: 'Cash' });
    expect(r).not.toBeNull();
    expect(r!.customer.dueAmount).toBe(600);
    expect(data.duePayments[0].amount).toBe(400);
    expect(data.duePayments[0].customerId).toBe('c1');
  });

  it('পরপর আংশিক পরিশোধ ৪০০→৩০০→৩০০ = due ০', () => {
    const data = makeData({ customers: [makeCustomer({ id: 'c1', dueAmount: 1000 })] });
    applyDuePaymentInData(data, { customerId: 'c1', amount: 400, method: 'Cash' });
    applyDuePaymentInData(data, { customerId: 'c1', amount: 300, method: 'bKash' });
    applyDuePaymentInData(data, { customerId: 'c1', amount: 300, method: 'Cash' });
    expect(data.customers[0].dueAmount).toBe(0);
  });

  // CHARACTERIZATION: ওভার-পেমেন্টে অতিরিক্ত টাকা due 0-তে ক্ল্যাম্প হয়, কোথাও জমা থাকে না
  // (payment-এ পুরো অঙ্ক লগ হয় → totalCollected বাড়তি দেখায়)। TODO: advance/credit নোট।
  it('ওভার-পেমেন্ট: due ৪০০-এ ৫০০ → due ০, payment-এ পুরো ৫০০ লগ (বর্তমান আচরণ)', () => {
    const data = makeData({ customers: [makeCustomer({ id: 'c1', dueAmount: 400 })] });
    const r = applyDuePaymentInData(data, { customerId: 'c1', amount: 500, method: 'Cash' });
    expect(r!.customer.dueAmount).toBe(0);
    expect(r!.payment.amount).toBe(500);
  });

  // CHARACTERIZATION: ৳0/নেগেটিভ পেমেন্ট ভুল করে ৳১ হয়ে যায় (min-1 ক্ল্যাম্প)। TODO: 400 reject।
  it('৳0 ইনপুট ৳১ পেমেন্ট হয়ে যায় (বর্তমান আচরণ — min-1 ক্ল্যাম্প)', () => {
    const data = makeData({ customers: [makeCustomer({ id: 'c1', dueAmount: 100 })] });
    const r = applyDuePaymentInData(data, { customerId: 'c1', amount: 0, method: 'Cash' });
    expect(r!.payment.amount).toBe(1);
  });

  it('অজানা কাস্টমার → null', () => {
    expect(applyDuePaymentInData(makeData(), { customerId: 'ghost', amount: 100, method: 'Cash' })).toBeNull();
  });
});

describe('upsertCustomerInData (ফোন-কি আপসার্ট)', () => {
  it('নতুন ফোন → নতুন কাস্টমার তৈরি (purchase যোগ, due ০)', () => {
    const data = makeData();
    const cust = upsertCustomerInData(data, { name: 'করিম', phone: '01711111111', address: 'ঢাকা' }, 1500, 0);
    expect(data.customers).toHaveLength(1);
    expect(cust.phone).toBe('01711111111');
    expect(cust.totalPurchases).toBe(1500);
    expect(cust.orderCount).toBe(1);
    expect(cust.dueAmount).toBe(0);
  });

  it('একই ফোনে দ্বিতীয় বিক্রিতে যোগ হয়; বাকি-ডেল্টা যোগ (০-ক্ল্যাম্পসহ)', () => {
    const data = makeData({ customers: [makeCustomer({ id: 'c1', phone: '01711111111', dueAmount: 200, totalPurchases: 1000, orderCount: 1 })] });
    upsertCustomerInData(data, { phone: '01711111111' }, 800, 300);
    const c = data.customers[0];
    expect(c.totalPurchases).toBe(1800);
    expect(c.orderCount).toBe(2);
    expect(c.dueAmount).toBe(500);
  });

  it("'নাম নেই' প্লেসহোল্ডার নাম পরে আসল নাম এলে বদলে যায়", () => {
    const data = makeData({ customers: [makeCustomer({ id: 'c1', phone: '01711111111', name: 'নাম নেই' })] });
    upsertCustomerInData(data, { name: 'সেলিম', phone: '01711111111' }, 0, 0);
    expect(data.customers[0].name).toBe('সেলিম');
  });
});

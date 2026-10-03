import { describe, it, expect } from 'vitest';
import { applyPosSaleInData } from './store';
import { makeData, makeProduct } from '../test/helpers';

describe('applyPosSaleInData (POS বিক্রি পিওর কোর)', () => {
  it('সাধারণ সেল: মোট = দাম×পরিমাণ, পুরো ক্যাশ, স্টক কাটা, SALE movement, Delivered', () => {
    const data = makeData({ products: [makeProduct({ price: 1000, stockCount: 10 })] });
    const order = applyPosSaleInData(data, [{ productId: 'p1', quantity: 2 }]);
    expect(order).not.toBeNull();
    expect(order!.total).toBe(2000);
    expect(order!.subtotal).toBe(2000);
    expect(order!.paidAmount).toBe(2000);
    expect(order!.dueAmount).toBe(0);
    expect(order!.status).toBe('Delivered');
    expect(order!.source).toBe('in-store');
    expect(data.products[0].stockCount).toBe(8);
    expect(data.inventoryMovements[0]).toMatchObject({
      type: 'SALE', quantity: -2, previousStock: 10, newStock: 8, productId: 'p1',
    });
    expect(data.orders[0].id).toBe(order!.id);
  });

  it('ভ্যারিয়েন্ট-লেভেল প্রাইসিং: ভ্যারিয়েন্টের দাম থাকলে সেটাই, ভ্যারিয়েন্ট-স্টক কাটে', () => {
    const data = makeData({
      products: [
        makeProduct({
          price: 1000,
          stockCount: 10,
          variants: [{ id: 'v1', sku: 'JX-SH-001-42-BLK', size: '42', color: 'Black', stock: 5, price: 1200, costPrice: 700 }],
        }),
      ],
    });
    const order = applyPosSaleInData(data, [{ productId: 'p1', variantId: 'v1', quantity: 1 }]);
    expect(order!.items[0].price).toBe(1200);
    expect(order!.items[0].costPrice).toBe(700);
    expect(order!.total).toBe(1200);
    expect(data.products[0].variants![0].stock).toBe(4);
    expect(data.products[0].stockCount).toBe(9);
  });

  it('ভ্যারিয়েন্ট-রেজলভ ফলব্যাক চেইন: সাইজ না মিললে stock>0 ভ্যারিয়েন্ট ধরে; কলার-সাইজ ফিল্ডেই থাকে', () => {
    const data = makeData({
      products: [
        makeProduct({
          variants: [
            { id: 'v1', sku: 'V1', size: '40', color: 'Black', stock: 0 },
            { id: 'v2', sku: 'V2', size: '41', color: 'Black', stock: 3 },
          ],
        }),
      ],
    });
    const order = applyPosSaleInData(data, [{ productId: 'p1', quantity: 1, size: '99' }]);
    // আচরণ লক: স্টক stock>0 ভ্যারিয়েন্ট (v2) থেকে কাটে, কিন্তু selectedSize কলারের '99'-ই থাকে —
    // ভুল সাইজ-ইনপুটে হিসাব/লেবেল ভিন্ন জায়গায় যেতে পারে (p2-test-plan §৩.২)
    expect(order!.items[0].selectedSize).toBe('99');
    expect(order!.items[0].selectedColor).toBe('Black');
  });

  it('বাকিতে সেল: paidAmount আধা-টাকা → due বাকি; ফোন দিলে খাতায় due যোগ', () => {
    const data = makeData({ products: [makeProduct({ price: 1000, stockCount: 10 })] });
    const order = applyPosSaleInData(data, [{ productId: 'p1', quantity: 2 }], {
      customerName: 'করিম', customerPhone: '01711111111', paidAmount: 1000,
    });
    expect(order!.total).toBe(2000);
    expect(order!.paidAmount).toBe(1000);
    expect(order!.dueAmount).toBe(1000);
    const cust = data.customers.find(c => c.phone === '01711111111')!;
    expect(cust.dueAmount).toBe(1000);
    expect(cust.totalPurchases).toBe(2000);
    expect(data.orders[0].customerId).toBe(cust.id);
  });

  it('ফোন না দিলেও বাকি থাকলে pos- প্রিফিক্সে কাস্টমার খোলে', () => {
    const data = makeData({ products: [makeProduct({ price: 1000, stockCount: 10 })] });
    const order = applyPosSaleInData(data, [{ productId: 'p1', quantity: 1 }], { paidAmount: 0 });
    expect(order!.dueAmount).toBe(1000);
    expect(data.customers[0].phone).toMatch(/^pos-/);
  });

  it('অজানা পণ্য স্কিপ; সব স্কিপ হলে null; খালি তালিকা → null', () => {
    const data = makeData({ products: [makeProduct()] });
    expect(applyPosSaleInData(data, [{ productId: 'ghost', quantity: 1 }])).toBeNull();
    expect(applyPosSaleInData(data, [])).toBeNull();
  });

  // CHARACTERIZATION: স্টক < qty হলে বিক্রি আটকায় না, Math.max(0,...) ক্ল্যাম্প — TODO (P4-এর নেগেটিভ-স্টক নীতির সাথে মিলবে)
  it('ওভারসেল: স্টক ৩-এ ৫টা বিক্রি → স্টক ০, বিক্রি থামে না (বর্তমান আচরণ)', () => {
    const data = makeData({ products: [makeProduct({ stockCount: 3 })] });
    const order = applyPosSaleInData(data, [{ productId: 'p1', quantity: 5 }]);
    expect(order!.items[0].quantity).toBe(5);
    expect(data.products[0].stockCount).toBe(0);
  });
});

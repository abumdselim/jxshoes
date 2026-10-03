import { describe, it, expect } from 'vitest';
import {
  computeFinanceSummaryFromData,
  computeInventorySummary,
  deductStockForOrder,
} from './compute';
import { makeData, makeProduct, makeOrder } from '../test/helpers';

describe('computeFinanceSummaryFromData — COGS ফলব্যাক চেইন', () => {
  it('costPrice স্ন্যাপশট থাকলে সেটাই ব্যবহৃত হয়', () => {
    const data = makeData({
      orders: [
        makeOrder({
          total: 1000,
          items: [{ productId: 'p1', name: 'x', price: 1000, costPrice: 700, quantity: 1, selectedSize: '42', selectedColor: 'Black', image: '' }],
        }),
      ],
    });
    expect(computeFinanceSummaryFromData(data).cogs).toBe(700);
    expect(computeFinanceSummaryFromData(data).revenue).toBe(1000);
  });

  it('স্ন্যাপশট না থাকলে স্টোর্ড প্রোডাক্টের costPrice ব্যবহৃত হয়', () => {
    const data = makeData({
      products: [makeProduct({ id: 'p1', costPrice: 600 })],
      orders: [
        makeOrder({
          total: 1000,
          items: [{ productId: 'p1', name: 'x', price: 1000, quantity: 1, selectedSize: '42', selectedColor: 'Black', image: '' }],
        }),
      ],
    });
    expect(computeFinanceSummaryFromData(data).cogs).toBe(600);
  });

  it('কিছুই না পেলে দামের ৬৫% (রাউন্ডেড) অনুমান — 999×0.65 = 649', () => {
    const data = makeData({
      orders: [
        makeOrder({
          total: 999,
          items: [{ productId: 'ghost', name: 'x', price: 999, quantity: 1, selectedSize: '42', selectedColor: 'Black', image: '' }],
        }),
      ],
    });
    expect(computeFinanceSummaryFromData(data).cogs).toBe(Math.round(999 * 0.65));
  });

  it('Cancelled অর্ডার revenue/cogs/orderCount-এ যায় না', () => {
    const data = makeData({
      orders: [
        makeOrder({ total: 1000, status: 'Cancelled' }),
        makeOrder({ id: 'ord-2', orderNumber: 'SK-1001', total: 500 }),
      ],
    });
    const s = computeFinanceSummaryFromData(data);
    expect(s.revenue).toBe(500);
    expect(s.orderCount).toBe(1);
  });

  it('totalDues = সব কাস্টমারের dueAmount যোগফল; আদায় totalCollected-এ', () => {
    const data = makeData({
      customers: [
        { id: 'c1', name: 'a', phone: '01700000001', dueAmount: 400, totalPurchases: 0, orderCount: 0, createdAt: '' },
        { id: 'c2', name: 'b', phone: '01700000002', dueAmount: 100, totalPurchases: 0, orderCount: 0, createdAt: '' },
      ],
      duePayments: [
        { id: 'pay1', customerId: 'c1', customerName: 'a', customerPhone: '01700000001', amount: 250, method: 'Cash', createdAt: new Date().toISOString() },
      ],
    });
    const s = computeFinanceSummaryFromData(data);
    expect(s.totalDues).toBe(500);
    expect(s.totalCollected).toBe(250);
  });
});

describe('computeInventorySummary', () => {
  it('স্টক ভ্যালু, low/out-of-stock সঠিকভাবে গোনে', () => {
    const products = [
      makeProduct({ id: 'p1', price: 1000, costPrice: 600, stockCount: 5 }), // low (≤5 ডিফল্ট)
      makeProduct({ id: 'p2', sku: 'JX-SH-002', price: 2000, costPrice: 1200, stockCount: 0, minStockAlert: 3 }), // out
      makeProduct({ id: 'p3', sku: 'JX-SH-003', price: 500, costPrice: 300, stockCount: 50, minStockAlert: 2 }),
    ];
    const { summary, lowStockProducts, outOfStockProducts } = computeInventorySummary(products);
    expect(summary.totalSkus).toBe(3);
    expect(summary.totalUnits).toBe(55);
    expect(summary.totalCostValue).toBe(600 * 5 + 300 * 50);
    expect(summary.totalRetailValue).toBe(1000 * 5 + 500 * 50);
    expect(summary.lowStockCount).toBe(1);
    expect(summary.outOfStockCount).toBe(1);
    expect(lowStockProducts[0].id).toBe('p1');
    expect(outOfStockProducts[0].id).toBe('p2');
    expect(summary.potentialProfit).toBe(summary.totalRetailValue - summary.totalCostValue);
  });
});

describe('deductStockForOrder (অফলাইন মিরর পাথ)', () => {
  it('ভ্যারিয়েন্ট থাকলে ভ্যারিয়েন্ট কাটে এবং stockCount = ভ্যারিয়েন্ট-যোগফল থেকে re-calc হয়', () => {
    const product = makeProduct({
      stockCount: 10,
      variants: [
        { id: 'v1', sku: 'JX-SH-001-42-BLK', size: '42', color: 'Black', stock: 6 },
        { id: 'v2', sku: 'JX-SH-001-41-BLK', size: '41', color: 'Black', stock: 4 },
      ],
    });
    const data = makeData({ products: [product] });
    const movements = deductStockForOrder(
      data,
      [{ productId: 'p1', quantity: 2, selectedSize: '42', selectedColor: 'Black' }],
      'SK-1000',
      '2026-10-03T05:00:00.000Z'
    );
    expect(movements).toHaveLength(1);
    expect(movements[0].type).toBe('SALE');
    expect(movements[0].quantity).toBe(-2);
    expect(movements[0].previousStock).toBe(6);
    expect(movements[0].newStock).toBe(4);
    // মিররে stockCount ভ্যারিয়েন্ট-যোগফল থেকে আসে (4+4=8) — সার্ভার পাথ decrement-এর সাথে drift-প্রবণ, চেকলিস্ট-নোট
    expect(data.products[0].stockCount).toBe(8);
    expect(data.inventoryMovements[0].note).toContain('SK-1000');
  });

  it('ভ্যারিয়েন্ট না মিললে মূল stockCount কাটে; অজানা পণ্য স্কিপ হয়', () => {
    const data = makeData({ products: [makeProduct({ id: 'p1', stockCount: 3 })] });
    const movements = deductStockForOrder(
      data,
      [
        { productId: 'p1', quantity: 5 }, // oversell → 0-এ ক্ল্যাম্প (আচরণ লক)
        { productId: 'ghost', quantity: 1 },
      ],
      'SK-1000',
      '2026-10-03T05:00:00.000Z'
    );
    expect(movements).toHaveLength(1);
    expect(data.products[0].stockCount).toBe(0);
  });
});

/** টেস্ট হেল্পার — ন্যূনতম বৈধ FullStoreData/Product/Order বিল্ডার */
import type { Product, Order, Customer } from '@/types';
import type { FullStoreData } from '@/types/fullStoreData';

export function makeProduct(over: Partial<Product> = {}): Product {
  return {
    id: 'p1',
    sku: 'JX-SH-001',
    name: 'টেস্ট জুতা',
    slug: 'test-shoe',
    description: '',
    price: 1000,
    category: 'shoes',
    sizes: ['40', '41', '42'],
    colors: [{ name: 'Black', hex: '#000000' }],
    images: ['img.jpg'],
    inStock: true,
    stockCount: 10,
    createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  };
}

export function makeOrder(over: Partial<Order> = {}): Order {
  return {
    id: 'ord-1',
    orderNumber: 'SK-1000',
    customerName: 'টেস্ট কাস্টমার',
    phone: '01700000000',
    address: 'ঢাকা',
    city: 'Inside Dhaka',
    paymentMethod: 'Cash on Delivery',
    items: [],
    subtotal: 0,
    deliveryFee: 0,
    total: 0,
    status: 'Delivered',
    createdAt: '2026-10-03T05:00:00.000Z',
    ...over,
  };
}

export function makeCustomer(over: Partial<Customer> = {}): Customer {
  return {
    id: 'c1',
    name: 'টেস্ট কাস্টমার',
    phone: '01700000000',
    dueAmount: 0,
    totalPurchases: 0,
    orderCount: 0,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...over,
  };
}

export function makeData(over: Partial<FullStoreData> = {}): FullStoreData {
  return {
    products: [],
    orders: [],
    categories: [],
    storeSettings: {} as FullStoreData['storeSettings'],
    heroBanner: {} as FullStoreData['heroBanner'],
    flashDeal: {} as FullStoreData['flashDeal'],
    coupons: [],
    inventoryMovements: [],
    customers: [],
    expenses: [],
    duePayments: [],
    ...over,
  };
}

/**
 * পুরো দোকানের ডেটা শেপ — সার্ভারে একটাই KV কি (jx_store_state), অফলাইনে
 * ক্লায়েন্টের IndexedDB মিররেও হুবহু এই শেপ। store.ts ও offline লেয়ার দুটোই ব্যবহার করে।
 */
import type {
  Product,
  Order,
  CategoryItem,
  StoreSettings,
  HeroBannerSettings,
  FlashDealSettings,
  Coupon,
  InventoryMovement,
  Customer,
  Expense,
  DuePayment,
} from './index';

export interface FullStoreData {
  products: Product[];
  orders: Order[];
  categories: CategoryItem[];
  storeSettings: StoreSettings;
  heroBanner: HeroBannerSettings;
  flashDeal: FlashDealSettings;
  coupons: Coupon[];
  inventoryMovements: InventoryMovement[];
  customers: Customer[];
  expenses: Expense[];
  duePayments: DuePayment[];
}

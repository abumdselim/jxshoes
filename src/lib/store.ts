import fs from 'fs';
import path from 'path';
import {
  Product,
  Order,
  CategoryItem,
  StoreSettings,
  HeroBannerSettings,
  FlashDealSettings,
  Coupon
} from '@/types';
import {
  initialProducts,
  initialOrders,
  initialCategories,
  initialStoreSettings,
  initialHeroBanner,
  initialFlashDeal,
  initialCoupons
} from './initialData';

const DATA_DIR = path.join(process.cwd(), 'data');
const DATA_FILE = path.join(DATA_DIR, 'store.json');

export interface FullStoreData {
  products: Product[];
  orders: Order[];
  categories: CategoryItem[];
  storeSettings: StoreSettings;
  heroBanner: HeroBannerSettings;
  flashDeal: FlashDealSettings;
  coupons: Coupon[];
}

function ensureDataFile(): FullStoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DATA_FILE)) {
      const defaultData: FullStoreData = {
        products: initialProducts,
        orders: initialOrders,
        categories: initialCategories,
        storeSettings: initialStoreSettings,
        heroBanner: initialHeroBanner,
        flashDeal: initialFlashDeal,
        coupons: initialCoupons,
      };
      fs.writeFileSync(DATA_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);

    // Merge defaults if fields are missing
    return {
      products: parsed.products || initialProducts,
      orders: parsed.orders || initialOrders,
      categories: parsed.categories || initialCategories,
      storeSettings: parsed.storeSettings || initialStoreSettings,
      heroBanner: parsed.heroBanner || initialHeroBanner,
      flashDeal: parsed.flashDeal || initialFlashDeal,
      coupons: parsed.coupons || initialCoupons,
    };
  } catch (error) {
    console.error('Error reading store data:', error);
    return {
      products: initialProducts,
      orders: initialOrders,
      categories: initialCategories,
      storeSettings: initialStoreSettings,
      heroBanner: initialHeroBanner,
      flashDeal: initialFlashDeal,
      coupons: initialCoupons,
    };
  }
}

function saveData(data: FullStoreData) {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving store data:', error);
  }
}

// ================== PRODUCTS ==================
export function getProducts(): Product[] {
  const data = ensureDataFile();
  return data.products;
}

export function getProductById(id: string): Product | undefined {
  const products = getProducts();
  return products.find(p => p.id === id);
}

export function saveProduct(product: Partial<Product> & { name: string; price: number }): Product {
  const data = ensureDataFile();
  const isNew = !product.id;
  const newId = isNew ? `prod-${Date.now()}` : product.id!;

  const fullProduct: Product = {
    id: newId,
    name: product.name,
    slug: product.slug || product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: product.description || '',
    price: Number(product.price),
    originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
    category: product.category || 'shoes',
    subCategory: product.subCategory || 'General',
    sizes: product.sizes && product.sizes.length > 0 ? product.sizes : ['Standard'],
    colors: product.colors && product.colors.length > 0 ? product.colors : [{ name: 'Black', hex: '#000000' }],
    images: product.images && product.images.length > 0 ? product.images : [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800'
    ],
    inStock: product.inStock !== undefined ? product.inStock : true,
    stockCount: product.stockCount !== undefined ? Number(product.stockCount) : 10,
    isFeatured: Boolean(product.isFeatured),
    rating: product.rating || 5.0,
    createdAt: product.createdAt || new Date().toISOString(),
  };

  const existingIndex = data.products.findIndex(p => p.id === newId);
  if (existingIndex >= 0) {
    data.products[existingIndex] = { ...data.products[existingIndex], ...fullProduct };
  } else {
    data.products.unshift(fullProduct);
  }

  saveData(data);
  return fullProduct;
}

export function deleteProduct(id: string): boolean {
  const data = ensureDataFile();
  const initialLength = data.products.length;
  data.products = data.products.filter(p => p.id !== id);
  if (data.products.length !== initialLength) {
    saveData(data);
    return true;
  }
  return false;
}

// ================== ORDERS ==================
export function getOrders(): Order[] {
  const data = ensureDataFile();
  return data.orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function getOrderById(id: string): Order | undefined {
  const orders = getOrders();
  return orders.find(o => o.id === id);
}

export function createOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'status'>): Order {
  const data = ensureDataFile();
  const id = `ord-${Date.now()}`;
  const orderNumber = `JX-${Math.floor(1000 + Math.random() * 9000)}`;

  const newOrder: Order = {
    ...orderData,
    id,
    orderNumber,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };

  data.orders.unshift(newOrder);
  saveData(data);
  return newOrder;
}

export function updateOrderStatus(id: string, status: Order['status'], adminNote?: string): Order | null {
  const data = ensureDataFile();
  const order = data.orders.find(o => o.id === id);
  if (order) {
    order.status = status;
    if (adminNote !== undefined) {
      order.adminNote = adminNote;
    }
    saveData(data);
    return order;
  }
  return null;
}

// ================== CATEGORIES ==================
export function getCategories(): CategoryItem[] {
  const data = ensureDataFile();
  return data.categories;
}

export function saveCategory(category: Partial<CategoryItem> & { name: string; parentType: CategoryItem['parentType'] }): CategoryItem {
  const data = ensureDataFile();
  const id = category.id || `cat-${Date.now()}`;
  const newCat: CategoryItem = {
    id,
    name: category.name,
    slug: category.slug || category.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    parentType: category.parentType,
    image: category.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400',
    itemCountLabel: category.itemCountLabel || 'কালেকশন'
  };

  const existingIndex = data.categories.findIndex(c => c.id === id);
  if (existingIndex >= 0) {
    data.categories[existingIndex] = newCat;
  } else {
    data.categories.push(newCat);
  }

  saveData(data);
  return newCat;
}

export function deleteCategory(id: string): boolean {
  const data = ensureDataFile();
  const initialLen = data.categories.length;
  data.categories = data.categories.filter(c => c.id !== id);
  if (data.categories.length !== initialLen) {
    saveData(data);
    return true;
  }
  return false;
}

// ================== STORE SETTINGS ==================
export function getStoreSettings(): StoreSettings {
  const data = ensureDataFile();
  return data.storeSettings;
}

export function saveStoreSettings(settings: Partial<StoreSettings>): StoreSettings {
  const data = ensureDataFile();
  data.storeSettings = { ...data.storeSettings, ...settings };
  saveData(data);
  return data.storeSettings;
}

// ================== HERO BANNER & FLASH DEAL ==================
export function getHeroBanner(): HeroBannerSettings {
  const data = ensureDataFile();
  return data.heroBanner;
}

export function saveHeroBanner(banner: Partial<HeroBannerSettings>): HeroBannerSettings {
  const data = ensureDataFile();
  data.heroBanner = { ...data.heroBanner, ...banner };
  saveData(data);
  return data.heroBanner;
}

export function getFlashDeal(): FlashDealSettings {
  const data = ensureDataFile();
  return data.flashDeal;
}

export function saveFlashDeal(deal: Partial<FlashDealSettings>): FlashDealSettings {
  const data = ensureDataFile();
  data.flashDeal = { ...data.flashDeal, ...deal };
  saveData(data);
  return data.flashDeal;
}

// ================== COUPONS ==================
export function getCoupons(): Coupon[] {
  const data = ensureDataFile();
  return data.coupons;
}

export function saveCoupon(coupon: Partial<Coupon> & { code: string; value: number }): Coupon {
  const data = ensureDataFile();
  const id = coupon.id || `coup-${Date.now()}`;
  const newCoup: Coupon = {
    id,
    code: coupon.code.toUpperCase().trim(),
    discountType: coupon.discountType || 'fixed',
    value: Number(coupon.value),
    minOrder: Number(coupon.minOrder) || 0,
    active: coupon.active !== undefined ? coupon.active : true
  };

  const existingIndex = data.coupons.findIndex(c => c.id === id);
  if (existingIndex >= 0) {
    data.coupons[existingIndex] = newCoup;
  } else {
    data.coupons.unshift(newCoup);
  }

  saveData(data);
  return newCoup;
}

export function deleteCoupon(id: string): boolean {
  const data = ensureDataFile();
  const initialLen = data.coupons.length;
  data.coupons = data.coupons.filter(c => c.id !== id);
  if (data.coupons.length !== initialLen) {
    saveData(data);
    return true;
  }
  return false;
}

export function validateCoupon(code: string, orderTotal: number): { valid: boolean; discount: number; message: string } {
  const coupons = getCoupons();
  const match = coupons.find(c => c.code === code.toUpperCase().trim() && c.active);
  if (!match) {
    return { valid: false, discount: 0, message: 'কুপন কোডটি সঠিক নয় বা মেয়াদ উত্তীর্ণ।' };
  }
  if (orderTotal < match.minOrder) {
    return { valid: false, discount: 0, message: `এই কুপন ব্যবহারের জন্য ন্যূনতম ৳${match.minOrder} টাকার অর্ডার প্রয়োজন।` };
  }
  let discount = 0;
  if (match.discountType === 'percentage') {
    discount = Math.round((orderTotal * match.value) / 100);
  } else {
    discount = match.value;
  }
  return { valid: true, discount, message: `অভিনন্দন! ৳${discount} টাকা ছাড় প্রযোজ্য হয়েছে।` };
}

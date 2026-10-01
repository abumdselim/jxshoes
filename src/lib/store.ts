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

export interface FullStoreData {
  products: Product[];
  orders: Order[];
  categories: CategoryItem[];
  storeSettings: StoreSettings;
  heroBanner: HeroBannerSettings;
  flashDeal: FlashDealSettings;
  coupons: Coupon[];
}

const CF_KV_NAMESPACE_ID = process.env.CLOUDFLARE_KV_ID || '';
const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const KV_KEY = 'jx_store_state';

// In-memory cache
let cachedData: FullStoreData = {
  products: initialProducts,
  orders: initialOrders,
  categories: initialCategories,
  storeSettings: initialStoreSettings,
  heroBanner: initialHeroBanner,
  flashDeal: initialFlashDeal,
  coupons: initialCoupons,
};

let hasFetchedKV = false;

export async function getStoreData(): Promise<FullStoreData> {
  // If we have Cloudflare KV credentials, sync with Cloudflare KV
  if (CF_API_TOKEN && CF_ACCOUNT_ID && CF_KV_NAMESPACE_ID) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values/${KV_KEY}`;
      const res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const parsed = await res.json();
        cachedData = {
          products: parsed.products || initialProducts,
          orders: parsed.orders || initialOrders,
          categories: parsed.categories || initialCategories,
          storeSettings: parsed.storeSettings || initialStoreSettings,
          heroBanner: parsed.heroBanner || initialHeroBanner,
          flashDeal: parsed.flashDeal || initialFlashDeal,
          coupons: parsed.coupons || initialCoupons,
        };
        hasFetchedKV = true;
        return cachedData;
      }
    } catch (err) {
      console.warn('Cloudflare KV fetch warning:', err);
    }
  }

  return cachedData;
}

export async function saveStoreData(data: FullStoreData): Promise<void> {
  cachedData = data;

  // Persist to Cloudflare KV
  if (CF_API_TOKEN && CF_ACCOUNT_ID && CF_KV_NAMESPACE_ID) {
    try {
      const url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/storage/kv/namespaces/${CF_KV_NAMESPACE_ID}/values/${KV_KEY}`;
      await fetch(url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${CF_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });
    } catch (err) {
      console.warn('Cloudflare KV save warning:', err);
    }
  }
}

// ================== PRODUCTS ==================
export async function getProducts(): Promise<Product[]> {
  const data = await getStoreData();
  return data.products;
}

export async function getProductById(id: string): Promise<Product | undefined> {
  const products = await getProducts();
  return products.find(p => p.id === id);
}

export async function saveProduct(product: Partial<Product> & { name: string; price: number }): Promise<Product> {
  const data = await getStoreData();
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

  await saveStoreData(data);
  return fullProduct;
}

export async function deleteProduct(id: string): Promise<boolean> {
  const data = await getStoreData();
  const initialLength = data.products.length;
  data.products = data.products.filter(p => p.id !== id);
  if (data.products.length !== initialLength) {
    await saveStoreData(data);
    return true;
  }
  return false;
}

// ================== ORDERS ==================
export async function getOrders(): Promise<Order[]> {
  const data = await getStoreData();
  return data.orders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export async function getOrderById(id: string): Promise<Order | undefined> {
  const orders = await getOrders();
  return orders.find(o => o.id === id);
}

export async function createOrder(orderData: Omit<Order, 'id' | 'orderNumber' | 'createdAt' | 'status'>): Promise<Order> {
  const data = await getStoreData();
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
  await saveStoreData(data);
  return newOrder;
}

export async function updateOrderStatus(id: string, status: Order['status'], adminNote?: string): Promise<Order | null> {
  const data = await getStoreData();
  const order = data.orders.find(o => o.id === id);
  if (order) {
    order.status = status;
    if (adminNote !== undefined) {
      order.adminNote = adminNote;
    }
    await saveStoreData(data);
    return order;
  }
  return null;
}

// ================== CATEGORIES ==================
export async function getCategories(): Promise<CategoryItem[]> {
  const data = await getStoreData();
  return data.categories;
}

export async function saveCategory(category: Partial<CategoryItem> & { name: string; parentType: CategoryItem['parentType'] }): Promise<CategoryItem> {
  const data = await getStoreData();
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

  await saveStoreData(data);
  return newCat;
}

export async function deleteCategory(id: string): Promise<boolean> {
  const data = await getStoreData();
  const initialLen = data.categories.length;
  data.categories = data.categories.filter(c => c.id !== id);
  if (data.categories.length !== initialLen) {
    await saveStoreData(data);
    return true;
  }
  return false;
}

// ================== STORE SETTINGS ==================
export async function getStoreSettings(): Promise<StoreSettings> {
  const data = await getStoreData();
  return data.storeSettings;
}

export async function saveStoreSettings(settings: Partial<StoreSettings>): Promise<StoreSettings> {
  const data = await getStoreData();
  data.storeSettings = { ...data.storeSettings, ...settings };
  await saveStoreData(data);
  return data.storeSettings;
}

// ================== HERO BANNER & FLASH DEAL ==================
export async function getHeroBanner(): Promise<HeroBannerSettings> {
  const data = await getStoreData();
  return data.heroBanner;
}

export async function saveHeroBanner(banner: Partial<HeroBannerSettings>): Promise<HeroBannerSettings> {
  const data = await getStoreData();
  data.heroBanner = { ...data.heroBanner, ...banner };
  await saveStoreData(data);
  return data.heroBanner;
}

export async function getFlashDeal(): Promise<FlashDealSettings> {
  const data = await getStoreData();
  return data.flashDeal;
}

export async function saveFlashDeal(deal: Partial<FlashDealSettings>): Promise<FlashDealSettings> {
  const data = await getStoreData();
  data.flashDeal = { ...data.flashDeal, ...deal };
  await saveStoreData(data);
  return data.flashDeal;
}

// ================== COUPONS ==================
export async function getCoupons(): Promise<Coupon[]> {
  const data = await getStoreData();
  return data.coupons;
}

export async function saveCoupon(coupon: Partial<Coupon> & { code: string; value: number }): Promise<Coupon> {
  const data = await getStoreData();
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

  await saveStoreData(data);
  return newCoup;
}

export async function deleteCoupon(id: string): Promise<boolean> {
  const data = await getStoreData();
  const initialLen = data.coupons.length;
  data.coupons = data.coupons.filter(c => c.id !== id);
  if (data.coupons.length !== initialLen) {
    await saveStoreData(data);
    return true;
  }
  return false;
}

export async function validateCoupon(code: string, orderTotal: number): Promise<{ valid: boolean; discount: number; message: string }> {
  const coupons = await getCoupons();
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

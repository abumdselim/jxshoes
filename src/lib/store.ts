import {
  Product,
  Order,
  CategoryItem,
  StoreSettings,
  HeroBannerSettings,
  FlashDealSettings,
  Coupon,
  InventoryMovement,
  ProductVariant
} from '@/types';
import {
  initialProducts,
  initialOrders,
  initialCategories,
  initialStoreSettings,
  initialHeroBanner,
  initialFlashDeal,
  initialCoupons,
  initialInventoryMovements
} from './initialData';

export interface FullStoreData {
  products: Product[];
  orders: Order[];
  categories: CategoryItem[];
  storeSettings: StoreSettings;
  heroBanner: HeroBannerSettings;
  flashDeal: FlashDealSettings;
  coupons: Coupon[];
  inventoryMovements: InventoryMovement[];
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
  inventoryMovements: initialInventoryMovements,
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
          inventoryMovements: parsed.inventoryMovements || initialInventoryMovements,
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

  const existingIndex = data.products.findIndex(p => p.id === newId);
  const existingProd = existingIndex >= 0 ? data.products[existingIndex] : null;

  const defaultCategory = product.category || existingProd?.category || 'shoes';
  const prefix = defaultCategory === 'bags' ? 'BG' : 'SH';
  const randomCode = Math.floor(100 + Math.random() * 900);
  const autoSku = `JX-${prefix}-${randomCode}`;
  const autoBarcode = `890100${Date.now().toString().slice(-6)}`;

  const calculatedStock = product.variants && product.variants.length > 0
    ? product.variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
    : (product.stockCount !== undefined ? Number(product.stockCount) : (existingProd?.stockCount ?? 10));

  const fullProduct: Product = {
    id: newId,
    sku: product.sku?.trim() || existingProd?.sku || autoSku,
    barcode: product.barcode?.trim() || existingProd?.barcode || autoBarcode,
    name: product.name,
    slug: product.slug || product.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: product.description || '',
    price: Number(product.price),
    costPrice: product.costPrice !== undefined ? Number(product.costPrice) : (existingProd?.costPrice ?? Math.round(Number(product.price) * 0.65)),
    originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
    category: defaultCategory,
    subCategory: product.subCategory || existingProd?.subCategory || 'General',
    sizes: product.sizes && product.sizes.length > 0 ? product.sizes : (existingProd?.sizes ?? ['Standard']),
    colors: product.colors && product.colors.length > 0 ? product.colors : (existingProd?.colors ?? [{ name: 'Black', hex: '#000000' }]),
    images: product.images && product.images.length > 0 ? product.images : (existingProd?.images ?? [
      'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800'
    ]),
    inStock: calculatedStock > 0 && (product.inStock !== undefined ? product.inStock : true),
    stockCount: calculatedStock,
    minStockAlert: product.minStockAlert !== undefined ? Number(product.minStockAlert) : (existingProd?.minStockAlert ?? 5),
    supplier: product.supplier?.trim() || existingProd?.supplier || 'প্রধান সরবরাহকারী',
    variants: product.variants || existingProd?.variants || [],
    isFeatured: Boolean(product.isFeatured),
    rating: product.rating || existingProd?.rating || 5.0,
    createdAt: product.createdAt || existingProd?.createdAt || new Date().toISOString(),
  };

  // If new product was created, log initial stock in inventory movements
  if (isNew) {
    if (!data.inventoryMovements) data.inventoryMovements = [];
    data.inventoryMovements.unshift({
      id: `mov-${Date.now()}`,
      productId: fullProduct.id,
      productName: fullProduct.name,
      sku: fullProduct.sku,
      type: 'RESTOCK',
      quantity: fullProduct.stockCount,
      previousStock: 0,
      newStock: fullProduct.stockCount,
      unitCost: fullProduct.costPrice,
      supplierOrInvoice: fullProduct.supplier,
      note: 'নতুন প্রোডাক্ট হিসেবে প্রাথমিক স্টক এন্ট্রি',
      createdAt: new Date().toISOString()
    });
  }

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

// ================== INVENTORY MANAGEMENT ==================
export async function getInventoryMovements(): Promise<InventoryMovement[]> {
  const data = await getStoreData();
  return (data.inventoryMovements || []).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function recordInventoryMovement(
  movement: Omit<InventoryMovement, 'id' | 'createdAt'>
): Promise<InventoryMovement> {
  const data = await getStoreData();
  if (!data.inventoryMovements) data.inventoryMovements = [];

  const newMovement: InventoryMovement = {
    ...movement,
    id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    createdAt: new Date().toISOString(),
  };

  data.inventoryMovements.unshift(newMovement);
  await saveStoreData(data);
  return newMovement;
}

export async function restockProduct(
  productId: string,
  quantity: number,
  unitCost?: number,
  supplierOrInvoice?: string,
  note?: string,
  variantId?: string
): Promise<Product | null> {
  const data = await getStoreData();
  const prod = data.products.find(p => p.id === productId);
  if (!prod) return null;

  const prevStock = prod.stockCount;
  const addedQty = Math.max(1, Number(quantity));
  prod.stockCount = prevStock + addedQty;
  prod.inStock = true;

  if (unitCost !== undefined && Number(unitCost) > 0) {
    prod.costPrice = Number(unitCost);
  }

  let variantInfo = '';
  if (variantId && prod.variants) {
    const v = prod.variants.find(item => item.id === variantId);
    if (v) {
      v.stock = (v.stock || 0) + addedQty;
      variantInfo = `সাইজ: ${v.size}, কালার: ${v.color}`;
    }
  }

  if (!data.inventoryMovements) data.inventoryMovements = [];
  data.inventoryMovements.unshift({
    id: `mov-${Date.now()}`,
    productId: prod.id,
    productName: prod.name,
    sku: prod.sku,
    variantInfo: variantInfo || undefined,
    type: 'RESTOCK',
    quantity: addedQty,
    previousStock: prevStock,
    newStock: prod.stockCount,
    unitCost: prod.costPrice,
    supplierOrInvoice: supplierOrInvoice || prod.supplier || 'চালান / ইনভেন্টরি পারচেস',
    note: note || 'নতুন চালান বা স্টক ইন এন্ট্রি',
    createdAt: new Date().toISOString()
  });

  await saveStoreData(data);
  return prod;
}

export async function adjustProductStock(
  productId: string,
  newStock: number,
  reason: 'DAMAGE' | 'RETURN' | 'ADJUSTMENT',
  note?: string,
  variantId?: string
): Promise<Product | null> {
  const data = await getStoreData();
  const prod = data.products.find(p => p.id === productId);
  if (!prod) return null;

  const prevStock = prod.stockCount;
  const targetStock = Math.max(0, Number(newStock));
  const delta = targetStock - prevStock;
  prod.stockCount = targetStock;
  prod.inStock = targetStock > 0;

  let variantInfo = '';
  if (variantId && prod.variants) {
    const v = prod.variants.find(item => item.id === variantId);
    if (v) {
      v.stock = Math.max(0, (v.stock || 0) + delta);
      variantInfo = `সাইজ: ${v.size}, কালার: ${v.color}`;
    }
  }

  if (!data.inventoryMovements) data.inventoryMovements = [];
  data.inventoryMovements.unshift({
    id: `mov-${Date.now()}`,
    productId: prod.id,
    productName: prod.name,
    sku: prod.sku,
    variantInfo: variantInfo || undefined,
    type: reason,
    quantity: delta,
    previousStock: prevStock,
    newStock: targetStock,
    unitCost: prod.costPrice,
    supplierOrInvoice: 'শপ ইনভেন্টরি অ্যাডজাস্টমেন্ট',
    note: note || (reason === 'DAMAGE' ? 'ড্যামেজ বা নষ্ট পণ্য বাদ' : reason === 'RETURN' ? 'কাস্টমার রিটার্ন ইন' : 'ফিজিক্যাল স্টক অডিট অ্যাডজাস্টমেন্ট'),
    createdAt: new Date().toISOString()
  });

  await saveStoreData(data);
  return prod;
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

  // Deduct stock for each ordered item and record inventory movements
  if (!data.inventoryMovements) data.inventoryMovements = [];
  for (const item of orderData.items) {
    const prod = data.products.find(p => p.id === item.productId);
    if (prod) {
      const prevStock = prod.stockCount;
      prod.stockCount = Math.max(0, prod.stockCount - item.quantity);
      prod.inStock = prod.stockCount > 0;

      // Also deduct from variant if present
      if (prod.variants && prod.variants.length > 0) {
        const v = prod.variants.find(
          variant => variant.size === item.selectedSize && variant.color === item.selectedColor
        );
        if (v) {
          v.stock = Math.max(0, v.stock - item.quantity);
        }
      }

      data.inventoryMovements.unshift({
        id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        variantInfo: `সাইজ: ${item.selectedSize}, কালার: ${item.selectedColor}`,
        type: 'SALE',
        quantity: -item.quantity,
        previousStock: prevStock,
        newStock: prod.stockCount,
        unitCost: prod.costPrice,
        supplierOrInvoice: `অনলাইন অর্ডার #${orderNumber}`,
        note: `গ্রাহক: ${orderData.customerName} (${orderData.phone})`,
        createdAt: new Date().toISOString()
      });
    }
  }

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

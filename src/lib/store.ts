import {
  Product,
  Order,
  OrderItem,
  CategoryItem,
  StoreSettings,
  HeroBannerSettings,
  FlashDealSettings,
  Coupon,
  InventoryMovement,
  ProductVariant,
  AIDailyBrief,
  Customer,
  Expense,
  DuePayment,
  FinanceSummary,
  StoredReport
} from '@/types';
import {
  initialProducts,
  initialOrders,
  initialCategories,
  initialStoreSettings,
  initialHeroBanner,
  initialFlashDeal,
  initialCoupons,
  initialInventoryMovements,
  initialCustomers,
  initialExpenses,
  initialDuePayments
} from './initialData';
import { getCfEnv } from './cfEnv';

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

const KV_KEY = 'jx_store_state';

/** রিকোয়েস্ট টাইমে env থেকে Cloudflare KV REST এন্ডপয়েন্ট বানায় */
function kvApi(key: string): { ok: boolean; url: string; token: string } {
  const env = getCfEnv();
  return {
    ok: Boolean(env.accountId && env.apiToken && env.kvId),
    url: `https://api.cloudflare.com/client/v4/accounts/${env.accountId}/storage/kv/namespaces/${env.kvId}/values/${key}`,
    token: env.apiToken,
  };
}

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
  customers: initialCustomers,
  expenses: initialExpenses,
  duePayments: initialDuePayments,
};

let hasFetchedKV = false;

/**
 * সেলফ-হিলিং ডেটা মাইগ্রেশন:
 * পুরনো KV ডেটায় SKU/বারকোড নেই এমন প্রোডাক্টকে ডিটারমিনিস্টিক কোড দেয়
 * (প্রোডাক্ট আইডির সংখ্যা থেকে — prod-1 → JX-SH-001), যাতে কোড-দিয়ে-সেল,
 * বারকোড, ইনভেন্টরি — সব জায়গায় সঠিক কোড থাকে।
 * রিটার্ন করে কিছু বদলেছে কিনা; বদলে থাকলে কলার KV-তে সেভ করে।
 */
function migrateStoreData(data: FullStoreData): boolean {
  let changed = false;
  const catCode = (c?: string) => (c === 'bags' ? 'BG' : c === 'accessories' ? 'AC' : 'SH');
  for (const p of data.products || []) {
    const num = (p.id.match(/(\d+)/) || [])[1];
    if (!p.sku) {
      const suffix = num ? num.padStart(3, '0') : String(Date.now()).slice(-4);
      p.sku = `JX-${catCode(p.category)}-${suffix}`;
      changed = true;
    }
    if (!p.barcode) {
      const suffix = num ? num.padStart(6, '0') : String(Date.now()).slice(-6);
      p.barcode = `890100${suffix}`;
      changed = true;
    }
  }
  return changed;
}

export async function getStoreData(): Promise<FullStoreData> {
  // If we have Cloudflare KV credentials, sync with Cloudflare KV
  const kv = kvApi(KV_KEY);
  if (kv.ok) {
    try {
      const res = await fetch(kv.url, {
        headers: {
          Authorization: `Bearer ${kv.token}`,
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
          customers: parsed.customers || [],
          expenses: parsed.expenses || [],
          duePayments: parsed.duePayments || [],
        };
        hasFetchedKV = true;
        // পুরনো ডেটায় SKU/বারকোড মিসিং থাকলে বসিয়ে KV-তে সেভ (একবারই হবে)
        if (migrateStoreData(cachedData)) {
          await saveStoreData(cachedData);
        }
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
  const kv = kvApi(KV_KEY);
  if (kv.ok) {
    try {
      await fetch(kv.url, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${kv.token}`,
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

// ================== CUSTOMER LEDGER (বাকির খাতা) ==================

/** ফোন নম্বর দিয়ে কাস্টমার আপসার্ট — অর্ডার/সেলের সাথে লেজার সিংক রাখে */
function upsertCustomerInData(
  data: FullStoreData,
  info: { name?: string; phone: string; address?: string },
  purchaseAmount: number,
  dueDelta: number
): Customer {
  if (!data.customers) data.customers = [];
  const phone = (info.phone || '').trim();
  let cust = phone ? data.customers.find(c => c.phone === phone) : undefined;

  if (!cust) {
    cust = {
      id: `cust-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: (info.name || 'নাম নেই').trim(),
      phone,
      address: info.address,
      dueAmount: 0,
      totalPurchases: 0,
      orderCount: 0,
      createdAt: new Date().toISOString(),
    };
    data.customers.unshift(cust);
  } else if (cust.name === 'নাম নেই' && info.name && info.name.trim()) {
    cust.name = info.name.trim();
  }

  cust.totalPurchases = Math.max(0, (cust.totalPurchases || 0) + purchaseAmount);
  cust.orderCount = (cust.orderCount || 0) + 1;
  cust.dueAmount = Math.max(0, (cust.dueAmount || 0) + dueDelta);
  if (info.address) cust.address = info.address;
  return cust;
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

  // লাভ-ক্ষতি নিখুঁত রাখতে বিক্রির সময়ের ক্রয়মূল্য স্ন্যাপশট নেওয়া হয়
  const itemsWithCost: OrderItem[] = orderData.items.map(it => {
    if (it.costPrice !== undefined) return it;
    const prod = data.products.find(p => p.id === it.productId);
    return { ...it, costPrice: prod?.costPrice };
  });

  const newOrder: Order = {
    ...orderData,
    items: itemsWithCost,
    id,
    orderNumber,
    paidAmount: orderData.paidAmount ?? orderData.total,
    dueAmount: orderData.dueAmount ?? 0,
    status: 'Pending',
    createdAt: new Date().toISOString(),
  };

  // কাস্টমার ডেটাবেজে যুক্ত/আপডেট (অনলাইন অর্ডারে বাকি হয় না)
  if (orderData.phone) {
    newOrder.customerId = upsertCustomerInData(
      data,
      { name: orderData.customerName, phone: orderData.phone, address: orderData.address },
      orderData.total,
      0
    ).id;
  }

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
    return { valid: false, discount: 0, message: 'কুপন কোডটি সঠিক নয় বা মেয়াদ উত্তীর্ণ।' };
  }
  if (orderTotal < match.minOrder) {
    return { valid: false, discount: 0, message: `এই কুপন ব্যবহারের জন্য ন্যূনতম ৳${match.minOrder} টাকার অর্ডার প্রয়োজন।` };
  }
  let discount = 0;
  if (match.discountType === 'percentage') {
    discount = Math.round((orderTotal * match.value) / 100);
  } else {
    discount = match.value;
  }
  return { valid: true, discount, message: `অভিনন্দন! ৳${discount} টাকা ছাড় প্রযোজ্য হয়েছে।` };
}

// ================== POS / IN-STORE QUICK SALE ==================
export interface PosSaleItemInput {
  productId: string;
  variantId?: string;
  quantity: number;
  size?: string;
  color?: string;
}

export async function createPosSale(
  items: PosSaleItemInput[],
  options?: {
    customerName?: string;
    customerPhone?: string;
    customerAddress?: string;
    paidAmount?: number; // দেওয়া না থাকলে পুরো টাকা ক্যাশে ধরা হয়
    note?: string;
  }
): Promise<Order | null> {
  const data = await getStoreData();
  if (!items || items.length === 0) return null;

  const orderItems: OrderItem[] = [];
  let subtotal = 0;
  if (!data.inventoryMovements) data.inventoryMovements = [];

  for (const item of items) {
    const prod = data.products.find(p => p.id === item.productId);
    if (!prod) continue;

    const qty = Math.max(1, Number(item.quantity) || 1);

    let variant: ProductVariant | undefined;
    if (item.variantId && prod.variants) {
      variant = prod.variants.find(v => v.id === item.variantId);
    }
    if (!variant && prod.variants && prod.variants.length > 0) {
      variant =
        prod.variants.find(v =>
          (!item.size || v.size === item.size) &&
          (!item.color || v.color === item.color) &&
          (v.stock || 0) > 0
        ) ||
        prod.variants.find(v => (v.stock || 0) > 0) ||
        prod.variants[0];
    }

    const size = item.size || variant?.size || prod.sizes[0] || 'Standard';
    const color = item.color || variant?.color || prod.colors[0]?.name || 'Default';
    const unitPrice = variant?.price ?? prod.price;
    const unitCost = variant?.costPrice ?? prod.costPrice;

    const prevStock = prod.stockCount;
    prod.stockCount = Math.max(0, prod.stockCount - qty);
    prod.inStock = prod.stockCount > 0;
    if (variant) variant.stock = Math.max(0, (variant.stock || 0) - qty);

    orderItems.push({
      productId: prod.id,
      name: prod.name,
      price: unitPrice,
      costPrice: unitCost,
      quantity: qty,
      selectedSize: size,
      selectedColor: color,
      image: prod.images[0] || '',
    });
    subtotal += unitPrice * qty;

    data.inventoryMovements.unshift({
      id: `mov-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      variantInfo: `সাইজ: ${size}, কালার: ${color}`,
      type: 'SALE',
      quantity: -qty,
      previousStock: prevStock,
      newStock: prod.stockCount,
      unitCost: prod.costPrice,
      supplierOrInvoice: 'ইন-স্টোর POS বিক্রি',
      note: options?.note || 'দোকানে দ্রুত বিক্রি (AI কুইক সেল)',
      createdAt: new Date().toISOString()
    });
  }

  if (orderItems.length === 0) return null;

  // বাকি হিসাব: যত আদায় হয়েছে বাকিটা কাস্টমারের খাতায় যায়
  const total = subtotal;
  const paid = Math.min(Math.max(0, Number(options?.paidAmount ?? total)), total);
  const due = Math.max(0, total - paid);

  const newOrder: Order = {
    id: `ord-${Date.now()}`,
    orderNumber: `JX-${Math.floor(1000 + Math.random() * 9000)}`,
    source: 'in-store',
    customerName: options?.customerName?.trim() || 'দোকানে সরাসরি বিক্রি',
    phone: options?.customerPhone?.trim() || '',
    address: options?.customerAddress?.trim() || '',
    city: 'Inside Dhaka',
    paymentMethod: 'Cash on Delivery',
    items: orderItems,
    subtotal,
    deliveryFee: 0,
    total,
    paidAmount: paid,
    dueAmount: due,
    status: 'Delivered',
    note: options?.note,
    createdAt: new Date().toISOString(),
  };

  // ফোন নম্বর দিলে বা বাকি থাকলে কাস্টমার খাতা আপডেট
  if (options?.customerPhone?.trim() || due > 0) {
    newOrder.customerId = upsertCustomerInData(
      data,
      {
        name: options?.customerName,
        phone: options?.customerPhone || `pos-${Date.now()}`,
        address: options?.customerAddress,
      },
      total,
      due
    ).id;
  }

  data.orders.unshift(newOrder);
  await saveStoreData(data);
  return newOrder;
}

// ================== CUSTOMERS (কাস্টমার ডেটাবেজ) ==================
export async function getCustomers(): Promise<Customer[]> {
  const data = await getStoreData();
  return [...(data.customers || [])].sort((a, b) => {
    if (b.dueAmount !== a.dueAmount) return b.dueAmount - a.dueAmount; // বেশি বাকি আগে
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export async function saveCustomer(
  input: Partial<Customer> & { name: string; phone: string }
): Promise<Customer> {
  const data = await getStoreData();
  if (!data.customers) data.customers = [];

  const phone = input.phone.trim();
  const existing =
    (input.id && data.customers.find(c => c.id === input.id)) ||
    data.customers.find(c => c.phone === phone);

  if (existing) {
    existing.name = input.name.trim();
    existing.phone = phone;
    if (input.address !== undefined) existing.address = input.address;
    if (input.note !== undefined) existing.note = input.note;
    if (input.dueAmount !== undefined) existing.dueAmount = Math.max(0, Number(input.dueAmount));
    await saveStoreData(data);
    return existing;
  }

  const cust: Customer = {
    id: `cust-${Date.now()}`,
    name: input.name.trim(),
    phone,
    address: input.address,
    dueAmount: Math.max(0, Number(input.dueAmount) || 0), // পুরনো খাতা মাইগ্রেটের জন্য
    totalPurchases: 0,
    orderCount: 0,
    note: input.note,
    createdAt: new Date().toISOString(),
  };
  data.customers.unshift(cust);
  await saveStoreData(data);
  return cust;
}

export async function deleteCustomer(id: string): Promise<boolean> {
  const data = await getStoreData();
  const before = data.customers.length;
  data.customers = (data.customers || []).filter(c => c.id !== id);
  if (data.customers.length !== before) {
    await saveStoreData(data);
    return true;
  }
  return false;
}

/** বাকি আদায় — কাস্টমারের খাতা কমায় + কালেকশন রেকর্ড রাখে */
export async function recordDuePayment(input: {
  customerId: string;
  amount: number;
  method: DuePayment['method'];
  note?: string;
}): Promise<{ customer: Customer; payment: DuePayment } | null> {
  const data = await getStoreData();
  const cust = (data.customers || []).find(c => c.id === input.customerId);
  if (!cust) return null;

  const amount = Math.max(1, Number(input.amount) || 0);
  const payment: DuePayment = {
    id: `pay-${Date.now()}`,
    customerId: cust.id,
    customerName: cust.name,
    customerPhone: cust.phone,
    amount,
    method: input.method,
    note: input.note,
    createdAt: new Date().toISOString(),
  };

  cust.dueAmount = Math.max(0, cust.dueAmount - amount);
  if (!data.duePayments) data.duePayments = [];
  data.duePayments.unshift(payment);
  await saveStoreData(data);
  return { customer: cust, payment };
}

export async function getDuePayments(): Promise<DuePayment[]> {
  const data = await getStoreData();
  return [...(data.duePayments || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

// ================== EXPENSES (খরচের খাতা) ==================
export async function getExpenses(): Promise<Expense[]> {
  const data = await getStoreData();
  return [...(data.expenses || [])].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function saveExpense(input: {
  category: string;
  amount: number;
  note?: string;
}): Promise<Expense> {
  const data = await getStoreData();
  if (!data.expenses) data.expenses = [];
  const exp: Expense = {
    id: `exp-${Date.now()}`,
    category: input.category.trim() || 'অন্যান্য',
    amount: Math.max(0, Number(input.amount) || 0),
    note: input.note,
    createdAt: new Date().toISOString(),
  };
  data.expenses.unshift(exp);
  await saveStoreData(data);
  return exp;
}

export async function deleteExpense(id: string): Promise<boolean> {
  const data = await getStoreData();
  const before = data.expenses.length;
  data.expenses = (data.expenses || []).filter(e => e.id !== id);
  if (data.expenses.length !== before) {
    await saveStoreData(data);
    return true;
  }
  return false;
}

// ================== FINANCE SUMMARY (লাভ-ক্ষতি ও হিসাব) ==================
export async function computeFinanceSummary(): Promise<FinanceSummary> {
  const data = await getStoreData();
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const weekAgo = startOfDay - 6 * 86400000;
  const monthAgo = startOfDay - 29 * 86400000;

  const validOrders = data.orders.filter(o => o.status !== 'Cancelled');
  const inRange = (o: { createdAt: string }, from: number) =>
    new Date(o.createdAt).getTime() >= from;

  let revenue = 0;
  let cogs = 0;
  for (const o of validOrders) {
    revenue += o.total;
    for (const it of o.items) {
      let cost = it.costPrice;
      if (cost === undefined) {
        // পুরনো অর্ডারে স্ন্যাপশট না থাকলে বর্তমান ক্রয়মূল্য বা ৬৫% অনুমান
        const prod = data.products.find(p => p.id === it.productId);
        cost = prod?.costPrice ?? Math.round(it.price * 0.65);
      }
      cogs += cost * it.quantity;
    }
  }

  const grossProfit = revenue - cogs;
  const operatingExpenses = (data.expenses || []).reduce((s, e) => s + e.amount, 0);

  const expenseMap = new Map<string, number>();
  for (const e of data.expenses || []) {
    expenseMap.set(e.category, (expenseMap.get(e.category) || 0) + e.amount);
  }

  // গত ৩০ দিনের দৈনিক বিক্রি সিরিজ (তারিখ অনুযায়ী)
  const dayKey = (t: number) => new Date(t).toLocaleDateString('en-CA');
  const revByDay = new Map<string, number>();
  for (const o of validOrders) {
    if (inRange(o, monthAgo)) {
      const key = dayKey(new Date(o.createdAt).getTime());
      revByDay.set(key, (revByDay.get(key) || 0) + o.total);
    }
  }
  const dailyRevenue: { date: string; revenue: number }[] = [];
  for (let i = 0; i < 30; i++) {
    const key = dayKey(startOfDay - i * 86400000);
    dailyRevenue.unshift({ date: key, revenue: revByDay.get(key) || 0 });
  }

  const todayOrders = validOrders.filter(o => inRange(o, startOfDay));
  const totalDues = (data.customers || []).reduce((s, c) => s + (c.dueAmount || 0), 0);
  const allPayments = data.duePayments || [];

  return {
    revenue,
    cogs: Math.round(cogs),
    grossProfit: Math.round(grossProfit),
    operatingExpenses,
    netProfit: Math.round(grossProfit - operatingExpenses),
    totalDues,
    totalCollected: allPayments.reduce((s, p) => s + p.amount, 0),
    orderCount: validOrders.length,
    customerCount: (data.customers || []).length,
    expenseByCategory: Array.from(expenseMap.entries())
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    dailyRevenue,
    today: {
      revenue: todayOrders.reduce((s, o) => s + o.total, 0),
      orders: todayOrders.length,
      collected: allPayments
        .filter(p => new Date(p.createdAt).getTime() >= startOfDay)
        .reduce((s, p) => s + p.amount, 0),
    },
    last7: {
      revenue: validOrders.filter(o => inRange(o, weekAgo)).reduce((s, o) => s + o.total, 0),
      orders: validOrders.filter(o => inRange(o, weekAgo)).length,
    },
    last30: {
      revenue: validOrders.filter(o => inRange(o, monthAgo)).reduce((s, o) => s + o.total, 0),
      orders: validOrders.filter(o => inRange(o, monthAgo)).length,
    },
  };
}

// ================== AI REPORTS STORAGE (আলাদা KV কি) ==================
let reportsCache: StoredReport[] | null = null;

export async function getReports(): Promise<StoredReport[]> {
  if (reportsCache) return reportsCache;
  const kv = kvApi('jx_ai_reports');
  if (!kv.ok) return [];
  try {
    const res = await fetch(kv.url, {
      headers: { Authorization: `Bearer ${kv.token}` },
      cache: 'no-store',
    });
    if (!res.ok) return [];
    const parsed = await res.json();
    reportsCache = Array.isArray(parsed) ? parsed : [];
    return reportsCache;
  } catch (err) {
    console.warn('Reports KV fetch warning:', err);
    return [];
  }
}

export async function saveReport(report: StoredReport): Promise<void> {
  const list = (await getReports()).filter(r => r.id !== report.id);
  reportsCache = [report, ...list].slice(0, 24); // সর্বশেষ ২৪টা রিপোর্ট
  const kv = kvApi('jx_ai_reports');
  if (!kv.ok) return;
  try {
    await fetch(kv.url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${kv.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(reportsCache),
    });
  } catch (err) {
    console.warn('Reports KV save warning:', err);
  }
}

// ================== AI DAILY BRIEF CACHE (আলাদা KV কি, দিনে ১ বার জেনারেট) ==================
let dailyBriefCache: AIDailyBrief | null = null;

export async function getDailyBrief(): Promise<AIDailyBrief | null> {
  const today = new Date().toISOString().slice(0, 10);
  if (dailyBriefCache && dailyBriefCache.date === today) return dailyBriefCache;
  const kv = kvApi('jx_ai_daily_brief');
  if (!kv.ok) return null;
  try {
    const res = await fetch(kv.url, {
      headers: { Authorization: `Bearer ${kv.token}` },
      cache: 'no-store',
    });
    if (!res.ok) return null;
    const parsed = await res.json();
    if (parsed && parsed.date === today) {
      dailyBriefCache = parsed;
      return parsed;
    }
    return null;
  } catch (err) {
    console.warn('Daily brief KV fetch warning:', err);
    return null;
  }
}

export async function saveDailyBrief(brief: AIDailyBrief): Promise<void> {
  dailyBriefCache = brief;
  const kv = kvApi('jx_ai_daily_brief');
  if (!kv.ok) return;
  try {
    await fetch(kv.url, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${kv.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(brief),
    });
  } catch (err) {
    console.warn('Daily brief KV save warning:', err);
  }
}

/**
 * অফলাইন মিররে মিউটেশন প্রয়োগ + GET রেসপন্স তৈরি।
 * সার্ভারের src/lib/store.ts লজিকের আয়না — লোকাল প্রিভিউ হিসেবে; চূড়ান্ত সত্য সার্ভার
 * (রিপ্লে-র পরে স্ন্যাপশট টেনে মিরর বদলে যায়)। তাই সামান্য দ্বিধা সেলফ-হিল হয়।
 */
import type { FullStoreData } from '@/types/fullStoreData';
import type {
  Product,
  Order,
  OrderItem,
  Customer,
  Expense,
  DuePayment,
  CategoryItem,
  Coupon,
  NotificationItem,
  ProductVariant,
} from '@/types';
import {
  computeFinanceSummaryFromData,
  getFastMoversFromData,
  computeInventorySummary,
} from '@/lib/compute';
import { localId } from './db';
import {
  loadNotificationsCache,
  saveNotificationsCache,
  loadReportsCache,
  loadBriefCache,
  loadMediaCache,
  saveMediaCache,
  loadMeta,
  addLocalOrder,
} from './snapshot';

export interface LocalResult {
  status: number;
  payload: unknown;
  label: string;
  /** রিপ্লে-র জন্য সম্পূর্ণ বডি (আংশিক এডিট সার্ভারে ভাঙে — যেমন PUT products {price}) */
  replayBody?: unknown;
  /** রিড-অনলি কম্পিউট (validate) — কিউ করা হবে না */
  noQueue?: boolean;
  /** এই অপ যে লোকাল এন্টিটি তৈরি করেছে — সিঙ্কে server-id ম্যাপিং */
  ref?: { type: 'product' | 'category' | 'customer' | 'expense' | 'coupon' | 'order'; id: string };
}

const nowIso = () => new Date().toISOString();

async function addLocalNotification(item: Omit<NotificationItem, 'id' | 'read' | 'createdAt'>) {
  const list = await loadNotificationsCache();
  list.unshift({
    id: `ntf-off-${Date.now()}-${Math.floor(Math.random() * 10000)}`,
    read: false,
    createdAt: nowIso(),
    ...item,
  });
  await saveNotificationsCache(list.slice(0, 200));
}

/** লোকাল সাইজ/কালার অনুযায়ী ভ্যারিয়েন্ট খোঁজা */
function findVariant(p: Product, size?: string, color?: string, variantId?: string): ProductVariant | undefined {
  if (variantId) return p.variants?.find(v => v.id === variantId);
  if (!p.variants || p.variants.length === 0) return undefined;
  return p.variants.find(v => size && v.size === size && (!color || v.color === color));
}

/** ফোন দিয়ে কাস্টমার আপসার্ট — সার্ভারের upsertCustomerInData-র আয়না */
function upsertCustomer(
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
      id: localId('cust'),
      name: (info.name || 'নাম নেই').trim(),
      phone,
      address: info.address,
      dueAmount: 0,
      totalPurchases: 0,
      orderCount: 0,
      createdAt: nowIso(),
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

// ================== মিউটেশন প্রয়োগ ==================
/**
 * মিররে (deep clone-এর পরে) মিউটেশন প্রয়োগ করে।
 * রিটার্ন null মানে এই রুটের কোনো লোকাল প্রয়োগকারী নেই — কলার জেনেরিক কিউ ব্যবহার করবে।
 */
export async function applyMutation(
  data: FullStoreData,
  method: string,
  path: string,
  body: Record<string, unknown> | undefined
): Promise<LocalResult | null> {
  const m = `${method} ${path}`;

  // ---------- PRODUCTS ----------
  if (m === 'POST /api/products') {
    const full = buildProduct(data, body || {}, undefined);
    data.products.unshift(full);
    pushRestockMovement(data, full, 'নতুন প্রোডাক্ট হিসেবে প্রাথমিক স্টক এন্ট্রি');
    return { status: 201, payload: full, label: `নতুন প্রোডাক্ট: ${full.name}`, ref: { type: 'product', id: full.id } };
  }
  const putProduct = m.match(/^PUT \/api\/products\/([^/?]+)$/);
  if (putProduct) {
    const id = decodeURIComponent(putProduct[1]);
    const full = buildProduct(data, body || {}, id);
    const idx = data.products.findIndex(p => p.id === id);
    if (idx < 0) return { status: 404, payload: { error: 'Product not found' }, label: `প্রোডাক্ট এডিট (পাওয়া যায়নি)` };
    data.products[idx] = { ...data.products[idx], ...full };
    return { status: 200, payload: data.products[idx], label: `প্রোডাক্ট আপডেট: ${full.name}`, replayBody: data.products[idx] };
  }
  const delProduct = m.match(/^DELETE \/api\/products\/([^/?]+)$/);
  if (delProduct) {
    const id = decodeURIComponent(delProduct[1]);
    const before = data.products.length;
    data.products = data.products.filter(p => p.id !== id);
    if (data.products.length === before) return { status: 404, payload: { error: 'Product not found' }, label: 'প্রোডাক্ট মুছে ফেলা' };
    return { status: 200, payload: { message: 'Product deleted' }, label: 'প্রোডাক্ট মুছে ফেলা' };
  }

  // ---------- ORDERS ----------
  if (m === 'POST /api/orders') {
    const b = body as Partial<Order> | undefined;
    if (!b || !b.customerName || !b.phone || !Array.isArray(b.items)) {
      return { status: 400, payload: { error: 'Customer name, phone and items are required' }, label: 'নতুন অর্ডার' };
    }
    const orderNumber = `SK-${Math.floor(1000 + Math.random() * 9000)}`;
    const items: OrderItem[] = b.items.map(it => {
      const prod = data.products.find(p => p.id === it.productId);
      return { ...it, costPrice: it.costPrice !== undefined ? it.costPrice : prod?.costPrice };
    });
    const total = b.total ?? items.reduce((s, i) => s + i.price * i.quantity, 0);
    const order: Order = {
      ...(b as Order),
      items,
      id: localId('ord'),
      orderNumber,
      paidAmount: b.paidAmount ?? total,
      dueAmount: b.dueAmount ?? 0,
      status: 'Pending',
      createdAt: nowIso(),
    };
    if (order.phone) {
      order.customerId = upsertCustomer(data, { name: order.customerName, phone: order.phone, address: order.address }, total, 0).id;
    }
    for (const item of items) {
      const prod = data.products.find(p => p.id === item.productId);
      if (!prod) continue;
      const prevStock = prod.stockCount;
      prod.stockCount = Math.max(0, prod.stockCount - item.quantity);
      prod.inStock = prod.stockCount > 0;
      const v = findVariant(prod, item.selectedSize, item.selectedColor);
      if (v) v.stock = Math.max(0, v.stock - item.quantity);
      data.inventoryMovements.unshift({
        id: localId('mov'),
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
        note: `গ্রাহক: ${order.customerName} (${order.phone})`,
        createdAt: nowIso(),
      });
    }
    data.orders.unshift(order);
    // পাবলিক স্কোপে (শপ ভিজিটরের অফলাইন অর্ডার) স্ন্যাপশট রিফ্রেশেও টিকিয়ে রাখা
    const meta = await loadMeta();
    if (meta.scope === 'public') await addLocalOrder(order);
    await addLocalNotification({
      type: 'order',
      title: `নতুন অর্ডার: ${orderNumber}`,
      message: `${order.customerName} • ${order.items.length}টি আইটেম • ৳${total.toLocaleString('en-BD')} • ${order.paymentMethod}`,
    });
    return { status: 201, payload: order, label: `নতুন অর্ডার: ${orderNumber} (৳${total})`, ref: { type: 'order', id: order.id } };
  }
  const patchOrder = m.match(/^PATCH \/api\/orders\/([^/?]+)$/);
  if (patchOrder) {
    const id = decodeURIComponent(patchOrder[1]);
    const order = data.orders.find(o => o.id === id);
    if (!order) return { status: 404, payload: { error: 'Order not found' }, label: 'অর্ডার স্ট্যাটাস' };
    if (body && body.status !== undefined) order.status = body.status as Order['status'];
    if (body && body.adminNote !== undefined) order.adminNote = body.adminNote as string;
    return { status: 200, payload: order, label: `অর্ডার ${order.orderNumber} → ${order.status}` };
  }

  // ---------- POS SALE ----------
  if (m === 'POST /api/pos/sale') {
    const items = (body?.items as { productId: string; variantId?: string; quantity: number; size?: string; color?: string }[]) || [];
    const options = (body?.options as { customerName?: string; customerPhone?: string; customerAddress?: string; paidAmount?: number; note?: string }) || {};
    const orderItems: OrderItem[] = [];
    let subtotal = 0;
    for (const item of items) {
      const prod = data.products.find(p => p.id === item.productId);
      if (!prod) continue;
      const qty = Math.max(1, Number(item.quantity) || 1);
      let variant: ProductVariant | undefined;
      if (item.variantId && prod.variants) variant = prod.variants.find(v => v.id === item.variantId);
      if (!variant && prod.variants && prod.variants.length > 0) {
        variant =
          prod.variants.find(v => (!item.size || v.size === item.size) && (!item.color || v.color === item.color) && (v.stock || 0) > 0) ||
          prod.variants.find(v => (v.stock || 0) > 0) ||
          prod.variants[0];
      }
      const size = item.size || variant?.size || prod.sizes[0] || 'Standard';
      const color = item.color || variant?.color || prod.colors[0]?.name || 'Default';
      const unitPrice = variant?.price ?? prod.price;
      const prevStock = prod.stockCount;
      prod.stockCount = Math.max(0, prod.stockCount - qty);
      prod.inStock = prod.stockCount > 0;
      if (variant) variant.stock = Math.max(0, (variant.stock || 0) - qty);
      orderItems.push({
        productId: prod.id,
        name: prod.name,
        price: unitPrice,
        costPrice: variant?.costPrice ?? prod.costPrice,
        quantity: qty,
        selectedSize: size,
        selectedColor: color,
        image: prod.images[0] || '',
      });
      subtotal += unitPrice * qty;
      data.inventoryMovements.unshift({
        id: localId('mov'),
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
        createdAt: nowIso(),
      });
    }
    if (orderItems.length === 0) return { status: 400, payload: { error: 'কোনো আইটেম ম্যাচ হয়নি' }, label: 'POS বিক্রি' };
    const paid = Math.min(Math.max(0, Number(options?.paidAmount ?? subtotal)), subtotal);
    const due = Math.max(0, subtotal - paid);
    const order: Order = {
      id: localId('ord'),
      orderNumber: `SK-${Math.floor(1000 + Math.random() * 9000)}`,
      source: 'in-store',
      customerName: options?.customerName?.trim() || 'দোকানে সরাসরি বিক্রি',
      phone: options?.customerPhone?.trim() || '',
      address: options?.customerAddress?.trim() || '',
      city: 'Inside Dhaka',
      paymentMethod: 'Cash on Delivery',
      items: orderItems,
      subtotal,
      deliveryFee: 0,
      total: subtotal,
      paidAmount: paid,
      dueAmount: due,
      status: 'Delivered',
      note: options?.note,
      createdAt: nowIso(),
    };
    if (options?.customerPhone?.trim() || due > 0) {
      order.customerId = upsertCustomer(
        data,
        { name: options?.customerName, phone: options?.customerPhone || `pos-${Date.now()}`, address: options?.customerAddress },
        subtotal,
        due
      ).id;
    }
    data.orders.unshift(order);
    await addLocalNotification({
      type: 'order',
      title: `নতুন অর্ডার: ${order.orderNumber}`,
      message: `${order.customerName} • ${order.items.length}টি আইটেম • ৳${subtotal.toLocaleString('en-BD')} • Cash on Delivery (দোকানে বিক্রি)`,
    });
    return { status: 200, payload: order, label: `POS বিক্রি: ${order.orderNumber} (৳${subtotal})`, ref: { type: 'order', id: order.id } };
  }

  // ---------- CUSTOMERS ----------
  if (m === 'POST /api/customers') {
    const b = body as Partial<Customer> | undefined;
    if (!b || !b.name?.trim() || !b.phone?.trim()) {
      return { status: 400, payload: { error: 'নাম ও ফোন নম্বর দিন' }, label: 'কাস্টমার সংরক্ষণ' };
    }
    const phone = b.phone.trim();
    const existing = (b.id && data.customers.find(c => c.id === b.id)) || data.customers.find(c => c.phone === phone);
    if (existing) {
      existing.name = b.name.trim();
      existing.phone = phone;
      if (b.address !== undefined) existing.address = b.address;
      if (b.note !== undefined) existing.note = b.note;
      if (b.dueAmount !== undefined) existing.dueAmount = Math.max(0, Number(b.dueAmount));
      return { status: 201, payload: existing, label: `কাস্টমার আপডেট: ${existing.name}` };
    }
    const cust: Customer = {
      id: localId('cust'),
      name: b.name.trim(),
      phone,
      address: b.address,
      dueAmount: Math.max(0, Number(b.dueAmount) || 0),
      totalPurchases: 0,
      orderCount: 0,
      note: b.note,
      createdAt: nowIso(),
    };
    data.customers.unshift(cust);
    return { status: 201, payload: cust, label: `নতুন কাস্টমার: ${cust.name}`, ref: { type: 'customer', id: cust.id } };
  }
  if (m === 'DELETE /api/customers') {
    const id = new URL(path).searchParams.get('id') || (body?.id as string) || '';
    const before = data.customers.length;
    data.customers = (data.customers || []).filter(c => c.id !== id);
    if (data.customers.length === before) return { status: 404, payload: { error: 'কাস্টমার পাওয়া যায়নি' }, label: 'কাস্টমার মুছে ফেলা' };
    return { status: 200, payload: { message: 'কাস্টমার মুছে ফেলা হয়েছে' }, label: 'কাস্টমার মুছে ফেলা' };
  }
  if (m === 'POST /api/customers/payment') {
    const b = body as { customerId: string; amount: number; method: DuePayment['method']; note?: string } | undefined;
    const cust = (data.customers || []).find(c => c.id === b?.customerId);
    if (!cust || !b) return { status: 404, payload: { error: 'কাস্টমার পাওয়া যায়নি' }, label: 'বাকি আদায়' };
    const amount = Math.max(1, Number(b.amount) || 0);
    const payment: DuePayment = {
      id: localId('pay'),
      customerId: cust.id,
      customerName: cust.name,
      customerPhone: cust.phone,
      amount,
      method: b.method,
      note: b.note,
      createdAt: nowIso(),
    };
    cust.dueAmount = Math.max(0, cust.dueAmount - amount);
    data.duePayments.unshift(payment);
    return { status: 200, payload: { customer: cust, payment }, label: `বাকি আদায়: ${cust.name} — ৳${amount}` };
  }

  // ---------- EXPENSES ----------
  if (m === 'POST /api/expenses') {
    const b = body as Partial<Expense> | undefined;
    if (!b || !b.category || !b.amount || Number(b.amount) <= 0) {
      return { status: 400, payload: { error: 'খাতা ও সঠিক পরিমাণ দিন' }, label: 'নতুন খরচ' };
    }
    const exp: Expense = {
      id: localId('exp'),
      category: b.category.trim() || 'অন্যান্য',
      amount: Math.max(0, Number(b.amount) || 0),
      note: b.note,
      createdAt: nowIso(),
    };
    data.expenses.unshift(exp);
    return { status: 201, payload: exp, label: `খরচ যোগ: ${exp.category} — ৳${exp.amount}`, ref: { type: 'expense', id: exp.id } };
  }
  if (m === 'DELETE /api/expenses') {
    const id = new URL(path).searchParams.get('id') || (body?.id as string) || '';
    const before = data.expenses.length;
    data.expenses = (data.expenses || []).filter(e => e.id !== id);
    if (data.expenses.length === before) return { status: 404, payload: { error: 'খরচ পাওয়া যায়নি' }, label: 'খরচ মুছে ফেলা' };
    return { status: 200, payload: { message: 'খরচ মুছে ফেলা হয়েছে' }, label: 'খরচ মুছে ফেলা' };
  }

  // ---------- CATEGORIES ----------
  if (m === 'POST /api/categories') {
    const b = body as Partial<CategoryItem> | undefined;
    if (!b || !b.name?.trim() || !b.parentType) {
      return { status: 400, payload: { error: 'Name and Parent Type are required' }, label: 'ক্যাটাগরি সংরক্ষণ' };
    }
    const cat: CategoryItem = {
      id: b.id || localId('cat'),
      name: b.name,
      slug: b.slug || b.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      parentType: b.parentType,
      image: b.image || 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400',
      itemCountLabel: b.itemCountLabel || 'কালেকশন',
    };
    const idx = data.categories.findIndex(c => c.id === cat.id);
    if (idx >= 0) data.categories[idx] = cat;
    else data.categories.push(cat);
    return { status: 201, payload: cat, label: `ক্যাটাগরি সংরক্ষণ: ${cat.name}`, ref: { type: 'category', id: cat.id } };
  }
  const delCategory = m.match(/^DELETE \/api\/categories\/([^/?]+)$/);
  if (delCategory) {
    const id = decodeURIComponent(delCategory[1]);
    const before = data.categories.length;
    data.categories = data.categories.filter(c => c.id !== id);
    if (data.categories.length === before) return { status: 404, payload: { error: 'Category not found' }, label: 'ক্যাটাগরি মুছে ফেলা' };
    return { status: 200, payload: { message: 'Category deleted' }, label: 'ক্যাটাগরি মুছে ফেলা' };
  }

  // ---------- COUPONS ----------
  if (m === 'POST /api/coupons') {
    const b = body as Partial<Coupon> | undefined;
    if (!b || !b.code || b.value === undefined) {
      return { status: 400, payload: { error: 'Coupon code and value are required' }, label: 'কুপন সংরক্ষণ' };
    }
    const coup: Coupon = {
      id: b.id || localId('coup'),
      code: b.code.toUpperCase().trim(),
      discountType: b.discountType || 'fixed',
      value: Number(b.value),
      minOrder: Number(b.minOrder) || 0,
      active: b.active !== undefined ? b.active : true,
    };
    const idx = data.coupons.findIndex(c => c.id === coup.id);
    if (idx >= 0) data.coupons[idx] = coup;
    else data.coupons.unshift(coup);
    return { status: 201, payload: coup, label: `কুপন সংরক্ষণ: ${coup.code}`, ref: { type: 'coupon', id: coup.id } };
  }
  if (m === 'DELETE /api/coupons') {
    const id = new URL(path).searchParams.get('id') || (body?.id as string) || '';
    const before = data.coupons.length;
    data.coupons = data.coupons.filter(c => c.id !== id);
    if (data.coupons.length === before) return { status: 404, payload: { error: 'Coupon not found' }, label: 'কুপন মুছে ফেলা' };
    return { status: 200, payload: { message: 'Coupon deleted' }, label: 'কুপন মুছে ফেলা' };
  }
  if (m === 'POST /api/coupons/validate') {
    // রিড-অনলি কম্পিউট — কিউ হয় না, মিরর থেকেই হিসাব
    const code = String(body?.code || '').toUpperCase().trim();
    const orderTotal = Number(body?.orderTotal) || 0;
    const match = data.coupons.find(c => c.code === code && c.active);
    if (!match) return { status: 200, payload: { valid: false, discount: 0, message: 'কুপন কোডটি সঠিক নয় বা মেয়াদ উত্তীর্ণ।' }, label: '', noQueue: true };
    if (orderTotal < match.minOrder) {
      return { status: 200, payload: { valid: false, discount: 0, message: `এই কুপন ব্যবহারের জন্য ন্যূনতম ৳${match.minOrder} টাকার অর্ডার প্রয়োজন।` }, label: '', noQueue: true };
    }
    const discount = match.discountType === 'percentage' ? Math.round((orderTotal * match.value) / 100) : match.value;
    return { status: 200, payload: { valid: true, discount, message: `অভিনন্দন! ৳${discount} টাকা ছাড় প্রযোজ্য হয়েছে।` }, label: '', noQueue: true };
  }

  // ---------- SETTINGS & MARKETING ----------
  if (m === 'POST /api/settings') {
    data.storeSettings = { ...data.storeSettings, ...(body as object) };
    return { status: 200, payload: data.storeSettings, label: 'সেটিংস আপডেট' };
  }
  if (m === 'POST /api/marketing') {
    if (body?.heroBanner) data.heroBanner = { ...data.heroBanner, ...(body.heroBanner as object) };
    if (body?.flashDeal) data.flashDeal = { ...data.flashDeal, ...(body.flashDeal as object) };
    return { status: 200, payload: { heroBanner: data.heroBanner, flashDeal: data.flashDeal }, label: 'মার্কেটিং আপডেট' };
  }

  // ---------- INVENTORY ----------
  if (m === 'POST /api/inventory') {
    const action = body?.action as string;
    if (action === 'restock') {
      const prod = data.products.find(p => p.id === body?.productId);
      if (!prod) return { status: 404, payload: { error: 'প্রোডাক্টটি খুঁজে পাওয়া যায়নি' }, label: 'স্টক রিস্টক' };
      const prevStock = prod.stockCount;
      const addedQty = Math.max(1, Number(body?.quantity));
      prod.stockCount = prevStock + addedQty;
      prod.inStock = true;
      if (body?.unitCost !== undefined && Number(body.unitCost) > 0) prod.costPrice = Number(body.unitCost);
      let variantInfo = '';
      if (body?.variantId && prod.variants) {
        const v = prod.variants.find(item => item.id === body.variantId);
        if (v) {
          v.stock = (v.stock || 0) + addedQty;
          variantInfo = `সাইজ: ${v.size}, কালার: ${v.color}`;
        }
      }
      data.inventoryMovements.unshift({
        id: localId('mov'),
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        variantInfo: variantInfo || undefined,
        type: 'RESTOCK',
        quantity: addedQty,
        previousStock: prevStock,
        newStock: prod.stockCount,
        unitCost: prod.costPrice,
        supplierOrInvoice: (body?.supplierOrInvoice as string) || prod.supplier || 'চালান / ইনভেন্টরি পারচেস',
        note: (body?.note as string) || 'নতুন চালান বা স্টক ইন এন্ট্রি',
        createdAt: nowIso(),
      });
      return { status: 200, payload: { success: true, product: prod }, label: `রিস্টক: ${prod.name} +${addedQty}` };
    }
    if (action === 'adjust') {
      const prod = data.products.find(p => p.id === body?.productId);
      if (!prod) return { status: 404, payload: { error: 'প্রোডাক্টটি খুঁজে পাওয়া যায়নি' }, label: 'স্টক অ্যাডজাস্ট' };
      const prevStock = prod.stockCount;
      const targetStock = Math.max(0, Number(body?.newStock));
      const delta = targetStock - prevStock;
      prod.stockCount = targetStock;
      prod.inStock = targetStock > 0;
      let variantInfo = '';
      if (body?.variantId && prod.variants) {
        const v = prod.variants.find(item => item.id === body.variantId);
        if (v) {
          v.stock = Math.max(0, (v.stock || 0) + delta);
          variantInfo = `সাইজ: ${v.size}, কালার: ${v.color}`;
        }
      }
      const reason = (body?.reason as 'DAMAGE' | 'RETURN' | 'ADJUSTMENT') || 'ADJUSTMENT';
      data.inventoryMovements.unshift({
        id: localId('mov'),
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
        note: (body?.note as string) || (reason === 'DAMAGE' ? 'ড্যামেজ বা নষ্ট পণ্য বাদ' : reason === 'RETURN' ? 'কাস্টমার রিটার্ন ইন' : 'ফিজিক্যাল স্টক অডিট অ্যাডজাস্টমেন্ট'),
        createdAt: nowIso(),
      });
      return { status: 200, payload: { success: true, product: prod }, label: `স্টক অ্যাডজাস্ট: ${prod.name}` };
    }
    if (action === 'update_sku_barcode') {
      const prod = data.products.find(p => p.id === body?.productId);
      if (!prod) return { status: 404, payload: { error: 'প্রোডাক্ট পাওয়া যায়নি' }, label: 'SKU আপডেট' };
      if (body?.sku) prod.sku = body.sku as string;
      if (body?.barcode) prod.barcode = body.barcode as string;
      if (body?.costPrice !== undefined) prod.costPrice = Number(body.costPrice);
      if (body?.minStockAlert !== undefined) prod.minStockAlert = Number(body.minStockAlert);
      if (body?.supplier) prod.supplier = body.supplier as string;
      return { status: 200, payload: { success: true, product: prod }, label: `SKU/কোড আপডেট: ${prod.name}` };
    }
    return { status: 400, payload: { error: 'Invalid inventory action' }, label: 'ইনভেন্টরি' };
  }

  // ---------- POS UNDO (AI অটো-রিস্টক আন্ডো) ----------
  if (m === 'POST /api/pos/undo-auto') {
    const productId = String(body?.productId || '');
    const quantity = Number(body?.quantity);
    if (!productId || !Number.isFinite(quantity) || quantity <= 0) {
      return { status: 400, payload: { error: 'প্রোডাক্ট ও সঠিক পরিমাণ দিন' }, label: 'আন্ডো' };
    }
    const prod = data.products.find(p => p.id === productId);
    if (!prod) return { status: 404, payload: { error: 'প্রোডাক্ট পাওয়া যায়নি' }, label: 'আন্ডো' };
    if (prod.stockCount < quantity) {
      return { status: 400, payload: { error: `বর্তমান স্টক (${prod.stockCount}) কম থাকায় আন্ডো করা যাচ্ছে না` }, label: 'আন্ডো' };
    }
    const prevStock = prod.stockCount;
    prod.stockCount = Math.max(0, prevStock - quantity);
    prod.inStock = prod.stockCount > 0;
    data.inventoryMovements.unshift({
      id: localId('mov'),
      productId: prod.id,
      productName: prod.name,
      sku: prod.sku,
      type: 'ADJUSTMENT',
      quantity: -quantity,
      previousStock: prevStock,
      newStock: prod.stockCount,
      unitCost: prod.costPrice,
      supplierOrInvoice: 'শপ ইনভেন্টরি অ্যাডজাস্টমেন্ট',
      note: 'AI অটো-রিস্টক আন্ডো (দোকানদার ফিরিয়ে নিয়েছেন)',
      createdAt: nowIso(),
    });
    return {
      status: 200,
      payload: { success: true, product: prod },
      label: `আন্ডো: ${prod.name} −${quantity}`,
    };
  }

  // ---------- MEDIA LIBRARY (গ্যালারি — মিররের বাইরে আলাদা ক্যাশ) ----------
  if (m === 'POST /api/media-library') {
    const urls = ((body?.urls as string[] | undefined) || []).filter(u => typeof u === 'string' && u.trim());
    if (urls.length === 0) {
      return { status: 400, payload: { error: 'URL পাওয়া যায়নি' }, label: 'গ্যালারি যোগ' };
    }
    const media = await loadMediaCache();
    await saveMediaCache([...media, ...urls]);
    return { status: 200, payload: { ok: true, count: urls.length }, label: `গ্যালারিতে ${urls.length}টি ছবি যোগ` };
  }
  if (m === 'DELETE /api/media-library') {
    const remove = ((body?.urls as string[] | undefined) || []).filter(u => typeof u === 'string' && u);
    const media = await loadMediaCache();
    const remaining = media.filter(u => !remove.includes(u));
    await saveMediaCache(remaining);
    return {
      status: 200,
      payload: { ok: true, count: media.length - remaining.length },
      label: `গ্যালারি থেকে ${media.length - remaining.length}টি ছবি মুছে ফেলা`,
    };
  }

  // ---------- NOTIFICATIONS ----------
  if (m === 'PUT /api/notifications') {
    // নোটিফিকেশন মিররের বাইরে (আলাদা ক্যাশ) — apiFetch সামলায়; এখানে আসা উচিত নয়
    return { status: 200, payload: { ok: true, count: 0 }, label: 'নোটিফিকেশন পড়া হয়েছে' };
  }

  return null;
}

// ---------- প্রোডাক্ট বিল্ডার (saveProduct-এর আয়না) ----------
function buildProduct(data: FullStoreData, product: Record<string, unknown>, id: string | undefined): Product {
  const existingProd = id ? data.products.find(p => p.id === id) : undefined;
  const isNew = !existingProd;
  const name = String(product.name || existingProd?.name || '');
  const price = Number(product.price ?? existingProd?.price ?? 0);
  const defaultCategory = (product.category as string) || existingProd?.category || 'shoes';
  const prefix = defaultCategory === 'bags' ? 'BG' : 'SH';
  const autoSku = `SK-${prefix}-${Math.floor(100 + Math.random() * 900)}`;
  const variants = (product.variants as ProductVariant[] | undefined) || existingProd?.variants || [];
  const calculatedStock =
    variants.length > 0
      ? variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0)
      : product.stockCount !== undefined
        ? Number(product.stockCount)
        : existingProd?.stockCount ?? 10;

  return {
    id: id || localId('prod'),
    sku: (product.sku as string)?.trim() || existingProd?.sku || autoSku,
    barcode: (product.barcode as string)?.trim() || existingProd?.barcode || `890100${Date.now().toString().slice(-6)}`,
    name,
    slug: (product.slug as string) || name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    description: (product.description as string) || existingProd?.description || '',
    price,
    costPrice:
      product.costPrice !== undefined ? Number(product.costPrice) : existingProd?.costPrice ?? Math.round(price * 0.65),
    originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
    category: defaultCategory,
    subCategory: (product.subCategory as string) || existingProd?.subCategory || 'General',
    sizes: (product.sizes as string[])?.length > 0 ? (product.sizes as string[]) : existingProd?.sizes ?? ['Standard'],
    colors:
      (product.colors as Product['colors'])?.length > 0
        ? (product.colors as Product['colors'])
        : existingProd?.colors ?? [{ name: 'Black', hex: '#000000' }],
    images:
      (product.images as string[])?.length > 0
        ? (product.images as string[])
        : existingProd?.images ?? ['https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800'],
    inStock: calculatedStock > 0,
    stockCount: calculatedStock,
    minStockAlert: product.minStockAlert !== undefined ? Number(product.minStockAlert) : existingProd?.minStockAlert ?? 5,
    supplier: (product.supplier as string)?.trim() || existingProd?.supplier || 'প্রধান সরবরাহকারী',
    variants,
    isFeatured: Boolean(product.isFeatured),
    rating: (product.rating as number) || existingProd?.rating || 5.0,
    createdAt: (product.createdAt as string) || existingProd?.createdAt || nowIso(),
  };
}

function pushRestockMovement(data: FullStoreData, p: Product, note: string) {
  data.inventoryMovements.unshift({
    id: localId('mov'),
    productId: p.id,
    productName: p.name,
    sku: p.sku,
    type: 'RESTOCK',
    quantity: p.stockCount,
    previousStock: 0,
    newStock: p.stockCount,
    unitCost: p.costPrice,
    supplierOrInvoice: p.supplier,
    note,
    createdAt: nowIso(),
  });
}

// ================== GET রেসপন্স (মিরর থেকে) ==================
/** অফলাইনে GET /api/... অনুরোধের মিরর-নির্ভর রেসপন্স; null মানে এই রুট জানে না */
export async function buildOfflineGet(
  data: FullStoreData,
  pathWithQuery: string
): Promise<{ status: number; payload: unknown } | null> {
  const [path, query] = pathWithQuery.split('?');
  const qs = new URLSearchParams(query || '');
  const sortedOrders = [...data.orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  switch (path) {
    case '/api/products': {
      const id = qs.get('id');
      if (id) {
        const p = data.products.find(pr => pr.id === id);
        return p ? { status: 200, payload: p } : { status: 404, payload: { error: 'Product not found' } };
      }
      return { status: 200, payload: data.products };
    }
    case '/api/categories':
      return { status: 200, payload: data.categories };
    case '/api/marketing':
      return { status: 200, payload: { heroBanner: data.heroBanner, flashDeal: data.flashDeal } };
    case '/api/settings':
      return { status: 200, payload: data.storeSettings };
    case '/api/orders': {
      const id = qs.get('id');
      if (id) {
        const o = sortedOrders.find(ord => ord.id === id);
        return o ? { status: 200, payload: o } : { status: 404, payload: { error: 'Order not found' } };
      }
      return { status: 200, payload: sortedOrders };
    }
    case '/api/customers': {
      const customers = [...(data.customers || [])].sort((a, b) => {
        if (b.dueAmount !== a.dueAmount) return b.dueAmount - a.dueAmount;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      return { status: 200, payload: { customers, payments: [...(data.duePayments || [])].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) } };
    }
    case '/api/expenses':
      return { status: 200, payload: [...data.expenses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()) };
    case '/api/coupons':
      return { status: 200, payload: data.coupons };
    case '/api/finance':
      return { status: 200, payload: computeFinanceSummaryFromData(data) };
    case '/api/analytics/fast-movers':
      return { status: 200, payload: getFastMoversFromData(data) };
    case '/api/inventory': {
      const { summary, lowStockProducts, outOfStockProducts } = computeInventorySummary(data.products);
      return {
        status: 200,
        payload: {
          summary,
          products: data.products,
          movements: [...(data.inventoryMovements || [])].sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
          lowStockProducts,
          outOfStockProducts,
        },
      };
    }
    case '/api/reports':
      return { status: 200, payload: await loadReportsCache() };
    case '/api/media-library':
      return { status: 200, payload: await loadMediaCache() };
    case '/api/notifications': {
      const list = await loadNotificationsCache();
      if (qs.get('unreadCount')) {
        return { status: 200, payload: { count: list.filter(n => !n.read).length } };
      }
      return { status: 200, payload: list };
    }
  }

  // ডাইনামিক রুট
  const prodMatch = path.match(/^\/api\/products\/([^/?]+)$/);
  if (prodMatch) {
    const idOrSlug = decodeURIComponent(prodMatch[1]);
    const p = data.products.find(pr => pr.id === idOrSlug || pr.slug === idOrSlug);
    return p ? { status: 200, payload: p } : { status: 404, payload: { error: 'Product not found' } };
  }
  const custMatch = path.match(/^\/api\/customers\/([^/?]+)$/);
  if (custMatch) {
    const id = decodeURIComponent(custMatch[1]);
    const cust = (data.customers || []).find(c => c.id === id);
    if (!cust) return { status: 200, payload: { orders: [], payments: [] } };
    const customerOrders = sortedOrders.filter(o => o.customerId === cust.id || o.phone === cust.phone);
    const customerPayments = (data.duePayments || []).filter(p => p.customerId === cust.id);
    return { status: 200, payload: { orders: customerOrders, payments: customerPayments } };
  }
  const orderMatch = path.match(/^\/api\/orders\/([^/?]+)$/);
  if (orderMatch) {
    const id = decodeURIComponent(orderMatch[1]);
    const o = sortedOrders.find(ord => ord.id === id);
    return o ? { status: 200, payload: o } : { status: 404, payload: { error: 'Order not found' } };
  }

  return null;
}

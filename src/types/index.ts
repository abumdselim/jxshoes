export interface ProductVariant {
  id: string;
  sku: string;         // e.g. "JX-SH-001-42-BLK"
  size: string;        // e.g. "42"
  color: string;       // e.g. "Black"
  stock: number;       // e.g. 8
  price?: number;      // specific selling price if different
  costPrice?: number;  // wholesale cost price
}

export interface InventoryMovement {
  id: string;
  productId: string;
  productName: string;
  sku: string;
  variantInfo?: string; // e.g. "Size 42 - Jet Black"
  type: 'RESTOCK' | 'SALE' | 'DAMAGE' | 'RETURN' | 'ADJUSTMENT';
  quantity: number; // e.g. +20, -1
  previousStock: number;
  newStock: number;
  unitCost?: number;
  supplierOrInvoice?: string; // e.g. "চালান #CH-2026-09, ঢাকা লেদার ক্রাফট"
  note?: string;
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;          // Product Code / SKU (e.g. JX-SH-001)
  barcode?: string;     // Barcode number (e.g. 8901001001)
  name: string;
  slug: string;
  description: string;
  price: number;        // Retail Selling Price
  costPrice?: number;   // Wholesale / Purchase Cost Price (ক্রয়মূল্য)
  originalPrice?: number;
  category: string; // 'shoes' | 'bags' | custom
  subCategory?: string; // e.g. "Sneakers", "Leather Loafers", "Formal Shoes", "Backpacks", "Handbags", "Travel Bags"
  sizes: string[];      // e.g. ["39", "40", "41", "42", "43", "44"] or ["Standard", "Large"]
  colors: { name: string; hex: string }[];
  images: string[];
  inStock: boolean;
  stockCount: number;
  minStockAlert?: number; // Minimum stock alert threshold (default: 5)
  supplier?: string;     // Supplier / Factory name
  variants?: ProductVariant[]; // Variant-level stock breakdown
  isFeatured?: boolean;
  rating?: number;
  createdAt: string;
}

export interface OrderItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  selectedSize: string;
  selectedColor: string;
  image: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  source?: 'online' | 'in-store'; // in-store = POS quick sale from admin
  customerName: string;
  phone: string;
  address: string;
  city: 'Inside Dhaka' | 'Outside Dhaka';
  paymentMethod: 'Cash on Delivery' | 'bKash / Nagad';
  bkashTrxId?: string;
  note?: string;
  adminNote?: string;
  items: OrderItem[];
  subtotal: number;
  discount?: number;
  couponCode?: string;
  deliveryFee: number;
  total: number;
  status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  createdAt: string;
}

export interface CategoryItem {
  id: string;
  name: string;
  slug: string;
  parentType: 'shoes' | 'bags' | 'accessories';
  image: string;
  itemCountLabel?: string;
}

export interface StoreSettings {
  storeName: string;
  ownerName?: string; // দোকানের মালিকের নাম — AI গ্রিটিং ও ব্যক্তিগতকরণের জন্য
  tagline: string;
  hotline: string;
  email: string;
  address: string;
  announcementText: string;
  announcementSecondary: string;
  insideDhakaFee: number;
  outsideDhakaFee: number;
  freeDeliveryAbove: number;
  bkashNumber: string;
  nagadNumber: string;
}

export interface HeroBannerSettings {
  badgeText: string;
  titlePart1: string;
  titleHighlight: string;
  subtitle: string;
  ctaText: string;
  shoeHighlightText: string;
  bagHighlightText: string;
}

export interface FlashDealSettings {
  enabled: boolean;
  badgeText: string;
  targetProductId: string;
  countdownHours: number;
}

export interface Coupon {
  id: string;
  code: string;
  discountType: 'percentage' | 'fixed';
  value: number;
  minOrder: number;
  active: boolean;
}

// ================== AI (Cloudflare Workers AI) ==================
export interface AIDailyBrief {
  date: string; // YYYY-MM-DD (DST) — দিনে ১ বার জেনারেট হয়
  greeting: string; // AI-এর ব্যক্তিগত স্বাগতম
  summary: string; // আজকের শপের অবস্থা নিয়ে সারসংক্ষেপ
  advice: string[]; // আজকের করণীয় পরামর্শ
  alerts: string[]; // জরুরি সতর্কতা (স্টক শেষ, পেন্ডিং অর্ডার ইত্যাদি)
  generatedAt: string;
}

export interface AIInsights {
  headline: string;
  overview: string;
  bestSellers: { name: string; reason: string }[];
  slowMovers: { name: string; reason: string }[];
  restockNeeds: { name: string; suggestion: string }[];
  pricingAdvice: { name: string; suggestion: string }[];
  recommendations: string[];
  generatedAt: string;
}

export interface AISaleMatch {
  matched: boolean;
  productId?: string;
  productName?: string;
  variantId?: string;
  size?: string;
  color?: string;
  quantity?: number;
  confidence: 'high' | 'medium' | 'low';
  clarification?: string; // AI যদি নিশ্চিত না হয়, দোকানদারকে কী জিজ্ঞেস করা হবে
  alternatives?: { productId: string; productName: string; size?: string; color?: string }[];
}

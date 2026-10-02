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
  costPrice?: number; // বিক্রির সময়ের ক্রয়মূল্য স্ন্যাপশট — নিখুঁত লাভ-ক্ষতি হিসাবের জন্য
  quantity: number;
  selectedSize: string;
  selectedColor: string;
  image: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  source?: 'online' | 'in-store'; // in-store = POS quick sale from admin
  customerId?: string; // কাস্টমার ডেটাবেজের সাথে লিংক (ফোন নম্বরে ম্যাচ করে)
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
  paidAmount?: number; // যত টাকা আদায় হয়েছে (বাকি সিস্টেমের জন্য; ডিফল্ট = total)
  dueAmount?: number; // total - paidAmount; বাকির খাতায় যায়
  status: 'Pending' | 'Processing' | 'Shipped' | 'Delivered' | 'Cancelled';
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  phone: string; // ইউনিক কি হিসেবে ব্যবহৃত হয় (আপসার্ট কি)
  address?: string;
  dueAmount: number; // মোট বাকি (receivable)
  totalPurchases: number; // সর্বমোট কেনাকাটার মূল্য
  orderCount: number;
  note?: string;
  createdAt: string;
}

export interface Expense {
  id: string;
  category: string; // 'দোকান ভাড়া' | 'বিদ্যুৎ বিল' | 'কর্মচারী বেতন' | 'পরিবহন' | 'ক্রয় (Purchase)' | 'অন্যান্য'
  amount: number;
  note?: string;
  createdAt: string;
}

export interface DuePayment {
  id: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  method: 'Cash' | 'bKash' | 'Nagad';
  note?: string;
  createdAt: string;
}

export interface FinanceSummary {
  revenue: number; // মোট বিক্রি (বাতিল বাদে)
  cogs: number; // বিক্রীত পণ্যের ক্রয়মূল্য (cost of goods sold)
  grossProfit: number;
  operatingExpenses: number;
  netProfit: number;
  totalDues: number; // গ্রাহকদের মোট বাকি (receivable)
  totalCollected: number; // বাকি আদায়
  orderCount: number;
  customerCount: number;
  expenseByCategory: { category: string; amount: number }[];
  dailyRevenue: { date: string; revenue: number }[]; // গত ৩০ দিনের সিরিজ
  today: { revenue: number; orders: number; collected: number };
  last7: { revenue: number; orders: number };
  last30: { revenue: number; orders: number };
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

export interface FastMoverEntry {
  productId: string;
  name: string;
  sku: string;
  image: string;
  totalSold: number; // স্টক হওয়ার পর থেকে মোট বিক্রি (টি)
  revenue: number;
  daysInStock: number; // স্টক যুক্ত হয়ে কত দিন
  velocity: number; // গড়ে দিনে কতটা বিক্রি (units/day)
  stockLeft: number;
  soldOut: boolean; // দ্রুত বিক্রি হয়ে স্টক শেষ
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

export interface AIReportSection {
  title: string;
  body: string;
  highlights?: string[];
}

export interface StoredReport {
  id: string;
  type: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  headline: string;
  executiveSummary: string;
  sections: AIReportSection[];
  scorecard: { label: string; value: string }[]; // মূল সংখ্যাগুলোর কার্ড
  recommendations: string[];
  generatedAt: string;
  emailedTo?: string; // ইমেইল পাঠানো হলে ঠিকানা + সময় রেকর্ড থাকে
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  originalPrice?: number;
  category: string; // 'shoes' | 'bags' | custom
  subCategory?: string; // e.g. "Sneakers", "Leather Loafers", "Formal Shoes", "Backpacks", "Handbags", "Travel Bags"
  sizes: string[];      // e.g. ["39", "40", "41", "42", "43", "44"] or ["Standard", "Large"]
  colors: { name: string; hex: string }[];
  images: string[];
  inStock: boolean;
  stockCount: number;
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

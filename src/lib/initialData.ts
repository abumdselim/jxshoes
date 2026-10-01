import {
  Product,
  ProductVariant,
  InventoryMovement,
  Order,
  CategoryItem,
  StoreSettings,
  HeroBannerSettings,
  FlashDealSettings,
  Coupon
} from '@/types';

export const initialCategories: CategoryItem[] = [
  {
    id: "cat-1",
    name: "লোফার (Loafers)",
    slug: "loafers",
    parentType: "shoes",
    image: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&q=80&w=400",
    itemCountLabel: "৬+ মডেল"
  },
  {
    id: "cat-2",
    name: "স্নিকার্স (Sneakers)",
    slug: "sneakers",
    parentType: "shoes",
    image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=400",
    itemCountLabel: "৮+ কালার"
  },
  {
    id: "cat-3",
    name: "ফর্মাল শুজ (Formal)",
    slug: "formal-shoes",
    parentType: "shoes",
    image: "https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&q=80&w=400",
    itemCountLabel: "১০০% চামড়া"
  },
  {
    id: "cat-4",
    name: "ল্যাপটপ ও অফিস ব্যাগ",
    slug: "office-bags",
    parentType: "bags",
    image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=400",
    itemCountLabel: "লেদার ও ওয়াটারপ্রুফ"
  },
  {
    id: "cat-5",
    name: "ট্রাভেল ও জিম ব্যাগ",
    slug: "travel-bags",
    parentType: "bags",
    image: "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&q=80&w=400",
    itemCountLabel: "৪৫ লিটার সাইজ"
  },
  {
    id: "cat-6",
    name: "ব্যাকপ্যাক (Backpacks)",
    slug: "backpacks",
    parentType: "bags",
    image: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&q=80&w=400",
    itemCountLabel: "স্মার্ট চার্জিং পোর্ট"
  }
];

export const initialStoreSettings: StoreSettings = {
  storeName: "JxShoes & Bags",
  tagline: "প্রিমিয়াম কোয়ালিটি জুতা ও ব্যাগের বিশ্বস্ত স্টোর",
  hotline: "01712-345678",
  email: "support@jxshoes.com",
  address: "বাড়ি ২৪, রোড ৭, ধানমন্ডি, ঢাকা - ১২০৯",
  announcementText: "ক্যাশ অন ডেলিভারি সুবিধা | সারা বাংলাদেশে দ্রুত হোম ডেলিভারি!",
  announcementSecondary: "• সাইজ বা কালার পরিবর্তন গ্যারান্টি",
  insideDhakaFee: 60,
  outsideDhakaFee: 120,
  freeDeliveryAbove: 5000,
  bkashNumber: "01712-345678 (Personal)",
  nagadNumber: "01712-345678 (Personal)"
};

export const initialHeroBanner: HeroBannerSettings = {
  badgeText: "নতুন কালেকশন ২০২৬ | সরাসরি ম্যানুফ্যাকচারার রেট",
  titlePart1: "প্রিমিয়াম কোয়ালিটি",
  titleHighlight: "জুতা ও লেদার ব্যাগ",
  subtitle: "আভিজাত্য, স্থায়িত্ব এবং সর্বোচ্চ আরামের গ্যারান্টি। জেনুইন লেদার জুতা, স্পোর্টস স্নিকার্স এবং অফিস ও ট্রাভেল ব্যাগে এখন আকর্ষণীয় মূল্যছাড়।",
  ctaText: "কালেকশন দেখুন",
  shoeHighlightText: "স্নিকার্স ও লেদার শুজ",
  bagHighlightText: "ল্যাপটপ ও ট্রাভেল ব্যাগ"
};

export const initialFlashDeal: FlashDealSettings = {
  enabled: true,
  badgeText: "আজকের বিশেষ অফার (Flash Deal)",
  targetProductId: "prod-1",
  countdownHours: 14
};

export const initialCoupons: Coupon[] = [
  {
    id: "coup-1",
    code: "NEW100",
    discountType: "fixed",
    value: 100,
    minOrder: 1500,
    active: true
  },
  {
    id: "coup-2",
    code: "EID10",
    discountType: "percentage",
    value: 10,
    minOrder: 3000,
    active: true
  }
];

export const initialProducts: Product[] = [
  {
    id: "prod-1",
    sku: "JX-SH-001",
    barcode: "890100100101",
    name: "Classic Italian Leather Loafers",
    slug: "classic-italian-leather-loafers",
    description: "প্রিমিয়াম ফুল-গ্রেইন লেদার লোফার। কুশনযুক্ত আরামদায়ক ইনসোল এবং নন-স্লিপ রাবার আউটসোল। অফিস, পার্টি বা ফর্মাল ব্যবহারের জন্য সেরা পছন্দ।",
    price: 3850,
    costPrice: 2450,
    originalPrice: 4500,
    category: "shoes",
    subCategory: "লোফার (Loafers)",
    sizes: ["39", "40", "41", "42", "43", "44"],
    colors: [
      { name: "Deep Brown", hex: "#451a03" },
      { name: "Jet Black", hex: "#111827" },
      { name: "Tan", hex: "#92400e" }
    ],
    images: [
      "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1614252235316-8c857d38b5f4?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 24,
    minStockAlert: 6,
    supplier: "হাজারীবাগ প্রিমিয়াম লেদার ক্রাফট",
    variants: [
      { id: "v-1-1", sku: "JX-SH-001-39-BRN", size: "39", color: "Deep Brown", stock: 3, costPrice: 2450 },
      { id: "v-1-2", sku: "JX-SH-001-40-BRN", size: "40", color: "Deep Brown", stock: 5, costPrice: 2450 },
      { id: "v-1-3", sku: "JX-SH-001-41-BRN", size: "41", color: "Deep Brown", stock: 6, costPrice: 2450 },
      { id: "v-1-4", sku: "JX-SH-001-42-BRN", size: "42", color: "Deep Brown", stock: 6, costPrice: 2450 },
      { id: "v-1-5", sku: "JX-SH-001-43-BLK", size: "43", color: "Jet Black", stock: 4, costPrice: 2450 }
    ],
    isFeatured: true,
    rating: 4.9,
    createdAt: "2026-09-15T10:00:00Z"
  },
  {
    id: "prod-2",
    sku: "JX-SH-002",
    barcode: "890100100201",
    name: "Apex Air Mesh Running Sneakers",
    slug: "apex-air-mesh-running-sneakers",
    description: "অতিমাত্রায় হালকা ও আরামদায়ক এয়ার কুশন রানিং স্নিকার্স। সারাদিন হাঁটাচলা ও জিমের জন্য নিঃশ্বাসযোগ্য মেশ ফেব্রিক।",
    price: 2650,
    costPrice: 1650,
    originalPrice: 3200,
    category: "shoes",
    subCategory: "স্নিকার্স (Sneakers)",
    sizes: ["40", "41", "42", "43", "44", "45"],
    colors: [
      { name: "Midnight Black", hex: "#0f172a" },
      { name: "Pure White", hex: "#f8fafc" },
      { name: "Slate Grey", hex: "#475569" }
    ],
    images: [
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1608231387042-66d1773070a5?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 42,
    minStockAlert: 8,
    supplier: "এপেক্স ফুটওয়্যার লিমিটেড",
    variants: [
      { id: "v-2-1", sku: "JX-SH-002-40-BLK", size: "40", color: "Midnight Black", stock: 8, costPrice: 1650 },
      { id: "v-2-2", sku: "JX-SH-002-41-BLK", size: "41", color: "Midnight Black", stock: 12, costPrice: 1650 },
      { id: "v-2-3", sku: "JX-SH-002-42-WHT", size: "42", color: "Pure White", stock: 14, costPrice: 1650 },
      { id: "v-2-4", sku: "JX-SH-002-43-GRY", size: "43", color: "Slate Grey", stock: 8, costPrice: 1650 }
    ],
    isFeatured: true,
    rating: 4.8,
    createdAt: "2026-09-18T10:00:00Z"
  },
  {
    id: "prod-3",
    sku: "JX-BG-101",
    barcode: "890100200101",
    name: "Executive Leather Laptop Briefcase",
    slug: "executive-leather-laptop-briefcase",
    description: "হ্যান্ডক্রাফটেড ভিন্টেজ জেনুইন লেদার অফিস ব্যাগ। ১৫.৬ ইঞ্চি ল্যাপটপের জন্য প্যাডেড কম্পার্টমেন্ট, ফাইল পকেট ও টেকসই মেটাল জিপার।",
    price: 4950,
    costPrice: 3100,
    originalPrice: 5800,
    category: "bags",
    subCategory: "অফিস ব্যাগ (Office Bags)",
    sizes: ["15.6 Inch Standard"],
    colors: [
      { name: "Vintage Tan", hex: "#78350f" },
      { name: "Obsidian Black", hex: "#18181b" }
    ],
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 15,
    minStockAlert: 4,
    supplier: "বেঙ্গল লেদার গুডস",
    variants: [
      { id: "v-3-1", sku: "JX-BG-101-TAN", size: "15.6 Inch Standard", color: "Vintage Tan", stock: 9, costPrice: 3100 },
      { id: "v-3-2", sku: "JX-BG-101-BLK", size: "15.6 Inch Standard", color: "Obsidian Black", stock: 6, costPrice: 3100 }
    ],
    isFeatured: true,
    rating: 5.0,
    createdAt: "2026-09-20T10:00:00Z"
  },
  {
    id: "prod-4",
    sku: "JX-BG-102",
    barcode: "890100200201",
    name: "Waterproof Travel Duffle & Gym Bag",
    slug: "waterproof-travel-duffle-gym-bag",
    description: "ওয়াটারপ্রুফ ট্রাভেল ডাফেল ব্যাগ সাথে আলাদা শু-কম্পার্টমেন্ট। সপ্তাহান্তের ট্যুর বা জিমের জন্য দারুণ ধারণক্ষমতাসম্পন্ন।",
    price: 2150,
    costPrice: 1350,
    originalPrice: 2800,
    category: "bags",
    subCategory: "ট্রাভেল ব্যাগ (Travel Bags)",
    sizes: ["45 Litre Large"],
    colors: [
      { name: "Charcoal Grey", hex: "#334155" },
      { name: "Army Green", hex: "#14532d" },
      { name: "Navy Blue", hex: "#1e3a8a" }
    ],
    images: [
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1581605405669-fcdf81165afa?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 30,
    minStockAlert: 5,
    supplier: "সাভার ব্যাগ ম্যানুফ্যাকচারিং",
    variants: [
      { id: "v-4-1", sku: "JX-BG-102-GRY", size: "45 Litre Large", color: "Charcoal Grey", stock: 12, costPrice: 1350 },
      { id: "v-4-2", sku: "JX-BG-102-GRN", size: "45 Litre Large", color: "Army Green", stock: 10, costPrice: 1350 },
      { id: "v-4-3", sku: "JX-BG-102-NAV", size: "45 Litre Large", color: "Navy Blue", stock: 8, costPrice: 1350 }
    ],
    isFeatured: false,
    rating: 4.7,
    createdAt: "2026-09-22T10:00:00Z"
  },
  {
    id: "prod-5",
    sku: "JX-SH-003",
    barcode: "890100100301",
    name: "Heritage Chelsea Leather Boots",
    slug: "heritage-chelsea-leather-boots",
    description: "টাইমলেস প্রিমিয়াম লেদার চেলসি বুট। ইলাস্টিক সাইড প্যানেল ও দীর্ঘস্থায়ী গুডইয়ার কনস্ট্রাকশন। দারুণ রাজকীয় লুক।",
    price: 4500,
    costPrice: 2850,
    originalPrice: 5200,
    category: "shoes",
    subCategory: "বুট জুতা (Boots)",
    sizes: ["40", "41", "42", "43", "44"],
    colors: [
      { name: "Dark Walnut", hex: "#3b1e08" },
      { name: "Jet Black", hex: "#0a0a0a" }
    ],
    images: [
      "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1607522370275-f14206abe5d3?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 18,
    minStockAlert: 5,
    supplier: "হাজারীবাগ প্রিমিয়াম লেদার ক্রাফট",
    variants: [
      { id: "v-5-1", sku: "JX-SH-003-41-WAL", size: "41", color: "Dark Walnut", stock: 5, costPrice: 2850 },
      { id: "v-5-2", sku: "JX-SH-003-42-WAL", size: "42", color: "Dark Walnut", stock: 7, costPrice: 2850 },
      { id: "v-5-3", sku: "JX-SH-003-43-BLK", size: "43", color: "Jet Black", stock: 6, costPrice: 2850 }
    ],
    isFeatured: true,
    rating: 4.9,
    createdAt: "2026-09-24T10:00:00Z"
  },
  {
    id: "prod-6",
    sku: "JX-BG-103",
    barcode: "890100200301",
    name: "Urban Minimalist Laptop Backpack",
    slug: "urban-minimalist-laptop-backpack",
    description: "অ্যান্টি-থেফট গোপন পকেট ও ইউএসবি চার্জিং পোর্টসহ আধুনিক ব্যাকপ্যাক। ওয়াটার-রেপেলেন্ট ফ্যাব্রিক এবং ১৬ ইঞ্চি ল্যাপটপ স্লট।",
    price: 2450,
    costPrice: 1550,
    originalPrice: 3100,
    category: "bags",
    subCategory: "ব্যাকপ্যাক (Backpacks)",
    sizes: ["22 Litre Standard"],
    colors: [
      { name: "Matte Black", hex: "#171717" },
      { name: "Heather Grey", hex: "#6b7280" }
    ],
    images: [
      "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1577733966973-d680bffd2e80?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 35,
    minStockAlert: 6,
    supplier: "ঢাকা টেক্সটাইল ব্যাগ",
    variants: [
      { id: "v-6-1", sku: "JX-BG-103-BLK", size: "22 Litre Standard", color: "Matte Black", stock: 20, costPrice: 1550 },
      { id: "v-6-2", sku: "JX-BG-103-GRY", size: "22 Litre Standard", color: "Heather Grey", stock: 15, costPrice: 1550 }
    ],
    isFeatured: true,
    rating: 4.8,
    createdAt: "2026-09-26T10:00:00Z"
  },
  {
    id: "prod-7",
    sku: "JX-SH-004",
    barcode: "890100100401",
    name: "Royal Oxford Formal Leather Shoes",
    slug: "royal-oxford-formal-leather-shoes",
    description: "ক্লাসিক হ্যান্ড-বার্নিশড অক্সফোর্ড ফর্মাল জুতো। স্যুট ও ফরমাল প্যান্টের সাথে রাজকীয় লুকের জন্য পারফেক্ট।",
    price: 4200,
    costPrice: 2650,
    originalPrice: 4900,
    category: "shoes",
    subCategory: "ফর্মাল শুজ (Formal Shoes)",
    sizes: ["39", "40", "41", "42", "43", "44"],
    colors: [
      { name: "Glossy Black", hex: "#0a0a0a" },
      { name: "Cognac Brown", hex: "#7c2d12" }
    ],
    images: [
      "https://images.unsplash.com/photo-1478146896981-b80fe463b330?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 16,
    minStockAlert: 4,
    supplier: "ক্লাসিক ফুটওয়্যার ইন্ডাস্ট্রিজ",
    variants: [
      { id: "v-7-1", sku: "JX-SH-004-40-BLK", size: "40", color: "Glossy Black", stock: 4, costPrice: 2650 },
      { id: "v-7-2", sku: "JX-SH-004-41-BLK", size: "41", color: "Glossy Black", stock: 6, costPrice: 2650 },
      { id: "v-7-3", sku: "JX-SH-004-42-BRN", size: "42", color: "Cognac Brown", stock: 6, costPrice: 2650 }
    ],
    isFeatured: true,
    rating: 5.0,
    createdAt: "2026-09-27T10:00:00Z"
  },
  {
    id: "prod-8",
    sku: "JX-SH-005",
    barcode: "890100100501",
    name: "Streetwear Retro Chunky Sneakers",
    slug: "streetwear-retro-chunky-sneakers",
    description: "ট্রেন্ডি চাঙ্কি স্নিকার্স। থিক কুশনিং ও বোল্ড ডিজাইনের এই জুতো ক্যাজুয়াল আউটিং এবং জিন্সের সাথে দারুণ মানানসই।",
    price: 2850,
    costPrice: 1750,
    originalPrice: 3600,
    category: "shoes",
    subCategory: "স্নিকার্স (Sneakers)",
    sizes: ["40", "41", "42", "43", "44"],
    colors: [
      { name: "Beige & White", hex: "#fef3c7" },
      { name: "Triple Black", hex: "#18181b" }
    ],
    images: [
      "https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 22,
    minStockAlert: 5,
    supplier: "স্পোর্টস শু ল্যাব",
    variants: [
      { id: "v-8-1", sku: "JX-SH-005-41-WHT", size: "41", color: "Beige & White", stock: 10, costPrice: 1750 },
      { id: "v-8-2", sku: "JX-SH-005-42-BLK", size: "42", color: "Triple Black", stock: 12, costPrice: 1750 }
    ],
    isFeatured: true,
    rating: 4.9,
    createdAt: "2026-09-28T10:00:00Z"
  },
  {
    id: "prod-9",
    sku: "JX-BG-104",
    barcode: "890100200401",
    name: "Elegance Leather Crossbody Shoulder Bag",
    slug: "elegance-leather-crossbody-shoulder-bag",
    description: "কমপ্যাক্ট প্রিমিয়াম লেদার ক্রসবাডি স্লিং ব্যাগ। মোবাইল, ওয়ালেট, চাবি ও প্রয়োজনীয় গ্যাজেট বহনের জন্য আধুনিক সমাধান।",
    price: 1850,
    costPrice: 1100,
    originalPrice: 2400,
    category: "bags",
    subCategory: "স্লিং ও ক্রসবাডি (Crossbody)",
    sizes: ["Standard Compact"],
    colors: [
      { name: "Coffee Brown", hex: "#3b1e08" },
      { name: "Matte Black", hex: "#111827" }
    ],
    images: [
      "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 28,
    minStockAlert: 6,
    supplier: "বেঙ্গল লেদার গুডস",
    variants: [
      { id: "v-9-1", sku: "JX-BG-104-BRN", size: "Standard Compact", color: "Coffee Brown", stock: 15, costPrice: 1100 },
      { id: "v-9-2", sku: "JX-BG-104-BLK", size: "Standard Compact", color: "Matte Black", stock: 13, costPrice: 1100 }
    ],
    isFeatured: false,
    rating: 4.8,
    createdAt: "2026-09-29T10:00:00Z"
  },
  {
    id: "prod-10",
    sku: "JX-SH-006",
    barcode: "890100100601",
    name: "Casual Slip-On Comfort Loafers",
    slug: "casual-slip-on-comfort-loafers",
    description: "দৈনন্দিন ব্যবহারের জন্য হালকা স্লিপ-অন লোফার। নরম চামড়া ও কুশন প্যাডিং যা দীর্ঘক্ষণ পরলেও পায়ে কোনো ক্লান্তি দেয় না।",
    price: 2950,
    costPrice: 1850,
    originalPrice: 3500,
    category: "shoes",
    subCategory: "লোফার (Loafers)",
    sizes: ["39", "40", "41", "42", "43", "44"],
    colors: [
      { name: "Navy Blue", hex: "#1e3a8a" },
      { name: "Mocha Brown", hex: "#5c3317" }
    ],
    images: [
      "https://images.unsplash.com/photo-1560343090-f0409e92791a?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 19,
    minStockAlert: 4,
    supplier: "এপেক্স ফুটওয়্যার লিমিটেড",
    variants: [
      { id: "v-10-1", sku: "JX-SH-006-40-NAV", size: "40", color: "Navy Blue", stock: 8, costPrice: 1850 },
      { id: "v-10-2", sku: "JX-SH-006-42-BRN", size: "42", color: "Mocha Brown", stock: 11, costPrice: 1850 }
    ],
    isFeatured: false,
    rating: 4.7,
    createdAt: "2026-09-30T10:00:00Z"
  },
  {
    id: "prod-11",
    sku: "JX-BG-105",
    barcode: "890100200501",
    name: "Luxury Ladies Structured Leather Tote",
    slug: "luxury-ladies-structured-leather-tote",
    description: "অভিজাত মহিলাদের জন্য প্রিমিয়াম লেদার টোট ব্যাগ। অফিস, ভার্সিটি বা পার্টিতে স্টাইলিশ লুক দেয় এবং প্রচুর স্পেস রয়েছে।",
    price: 3600,
    costPrice: 2200,
    originalPrice: 4400,
    category: "bags",
    subCategory: "হ্যান্ডব্যাগ ও টোট (Handbags)",
    sizes: ["Spacious Tote"],
    colors: [
      { name: "Burgundy Red", hex: "#831843" },
      { name: "Warm Tan", hex: "#b45309" },
      { name: "Classic Black", hex: "#0f172a" }
    ],
    images: [
      "https://images.unsplash.com/photo-1584917865442-de89df76afd3?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1590874103328-eac38a683ce7?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 14,
    minStockAlert: 3,
    supplier: "প্রিমিয়াম লেদার ক্রাফট",
    variants: [
      { id: "v-11-1", sku: "JX-BG-105-RED", size: "Spacious Tote", color: "Burgundy Red", stock: 4, costPrice: 2200 },
      { id: "v-11-2", sku: "JX-BG-105-TAN", size: "Spacious Tote", color: "Warm Tan", stock: 6, costPrice: 2200 },
      { id: "v-11-3", sku: "JX-BG-105-BLK", size: "Spacious Tote", color: "Classic Black", stock: 4, costPrice: 2200 }
    ],
    isFeatured: true,
    rating: 4.9,
    createdAt: "2026-10-01T08:00:00Z"
  },
  {
    id: "prod-12",
    sku: "JX-SH-007",
    barcode: "890100100701",
    name: "All-Terrain Outdoor Hiking Boots",
    slug: "all-terrain-outdoor-hiking-boots",
    description: "সব ধরণের রাস্তা ও ভ্রমণের জন্য হেভি-ডিউটি হাইকিং বুট। গ্রিপ আউটসোল এবং ওয়াটারপ্রুফ মেম্ব্রেন প্রযুক্তি।",
    price: 4800,
    costPrice: 3000,
    originalPrice: 5600,
    category: "shoes",
    subCategory: "বুট জুতা (Boots)",
    sizes: ["40", "41", "42", "43", "44", "45"],
    colors: [
      { name: "Desert Sand", hex: "#d97706" },
      { name: "Olive Earth", hex: "#3f6212" }
    ],
    images: [
      "https://images.unsplash.com/photo-1520639888713-7851133b1ed0?auto=format&fit=crop&q=80&w=800",
      "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&q=80&w=800"
    ],
    inStock: true,
    stockCount: 12,
    minStockAlert: 4,
    supplier: "সাভার ফুটওয়্যার ইন্ডাস্ট্রিজ",
    variants: [
      { id: "v-12-1", sku: "JX-SH-007-41-SND", size: "41", color: "Desert Sand", stock: 5, costPrice: 3000 },
      { id: "v-12-2", sku: "JX-SH-007-42-OLV", size: "42", color: "Olive Earth", stock: 7, costPrice: 3000 }
    ],
    isFeatured: false,
    rating: 4.8,
    createdAt: "2026-10-01T09:00:00Z"
  }
];

export const initialOrders: Order[] = [
  {
    id: "ord-101",
    orderNumber: "JX-9082",
    customerName: "Md. Tanvir Ahmed",
    phone: "01712345678",
    address: "House 24, Road 7, Dhanmondi, Dhaka",
    city: "Inside Dhaka",
    paymentMethod: "Cash on Delivery",
    items: [
      {
        productId: "prod-1",
        name: "Classic Italian Leather Loafers",
        price: 3850,
        quantity: 1,
        selectedSize: "42",
        selectedColor: "Deep Brown",
        image: "https://images.unsplash.com/photo-1533867617858-e7b97e060509?auto=format&fit=crop&q=80&w=800"
      }
    ],
    subtotal: 3850,
    deliveryFee: 60,
    total: 3910,
    status: "Processing",
    createdAt: "2026-10-01T09:30:00Z"
  },
  {
    id: "ord-102",
    orderNumber: "JX-9083",
    customerName: "Farhana Yasmin",
    phone: "01987654321",
    address: "GEC Circle, Nasirabad, Chattogram",
    city: "Outside Dhaka",
    paymentMethod: "bKash / Nagad",
    bkashTrxId: "BK9X7712QW",
    items: [
      {
        productId: "prod-3",
        name: "Executive Leather Laptop Briefcase",
        price: 4950,
        quantity: 1,
        selectedSize: "15.6 Inch Standard",
        selectedColor: "Vintage Tan",
        image: "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?auto=format&fit=crop&q=80&w=800"
      }
    ],
    subtotal: 4950,
    deliveryFee: 120,
    total: 5070,
    status: "Pending",
    createdAt: "2026-10-01T11:15:00Z"
  },
  {
    id: "ord-103",
    orderNumber: "JX-9084",
    customerName: "Ashikur Rahman",
    phone: "01819998877",
    address: "Sector 4, Uttara, Dhaka",
    city: "Inside Dhaka",
    paymentMethod: "Cash on Delivery",
    items: [
      {
        productId: "prod-2",
        name: "Apex Air Mesh Running Sneakers",
        price: 2650,
        quantity: 1,
        selectedSize: "41",
        selectedColor: "Pure White",
        image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?auto=format&fit=crop&q=80&w=800"
      },
      {
        productId: "prod-6",
        name: "Urban Minimalist Laptop Backpack",
        price: 2450,
        quantity: 1,
        selectedSize: "22 Litre Standard",
        selectedColor: "Matte Black",
        image: "https://images.unsplash.com/photo-1622560480605-d83c853bc5c3?auto=format&fit=crop&q=80&w=800"
      }
    ],
    subtotal: 5100,
    deliveryFee: 60,
    total: 5160,
    status: "Shipped",
    createdAt: "2026-10-01T14:20:00Z"
  },
  {
    id: "ord-104",
    orderNumber: "JX-9085",
    customerName: "Zubair Hasan",
    phone: "01611223344",
    address: "Zindabazar, Sylhet Sadar, Sylhet",
    city: "Outside Dhaka",
    paymentMethod: "Cash on Delivery",
    items: [
      {
        productId: "prod-5",
        name: "Heritage Chelsea Leather Boots",
        price: 4500,
        quantity: 1,
        selectedSize: "43",
        selectedColor: "Dark Walnut",
        image: "https://images.unsplash.com/photo-1638247025967-b4e38f787b76?auto=format&fit=crop&q=80&w=800"
      }
    ],
    subtotal: 4500,
    deliveryFee: 120,
    total: 4620,
    status: "Delivered",
    createdAt: "2026-09-30T16:00:00Z"
  }
];

export const initialInventoryMovements: InventoryMovement[] = [
  {
    id: "mov-1",
    productId: "prod-1",
    productName: "Classic Italian Leather Loafers",
    sku: "JX-SH-001",
    variantInfo: "সাইজ: 42, কালার: Deep Brown",
    type: "RESTOCK",
    quantity: 30,
    previousStock: 4,
    newStock: 34,
    unitCost: 2450,
    supplierOrInvoice: "চালান #CH-2026-88 (হাজারীবাগ প্রিমিয়াম লেদার)",
    note: "নতুন শীতের প্রিমিয়াম লোফার স্টক ইন",
    createdAt: "2026-09-28T14:30:00Z"
  },
  {
    id: "mov-2",
    productId: "prod-2",
    productName: "Apex Air Mesh Running Sneakers",
    sku: "JX-SH-002",
    variantInfo: "সাইজ: 41, কালার: Midnight Black",
    type: "SALE",
    quantity: -1,
    previousStock: 43,
    newStock: 42,
    unitCost: 1650,
    supplierOrInvoice: "অনলাইন অর্ডার #JX-9082",
    note: "অনলাইন চেকআউট থেকে বিক্রয়",
    createdAt: "2026-09-29T11:20:00Z"
  },
  {
    id: "mov-3",
    productId: "prod-3",
    productName: "Executive Leather Laptop Briefcase",
    sku: "JX-BG-101",
    variantInfo: "সাইজ: 15.6 Inch Standard, কালার: Vintage Tan",
    type: "RESTOCK",
    quantity: 15,
    previousStock: 0,
    newStock: 15,
    unitCost: 3100,
    supplierOrInvoice: "চালান #CH-2026-92 (বেঙ্গল লেদার গুডস)",
    note: "নতুন অফিস ব্রিফকেস লট ইন",
    createdAt: "2026-09-29T16:45:00Z"
  },
  {
    id: "mov-4",
    productId: "prod-5",
    productName: "Heritage Chelsea Leather Boots",
    sku: "JX-SH-003",
    variantInfo: "সাইজ: 43, কালার: Dark Walnut",
    type: "ADJUSTMENT",
    quantity: -1,
    previousStock: 19,
    newStock: 18,
    unitCost: 2850,
    supplierOrInvoice: "শোরুম স্টক ভেরিফিকেশন",
    note: "ডিসপ্লে কাউন্টারে প্রদর্শনের জন্য সরানো হয়েছে",
    createdAt: "2026-09-30T10:15:00Z"
  },
  {
    id: "mov-5",
    productId: "prod-6",
    productName: "Urban Minimalist Laptop Backpack",
    sku: "JX-BG-103",
    variantInfo: "সাইজ: 22 Litre Standard, কালার: Matte Black",
    type: "RESTOCK",
    quantity: 35,
    previousStock: 0,
    newStock: 35,
    unitCost: 1550,
    supplierOrInvoice: "চালান #CH-2026-98 (ঢাকা টেক্সটাইল ব্যাগ)",
    note: "নতুন ব্যাকপ্যাক শিপমেন্ট রিসিভড",
    createdAt: "2026-10-01T09:30:00Z"
  }
];

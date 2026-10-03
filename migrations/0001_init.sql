-- ============================================================
-- JxShoes Shopkeeper — D1 migration 0001: initial schema
-- উৎস: docs/DB_SCHEMA.md §৫ (মালিক-অনুমোদিত খসড়া) — হুবহু DDL
-- প্রয়োগ: wrangler d1 execute <DB_NAME> --file=migrations/0001_init.sql --remote
--   (লোকাল টেস্টে: --local)
-- নিয়ম: id TEXT (ULID), প্রতি টেবিলে tenant_id/created_at/updated_at/deleted_at/version,
--   টাকা INTEGER পয়শায় (_p সাফিক্স), লেজার-টেবিল append-only, ক্যাশড ব্যালেন্স += delta
-- ============================================================

PRAGMA foreign_keys = ON;

-- ---------- ৫.১ টেনান্ট / আউটলেট / ইউজার / ডিভাইস ----------
CREATE TABLE tenants (
  id            TEXT PRIMARY KEY,              -- ULID
  name          TEXT NOT NULL,                 -- দোকান/ব্যবসার নাম
  slug          TEXT NOT NULL,                 -- URL/কোড শনাক্তকারী
  plan          TEXT NOT NULL DEFAULT 'single',
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_tenants_slug ON tenants(slug) WHERE deleted_at IS NULL;

CREATE TABLE outlets (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  code          TEXT NOT NULL,                 -- শর্ট কোড, যেমন 'MAIN'
  name          TEXT NOT NULL,
  address       TEXT,
  phone         TEXT,
  is_default    INTEGER NOT NULL DEFAULT 0,    -- single-shop মাইগ্রেশনে ১টাই default
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_outlets_tenant_code ON outlets(tenant_id, code) WHERE deleted_at IS NULL;
CREATE INDEX ix_outlets_tenant_updated ON outlets(tenant_id, updated_at);

CREATE TABLE users (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  name          TEXT NOT NULL,
  phone         TEXT,
  email         TEXT,
  password_hash TEXT,                          -- মালিক/স্টাফ লগইন (P6)
  role          TEXT NOT NULL DEFAULT 'owner'  -- 'owner' | 'manager' | 'salesman'
                CHECK (role IN ('owner','manager','salesman')),
  outlet_id     TEXT REFERENCES outlets(id),   -- NULL = সব আউটলেট
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_users_tenant_phone ON users(tenant_id, phone) WHERE deleted_at IS NULL AND phone IS NOT NULL;
CREATE INDEX ix_users_tenant_updated ON users(tenant_id, updated_at);

-- ইনভয়েস প্রিফিক্স + ডিভাইস-লোকাল সিকোয়েন্স
CREATE TABLE devices (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  outlet_id     TEXT REFERENCES outlets(id),
  device_code   TEXT NOT NULL,                 -- প্রিফিক্স, যেমন 'D01'
  label         TEXT,                          -- 'দোকানের ট্যাব', 'হোম পিসি'
  last_seq      INTEGER NOT NULL DEFAULT 0,    -- এই ডিভাইস এখন পর্যন্ত যত নম্বর নিয়েছে
  last_seen_at  TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_devices_tenant_code ON devices(tenant_id, device_code) WHERE deleted_at IS NULL;
CREATE INDEX ix_devices_tenant_updated ON devices(tenant_id, updated_at);

-- ---------- ৫.২ ক্যাটাগরি / সাপ্লায়ার / প্রোডাক্ট / ভ্যারিয়েন্ট / ছবি ----------
CREATE TABLE categories (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  parent_type   TEXT NOT NULL DEFAULT 'shoes'
                CHECK (parent_type IN ('shoes','bags','accessories')),
  name          TEXT NOT NULL,                 -- 'লোফার (Loafers)'
  slug          TEXT NOT NULL,
  image         TEXT,
  item_count_label TEXT,                       -- বর্তমান itemCountLabel — UI ডেকোরেশন
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_categories_tenant_slug ON categories(tenant_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX ix_categories_tenant_updated ON categories(tenant_id, updated_at);

CREATE TABLE suppliers (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  name          TEXT NOT NULL,                 -- 'হাজারীবাগ প্রিমিয়াম লেদার ক্রাফট'
  phone         TEXT,
  address       TEXT,
  note          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_suppliers_tenant_updated ON suppliers(tenant_id, updated_at);

CREATE TABLE products (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  outlet_id     TEXT REFERENCES outlets(id),   -- NULL = সব আউটলেটে একই
  category_id   TEXT REFERENCES categories(id),
  sub_category  TEXT,                          -- বর্তমান free-text subCategory
  sku           TEXT NOT NULL,                 -- 'JX-SH-001'
  barcode       TEXT,                          -- '890100100101'
  name          TEXT NOT NULL,
  slug          TEXT NOT NULL,
  description   TEXT NOT NULL DEFAULT '',
  price_p       INTEGER NOT NULL CHECK (price_p >= 0),          -- খুচরা বিক্রয়মূল্য (পয়শা)
  cost_price_p  INTEGER,                                        -- ক্রয়মূল্য স্ন্যাপশট (ডিফল্ট)
  compare_at_price_p INTEGER,                                   -- বর্তমান originalPrice (কাটা দাম)
  min_stock_alert INTEGER NOT NULL DEFAULT 5,
  default_supplier_id TEXT REFERENCES suppliers(id),            -- বর্তমান free-text supplier
  is_featured   INTEGER NOT NULL DEFAULT 0,
  rating        REAL,                          -- টাকা নয় — display-only
  -- ক্যাশড ডেরাইভড ব্যালেন্স (সত্য = SUM(inventory_movements.qty_delta))
  stock_cached  INTEGER NOT NULL DEFAULT 0,    -- সব ভ্যারিয়েন্টের যোগফল; লেনদেনে += delta
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_products_tenant_sku ON products(tenant_id, sku) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_products_tenant_barcode ON products(tenant_id, barcode) WHERE deleted_at IS NULL AND barcode IS NOT NULL;
CREATE UNIQUE INDEX ux_products_tenant_slug ON products(tenant_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX ix_products_tenant_updated ON products(tenant_id, updated_at);
CREATE INDEX ix_products_tenant_featured ON products(tenant_id, is_featured) WHERE deleted_at IS NULL;

CREATE TABLE product_images (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  product_id    TEXT NOT NULL REFERENCES products(id),
  url           TEXT NOT NULL,                 -- R2 URL বা data-URI (অফলাইন আপলোড ফলব্যাক)
  position      INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_product_images_product ON product_images(product_id, position) WHERE deleted_at IS NULL;
CREATE INDEX ix_product_images_tenant_updated ON product_images(tenant_id, updated_at);

CREATE TABLE product_variants (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  product_id    TEXT NOT NULL REFERENCES products(id),
  sku           TEXT NOT NULL,                 -- 'JX-SH-001-42-BRN'
  size          TEXT NOT NULL,                 -- '42' বা '15.6 Inch Standard'
  color         TEXT NOT NULL,                 -- 'Deep Brown'
  color_hex     TEXT,
  price_p       INTEGER,                       -- NULL = প্রোডাক্টের price_p প্রযোজ্য
  cost_price_p  INTEGER,                       -- NULL = প্রোডাক্টের cost_price_p
  -- ক্যাশড ব্যালেন্স (সত্য = SUM(movements)); লেনদেনে += delta, কখনো absolute নয়
  stock_cached  INTEGER NOT NULL DEFAULT 0,    -- নেগেটিভ হতে পারে (নীতি: রেকর্ড+পতাকা+অ্যালার্ট)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_variants_tenant_sku ON product_variants(tenant_id, sku) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX ux_variants_tenant_attr ON product_variants(tenant_id, product_id, size, color) WHERE deleted_at IS NULL;
CREATE INDEX ix_variants_tenant_updated ON product_variants(tenant_id, updated_at);
CREATE INDEX ix_variants_tenant_stock ON product_variants(tenant_id, stock_cached);  -- low-stock রিপোর্ট

-- ---------- ৫.৩ কাস্টমার / বাকির খাতা (due_entries) ----------
CREATE TABLE customers (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  name          TEXT NOT NULL,
  phone         TEXT NOT NULL,                 -- আপসার্ট কি (বর্তমান অ্যাপের মতোই)
  address       TEXT,
  note          TEXT,
  -- ক্যাশড ব্যালেন্স — সত্য = SUM(due_entries) ও SUM(orders); লেনদেনে += delta
  due_cached        INTEGER NOT NULL DEFAULT 0,  -- পয়শা; ধনাত্মক = কাস্টমার বাকি দেবে; ক্ল্যাম্প নেই
  total_purchases_p INTEGER NOT NULL DEFAULT 0,  -- SUM(non-cancelled orders.total_p)
  order_count       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_customers_tenant_phone ON customers(tenant_id, phone) WHERE deleted_at IS NULL;
CREATE INDEX ix_customers_tenant_updated ON customers(tenant_id, updated_at);
CREATE INDEX ix_customers_tenant_due ON customers(tenant_id, due_cached) WHERE deleted_at IS NULL;

-- বাকির লেজার — append-only। সংশোধন = বিপরীত ধরনের এন্ট্রি (reversal)।
-- amount স্বাক্ষরিত পয়শা: +CHARGE (বাকি বাড়ল), −PAYMENT (আদায়), −REVERSAL (ভুল চার্জ স্টর্নো)।
-- সত্য: SUM(amount) প্রতি কাস্টমারে।
CREATE TABLE due_entries (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  outlet_id     TEXT REFERENCES outlets(id),
  customer_id   TEXT NOT NULL REFERENCES customers(id),
  order_id      TEXT,                          -- orders(id) — চক্র FK এড়াতে app-enforced
  entry_type    TEXT NOT NULL
                CHECK (entry_type IN ('CHARGE','PAYMENT','REVERSAL','OPENING')),
  amount        INTEGER NOT NULL,              -- স্বাক্ষরিত পয়শা; ০ নয় CHECK (amount <> 0)
  method        TEXT                           -- PAYMENT-এ: 'Cash' | 'bKash' | 'Nagad'
                CHECK (method IS NULL OR method IN ('Cash','bKash','Nagad')),
  note          TEXT,
  device_id     TEXT REFERENCES devices(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,                          -- append-only: NULL ছাড়া কখনো সেট হয় না; ভুল হলে REVERSAL
  version       INTEGER NOT NULL DEFAULT 1     -- append-only: সবসময় 1
);
CREATE INDEX ix_due_entries_tenant_updated ON due_entries(tenant_id, updated_at);
CREATE INDEX ix_due_entries_customer ON due_entries(customer_id, created_at) WHERE deleted_at IS NULL;

-- ---------- ৫.৪ অর্ডার / আইটেম / স্ট্যাটাস / পেমেন্ট ----------
CREATE TABLE orders (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  outlet_id     TEXT REFERENCES outlets(id),
  order_number  TEXT NOT NULL,                 -- 'D01-000123'
  source        TEXT NOT NULL DEFAULT 'online' CHECK (source IN ('online','in-store')),
  customer_id   TEXT REFERENCES customers(id), -- অজানা ওয়াক-ইন হলে NULL
  customer_name TEXT NOT NULL,                 -- স্ন্যাপশট — কাস্টমার রেকর্ড বদলালেও অর্ডার অপরিবর্তিত
  customer_phone TEXT NOT NULL DEFAULT '',
  shipping_address TEXT NOT NULL DEFAULT '',
  shipping_zone TEXT NOT NULL DEFAULT 'inside_dhaka' CHECK (shipping_zone IN ('inside_dhaka','outside_dhaka')),
  -- অর্থ (পয়শা, স্ন্যাপশট — append-only অর্থে অপরিবর্তনীয়)
  subtotal_p    INTEGER NOT NULL DEFAULT 0,
  discount_p    INTEGER NOT NULL DEFAULT 0,
  delivery_fee_p INTEGER NOT NULL DEFAULT 0,
  total_p       INTEGER NOT NULL DEFAULT 0,    -- subtotal - discount + delivery_fee (app CHECK)
  paid_amount_p INTEGER NOT NULL DEFAULT 0,    -- এখন পর্যন্ত আদায় (payments-এর SUM-এর ক্যাশ)
  due_amount_p  INTEGER NOT NULL DEFAULT 0,    -- total - paid; due_entries.CHARGE-এর ক্যাশ
  coupon_id     TEXT REFERENCES coupons(id),
  coupon_code   TEXT,                          -- স্ন্যাপশট
  payment_method TEXT NOT NULL DEFAULT 'cod'
                CHECK (payment_method IN ('cod','bkash','nagad')),
  -- ক্যাশড চলমান স্ট্যাটাস (সত্য = order_status_events-এর সর্বশেষ)
  status        TEXT NOT NULL DEFAULT 'Pending'
                CHECK (status IN ('Pending','Processing','Shipped','Delivered','Cancelled')),
  delivered_at  TEXT,
  note          TEXT,                          -- কাস্টমারের নোট
  admin_note    TEXT,                          -- অ্যাডমিন নোট — mutable, version++ হয়
  device_id     TEXT REFERENCES devices(id),
  reverses_order_id TEXT REFERENCES orders(id),-- রিভার্সাল/করেকশন অর্ডার মূলটাকে নির্দেশ করে
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_orders_tenant_number ON orders(tenant_id, order_number) WHERE deleted_at IS NULL;
CREATE INDEX ix_orders_tenant_updated ON orders(tenant_id, updated_at);
CREATE INDEX ix_orders_tenant_status ON orders(tenant_id, status, created_at) WHERE deleted_at IS NULL;
CREATE INDEX ix_orders_tenant_customer ON orders(tenant_id, customer_id) WHERE customer_id IS NOT NULL;

CREATE TABLE order_items (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  order_id      TEXT NOT NULL REFERENCES orders(id),
  product_id    TEXT REFERENCES products(id),  -- NULL = ডিলিট হওয়া প্রোডাক্টের লাইনও টিকে থাকে
  variant_id    TEXT REFERENCES product_variants(id),
  name          TEXT NOT NULL,                 -- স্ন্যাপশট
  sku           TEXT,
  size          TEXT NOT NULL DEFAULT 'Standard',
  color         TEXT,
  image         TEXT,                          -- স্ন্যাপশট
  unit_price_p  INTEGER NOT NULL CHECK (unit_price_p >= 0),
  unit_cost_p   INTEGER,                       -- বিক্রির মুহূর্তের ক্রয়মূল্য স্ন্যাপশট (লাভ-ক্ষতি)
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  line_total_p  INTEGER NOT NULL,              -- unit_price_p * quantity
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_order_items_order ON order_items(order_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_order_items_tenant_updated ON order_items(tenant_id, updated_at);
CREATE INDEX ix_order_items_tenant_product ON order_items(tenant_id, product_id, created_at);

-- স্ট্যাটাস পরিবর্তনের append-only ট্রেইল — orders.status শুধু ক্যাশড বর্তমান মান
CREATE TABLE order_status_events (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  order_id      TEXT NOT NULL REFERENCES orders(id),
  from_status   TEXT,
  to_status     TEXT NOT NULL,
  actor_user_id TEXT REFERENCES users(id),
  device_id     TEXT REFERENCES devices(id),
  note          TEXT,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_ose_order ON order_status_events(order_id, created_at);
CREATE INDEX ix_ose_tenant_updated ON order_status_events(tenant_id, updated_at);

CREATE TABLE payments (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  outlet_id     TEXT REFERENCES outlets(id),
  order_id      TEXT REFERENCES orders(id),    -- NULL হলে due_entries-এর সাথে জোড়া
  due_entry_id  TEXT REFERENCES due_entries(id),-- বাকি আদায়ের পেমেন্ট → due_entry-এর রসিদ
  customer_id   TEXT REFERENCES customers(id),
  amount_p      INTEGER NOT NULL CHECK (amount_p > 0),
  method        TEXT NOT NULL DEFAULT 'Cash' CHECK (method IN ('Cash','bKash','Nagad','COD')),
  reference     TEXT,                          -- বর্তমান bkashTrxId
  note          TEXT,
  device_id     TEXT REFERENCES devices(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_payments_tenant_updated ON payments(tenant_id, updated_at);
CREATE INDEX ix_payments_order ON payments(order_id) WHERE deleted_at IS NULL;
CREATE INDEX ix_payments_tenant_method_day ON payments(tenant_id, method, created_at) WHERE deleted_at IS NULL;

-- ---------- ৫.৫ ইনভেন্টরি মুভমেন্ট / পারচেস ----------
-- স্টকের লেজার — append-only। সত্য: SUM(qty_delta) প্রতি ভ্যারিয়েন্ট/প্রোডাক্টে।
CREATE TABLE inventory_movements (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  outlet_id     TEXT REFERENCES outlets(id),
  product_id    TEXT NOT NULL REFERENCES products(id),
  variant_id    TEXT REFERENCES product_variants(id),   -- NULL = প্রোডাক্ট-লেভেল (ভ্যারিয়েন্টহীন)
  movement_type TEXT NOT NULL
                CHECK (movement_type IN ('RESTOCK','SALE','DAMAGE','RETURN','ADJUSTMENT','REVERSAL')),
  qty_delta     INTEGER NOT NULL CHECK (qty_delta <> 0), -- +এ ঢুকল, −বের হলো
  unit_cost_p   INTEGER,                                 -- মুভমেন্ট মুহূর্তের ক্রয়মূল্য
  -- তথ্যগত স্ন্যাপশট — লেজারের সত্য এগুলো নয়, SUM(qty_delta)
  prev_stock_snapshot INTEGER,
  new_stock_snapshot  INTEGER,
  is_negative_stock INTEGER NOT NULL DEFAULT 0,          -- ১ = এই মুভমেন্টের পরে ক্যাশ < 0
  supplier_id   TEXT REFERENCES suppliers(id),
  ref_text      TEXT,                          -- বর্তমান supplierOrInvoice: 'চালান #CH-2026-88…'
  purchase_id   TEXT,                          -- purchases(id) — app-enforced FK
  order_id      TEXT,                          -- orders(id) — SALE-এর উৎস
  note          TEXT,
  device_id     TEXT REFERENCES devices(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_inv_mov_tenant_updated ON inventory_movements(tenant_id, updated_at);
CREATE INDEX ix_inv_mov_variant ON inventory_movements(variant_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX ix_inv_mov_product ON inventory_movements(product_id, created_at) WHERE deleted_at IS NULL;
CREATE INDEX ix_inv_mov_negative ON inventory_movements(tenant_id, is_negative_stock) WHERE is_negative_stock = 1;

CREATE TABLE purchases (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  outlet_id     TEXT REFERENCES outlets(id),
  supplier_id   TEXT REFERENCES suppliers(id),
  invoice_no    TEXT,                          -- সাপ্লায়ারের চালান নম্বর
  total_p       INTEGER NOT NULL DEFAULT 0,
  paid_amount_p INTEGER NOT NULL DEFAULT 0,    -- সাপ্লায়ার-দেনাও ভবিষ্যতে due-স্টাইলে হতে পারে
  status        TEXT NOT NULL DEFAULT 'received' CHECK (status IN ('draft','received','cancelled')),
  note          TEXT,
  device_id     TEXT REFERENCES devices(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_purchases_tenant_updated ON purchases(tenant_id, updated_at);
CREATE INDEX ix_purchases_supplier ON purchases(tenant_id, supplier_id) WHERE deleted_at IS NULL;

CREATE TABLE purchase_items (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  purchase_id   TEXT NOT NULL REFERENCES purchases(id),
  product_id    TEXT NOT NULL REFERENCES products(id),
  variant_id    TEXT REFERENCES product_variants(id),
  quantity      INTEGER NOT NULL CHECK (quantity > 0),
  unit_cost_p   INTEGER NOT NULL CHECK (unit_cost_p >= 0),
  line_total_p  INTEGER NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_purchase_items_purchase ON purchase_items(purchase_id);
CREATE INDEX ix_purchase_items_tenant_updated ON purchase_items(tenant_id, updated_at);

-- ---------- ৫.৬ খরচ / কুপন / সেটিংস ----------
CREATE TABLE expenses (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  outlet_id     TEXT REFERENCES outlets(id),
  category      TEXT NOT NULL DEFAULT 'অন্যান্য',  -- বর্তমান free-text
  amount_p      INTEGER NOT NULL CHECK (amount_p > 0),
  note          TEXT,
  spent_at      TEXT NOT NULL,               -- খরচটা যে দিনের (রিপোর্টিং); created_at হলো এন্ট্রির সময়
  device_id     TEXT REFERENCES devices(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_expenses_tenant_updated ON expenses(tenant_id, updated_at);
CREATE INDEX ix_expenses_tenant_day ON expenses(tenant_id, spent_at) WHERE deleted_at IS NULL;

CREATE TABLE coupons (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  code          TEXT NOT NULL,                 -- 'NEW100' (UPPERCASE, বর্তমান আচরণ)
  discount_type TEXT NOT NULL DEFAULT 'fixed' CHECK (discount_type IN ('percentage','fixed')),
  value         INTEGER NOT NULL,              -- fixed → পয়শা; percentage → পূর্ণ সংখ্যা (১০ = ১০%)
  min_order_p   INTEGER NOT NULL DEFAULT 0,
  active        INTEGER NOT NULL DEFAULT 1,
  starts_at     TEXT,
  ends_at       TEXT,                          -- বর্তমান অ্যাপে মেয়াদ নেই — ভবিষ্যতের জন্য
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_coupons_tenant_code ON coupons(tenant_id, code) WHERE deleted_at IS NULL;
CREATE INDEX ix_coupons_tenant_updated ON coupons(tenant_id, updated_at);

-- সেটিংস = প্রতি টেনান্টে key-value (StoreSettings, HeroBannerSettings, FlashDealSettings একই টেবিলে)
CREATE TABLE settings (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  key           TEXT NOT NULL,                 -- 'storeSettings' | 'heroBanner' | 'flashDeal'
  value_json    TEXT NOT NULL,                 -- সম্পূর্ণ নেস্টেড অবজেক্ট JSON হিসেবে
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_settings_tenant_key ON settings(tenant_id, key) WHERE deleted_at IS NULL;

-- ---------- ৫.৭ নোটিফিকেশন / ফিডব্যাক / মিডিয়া / AI ----------
CREATE TABLE notifications (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  type          TEXT NOT NULL DEFAULT 'feedback' CHECK (type IN ('order','complaint','feedback','ai')),
  title         TEXT NOT NULL,
  message       TEXT NOT NULL,
  is_read       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_notifications_tenant_updated ON notifications(tenant_id, updated_at);
CREATE INDEX ix_notifications_tenant_unread ON notifications(tenant_id, is_read) WHERE deleted_at IS NULL;

-- বর্তমানে /api/feedback মেসেজটাকে নোটিফিকেশনের টেক্সটে গুঁজে দেয় — এখানে structured
CREATE TABLE feedback (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  kind          TEXT NOT NULL DEFAULT 'feedback' CHECK (kind IN ('feedback','complaint')),
  name          TEXT,
  phone         TEXT,
  message       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new','seen','resolved')),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_feedback_tenant_updated ON feedback(tenant_id, updated_at);

CREATE TABLE media_assets (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  url           TEXT NOT NULL,                 -- R2 URL; অফলাইন data-URI হলে kind='data_uri'
  kind          TEXT NOT NULL DEFAULT 'image' CHECK (kind IN ('image','data_uri','other')),
  bytes         INTEGER,
  uploaded_by   TEXT REFERENCES users(id),
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_media_tenant_updated ON media_assets(tenant_id, updated_at);

-- AI আর্টিফ্যাক্ট: StoredReport / AIInsights / AIDailyBrief — payload JSON হিসেবে
CREATE TABLE ai_artifacts (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  kind          TEXT NOT NULL CHECK (kind IN ('report','insight','daily_brief')),
  payload_json  TEXT NOT NULL,
  period_start  TEXT,                          -- report: periodStart; brief: date
  period_end    TEXT,
  emailed_to    TEXT,                          -- StoredReport.emailedTo
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_ai_artifacts_tenant_kind ON ai_artifacts(tenant_id, kind, created_at) WHERE deleted_at IS NULL;

-- ---------- ৫.৮ অডিট / আইডেম্পোটেন্সি / চেঞ্জ-লগ (সিঙ্ক) ----------
CREATE TABLE audit_log (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  actor_user_id TEXT REFERENCES users(id),
  actor_device_id TEXT REFERENCES devices(id),
  entity        TEXT NOT NULL,                 -- 'orders' | 'products' | ...
  entity_id     TEXT NOT NULL,
  action        TEXT NOT NULL,                 -- 'create' | 'update' | 'delete' | 'reversal' | ...
  diff_json     TEXT,                          -- কী কী বদলালো (আগে/পরে সারসংক্ষেপ)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_audit_tenant_updated ON audit_log(tenant_id, updated_at);
CREATE INDEX ix_audit_entity ON audit_log(tenant_id, entity, entity_id);

-- অফলাইন আউটবক্স রিপ্লে-এর ডাবল-সাবমিশন সুরক্ষা
CREATE TABLE idempotency_keys (
  id            TEXT PRIMARY KEY,
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  op_key        TEXT NOT NULL,                 -- ক্লায়েন্ট জেনারেটেড (ULID) — আউটবক্স অপের সাথে জন্মগতভাবে যুক্ত
  entity        TEXT NOT NULL,
  request_hash  TEXT,
  result_ref    TEXT,                          -- সফল হলে তৈরি হওয়া রেকর্ডের id
  status        TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','done','failed')),
  expires_at    TEXT,                          -- পুরনো কি-এর রিটেনশন
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE UNIQUE INDEX ux_idem_tenant_op ON idempotency_keys(tenant_id, op_key);

-- সিঙ্ক পুলের একক ধারাবাহিক স্ট্রিম: ক্লায়েন্ট শেষ cursor থেকে ডেল্টা টানে
CREATE TABLE change_log (
  id            TEXT PRIMARY KEY,              -- ULID → লেক্সিকোগ্রাফিক = কালানুক্রমিক
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  entity        TEXT NOT NULL,
  entity_id     TEXT NOT NULL,
  op            TEXT NOT NULL CHECK (op IN ('insert','update','delete')),
  row_version   INTEGER NOT NULL,              -- মিউটেটেড রো-এর version
  device_id     TEXT REFERENCES devices(id),
  changed_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_change_log_tenant_seq ON change_log(tenant_id, id);       -- কার্সর-ভিত্তিক ডেল্টা পুল
CREATE INDEX ix_change_log_tenant_entity ON change_log(tenant_id, entity, changed_at);

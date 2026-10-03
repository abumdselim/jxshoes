-- ============================================================
-- JxShoes Shopkeeper — D1 migration 0003: sessions (P6)
-- বর্তমান অবস্থা: `users` (password_hash + role) ও `audit_log` টেবিল
--   migrations/0001_init.sql-এই আছে — এই রাউন্ডে শুধু সেশন-স্টোর দরকার।
-- নিয়ম: id TEXT, প্রতি টেবিলে tenant_id/created_at/updated_at/deleted_at/version
-- প্রয়োগ: wrangler d1 execute <DB_NAME> --file=migrations/0003_users_sessions.sql --remote
-- ============================================================

PRAGMA foreign_keys = ON;

-- সার্ভার-সাইড সেশন রেকর্ড (P6) — কুকিতে শুধু সাইন-করা র‍্যান্ডম টোকেন যায়,
-- ডেটাবেসে টোকেন নয়, শুধু তার SHA-256 হ্যাশ। রিভোক = revoked_at সেট।
CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,              -- সেশন-আইডি (টোকেনের প্রথম অংশ)
  tenant_id     TEXT NOT NULL REFERENCES tenants(id),
  user_id       TEXT NOT NULL REFERENCES users(id),
  token_hash    TEXT NOT NULL,                 -- SHA-256('<id>.<random>') — টোকেন নিজে কখনো সেভ হয় না
  device_label  TEXT,                          -- user-agent / ডিভাইস-নোট (ডিভাইস তালিকার জন্য)
  ip            TEXT,                          -- শেষ লগইনের IP (তথ্যগত)
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,                 -- মেয়াদ (ISO) — ডিফল্ট ৩০ দিন, legacy-র সমান
  revoked_at    TEXT,                          -- লগআউট / 'সব ডিভাইস থেকে লগআউট'
  last_used_at  TEXT,
  deleted_at    TEXT,
  version       INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX ix_sessions_user ON sessions(user_id, expires_at);
CREATE INDEX ix_sessions_tenant_expiry ON sessions(tenant_id, expires_at);

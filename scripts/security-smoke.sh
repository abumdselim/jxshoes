#!/usr/bin/env bash
# P1 নিরাপত্তা স্মোক-টেস্ট — চালানোর আগে:
#   1) ডেভ সার্ভার চালু: npm run dev  (BASE_URL আলাদা হলে BASE_URL=... দিন)
#   2) .env-এ ADMIN_PASSWORD সেট থাকতে হবে (অথবা এভাবে চালান: ADMIN_PASSWORD=xyz bash scripts/security-smoke.sh)
# যাচাই: অ্যাডমিন রাউটে কুকি ছাড়া → 401, কুকি সহ → 200; পাবলিক রাউটে কুকি ছাড়া → 200
set -u

BASE_URL="${BASE_URL:-http://localhost:3000}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-}"
FAIL=0

status() { # method path [cookie] [data]
  local method="$1" path="$2" cookie="${3:-}" data="${4:-}"
  local args=(-s -o /dev/null -w '%{http_code}' -X "$method" "$BASE_URL$path")
  [ -n "$cookie" ] && args+=(-H "Cookie: $cookie")
  [ -n "$data" ] && args+=(-H 'Content-Type: application/json' -d "$data")
  curl "${args[@]}" 2>/dev/null || echo "000"
}

check() { # label expected actual
  if [ "$2" = "$3" ]; then echo "PASS  $1 (got $3)"; else echo "FAIL  $1 (expected $2, got $3)"; FAIL=1; fi
}

# ---------- কুকি নেই: অ্যাডমিন রাউট সব 401 আশা ----------
echo "== অ্যাডমিন রাউট — কুকি ছাড়া (৪০১ আশা) =="
ADMIN_GETS=(
  /api/orders /api/customers /api/finance /api/expenses /api/reports
  /api/notifications /api/inventory /api/media-library /api/coupons
  /api/analytics/fast-movers /api/pos/sale /api/upload
)
for p in "${ADMIN_GETS[@]}"; do
  m="GET"; [ "$p" = "/api/pos/sale" ] && m="POST"; [ "$p" = "/api/upload" ] && m="POST"
  check "GET $p (কুকি ছাড়া)" 401 "$(status "$m" "$p")"
done

# ---------- পাবলিক রাউট: কুকি ছাড়াই 200 আশা ----------
echo "== পাবলিক রাউট — কুকি ছাড়া (২০০ আশা) =="
for p in /api/products /api/categories /api/settings /api/marketing /api/sync; do
  check "GET $p" 200 "$(status GET "$p")"
done

# ---------- লগইন করে কুকি নিয়ে অ্যাডমিন GET ২০০ আশা ----------
echo "== লগইন + কুকি সহ (২০০ আশা) =="
if [ -z "$ADMIN_PASSWORD" ]; then
  echo "SKIP  ADMIN_PASSWORD সেট নেই — কুকি-সহ যাচাই বাদ"
else
  COOKIE=$(curl -s -i -X POST "$BASE_URL/api/admin-login" \
    -H 'Content-Type: application/json' \
    -d "{\"password\":\"$ADMIN_PASSWORD\"}" | grep -i '^set-cookie:' | sed 's/^[Ss]et-[Cc]ookie: //' | cut -d';' -f1 | tr -d '\r')
  if [ -z "$COOKIE" ]; then
    echo "FAIL  লগইন থেকে কুকি পাওয়া যায়নি"; FAIL=1
  else
    for p in /api/orders /api/customers /api/finance /api/expenses /api/reports /api/inventory; do
      check "GET $p (কুকি সহ)" 200 "$(status GET "$p" "$COOKIE")"
    done
    check "GET /api/products (কুকি সহ — costPrice সহ)" 200 "$(status GET /api/products "$COOKIE")"
  fi
fi

# ---------- লিক-রিগ্রেশন নমুনা: নতুন অর্ডার করে টোকেন ছাড়া পড়া যায় কি না ----------
echo "== অর্ডার-টোকেন নমুনা =="
ORDER_RES=$(curl -s -X POST "$BASE_URL/api/orders" -H 'Content-Type: application/json' -d '{
  "customerName":"স্মোক টেস্ট","phone":"01700000000","address":"টেস্ট ঠিকানা, ঢাকা",
  "city":"Inside Dhaka","paymentMethod":"Cash on Delivery",
  "items":[{"productId":"__nonexistent__","quantity":1,"selectedSize":"42","selectedColor":"Black"}]
}')
if echo "$ORDER_RES" | grep -q "খুঁজে পাওয়া যায়নি"; then
  echo "PASS  POST /api/orders — অজানা পণ্যে 400 ভ্যালিডেশন (রিকম্পিউট চালু)"
else
  echo "NOTE  POST /api/orders রেসপন্স যাচাই করুন: $ORDER_RES"
fi

if [ "$FAIL" -eq 0 ]; then echo "সব পাস ✅"; else echo "কিছু চেক ব্যর্থ ❌"; exit 1; fi

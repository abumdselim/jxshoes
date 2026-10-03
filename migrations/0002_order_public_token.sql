-- 0002: orders.public_token — P1-এর অনুমান-অযোগ্য টোকেন (order-success পেজ) D1-পাথেও
ALTER TABLE orders ADD COLUMN public_token TEXT;

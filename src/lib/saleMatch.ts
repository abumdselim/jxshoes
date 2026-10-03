/**
 * ভয়েস/টেক্সট মেসেজ থেকে পণ্য শনাক্তকরণ (P2 — ai/route.ts থেকে সরানো পিওর ফাংশন;
 * আচরণ অপরিবর্তিত) — বাংলা সংখ্যা রূপান্তর + SKU/বারকোড/সাইজ/কালার/পরিমাণ ম্যাচিং।
 */
import type { AISaleMatch, Product } from '@/types';

export function bnToEnDigits(s: string): string {
  const bn = '০১২৩৪৫৬৭৮৯';
  return s.replace(/[০-৯]/g, d => String(bn.indexOf(d)));
}

export function deterministicMatch(message: string, products: Product[]): AISaleMatch | null {
  const norm = bnToEnDigits(message.toUpperCase()).trim();

  // ১) SKU / বারকোড দিয়ে সরাসরি ম্যাচ
  const prod = products.find(p => {
    const sku = (p.sku || '').toUpperCase();
    const barcode = (p.barcode || '').toUpperCase();
    return (
      (sku && norm.includes(sku)) ||
      (barcode && barcode.length >= 5 && norm.includes(barcode)) ||
      (p.variants || []).some(v => v.sku && norm.includes(v.sku.toUpperCase()))
    );
  });
  if (!prod) return null;

  // কোড অংশটা বাদ দিয়ে বাকি লেখায় সাইজ/কালার/পরিমাণ খোঁজা
  const rest = norm
    .replace((prod.sku || '§').toUpperCase(), ' ')
    .replace((prod.barcode || '§').toUpperCase(), ' ')
    .replace(/[x×]/g, ' ');

  let quantity = 1;
  const qtyMatch = rest.match(/(\d{1,3})\s*(?:টি|টা|পিস|PCS|PIECE)/);
  if (qtyMatch) {
    quantity = Math.max(1, parseInt(qtyMatch[1], 10));
  } else {
    const xMatch = message.match(/(?:x|×)\s*(\d{1,3})\b/i);
    if (xMatch) quantity = Math.max(1, parseInt(xMatch[1], 10));
  }

  let size: string | undefined;
  const sizeToken = rest
    .split(/[\s,\-_/]+/)
    .find(t => /^\d{1,2}$/.test(t) && prod.sizes.some(s => s === t));
  if (sizeToken) size = sizeToken;

  let color: string | undefined;
  const colorHit = prod.colors.find(c => {
    const name = c.name.toUpperCase();
    return name.length >= 3 && rest.includes(name);
  });
  if (colorHit) color = colorHit.name;

  // ভ্যারিয়েন্ট রেজলভ
  let variantId: string | undefined;
  if (prod.variants && prod.variants.length > 0) {
    const v =
      prod.variants.find(v => (!size || v.size === size) && (!color || v.color === color)) ||
      prod.variants.find(v => (v.stock || 0) > 0);
    if (v) {
      variantId = v.id;
      size = size || v.size;
      color = color || v.color;
    }
  }

  return {
    matched: true,
    productId: prod.id,
    productName: prod.name,
    variantId,
    size,
    color,
    quantity,
    confidence: 'high',
  };
}

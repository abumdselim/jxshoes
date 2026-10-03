import { NextResponse } from 'next/server';
import { getProducts, saveProduct } from '@/lib/store';
import { isAdminRequest, requireAdmin } from '@/lib/adminAuth';
import type { Product } from '@/types';

export const runtime = 'edge';

/** পাবলিক পেলোড থেকে ক্রয়মূল্য (costPrice) বাদ — ক্রয়মূল্য/লাভ শুধু অ্যাডমিনই দেখবে */
function publicProductView(p: Product) {
  return {
    ...p,
    costPrice: undefined as number | undefined,
    variants: p.variants?.map(v => ({ ...v, costPrice: undefined as number | undefined })),
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const featured = searchParams.get('featured');

    let products = await getProducts();

    if (category && category !== 'all') {
      products = products.filter(p => p.category === category);
    }

    if (featured === 'true') {
      products = products.filter(p => p.isFeatured);
    }

    if (await isAdminRequest(request)) {
      return NextResponse.json(products);
    }
    return NextResponse.json(products.map(publicProductView));
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    if (!body.name || !body.price) {
      return NextResponse.json({ error: 'Name and price are required' }, { status: 400 });
    }
    const product = await saveProduct(body);
    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create product' }, { status: 500 });
  }
}

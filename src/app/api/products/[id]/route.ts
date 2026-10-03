import { NextResponse } from 'next/server';
import { getProductById, saveProduct, deleteProduct } from '@/lib/store';
import { isAdminRequest, requireAdmin } from '@/lib/adminAuth';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const product = await getProductById(id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  // পাবলিক পেলোড থেকে ক্রয়মূল্য (costPrice) বাদ — ক্রয়মূল্য/লাভ শুধু অ্যাডমিনই দেখবে
  if (await isAdminRequest(request)) {
    return NextResponse.json(product);
  }
  return NextResponse.json({
    ...product,
    costPrice: undefined as number | undefined,
    variants: product.variants?.map(v => ({ ...v, costPrice: undefined as number | undefined })),
  });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const updated = await saveProduct({ ...body, id });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const success = await deleteProduct(id);
  if (success) {
    return NextResponse.json({ message: 'Product deleted' });
  }
  return NextResponse.json({ error: 'Product not found' }, { status: 404 });
}

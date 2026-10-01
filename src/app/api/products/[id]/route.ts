import { NextResponse } from 'next/server';
import { getProductById, saveProduct, deleteProduct } from '@/lib/store';

export const runtime = 'edge';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const product = await getProductById(params.id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }
  return NextResponse.json(product);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const updated = await saveProduct({ ...body, id: params.id });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const success = await deleteProduct(params.id);
  if (success) {
    return NextResponse.json({ message: 'Product deleted' });
  }
  return NextResponse.json({ error: 'Product not found' }, { status: 404 });
}

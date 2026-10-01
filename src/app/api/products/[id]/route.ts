import { NextResponse } from 'next/server';
import { getProductById, saveProduct, deleteProduct } from '@/lib/store';

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  const product = getProductById(params.id);
  if (!product) {
    return NextResponse.json({ error: 'Product not found' }, { status: 400 });
  }
  return NextResponse.json(product);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const updated = saveProduct({ ...body, id: params.id });
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update product' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const success = deleteProduct(params.id);
  if (success) {
    return NextResponse.json({ message: 'Product deleted' });
  }
  return NextResponse.json({ error: 'Product not found' }, { status: 404 });
}

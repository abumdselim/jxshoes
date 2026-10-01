import { NextResponse } from 'next/server';
import { deleteCategory } from '@/lib/store';

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  const success = deleteCategory(params.id);
  if (success) {
    return NextResponse.json({ message: 'Category deleted' });
  }
  return NextResponse.json({ error: 'Category not found' }, { status: 404 });
}

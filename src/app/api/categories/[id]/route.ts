import { NextResponse } from 'next/server';
import { deleteCategory } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'edge';

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const success = await deleteCategory(id);
  if (success) {
    return NextResponse.json({ message: 'Category deleted' });
  }
  return NextResponse.json({ error: 'Category not found' }, { status: 404 });
}

import { NextResponse } from 'next/server';
import { getCategories, saveCategory } from '@/lib/store';

export const runtime = 'edge';

export async function GET() {
  try {
    const categories = await getCategories();
    return NextResponse.json(categories);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (!body.name || !body.parentType) {
      return NextResponse.json({ error: 'Name and Parent Type are required' }, { status: 400 });
    }
    const cat = await saveCategory(body);
    return NextResponse.json(cat, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to save category' }, { status: 500 });
  }
}

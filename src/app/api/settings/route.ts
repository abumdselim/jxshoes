import { NextResponse } from 'next/server';
import { getStoreSettings, saveStoreSettings } from '@/lib/store';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'edge';

export async function GET() {
  try {
    const settings = await getStoreSettings();
    return NextResponse.json(settings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch settings' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  try {
    const body = await request.json();
    const updated = await saveStoreSettings(body);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

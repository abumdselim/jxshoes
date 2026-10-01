import { NextResponse } from 'next/server';
import { getStoreSettings, saveStoreSettings } from '@/lib/store';

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
  try {
    const body = await request.json();
    const updated = await saveStoreSettings(body);
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update settings' }, { status: 500 });
  }
}

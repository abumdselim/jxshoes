import { NextResponse } from 'next/server';
import { getHeroBanner, saveHeroBanner, getFlashDeal, saveFlashDeal } from '@/lib/store';

export const runtime = 'edge';

export async function GET() {
  try {
    const heroBanner = await getHeroBanner();
    const flashDeal = await getFlashDeal();
    return NextResponse.json({ heroBanner, flashDeal });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch marketing data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let updatedHero = await getHeroBanner();
    let updatedFlash = await getFlashDeal();

    if (body.heroBanner) {
      updatedHero = await saveHeroBanner(body.heroBanner);
    }
    if (body.flashDeal) {
      updatedFlash = await saveFlashDeal(body.flashDeal);
    }

    return NextResponse.json({ heroBanner: updatedHero, flashDeal: updatedFlash });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update marketing data' }, { status: 500 });
  }
}

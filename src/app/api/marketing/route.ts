import { NextResponse } from 'next/server';
import { getHeroBanner, saveHeroBanner, getFlashDeal, saveFlashDeal } from '@/lib/store';

export async function GET() {
  try {
    const heroBanner = getHeroBanner();
    const flashDeal = getFlashDeal();
    return NextResponse.json({ heroBanner, flashDeal });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch marketing data' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    let updatedHero = getHeroBanner();
    let updatedFlash = getFlashDeal();

    if (body.heroBanner) {
      updatedHero = saveHeroBanner(body.heroBanner);
    }
    if (body.flashDeal) {
      updatedFlash = saveFlashDeal(body.flashDeal);
    }

    return NextResponse.json({ heroBanner: updatedHero, flashDeal: updatedFlash });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update marketing data' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { getCfEnv } from '@/lib/cfEnv';

export const runtime = 'edge';

const EXT_MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  pdf: 'application/pdf',
};

/**
 * R2 মিডিয়া প্রক্সি — /api/upload R2-তে সেভ করে `/api/media/{filename}` URL দেয়;
 * এই রাউট সেই ফাইল Cloudflare REST API দিয়ে সার্ভ করে (আগে ৪০৪ হচ্ছিল)।
 */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string }> }) {
  const { file } = await params;
  const cf = getCfEnv();
  if (!(cf.accountId && cf.apiToken)) {
    return new NextResponse('Media storage not configured', { status: 503 });
  }

  const key = decodeURIComponent(file);
  // পাথ-ট্রাভার্সাল ঠেকাতে শুধু সেফ ফাইলনেম
  if (!/^[A-Za-z0-9._-]+$/.test(key)) {
    return new NextResponse('Invalid file name', { status: 400 });
  }

  try {
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/r2/buckets/${cf.r2Bucket}/objects/${key}`,
      { headers: { Authorization: `Bearer ${cf.apiToken}` } }
    );
    if (!res.ok || !res.body) {
      return new NextResponse('Not found', { status: 404 });
    }

    const headers = new Headers();
    const ext = key.split('.').pop()?.toLowerCase() || '';
    headers.set(
      'Content-Type',
      res.headers.get('content-type') || EXT_MIME[ext] || 'application/octet-stream'
    );
    // আপলোডের পর ফাইল কখনো বদলায় না — লং ক্যাশ
    headers.set('Cache-Control', 'public, max-age=31536000, immutable');
    return new NextResponse(res.body, { status: 200, headers });
  } catch {
    return new NextResponse('Media fetch failed', { status: 500 });
  }
}

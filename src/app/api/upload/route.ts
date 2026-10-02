import { NextResponse } from 'next/server';
import { getCfEnv } from '@/lib/cfEnv';

export const runtime = 'edge';

export async function POST(request: Request) {
  const cf = getCfEnv();
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const cleanName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filename = `${Date.now()}-${cleanName}`;
    const bytes = await file.arrayBuffer();

    // 1. If running with Cloudflare R2 configured
    if (cf.apiToken && cf.accountId) {
      try {
        const r2Url = `https://api.cloudflare.com/client/v4/accounts/${cf.accountId}/r2/buckets/${cf.r2Bucket}/objects/${filename}`;
        const cfRes = await fetch(r2Url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${cf.apiToken}`,
            'Content-Type': file.type || 'application/octet-stream',
          },
          body: bytes,
        });

        if (cfRes.ok) {
          // Serve through public endpoint or proxy
          const filePublicUrl = `/api/media/${filename}`;
          return NextResponse.json({ url: filePublicUrl, filename });
        }
      } catch (err) {
        console.warn('R2 upload failed, fallback to data URI / local:', err);
      }
    }

    // 2. Base64 fallback if storage bucket direct put is offline
    const base64Data = Buffer.from(bytes).toString('base64');
    const mimeType = file.type || 'image/jpeg';
    const dataUri = `data:${mimeType};base64,${base64Data}`;

    return NextResponse.json({ url: dataUri, filename });
  } catch (error) {
    console.error('File upload error:', error);
    return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
  }
}

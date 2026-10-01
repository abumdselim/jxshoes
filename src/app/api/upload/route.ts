import { NextResponse } from 'next/server';

export const runtime = 'edge';

const CF_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID || '';
const CF_API_TOKEN = process.env.CLOUDFLARE_API_TOKEN || '';
const R2_BUCKET = process.env.CLOUDFLARE_R2_BUCKET || 'jxshoes-media';

export async function POST(request: Request) {
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
    if (CF_API_TOKEN && CF_ACCOUNT_ID) {
      try {
        const r2Url = `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/r2/buckets/${R2_BUCKET}/objects/${filename}`;
        const cfRes = await fetch(r2Url, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${CF_API_TOKEN}`,
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

import { NextResponse } from 'next/server';
import { getCfEnv } from '@/lib/cfEnv';
import { requireAdmin } from '@/lib/adminAuth';

export const runtime = 'edge';

// আপলোড সীমা (P1) — শুধু অ্যাডমিন, নির্দিষ্ট ছবি-ফরম্যাট, সাইজ লিমিট, অনুমান-অযোগ্য ফাইলনেম
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(request: Request) {
  const denied = await requireAdmin(request);
  if (denied) return denied;
  const cf = getCfEnv();
  try {
    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;

    if (!file) {
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      return NextResponse.json({ error: 'শুধু JPEG, PNG বা WebP ছবি আপলোড করা যায়' }, { status: 400 });
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'ছবিটি খুব বড় — সর্বোচ্চ 5MB' }, { status: 400 });
    }

    // ক্লায়েন্ট-পাঠানো নাম নয় — অনুমান-অযোগ্য র‍্যান্ডম ফাইলনেম
    const filename = `${crypto.randomUUID()}.${ext}`;
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

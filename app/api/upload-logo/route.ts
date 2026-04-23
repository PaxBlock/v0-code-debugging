import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type and size
    const validTypes = ['image/png', 'image/jpeg', 'image/svg+xml'];
    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Only PNG, JPG, and SVG images allowed' }, { status: 400 });
    }

    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 2MB' }, { status: 400 });
    }

    // Upload to Vercel Blob with a timestamp-based name
    const timestamp = Date.now();
    const ext = file.name.split('.').pop();
    const blobName = `logos/${timestamp}-${Math.random().toString(36).slice(2)}.${ext}`;

    const blob = await put(blobName, file, { access: 'public' });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('[upload-logo]', error);
    return NextResponse.json({ error: 'Failed to upload logo' }, { status: 500 });
  }
}

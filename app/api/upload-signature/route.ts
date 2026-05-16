import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageData } = body;

    if (!imageData) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Convert base64 data URL to buffer
    const base64Data = imageData.replace(/^data:image\/png;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');

    // Upload to Vercel Blob
    const timestamp = Date.now();
    const blobName = `signatures/${timestamp}-${Math.random().toString(36).slice(2)}.png`;

    const blob = await put(blobName, buffer, { access: 'private', contentType: 'image/png' });

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('[upload-signature]', error);
    return NextResponse.json({ error: 'Failed to upload signature' }, { status: 500 });
  }
}

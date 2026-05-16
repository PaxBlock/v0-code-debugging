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

    console.log('[upload-signature] Uploading to Blob:', blobName, 'size:', buffer.length);
    const blob = await put(blobName, buffer, { access: 'private', contentType: 'image/png' });
    console.log('[upload-signature] Upload successful:', blob.url);

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('[upload-signature] Error:', error instanceof Error ? error.message : String(error));
    console.error('[upload-signature] Full error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to upload signature',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

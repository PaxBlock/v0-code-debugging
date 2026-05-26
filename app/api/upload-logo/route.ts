import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageData } = body;

    if (!imageData) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Remove data URL prefix if present (e.g., "data:image/png;base64,")
    let base64Data = imageData;
    if (imageData.includes('base64,')) {
      base64Data = imageData.split('base64,')[1];
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 5MB' }, { status: 400 });
    }

    // Upload to Vercel Blob
    const timestamp = Date.now();
    const blobName = `logos/${timestamp}-${Math.random().toString(36).slice(2)}.png`;

    console.log('[upload-logo] Uploading to Blob:', blobName, 'size:', buffer.length);
    const blob = await put(blobName, buffer, { access: 'public', contentType: 'image/png' });
    console.log('[upload-logo] Upload successful:', blob.url);

    return NextResponse.json({ url: blob.url });
  } catch (error) {
    console.error('[upload-logo] Error:', error instanceof Error ? error.message : String(error));
    console.error('[upload-logo] Full error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Failed to upload logo',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

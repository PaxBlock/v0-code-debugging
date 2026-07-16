import { put } from '@vercel/blob';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { imageData } = body;

    if (!imageData) {
      return NextResponse.json({ error: 'No image data provided' }, { status: 400 });
    }

    // Detect the REAL image type from the data URL prefix (e.g. "data:image/jpeg;base64,").
    // Previously this route forced everything to image/png, which corrupted JPEG/SVG/WebP
    // logos: the bytes stayed JPEG/SVG but the blob was labeled PNG. Browser <img> tolerates
    // this, but the emailed certificate is rendered by next/og (Satori), which is strict and
    // silently drops any image whose declared content-type doesn't match its bytes.
    let base64Data = imageData;
    let mimeType = 'image/png';
    const prefixMatch = /^data:([^;]+);base64,/.exec(imageData);
    if (prefixMatch) {
      mimeType = prefixMatch[1].toLowerCase();
    }
    if (imageData.includes('base64,')) {
      base64Data = imageData.split('base64,')[1];
    }

    const buffer = Buffer.from(base64Data, 'base64');

    // Validate file size
    if (buffer.length > 5 * 1024 * 1024) {
      return NextResponse.json({ error: 'File size must be under 5MB' }, { status: 400 });
    }

    // next/og (Satori) reliably decodes PNG and JPEG. WebP/SVG/other formats are not
    // dependable there, so reject them up front with a clear message instead of letting
    // the logo silently vanish from the issued certificate.
    const SATORI_SAFE: Record<string, string> = {
      'image/png': 'png',
      'image/jpeg': 'jpg',
      'image/jpg': 'jpg',
    };
    const ext = SATORI_SAFE[mimeType];
    if (!ext) {
      return NextResponse.json(
        { error: 'Unsupported image format. Please upload a PNG or JPG logo (SVG/WebP are not supported on certificates).' },
        { status: 400 }
      );
    }

    // Upload to Vercel Blob using the CORRECT extension and content type so the bytes
    // and the declared format always match.
    const timestamp = Date.now();
    const blobName = `logos/${timestamp}-${Math.random().toString(36).slice(2)}.${ext}`;

    console.log('[upload-logo] Uploading to Blob:', blobName, 'size:', buffer.length, 'type:', mimeType);
    const blob = await put(blobName, buffer, { access: 'public', contentType: mimeType });
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

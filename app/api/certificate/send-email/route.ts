import { NextRequest, NextResponse } from 'next/server';
import { PDFDocument } from 'pdf-lib';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const {
      to,
      studentName,
      course,
      grade,
      paxId,
      universityName,
      studentAddress,
      contractAddress,
      registrar,
      registrarSignature,
      registrarPosition,
      vc,
      vcSignature,
      vcPosition,
      dean,
      deanSignature,
      deanPosition,
      logoUrl,
      domain,
    } = await req.json();

    if (!to || !studentName || !course || !paxId || !universityName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'Email service not configured' }, { status: 500 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://v0-paxadmin.vercel.app';

    // Build the certificate image URL with signature URLs
    const verifyUrl = `${siteUrl}/?tab=verify&paxId=${encodeURIComponent(paxId)}&contract=${contractAddress}`;
    const imageParams = new URLSearchParams({
      name: studentName,
      course,
      grade: grade || '',
      paxId,
      university: universityName,
      date: new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
      registrar: registrar || '',
      registrarSig: registrarSignature || '',
      registrarPos: registrarPosition || 'Registrar',
      vc: vc || '',
      vcSig: vcSignature || '',
      vcPos: vcPosition || 'Vice-Chancellor',
      dean: dean || '',
      deanSig: deanSignature || '',
      deanPos: deanPosition || 'Dean',
      domain: domain || new URL(siteUrl).hostname,
      logo: logoUrl || '',
      revoked: 'false',
      verifyUrl: verifyUrl,
    });

    const certificateImageUrl = `${siteUrl}/api/certificate/image?${imageParams.toString()}`;

    // Fetch the certificate image and convert to PDF for attachment
    let pdfBase64 = '';
    try {
      const imageRes = await fetch(certificateImageUrl);
      if (imageRes.ok) {
        const imageBuffer = await imageRes.arrayBuffer();
        
        // Create PDF with the certificate image embedded
        const pdfDoc = await PDFDocument.create();
        const pngImage = await pdfDoc.embedPng(imageBuffer);
        
        // A4-ish dimensions that fit the certificate aspect ratio (900x1240)
        const pageWidth = 595; // A4 width in points
        const pageHeight = 820; // Proportional to certificate aspect ratio
        
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        
        // Scale image to fit page with some margin
        const margin = 20;
        const availableWidth = pageWidth - (margin * 2);
        const availableHeight = pageHeight - (margin * 2);
        const scale = Math.min(
          availableWidth / pngImage.width,
          availableHeight / pngImage.height
        );
        const scaledWidth = pngImage.width * scale;
        const scaledHeight = pngImage.height * scale;
        
        // Center the image on the page
        const x = (pageWidth - scaledWidth) / 2;
        const y = (pageHeight - scaledHeight) / 2;
        
        page.drawImage(pngImage, {
          x,
          y,
          width: scaledWidth,
          height: scaledHeight,
        });
        
        const pdfBytes = await pdfDoc.save();
        pdfBase64 = Buffer.from(pdfBytes).toString('base64');
      }
    } catch (pdfError) {
      console.error('[v0] PDF generation error:', pdfError);
      // Continue without attachment if PDF generation fails
    }

    // Beautiful HTML email — matches the certificate aesthetic
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Academic Certificate</title>
</head>
<body style="margin:0;padding:0;background:#f4f0e8;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0e8;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#fffdf7;border:2px solid #c9a96e;border-radius:8px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="background:#1a1a2e;padding:28px 40px;text-align:center;">
              <p style="margin:0;color:#c9a96e;font-size:11px;letter-spacing:3px;text-transform:uppercase;">PaxBlockchain Technologies</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:normal;letter-spacing:1px;">Verified Academic Credential</h1>
            </td>
          </tr>

          <!-- Certificate image -->
          <tr>
            <td style="padding:32px 40px 0;text-align:center;">
              <p style="margin:0 0 16px;color:#5a4a3a;font-size:15px;">Dear <strong>${studentName}</strong>,</p>
              <p style="margin:0 0 24px;color:#5a4a3a;font-size:14px;line-height:1.6;">
                Congratulations! Your academic certificate has been permanently issued on the blockchain
                and is now securely held in your wallet. Below is your official softcopy for your records.
                ${pdfBase64 ? '<strong>A PDF copy is attached to this email for easy download and printing.</strong>' : ''}
              </p>
              <img
                src="${certificateImageUrl}"
                alt="Academic Certificate for ${studentName}"
                width="520"
                style="max-width:100%;border:2px solid #c9a96e;border-radius:6px;display:block;margin:0 auto;"
              />
            </td>
          </tr>

          <!-- Details -->
          <tr>
            <td style="padding:28px 40px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #e8dcc8;">
                    <p style="margin:0;color:#9a8a7a;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Graduate Name</p>
                    <p style="margin:4px 0 0;color:#2a1a0e;font-size:15px;font-weight:bold;">${studentName}</p>
                  </td>
                  <td style="padding:10px 0 10px 20px;border-bottom:1px solid #e8dcc8;">
                    <p style="margin:0;color:#9a8a7a;font-size:11px;text-transform:uppercase;letter-spacing:1px;">PaxID / Matric No.</p>
                    <p style="margin:4px 0 0;color:#2a1a0e;font-size:15px;font-weight:bold;font-family:monospace;">${paxId}</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:10px 0;border-bottom:1px solid #e8dcc8;">
                    <p style="margin:0;color:#9a8a7a;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Field of Study</p>
                    <p style="margin:4px 0 0;color:#2a1a0e;font-size:15px;">${course}</p>
                  </td>
                  <td style="padding:10px 0 10px 20px;border-bottom:1px solid #e8dcc8;">
                    <p style="margin:0;color:#9a8a7a;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Classification</p>
                    <p style="margin:4px 0 0;color:#2a1a0e;font-size:15px;">${grade || 'Not specified'}</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="2" style="padding:10px 0;">
                    <p style="margin:0;color:#9a8a7a;font-size:11px;text-transform:uppercase;letter-spacing:1px;">Issuing Institution</p>
                    <p style="margin:4px 0 0;color:#2a1a0e;font-size:15px;">${universityName}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Verify CTA -->
          <tr>
            <td style="padding:0 40px 28px;">
              <div style="background:#f0ebe0;border:1px solid #c9a96e;border-radius:6px;padding:20px;text-align:center;">
                <p style="margin:0 0 6px;color:#5a4a3a;font-size:13px;">This certificate can be independently verified at any time.</p>
                <p style="margin:0 0 16px;color:#5a4a3a;font-size:13px;">No account needed — just scan the QR code on the certificate or click below.</p>
                <a
                  href="${verifyUrl}"
                  style="display:inline-block;background:#1a1a2e;color:#c9a96e;text-decoration:none;padding:12px 28px;border-radius:4px;font-size:13px;letter-spacing:1px;font-family:Arial,sans-serif;"
                >
                  VERIFY THIS CERTIFICATE
                </a>
              </div>
            </td>
          </tr>

          <!-- Blockchain note -->
          <tr>
            <td style="padding:0 40px 28px;">
              <p style="margin:0;color:#9a8a7a;font-size:12px;line-height:1.6;text-align:center;">
                This credential is permanently recorded on the Sepolia blockchain. It cannot be altered,
                forged, or deleted. Token held at wallet <span style="font-family:monospace;">${studentAddress ? studentAddress.slice(0, 10) + '...' + studentAddress.slice(-6) : ''}</span>.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#1a1a2e;padding:20px 40px;text-align:center;">
              <p style="margin:0;color:#5a6a8a;font-size:11px;">PaxBlockchain Technologies &mdash; Blockchain-Verified Academic Credentials</p>
              <p style="margin:6px 0 0;color:#3a4a6a;font-size:10px;">This email was sent once as part of your certificate issuance. Your email address is not stored.</p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    // Build email payload with optional PDF attachment
    const emailPayload: {
      from: string;
      to: string[];
      subject: string;
      html: string;
      attachments?: { filename: string; content: string }[];
    } = {
      from: 'PaxBlockchain Certificates <certificates@resend.dev>',
      to: [to],
      subject: `Your Academic Certificate — ${universityName}`,
      html,
    };

    // Attach PDF if successfully generated
    if (pdfBase64) {
      const safeFileName = `Certificate_${studentName.replace(/[^a-zA-Z0-9]/g, '_')}_${paxId.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
      emailPayload.attachments = [
        {
          filename: safeFileName,
          content: pdfBase64,
        },
      ];
    }

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(emailPayload),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error('[v0] Resend error:', err);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[v0] Email send error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

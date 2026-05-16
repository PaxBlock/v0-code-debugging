import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(req: NextRequest) {
  try {
    // Check if Resend API key is configured
    if (!process.env.RESEND_API_KEY) {
      console.warn('RESEND_API_KEY is not configured. Email notifications will be skipped.');
      return NextResponse.json({ success: true, warning: 'Email service not configured' });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const {
      to,
      studentName,
      course,
      paxId,
      universityName,
      reason,
      revokedDate,
    } = await req.json();

    if (!to || !studentName || !paxId || !universityName || !reason) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://v0-paxadmin.vercel.app';

    // Professional HTML email for revocation notification
    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f5f5f5; font-family: Georgia, 'Times New Roman', serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
          
          <!-- Header -->
          <tr>
            <td style="background-color: #b22222; padding: 30px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: bold;">Certificate Revocation Notice</h1>
            </td>
          </tr>

          <!-- Warning Banner -->
          <tr>
            <td style="background-color: #fef2f2; padding: 20px 40px; border-bottom: 2px solid #fecaca;">
              <p style="margin: 0; color: #991b1b; font-size: 14px; text-align: center; font-weight: bold;">
                IMPORTANT: Your certificate has been revoked by the issuing institution
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="margin: 0 0 20px; color: #333; font-size: 16px; line-height: 1.6;">
                Dear <strong>${studentName}</strong>,
              </p>
              
              <p style="margin: 0 0 20px; color: #333; font-size: 16px; line-height: 1.6;">
                We regret to inform you that your academic certificate has been revoked by <strong>${universityName}</strong>.
              </p>

              <!-- Certificate Details -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fef2f2; border-radius: 8px; padding: 20px; margin: 20px 0; border: 1px solid #fecaca;">
                <tr>
                  <td style="padding: 15px 20px;">
                    <p style="margin: 0 0 10px; color: #666; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">Certificate Details</p>
                    <p style="margin: 0 0 8px; color: #333; font-size: 14px;"><strong>Programme:</strong> ${course || 'N/A'}</p>
                    <p style="margin: 0 0 8px; color: #333; font-size: 14px;"><strong>Certificate ID:</strong> ${paxId}</p>
                    <p style="margin: 0 0 8px; color: #333; font-size: 14px;"><strong>Revocation Date:</strong> ${revokedDate}</p>
                  </td>
                </tr>
              </table>

              <!-- Reason -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #fee2e2; border-radius: 8px; padding: 20px; margin: 20px 0; border: 2px solid #dc2626;">
                <tr>
                  <td style="padding: 15px 20px;">
                    <p style="margin: 0 0 10px; color: #991b1b; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; font-weight: bold;">Reason for Revocation</p>
                    <p style="margin: 0; color: #7f1d1d; font-size: 16px; font-style: italic;">"${reason}"</p>
                  </td>
                </tr>
              </table>

              <p style="margin: 20px 0; color: #333; font-size: 16px; line-height: 1.6;">
                This revocation has been permanently recorded on the blockchain. The certificate is no longer valid and any verification attempts will show the revoked status.
              </p>

              <p style="margin: 20px 0; color: #333; font-size: 16px; line-height: 1.6;">
                If you believe this revocation was made in error, please contact <strong>${universityName}</strong> directly.
              </p>

              <!-- Verify Link -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${siteUrl}/?tab=verify&paxId=${encodeURIComponent(paxId)}" 
                       style="display: inline-block; background-color: #6b7280; color: #ffffff; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-size: 14px; font-weight: bold;">
                      View Revocation Record
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 25px 40px; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0 0 10px; color: #6b7280; font-size: 12px; text-align: center;">
                This is an automated notification from the blockchain certificate verification system.
              </p>
              <p style="margin: 0; color: #9ca3af; font-size: 11px; text-align: center;">
                Powered by Pax &bull; Blockchain-Verified Academic Credentials
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    const { error } = await resend.emails.send({
      from: 'PAX Certificates <certificates@resend.dev>',
      to: [to],
      subject: `Certificate Revocation Notice - ${universityName}`,
      html: htmlContent,
    });

    if (error) {
      console.error('Resend error:', error);
      return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Send revocation email error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

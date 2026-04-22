import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const studentName    = searchParams.get('name')         || 'Graduate Name';
  const course         = searchParams.get('course')        || 'Field of Study';
  const grade          = searchParams.get('grade')         || '';
  const issuedDate     = searchParams.get('date')          || '';
  const paxId          = searchParams.get('paxId')         || '';
  const university     = searchParams.get('university')    || 'Institution Name';
  const dean           = searchParams.get('dean')          || '';
  const registrar      = searchParams.get('registrar')     || '';
  const viceChancellor = searchParams.get('vc')            || '';
  const domain         = searchParams.get('domain')        || 'v0-paxadmin.vercel.app';
  const revoked        = searchParams.get('revoked')       === 'true';
  const revokeReason   = searchParams.get('revokeReason') || '';
  const verifyUrl      = searchParams.get('verifyUrl')     || '';

  const qrData = verifyUrl || `https://${domain}`;
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(qrData)}&bgcolor=fdf6e3&color=2a1a0a&margin=6&qzone=1`;

  return new ImageResponse(
    (
      <div
        style={{
          width: '900px',
          height: '1200px',
          background: '#fdf6e3',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Outer gold border */}
        <div style={{
          position: 'absolute',
          inset: '0',
          border: '20px solid #b8860b',
          display: 'flex',
          zIndex: 10,
          pointerEvents: 'none',
        }} />
        {/* Inner gold border */}
        <div style={{
          position: 'absolute',
          inset: '30px',
          border: '2.5px solid #b8860b',
          display: 'flex',
          zIndex: 10,
          pointerEvents: 'none',
        }} />

        {/* Diagonal salmon accent stripe */}
        <div style={{
          position: 'absolute',
          top: '-100px',
          right: '-60px',
          width: '280px',
          height: '1400px',
          background: 'rgba(210, 130, 90, 0.12)',
          transform: 'rotate(12deg)',
          display: 'flex',
        }} />

        {/* REVOKED watermark */}
        {revoked && (
          <div style={{
            position: 'absolute',
            top: '42%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-30deg)',
            fontSize: '130px',
            fontWeight: 900,
            color: 'rgba(180, 30, 30, 0.1)',
            letterSpacing: '8px',
            display: 'flex',
            whiteSpace: 'nowrap',
            zIndex: 5,
          }}>
            REVOKED
          </div>
        )}

        {/* Content wrapper — inside the inner border */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          width: '100%',
          height: '100%',
          padding: '48px 72px 44px',
          zIndex: 6,
          boxSizing: 'border-box',
        }}>

          {/* PAX logo circle + Institution name */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', marginBottom: '8px' }}>
            <div style={{
              width: '68px',
              height: '68px',
              borderRadius: '50%',
              background: '#1a1a1a',
              border: '3px solid #b8860b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f5c842',
              fontSize: '18px',
              fontWeight: 800,
              letterSpacing: '1px',
              flexShrink: 0,
            }}>
              PAX
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '2px' }}>
              <span style={{
                fontSize: '24px',
                fontWeight: 800,
                color: '#1a1a1a',
                lineHeight: 1.15,
                fontFamily: 'serif',
                letterSpacing: '0.5px',
              }}>
                {university}
              </span>
            </div>
          </div>

          {/* Gold divider */}
          <div style={{ width: '780px', height: '2px', background: 'linear-gradient(90deg, transparent, #b8860b 20%, #b8860b 80%, transparent)', margin: '12px 0', display: 'flex' }} />

          {/* Certificate Of Completion — script style via italic serif */}
          <div style={{
            fontSize: '46px',
            color: '#7a3b00',
            fontStyle: 'italic',
            fontWeight: 700,
            fontFamily: 'serif',
            marginBottom: '6px',
            display: 'flex',
            letterSpacing: '1px',
          }}>
            Certificate of Completion
          </div>

          <div style={{ fontSize: '17px', color: '#666', marginBottom: '18px', display: 'flex', letterSpacing: '1.5px', fontFamily: 'serif' }}>
            THIS IS TO CERTIFY THAT
          </div>

          {/* Student Name */}
          <div style={{
            fontSize: '58px',
            fontWeight: 800,
            color: revoked ? '#b22222' : '#c97a20',
            fontStyle: 'italic',
            fontFamily: 'serif',
            lineHeight: 1,
            marginBottom: '6px',
            display: 'flex',
            textDecoration: revoked ? 'line-through' : 'none',
          }}>
            {studentName}
          </div>
          {/* Dotted underline */}
          <div style={{ display: 'flex', gap: '3px', marginBottom: '18px' }}>
            {Array.from({ length: 42 }).map((_, i) => (
              <div key={i} style={{ width: '8px', height: '2px', background: '#bbb', display: 'flex' }} />
            ))}
          </div>

          <div style={{
            fontSize: '16px',
            color: '#555',
            textAlign: 'center',
            marginBottom: '14px',
            lineHeight: 1.7,
            display: 'flex',
            maxWidth: '700px',
            fontFamily: 'serif',
          }}>
            has successfully completed the approved course of study and fulfilled all requirements for the award of
          </div>

          {/* Degree */}
          <div style={{
            fontSize: '28px',
            fontWeight: 800,
            fontStyle: 'italic',
            color: '#1a1a1a',
            fontFamily: 'serif',
            marginBottom: '6px',
            display: 'flex',
          }}>
            {course}
          </div>
          <div style={{ display: 'flex', gap: '3px', marginBottom: '12px' }}>
            {Array.from({ length: 36 }).map((_, i) => (
              <div key={i} style={{ width: '8px', height: '2px', background: '#bbb', display: 'flex' }} />
            ))}
          </div>

          {/* Grade */}
          {grade && (
            <div style={{
              fontSize: '20px',
              fontWeight: 700,
              fontStyle: 'italic',
              color: '#1a1a1a',
              fontFamily: 'serif',
              marginBottom: '16px',
              display: 'flex',
              gap: '8px',
            }}>
              <span>with</span>
              <span style={{ borderBottom: '2px dotted #999' }}>{grade}</span>
            </div>
          )}

          {/* Date and PaxID row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '12px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '14px', fontStyle: 'italic', fontWeight: 700, color: '#333', fontFamily: 'serif' }}>
                Issued date: {issuedDate}
              </span>
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: 24 }).map((_, i) => (
                  <div key={i} style={{ width: '6px', height: '1.5px', background: '#bbb', display: 'flex' }} />
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '14px', fontStyle: 'italic', fontWeight: 700, color: '#333', fontFamily: 'serif' }}>
                Certificate ID: {paxId}
              </span>
              <div style={{ display: 'flex', gap: '2px' }}>
                {Array.from({ length: 22 }).map((_, i) => (
                  <div key={i} style={{ width: '6px', height: '1.5px', background: '#bbb', display: 'flex' }} />
                ))}
              </div>
            </div>
          </div>

          {/* Revocation notice */}
          {revoked && (
            <div style={{
              background: 'rgba(180,30,30,0.07)',
              border: '2px solid rgba(180,30,30,0.35)',
              borderRadius: '6px',
              padding: '10px 18px',
              marginBottom: '10px',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
              width: '100%',
            }}>
              <span style={{ fontWeight: 800, color: '#b22222', fontSize: '14px', fontFamily: 'serif' }}>CERTIFICATE REVOKED</span>
              <span style={{ color: '#666', fontSize: '13px', fontFamily: 'serif' }}>Reason: {revokeReason}</span>
            </div>
          )}

          {/* QR note */}
          <div style={{
            fontSize: '12.5px',
            color: '#666',
            fontStyle: 'italic',
            marginBottom: '16px',
            display: 'flex',
            textAlign: 'center',
            fontFamily: 'serif',
            gap: '4px',
          }}>
            <span style={{ fontWeight: 700 }}>NOTE:</span>
            <span>This certificate may be verified by scanning the QR code, which links to the official record on:</span>
            <span style={{ fontWeight: 700 }}>{domain}</span>
          </div>

          {/* Bottom row: QR + Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-end', marginTop: 'auto' }}>

            {/* QR Code */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '5px' }}>
              <img
                src={qrImageUrl}
                width={150}
                height={150}
                alt="Scan to verify"
                style={{ border: '3px solid #b8860b', borderRadius: '4px', display: 'flex' }}
              />
              <span style={{ fontSize: '11px', color: '#888', fontStyle: 'italic', fontFamily: 'serif' }}>Scan to verify</span>
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'flex-start', flex: 1, paddingLeft: '52px' }}>
              {[
                { role: 'Dean', name: dean },
                { role: 'Registrar', name: registrar },
                { role: 'Vice-Chancellor', name: viceChancellor },
              ].map(({ role, name }) => (
                <div key={role} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '19px', fontStyle: 'italic', color: '#7a3b00', fontFamily: 'serif', letterSpacing: '0.5px' }}>
                    {role}
                  </span>
                  <div style={{ display: 'flex', gap: '2px' }}>
                    {Array.from({ length: 34 }).map((_, i) => (
                      <div key={i} style={{ width: '7px', height: '1.5px', background: '#aaa', display: 'flex' }} />
                    ))}
                  </div>
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#444', fontStyle: 'italic', fontFamily: 'serif' }}>
                    {role}: {name || '________________________'}
                  </span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    ),
    { width: 900, height: 1200 }
  );
}

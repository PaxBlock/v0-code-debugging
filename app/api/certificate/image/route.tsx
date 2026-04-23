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
  const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrData)}&bgcolor=fdf6e3&color=1a1a2e&margin=8&qzone=2`;

  // Dot row helper
  const dots = (count: number, color = '#c9a96e') =>
    Array.from({ length: count }).map((_, i) => (
      <div key={i} style={{ width: '5px', height: '2px', borderRadius: '2px', background: color, display: 'flex', flexShrink: 0 }} />
    ));

  const CREAM = '#fdf6e3';
  const GOLD  = '#c9a96e';
  const DARK  = '#1a1a2e';
  const BROWN = '#5a3e1b';
  const ORANGE = '#c8651b';

  return new ImageResponse(
    (
      <div style={{
        width: '900px', height: '1240px',
        background: CREAM, display: 'flex', flexDirection: 'column',
        alignItems: 'center', padding: '0', position: 'relative', overflow: 'hidden',
      }}>

        {/* Thick outer gold border */}
        <div style={{ position: 'absolute', inset: '0', border: `18px solid ${GOLD}`, display: 'flex', zIndex: 10 }} />
        {/* Thin inner gold border */}
        <div style={{ position: 'absolute', inset: '28px', border: `1.5px solid ${GOLD}`, display: 'flex', zIndex: 10 }} />

        {/* Salmon diagonal accent */}
        <div style={{
          position: 'absolute', top: '-80px', right: '-40px',
          width: '260px', height: '1400px',
          background: 'rgba(210,110,70,0.10)', transform: 'rotate(13deg)', display: 'flex',
        }} />

        {/* Faint PAX watermark */}
        <div style={{
          position: 'absolute', top: '380px', left: '50%',
          fontSize: '260px', fontWeight: 'bold', fontFamily: 'serif',
          color: `rgba(201,169,110,0.06)`, letterSpacing: '-8px',
          display: 'flex', zIndex: 0,
          transform: 'translateX(-50%)',
        }}>PAX</div>

        {revoked && (
          <div style={{
            position: 'absolute', top: '44%', left: '50%',
            fontSize: '120px', fontWeight: 900, color: 'rgba(180,30,30,0.09)',
            letterSpacing: '8px', display: 'flex', whiteSpace: 'nowrap', zIndex: 5,
            transform: 'translate(-50%,-50%) rotate(-28deg)',
          }}>REVOKED</div>
        )}

        {/* ── MAIN CONTENT ── */}
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          width: '100%', padding: '50px 70px 42px', zIndex: 6,
        }}>

          {/* Logo + Institution */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '4px' }}>
            <div style={{
              width: '66px', height: '66px', borderRadius: '50%',
              background: DARK, border: `3px solid ${GOLD}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <span style={{ color: GOLD, fontSize: '17px', fontWeight: 'bold', fontStyle: 'italic', fontFamily: 'serif' }}>Pax</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <span style={{ fontSize: '21px', fontWeight: 'bold', color: DARK, fontFamily: 'serif', letterSpacing: '0.3px', lineHeight: '1.2' }}>
                PaxBlockchain Technologies Inc.
              </span>
              <span style={{ fontSize: '11px', color: BROWN, letterSpacing: '2.5px', textTransform: 'uppercase' }}>
                Blockchain-Verified Academic Credentials
              </span>
            </div>
          </div>

          {/* Full-width gold rule */}
          <div style={{ width: '100%', height: '1.5px', background: `linear-gradient(to right, transparent, ${GOLD} 15%, ${GOLD} 85%, transparent)`, margin: '14px 0 10px', display: 'flex' }} />

          {/* Certificate Of Completion */}
          <span style={{ fontSize: '44px', fontStyle: 'italic', fontWeight: 700, color: BROWN, fontFamily: 'serif', letterSpacing: '1px', lineHeight: '1.1', marginBottom: '8px' }}>
            Certificate Of Completion
          </span>

          {/* Thin centre rule */}
          <div style={{ width: '300px', height: '1px', background: GOLD, marginBottom: '14px', display: 'flex' }} />

          <span style={{ fontSize: '15px', color: BROWN, fontStyle: 'italic', letterSpacing: '1px', marginBottom: '8px' }}>
            This is to certify that
          </span>

          {/* Student name */}
          <span style={{
            fontSize: revoked ? '50px' : '56px',
            fontStyle: 'italic', fontWeight: 'bold',
            color: revoked ? '#b22222' : ORANGE,
            fontFamily: 'serif', lineHeight: '1.1', marginBottom: '4px',
            textDecoration: revoked ? 'line-through' : 'none',
          }}>
            {studentName}
          </span>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '14px' }}>{dots(56, GOLD)}</div>

          <span style={{ fontSize: '15px', color: BROWN, textAlign: 'center', lineHeight: '1.65', marginBottom: '8px' }}>
            has successfully completed the approved course of study
          </span>
          <span style={{ fontSize: '15px', color: BROWN, textAlign: 'center', lineHeight: '1.65', marginBottom: '12px' }}>
            and fulfilled all requirements for the award of
          </span>

          {/* Course */}
          <span style={{ fontSize: '28px', fontWeight: 'bold', fontStyle: 'italic', color: DARK, fontFamily: 'serif', marginBottom: '4px' }}>
            {course}
          </span>
          <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>{dots(44, GOLD)}</div>

          {/* Grade */}
          {grade && (
            <>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                <span style={{ fontSize: '15px', color: BROWN }}>with</span>
                <span style={{ fontSize: '22px', fontWeight: 'bold', fontStyle: 'italic', color: DARK, fontFamily: 'serif' }}>{grade}</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', marginBottom: '10px' }}>{dots(40, GOLD)}</div>
            </>
          )}

          {/* Date + PaxID / Certificate ID */}
          <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginTop: '8px', marginBottom: '8px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <span style={{ fontSize: '13.5px', fontStyle: 'italic', fontWeight: 'bold', color: BROWN, fontFamily: 'serif' }}>
                Issued date: {issuedDate}
              </span>
              <div style={{ display: 'flex', gap: '3px' }}>{dots(28, GOLD)}</div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
              <span style={{ fontSize: '13.5px', fontStyle: 'italic', fontWeight: 'bold', color: BROWN, fontFamily: 'serif' }}>
                Certificate ID: {paxId}
              </span>
              <div style={{ display: 'flex', gap: '3px' }}>{dots(22, GOLD)}</div>
            </div>
          </div>

          {/* Revocation badge */}
          {revoked && (
            <div style={{
              background: 'rgba(180,30,30,0.07)', border: '2px solid rgba(180,30,30,0.4)',
              borderRadius: '4px', padding: '10px 20px', marginBottom: '8px',
              display: 'flex', flexDirection: 'column', gap: '3px', width: '100%',
            }}>
              <span style={{ fontWeight: 'bold', color: '#b22222', fontSize: '14px' }}>CERTIFICATE REVOKED</span>
              <span style={{ color: '#666', fontSize: '12px' }}>Reason: {revokeReason}</span>
            </div>
          )}

          {/* NOTE line */}
          <div style={{
            width: '100%', borderTop: `1px solid ${GOLD}`, paddingTop: '10px',
            marginTop: '8px', display: 'flex', gap: '5px', flexWrap: 'wrap',
          }}>
            <span style={{ fontSize: '12px', fontWeight: 'bold', fontStyle: 'italic', color: BROWN }}>NOTE:</span>
            <span style={{ fontSize: '12px', color: BROWN, fontStyle: 'italic' }}>
              This certificate may be verified by scanning the QR code, which links to the official record on:
            </span>
            <span style={{ fontSize: '12px', fontWeight: 'bold', fontStyle: 'italic', color: DARK }}>{domain}</span>
          </div>

          {/* Bottom: QR + Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', width: '100%', marginTop: '18px', gap: '16px' }}>

            {/* QR */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              <img
                src={qrImageUrl}
                width={162}
                height={162}
                alt="Scan to verify"
                style={{ border: `3px solid ${GOLD}`, borderRadius: '3px', display: 'flex', background: CREAM }}
              />
              <span style={{ fontSize: '10.5px', color: '#9a8a7a', fontStyle: 'italic', fontFamily: 'serif' }}>Scan to verify</span>
            </div>

            {/* Signatures */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px', flex: 1, paddingLeft: '36px' }}>
              {([
                { script: dean || 'Dean', label: 'Dean' },
                { script: registrar || 'Registrar', label: 'Registrar' },
                { script: viceChancellor || 'Vice-Chancellor', label: 'Vice-Chancellor' },
              ] as Array<{script: string; label: string}>).map(({ script, label }) => (
                <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <span style={{ fontSize: '21px', fontStyle: 'italic', color: BROWN, fontFamily: 'serif', letterSpacing: '0.5px' }}>
                    {script}
                  </span>
                  <div style={{ display: 'flex', gap: '3px' }}>{dots(30, GOLD)}</div>
                  <span style={{ fontSize: '12.5px', fontWeight: 'bold', fontStyle: 'italic', color: DARK, fontFamily: 'serif' }}>
                    {label}:
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Gold footer bar */}
          <div style={{
            width: '100%', marginTop: '18px',
            borderTop: `1.5px solid ${GOLD}`, paddingTop: '10px',
            display: 'flex', justifyContent: 'center',
          }}>
            <span style={{ fontSize: '10px', color: '#9a8a7a', letterSpacing: '2.5px', textTransform: 'uppercase' }}>
              Blockchain-Verified &nbsp;&mdash;&nbsp; Tamper-Proof &nbsp;&mdash;&nbsp; Permanent
            </span>
          </div>

        </div>
      </div>
    ),
    { width: 900, height: 1240 }
  );
}

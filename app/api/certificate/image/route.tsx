import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export const runtime = 'edge';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const studentName   = searchParams.get('name')          || 'Graduate Name';
  const course        = searchParams.get('course')         || 'Field of Study';
  const grade         = searchParams.get('grade')          || '';
  const issuedDate    = searchParams.get('date')           || '';
  const paxId         = searchParams.get('paxId')          || '';
  const university    = searchParams.get('university')     || 'Institution Name';
  const dean          = searchParams.get('dean')           || '';
  const registrar     = searchParams.get('registrar')      || '';
  const viceChancellor = searchParams.get('vc')            || '';
  const domain        = searchParams.get('domain')         || '';
  const revoked       = searchParams.get('revoked')        === 'true';
  const revokeReason  = searchParams.get('revokeReason')  || '';

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
          padding: '60px 70px',
          fontFamily: 'serif',
          position: 'relative',
          border: '18px solid #c9a96e',
          boxSizing: 'border-box',
        }}
      >
        {/* Inner border */}
        <div style={{
          position: 'absolute',
          inset: '28px',
          border: '3px solid #c9a96e',
          display: 'flex',
          pointerEvents: 'none',
        }} />

        {/* Diagonal accent stripe */}
        <div style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: '320px',
          height: '900px',
          background: 'rgba(232, 160, 100, 0.13)',
          transform: 'rotate(15deg) translateX(120px) translateY(-80px)',
          display: 'flex',
        }} />

        {/* Revoked watermark */}
        {revoked && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%) rotate(-35deg)',
            fontSize: '110px',
            fontWeight: 900,
            color: 'rgba(200, 40, 40, 0.13)',
            letterSpacing: '10px',
            display: 'flex',
            whiteSpace: 'nowrap',
          }}>
            REVOKED
          </div>
        )}

        {/* Header — institution name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '10px', zIndex: 1 }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: '#1a1a1a',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: '22px',
            fontWeight: 700,
            flexShrink: 0,
          }}>
            PAX
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '28px', fontWeight: 800, color: '#1a1a1a', lineHeight: 1.1 }}>
              {university}
            </span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: '100%', height: '2px', background: '#c9a96e', margin: '16px 0', display: 'flex' }} />

        {/* Certificate Of Completion */}
        <div style={{ fontSize: '42px', color: '#8B4513', fontStyle: 'italic', fontWeight: 700, marginBottom: '10px', display: 'flex' }}>
          Certificate of Completion
        </div>

        <div style={{ fontSize: '18px', color: '#555', marginBottom: '24px', display: 'flex' }}>
          This is to certify that
        </div>

        {/* Student Name */}
        <div style={{
          fontSize: '52px',
          fontWeight: 800,
          color: revoked ? '#c0392b' : '#c97a20',
          fontStyle: 'italic',
          marginBottom: '4px',
          display: 'flex',
          textDecoration: revoked ? 'line-through' : 'none',
        }}>
          {studentName}
        </div>
        <div style={{ width: '420px', height: '2px', background: '#bbb', borderStyle: 'dotted', marginBottom: '24px', display: 'flex' }} />

        <div style={{ fontSize: '17px', color: '#444', textAlign: 'center', marginBottom: '20px', lineHeight: 1.6, display: 'flex', maxWidth: '680px' }}>
          has successfully completed the approved course of study and fulfilled all requirements for the award of
        </div>

        {/* Degree */}
        <div style={{ fontSize: '30px', fontWeight: 800, fontStyle: 'italic', color: '#1a1a1a', marginBottom: '4px', display: 'flex' }}>
          {course}
        </div>
        <div style={{ width: '380px', height: '2px', background: '#bbb', borderStyle: 'dotted', marginBottom: '18px', display: 'flex' }} />

        {/* Grade */}
        {grade && (
          <div style={{ fontSize: '22px', fontWeight: 700, fontStyle: 'italic', color: '#1a1a1a', marginBottom: '24px', display: 'flex' }}>
            with <span style={{ marginLeft: '8px', textDecoration: 'underline dotted' }}>{grade}</span>
          </div>
        )}

        {/* Date and PaxID row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', marginBottom: '20px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            <span style={{ fontSize: '15px', fontStyle: 'italic', fontWeight: 700, color: '#333' }}>
              Issued date: {issuedDate}
            </span>
            <div style={{ width: '220px', height: '1px', background: '#bbb', borderStyle: 'dotted', display: 'flex' }} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '15px', fontStyle: 'italic', fontWeight: 700, color: '#333' }}>
              Certificate ID: {paxId}
            </span>
            <div style={{ width: '200px', height: '1px', background: '#bbb', borderStyle: 'dotted', display: 'flex' }} />
          </div>
        </div>

        {/* Revocation notice */}
        {revoked && (
          <div style={{
            background: 'rgba(200,40,40,0.08)',
            border: '2px solid rgba(200,40,40,0.4)',
            borderRadius: '8px',
            padding: '12px 20px',
            marginBottom: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            width: '100%',
          }}>
            <span style={{ fontWeight: 800, color: '#c0392b', fontSize: '16px' }}>CERTIFICATE REVOKED</span>
            <span style={{ color: '#666', fontSize: '14px' }}>Reason: {revokeReason}</span>
          </div>
        )}

        {/* QR Note */}
        {domain && (
          <div style={{ fontSize: '13px', color: '#555', fontStyle: 'italic', marginBottom: '24px', display: 'flex', textAlign: 'center' }}>
            <span style={{ fontWeight: 700 }}>NOTE:</span>&nbsp;This certificate may be verified by scanning the QR code, which links to the official record on:&nbsp;
            <span style={{ fontWeight: 700 }}>{domain}</span>
          </div>
        )}

        {/* Bottom row: QR placeholder + Signatures */}
        <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'flex-end', marginTop: 'auto' }}>
          {/* QR placeholder — actual QR is overlaid in the metadata image via the /api/certificate/[address] route */}
          <div style={{
            width: '160px',
            height: '160px',
            background: '#e8d5a0',
            border: '3px solid #c9a96e',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '13px',
            color: '#888',
            flexDirection: 'column',
            gap: '6px',
            borderRadius: '4px',
          }}>
            <div style={{ fontSize: '30px', display: 'flex' }}>&#9639;</div>
            <span>Scan to verify</span>
          </div>

          {/* Signatures */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'flex-start', flex: 1, paddingLeft: '48px' }}>
            {[
              { role: 'Dean', name: dean },
              { role: 'Registrar', name: registrar },
              { role: 'Vice-Chancellor', name: viceChancellor },
            ].map(({ role, name }) => (
              <div key={role} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '20px', fontStyle: 'italic', color: '#555', fontFamily: 'serif' }}>{role}</span>
                <div style={{ width: '280px', height: '1px', background: '#aaa', borderStyle: 'dotted', display: 'flex' }} />
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#333', fontStyle: 'italic' }}>
                  {role}: {name || '________________________'}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    ),
    {
      width: 900,
      height: 1200,
    }
  );
}

import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verificationDb } from '@/lib/verification-api-db';

export async function POST(req: NextRequest) {
  const auth = req.headers.get('authorization') || '';
  const key = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
  if (!key) return NextResponse.json({ error: 'Bearer verification API key required.' }, { status: 401 });
  const body = await req.json().catch(() => null);
  if (!body?.certificateId) return NextResponse.json({ error: 'certificateId is required.' }, { status: 400 });
  const keyHash = createHash('sha256').update(key).digest('hex');
  const result = await verificationDb.query(`SELECT institution_address, institution_name, status FROM verification_api_requests WHERE api_key_hash = $1 LIMIT 1`, [keyHash]);
  const access = result.rows[0];
  if (!access || access.status !== 'active') return NextResponse.json({ error: 'Invalid or inactive verification API key.' }, { status: 401 });
  if (!body.studentAddress) return NextResponse.json({ valid: false, institution: access.institution_name, institutionAddress: access.institution_address, certificateId: String(body.certificateId), message: 'Provide studentAddress to complete the blockchain lookup.' });
  const lookup = await fetch(`${req.nextUrl.origin}/api/certificate/${encodeURIComponent(body.studentAddress)}?contract=${encodeURIComponent(access.institution_address)}`, { cache: 'no-store' });
  const certificate = await lookup.json();
  if (!lookup.ok) return NextResponse.json({ valid: false, institution: access.institution_name, certificateId: String(body.certificateId), error: certificate.error || 'Certificate not found.' }, { status: lookup.status });
  return NextResponse.json({ valid: true, institution: access.institution_name, institutionAddress: access.institution_address, certificateId: String(body.certificateId), certificate });
}

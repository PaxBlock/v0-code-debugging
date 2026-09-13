import { createHash } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { lookupCredential } from '@/lib/credential-lookup';
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
  const identifier = String(body.studentAddress || body.certificateId).trim();
  const credential = await lookupCredential(access.institution_address, identifier);
  if (!credential.found) {
    return NextResponse.json({
      valid: false,
      institution: access.institution_name,
      institutionAddress: access.institution_address,
      certificateId: String(body.certificateId),
      error: credential.error || 'No certificate was found for this PaxID or wallet address.',
    }, { status: 404 });
  }
  if (body.certificateId && credential.paxId && credential.paxId.toUpperCase() !== String(body.certificateId).trim().toUpperCase()) {
    return NextResponse.json({ valid: false, institution: access.institution_name, certificateId: String(body.certificateId), error: 'Certificate ID does not match the credential found for this identifier.' }, { status: 404 });
  }
  return NextResponse.json({
    valid: credential.status === 'valid',
    institution: credential.institutionName || access.institution_name,
    institutionAddress: access.institution_address,
    certificateId: credential.paxId || String(body.certificateId),
    certificate: credential,
  });
}

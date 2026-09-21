import { createHash, randomBytes } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { decryptVerificationKey, encryptVerificationKey, verificationDb } from '@/lib/verification-api-db';

function hash(value: string) { return createHash('sha256').update(value).digest('hex'); }
function jsonError(message: string, status = 400) { return NextResponse.json({ error: message }, { status }); }

export async function GET(req: NextRequest) {
  const wallet = req.headers.get('x-wallet-address')?.toLowerCase();
  if (!wallet) return jsonError('Wallet address is required.', 401);
  const isAdmin = req.headers.get('x-pax-owner') === 'true';
  const hasActiveFilter = req.nextUrl.searchParams.has('institutionAddresses');
  const activeAddresses = (req.nextUrl.searchParams.get('institutionAddresses') || '')
    .split(',')
    .map((address) => address.trim().toLowerCase())
    .filter(Boolean);
  const select = `SELECT id, institution_address, institution_name, requester_wallet, requester_email, intended_use, status, api_key_prefix, api_key_encrypted, created_at, approved_at, deactivated_at FROM verification_api_requests`;
  const activeFilter = hasActiveFilter ? ` AND institution_address = ANY($${isAdmin ? 1 : 2}::text[])` : '';
  const result = isAdmin
    ? await verificationDb.query(`${select} WHERE TRUE${activeFilter} ORDER BY created_at DESC`, activeAddresses.length ? [activeAddresses] : [])
    : await verificationDb.query(`${select} WHERE requester_wallet = $1${activeFilter} ORDER BY created_at DESC`, activeAddresses.length ? [wallet, activeAddresses] : [wallet]);
  const requests = result.rows.map((row) => ({
    ...row,
    apiKey: !isAdmin && row.api_key_encrypted ? decryptVerificationKey(row.api_key_encrypted) : undefined,
  }));
  return NextResponse.json({ requests });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.institutionAddress || !body?.institutionName || !body?.requesterWallet || !body?.requesterEmail || !body?.intendedUse) return jsonError('Institution, wallet, email, and intended use are required.');
  const result = await verificationDb.query(`INSERT INTO verification_api_requests (institution_address, institution_name, requester_wallet, requester_email, intended_use) VALUES ($1, $2, $3, $4, $5) RETURNING id, status, created_at`, [String(body.institutionAddress).toLowerCase(), String(body.institutionName), String(body.requesterWallet).toLowerCase(), String(body.requesterEmail), String(body.intendedUse)]);
  return NextResponse.json({ request: result.rows[0] }, { status: 201 });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body?.id || !['approve', 'deactivate', 'reject'].includes(body.action)) return jsonError('A valid request id and action are required.');
  if (body.action === 'approve') {
    const apiKey = `pax_verify_${randomBytes(24).toString('base64url')}`;
    const result = await verificationDb.query(`UPDATE verification_api_requests SET status = 'active', api_key_hash = $1, api_key_prefix = $2, api_key_encrypted = $3, approved_at = NOW(), deactivated_at = NULL WHERE id = $4 AND status = 'pending' RETURNING id, institution_name, institution_address, api_key_prefix, status, approved_at`, [hash(apiKey), apiKey.slice(0, 20), encryptVerificationKey(apiKey), body.id]);
    if (!result.rowCount) return jsonError('Request not found or already processed.', 409);
    return NextResponse.json({ request: result.rows[0] });
  }
  const status = body.action === 'deactivate' ? 'deactivated' : 'rejected';
  const result = await verificationDb.query(`UPDATE verification_api_requests SET status = $1, deactivated_at = CASE WHEN $1 = 'deactivated' THEN NOW() ELSE deactivated_at END WHERE id = $2 RETURNING id, status, deactivated_at`, [status, body.id]);
  if (!result.rowCount) return jsonError('Request not found.', 404);
  return NextResponse.json({ request: result.rows[0] });
}

import { NextRequest, NextResponse } from 'next/server';
import { ethers } from 'ethers';

// This route runs on the server — it reads the blockchain and returns NFT metadata JSON.
// Called by wallets (MetaMask, Rainbow) and marketplaces (OpenSea) via the tokenURI.

const UNIVERSITY_ABI = [
  'function name() external view returns (string)',
  'function certificates(uint256 tokenId) external view returns (string candidateName, string courseName, string grade, string paxId, uint256 issuanceDate, address issuer)',
  'function studentToTokenId(address student) external view returns (uint256)',
  'function hasCertificate(address student) external view returns (bool)',
  'function isRevoked(address student) external view returns (bool)',
  'function revocationReason(address student) external view returns (string)',
  'function institutionConfig() external view returns (string deanName, string registrarName, string viceChancellorName, string verificationDomain)',
];

const APP_SALT = 'pax-academic-certificate-system-v1';

async function deriveKey(univAddr: string, studentAddr: string): Promise<CryptoKey> {
  const raw = `${APP_SALT}:${univAddr.toLowerCase()}:${studentAddr.toLowerCase()}`;
  const encoded = new TextEncoder().encode(raw);
  const hash = await crypto.subtle.digest('SHA-256', encoded);
  return crypto.subtle.importKey('raw', hash, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

async function decryptField(value: string, univAddr: string, studentAddr: string): Promise<string> {
  if (!value.startsWith('enc:')) return value;
  try {
    const parts = value.split(':');
    if (parts.length !== 3) return value;
    const key = await deriveKey(univAddr, studentAddr);
    const iv = Uint8Array.from(atob(parts[1]), c => c.charCodeAt(0));
    const cipher = Uint8Array.from(atob(parts[2]), c => c.charCodeAt(0));
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, cipher);
    return new TextDecoder().decode(plain);
  } catch {
    return '[Encrypted]';
  }
}

function getProvider() {
  return new ethers.JsonRpcProvider('https://ethereum-sepolia-rpc.publicnode.com', { chainId: 11155111, name: 'sepolia' });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address: studentAddress } = await params;
  const { searchParams } = new URL(req.url);
  const univAddress = searchParams.get('contract');

  if (!univAddress || !ethers.isAddress(univAddress) || !ethers.isAddress(studentAddress)) {
    return NextResponse.json({ error: 'Invalid address parameters.' }, { status: 400 });
  }

  try {
    const provider = getProvider();
    const university = new ethers.Contract(univAddress, UNIVERSITY_ABI, provider);

    const hasCert = await university.hasCertificate(studentAddress);
    if (!hasCert) {
      return NextResponse.json({ error: 'No certificate found for this address.' }, { status: 404 });
    }

    const tokenId = await university.studentToTokenId(studentAddress);
    const [cert, revoked, revokeReason, config, univName] = await Promise.all([
      university.certificates(tokenId),
      university.isRevoked(studentAddress),
      university.revocationReason(studentAddress),
      university.institutionConfig(),
      university.name(),
    ]);

    // Decrypt encrypted fields using the same deterministic key
    const [candidateName, courseName, grade] = await Promise.all([
      decryptField(cert.candidateName, univAddress, studentAddress),
      decryptField(cert.courseName, univAddress, studentAddress),
      decryptField(cert.grade, univAddress, studentAddress),
    ]);

    const issuedDate = new Date(Number(cert.issuanceDate) * 1000).toLocaleDateString('en-GB', {
      year: 'numeric', month: 'long', day: 'numeric',
    });

    const baseUrl = req.nextUrl.origin;
    const verifyUrl = `${baseUrl}/verify?paxId=${encodeURIComponent(cert.paxId)}&contract=${univAddress}`;
    const domain = config.verificationDomain || new URL(baseUrl).hostname;

    // Build image URL with all dynamic fields
    const imageParams = new URLSearchParams({
      name: candidateName,
      course: courseName,
      grade: grade,
      date: issuedDate,
      paxId: cert.paxId,
      university: univName,
      dean: config.deanName || '',
      registrar: config.registrarName || '',
      vc: config.viceChancellorName || '',
      domain: domain,
      revoked: revoked ? 'true' : 'false',
      revokeReason: revoked ? revokeReason : '',
    });
    const imageUrl = `${baseUrl}/api/certificate/image?${imageParams.toString()}`;

    // ERC-721 compliant metadata JSON
    const metadata = {
      name: `${candidateName} — ${courseName}`,
      description: revoked
        ? `This certificate issued by ${univName} has been revoked. Reason: ${revokeReason}`
        : `Blockchain-verified academic certificate issued by ${univName}. Verify at ${verifyUrl}`,
      image: imageUrl,
      external_url: verifyUrl,
      attributes: [
        { trait_type: 'Institution', value: univName },
        { trait_type: 'Field of Study', value: courseName },
        { trait_type: 'Classification', value: grade },
        { trait_type: 'PaxID', value: cert.paxId },
        { trait_type: 'Issue Date', value: issuedDate },
        { trait_type: 'Status', value: revoked ? 'Revoked' : 'Valid' },
        { trait_type: 'Certificate ID', value: tokenId.toString() },
      ],
    };

    return NextResponse.json(metadata, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[certificate-metadata]', error);
    return NextResponse.json({ error: 'Failed to fetch certificate data.' }, { status: 500 });
  }
}

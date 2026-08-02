import { ethers } from 'ethers';

// Server-side credential lookup for the PAX Assistant.
// Queries the live Sepolia blockchain to resolve a PaxID / Matric No. / wallet address
// to a credential and reports its status. Mirrors the client-side verify flow exactly,
// including AES-256-GCM decryption of the personal fields.

const FACTORY_ADDRESS = '0x39D88237DE1ea136006A9123f5787802a23AE4a2';

const FACTORY_ABI = [
  'function getAllUniversities() external view returns (address[])',
  'function isDeactivated(address) external view returns (bool)',
];

const UNIVERSITY_ABI = [
  'function name() external view returns (string)',
  'function hasCertificate(address student) external view returns (bool)',
  'function certificates(uint256 tokenId) external view returns (string candidateName, string courseName, string grade, string paxId, uint256 issuanceDate, address issuer)',
  'function studentToTokenId(address student) external view returns (uint256)',
  'function isRevoked(address student) external view returns (bool)',
  'function revocationReason(address student) external view returns (string)',
  'function revocationDate(address student) external view returns (uint256)',
  'function resolvePaxId(string memory paxId) external view returns (address)',
];

const SERVER_MASTER_SECRET = process.env.NEXT_PUBLIC_ENCRYPTION_SECRET || '';

export interface CredentialLookupResult {
  found: boolean;
  status?: 'valid' | 'revoked';
  candidateName?: string;
  courseName?: string;
  grade?: string;
  paxId?: string;
  issuedAt?: string;
  institutionName?: string;
  studentAddress?: string;
  revocationReason?: string;
  revocationDate?: string;
  error?: string;
  suggestion?: string;
}

// --- Decryption helpers (mirror app/page.tsx, using Node's global Web Crypto) ---

function b64ToBytes(b64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(b64, 'base64'));
}

async function deriveKey(universityAddress: string, studentAddress: string): Promise<CryptoKey> {
  const message = `${universityAddress.toLowerCase()}:${studentAddress.toLowerCase()}`;
  const secretKey = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(SERVER_MASTER_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const hmac = await crypto.subtle.sign('HMAC', secretKey, new TextEncoder().encode(message));
  return crypto.subtle.importKey('raw', hmac, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}

async function decryptField(value: string, univAddr: string, studentAddr: string): Promise<string> {
  if (!value || !value.startsWith('enc:')) return value || '';
  try {
    const parts = value.split(':');
    if (parts.length !== 3) return value;
    const key = await deriveKey(univAddr, studentAddr);
    const iv = b64ToBytes(parts[1]);
    const cipher = b64ToBytes(parts[2]);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, cipher as BufferSource);
    return new TextDecoder().decode(plain);
  } catch {
    return '[Encrypted]';
  }
}

// --- Blockchain helpers ---

function getProvider(): ethers.JsonRpcProvider {
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (!rpcUrl) throw new Error('SEPOLIA_RPC_URL is not configured.');
  return new ethers.JsonRpcProvider(rpcUrl);
}

// Find a university contract address by institution/programme name (case-insensitive,
// tolerant of partial matches). If given a contract address, return it directly.
async function findUniversityAddress(
  provider: ethers.JsonRpcProvider,
  institution: string
): Promise<{ address: string; name: string } | null> {
  const query = institution.trim();
  if (ethers.isAddress(query)) {
    const contract = new ethers.Contract(query, UNIVERSITY_ABI, provider);
    let name = 'Programme';
    try { name = await contract.name(); } catch { /* keep default */ }
    return { address: query, name };
  }

  const factory = new ethers.Contract(FACTORY_ADDRESS, FACTORY_ABI, provider);
  const addresses: string[] = await factory.getAllUniversities();
  const needle = query.toLowerCase();

  const matches: { address: string; name: string }[] = [];
  for (const addr of addresses) {
    try {
      const contract = new ethers.Contract(addr, UNIVERSITY_ABI, provider);
      const name: string = await contract.name();
      const lower = name.toLowerCase();
      if (lower === needle || lower.includes(needle) || needle.includes(lower)) {
        matches.push({ address: addr, name });
      }
    } catch { /* skip unreadable contract */ }
  }

  if (matches.length === 0) return null;
  // Prefer an exact match, otherwise the first partial match.
  const exact = matches.find((m) => m.name.toLowerCase() === needle);
  return exact || matches[0];
}

/**
 * Look up a credential on the blockchain.
 * @param institution Institution/programme name or contract address.
 * @param identifier  Student PaxID / Matric No. (e.g. "PHY/2022/054") or wallet address (0x...).
 */
export async function lookupCredential(
  institution: string,
  identifier: string
): Promise<CredentialLookupResult> {
  try {
    if (!institution?.trim()) {
      return { found: false, error: 'Missing institution name.' };
    }
    if (!identifier?.trim()) {
      return { found: false, error: 'Missing student identifier (PaxID, Matric No., or wallet address).' };
    }

    const provider = getProvider();
    const uni = await findUniversityAddress(provider, institution);
    if (!uni) {
      return {
        found: false,
        error: `No institution or programme matching "${institution}" was found on PAX.`,
        suggestion: 'Check the institution name spelling, or provide the programme contract address.',
      };
    }

    const university = new ethers.Contract(uni.address, UNIVERSITY_ABI, provider);

    // Resolve the identifier to a wallet address.
    let studentAddress = identifier.trim();
    if (!ethers.isAddress(studentAddress)) {
      // Treat as PaxID / Matric No. — stored uppercase on-chain.
      const resolved: string = await university.resolvePaxId(studentAddress.toUpperCase());
      if (!resolved || resolved === ethers.ZeroAddress) {
        return {
          found: false,
          institutionName: uni.name,
          error: `No credential found for "${identifier}" at ${uni.name}.`,
          suggestion: 'Double-check the PaxID / Matric No. and the institution, then try again.',
        };
      }
      studentAddress = resolved;
    }

    const has: boolean = await university.hasCertificate(studentAddress);
    if (!has) {
      return {
        found: false,
        institutionName: uni.name,
        studentAddress,
        error: `No credential found for this student at ${uni.name}.`,
      };
    }

    const tokenId = await university.studentToTokenId(studentAddress);
    const [cert, revoked, reason, revDate] = await Promise.all([
      university.certificates(tokenId),
      university.isRevoked(studentAddress),
      university.revocationReason(studentAddress).catch(() => ''),
      university.revocationDate(studentAddress).catch(() => BigInt(0)),
    ]);

    const [candidateName, courseName, grade] = await Promise.all([
      decryptField(cert.candidateName, uni.address, studentAddress),
      decryptField(cert.courseName, uni.address, studentAddress),
      decryptField(cert.grade, uni.address, studentAddress),
    ]);

    const fmt = (ts: bigint | number) =>
      new Date(Number(ts) * 1000).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    return {
      found: true,
      status: revoked ? 'revoked' : 'valid',
      candidateName,
      courseName,
      grade,
      paxId: cert.paxId,
      issuedAt: fmt(cert.issuanceDate),
      institutionName: uni.name,
      studentAddress,
      revocationReason: revoked ? reason : undefined,
      revocationDate: revoked && Number(revDate) > 0 ? fmt(revDate) : undefined,
    };
  } catch (error) {
    console.log('[v0] Credential lookup error:', error instanceof Error ? error.message : String(error));
    return {
      found: false,
      error: 'The lookup failed due to a blockchain or network error. Please try again in a moment.',
    };
  }
}

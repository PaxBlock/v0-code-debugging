/**
 * AES-256-GCM Encryption Utility
 *
 * The encryption key is deterministically derived from:
 *   - The university contract address (which university issued it)
 *   - The student wallet address (who it was issued to)
 *   - A fixed app salt (ties it to this specific dApp)
 *
 * This means the same key is always produced for the same
 * university + student pair, with no database or wallet signing needed.
 * Anyone using this dApp can decrypt and verify, but raw Etherscan
 * data shows only encrypted gibberish.
 *
 * IMPORTANT: This file must only ever be loaded via dynamic import()
 * from client-side code. It must never be statically imported or
 * evaluated at build time.
 */

const APP_SALT = 'pax-academic-certificate-system-v1';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// Access crypto only inside function bodies, never at module level.
// This prevents Next.js build worker from evaluating browser globals.
function getSubtle(): SubtleCrypto {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined) as Crypto | undefined;
  if (!c?.subtle) {
    throw new Error('Web Crypto API is not available. This must run in a browser.');
  }
  return c.subtle;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getCrypto(): Crypto {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c = (typeof globalThis !== 'undefined' ? (globalThis as any).crypto : undefined) as Crypto | undefined;
  if (!c) {
    throw new Error('Web Crypto API is not available. This must run in a browser.');
  }
  return c;
}

async function deriveKey(
  universityAddress: string,
  studentAddress: string
): Promise<CryptoKey> {
  const subtle = getSubtle();
  const keyMaterial = `${APP_SALT}:${universityAddress.toLowerCase()}:${studentAddress.toLowerCase()}`;
  const encoded = new TextEncoder().encode(keyMaterial);
  const hashBuffer = await subtle.digest('SHA-256', encoded);
  return subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptName(
  plainText: string,
  universityAddress: string,
  studentAddress: string
): Promise<string> {
  const subtle = getSubtle();
  const crypto = getCrypto();
  const key = await deriveKey(universityAddress, studentAddress);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);

  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return `enc:${toBase64(iv)}:${toBase64(new Uint8Array(cipherBuffer))}`;
}

export async function decryptName(
  encrypted: string,
  universityAddress: string,
  studentAddress: string
): Promise<string> {
  if (!encrypted.startsWith('enc:')) {
    return encrypted;
  }

  try {
    const subtle = getSubtle();
    const parts = encrypted.split(':');
    if (parts.length !== 3) return encrypted;

    const iv = fromBase64(parts[1]);
    const cipherBuffer = fromBase64(parts[2]);
    const key = await deriveKey(universityAddress, studentAddress);

    const decryptedBuffer = await subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    return '[Encrypted — unable to decrypt]';
  }
}

export function isEncrypted(value: string): boolean {
  return value.startsWith('enc:');
}

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
 * Uses Web Crypto API with safe isomorphic guards so this file
 * works in both browser and Next.js server/build environments.
 */

const APP_SALT = 'pax-academic-certificate-system-v1';

/**
 * Returns the Web Crypto API instance, compatible with both browser and Node.js 18+.
 */
function getCrypto(): Crypto {
  if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
    return globalThis.crypto;
  }
  throw new Error('Web Crypto API is not available in this environment.');
}

/**
 * Encodes a string to Uint8Array using UTF-8, safe for all Unicode characters.
 */
function encode(text: string): Uint8Array {
  return new TextEncoder().encode(text);
}

/**
 * Converts a Uint8Array to base64 in chunks to avoid call stack overflow on large inputs.
 */
function toBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

/**
 * Converts a base64 string back to Uint8Array.
 */
function fromBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

/**
 * Derives a deterministic AES-256 key from university address + student address.
 */
async function deriveKey(universityAddress: string, studentAddress: string): Promise<CryptoKey> {
  const subtle = getCrypto().subtle;
  const keyMaterial = `${APP_SALT}:${universityAddress.toLowerCase()}:${studentAddress.toLowerCase()}`;
  const hashBuffer = await subtle.digest('SHA-256', encode(keyMaterial));
  return subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plain text string.
 * Returns a prefixed base64 string: "enc:<iv>:<ciphertext>"
 */
export async function encryptName(
  plainText: string,
  universityAddress: string,
  studentAddress: string
): Promise<string> {
  const subtle = getCrypto().subtle;
  const key = await deriveKey(universityAddress, studentAddress);
  const iv = getCrypto().getRandomValues(new Uint8Array(12));

  const cipherBuffer = await subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encode(plainText)
  );

  return `enc:${toBase64(iv)}:${toBase64(new Uint8Array(cipherBuffer))}`;
}

/**
 * Decrypts an encrypted string back to plain text.
 * Handles legacy unencrypted names gracefully.
 */
export async function decryptName(
  encrypted: string,
  universityAddress: string,
  studentAddress: string
): Promise<string> {
  // Handle unencrypted legacy data (before encryption was added)
  if (!encrypted.startsWith('enc:')) {
    return encrypted;
  }

  try {
    const parts = encrypted.split(':');
    if (parts.length !== 3) return encrypted;

    const iv = fromBase64(parts[1]);
    const cipherBuffer = fromBase64(parts[2]);
    const key = await deriveKey(universityAddress, studentAddress);

    const decryptedBuffer = await getCrypto().subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    return '[Encrypted - Unable to decrypt]';
  }
}

/**
 * Checks if a string was encrypted by this system.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith('enc:');
}

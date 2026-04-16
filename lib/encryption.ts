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
 */

const APP_SALT = 'pax-academic-certificate-system-v1';

/**
 * Derives a deterministic AES-256 key from university address + student address.
 */
async function deriveKey(universityAddress: string, studentAddress: string): Promise<CryptoKey> {
  const keyMaterial = `${APP_SALT}:${universityAddress.toLowerCase()}:${studentAddress.toLowerCase()}`;
  const encoded = new TextEncoder().encode(keyMaterial);

  // Hash the input to get a consistent 256-bit key material
  const hashBuffer = await crypto.subtle.digest('SHA-256', encoded);

  // Import the hash as an AES-256-GCM key
  return crypto.subtle.importKey(
    'raw',
    hashBuffer,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plain text string.
 * Returns a base64 string: IV (12 bytes) + ciphertext, separated by ":"
 */
export async function encryptName(
  plainText: string,
  universityAddress: string,
  studentAddress: string
): Promise<string> {
  const key = await deriveKey(universityAddress, studentAddress);

  // Random 12-byte IV (initialization vector) - unique per encryption
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const encoded = new TextEncoder().encode(plainText);
  const cipherBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  // Convert to base64 for blockchain storage
  const ivB64 = btoa(String.fromCharCode(...iv));
  const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));

  return `enc:${ivB64}:${cipherB64}`;
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

    const iv = Uint8Array.from(atob(parts[1]), (c) => c.charCodeAt(0));
    const cipherBuffer = Uint8Array.from(atob(parts[2]), (c) => c.charCodeAt(0));

    const key = await deriveKey(universityAddress, studentAddress);

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      cipherBuffer
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch {
    // If decryption fails for any reason, return a safe fallback
    return '[Encrypted - Unable to decrypt]';
  }
}

/**
 * Checks if a string was encrypted by this system.
 */
export function isEncrypted(value: string): boolean {
  return value.startsWith('enc:');
}

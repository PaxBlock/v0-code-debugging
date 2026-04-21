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
 * All Web Crypto API calls are guarded inside async functions so they
 * are never evaluated at build time — only at runtime in the browser.
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

async function deriveKey(
  universityAddress: string,
  studentAddress: string
): Promise<CryptoKey> {
  const subtle = window.crypto.subtle;
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
  const key = await deriveKey(universityAddress, studentAddress);
  const iv = window.crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(plainText);

  const cipherBuffer = await window.crypto.subtle.encrypt(
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
    const parts = encrypted.split(':');
    if (parts.length !== 3) return encrypted;

    const iv = fromBase64(parts[1]);
    const cipherBuffer = fromBase64(parts[2]);
    const key = await deriveKey(universityAddress, studentAddress);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
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

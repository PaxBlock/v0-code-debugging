import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { put } from "@vercel/blob";

const ALGORITHM = "aes-256-gcm";
const VERSION = 1;

function getEncryptionKey() {
  const encoded = process.env.INSTITUTION_ENCRYPTION_KEY?.trim().replace(/^['\"]|['\"]$/g, "");
  if (!encoded) throw new Error("Institution encryption is not configured.");

  const key = /^[0-9a-fA-F]{64}$/.test(encoded)
    ? Buffer.from(encoded, "hex")
    : Buffer.from(encoded.replace(/-/g, "+").replace(/_/g, "/"), "base64");

  if (key.length !== 32) {
    throw new Error("INSTITUTION_ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex characters or base64.");
  }
  return key;
}

export async function storeEncryptedInstitutionMetadata(input: {
  id: string;
  profile: Record<string, unknown>;
}) {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const plaintext = Buffer.from(JSON.stringify(input.profile), "utf8");
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const authTag = cipher.getAuthTag();
  const envelope = JSON.stringify({ version: VERSION, algorithm: ALGORITHM, iv: iv.toString("base64"), authTag: authTag.toString("base64"), ciphertext: ciphertext.toString("base64") });
  const digest = createHash("sha256").update(envelope).digest("hex");
  const blob = await put(`institutions/${input.id}/metadata-${digest}.json`, envelope, { access: "public", contentType: "application/json", addRandomSuffix: false });
  return { pathname: blob.pathname, url: blob.url, hash: `0x${digest}` };
}

export async function readEncryptedInstitutionMetadata(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Institution metadata was not found.");
  const envelope = (await response.json()) as { version: number; algorithm: string; iv: string; authTag: string; ciphertext: string };
  if (envelope.version !== VERSION || envelope.algorithm !== ALGORITHM) throw new Error("Unsupported institution metadata format.");
  const decipher = (await import("node:crypto")).createDecipheriv(ALGORITHM, getEncryptionKey(), Buffer.from(envelope.iv, "base64"));
  decipher.setAuthTag(Buffer.from(envelope.authTag, "base64"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, "base64")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as Record<string, unknown>;
}

export function canonicalInstitutionProfile(profile: Record<string, unknown>) {
  return JSON.stringify(profile);
}

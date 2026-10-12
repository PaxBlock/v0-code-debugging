"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { institutions, institutionMembers } from "@/lib/db/schema";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";
import { registerInstitutionOnSepolia } from "@/lib/sepolia-registrar";
import { storeEncryptedInstitutionMetadata } from "@/lib/institution-metadata";

export async function registerSchool(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  const registrationMode = String(formData.get("registrationMode") || "production");
  const name = String(formData.get("name") || "").trim();
  const abbreviation = String(formData.get("abbreviation") || "").trim().toUpperCase();
  if (registrationMode === "test" && !/^PAX Test\b/i.test(name)) throw new Error("Test registrations must use a name beginning with PAX Test.");
  if (!name || !/^[A-Z0-9-]{2,15}$/.test(abbreviation)) throw new Error("Enter a school name and valid abbreviation.");
  const id = randomUUID();
  const profile = { id, name, abbreviation, verificationDomain: String(formData.get("verificationDomain") || "").trim() || null, viceChancellorName: String(formData.get("viceChancellorName") || "").trim() || null, viceChancellorSignature: String(formData.get("vice_chancellor_signature_data") || "").trim() || null, registrarName: String(formData.get("registrarName") || "").trim() || null, registrarSignature: String(formData.get("registrar_signature_data") || "").trim() || null, createdAt: new Date().toISOString() };
  const metadata = await storeEncryptedInstitutionMetadata({ id, profile });
  const registration = await registerInstitutionOnSepolia({ name, abbreviation, metadataUri: `${metadata.url}?sha256=${metadata.hash.slice(2)}` });
  await db.insert(institutions).values({ id, name, abbreviation, country: String(formData.get("country") || "").trim() || null, verificationDomain: String(formData.get("verificationDomain") || "").trim() || null, viceChancellorName: String(formData.get("viceChancellorName") || "").trim() || null, viceChancellorSignatureUrl: String(formData.get("vice_chancellor_signature_data") || formData.get("viceChancellorSignatureUrl") || "").trim() || null, registrarName: String(formData.get("registrarName") || "").trim() || null, registrarSignatureUrl: String(formData.get("registrar_signature_data") || formData.get("registrarSignatureUrl") || "").trim() || null, createdByUserId: session.user.id, createdAt: new Date(), updatedAt: new Date() });
  await db.insert(institutionMembers).values({ id: randomUUID(), institutionId: id, userId: session.user.id, role: "representative", status: "active", invitedByUserId: session.user.id, createdAt: new Date() });
  redirect(`/?school=created&mode=${registrationMode}&tx=${encodeURIComponent(registration.transactionHash)}&contract=${encodeURIComponent(registration.contractAddress || "")}`);
}

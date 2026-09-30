"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { institutions, institutionMembers } from "@/lib/db/schema";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

export async function registerSchool(formData: FormData) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  const name = String(formData.get("name") || "").trim();
  const abbreviation = String(formData.get("abbreviation") || "").trim().toUpperCase();
  if (!name || !/^[A-Z0-9-]{2,15}$/.test(abbreviation)) throw new Error("Enter a school name and valid abbreviation.");
  const id = randomUUID();
  await db.insert(institutions).values({ id, name, abbreviation, country: String(formData.get("country") || "").trim() || null, verificationDomain: String(formData.get("verificationDomain") || "").trim() || null, viceChancellorName: String(formData.get("viceChancellorName") || "").trim() || null, viceChancellorSignatureUrl: String(formData.get("viceChancellorSignatureUrl") || "").trim() || null, registrarName: String(formData.get("registrarName") || "").trim() || null, registrarSignatureUrl: String(formData.get("registrarSignatureUrl") || "").trim() || null, createdByUserId: session.user.id, createdAt: new Date(), updatedAt: new Date() });
  await db.insert(institutionMembers).values({ id: randomUUID(), institutionId: id, userId: session.user.id, role: "representative", status: "active", invitedByUserId: session.user.id, createdAt: new Date() });
  redirect("/?school=created");
}

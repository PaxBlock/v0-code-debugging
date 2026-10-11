"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { institutionMembers } from "@/lib/db/schema";
import { readEncryptedInstitutionMetadata } from "@/lib/institution-metadata";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";

export async function getInstitutionMetadata(input: { institutionId: string; pathname: string }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) throw new Error("Unauthorized.");
  const membership = await db.select({ id: institutionMembers.id }).from(institutionMembers).where(and(eq(institutionMembers.institutionId, input.institutionId), eq(institutionMembers.userId, session.user.id), eq(institutionMembers.status, "active"))).limit(1);
  if (!membership.length || !input.pathname.startsWith(`institutions/${input.institutionId}/`)) throw new Error("Unauthorized.");
  return readEncryptedInstitutionMetadata(input.pathname);
}

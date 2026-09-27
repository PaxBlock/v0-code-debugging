"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { auditLogs, institutionMembers, institutions, user } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { randomUUID } from "crypto";

async function getSession() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  return session;
}

async function getRepresentativeInstitution(userId: string) {
  const [membership] = await db.select().from(institutionMembers).where(and(eq(institutionMembers.userId, userId), eq(institutionMembers.role, "representative"), eq(institutionMembers.status, "active"))).limit(1);
  if (!membership) throw new Error("Only an active school representative can manage issuers.");
  const [institution] = await db.select().from(institutions).where(eq(institutions.id, membership.institutionId)).limit(1);
  if (!institution) throw new Error("School record not found.");
  return institution;
}

async function writeAudit(institutionId: string, actorUserId: string, action: string, targetUserId?: string, metadata: Record<string, string> = {}) {
  await db.insert(auditLogs).values({ id: randomUUID(), institutionId, actorUserId, action, targetUserId: targetUserId ?? null, metadata: JSON.stringify(metadata), createdAt: new Date() });
}

export async function addIssuer(formData: FormData) {
  const session = await getSession();
  const institution = await getRepresentativeInstitution(session.user.id);
  const email = String(formData.get("email") || "").trim().toLowerCase();
  if (!email || !email.includes("@")) throw new Error("Enter a valid issuer email.");
  const [issuer] = await db.select({ id: user.id, email: user.email }).from(user).where(eq(user.email, email)).limit(1);
  if (!issuer) throw new Error("That email does not have a PAX account yet. Ask the issuer to create an account first.");
  const [existing] = await db.select().from(institutionMembers).where(and(eq(institutionMembers.institutionId, institution.id), eq(institutionMembers.userId, issuer.id))).limit(1);
  if (existing) throw new Error("This user is already connected to the school.");
  await db.insert(institutionMembers).values({ id: randomUUID(), institutionId: institution.id, userId: issuer.id, role: "issuer", status: "active", invitedByUserId: session.user.id, createdAt: new Date() });
  await writeAudit(institution.id, session.user.id, "issuer_added", issuer.id, { email });
  redirect("/institution-settings?issuer=added");
}

export async function changeIssuerStatus(formData: FormData) {
  const session = await getSession();
  const institution = await getRepresentativeInstitution(session.user.id);
  const memberId = String(formData.get("memberId") || "");
  const status = String(formData.get("status") || "");
  if (!["active", "suspended", "removed"].includes(status)) throw new Error("Invalid issuer status.");
  const [member] = await db.select().from(institutionMembers).where(and(eq(institutionMembers.id, memberId), eq(institutionMembers.institutionId, institution.id), eq(institutionMembers.role, "issuer"))).limit(1);
  if (!member) throw new Error("Issuer membership not found.");
  await db.update(institutionMembers).set({ status }).where(eq(institutionMembers.id, memberId));
  await writeAudit(institution.id, session.user.id, `issuer_${status}`, member.userId);
  redirect("/institution-settings?issuer=updated");
}

export async function getInstitutionAccess() {
  const session = await getSession();
  const institution = await getRepresentativeInstitution(session.user.id);
  const members = await db.select({ memberId: institutionMembers.id, userId: user.id, name: user.name, email: user.email, role: institutionMembers.role, status: institutionMembers.status, createdAt: institutionMembers.createdAt }).from(institutionMembers).innerJoin(user, eq(user.id, institutionMembers.userId)).where(eq(institutionMembers.institutionId, institution.id));
  const logs = await db.select().from(auditLogs).where(eq(auditLogs.institutionId, institution.id));
  return { institution, members, logs };
}

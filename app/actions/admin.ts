"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, institutions } from "@/lib/db/schema";

export async function getOwnerAuditLogs() {
  return db.select({ id: auditLogs.id, action: auditLogs.action, actorUserId: auditLogs.actorUserId, targetUserId: auditLogs.targetUserId, metadata: auditLogs.metadata, createdAt: auditLogs.createdAt, institutionId: auditLogs.institutionId, institutionName: institutions.name }).from(auditLogs).leftJoin(institutions, eq(auditLogs.institutionId, institutions.id)).orderBy(desc(auditLogs.createdAt)).limit(100);
}

export async function getOwnerInstitutions() {
  return db.select({ id: institutions.id, name: institutions.name, abbreviation: institutions.abbreviation, country: institutions.country, status: institutions.status, subscriptionStatus: institutions.subscriptionStatus, createdAt: institutions.createdAt }).from(institutions).orderBy(desc(institutions.createdAt));
}

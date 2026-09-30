import { desc, eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { auditLogs, institutions } from "@/lib/db/schema";

export async function getOwnerAuditLogs() {
  const rows = await db
    .select({
      id: auditLogs.id,
      action: auditLogs.action,
      actorUserId: auditLogs.actorUserId,
      targetUserId: auditLogs.targetUserId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      institutionId: auditLogs.institutionId,
      institutionName: institutions.name,
    })
    .from(auditLogs)
    .leftJoin(institutions, eq(auditLogs.institutionId, institutions.id))
    .orderBy(desc(auditLogs.createdAt))
    .limit(100);

  return rows.map((row) => ({ ...row, createdAt: row.createdAt.toISOString() }));
}

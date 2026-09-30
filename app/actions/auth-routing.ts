"use server";

import { db } from "@/lib/db";
import { institutionMembers, user } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function maybeLinkApprovedMember(email: string) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return;
  const [newUser] = await db.select({ id: user.id }).from(user).where(eq(user.email, normalized)).limit(1);
  if (!newUser) return;
  await db.update(institutionMembers).set({ status: "active" }).where(and(eq(institutionMembers.userId, newUser.id), eq(institutionMembers.status, "pending")));
}

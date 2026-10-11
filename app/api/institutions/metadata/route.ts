import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { institutionMembers } from "@/lib/db/schema";
import { readEncryptedInstitutionMetadata } from "@/lib/institution-metadata";

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(request.url);
  const institutionId = url.searchParams.get("institutionId");
  const pathname = url.searchParams.get("pathname");
  if (!institutionId || !pathname || pathname.includes("..") || pathname.startsWith("/") || !pathname.startsWith(`institutions/${institutionId}/`)) {
    return NextResponse.json({ error: "Missing or invalid metadata reference" }, { status: 400 });
  }

  const [membership] = await db.select({ id: institutionMembers.id }).from(institutionMembers).where(and(eq(institutionMembers.institutionId, institutionId), eq(institutionMembers.userId, session.user.id), eq(institutionMembers.status, "active"))).limit(1);
  if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const metadata = await readEncryptedInstitutionMetadata(pathname);
    return NextResponse.json({ metadata });
  } catch (error) {
    console.error("[v0] Institution metadata retrieval failed", error);
    return NextResponse.json({ error: "Metadata unavailable" }, { status: 404 });
  }
}

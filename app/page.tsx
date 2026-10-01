import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import WalletlessDashboard from "@/components/walletless-dashboard";
import IssuerWorkspace from "@/components/issuer-workspace";
import { db } from "@/lib/db";
import { institutionMembers, institutions } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  const [membership] = await db.select({ role: institutionMembers.role, status: institutionMembers.status, institutionName: institutions.name }).from(institutionMembers).leftJoin(institutions, eq(institutionMembers.institutionId, institutions.id)).where(eq(institutionMembers.userId, session.user.id)).limit(1);
  if (membership?.status === "active" && membership.role === "issuer") return <IssuerWorkspace userName={session.user.name || session.user.email} institutionName={membership.institutionName ?? "your institution"} />;
  return <WalletlessDashboard userName={session.user.name || session.user.email} membership={membership ?? null} />;
}

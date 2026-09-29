import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import WalletlessDashboard from "@/components/walletless-dashboard";

export default async function HomePage() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect("/sign-in");
  return <WalletlessDashboard userName={session.user.name || session.user.email} />;
}

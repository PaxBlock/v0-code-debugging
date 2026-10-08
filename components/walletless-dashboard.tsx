"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { IssueCredentialsUI } from "@/components/issue-credentials-ui";
import { ApiAccessUI } from "@/components/api-access-ui";

const nav = ["overview", "school", "issuers", "issue", "api", "activity"] as const;

export function WalletlessDashboard({ userName, membership }: { userName: string; membership: { role: string; status: string; institutionName: string | null } | null }) {
  const [section, setSection] = useState<(typeof nav)[number]>("issue");
  return <main className="min-h-screen bg-[#f6f8f7] text-[#10251f]"><div className="flex min-h-screen"><aside className="hidden w-64 shrink-0 bg-[#10251f] px-5 py-6 text-white lg:block"><Link href="/" className="mb-10 block text-xl font-black">PAX <span className="text-[#b9f36b]">Workspace</span></Link><nav className="space-y-1">{nav.map((item) => <button key={item} onClick={() => setSection(item)} className={`block w-full rounded-xl px-3 py-3 text-left text-sm capitalize ${section === item ? "bg-white font-semibold text-[#10251f]" : "text-[#b7ccc3] hover:bg-white/10"}`}>{item === "school" ? "School Profile" : item === "issuers" ? "Issuers" : item === "issue" ? "Issue Credentials" : item === "api" ? "API Access" : item === "activity" ? "Activity Log" : "Overview"}</button>)}</nav></aside><section className="min-w-0 flex-1"><header className="flex items-center justify-between border-b border-[#dce8e2] bg-white px-5 py-4 md:px-10"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3b806a]">PAX workspace</p><h1 className="mt-1 text-xl font-bold">Good to see you, {userName.split(" ")[0]}</h1></div><div className="flex items-center gap-3"><span className="hidden rounded-full bg-[#eef8e8] px-3 py-2 text-xs font-semibold text-[#397451] sm:inline">Account active</span><button onClick={() => authClient.signOut().then(() => location.assign("/sign-in"))} className="rounded-xl border border-[#dce8e2] px-3 py-2 text-sm font-semibold">Sign out</button></div></header><div className="mx-auto max-w-6xl p-5 md:p-10"><p className="text-sm text-[#3b806a]">{section === "issue" ? "Issuance workspace" : "Workspace"}</p><h2 className="mt-2 text-4xl font-black tracking-tight">{section === "issue" ? "Issue certificates" : section === "school" ? "School profile" : section === "issuers" ? "Issuers" : section === "api" ? "API access" : section === "activity" ? "Activity log" : "Overview"}</h2>{section === "api" && <ApiAccessUI institutionName={membership?.institutionName ?? null} />}<p className="mt-3 text-[#61756c]">{section === "issue" ? "Upload your CSV from the issuance workspace." : "This workspace section is ready for the next UI pass."}</p>{section === "issue" && <div className="mt-8"><IssueCredentialsUI /></div>}</div></section></div></main>;
}

export default WalletlessDashboard;

"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const nav = [
  { id: "overview", label: "Overview" },
  { id: "school", label: "School profile" },
  { id: "issuers", label: "Issuers" },
  { id: "issue", label: "Issue credentials" },
  { id: "api", label: "API access" },
  { id: "activity", label: "Activity log" },
];

export function WalletlessDashboard({ userName }: { userName: string }) {
  const [section, setSection] = useState("overview");
  const [csvName, setCsvName] = useState("");
  const [issuerEmail, setIssuerEmail] = useState("");
  const [issuers, setIssuers] = useState<string[]>([]);
  const [notice, setNotice] = useState("");

  function addIssuer() {
    if (!issuerEmail || issuers.includes(issuerEmail)) return;
    setIssuers([...issuers, issuerEmail]);
    setIssuerEmail("");
    setNotice("Issuer approved. They can sign in with this email to access PAX.");
  }

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-[#10251f]">
      <div className="flex min-h-screen">
        <aside className="hidden w-64 shrink-0 flex-col border-r border-[#dce8e2] bg-[#10251f] px-5 py-6 text-white lg:flex">
          <Link href="/" className="mb-10 flex items-center gap-3"><span className="grid size-9 place-items-center rounded-xl bg-[#b9f36b] font-black text-[#10251f]">P</span><span><strong className="block tracking-tight">PAX</strong><small className="text-xs text-[#a9c2b8]">Credential Platform</small></span></Link>
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.2em] text-[#78998c]">Workspace</p>
          <nav className="flex flex-col gap-1">{nav.map((item) => <button key={item.id} onClick={() => setSection(item.id)} className={`rounded-xl px-3 py-3 text-left text-sm transition ${section === item.id ? "bg-white text-[#10251f] font-semibold" : "text-[#b7ccc3] hover:bg-white/10 hover:text-white"}`}>{item.label}</button>)}</nav>
          <div className="mt-auto rounded-2xl border border-white/10 bg-white/[0.06] p-4"><p className="text-xs text-[#9cb6aa]">Blockchain handled by PAX</p><p className="mt-1 text-sm font-medium">No wallet or crypto steps.</p></div>
        </aside>
        <section className="min-w-0 flex-1">
          <header className="flex items-center justify-between border-b border-[#dce8e2] bg-white px-5 py-4 md:px-10"><div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3b806a]">PAX workspace</p><h1 className="mt-1 text-xl font-bold">Good to see you, {userName.split(" ")[0]}</h1></div><div className="flex items-center gap-3"><span className="hidden rounded-full bg-[#eef8e8] px-3 py-2 text-xs font-semibold text-[#397451] sm:inline">Account active</span><button onClick={() => authClient.signOut().then(() => location.assign("/sign-in"))} className="rounded-xl border border-[#dce8e2] px-3 py-2 text-sm font-semibold">Sign out</button></div></header>
          <div className="border-b border-[#dce8e2] bg-white px-5 py-3 lg:hidden"><select value={section} onChange={(e) => setSection(e.target.value)} className="w-full rounded-xl border border-[#dce8e2] bg-white px-3 py-2 text-sm">{nav.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></div>
          <div className="mx-auto max-w-6xl p-5 md:p-10">
            {notice && <div role="status" className="mb-6 rounded-xl border border-[#b9e8b1] bg-[#effbea] px-4 py-3 text-sm text-[#2e6d46]">{notice}</div>}
            {section === "overview" && <><div className="mb-8 flex flex-col justify-between gap-5 md:flex-row md:items-end"><div><p className="text-sm font-semibold text-[#3b806a]">Your institution workspace</p><h2 className="mt-2 text-4xl font-black tracking-tight md:text-5xl">Set up your school.<br /><span className="text-[#3b806a]">Issue with confidence.</span></h2><p className="mt-4 max-w-xl text-[#61756c]">PAX keeps the blockchain in the background so your team can manage trusted credentials like any normal application.</p></div><button onClick={() => setSection("school")} className="rounded-xl bg-[#10251f] px-5 py-3 text-sm font-bold text-white hover:bg-[#23463a]">Register your school</button></div><div className="grid gap-4 md:grid-cols-3"><div className="rounded-2xl border border-[#dce8e2] bg-white p-5"><p className="text-sm text-[#71877c]">Setup status</p><p className="mt-3 text-2xl font-bold">Not submitted</p><span className="mt-2 inline-block rounded-full bg-[#fff4d8] px-2.5 py-1 text-xs font-semibold text-[#8b6819]">Action needed</span></div><div className="rounded-2xl border border-[#dce8e2] bg-white p-5"><p className="text-sm text-[#71877c]">Approved issuers</p><p className="mt-3 text-2xl font-bold">{issuers.length}</p><span className="mt-2 inline-block text-xs text-[#71877c]">Manage school access</span></div><div className="rounded-2xl border border-[#dce8e2] bg-white p-5"><p className="text-sm text-[#71877c]">Certificates</p><p className="mt-3 text-2xl font-bold">0</p><span className="mt-2 inline-block text-xs text-[#71877c]">Ready after approval</span></div></div></>}
            {section === "school" && <div className="max-w-3xl"><p className="text-sm font-semibold text-[#3b806a]">School onboarding</p><h2 className="mt-2 text-4xl font-black">Register your school</h2><p className="mt-3 text-[#61756c]">Tell us about your institution. PAX will review the details and confirm access before your team starts issuing.</p><div className="mt-8 grid gap-5 rounded-2xl border border-[#dce8e2] bg-white p-6 md:grid-cols-2"><label className="text-sm font-semibold">School name<input className="mt-2 w-full rounded-xl border border-[#dce8e2] px-4 py-3 font-normal" placeholder="University of Lagos" /></label><label className="text-sm font-semibold">School abbreviation<input className="mt-2 w-full rounded-xl border border-[#dce8e2] px-4 py-3 uppercase font-normal" placeholder="UNILAG" /></label><label className="text-sm font-semibold">Country<input className="mt-2 w-full rounded-xl border border-[#dce8e2] px-4 py-3 font-normal" placeholder="Nigeria" /></label><label className="text-sm font-semibold">Verification domain<input className="mt-2 w-full rounded-xl border border-[#dce8e2] px-4 py-3 font-normal" placeholder="verify.university.edu" /></label><label className="text-sm font-semibold md:col-span-2">Registrar name<input className="mt-2 w-full rounded-xl border border-[#dce8e2] px-4 py-3 font-normal" placeholder="Full name" /></label><button onClick={() => setNotice("School registration submitted. PAX will review and confirm your institution.")} className="rounded-xl bg-[#10251f] px-5 py-3 text-sm font-bold text-white md:col-span-2">Confirm school registration</button></div></div>}
            {section === "issuers" && <div className="max-w-4xl"><p className="text-sm font-semibold text-[#3b806a]">Team access</p><h2 className="mt-2 text-4xl font-black">Approved issuers</h2><p className="mt-3 text-[#61756c]">Add the exact email addresses of staff who should issue certificates for your school.</p><div className="mt-8 rounded-2xl border border-[#dce8e2] bg-white p-6"><div className="flex flex-col gap-3 md:flex-row"><input value={issuerEmail} onChange={(e) => setIssuerEmail(e.target.value)} type="email" placeholder="issuer@university.edu" className="flex-1 rounded-xl border border-[#dce8e2] px-4 py-3" /><button onClick={addIssuer} className="rounded-xl bg-[#10251f] px-5 py-3 text-sm font-bold text-white">Approve issuer</button></div><div className="mt-6 flex flex-col gap-3">{issuers.length === 0 ? <p className="rounded-xl bg-[#f6f8f7] p-4 text-sm text-[#71877c]">No issuers added yet.</p> : issuers.map((email) => <div key={email} className="flex items-center justify-between rounded-xl border border-[#dce8e2] p-4"><span className="text-sm font-medium">{email}</span><button onClick={() => setIssuers(issuers.filter((item) => item !== email))} className="text-sm font-semibold text-red-700">Remove</button></div>)}</div></div></div>}
            {section === "issue" && <div className="max-w-4xl"><p className="text-sm font-semibold text-[#3b806a]">Credential issuance</p><h2 className="mt-2 text-4xl font-black">Issue certificates</h2><p className="mt-3 text-[#61756c]">Upload the same CSV your team already uses. PAX submits the blockchain work automatically after you confirm.</p><div className="mt-8 rounded-2xl border border-dashed border-[#9bb9aa] bg-white p-10 text-center"><input id="csv" type="file" accept=".csv" className="sr-only" onChange={(e) => setCsvName(e.target.files?.[0]?.name || "")} /><label htmlFor="csv" className="cursor-pointer"><span className="text-4xl">+</span><span className="mt-3 block font-bold">Choose CSV file</span><span className="mt-1 block text-sm text-[#71877c]">Student records, grades, faculty and certificate details</span></label>{csvName && <p className="mt-5 rounded-xl bg-[#effbea] p-3 text-sm font-semibold text-[#2e6d46]">{csvName} ready to review</p>}<button disabled={!csvName} onClick={() => setNotice("Issuance confirmed. PAX is processing the certificates in the background.")} className="mt-6 rounded-xl bg-[#10251f] px-6 py-3 text-sm font-bold text-white disabled:opacity-40">Confirm issuance</button></div><div className="mt-5 rounded-2xl border border-[#dce8e2] bg-[#eef8e8] p-5 text-sm text-[#397451]"><strong>No wallet required.</strong> PAX handles the blockchain transaction and gas in the background. Your team only confirms the CSV.</div></div>}
            {section === "api" && <div className="max-w-3xl"><p className="text-sm font-semibold text-[#3b806a]">Developer access</p><h2 className="mt-2 text-4xl font-black">Request API access</h2><p className="mt-3 text-[#61756c]">Submit a request and the PAX team will review it using the existing approval process.</p><div className="mt-8 rounded-2xl border border-[#dce8e2] bg-white p-6"><textarea className="min-h-32 w-full rounded-xl border border-[#dce8e2] px-4 py-3" placeholder="Tell us how your institution plans to use the API" /><button onClick={() => setNotice("API request submitted for PAX review.")} className="mt-4 rounded-xl bg-[#10251f] px-5 py-3 text-sm font-bold text-white">Submit API request</button></div></div>}
            {section === "activity" && <div className="max-w-4xl"><p className="text-sm font-semibold text-[#3b806a]">Audit trail</p><h2 className="mt-2 text-4xl font-black">Activity log</h2><p className="mt-3 text-[#61756c]">A record of school access, issuer permissions, approvals, and certificate actions.</p><div className="mt-8 rounded-2xl border border-[#dce8e2] bg-white p-6"><p className="text-sm text-[#71877c]">No activity yet. Actions will appear here as your school setup progresses.</p></div></div>}
          </div>
        </section>
      </div>
    </main>
  );
}

export default WalletlessDashboard;

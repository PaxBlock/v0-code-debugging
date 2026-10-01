"use client";

import Link from "next/link";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export function IssuerWorkspace({ userName, institutionName }: { userName: string; institutionName: string }) {
  const [fileName, setFileName] = useState("");
  return (
    <main className="min-h-screen bg-[#f6f8f7] text-[#10251f]">
      <header className="flex items-center justify-between border-b border-[#dce8e2] bg-white px-5 py-4 md:px-10">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3b806a]">PAX issuer workspace</p><h1 className="mt-1 text-xl font-bold">Good to see you, {userName.split(" ")[0]}</h1><p className="mt-1 text-sm text-[#71877c]">{institutionName} · Issuer</p></div>
        <button onClick={() => authClient.signOut().then(() => location.assign("/sign-in"))} className="rounded-xl border border-[#dce8e2] px-3 py-2 text-sm font-semibold">Sign out</button>
      </header>
      <div className="mx-auto max-w-4xl p-5 md:p-10">
        <div className="mb-8"><p className="text-sm font-semibold text-[#3b806a]">Issuance-only access</p><h2 className="mt-2 text-4xl font-black tracking-tight">Issue certificates</h2><p className="mt-3 max-w-2xl text-[#61756c]">You can issue certificates for {institutionName}. School profile, team access, API settings, and PAX owner controls are not available to issuers.</p></div>
        <section className="rounded-2xl border border-[#dce8e2] bg-white p-6"><h3 className="text-xl font-bold">Bulk issue from CSV</h3><p className="mt-2 text-sm text-[#61756c]">Use the approved columns: StudentName, StudentEmail, WalletAddress, PrivateKey, CourseName, Grade, PaxID, FacultyName.</p><label className="mt-6 block cursor-pointer rounded-2xl border-2 border-dashed border-[#9bb9aa] p-10 text-center"><input type="file" accept=".csv" className="sr-only" onChange={(event) => setFileName(event.target.files?.[0]?.name ?? "")} /><span className="font-bold">Choose CSV file</span><span className="mt-2 block text-sm text-[#71877c]">{fileName || "No file selected"}</span></label><button disabled={!fileName} className="mt-5 rounded-xl bg-[#10251f] px-5 py-3 text-sm font-bold text-white disabled:opacity-40">Review issuance</button></section>
        <section className="mt-5 rounded-2xl border border-[#dce8e2] bg-[#eef8e8] p-5 text-sm text-[#397451]"><strong>Blockchain handled by PAX.</strong> Your approved issuance is recorded against the institution&apos;s private programme contract. You do not need a wallet or private key.</section>
        <Link href="/" className="mt-6 inline-block text-sm font-bold text-[#3b806a]">Back to account</Link>
      </div>
    </main>
  );
}

export default IssuerWorkspace;

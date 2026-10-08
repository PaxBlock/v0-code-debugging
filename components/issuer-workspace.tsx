"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

const CSV_COLUMNS = ["StudentName", "StudentEmail", "WalletAddress", "PrivateKey", "CourseName", "Grade", "PaxID", "FacultyName"];

function downloadTemplate() {
  const csv = `${CSV_COLUMNS.join(",")}\n,,,,,,,\n`;
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "pax-certificate-issuance-template.csv";
  link.click();
  URL.revokeObjectURL(url);
}

export function IssuerWorkspace({ userName, institutionName }: { userName: string; institutionName: string }) {
  const [fileName, setFileName] = useState("");
  const [fileSize, setFileSize] = useState(0);

  return (
    <main className="min-h-screen bg-[#f6f8f7] text-[#10251f]">
      <header className="flex items-center justify-between border-b border-[#dce8e2] bg-white px-5 py-4 md:px-10">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#3b806a]">PAX issuer workspace</p>
          <h1 className="mt-1 text-xl font-bold">Good to see you, {userName.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-[#71877c]">{institutionName} · Issuer</p>
        </div>
        <button onClick={() => authClient.signOut().then(() => location.assign("/sign-in"))} className="rounded-xl border border-[#dce8e2] px-3 py-2 text-sm font-semibold">Sign out</button>
      </header>

      <div className="mx-auto max-w-5xl p-5 md:p-10">
        <div className="mb-8">
          <p className="text-sm font-semibold text-[#3b806a]">Issuance-only access</p>
          <h2 className="mt-2 text-4xl font-black tracking-tight">Issue certificates</h2>
          <p className="mt-3 max-w-3xl text-[#61756c]">You can issue certificates for {institutionName}. School profile, team access, API settings, and PAX owner controls are not available to issuers.</p>
        </div>

        <section className="rounded-2xl border border-[#d9a28e] bg-white p-6 md:p-9" aria-labelledby="bulk-issue-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 id="bulk-issue-title" className="flex items-center gap-3 text-2xl font-bold"><span className="rounded-full bg-[#ed4b1f] px-3 py-1 text-base text-black">Bulk</span> Issue Multiple Certificates (CSV)</h3>
            <span className="text-sm font-medium">Issuer only</span>
          </div>
          <p className="mt-6 max-w-4xl text-lg leading-7 text-[#183f68]">Upload a CSV to issue certificates in batches. Students may provide their own wallet address, or the institution can create one at wallet.paxblockchain.com. Add a PrivateKey only for institution-created wallets; it is used for the one-time student email and never retained by Pax.</p>

          <div className="mt-7">
            <h4 className="text-xl font-semibold text-[#294c70]">Step 1: Download CSV Template</h4>
            <button type="button" onClick={downloadTemplate} className="mt-3 rounded-md bg-[#f7f8f9] px-4 py-3 text-base shadow-sm hover:bg-[#edf1ef]">Download Template</button>
            <p className="mt-2 text-base leading-6 text-[#294c70]">Columns: {CSV_COLUMNS.join(", ")}. Leave PrivateKey blank when the student supplied the wallet. StudentEmail is required when PrivateKey is present.</p>
          </div>

          <div className="mt-7">
            <h4 className="text-xl font-semibold text-[#294c70]">Step 2: Upload CSV File</h4>
            <label className="mt-3 flex cursor-pointer items-center rounded-xl border border-[#cfd9d5] bg-white px-6 py-5 text-lg shadow-sm hover:border-[#3b806a]">
              <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; setFileName(file?.name ?? ""); setFileSize(file?.size ?? 0); }} />
              <span className="rounded-md border border-[#888] px-3 py-2 text-base">Choose File</span>
              <span className="ml-3">{fileName || "No file chosen"}</span>
            </label>
            <p className="mt-2 text-base text-[#294c70]">Select a CSV file with student data.</p>{fileName && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#b8d8c6] bg-[#f1fbf4] px-4 py-3 text-sm"><span><strong>{fileName}</strong><span className="ml-2 text-[#61756c]">{(fileSize / 1024).toFixed(1)} KB selected</span></span><button type="button" onClick={() => { setFileName(""); setFileSize(0); }} className="font-semibold text-[#a33b22]">Remove</button></div>}<button type="button" disabled={!fileName} className="mt-5 w-full rounded-xl bg-[#ed4b1f] px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-40">Review CSV before issuing</button><p className="mt-2 text-xs text-[#71877c]">Issuance is not connected yet. Review and blockchain submission will be enabled in the next step.</p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default IssuerWorkspace;

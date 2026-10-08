"use client";

import { useState } from "react";

export function ApiAccessUI({ institutionName }: { institutionName: string | null }) {
  const [submitted, setSubmitted] = useState(false);
  const [name, setName] = useState(institutionName ?? "");
  const [reason, setReason] = useState("");
  return (
    <section className="mt-8 max-w-3xl rounded-3xl border border-[#d9e5df] bg-white p-6 shadow-sm md:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4"><div><span className="rounded-full bg-[#e8f7df] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#397451]">Coming soon</span><h3 className="mt-4 text-2xl font-black">Request API access</h3><p className="mt-2 leading-7 text-[#61756c]">Tell us about your institution and how you plan to use the PAX certificate API. We will review your request before access is enabled.</p></div><div className="rounded-2xl border border-[#f0d8b8] bg-[#fff8ee] px-4 py-3 text-sm text-[#805b2a]"><strong>Paid access later</strong><br />Billing will be added before activation.</div></div>
      <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true); }} className="mt-8 grid gap-5"><label className="text-sm font-bold">Institution name<input value={name} onChange={(event) => setName(event.target.value)} required className="mt-2 w-full rounded-xl border border-[#d9e5df] px-4 py-3 font-normal outline-none focus:border-[#3b806a]" placeholder="University of Lagos" /></label><label className="text-sm font-bold">Why do you want to use the API?<textarea value={reason} onChange={(event) => setReason(event.target.value)} required rows={6} className="mt-2 w-full resize-y rounded-xl border border-[#d9e5df] px-4 py-3 font-normal outline-none focus:border-[#3b806a]" placeholder="Describe your certificate verification or issuance integration..." /></label><button type="submit" className="rounded-xl bg-[#10251f] px-5 py-3 font-bold text-white">Submit API access request</button>{submitted && <p role="status" className="rounded-xl bg-[#eef8e8] px-4 py-3 text-sm font-semibold text-[#397451]">Request saved for review. API activation and billing will be configured later.</p>}</form>
    </section>
  );
}

export default ApiAccessUI;

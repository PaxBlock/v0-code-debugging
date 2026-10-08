"use client";

import { useState } from "react";

const entries = [
  { action: "Institution profile opened", detail: "School representative workspace", time: "Today, 09:42", tone: "green" },
  { action: "Issuer access reviewed", detail: "Team management", time: "Yesterday, 16:18", tone: "blue" },
  { action: "CSV issuance workspace viewed", detail: "Issuance workspace", time: "Yesterday, 11:05", tone: "orange" },
];

export function ActivityLogUI() {
  const [filter, setFilter] = useState("All activity");
  return <section className="mt-6 max-w-5xl space-y-5"><div className="rounded-2xl border border-[#dce8e2] bg-white p-6 md:p-8"><div className="flex flex-col justify-between gap-4 md:flex-row md:items-start"><div><span className="inline-flex rounded-full bg-[#eaf8e9] px-3 py-1 text-xs font-bold uppercase tracking-wide text-[#397451]">School representative</span><h3 className="mt-3 text-2xl font-black">Activity log</h3><p className="mt-2 max-w-2xl text-sm leading-6 text-[#61756c]">Review important actions taken in this institution workspace. Detailed event tracking and export tools will be connected in a later pass.</p></div><select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-xl border border-[#dce8e2] bg-white px-3 py-2 text-sm font-semibold text-[#294c70]"><option>All activity</option><option>Profile</option><option>Issuers</option><option>Issuance</option></select></div><div className="mt-7 divide-y divide-[#edf2ef]">{entries.map((entry) => <article key={entry.action} className="flex gap-4 py-5 first:pt-0 last:pb-0"><span className={`mt-1 h-3 w-3 shrink-0 rounded-full ${entry.tone === "green" ? "bg-[#62c98b]" : entry.tone === "blue" ? "bg-[#6a9ed1]" : "bg-[#ed6a3a]"}`} aria-hidden="true" /><div className="min-w-0 flex-1"><div className="flex flex-col justify-between gap-1 sm:flex-row"><h4 className="font-bold text-[#10251f]">{entry.action}</h4><time className="text-xs text-[#71877c]">{entry.time}</time></div><p className="mt-1 text-sm text-[#61756c]">{entry.detail}</p></div></article>)}</div></div><div className="rounded-2xl border border-dashed border-[#b9d5c4] bg-[#f5fbf6] p-5 text-sm text-[#4d6d5d]"><strong>Coming next:</strong> actor identity, exact timestamps, audit events, and downloadable activity history.</div></section>;
}

export default ActivityLogUI;

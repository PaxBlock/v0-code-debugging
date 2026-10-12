"use client";

import { useFormStatus } from "react-dom";
import { registerSchool } from "@/app/actions/institutions";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded-xl border border-[#ed4b1f] bg-[#fff4ed] px-5 py-3 font-bold text-[#a33b22] disabled:opacity-50">{pending ? "Submitting to Sepolia…" : "Register test institution on Sepolia"}</button>;
}

export function TestRegistrationPanel() {
  return <section className="mt-4 rounded-2xl border border-[#f3c7ad] bg-[#fff8f3] p-5"><h3 className="font-bold text-[#7f4229]">Sepolia test registration</h3><p className="mt-1 text-sm text-[#7f4229]">This uses the same encrypted metadata and PAX-wallet transaction flow as production. Use a test name beginning with “PAX Test”.</p><form action={registerSchool} className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px_auto]"><input name="name" required placeholder="PAX Test University" className="rounded-xl border border-[#edcfbf] bg-white px-4 py-3" /><input name="abbreviation" required placeholder="PAXTEST" className="rounded-xl border border-[#edcfbf] bg-white px-4 py-3 uppercase" /><input type="hidden" name="registrationMode" value="test" /><SubmitButton /></form></section>;
}

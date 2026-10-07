"use client";

import { useState } from "react";
import { addFacultyDean } from "@/app/actions/issuer-management";
import { SignaturePad } from "@/components/signature-pad";

export function DeanManager() {
  const [deans, setDeans] = useState<Array<{ faculty: string; dean: string }>>([]);
  const [faculty, setFaculty] = useState("");
  const [dean, setDean] = useState("");
  function addDean() {
    if (!faculty.trim() || !dean.trim()) return;
    setDeans((items) => [...items, { faculty: faculty.trim(), dean: dean.trim() }]);
    setFaculty("");
    setDean("");
  }
  return <section className="mt-6 rounded-2xl border border-[#dce8e2] bg-white p-6"><p className="text-sm font-semibold text-[#67e8a0]">Configure Faculties &amp; Degree Programs</p><p className="mt-2 text-sm leading-6 text-[#61756c]">Add a dean for each faculty or degree program. Add another faculty after saving the previous one.</p><form action={addFacultyDean} onSubmit={addDean} className="mt-5 grid gap-4"><label className="text-sm font-semibold">Faculty / Degree Program Name<input name="facultyName" value={faculty} onChange={(event) => setFaculty(event.target.value)} required className="mt-2 w-full rounded-xl border border-[#dce8e2] px-4 py-3 font-normal" placeholder="e.g. Faculty of Science (BSc)" /></label><label className="text-sm font-semibold">Dean&apos;s Name<input name="deanName" value={dean} onChange={(event) => setDean(event.target.value)} required className="mt-2 w-full rounded-xl border border-[#dce8e2] px-4 py-3 font-normal" placeholder="e.g. Prof. Adewale Olumide" /></label><SignaturePad label="Dean" /><button type="submit" className="rounded-xl bg-[#16a34a] px-5 py-3 font-bold text-white">+ Add Faculty</button></form>{deans.length > 0 && <div className="mt-5 space-y-2">{deans.map((item, index) => <div key={`${item.faculty}-${index}`} className="flex items-center justify-between rounded-xl border border-[#dce8e2] px-4 py-3 text-sm"><span><strong>{item.faculty}</strong><span className="ml-2 text-[#61756c]">{item.dean}</span></span><button type="button" onClick={() => setDeans((items) => items.filter((_, itemIndex) => itemIndex !== index))} className="font-semibold text-red-700">Remove</button></div>)}</div>}</section>;
}

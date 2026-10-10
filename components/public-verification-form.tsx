'use client'

import { useState } from 'react'

export function PublicVerificationForm() {
  const [mode, setMode] = useState<'pax' | 'wallet'>('wallet')
  const [value, setValue] = useState('')
  const [message, setMessage] = useState('')

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setMessage(value.trim() ? 'Verification lookup is ready to connect to the Sepolia registry.' : 'Enter a PaxID, matriculation number, or wallet address to continue.')
  }

  return <main className="min-h-screen bg-[#f7faf8] px-4 py-12 text-[#10251f] sm:px-6"><div className="mx-auto max-w-3xl"><header className="mb-8 flex items-center justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.24em] text-[#2f8b68]">PAX public verification</p><h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Verify a Certificate</h1></div><span className="rounded-full border border-[#cfe3d8] bg-white px-3 py-2 text-xs font-semibold text-[#497263]">No account required</span></header><section className="rounded-2xl border border-[#d8e6df] bg-white p-6 shadow-[0_18px_50px_rgba(16,37,31,0.06)] sm:p-8"><p className="max-w-2xl leading-7 text-[#536e63]">Confirm the authenticity of any certificate issued through this platform. Open to the public — no account or wallet needed.</p><form onSubmit={submit} className="mt-8 space-y-6"><label className="block text-sm font-semibold">Select Institution &amp; Programme<select className="mt-2 w-full rounded-xl border border-[#d2e1da] bg-white px-4 py-3 text-[#536e63]"><option>No programmes registered yet</option></select></label><div><div className="grid grid-cols-2 rounded-xl bg-[#f5f8f6] p-1 text-sm font-semibold"><button type="button" onClick={() => setMode('pax')} className={`rounded-lg px-4 py-3 ${mode === 'pax' ? 'bg-white text-[#10251f] shadow-sm' : 'text-[#6d8278]'}`}>Search by PaxID / Matric No.</button><button type="button" onClick={() => setMode('wallet')} className={`rounded-lg px-4 py-3 ${mode === 'wallet' ? 'bg-[#ed4b1f] text-black' : 'text-[#6d8278]'}`}>Search by Wallet Address</button></div><label className="mt-5 block text-sm font-semibold">{mode === 'wallet' ? 'Graduate Wallet Address' : 'PaxID / Matriculation Number'}<input value={value} onChange={(event) => setValue(event.target.value)} className="mt-2 w-full rounded-xl border border-[#d2e1da] px-4 py-3 font-normal outline-none focus:border-[#2f8b68]" placeholder={mode === 'wallet' ? "0x... (the graduate's wallet address)" : 'e.g. PAX-2026-001'} /></label></div><button type="submit" className="w-full rounded-xl bg-[#9134e8] px-5 py-4 font-bold text-white transition hover:bg-[#7e27d0]">Verify Certificate</button>{message && <p role="status" className="rounded-xl bg-[#f1f8f3] px-4 py-3 text-sm text-[#35634f]">{message}</p>}</form></section><p className="mt-5 text-center text-xs text-[#789087]">Verification will validate the certificate record against the PAX Sepolia registry once the contract integration is connected.</p></div></main>
}

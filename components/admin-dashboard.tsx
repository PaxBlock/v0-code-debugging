'use client'

import { useState } from 'react'

const sections = [
  { id: 'overview', label: 'Overview', icon: '01' },
  { id: 'institutions', label: 'Institutions', icon: '02' },
  { id: 'api', label: 'API requests', icon: '03' },
  { id: 'activity', label: 'Audit activity', icon: '04' },
]

export default function AdminDashboard() {
  const [active, setActive] = useState('overview')
  const [notice, setNotice] = useState('')

  async function signOut() {
    await fetch('/api/admin/login', { method: 'DELETE' })
    window.location.assign('/admin-login')
  }

  return <main className="min-h-screen bg-[#f5f8f6] text-[#15251e]">
    <div className="flex min-h-screen">
      <aside className="hidden w-72 flex-col border-r border-[#dce8e2] bg-[#10231c] px-5 py-6 text-white lg:flex">
        <div className="px-3"><p className="text-xs font-bold uppercase tracking-[0.25em] text-[#82d6ae]">PAX</p><p className="mt-2 text-xl font-semibold">Owner console</p><p className="mt-2 text-sm text-[#a7beb3]">Platform administration</p></div>
        <nav className="mt-10 flex flex-col gap-2">{sections.map((section) => <button key={section.id} onClick={() => setActive(section.id)} className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold transition ${active === section.id ? 'bg-[#2d6d58] text-white' : 'text-[#b9cec4] hover:bg-white/10'}`}><span className="text-xs text-[#82d6ae]">{section.icon}</span>{section.label}</button>)}</nav>
        <div className="mt-auto border-t border-white/10 pt-5"><p className="px-3 text-xs text-[#9eb5aa]">Signed in as</p><p className="mt-1 px-3 text-sm font-semibold">paxblockchain1@gmail.com</p><button onClick={signOut} className="mt-4 w-full rounded-xl border border-white/15 px-3 py-2 text-sm font-semibold hover:bg-white/10">Sign out</button></div>
      </aside>
      <section className="flex-1 px-5 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto max-w-6xl"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-[#3b806a]">PAX Credential Platform</p><h1 className="mt-2 text-3xl font-semibold tracking-tight sm:text-4xl">{active === 'overview' ? 'Good morning, PAX team.' : sections.find((section) => section.id === active)?.label}</h1><p className="mt-2 text-sm text-[#668077]">Manage institutions and approvals without touching their day-to-day workspace.</p></div><button onClick={signOut} className="rounded-xl border border-[#dce8e2] bg-white px-4 py-2 text-sm font-semibold lg:hidden">Sign out</button></div>
          <div className="mt-8 grid gap-4 sm:grid-cols-3"><article className="rounded-2xl border border-[#dce8e2] bg-white p-5"><p className="text-sm text-[#668077]">Institutions</p><p className="mt-3 text-3xl font-semibold">0</p><p className="mt-2 text-xs text-[#668077]">Awaiting your first school registration</p></article><article className="rounded-2xl border border-[#dce8e2] bg-white p-5"><p className="text-sm text-[#668077]">Pending approvals</p><p className="mt-3 text-3xl font-semibold">0</p><p className="mt-2 text-xs text-[#668077]">School onboarding queue</p></article><article className="rounded-2xl border border-[#dce8e2] bg-white p-5"><p className="text-sm text-[#668077]">API requests</p><p className="mt-3 text-3xl font-semibold">0</p><p className="mt-2 text-xs text-[#668077]">Requests requiring review</p></article></div>
          <div className="mt-6 rounded-2xl border border-[#dce8e2] bg-white p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-semibold">{active === 'institutions' ? 'Institution approvals' : active === 'api' ? 'API access requests' : active === 'activity' ? 'Audit activity' : 'Owner actions'}</h2><p className="mt-1 text-sm text-[#668077]">{active === 'overview' ? 'Your owner workspace is ready. New school registrations and API requests will appear here.' : 'This section is ready for live records as the walletless workflow is connected.'}</p></div>{active === 'institutions' && <button onClick={() => setNotice('School registration review will appear here.')} className="rounded-xl bg-[#1d5745] px-4 py-2 text-sm font-semibold text-white">Review queue</button>}</div>{notice && <p className="mt-5 rounded-xl bg-[#eef8f2] p-3 text-sm text-[#28664e]">{notice}</p>}<div className="mt-8 rounded-xl border border-dashed border-[#cbdcd3] p-8 text-center"><p className="text-sm font-semibold text-[#315a4b]">No records yet</p><p className="mt-1 text-sm text-[#789087]">Approved schools, API requests, and audit events will be visible in this workspace.</p></div></div>
        </div>
      </section>
    </div>
  </main>
}

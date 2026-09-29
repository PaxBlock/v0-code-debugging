'use client'

import { FormEvent, useState } from 'react'
import { useRouter } from 'next/navigation'

export function AdminLoginForm() {
  const router = useRouter()
  const [email, setEmail] = useState('paxblockchain1@gmail.com')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [pending, setPending] = useState(false)

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (event.nativeEvent instanceof SubmitEvent && event.nativeEvent.submitter === null) return
    setPending(true); setError('')
    const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    if (!response.ok) { setError('The administrator email or password is incorrect.'); setPending(false); return }
    router.push('/admin'); router.refresh()
  }

  return <form onSubmit={submit} className="mt-10 flex flex-col gap-5 rounded-2xl border border-white/10 bg-white/[0.06] p-6 shadow-2xl"><label className="flex flex-col gap-2 text-sm font-medium">Administrator email<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none focus:border-emerald-400" required /></label><label className="flex flex-col gap-2 text-sm font-medium">Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-white outline-none focus:border-emerald-400" required /></label>{error && <p role="alert" className="text-sm text-rose-300">{error}</p>}<button disabled={pending} className="rounded-xl bg-emerald-400 px-4 py-3 font-semibold text-slate-950 disabled:opacity-60">{pending ? 'Signing in…' : 'Sign in as PAX owner'}</button><a href="/sign-in" className="text-center text-sm text-slate-400 hover:text-white">Back to school sign in</a></form>
}

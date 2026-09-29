import { AdminLoginForm } from '@/components/admin-login-form'

export default function AdminLoginPage() {
  return <main className="min-h-screen bg-slate-950 px-6 py-16 text-white"><div className="mx-auto max-w-md"><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">PAX Owner access</p><h1 className="mt-4 text-4xl font-semibold tracking-tight">Sign in to administration</h1><p className="mt-4 text-slate-400">Manage institutions, approvals, API access, and platform operations from the owner workspace.</p><AdminLoginForm /></div></main>
}

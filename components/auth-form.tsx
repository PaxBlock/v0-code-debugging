"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      const result = mode === "sign-in"
        ? await authClient.signIn.email({ email: String(data.get("email")), password: String(data.get("password")) })
        : await authClient.signUp.email({ name: String(data.get("name")), email: String(data.get("email")), password: String(data.get("password")) });
      if (result.error) setError("We could not complete that request. Check your details and try again.");
      else { window.location.assign("/"); return; }
    } catch {
      setError("PAX could not reach the sign-in service. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
    <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">PAX Credential Platform</p><h1 className="mt-3 text-3xl font-semibold text-slate-950">{mode === "sign-in" ? "Welcome back" : "Register your PAX account"}</h1><p className="mt-2 text-sm text-slate-600">Manage your school and issue trusted credentials without wallets.</p></div>
    {mode === "sign-up" && <label className="text-sm font-medium text-slate-700">Full name<input name="name" required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>}
    <label className="text-sm font-medium text-slate-700">Work email<input name="email" type="email" required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
    <label className="text-sm font-medium text-slate-700">Password<input name="password" type="password" minLength={8} required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button disabled={pending} className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}</button>
    <a href={mode === "sign-in" ? "/sign-up" : "/sign-in"} className="text-center text-sm text-emerald-700">{mode === "sign-in" ? "New to PAX? Create an account" : "Already have an account? Sign in"}</a>
  </form>;
}

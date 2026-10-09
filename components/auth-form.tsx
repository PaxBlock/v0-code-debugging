"use client";

import { FormEvent, useState } from "react";
import { authClient } from "@/lib/auth-client";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loginAs, setLoginAs] = useState<"school" | "admin">("school");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true); setError("");
    const data = new FormData(event.currentTarget);
    try {
      if (mode === "sign-in" && loginAs === "admin") {
        const response = await fetch("/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
        if (!response.ok) throw new Error("Invalid administrator credentials.");
        window.location.assign("/admin");
        return;
      }
      const result = mode === "sign-in"
        ? await authClient.signIn.email({ email: String(data.get("email")), password: String(data.get("password")) })
        : await authClient.signUp.email({ name: String(data.get("name")), email: String(data.get("email")), password: String(data.get("password")) });
      if (result.error) {
        const code = result.error.code;
        setError(mode === "sign-up" && code === "USER_ALREADY_EXISTS" ? "An account already exists for this email. Sign in instead." : mode === "sign-in" && code === "INVALID_PASSWORD" ? "That password is incorrect. Use Show password to check it, then try again." : result.error.message || "We could not complete that request. Check your details and try again.");
      }
      else { window.location.assign("/"); return; }
    } catch (error) {
      setError(error instanceof Error && error.message === "Invalid administrator credentials." ? error.message : "PAX could not reach the sign-in service. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return <form onSubmit={submit} className="mx-auto flex w-full max-w-md flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-8 shadow-xl">
    <div><p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-700">PAX Credential Platform</p><h1 className="mt-3 text-3xl font-semibold text-slate-950">{mode === "sign-in" ? "Welcome back" : "Register your PAX account"}</h1><p className="mt-2 text-sm text-slate-600">Manage your school and issue trusted credentials without wallets.</p></div>
    {mode === "sign-in" && <label className="text-sm font-medium text-slate-700">Sign in as<select value={loginAs} onChange={(event) => setLoginAs(event.target.value as "school" | "admin")} className="mt-2 w-full rounded-xl border border-slate-300 bg-white px-4 py-3"><option value="school">School representative</option><option value="admin">PAX Admin</option></select></label>}
    {mode === "sign-up" && <label className="text-sm font-medium text-slate-700">Full name<input name="name" required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>}
    <label className="text-sm font-medium text-slate-700">{loginAs === "admin" ? "PAX Admin email" : "Work email"}<input name="email" type="email" required className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" /></label>
    <label className="text-sm font-medium text-slate-700">Password<div className="relative mt-2"><input name="password" type={showPassword ? "text" : "password"} minLength={8} required className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-24" /><button type="button" onClick={() => setShowPassword((visible) => !visible)} className="absolute inset-y-0 right-3 text-sm font-semibold text-emerald-700">{showPassword ? "Hide" : "Show password"}</button></div></label>
    {error && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
    <button disabled={pending} className="rounded-xl bg-emerald-700 px-4 py-3 font-semibold text-white disabled:opacity-60">{pending ? "Please wait..." : mode === "sign-in" ? "Sign in" : "Create account"}</button>
    <a href={mode === "sign-in" ? "/sign-up" : "/sign-in"} className="text-center text-sm text-emerald-700">{mode === "sign-in" ? "New to PAX? Create an account" : "Already have an account? Sign in"}</a>
  </form>;
}

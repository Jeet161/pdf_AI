"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const { error: signInError } = await authClient.signIn.email({
      email,
      password,
    });

    setIsSubmitting(false);

    if (signInError) {
      setError(signInError.message ?? "Invalid email or password.");
      return;
    }

    router.push("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/30 to-purple-50 px-6 py-12">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 md:p-10 shadow-xl shadow-slate-100">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-indigo-50 text-2xl text-indigo-600 shadow-sm shadow-indigo-100/50">
            🧠
          </div>

          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Welcome back
          </h1>

          <p className="mt-1.5 text-sm text-slate-500">
            Sign in to access your research papers.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Email Address
            </label>

            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-400"
            >
              Password
            </label>

            <input
              id="password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-100"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-semibold text-red-600">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-md shadow-indigo-100"
          >
            {isSubmitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <div className="my-6 flex items-center">
          <div className="h-px flex-1 bg-slate-100" />
          <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
            OR
          </span>
          <div className="h-px flex-1 bg-slate-100" />
        </div>

        <p className="text-center text-sm text-slate-500">
          New here?{" "}
          <Link
            href="/signup"
            className="font-semibold text-indigo-600 hover:underline"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}


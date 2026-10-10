"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { Segmented } from "@/components/ui/Segmented";
import { Logo } from "@/components/ui/icons";
import { api, ApiClientError, getGuestKey } from "@/lib/client";

type Mode = "signin" | "signup";

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen" />}>
      <AuthContent />
    </Suspense>
  );
}

function AuthContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refresh, toast, continueAsGuest } = useApp();
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState<string | null>(() => searchParams.get("error"));
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (mode === "signup") {
        await api("/api/auth/register", {
          method: "POST",
          json: { email, password, displayName },
        });
      } else {
        await api("/api/auth/login", { method: "POST", json: { email, password } });
      }
      await refresh();
      toast(mode === "signup" ? "Account created." : "Welcome back.", "success");
      router.push("/dashboard");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  function guest() {
    continueAsGuest();
    getGuestKey();
    router.push("/dashboard");
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link href="/" aria-label="LuckyDraw home">
            <Logo />
          </Link>
          <Link href="/draw/new" className="btn btn-ghost btn-sm">
            Skip to a draw
          </Link>
        </div>
      </header>

      <main className="mx-auto grid max-w-6xl gap-10 px-4 py-10 sm:px-6 sm:py-16 lg:grid-cols-2 lg:items-center">
        <div className="hidden lg:block">
          <span className="chip border-accent/40 bg-accent/10 text-indigo-200">
            Accounts & guest mode
          </span>
          <h1 className="mt-5 text-4xl font-bold leading-tight text-white">
            Save rosters, keep history,
            <br />
            publish verified results.
          </h1>
          <p className="mt-4 max-w-md leading-relaxed text-slate-400">
            Create an account for persistent draws and saved participant lists, or jump
            straight in as a guest. Guest data is stored securely for 24 hours.
          </p>
          <ul className="mt-8 space-y-3 text-sm text-slate-300">
            {[
              "Reusable saved participant rosters",
              "Full draw history and quick re-runs",
              "Public verification links for every completed draw",
              "CSV and printable PDF exports",
            ].map((item) => (
              <li key={item} className="flex items-start gap-3">
                <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-mint/15 text-mint">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="m5 13 4 4L19 7"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="card mx-auto w-full max-w-md p-6 sm:p-8">
          <Segmented<Mode>
            label="Authentication mode"
            value={mode}
            onChange={(value) => {
              setMode(value);
              setError(null);
            }}
            options={[
              { value: "signin", label: "Sign in" },
              { value: "signup", label: "Create account" },
            ]}
          />

          <form onSubmit={submit} className="mt-6 space-y-4">
            {mode === "signup" ? (
              <Field label="Your name" htmlFor="name">
                <Input
                  id="name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  placeholder="e.g. Sarah Kim"
                  autoComplete="name"
                  required
                />
              </Field>
            ) : null}

            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </Field>

            <Field
              label="Password"
              htmlFor="password"
              hint={mode === "signup" ? "At least 8 characters." : undefined}
            >
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                minLength={8}
                required
              />
            </Field>

            {error ? (
              <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" size="lg" className="w-full" disabled={busy}>
              {busy
                ? "Please wait…"
                : mode === "signup"
                  ? "Create account"
                  : "Sign in"}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <span className="h-px flex-1 bg-line" />
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              or
            </span>
            <span className="h-px flex-1 bg-line" />
          </div>

          <button type="button" onClick={guest} className="btn btn-ghost w-full">
            Continue as guest
          </button>

          <p className="mt-5 text-center text-xs leading-relaxed text-slate-500">
            Guest draws and rosters are kept for 24 hours and are stored on this device.
          </p>
        </div>
      </main>
    </div>
  );
}

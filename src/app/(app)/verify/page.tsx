"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Field, Input } from "@/components/ui/Field";
import { IconSearch } from "@/components/ui/icons";

export default function VerifyPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setError("Enter a draw code.");
      return;
    }
    setError(null);
    router.push(`/draw/${trimmed}`);
  }

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <div>
        <span className="chip">Verification</span>
        <h1 className="mt-3 text-3xl font-bold tracking-tight text-white">
          Verify a draw
        </h1>
        <p className="mt-2 text-slate-400">
          Paste a draw code such as <span className="font-mono text-indigo-300">LD-8F42A7</span>{" "}
          to open its public results, winner record and seed commitment.
        </p>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-5 sm:p-6">
        <Field label="Draw code" htmlFor="draw-code" error={error}>
          <Input
            id="draw-code"
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="LD-8F42A7"
            className="font-mono uppercase"
            autoCapitalize="characters"
            spellCheck={false}
          />
        </Field>
        <Button type="submit" size="lg" className="w-full">
          <IconSearch width={18} height={18} />
          Open results
        </Button>
      </form>
    </div>
  );
}

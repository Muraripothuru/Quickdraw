"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/Badge";
import { IconCopy, IconDownload, IconPrinter, IconTrophy } from "@/components/ui/icons";
import { useApp } from "@/components/providers/AppProvider";
import { downloadTextFile, printReport, winnersCsv } from "@/lib/export";
import type { VerificationPayload } from "@/lib/verify";

const subscribeToHydration = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

function FormattedDate({ iso }: { iso: string | null }) {
  const hydrated = useSyncExternalStore(
    subscribeToHydration,
    getClientSnapshot,
    getServerSnapshot,
  );
  const formatted = !iso
    ? "—"
    : hydrated
      ? new Date(iso).toLocaleString(undefined, {
          dateStyle: "medium",
          timeStyle: "short",
        })
      : new Date(iso).toISOString();

  return <time dateTime={iso ?? undefined}>{formatted}</time>;
}

export function VerificationView({ payload }: { payload: VerificationPayload }) {
  const { toast } = useApp();
  const [copied, setCopied] = useState(false);
  const { draw, winners, participants, verification, pool } = payload;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      toast("Verification link copied.", "success");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast("Could not copy the link.", "error");
    }
  }

  function download() {
    downloadTextFile(
      `luckydraw-${draw.id}.csv`,
      winnersCsv({
        drawId: draw.id,
        drawName: draw.name,
        eventName: draw.eventName,
        prize: draw.prize,
        status: draw.status,
        seedCommitment: verification.seedCommitment,
        createdAt: draw.createdAt,
        completedAt: draw.completedAt,
        winners,
      }),
    );
    toast("CSV downloaded.", "success");
  }

  return (
    <div className="print-sheet space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              {draw.name}
            </h1>
            <StatusBadge status={draw.status} />
          </div>
          <p className="mt-1 text-sm text-slate-400">
            {[draw.eventName, draw.prize].filter(Boolean).join(" · ")}
          </p>
          <p className="mt-1 font-mono text-xs text-slate-500">{draw.id}</p>
        </div>
        <div className="no-print flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void copyLink()}>
            <IconCopy width={16} height={16} />
            {copied ? "Copied" : "Copy link"}
          </Button>
          <Button variant="outline" size="sm" onClick={download}>
            <IconDownload width={16} height={16} />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={printReport}>
            <IconPrinter width={16} height={16} />
            Print / PDF
          </Button>
        </div>
      </div>

      <section className="card p-5">
        <h2 className="font-semibold text-white">Verified results</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            ["Winners selected", `${winners.length} / ${draw.winnerCountTarget}`],
            ["Participants at start", String(verification.participantsAtStart)],
            ["Entries at start", String(verification.entriesAtStart)],
            ["Still in pool", `${pool.activeParticipants} (${pool.activeEntries} entries)`],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-line bg-panel2/60 p-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {label}
              </p>
              <p className="mt-1 text-lg font-bold text-white">{value}</p>
            </div>
          ))}
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <dt className="text-slate-500">Created:</dt>
            <dd className="text-slate-300"><FormattedDate iso={draw.createdAt} /></dd>
            <dt className="text-slate-500">Locked:</dt>
            <dd className="text-slate-300"><FormattedDate iso={draw.lockedAt} /></dd>
            <dt className="text-slate-500">Completed:</dt>
            <dd className="text-slate-300"><FormattedDate iso={draw.completedAt} /></dd>
          </div>
        </dl>
      </section>

      <section className="card p-5">
        <div className="flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-mint/15 text-mint">
            <IconTrophy width={18} height={18} />
          </span>
          <h2 className="font-semibold text-white">Winners</h2>
        </div>

        {winners.length === 0 ? (
          <p className="mt-4 rounded-2xl border border-dashed border-line p-6 text-center text-sm text-slate-500">
            No winners have been selected yet.
          </p>
        ) : (
          <>
            <ul className="mt-4 space-y-3 sm:hidden">
              {winners.map((winner) => (
                <li key={winner.id} className="rounded-2xl border border-line bg-panel2/60 p-4">
                  <div className="flex items-center justify-between">
                    <span className="chip border-accent/40 bg-accent/10 text-indigo-200">
                      #{winner.drawOrder}
                    </span>
                    <span className="text-xs text-slate-500">
                      <FormattedDate iso={winner.selectedAt} />
                    </span>
                  </div>
                  <p className="mt-2 text-lg font-bold text-white">{winner.name}</p>
                  <p className="mt-1 text-sm text-slate-400">
                    {winner.entryCountAtSelection}{" "}
                    {winner.entryCountAtSelection === 1 ? "entry" : "entries"} at selection
                  </p>
                  <p className="mt-2 break-all font-mono text-[11px] text-indigo-300">
                    {winner.entropyFingerprint}
                  </p>
                </li>
              ))}
            </ul>

            <div className="mt-4 hidden overflow-hidden rounded-2xl border border-line sm:block">
              <table className="w-full text-left text-sm">
                <thead className="bg-panel2/80 text-[11px] uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Order</th>
                    <th className="px-4 py-3 font-semibold">Winner</th>
                    <th className="px-4 py-3 font-semibold">Entries</th>
                    <th className="px-4 py-3 font-semibold">Selected at</th>
                    <th className="px-4 py-3 font-semibold">Fingerprint</th>
                  </tr>
                </thead>
                <tbody>
                  {winners.map((winner) => (
                    <tr key={winner.id} className="border-t border-line bg-ink/40">
                      <td className="px-4 py-3 font-semibold text-indigo-300">
                        #{winner.drawOrder}
                      </td>
                      <td className="px-4 py-3 font-medium text-white">{winner.name}</td>
                      <td className="px-4 py-3 text-slate-400">
                        {winner.entryCountAtSelection}
                      </td>
                      <td className="px-4 py-3 text-slate-400">
                        <FormattedDate iso={winner.selectedAt} />
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-indigo-300">
                        {winner.entropyFingerprint.slice(0, 16)}…
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-white">Participant pool</h2>
          <span className="chip">{participants.length} total</span>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {participants.map((participant) => (
            <li
              key={`${participant.name}-${participant.selectionOrder ?? "p"}`}
              className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-sm ${
                participant.status === "ACTIVE"
                  ? "border-line bg-panel2/50 text-slate-200"
                  : "border-emerald-500/30 bg-emerald-500/5 text-slate-400"
              }`}
            >
              <span className="truncate">{participant.name}</span>
              <span className="flex shrink-0 items-center gap-2 text-xs">
                {participant.entryCount > 1 ? <span className="chip">×{participant.entryCount}</span> : null}
                <span
                  className={
                    participant.status === "ACTIVE" ? "text-slate-500" : "text-emerald-300"
                  }
                >
                  {participant.status === "ACTIVE"
                    ? "Active"
                    : `Winner #${participant.selectionOrder ?? ""}`}
                </span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="no-print flex flex-col gap-3 sm:flex-row">
        {draw.status === "COMPLETED" || draw.status === "IN_PROGRESS" ? (
          <Link href={`/present/${draw.id}`} className="btn btn-outline flex-1">
            Open presentation screen
          </Link>
        ) : null}
        <Link href="/dashboard" className="btn btn-ghost flex-1">
          Back to dashboard
        </Link>
      </div>
    </div>
  );
}

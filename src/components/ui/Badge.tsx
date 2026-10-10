"use client";

import type { DrawStatus } from "@/lib/types";

const styles: Record<string, string> = {
  DRAFT: "border-slate-600 bg-slate-500/10 text-slate-300",
  READY: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  IN_PROGRESS: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  COMPLETED: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  ARCHIVED: "border-slate-600 bg-slate-500/10 text-slate-400",
};

const labels: Record<string, string> = {
  DRAFT: "Draft",
  READY: "Ready",
  IN_PROGRESS: "In progress",
  COMPLETED: "Completed",
  ARCHIVED: "Archived",
  ACTIVE: "Active",
  SELECTED: "Selected",
  REMOVED: "Removed",
};

export function StatusBadge({ status }: { status: DrawStatus | string }) {
  const className = styles[status] ?? styles.DRAFT;
  return (
    <span className={`chip ${className}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {labels[status] ?? status}
    </span>
  );
}

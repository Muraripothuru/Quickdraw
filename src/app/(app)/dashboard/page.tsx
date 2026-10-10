"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import {
  IconCopy,
  IconDuplicate,
  IconEdit,
  IconList,
  IconPlus,
  IconSpark,
  IconTrash,
  IconTrophy,
} from "@/components/ui/icons";
import { api, ApiClientError } from "@/lib/client";
import type { DrawSummaryDTO, SavedRosterDTO } from "@/lib/types";

type Tab = "draws" | "rosters";

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <div className="h-9 w-56 animate-pulse rounded-xl bg-slate-800" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-800/70" />
          <div className="h-24 animate-pulse rounded-2xl bg-slate-800/70" />
        </div>
      }
    >
      <DashboardContent />
    </Suspense>
  );
}

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, toast, loading: authLoading } = useApp();
  const [tab, setTab] = useState<Tab>(() =>
    searchParams.get("tab") === "rosters" ? "rosters" : "draws",
  );
  const [draws, setDraws] = useState<DrawSummaryDTO[]>([]);
  const [rosters, setRosters] = useState<SavedRosterDTO[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [editing, setEditing] = useState<SavedRosterDTO | null>(null);
  const [creatingRoster, setCreatingRoster] = useState(false);
  const [deleting, setDeleting] = useState<{ kind: "draw" | "roster"; id: string; label: string } | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    let syncing = false;
    let hasSyncError = false;

    async function syncData() {
      if (syncing || document.visibilityState !== "visible" || !navigator.onLine) return;
      syncing = true;
      try {
        const [drawRes, rosterRes] = await Promise.all([
          api<{ draws: DrawSummaryDTO[] }>("/api/draws"),
          api<{ rosters: SavedRosterDTO[] }>("/api/rosters"),
        ]);
        if (cancelled) return;
        setDraws(drawRes.draws);
        setRosters(rosterRes.rosters);
        hasSyncError = false;
      } catch (error) {
        if (cancelled) return;
        if (error instanceof ApiClientError && error.status === 401) {
          router.push("/auth");
          return;
        }
        if (!hasSyncError) {
          toast("Could not sync your data. Retrying automatically.", "error");
        }
        hasSyncError = true;
      } finally {
        syncing = false;
        if (!cancelled) setLoaded(true);
      }
    }

    const syncWhenVisible = () => void syncData();
    void syncData();
    const interval = window.setInterval(syncWhenVisible, 5000);
    window.addEventListener("focus", syncWhenVisible);
    window.addEventListener("online", syncWhenVisible);
    document.addEventListener("visibilitychange", syncWhenVisible);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", syncWhenVisible);
      window.removeEventListener("online", syncWhenVisible);
      document.removeEventListener("visibilitychange", syncWhenVisible);
    };
  }, [router, toast]);

  const activeDraws = useMemo(
    () => draws.filter((d) => d.status === "READY" || d.status === "IN_PROGRESS"),
    [draws],
  );
  const completedDraws = useMemo(
    () => draws.filter((d) => d.status === "COMPLETED"),
    [draws],
  );

  async function confirmDelete() {
    if (!deleting) return;
    setBusy(true);
    try {
      if (deleting.kind === "draw") {
        await api(`/api/draws/${deleting.id}`, { method: "DELETE" });
        setDraws((prev) => prev.filter((d) => d.id !== deleting.id));
      } else {
        await api(`/api/rosters/${deleting.id}`, { method: "DELETE" });
        setRosters((prev) => prev.filter((r) => r.id !== deleting.id));
      }
      toast("Deleted.", "success");
      setDeleting(null);
    } catch (error) {
      toast(error instanceof ApiClientError ? error.message : "Delete failed.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function duplicateRoster(roster: SavedRosterDTO) {
    try {
      const res = await api<{ roster: SavedRosterDTO }>("/api/rosters", {
        method: "POST",
        json: { title: `${roster.title} (copy)`, names: roster.names },
      });
      setRosters((prev) => [res.roster, ...prev]);
      toast("Roster duplicated.", "success");
    } catch (error) {
      toast(error instanceof ApiClientError ? error.message : "Duplicate failed.", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            {user ? `Welcome, ${user.displayName.split(" ")[0]}` : "Guest workspace"}
          </p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-white">Dashboard</h1>
        </div>
        <div className="flex w-full gap-2 sm:w-auto sm:gap-3">
          <Button
            variant="outline"
            className="min-w-0 flex-1 px-2 text-sm sm:flex-none sm:px-5"
            onClick={() => setCreatingRoster(true)}
          >
            <IconPlus width={16} height={16} />
            New roster
          </Button>
          <Button
            className="min-w-0 flex-1 px-2 text-sm sm:flex-none sm:px-5"
            onClick={() => router.push("/draw/new")}
          >
            <IconSpark width={16} height={16} />
            Quick Draw
          </Button>
        </div>
      </div>

      {!user && !authLoading ? (
        <div className="card flex flex-col gap-3 border-accent/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-white">You are browsing as a guest</p>
            <p className="text-sm text-slate-400">
              Guest draws and rosters are stored for 24 hours. Create an account to keep
              them forever.
            </p>
          </div>
          <Link href="/auth" className="btn btn-outline btn-sm">
            Create account
          </Link>
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        <StatCard label="Active draws" value={activeDraws.length} icon={<IconSpark width={18} height={18} />} />
        <StatCard label="Completed" value={completedDraws.length} icon={<IconTrophy width={18} height={18} />} />
        <StatCard label="Saved rosters" value={rosters.length} icon={<IconList width={18} height={18} />} />
        <StatCard label="Total entries" value={draws.reduce((sum, d) => sum + d.totalEntries, 0)} icon={<IconCopy width={18} height={18} />} />
      </div>

      <div role="tablist" aria-label="Dashboard sections" className="flex gap-1 rounded-2xl border border-line bg-panel2/70 p-1">
        {(["draws", "rosters"] as Tab[]).map((value) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`min-h-11 flex-1 rounded-xl text-sm font-semibold transition ${
              tab === value ? "bg-accent text-white" : "text-slate-400 hover:text-white"
            }`}
          >
            {value === "draws" ? `Draws (${draws.length})` : `Saved Rosters (${rosters.length})`}
          </button>
        ))}
      </div>

      {tab === "draws" ? (
        <section aria-label="Draws" className="space-y-3">
          {!loaded ? (
            <SkeletonRows count={3} />
          ) : draws.length === 0 ? (
            <EmptyState
              title="No draws yet"
              text="Create your first draw — paste names, load a roster, or upload a CSV."
              action={
                <Button onClick={() => router.push("/draw/new")}>
                  <IconPlus width={16} height={16} />
                  Create a Draw
                </Button>
              }
            />
          ) : (
            draws.map((draw) => {
              const progress =
                draw.winnerCountTarget > 0
                  ? Math.round((draw.winnersSelectedCount / draw.winnerCountTarget) * 100)
                  : 0;
              return (
                <article key={draw.id} className="card p-4 sm:p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="truncate font-semibold text-white">{draw.name}</h3>
                        <StatusBadge status={draw.status} />
                      </div>
                      <p className="mt-1 text-sm text-slate-400">
                        {draw.eventName ? `${draw.eventName} · ` : ""}
                        {draw.totalParticipants} participants · {draw.totalEntries} entries
                      </p>
                      <p className="mt-1 font-mono text-xs text-slate-500">{draw.id}</p>
                    </div>
                    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                      {draw.status !== "COMPLETED" && draw.status !== "ARCHIVED" ? (
                        <Link href={`/present/${draw.id}`} className="btn btn-primary btn-sm flex-1 sm:flex-none">
                          {draw.status === "READY" ? "Start" : "Continue"}
                        </Link>
                      ) : null}
                      <Link href={`/draw/${draw.id}`} className="btn btn-outline btn-sm flex-1 sm:flex-none">
                        Results
                      </Link>
                      <button
                        type="button"
                        className="btn btn-danger btn-sm px-3"
                        aria-label={`Delete ${draw.name}`}
                        onClick={() =>
                          setDeleting({ kind: "draw", id: draw.id, label: draw.name })
                        }
                      >
                        <IconTrash width={16} height={16} />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-1.5 flex items-center justify-between text-xs text-slate-500">
                      <span>
                        {draw.winnersSelectedCount} of {draw.winnerCountTarget} winners
                      </span>
                      <span>{progress}%</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-accent to-mint transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </section>
      ) : (
        <section aria-label="Saved participant rosters" className="space-y-3">
          {!loaded ? (
            <SkeletonRows count={2} />
          ) : rosters.length === 0 ? (
            <EmptyState
              title="No saved rosters"
              text="Save a named list once and load it into any future draw with a single click."
              action={<Button onClick={() => setCreatingRoster(true)}>
                <IconPlus width={16} height={16} />
                New roster
              </Button>}
            />
          ) : (
            rosters.map((roster) => (
              <article key={roster.id} className="card p-4 sm:p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate font-semibold text-white">{roster.title}</h3>
                    <p className="mt-1 text-sm text-slate-400">
                      {roster.names.length} {roster.names.length === 1 ? "entry" : "entries"}
                      <span className="mx-2 text-slate-600">·</span>
                      Updated {new Date(roster.updatedAt).toLocaleDateString()}
                    </p>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {roster.names.slice(0, 6).join(", ")}
                      {roster.names.length > 6 ? ` +${roster.names.length - 6} more` : ""}
                    </p>
                  </div>
                  <div className="flex w-full flex-wrap gap-2 sm:w-auto">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm flex-1 sm:flex-none"
                      onClick={() => router.push(`/draw/new?roster=${roster.id}`)}
                    >
                      Load into New Draw
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm px-3"
                      aria-label={`Edit ${roster.title}`}
                      onClick={() => setEditing(roster)}
                    >
                      <IconEdit width={16} height={16} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline btn-sm px-3"
                      aria-label={`Duplicate ${roster.title}`}
                      onClick={() => void duplicateRoster(roster)}
                    >
                      <IconDuplicate width={16} height={16} />
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger btn-sm px-3"
                      aria-label={`Delete ${roster.title}`}
                      onClick={() =>
                        setDeleting({ kind: "roster", id: roster.id, label: roster.title })
                      }
                    >
                      <IconTrash width={16} height={16} />
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      )}

      {editing ? (
        <EditRosterModal
          roster={editing}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setRosters((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
            setEditing(null);
            toast("Roster updated.", "success");
          }}
        />
      ) : null}

      {creatingRoster ? (
        <CreateRosterModal
          onClose={() => setCreatingRoster(false)}
          onCreated={(roster) => {
            setRosters((prev) => [roster, ...prev]);
            setCreatingRoster(false);
            setTab("rosters");
            toast("Roster saved.", "success");
          }}
        />
      ) : null}

      <Modal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        title="Delete permanently?"
        description={
          deleting
            ? `"${deleting.label}" will be removed. This cannot be undone.`
            : ""
        }
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={() => void confirmDelete()} disabled={busy}>
              {busy ? "Deleting…" : "Delete"}
            </Button>
          </>
        }
      >
        <div />
      </Modal>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-slate-500">
        <span className="text-accent2">{icon}</span>
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-white sm:text-3xl">{value}</p>
    </div>
  );
}

function EmptyState({
  title,
  text,
  action,
}: {
  title: string;
  text: string;
  action: React.ReactNode;
}) {
  return (
    <div className="card flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
      <div>
        <h3 className="font-semibold text-white">{title}</h3>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-slate-400">{text}</p>
      </div>
      {action}
    </div>
  );
}

function SkeletonRows({ count }: { count: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card h-24 animate-pulse p-5">
          <div className="h-4 w-1/3 rounded bg-slate-800" />
          <div className="mt-3 h-3 w-1/2 rounded bg-slate-800/70" />
        </div>
      ))}
    </>
  );
}

function EditRosterModal({
  roster,
  onClose,
  onSaved,
}: {
  roster: SavedRosterDTO;
  onClose: () => void;
  onSaved: (roster: SavedRosterDTO) => void;
}) {
  const { toast } = useApp();
  const [title, setTitle] = useState(roster.title);
  const [names, setNames] = useState(roster.names.join("\n"));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const list = names
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (list.length === 0) {
      setError("Add at least one name.");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ roster: SavedRosterDTO }>(`/api/rosters/${roster.id}`, {
        method: "PATCH",
        json: { title, names: list },
      });
      onSaved(res.roster);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Save failed.");
      toast("Could not save roster.", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Edit names"
      description="One name per line. Changes apply to future draws."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save changes"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="List name" htmlFor="roster-title">
          <Input id="roster-title" value={title} onChange={(e) => setTitle(e.target.value)} />
        </Field>
        <Field label="Names" htmlFor="roster-names" error={error}>
          <Textarea
            id="roster-names"
            rows={10}
            className="min-h-56 font-mono text-sm"
            value={names}
            onChange={(e) => setNames(e.target.value)}
          />
        </Field>
      </div>
    </Modal>
  );
}

function CreateRosterModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (roster: SavedRosterDTO) => void;
}) {
  const [title, setTitle] = useState("");
  const [names, setNames] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const list = names
      .split(/[\n,;]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (!title.trim()) {
      setError("Give this list a name.");
      return;
    }
    if (list.length === 0) {
      setError("Add at least one name.");
      return;
    }
    setBusy(true);
    try {
      const res = await api<{ roster: SavedRosterDTO }>("/api/rosters", {
        method: "POST",
        json: { title, names: list },
      });
      onCreated(res.roster);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Save a participant roster"
      description="Reuse this list in one click whenever you create a draw."
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Save roster"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <Field label="List name" htmlFor="new-roster-title" error={error}>
          <Input
            id="new-roster-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Sales Department"
          />
        </Field>
        <Field label="Names" htmlFor="new-roster-names" hint="One name per line.">
          <Textarea
            id="new-roster-names"
            rows={8}
            className="min-h-48 font-mono text-sm"
            value={names}
            onChange={(e) => setNames(e.target.value)}
            placeholder={"Amara Okafor\nDiego Ramirez\nMei-Ling Chen"}
          />
        </Field>
      </div>
    </Modal>
  );
}

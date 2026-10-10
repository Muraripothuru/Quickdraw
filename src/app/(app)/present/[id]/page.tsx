"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import confetti from "canvas-confetti";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge } from "@/components/ui/Badge";
import { Toggle } from "@/components/ui/Toggle";
import RevealStage, { type AnimationStyle } from "@/components/animations/RevealStage";
import {
  IconChevronRight,
  IconLock,
  IconSoundOff,
  IconSoundOn,
  IconTrophy,
} from "@/components/ui/icons";
import { api, ApiClientError } from "@/lib/client";
import type { DrawDTO, ParticipantDTO, WinnerDTO } from "@/lib/types";

type Phase = "loading" | "locked" | "idle" | "revealing" | "done" | "complete" | "error";

const subscribeCompact = (callback: () => void) => {
  const query = window.matchMedia("(max-width: 639px)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
};
const getCompactSnapshot = () => window.matchMedia("(max-width: 639px)").matches;
const getServerCompactSnapshot = () => false;

function poolNames(
  participants: ParticipantDTO[],
  cap: number,
  forceId: string | null = null,
): string[] {
  // The winner's status flips to SELECTED the instant the server picks them,
  // but the reveal must still show that person — passing their id keeps them
  // in the candidate list for the duration of the reveal.
  const active = participants.filter(
    (p) => p.status === "ACTIVE" || p.id === forceId,
  );
  const total = active.reduce((sum, p) => sum + p.entryCount, 0);
  if (total <= cap) {
    const expanded: string[] = [];
    for (const p of active) {
      for (let i = 0; i < p.entryCount; i += 1) expanded.push(p.name);
    }
    return expanded;
  }
  return active.map((p) => p.name);
}

export default function PresentDrawPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast, reducedMotion, setReducedMotion } = useApp();
  const compact = useSyncExternalStore(
    subscribeCompact,
    getCompactSnapshot,
    getServerCompactSnapshot,
  );

  const [draw, setDraw] = useState<DrawDTO | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingWinner, setPendingWinner] = useState<string | null>(null);
  const [lastWinner, setLastWinner] = useState<WinnerDTO | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [lockOpen, setLockOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [soundOn, setSoundOn] = useState(true);

  const drawId = params.id;
  const drawRef = useRef<DrawDTO | null>(null);

  useEffect(() => {
    drawRef.current = draw;
  }, [draw]);

  const applyData = useCallback((data: DrawDTO) => {
    setDraw(data);
    setSoundOn(data.settings.soundEnabled);
    setPhase((current) => {
      if (current === "revealing" || current === "done") return current;
      if (data.status === "COMPLETED") return "complete";
      if (data.status === "IN_PROGRESS") return "idle";
      return "locked";
    });
    const winners = data.winners ?? [];
    setLastWinner(winners.length > 0 ? winners[winners.length - 1] : null);
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await api<DrawDTO>(`/api/draws/${drawId}`);
      applyData(data);
      return data;
    } catch (error) {
      const message =
        error instanceof ApiClientError ? error.message : "Could not load this draw.";
      setErrorMessage(message);
      setPhase("error");
      return null;
    }
  }, [drawId, applyData]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<DrawDTO>(`/api/draws/${drawId}`);
        if (!cancelled) applyData(data);
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(
          error instanceof ApiClientError ? error.message : "Could not load this draw.",
        );
        setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawId, applyData]);

  useEffect(() => {
    const source = new EventSource(`/api/draws/${drawId}/stream`);
    source.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as { type?: string };
        if (payload.type && payload.type !== "connected") void load();
      } catch {
        // ignore malformed frames
      }
    };
    source.onerror = () => {
      // SSE reconnects automatically
    };
    return () => source.close();
  }, [drawId, load]);

  const activeCount = useMemo(
    () => draw?.participants?.filter((p) => p.status === "ACTIVE").length ?? 0,
    [draw],
  );
  const activeEntries = useMemo(
    () =>
      draw?.participants
        ?.filter((p) => p.status === "ACTIVE")
        .reduce((sum, p) => sum + p.entryCount, 0) ?? 0,
    [draw],
  );
  const candidates = useMemo(() => {
    if (!draw) return [];
    // pendingWinner only exists for a draw made in this session, so a reloaded
    // page still shows the true "N entrants" count on the idle stage.
    const forceId = pendingWinner ? (lastWinner?.participantId ?? null) : null;
    return poolNames(draw.participants ?? [], 60, forceId);
  }, [draw, pendingWinner, lastWinner]);

  async function lockDraw() {
    setBusy(true);
    try {
      const data = await api<DrawDTO>(`/api/draws/${drawId}/lock`, { method: "POST" });
      setDraw(data);
      setPhase("idle");
      setLockOpen(false);
      toast("Draw locked. Pool is frozen.", "success");
    } catch (error) {
      toast(error instanceof ApiClientError ? error.message : "Could not lock the draw.", "error");
    } finally {
      setBusy(false);
    }
  }

  async function drawWinner() {
    if (busy || !draw) return;
    if (draw.status === "READY" || draw.status === "DRAFT") {
      setLockOpen(true);
      return;
    }
    if (activeCount === 0) return;
    if (draw.winnersSelectedCount >= draw.totalParticipants) {
      toast("Every participant has already been drawn.", "info");
      return;
    }

    setBusy(true);
    try {
      // A completed draw can be extended in place: raise the winner target by
      // one (the server re-opens the draw) so the presenter can keep spinning
      // without leaving this page.
      if (draw.status === "COMPLETED") {
        await api(`/api/draws/${drawId}`, {
          method: "PATCH",
          json: { winnerCountTarget: draw.winnersSelectedCount + 1 },
        });
      }
      const data = await api<DrawDTO>(`/api/draws/${drawId}/select`, { method: "POST" });
      const winners = data.winners ?? [];
      const newest = winners[winners.length - 1] ?? null;
      setDraw(data);
      setLastWinner(newest);
      setPendingWinner(newest?.name ?? null);
      setPhase("revealing");
      setAnnouncement("");
    } catch (error) {
      toast(error instanceof ApiClientError ? error.message : "Selection failed.", "error");
      void load();
    } finally {
      setBusy(false);
    }
  }

  const finishReveal = useCallback(() => {
    const winnerName = pendingWinner;
    setPhase("done");
    setAnnouncement(winnerName ? `Winner selected: ${winnerName}` : "Winner selected");
    if (!reducedMotion) {
      try {
        void confetti({
          particleCount: 110,
          spread: 75,
          origin: { y: 0.6 },
          colors: ["#6366F1", "#10B981", "#F8FAFC", "#818CF8"],
          disableForReducedMotion: true,
        });
      } catch {
        // confetti is decorative
      }
    }
    const current = drawRef.current;
    if (current && current.winnersSelectedCount >= current.winnerCountTarget) {
      setPhase("complete");
    }
  }, [pendingWinner, reducedMotion]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.code !== "Space" && event.key !== "Enter") return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (["INPUT", "TEXTAREA", "SELECT", "A", "BUTTON"].includes(tag)) return;
      if (target.isContentEditable) return;
      if (phase !== "idle" && phase !== "done" && phase !== "complete") return;
      event.preventDefault();
      void drawWinner();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, busy, draw]);

  async function toggleSound(next: boolean) {
    setSoundOn(next);
    try {
      const data = await api<DrawDTO>(`/api/draws/${drawId}`, {
        method: "PATCH",
        json: { settings: { soundEnabled: next } },
      });
      setDraw(data);
    } catch {
      toast("Could not update sound setting.", "error");
    }
  }

  if (phase === "loading") {
    return (
      <div className="card grid min-h-72 place-items-center p-8">
        <p className="animate-pulse text-slate-400">Loading draw…</p>
      </div>
    );
  }

  if (phase === "error") {
    return (
      <div className="card p-8 text-center">
        <h1 className="text-xl font-bold text-white">Draw unavailable</h1>
        <p className="mt-2 text-slate-400">{errorMessage}</p>
        <Button className="mt-5" onClick={() => router.push("/dashboard")}>
          Back to dashboard
        </Button>
      </div>
    );
  }

  if (!draw) return null;

  const completed = draw.winnersSelectedCount >= draw.winnerCountTarget;
  const canSelect = activeCount > 0 && phase !== "revealing";

  return (
    <>
      <div className="w-full max-w-640 px-4 py-5 sm:px-6 sm:py-7 sm:max-w-720">
        <div className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-xl font-bold tracking-tight text-white sm:text-2xl">
                  {draw.name}
                </h1>
                <StatusBadge status={draw.status} />
              </div>
              <p className="mt-1 text-sm text-slate-400">
                {[draw.eventName, draw.prize].filter(Boolean).join(" · ")}
              </p>
              <p className="mt-1 font-mono text-[11px] text-slate-500">{draw.id}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="chip border-accent/40 bg-accent/10 text-indigo-200 text-[11px]">
                <IconTrophy width={12} height={12} />
                {draw.winnersSelectedCount}/{draw.winnerCountTarget} winners
              </span>
              <button
                type="button"
                onClick={() => void toggleSound(!soundOn)}
                className="btn btn-outline btn-sm px-3"
                aria-pressed={soundOn}
                aria-label={soundOn ? "Mute sound" : "Unmute sound"}
              >
                {soundOn ? <IconSoundOn width={14} height={14} /> : <IconSoundOff width={14} height={14} />}
              </button>
              <Link href={`/draw/${draw.id}`} className="btn btn-outline btn-sm">
                Results
              </Link>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="space-y-4">
              <div className="card relative overflow-hidden p-3 sm:p-5">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Active pool
                    </p>
                    <p className="mt-1 text-xl font-bold text-white sm:text-2xl">
                      {activeCount} Remaining in Pool
                    </p>
                    <p className="text-xs text-slate-400">
                      {activeEntries} weighted {activeEntries === 1 ? "entry" : "entries"}
                    </p>
                  </div>
                  <div className="hidden text-right sm:block">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      Elimination
                    </p>
                    <p className="mt-1 font-semibold text-slate-200">
                      {draw.settings.removeWinnersOnSelect ? "Winners leave the pool" : "Winners stay in pool"}
                    </p>
                  </div>
                </div>

                <div className="relative min-h-60 rounded-3xl border border-line bg-[#070B15] sm:min-h-80">
                  <RevealStage
                    style={draw.settings.animationStyle as AnimationStyle}
                    candidates={candidates}
                    winnerName={pendingWinner}
                    running={phase === "revealing"}
                    onDone={finishReveal}
                    soundEnabled={soundOn}
                    reducedMotion={reducedMotion}
                    compact={compact}
                  />
                </div>

                <p aria-live="polite" className="sr-only">
                  {announcement}
                </p>

                {(phase === "done" || phase === "complete") && lastWinner ? (
                  <div className="mt-3 flex flex-col gap-2 rounded-2xl border border-mint/40 bg-mint/10 p-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:p-4">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 place-items-center rounded-2xl bg-mint text-[#04150f]">
                        <IconTrophy width={16} height={16} />
                      </span>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-300">
                          Winner #{lastWinner.drawOrder}
                        </p>
                        <p className="text-lg font-bold text-white">{lastWinner.name}</p>
                      </div>
                    </div>
                    <span className="chip border-emerald-500/40 text-emerald-200 text-[11px]">
                      {lastWinner.entryCountAtSelection} {lastWinner.entryCountAtSelection === 1 ? "entry" : "entries"} at selection
                    </span>
                  </div>
                ) : null}

                <div className="mt-3 flex flex-col gap-2 sm:mt-4">
                  <Button
                    size="lg"
                    className="flex-1 py-3"
                    onClick={() => void drawWinner()}
                    disabled={!canSelect}
                  >
                    {draw.status === "READY" || draw.status === "DRAFT"
                      ? "Lock & Start Draw"
                      : phase === "revealing"
                        ? "Selecting…"
                        : activeCount === 0
                          ? "Pool is empty"
                          : completed
                            ? "Draw another winner"
                            : draw.winnersSelectedCount > 0
                              ? "Next Winner"
                              : "Draw Winner"}
                    {phase !== "revealing" && !completed ? (
                      <IconChevronRight width={16} height={16} />
                    ) : null}
                  </Button>
                  <p className="text-center text-xs text-slate-500">
                    Press <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px]">Space</kbd> or{" "}
                    <kbd className="rounded border border-line px-1.5 py-0.5 font-mono text-[11px]">Enter</kbd> to draw
                  </p>
                </div>
              </div>

              {phase === "locked" || draw.status === "READY" ? (
                <div className="card flex flex-col gap-3 border-accent/30 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-accent/20 text-indigo-300">
                      <IconLock width={16} height={16} />
                    </span>
                    <div>
                      <p className="font-semibold text-white">Screen not locked yet</p>
                      <p className="text-xs text-slate-400">
                        Locking freezes the participant list before the first selection.
                      </p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={() => setLockOpen(true)}>
                    Review & lock
                  </Button>
                </div>
              ) : null}

              <div className="card p-4 sm:hidden">
                <Toggle
                  checked={reducedMotion}
                  onChange={setReducedMotion}
                  label="Reduce motion"
                  description="Skip long animations and reveal results instantly."
                />
              </div>
            </div>

            <aside className="space-y-3">
              <div className="card p-3 sm:p-4">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-white">Winners so far</h2>
                  <span className="chip text-[11px]">{(draw.winners ?? []).length}</span>
                </div>
                <ul className="mt-2 max-h-64 space-y-1.5 overflow-y-auto scrollbar-thin">
                  {(draw.winners ?? []).length === 0 ? (
                    <li className="rounded-xl border border-dashed border-line p-3 text-center text-sm text-slate-500">
                      No winners yet. Start the draw when you are ready.
                    </li>
                  ) : (
                    (draw.winners ?? []).map((winner) => (
                      <li
                        key={winner.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-line bg-panel2/60 px-2.5 py-2"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className="grid h-6 w-6 shrink-0 place-items-center rounded-lg bg-accent/20 text-xs font-bold text-indigo-200">
                            {winner.drawOrder}
                          </span>
                          <span className="truncate text-xs font-medium text-slate-100">
                            {winner.name}
                          </span>
                        </span>
                        <span className="shrink-0 text-[11px] text-slate-500">
                          {new Date(winner.selectedAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </li>
                    ))
                  )}
                </ul>
              </div>

              <div className="card hidden p-3 sm:p-4 lg:hidden">
                <Toggle
                  checked={reducedMotion}
                  onChange={setReducedMotion}
                  label="Reduce motion"
                  description="Skip long animations and reveal results instantly."
                />
              </div>

              <div className="card p-3 sm:p-4">
                <h2 className="font-semibold text-white">Pool snapshot</h2>
                <ul className="mt-2 max-h-56 space-y-1.5 overflow-y-auto scrollbar-thin text-sm">
                  {(draw.participants ?? []).slice(0, 200).map((participant) => (
                    <li
                      key={participant.id}
                      className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 ${participant.status === "ACTIVE"
                        ? "bg-panel2/50 text-slate-200"
                        : "bg-emerald-500/5 text-slate-500 line-through"
                      }`}
                    >
                      <span className="truncate text-sm">{participant.name}</span>
                      {participant.entryCount > 1 ? (
                        <span className="chip text-[10px]">×{participant.entryCount}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              </div>
            </aside>
          </div>
        </div>
      </div>

      <Modal
        open={lockOpen}
        onClose={() => setLockOpen(false)}
        title="Lock this draw?"
        description="Locking prevents edits to participants, winner count and elimination mode. You can still change sound and presentation preferences."
        footer={
          <>
            <Button variant="ghost" onClick={() => setLockOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void lockDraw()} disabled={busy}>
              {busy ? "Locking…" : "Lock & start"}
            </Button>
          </>
        }
      >
        <dl className="grid grid-cols-2 gap-3 text-sm">
          {[
            ["Participants", String(draw.totalParticipants)],
            ["Entries", String(draw.totalEntries)],
            ["Winners needed", String(draw.winnerCountTarget)],
            ["Elimination", draw.settings.removeWinnersOnSelect ? "On" : "Off"],
            ["Animation", draw.settings.animationStyle],
            ["Privacy", draw.settings.privacy],
          ].map(([label, value]) => (
            <div key={label} className="rounded-xl border border-line bg-panel2/60 px-3 py-2.5">
              <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                {label}
              </dt>
              <dd className="mt-0.5 font-medium capitalize text-slate-100">{value}</dd>
            </div>
          ))}
        </dl>
      </Modal>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import { Button } from "@/components/ui/Button";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Modal } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { Toggle } from "@/components/ui/Toggle";
import {
  IconChevronLeft,
  IconChevronRight,
  IconList,
  IconSpark,
  IconTrash,
  IconUpload,
} from "@/components/ui/icons";
import { api, ApiClientError } from "@/lib/client";
import {
  duplicateNames,
  hasDuplicates,
  normalizeEntries,
  parseCsvNames,
  parseNameList,
} from "@/lib/entries";
import type { AnimationStyle, DrawSettings, Privacy, SavedRosterDTO } from "@/lib/types";

const STEPS = ["Draw Details", "Participants", "Configuration", "Review"];

const ANIMATION_OPTIONS: {
  value: AnimationStyle;
  title: string;
  text: string;
  swatch: string;
}[] = [
  {
    value: "wheel",
    title: "Wheel of Fortune",
    text: "Spinning wheel with deceleration physics and ticking audio.",
    swatch: "from-indigo-500 via-sky-500 to-emerald-500",
  },
  {
    value: "slot",
    title: "Slot Machine Reel",
    text: "Scrolling reels that slow down and lock on the winner.",
    swatch: "from-emerald-500 via-teal-500 to-cyan-500",
  },
  {
    value: "shuffle",
    title: "Rapid Shuffle",
    text: "High-velocity name cycling easing to a stop.",
    swatch: "from-amber-500 via-orange-500 to-rose-500",
  },
  {
    value: "card",
    title: "Card Reveal",
    text: "Mystery card flips into a neon glow.",
    swatch: "from-fuchsia-500 via-purple-500 to-indigo-500",
  },
];

export default function CreateDrawPage() {
  const router = useRouter();
  const { toast } = useApp();

  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [eventName, setEventName] = useState("");
  const [prize, setPrize] = useState("");

  const [rawNames, setRawNames] = useState<string[]>([]);
  const [dedupeMode, setDedupeMode] = useState<"keep" | "dedupe">("keep");
  const [pasteText, setPasteText] = useState("");
  const [entryTab, setEntryTab] = useState<"roster" | "paste" | "csv">("paste");
  const [rosters, setRosters] = useState<SavedRosterDTO[]>([]);
  const [duplicatePrompt, setDuplicatePrompt] = useState<string[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const [winnerCountTarget, setWinnerCountTarget] = useState(1);
  const [removeWinnersOnSelect, setRemoveWinnersOnSelect] = useState(true);
  const [animationStyle, setAnimationStyle] = useState<AnimationStyle>("wheel");
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [privacy, setPrivacy] = useState<Privacy>("public");

  const [saveRoster, setSaveRoster] = useState(false);
  const [rosterTitle, setRosterTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const entries = useMemo(
    () => normalizeEntries(rawNames, { dedupe: dedupeMode === "dedupe" }),
    [rawNames, dedupeMode],
  );
  const totalEntries = entries.reduce((sum, e) => sum + e.entryCount, 0);
  const participantCount = entries.length;

  const winnerError =
    winnerCountTarget < 1
      ? "Number of winners must be at least 1."
      : winnerCountTarget > participantCount
        ? "Number of winners cannot exceed participant count."
        : null;

  useEffect(() => {
    void (async () => {
      try {
        const res = await api<{ rosters: SavedRosterDTO[] }>("/api/rosters");
        setRosters(res.rosters);
      } catch {
        // rosters are optional here
      }
    })();
  }, []);

  useEffect(() => {
    const rosterId = new URLSearchParams(window.location.search).get("roster");
    if (!rosterId) return;
    void (async () => {
      try {
        const res = await api<{ roster: SavedRosterDTO }>(`/api/rosters/${rosterId}`);
        setRawNames(res.roster.names);
        setDedupeMode("keep");
        setEntryTab("roster");
        setStep(1);
        toast(`Loaded "${res.roster.title}" (${res.roster.names.length} names).`, "success");
      } catch (err) {
        toast(
          err instanceof ApiClientError ? err.message : "Could not load that roster.",
          "error",
        );
      }
    })();
  }, [toast]);

  function commitNames(next: string[]) {
    if (next.length === 0) {
      setError("Add at least one participant.");
      return;
    }
    if (hasDuplicates(next)) {
      setDuplicatePrompt(duplicateNames(next));
      setRawNames(next);
      return;
    }
    setRawNames(next);
    setError(null);
  }

  function importPasted() {
    commitNames(parseNameList(pasteText));
  }

  function importCsv(file: File) {
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result ?? "");
      commitNames(parseCsvNames(text));
    };
    reader.onerror = () => setError("Could not read that file.");
    reader.readAsText(file);
  }

  function removeEntry(index: number) {
    const target = entries[index];
    setRawNames((prev) => prev.filter((n) => n !== target.name));
  }

  function nextStep() {
    setError(null);
    if (step === 0) {
      if (!name.trim()) {
        setError("Give your draw a title to continue.");
        return;
      }
      setStep(1);
      return;
    }
    if (step === 1) {
      if (participantCount === 0) {
        setError("Add at least one participant.");
        return;
      }
      setWinnerCountTarget((current) =>
        Math.max(1, Math.min(current, participantCount)),
      );
      setStep(2);
      return;
    }
    if (step === 2) {
      if (winnerError) return;
      setStep(3);
    }
  }

  async function createDraw() {
    if (winnerError || participantCount === 0) return;
    setBusy(true);
    setError(null);
    try {
      if (saveRoster && rosterTitle.trim()) {
        await api("/api/rosters", {
          method: "POST",
          json: { title: rosterTitle.trim(), names: [...new Set(rawNames)] },
        });
      }
      const settings: DrawSettings = {
        removeWinnersOnSelect,
        animationStyle,
        soundEnabled,
        privacy,
      };
      const res = await api<{ drawId: string }>("/api/draws", {
        method: "POST",
        json: {
          name: name.trim(),
          eventName: eventName.trim() || undefined,
          prize: prize.trim() || undefined,
          winnerCountTarget,
          settings,
          participants: entries,
        },
      });
      toast("Draw created. Lock it when you are ready.", "success");
      router.push(`/present/${res.drawId}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create the draw.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/dashboard" className="text-sm text-slate-500 hover:text-white">
          ← Dashboard
        </Link>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-white">Create a draw</h1>
        <p className="mt-1 text-slate-400">
          Step {step + 1} of {STEPS.length} · {STEPS[step]}
        </p>
      </div>

      <ol className="flex gap-2" aria-label="Progress">
        {STEPS.map((label, index) => (
          <li key={label} className="flex-1">
            <div
              className={`h-1.5 rounded-full transition ${
                index <= step ? "bg-accent" : "bg-slate-800"
              }`}
            />
            <span
              className={`mt-1.5 block truncate text-[11px] font-semibold ${
                index === step ? "text-indigo-300" : "text-slate-600"
              }`}
            >
              {label}
            </span>
          </li>
        ))}
      </ol>

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="card p-5 sm:p-6">
        {step === 0 ? (
          <div className="space-y-5">
            <Field label="Draw title" htmlFor="draw-name" hint="Shown on the presentation screen and results page.">
              <Input
                id="draw-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Q4 Giveaway Finale"
                maxLength={140}
              />
            </Field>
            <Field label="Event name" htmlFor="event-name">
              <Input
                id="event-name"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder="e.g. Town Hall Raffle"
                maxLength={140}
              />
            </Field>
            <Field label="Prize details" htmlFor="prize">
              <Input
                id="prize"
                value={prize}
                onChange={(e) => setPrize(e.target.value)}
                placeholder="e.g. Weekend getaway voucher"
                maxLength={240}
              />
            </Field>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="space-y-5">
            <Segmented
              label="Participant source"
              value={entryTab}
              onChange={setEntryTab}
              options={[
                { value: "roster", label: "Saved Roster" },
                { value: "paste", label: "Paste Text" },
                { value: "csv", label: "CSV Upload" },
              ]}
            />

            {entryTab === "roster" ? (
              rosters.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line p-6 text-center">
                  <p className="font-medium text-slate-300">No saved rosters yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Save a list from the dashboard, or paste names instead.
                  </p>
                  <Link href="/dashboard?tab=rosters" className="btn btn-outline btn-sm mt-4">
                    Open Saved Rosters
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {rosters.map((roster) => (
                    <button
                      key={roster.id}
                      type="button"
                      onClick={() => {
                        setRawNames(roster.names);
                        setDedupeMode("keep");
                        toast(`Loaded ${roster.names.length} names.`, "success");
                      }}
                      className="rounded-2xl border border-line bg-panel2/60 p-4 text-left transition hover:border-accent"
                    >
                      <p className="flex items-center gap-2 font-semibold text-white">
                        <IconList width={16} height={16} className="text-accent2" />
                        {roster.title}
                      </p>
                      <p className="mt-1 text-sm text-slate-400">
                        {roster.names.length} entries
                      </p>
                    </button>
                  ))}
                </div>
              )
            ) : null}

            {entryTab === "paste" ? (
              <Field label="Paste names" htmlFor="paste-box" hint="One per line, or separated by commas.">
                <Textarea
                  id="paste-box"
                  rows={9}
                  className="min-h-52 font-mono text-sm"
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Amara Okafor\nDiego Ramirez\nMei-Ling Chen"}
                />
              </Field>
            ) : null}

            {entryTab === "csv" ? (
              <div className="rounded-2xl border border-dashed border-line p-6 text-center">
                <span className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-indigo-300">
                  <IconUpload width={22} height={22} />
                </span>
                <p className="mt-3 font-medium text-white">Upload a CSV file</p>
                <p className="mt-1 text-sm text-slate-500">
                  The first column is read as the participant name. A header row named
                  &quot;name&quot; is skipped automatically.
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,text/csv,text/plain"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) importCsv(file);
                    e.target.value = "";
                  }}
                />
                <Button variant="outline" className="mt-4" onClick={() => fileRef.current?.click()}>
                  Choose file
                </Button>
              </div>
            ) : null}

            {entryTab !== "roster" ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <Button
                  className="flex-1"
                  onClick={() => (entryTab === "paste" ? importPasted() : fileRef.current?.click())}
                >
                  {entryTab === "paste" ? "Add names" : "Select CSV"}
                </Button>
              </div>
            ) : null}

            {rawNames.length > 0 ? (
              <div className="rounded-2xl border border-line bg-panel2/50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">
                      {participantCount} participants
                    </p>
                    <p className="text-sm text-slate-400">
                      {totalEntries} total entries · {rawNames.length} names imported
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Segmented
                      label="Duplicate handling"
                      value={dedupeMode}
                      onChange={(value) => setDedupeMode(value)}
                      options={[
                        { value: "keep", label: "Weighted" },
                        { value: "dedupe", label: "Unique only" },
                      ]}
                    />
                    <button
                      type="button"
                      className="btn btn-danger btn-sm px-3"
                      aria-label="Clear participants"
                      onClick={() => setRawNames([])}
                    >
                      <IconTrash width={16} height={16} />
                    </button>
                  </div>
                </div>

                <ul className="mt-4 max-h-72 space-y-2 overflow-y-auto scrollbar-thin pr-1">
                  {entries.map((entry, index) => (
                    <li
                      key={entry.name}
                      className="flex items-center justify-between gap-3 rounded-xl border border-line bg-ink/60 px-3 py-2.5"
                    >
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                        {entry.name}
                      </span>
                      {entry.entryCount > 1 ? (
                        <span className="chip border-accent/40 bg-accent/10 text-indigo-200">
                          ×{entry.entryCount}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm px-2"
                        aria-label={`Remove ${entry.name}`}
                        onClick={() => removeEntry(index)}
                      >
                        <IconTrash width={15} height={15} />
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="space-y-5">
            <Field
              label="Number of winners"
              htmlFor="winner-count"
              error={winnerError}
              hint={`Choose between 1 and ${Math.max(1, participantCount)} participants.`}
            >
              <Input
                id="winner-count"
                type="number"
                min={1}
                max={Math.max(1, participantCount)}
                inputMode="numeric"
                value={winnerCountTarget}
                onChange={(e) => setWinnerCountTarget(Number(e.target.value))}
                className={winnerError ? "field-error" : ""}
                aria-invalid={Boolean(winnerError)}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              {[
                ["Participants", participantCount],
                ["Entries", totalEntries],
                ["Winners", winnerCountTarget],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-2xl border border-line bg-panel2/60 p-3 text-center">
                  <p className="text-xl font-bold text-white">{value}</p>
                  <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {label}
                  </p>
                </div>
              ))}
            </div>

            <Toggle
              checked={removeWinnersOnSelect}
              onChange={setRemoveWinnersOnSelect}
              label="Winner elimination"
              description="ON: each winner leaves the pool so nobody is picked twice. OFF: winners stay in the pool for later selections."
            />

            <div>
              <p className="label">Animation style</p>
              <div className="grid gap-3 sm:grid-cols-2">
                {ANIMATION_OPTIONS.map((option) => {
                  const active = animationStyle === option.value;
                  return (
                    <button
                      key={option.value}
                      type="button"
                      aria-pressed={active}
                      onClick={() => setAnimationStyle(option.value)}
                      className={`overflow-hidden rounded-2xl border p-4 text-left transition ${
                        active
                          ? "border-accent bg-accent/10 shadow-[0_10px_30px_-16px_rgba(99,102,241,1)]"
                          : "border-line bg-panel2/60 hover:border-slate-600"
                      }`}
                    >
                      <span
                        className={`block h-2 w-16 rounded-full bg-gradient-to-r ${option.swatch}`}
                      />
                      <span className="mt-3 block font-semibold text-white">
                        {option.title}
                      </span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-400">
                        {option.text}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <Toggle
              checked={soundEnabled}
              onChange={setSoundEnabled}
              label="Sound effects"
              description="Ticking, reel clicks and a reveal chime during the draw."
            />

            <div>
              <p className="label">Result privacy</p>
              <Segmented
                label="Result privacy"
                value={privacy}
                onChange={setPrivacy}
                options={[
                  { value: "public", label: "Public" },
                  { value: "unlisted", label: "Unlisted" },
                  { value: "private", label: "Private" },
                ]}
              />
              <p className="mt-2 text-xs text-slate-500">
                {privacy === "public"
                  ? "Anyone with the link can verify this draw."
                  : privacy === "unlisted"
                    ? "Shared by link only, hidden from listings."
                    : "Only you can view the results page."}
              </p>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-line bg-panel2/60 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-white">{name}</h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {[eventName, prize].filter(Boolean).join(" · ") || "No event details"}
                  </p>
                </div>
                <span className="chip border-accent/40 bg-accent/10 text-indigo-200">
                  <IconSpark width={14} height={14} />
                  {winnerCountTarget} {winnerCountTarget === 1 ? "winner" : "winners"}
                </span>
              </div>

              <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                {[
                  ["Participants", String(participantCount)],
                  ["Total entries", String(totalEntries)],
                  ["Animation", ANIMATION_OPTIONS.find((o) => o.value === animationStyle)?.title ?? ""],
                  ["Elimination", removeWinnersOnSelect ? "On" : "Off"],
                  ["Sound", soundEnabled ? "On" : "Off"],
                  ["Privacy", privacy],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-xl border border-line bg-ink/50 px-3 py-2.5">
                    <dt className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {label}
                    </dt>
                    <dd className="mt-0.5 font-medium capitalize text-slate-100">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <ul className="max-h-56 space-y-2 overflow-y-auto scrollbar-thin">
              {entries.map((entry) => (
                <li
                  key={entry.name}
                  className="flex items-center justify-between rounded-xl border border-line bg-panel2/50 px-3 py-2 text-sm"
                >
                  <span className="truncate text-slate-200">{entry.name}</span>
                  {entry.entryCount > 1 ? (
                    <span className="chip">{entry.entryCount} entries</span>
                  ) : null}
                </li>
              ))}
            </ul>

            <Toggle
              checked={saveRoster}
              onChange={setSaveRoster}
              label="Save this list as a roster"
              description="Reuse these names in future draws with one click."
            />
            {saveRoster ? (
              <Field label="Roster name" htmlFor="roster-title">
                <Input
                  id="roster-title"
                  value={rosterTitle}
                  onChange={(e) => setRosterTitle(e.target.value)}
                  placeholder="e.g. Friday Dev Team"
                />
              </Field>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="sticky bottom-20 z-30 flex flex-col gap-3 rounded-2xl border border-line bg-panel/95 p-3 backdrop-blur sm:flex-row sm:justify-between md:bottom-4">
        <Button
          variant="outline"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0}
        >
          <IconChevronLeft width={16} height={16} />
          Back
        </Button>
        {step < STEPS.length - 1 ? (
          <Button onClick={nextStep} disabled={step === 2 && Boolean(winnerError)}>
            Continue
            <IconChevronRight width={16} height={16} />
          </Button>
        ) : (
          <Button
            onClick={() => void createDraw()}
            disabled={busy || Boolean(winnerError) || participantCount === 0}
          >
            {busy ? "Creating…" : "Create draw"}
            <IconChevronRight width={16} height={16} />
          </Button>
        )}
      </div>

      <Modal
        open={Boolean(duplicatePrompt)}
        onClose={() => setDuplicatePrompt(null)}
        title="Duplicate names detected"
        description={
          duplicatePrompt && duplicatePrompt.length > 0
            ? `${duplicatePrompt.length} name${duplicatePrompt.length === 1 ? "" : "s"} appear more than once in your list. Choose how chances should be weighted.`
            : ""
        }
        footer={
          <>
            <Button
              variant="outline"
              onClick={() => {
                setDedupeMode("dedupe");
                setDuplicatePrompt(null);
                toast("Duplicates removed — one entry each.", "info");
              }}
            >
              Deduplicate
            </Button>
            <Button
              onClick={() => {
                setDedupeMode("keep");
                setDuplicatePrompt(null);
                toast("Duplicates kept — weighted chance.", "info");
              }}
            >
              Keep duplicates
            </Button>
          </>
        }
      >
        <div className="flex flex-wrap gap-2">
          {duplicatePrompt?.slice(0, 12).map((dupe) => (
            <span key={dupe} className="chip border-amber-500/40 bg-amber-500/10 text-amber-200">
              {dupe}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm leading-relaxed text-slate-400">
          <strong className="text-slate-200">Keep duplicates</strong> gives repeated names
          a proportionally higher chance. <strong className="text-slate-200">Deduplicate</strong>{" "}
          keeps one entry per person.
        </p>
      </Modal>
    </div>
  );
}

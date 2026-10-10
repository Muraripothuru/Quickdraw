"use client";

import confetti from "canvas-confetti";
import { AnimatePresence, motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import type { JSX } from "react";

export type AnimationStyle = "wheel" | "slot" | "shuffle" | "card";

export interface RevealStageProps {
  style: AnimationStyle;
  candidates: string[];
  winnerName: string | null;
  running: boolean;
  onDone: () => void;
  soundEnabled: boolean;
  reducedMotion: boolean;
  compact?: boolean;
}

type Phase = "idle" | "running" | "winner";

interface StageProps {
  candidates: string[];
  winner: string;
  winnerIndex: number;
  phase: Phase;
  runId: number;
  runMs: number;
  reduced: boolean;
  compact: boolean;
  onTick: () => void;
}

const PALETTE: string[] = [
  "#6366F1",
  "#10B981",
  "#F59E0B",
  "#EF4444",
  "#06B6D4",
  "#EC4899",
  "#8B5CF6",
  "#84CC16",
  "#F97316",
  "#3B82F6",
];

const RUN_MS: Record<AnimationStyle, number> = {
  wheel: 3500,
  slot: 2600,
  shuffle: 2600,
  card: 2600,
};

const REDUCED_MS = 200;
const TICK_GAP_MS = 55;
const WHEEL_CENTER = 120;
const WHEEL_RADIUS = 94;
const SETTLE_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

const clamp01 = (value: number): number =>
  value <= 0 ? 0 : value >= 1 ? 1 : value;

const easeOutQuad = (u: number): number => 1 - (1 - u) * (1 - u);

const easeOutCubic = (u: number): number => 1 - Math.pow(1 - u, 3);

const easeHold = (u: number, hold: number): number => {
  const p = clamp01(u);
  const h = hold < 0.05 ? 0.05 : hold > 0.9 ? 0.9 : hold;
  const k = 1 / (h + (1 - h) / 4);
  if (p < h) return k * p;
  const t = (p - h) / (1 - h);
  return k * h + (k * (1 - h) * (1 - Math.pow(1 - t, 4))) / 4;
};

const polar = (r: number, deg: number): [number, number] => {
  const rad = (deg * Math.PI) / 180;
  return [
    WHEEL_CENTER + r * Math.sin(rad),
    WHEEL_CENTER - r * Math.cos(rad),
  ];
};

const wedgePath = (r: number, a0: number, a1: number): string => {
  const [x0, y0] = polar(r, a0);
  const [x1, y1] = polar(r, a1);
  const large = a1 - a0 > 180 ? 1 : 0;
  return `M${WHEEL_CENTER},${WHEEL_CENTER} L${x0.toFixed(2)},${y0.toFixed(
    2
  )} A${r},${r} 0 ${large} 1 ${x1.toFixed(2)},${y1.toFixed(2)} Z`;
};

const truncateName = (name: string, max: number): string => {
  if (max <= 0) return "";
  const clean = name.trim() === "" ? "—" : name;
  return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
};

const resolveWinner = (
  winnerName: string | null,
  candidates: string[]
): string => {
  if (winnerName !== null && winnerName !== "" && candidates.includes(winnerName)) {
    return winnerName;
  }
  if (candidates.length > 0) return candidates[0];
  return winnerName ?? "";
};

function useRunFrames(
  runId: number,
  phase: Phase,
  reduced: boolean,
  runMs: number,
  span: number,
  onFrame: (progress: number) => void
): void {
  const frameRef = useRef(onFrame);
  const progressRef = useRef(0);
  const framesRef = useRef(0);

  useEffect(() => {
    frameRef.current = onFrame;
  }, [onFrame]);

  useEffect(() => {
    if (phase !== "running" || runId <= 0) return;
    progressRef.current = 0;
    framesRef.current = 0;
    if (reduced) {
      progressRef.current = 1;
      frameRef.current(1);
      return;
    }
    let rafId = 0;
    const duration = Math.max(160, runMs * span);
    const startedAt = performance.now();
    const step = () => {
      const elapsed = performance.now() - startedAt;
      const value = elapsed >= duration ? 1 : elapsed / duration;
      progressRef.current = value;
      framesRef.current += 1;
      frameRef.current(value);
      if (value < 1) rafId = requestAnimationFrame(step);
    };
    rafId = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafId);
  }, [phase, runId, reduced, runMs, span]);

  useEffect(() => {
    if (phase !== "winner" || runId <= 0) return;
    if (framesRef.current > 0 && progressRef.current < 1) {
      progressRef.current = 1;
      frameRef.current(1);
    }
  }, [phase, runId]);
}

function WheelStage({
  candidates,
  winnerIndex,
  phase,
  runId,
  runMs,
  reduced,
  compact,
  onTick,
}: StageProps) {
  const hubId = `ld-hub-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const groupRef = useRef<SVGGElement | null>(null);
  const rotationRef = useRef(0);
  const markRef = useRef(0);
  const targetRef = useRef<{ from: number; to: number; over: number } | null>(
    null
  );
  const n = candidates.length;

  const applyRotation = useCallback((deg: number) => {
    rotationRef.current = deg;
    groupRef.current?.setAttribute(
      "transform",
      `rotate(${deg.toFixed(3)} ${WHEEL_CENTER} ${WHEEL_CENTER})`
    );
  }, []);

  // Each run needs a fresh stop target: the stage stays on "winner" between
  // runs, so the idle effect below no longer fires between them — without
  // this the wheel would land on the previous run's winner again.
  useEffect(() => {
    targetRef.current = null;
    markRef.current = 0;
  }, [runId]);

  useEffect(() => {
    if (phase !== "idle") return;
    rotationRef.current = 0;
    targetRef.current = null;
    groupRef.current?.setAttribute(
      "transform",
      `rotate(0 ${WHEEL_CENTER} ${WHEEL_CENTER})`
    );
  }, [phase]);

  const handleFrame = useCallback(
    (u: number) => {
      if (n <= 0 || winnerIndex < 0) return;
      const seg = 360 / n;
      if (targetRef.current === null) {
        const from = rotationRef.current;
        const centerAngle = (winnerIndex + 0.5) * seg;
        let to = (((-centerAngle % 360) + 360) % 360) + 360;
        while (to < from + 360 * 5) to += 360;
        const over = reduced ? 0 : Math.min(seg * 0.3, 9);
        targetRef.current = { from, to, over };
        markRef.current = Math.floor(from / seg);
      }
      const { from, to, over } = targetRef.current;
      const spin = to + over;
      let deg: number;
      if (u <= 0.86) {
        deg = from + (spin - from) * easeOutQuad(u / 0.86);
      } else {
        deg = spin - over * easeOutCubic((u - 0.86) / 0.14);
      }
      applyRotation(deg);
      const index = Math.floor(deg / seg);
      if (index > markRef.current) {
        markRef.current = index;
        onTick();
      }
    },
    [n, winnerIndex, reduced, applyRotation, onTick]
  );

  useRunFrames(runId, phase, reduced, runMs, 0.92, handleFrame);

  const seg = 360 / Math.max(n, 1);
  const labelMax = n <= 6 ? 14 : n <= 9 ? 11 : n <= 12 ? 9 : 0;
  const labelSize = compact ? (n <= 6 ? 10 : n <= 9 ? 9 : 8) : (n <= 6 ? 11 : n <= 9 ? 10 : 9);
  const idle = phase === "idle";
  const pointer = (
    <g>
      <path
        d="M120,31 L103,5 L137,5 Z"
        fill="#F8FAFC"
        stroke="#0A0F1D"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      <circle
        cx={120}
        cy={9}
        r={4.5}
        fill={phase === "winner" ? "#10B981" : "#6366F1"}
        className={idle && !reduced ? "animate-pulse" : ""}
      />
    </g>
  );

  return (
    <svg
      viewBox="0 0 240 240"
      className={`aspect-square w-full ${compact ? "max-w-[220px]" : "max-w-[340px] sm:max-w-[360px]"} drop-shadow-[0_20px_45px_rgba(0,0,0,0.45)]`}
      aria-hidden="true"
    >
      <defs>
        <radialGradient id={hubId}>
          <stop offset="0%" stopColor="#1E293B" />
          <stop offset="70%" stopColor="#0F1626" />
          <stop offset="100%" stopColor="#0A0F1D" />
        </radialGradient>
      </defs>
      <circle cx={120} cy={120} r={WHEEL_RADIUS + 13} fill="#0A0F1D" />
      <circle
        cx={120}
        cy={120}
        r={WHEEL_RADIUS + 9}
        fill="none"
        stroke="#6366F1"
        strokeWidth={1.5}
        strokeDasharray="3 11"
        strokeLinecap="round"
        opacity={phase === "winner" ? 0.9 : 0.55}
        style={idle && !reduced ? { animationDuration: "11s" } : undefined}
        className={
          idle && !reduced
            ? "origin-center [transform-box:view-box] animate-spin"
            : ""
        }
      />
      <circle
        cx={120}
        cy={120}
        r={WHEEL_RADIUS + 5}
        fill="none"
        stroke={phase === "winner" ? "#10B981" : "#1E293B"}
        strokeWidth={5}
      />
      {n === 0 ? (
        <circle
          cx={120}
          cy={120}
          r={WHEEL_RADIUS}
          fill="#0A0F1D"
          stroke="#1E293B"
          strokeWidth={3}
          strokeDasharray="9 11"
        />
      ) : (
        <g ref={groupRef}>
          {n === 1 ? (
            <circle cx={120} cy={120} r={WHEEL_RADIUS} fill={PALETTE[0]} />
          ) : (
            candidates.map((name, i) => {
              const color = PALETTE[i % PALETTE.length];
              const a0 = i * seg;
              const a1 = (i + 1) * seg;
              const center = (i + 0.5) * seg;
              const isWinner = phase === "winner" && i === winnerIndex;
              const upright = center > 90 && center < 270;
              const rotation = upright ? center + 180 : center;
              const textY = upright
                ? WHEEL_CENTER + WHEEL_RADIUS * 0.6
                : WHEEL_CENTER - WHEEL_RADIUS * 0.6;
              return (
                <g key={`${name}-${i}`}>
                  <path
                    d={wedgePath(WHEEL_RADIUS, a0, a1)}
                    fill={color}
                    stroke="#0A0F1D"
                    strokeWidth={1.5}
                    opacity={isWinner ? 1 : 0.92}
                  />
                  {isWinner ? (
                    <path
                      d={wedgePath(WHEEL_RADIUS - 2, a0 + 0.6, a1 - 0.6)}
                      fill="#F8FAFC"
                      opacity={0.28}
                      stroke="#10B981"
                      strokeWidth={2}
                      style={{ filter: "drop-shadow(0 0 6px #10B981)" }}
                    />
                  ) : null}
                  {labelMax > 0 ? (
                    <g transform={`rotate(${rotation} 120 120)`}>
                      <text
                        x={120}
                        y={textY}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={compact ? (labelSize > 9 ? labelSize - 1 : 9) : labelSize}
                        fontWeight={700}
                        fill="#F8FAFC"
                        stroke="#0A0F1D"
                        strokeWidth={2.4}
                        strokeLinejoin="round"
                        paintOrder="stroke"
                      >
                        {truncateName(name, labelMax)}
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })
          )}
          <circle
            cx={120}
            cy={120}
            r={30}
            fill={`url(#${hubId})`}
            stroke="#1E293B"
            strokeWidth={2}
          />
          <circle
            cx={120}
            cy={120}
            r={30}
            fill="none"
            stroke={phase === "winner" ? "#10B981" : "#6366F1"}
            strokeWidth={2.5}
            opacity={phase === "winner" ? 1 : 0.65}
            className={idle && !reduced ? "animate-pulse" : ""}
          />
          {phase === "winner" ? (
            <g>
              <circle
                cx={120}
                cy={120}
                r={8}
                fill="#10B981"
                opacity={0.95}
                style={{ filter: "drop-shadow(0 0 8px #10B981)" }}
              />
            </g>
          ) : null}
        </g>
      )}
      {n === 0 ? (
        <text
          x={120}
          y={120}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={compact ? 34 : 42}
          fontWeight={800}
          fill="#1E293B"
        >
          ?
        </text>
      ) : null}
      {pointer}
    </svg>
  );
}

function SlotReel({
  rows,
  rowHeight,
  stripHeight,
  targetPx,
  span,
  phase,
  runId,
  runMs,
  reduced,
  emphasis,
  compact,
  onTick,
}: {
  rows: string[];
  rowHeight: number;
  stripHeight: number;
  targetPx: number;
  span: number;
  phase: Phase;
  runId: number;
  runMs: number;
  reduced: boolean;
  emphasis: boolean;
  compact: boolean;
  onTick: () => void;
}) {
  const stripRef = useRef<HTMLDivElement | null>(null);
  const lastYRef = useRef(0);
  const lastBlurRef = useRef(0);

  const handleFrame = useCallback(
    (u: number) => {
      const strip = stripRef.current;
      if (!strip || stripHeight <= 0 || targetPx <= 0) return;
      const y = -((targetPx * easeHold(u, 0.55)) % stripHeight);
      strip.style.transform = `translateY(${y.toFixed(2)}px)`;
      const moved = Math.abs(y - lastYRef.current) / rowHeight;
      lastYRef.current = y;
      const blur =
        moved > 0.6
          ? Math.min(3, Math.round((moved - 0.6) * 2.8 * 2) / 2)
          : 0;
      if (blur !== lastBlurRef.current) {
        lastBlurRef.current = blur;
        strip.style.filter = blur > 0 ? `blur(${blur}px)` : "none";
      }
      if (emphasis && moved > 0.6) onTick();
    },
    [stripHeight, targetPx, rowHeight, emphasis, onTick]
  );

  useRunFrames(runId, phase, reduced, runMs, span, handleFrame);

  useEffect(() => {
    if (phase !== "idle") return;
    lastYRef.current = 0;
    lastBlurRef.current = 0;
    const strip = stripRef.current;
    if (!strip) return;
    strip.style.transform = "translateY(0px)";
    strip.style.filter = "none";
  }, [phase, runId]);

  const winnerGlow =
    phase === "winner" && emphasis
      ? "border-[#10B981] shadow-[inset_0_0_26px_rgba(16,185,129,0.3),0_0_30px_rgba(16,185,129,0.35)]"
      : emphasis
        ? "border-[#6366F1]/50"
        : "border-[#1E293B]";

  return (
    <div
      className={`relative min-w-0 overflow-hidden rounded-xl bg-[#0A0F1D] transition-colors duration-300 ${winnerGlow} ${
        emphasis ? "flex-[1.7]" : "flex-1"
      }`}
      style={{
        height: rowHeight * 3,
        maskImage:
          "linear-gradient(to bottom, transparent 0%, #000 17%, #000 83%, transparent 100%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, #000 17%, #000 83%, transparent 100%)",
      }}
    >
      <div
        ref={stripRef}
        className="absolute inset-x-0 top-0 will-change-transform"
      >
        {rows.map((name, i) => (
          <div
            key={i}
            style={{ height: rowHeight }}
            className="flex w-full items-center justify-center px-1"
          >
            <span
              className={`block w-full truncate text-center font-semibold ${
                compact ? "text-[12px]" : "text-[13px]"
              } ${emphasis ? "text-[#F8FAFC]" : "text-[#94A3B8]"}`}
            >
              {name}
            </span>
          </div>
        ))}
      </div>
      <div
        className="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 border-y bg-[#6366F1]/10"
        style={{
          height: rowHeight,
          borderColor:
            phase === "winner" && emphasis ? "#10B981" : "rgba(99,102,241,0.45)",
        }}
        aria-hidden="true"
      />
      {phase === "winner" && emphasis ? (
        <div className="pointer-events-none absolute inset-0 bg-[#10B981]/10" />
      ) : null}
    </div>
  );
}

function SlotStage({
  candidates,
  winnerIndex,
  phase,
  runId,
  runMs,
  reduced,
  compact,
  onTick,
}: StageProps) {
  const n = candidates.length;
  const rowHeight = compact ? 30 : 46;
  const repeat = n === 0 ? 1 : n >= 8 ? 1 : Math.ceil(8 / n);
  const rowCount = n === 0 ? 6 : n * repeat;

  const rows = useMemo(() => {
    const total = n === 0 ? rowCount : rowCount + 3;
    const out: string[] = [];
    for (let i = 0; i < total; i += 1) {
      out.push(n === 0 ? "—" : candidates[i % n]);
    }
    return out;
  }, [candidates, n, rowCount]);

  const stripHeight = rowCount * rowHeight;

  const targetPx = useMemo(() => {
    if (n <= 0 || winnerIndex < 0) return 0;
    const first = ((winnerIndex - 1) % n + n) % n;
    const loops = Math.max(2, Math.ceil(12000 / (rowHeight * n)));
    return (first + n * loops) * rowHeight;
  }, [n, winnerIndex, rowHeight]);

  const reels = [
    { key: "left", span: 0.7, emphasis: false },
    { key: "center", span: 0.9, emphasis: true },
    { key: "right", span: 0.8, emphasis: false },
  ];  return (
    <div
      className="flex w-full items-stretch gap-2 sm:gap-3"
    >
      {reels.map((reel) => (
        <SlotReel
          key={reel.key}
          rows={rows}
          rowHeight={rowHeight}
          stripHeight={stripHeight}
          targetPx={targetPx}
          span={reel.span}
          phase={phase}
          runId={runId}
          runMs={runMs}
          reduced={reduced}
          emphasis={reel.emphasis}
          compact={compact}
          onTick={onTick}
        />
      ))}
    </div>
  );
}

function ShuffleStage({
  candidates,
  winner,
  winnerIndex,
  phase,
  runId,
  runMs,
  reduced,
  compact,
  onTick,
}: StageProps) {
  const n = candidates.length;
  const [swap, setSwap] = useState<{
    run: number;
    id: number;
    name: string;
  } | null>(null);
  const swapRef = useRef(0);

  if (phase === "idle" && swap !== null) {
    setSwap(null);
  } else if (swap !== null && swap.run !== runId) {
    // New run: drop the previous run's final swap during render so the old
    // winner name cannot flash while the next shuffle spins up.
    setSwap(null);
  }

  const sequence = useMemo(() => {
    const out: number[] = [];
    if (n <= 0 || winnerIndex < 0) return out;
    const swaps = n <= 8 ? 38 : 44;
    for (let i = 0; i < swaps; i += 1) {
      out.push(i % n);
    }
    out.push(winnerIndex);
    return out;
  }, [n, winnerIndex]);

  const handleFrame = useCallback(
    (u: number) => {
      const total = sequence.length;
      if (total === 0) return;
      const raw = Math.floor(total * easeHold(u, 0.55));
      const count = raw >= total ? total - 1 : raw;
      if (count !== swapRef.current) {
        swapRef.current = count;
        const name = candidates[sequence[count]];
        setSwap({ run: runId, id: count, name });
        onTick();
      }
    },
    [sequence, candidates, runId, onTick]
  );

  useRunFrames(runId, phase, reduced, runMs, 0.9, handleFrame);

  const idleName = n > 0 ? candidates[0] : "—";
  const label = winner.trim() === "" ? "—" : winner;

  return (
    <div className="relative w-full max-w-[440px]">
      <div
        aria-hidden="true"
        className="absolute -left-2 -top-2 h-full w-full rounded-2xl border border-[#1E293B] bg-[#111827]/70 -rotate-2"
      />
      <div
        aria-hidden="true"
        className="absolute -right-2 -top-1 h-full w-full rounded-2xl border border-[#1E293B] bg-[#111827]/50 rotate-1"
      />
      <div
        className={`relative overflow-hidden rounded-2xl border bg-[#0A0F1D] p-3 transition-colors duration-300 sm:p-4 ${
          phase === "winner"
            ? "border-[#10B981] shadow-[0_0_34px_rgba(16,185,129,0.3),0_18px_45px_rgba(0,0,0,0.4)]"
            : "border-[#1E293B] shadow-[0_18px_45px_rgba(0,0,0,0.4)]"
        }`}
      >
        <div className="mb-2 flex items-center justify-between px-1">
          <span className={`text-[10px] font-bold uppercase tracking-[0.3em] text-[#94A3B8] ${compact ? "hidden" : ""}`}>
            Shuffle
          </span>
          <span className="flex items-center gap-1" aria-hidden="true">
            <span className="h-1.5 w-1.5 rounded-full bg-[#6366F1]" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#6366F1]/70" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#6366F1]/40" />
          </span>
        </div>
        <div
          className="relative flex items-center justify-center overflow-hidden rounded-xl border border-[#1E293B] bg-[linear-gradient(180deg,#0F1626,#0A0F1D)] px-3"
          style={{ height: reduced ? 76 : 84 }}
        >
          <AnimatePresence initial={false}>
            {phase === "winner" ? (
              <motion.span
                key="winner"
                className="absolute inset-0 flex items-center justify-center px-3"
                initial={{ opacity: 0, scale: 1.3, filter: "blur(14px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.94 }}
                transition={
                  reduced
                    ? { duration: 0.14 }
                    : { type: "spring", stiffness: 380, damping: 24 }
                }
              >
                <span className={`block max-w-full truncate text-center text-2xl font-extrabold text-[#F8FAFC] [text-shadow:0_0_22px_rgba(16,185,129,0.75)] ${compact ? "text-xl" : "sm:text-3xl"}`}>
                  {label}
                </span>
              </motion.span>
            ) : phase === "running" && swap !== null ? (
              <motion.span
                key={`swap-${swap.run}-${swap.id}`}
                className="absolute inset-0 flex items-center justify-center px-3"
                initial={{ opacity: 0, scale: 1.22, filter: "blur(9px)" }}
                animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                exit={{ opacity: 0, scale: 0.88, filter: "blur(6px)" }}
                transition={{ duration: 0.11, ease: "easeOut" }}
              >
                <span className={`block max-w-full truncate text-center text-xl font-bold text-[#F8FAFC] ${compact ? "text-lg" : "sm:text-2xl"}`}>
                  {swap.name}
                </span>
              </motion.span>
            ) : (
              <motion.span
                key="idle"
                className="absolute inset-0 flex items-center justify-center px-3"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              >
                <span className={`block max-w-full truncate text-center text-xl font-bold text-[#94A3B8] ${compact ? "text-lg" : "sm:text-2xl"}`}>
                  {idleName}
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>
        <div className="mt-3 h-1 w-full overflow-hidden rounded-full bg-[#111827]">
          <div
            className="h-full w-0 bg-[linear-gradient(90deg,#6366F1,#10B981)]"
            ref={(node) => {
              if (node && phase !== "running") {
                node.style.width = phase === "winner" ? "100%" : "0%";
              }
            }}
          />
        </div>
      </div>
    </div>
  );
}

function CardStage({
  winner,
  phase,
  runId,
  runMs,
  reduced,
  compact,
  onTick,
}: StageProps) {
  const count = compact ? 4 : 5;
  // Flip state is scoped to the run id: the stage stays on "winner" between
  // draws, so a new run (not an idle reset) is what turns the card back over.
  const [flippedForRun, setFlippedForRun] = useState(-1);
  const cycleRef = useRef(-1);
  const firedRef = useRef(0);

  const flipped = phase !== "idle" && flippedForRun === runId;

  const winnerText = winner.trim() === "" ? "—" : winner;

  const handleFrame = useCallback(
    (u: number) => {
      if (u >= 0.76) {
        setFlippedForRun((prev) => (prev === runId ? prev : runId));
      }
      const cycle = Math.floor(u / 0.14);
      if (cycle !== cycleRef.current) {
        cycleRef.current = cycle;
        onTick();
      }
    },
    [runId, onTick]
  );

  useRunFrames(runId, phase, reduced, runMs, 0.9, handleFrame);

  useEffect(() => {
    if (phase !== "winner" || runId <= 0 || reduced) return;
    if (firedRef.current === runId) return;
    firedRef.current = runId;
    if (typeof document === "undefined") return;
    try {
      void confetti({
        particleCount: 64,
        spread: 68,
        startVelocity: 30,
        ticks: 150,
        scalar: 0.9,
        origin: { x: 0.5, y: 0.5 },
        colors: ["#6366F1", "#10B981", "#F8FAFC", "#06B6D4", "#A78BFA"],
        disableForReducedMotion: true,
      });
    } catch {
      return;
    }
  }, [phase, runId, reduced]);

  const makeVariants = useCallback(
    (i: number): Variants => {
      const baseX = i * 3;
      const baseY = i * -3;
      const baseRotate = (i - count / 2) * 2.6;
      const dir = i % 2 === 0 ? 1 : -1;
      return {
        idle: {
          x: baseX,
          y: baseY,
          rotate: baseRotate,
          transition: { duration: 0.35, ease: "easeOut" },
        },
        dealing: {
          x: [baseX, baseX + dir * 16, baseX],
          y: [baseY, baseY - 9, baseY],
          rotate: [baseRotate, baseRotate + dir * 7, baseRotate],
          transition: {
            duration: 0.26,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.03,
          },
        },
        settled: {
          x: i * 4,
          y: i * -4,
          rotate: (i - count / 2) * 3,
          transition: reduced
            ? { duration: 0 }
            : { type: "spring", stiffness: 300, damping: 26 },
        },
      };
    },
    [count, reduced]
  );

  const variant =
    phase === "idle" ? "idle" : phase === "running" && !flipped ? "dealing" : "settled";

  const dealTransition = reduced
    ? { duration: 0 }
    : { duration: 0.55, ease: SETTLE_EASE };

  return (
    <div className={`relative aspect-[5/7] w-[58%] min-w-[150px] max-w-[230px] ${compact ? "w-full" : ""}`}>
      {flipped ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[26%] rounded-full bg-[repeating-conic-gradient(from_0deg,rgba(99,102,241,0.45)_0deg_5deg,transparent_5deg_17deg)]"
          initial={{ opacity: 0, scale: 0.55, rotate: 0 }}
          animate={{ opacity: reduced ? 0.3 : 0.7, scale: 1, rotate: 40 }}
          transition={{ duration: reduced ? 0.1 : 0.7, ease: "easeOut" }}
        />
      ) : null}
      {flipped && !reduced ? (
        <motion.div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-[6%] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.9)_0%,rgba(16,185,129,0.5)_26%,transparent_70%)]"
          initial={{ opacity: 0.85, scale: 0.5 }}
          animate={{ opacity: 0, scale: 1.7 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      ) : null}
      {Array.from({ length: count }, (_, i) => (
        <motion.div
          key={i}
          className="absolute inset-0"
          style={{ perspective: 1200, zIndex: count - i }}
          variants={makeVariants(i)}
          initial={false}
          animate={variant}
        >
          {i === 0 ? (
            <motion.div
              className="absolute inset-0 [transform-style:preserve-3d]"
              initial={false}
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={dealTransition}
            >
              <div className="absolute inset-0 flex items-center justify-center overflow-hidden rounded-2xl border border-[#312E81] bg-[linear-gradient(150deg,#1E1B4B_0%,#312E81_52%,#0B1220_100%)] shadow-[0_16px_36px_rgba(0,0,0,0.5)] [backface-visibility:hidden]">
                <div className="absolute inset-2 rounded-xl border border-dashed border-[#6366F1]/40" />
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(99,102,241,0.4),transparent_65%)]" />
                <span className="relative text-5xl font-black text-[#6366F1]/80 [text-shadow:0_0_22px_rgba(99,102,241,0.7)]">
                  ?
                </span>
              </div>
              <div
                className="absolute inset-0 flex flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-[#10B981] bg-[linear-gradient(160deg,#052E2B_0%,#0F1626_55%,#111827_100%)] px-3 text-center shadow-[0_0_30px_rgba(16,185,129,0.5),0_0_70px_rgba(99,102,241,0.35)] [backface-visibility:hidden]"
                style={{ transform: "rotateY(180deg)" }}
              >
                <span className="rounded-full border border-[#10B981]/60 bg-[#10B981]/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.3em] text-[#10B981]">
                  Winner
                </span>
                <span className={`block max-w-full truncate text-lg font-extrabold text-[#F8FAFC] [text-shadow:0_0_18px_rgba(16,185,129,0.8)] ${compact ? "text-base" : ""}`}>
                  {winnerText}
                </span>
              </div>
            </motion.div>
          ) : (
            <div className="absolute inset-0 overflow-hidden rounded-2xl border border-[#1E293B] bg-[linear-gradient(150deg,#1E1B4B_0%,#312E81_52%,#0B1220_100%)] shadow-[0_14px_30px_rgba(0,0,0,0.45)]">
              <div className="absolute inset-2 rounded-xl border border-dashed border-[#6366F1]/30" />
            </div>
          )}
        </motion.div>
      ))}
    </div>
  );
}

export function RevealStage(props: RevealStageProps): JSX.Element {
  const {
    style,
    candidates,
    winnerName,
    running,
    onDone,
    soundEnabled,
    reducedMotion,
    compact = false,
  } = props;

  const [run, setRun] = useState<{ id: number; phase: Phase }>({
    id: 0,
    phase: "idle",
  });

  if (running && (run.phase === "idle" || run.phase === "winner")) {
    // A fresh draw starts a new run — even while the stage still shows the
    // previous winner.
    setRun({ id: run.id + 1, phase: "running" });
  } else if (!running && run.phase === "running") {
    // Abort only a run that is still in flight. When the run timer hands over
    // to "winner", the parent has already flipped `running` to false — snapping
    // back to idle there would wipe the winner display and, on the wheel, snap
    // the pointer back to the first entrant instead of the real winner.
    setRun({ id: run.id, phase: "idle" });
  }

  const phase = run.phase;
  const runId = run.id;

  const doneRef = useRef(-1);
  const onDoneRef = useRef(onDone);
  const soundOnRef = useRef(soundEnabled);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const lastTickRef = useRef(0);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    soundOnRef.current = soundEnabled;
  }, [soundEnabled]);

  const getAudioCtx = useCallback((): AudioContext | null => {
    if (!soundOnRef.current) return null;
    const existing = audioCtxRef.current;
    if (existing) {
      if (existing.state === "suspended") {
        void existing.resume().catch(() => undefined);
      }
      return existing;
    }
    if (typeof window === "undefined") return null;
    if (typeof window.AudioContext !== "function") return null;
    try {
      const ctx = new window.AudioContext();
      audioCtxRef.current = ctx;
      if (ctx.state === "suspended") {
        void ctx.resume().catch(() => undefined);
      }
      return ctx;
    } catch {
      audioCtxRef.current = null;
      return null;
    }
  }, []);

  const playTick = useCallback(() => {
    if (!soundOnRef.current) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "square";
      osc.frequency.setValueAtTime(1580, now);
      osc.frequency.exponentialRampToValueAtTime(940, now + 0.05);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.05, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.07);
      osc.onended = () => {
        osc.disconnect();
        gain.disconnect();
      };
    } catch {
      return;
    }
  }, [getAudioCtx]);

  const playChime = useCallback(() => {
    if (!soundOnRef.current) return;
    const ctx = getAudioCtx();
    if (!ctx) return;
    try {
      const start = ctx.currentTime;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const at = start + i * 0.075;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = i === notes.length - 1 ? "triangle" : "sine";
        osc.frequency.setValueAtTime(freq, at);
        gain.gain.setValueAtTime(0.0001, at);
        gain.gain.exponentialRampToValueAtTime(0.13 - i * 0.018, at + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.72);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(at);
        osc.stop(at + 0.75);
        osc.onended = () => {
          osc.disconnect();
          gain.disconnect();
        };
      });
    } catch {
      return;
    }
  }, [getAudioCtx]);

  useEffect(() => {
    return () => {
      const ctx = audioCtxRef.current;
      audioCtxRef.current = null;
      if (!ctx) return;
      try {
        void ctx.close();
      } catch {
        return;
      }
    };
  }, []);

  const handleTick = useCallback(() => {
    const now =
      typeof performance !== "undefined" ? performance.now() : Date.now();
    if (now - lastTickRef.current < TICK_GAP_MS) return;
    lastTickRef.current = now;
    playTick();
  }, [playTick]);

  const runMs = reducedMotion ? REDUCED_MS : RUN_MS[style];

  useEffect(() => {
    if (phase !== "running" || doneRef.current === runId) return;
    const id = runId;
    const timer = setTimeout(() => {
      if (doneRef.current === id) return;
      doneRef.current = id;
      playChime();
      onDoneRef.current();
      setRun((prev) =>
        prev.id === id ? { id, phase: "winner" } : prev
      );
    }, runMs);
    return () => clearTimeout(timer);
  }, [phase, runId, runMs, playChime]);

  const winner = useMemo(
    () => resolveWinner(winnerName, candidates),
    [winnerName, candidates]
  );
  const winnerIndex = useMemo(
    () => candidates.indexOf(winner),
    [candidates, winner]
  );
  const shown = winner.trim() === "" ? "—" : winner;
  const count = candidates.length;
  const drawingCopy = reducedMotion
    ? "Revealing winner"
    : style === "wheel"
      ? "Spinning up the reveal"
      : style === "slot"
        ? "Reels are rolling"
        : style === "shuffle"
          ? "Shuffling the entries"
          : "Dealing the winning card";

  const stageProps: StageProps = {
    candidates,
    winner,
    winnerIndex,
    phase,
    runId,
    runMs,
    reduced: reducedMotion,
    compact,
    onTick: handleTick,
  };

  const stage =
    style === "wheel" ? (
      <WheelStage {...stageProps} />
    ) : style === "slot" ? (
      <SlotStage {...stageProps} />
    ) : style === "shuffle" ? (
      <ShuffleStage {...stageProps} />
    ) : (
      <CardStage {...stageProps} />
    );

  return (
    <div
      role="status"
      className={`relative flex w-full min-h-[300px] flex-col overflow-hidden rounded-2xl border border-[#1E293B] bg-[#0F1626] text-[#F8FAFC] ${
        compact ? "gap-2 p-3" : "gap-4 p-4 sm:p-6"
      }`}
    >
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_95%_at_50%_-15%,rgba(99,102,241,0.24),transparent_58%),radial-gradient(85%_60%_at_100%_115%,rgba(16,185,129,0.14),transparent_62%)]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(10,15,29,0)_0%,rgba(10,15,29,0.7)_100%)]"
      />
      <div className="relative z-10 flex min-h-0 flex-1 flex-col items-center justify-center gap-3">
        <div
          aria-hidden="true"
          className="flex w-full min-h-0 flex-1 items-center justify-center select-none"
        >
          {stage}
        </div>
        <div className="relative h-[64px] w-full">
          <AnimatePresence initial={false}>
            <motion.div
              key={phase}
              className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 px-2 text-center"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              transition={{
                duration: reducedMotion ? 0.1 : 0.22,
                ease: "easeOut",
              }}
            >
              {phase === "idle" ? (
                <>
                  <span className="text-[11px] font-bold uppercase tracking-[0.3em] text-[#94A3B8]">
                    Ready to draw
                  </span>
                  <span className="text-sm font-medium text-[#94A3B8]">
                    {count === 0
                      ? "Waiting for entries"
                      : `${count} entrant${count === 1 ? "" : "s"} in the pool`}
                  </span>
                </>
              ) : phase === "running" ? (
                <>
                  <span className="inline-flex items-center gap-2 rounded-full border border-[#6366F1]/40 bg-[#6366F1]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.3em] text-[#6366F1]">
                    <span
                      className={`h-1.5 w-1.5 rounded-full bg-[#6366F1] ${
                        reducedMotion ? "" : "animate-pulse"
                      }`}
                    />
                    Drawing
                  </span>
                  <span className="text-sm font-medium text-[#94A3B8]">
                    {drawingCopy}
                  </span>
                </>
              ) : (
                <>
                  <span className="rounded-full border border-[#10B981]/50 bg-[#10B981]/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.3em] text-[#10B981]">
                    Winner
                  </span>
                  <span className="max-w-full truncate text-lg font-extrabold text-[#F8FAFC] [text-shadow:0_0_22px_rgba(16,185,129,0.65)]">
                    {shown}
                  </span>
                </>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

export default RevealStage;

import { createHash, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import { ApiError } from "./api";
import type {
  AnimationStyle,
  DrawSettings,
  DrawStatus,
  Privacy,
} from "./types";

const ANIMATION_STYLES: AnimationStyle[] = ["wheel", "slot", "shuffle", "card"];
const PRIVACIES: Privacy[] = ["public", "unlisted", "private"];

export function newDrawId(): string {
  return `LD-${randomBytes(4).toString("hex").toUpperCase()}`;
}

export function normalizeSettings(
  raw: Partial<DrawSettings> | undefined,
  fallback: DrawSettings = defaultSettings(),
): DrawSettings {
  const animationStyle: AnimationStyle =
    raw?.animationStyle && ANIMATION_STYLES.includes(raw.animationStyle)
      ? raw.animationStyle
      : fallback.animationStyle;
  const privacy: Privacy =
    raw?.privacy && PRIVACIES.includes(raw.privacy)
      ? raw.privacy
      : fallback.privacy;
  return {
    animationStyle,
    privacy,
    removeWinnersOnSelect:
      typeof raw?.removeWinnersOnSelect === "boolean"
        ? raw.removeWinnersOnSelect
        : fallback.removeWinnersOnSelect,
    soundEnabled:
      typeof raw?.soundEnabled === "boolean"
        ? raw.soundEnabled
        : fallback.soundEnabled,
  };
}

export function defaultSettings(): DrawSettings {
  return {
    removeWinnersOnSelect: true,
    animationStyle: "wheel",
    soundEnabled: true,
    privacy: "public",
  };
}

export function validateWinnerTarget(
  target: number,
  totalParticipants: number,
): number {
  if (!Number.isFinite(target) || !Number.isInteger(target)) {
    throw new ApiError(400, "Number of winners must be a whole number.");
  }
  if (target < 1) {
    throw new ApiError(400, "Number of winners must be at least 1.");
  }
  if (totalParticipants < 1) {
    throw new ApiError(400, "Add at least one participant before continuing.");
  }
  if (target > totalParticipants) {
    throw new ApiError(
      400,
      "Number of winners cannot exceed participant count.",
    );
  }
  return target;
}

export function createSeedCommitment(): string {
  const seed = randomBytes(32);
  return createHash("sha256").update(seed).digest("hex");
}

export function entropyFingerprint(
  seedCommitment: string,
  drawId: string,
  order: number,
  participantId: string,
  nonce: string,
): string {
  return createHash("sha256")
    .update(`${seedCommitment}:${drawId}:${order}:${participantId}:${nonce}`)
    .digest("hex")
    .slice(0, 32);
}

export function randomIndex(length: number): number {
  if (length <= 0) throw new ApiError(409, "No active participants remain.");
  return randomInt(0, length);
}

export function pickWeightedIndex(
  weights: number[],
): { index: number; roll: number } {
  const total = weights.reduce((sum, w) => sum + w, 0);
  if (total <= 0) throw new ApiError(409, "No active participants remain.");
  const roll = randomInt(0, total);
  let acc = 0;
  for (let i = 0; i < weights.length; i += 1) {
    acc += weights[i];
    if (roll < acc) return { index: i, roll };
  }
  return { index: weights.length - 1, roll };
}

export function shortHash(hash: string, length = 16): string {
  return hash.slice(0, length);
}

export function isTerminal(status: DrawStatus): boolean {
  return status === "COMPLETED" || status === "ARCHIVED";
}

export {
  dedupeNames,
  normalizeEntries,
  parseCsvNames,
  parseNameList,
} from "./entries";
export type { NormalizedEntry } from "./entries";

export function hashesEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

import type { Draw, Participant, Winner } from "@prisma/client";
import { shortHash } from "./draw";
import { settingsOf, toWinnerDTO } from "./serialize";

export interface VerificationPayload {
  draw: {
    id: string;
    name: string;
    eventName: string | null;
    prize: string | null;
    status: string;
    winnerCountTarget: number;
    winnersSelectedCount: number;
    totalParticipants: number;
    totalEntries: number;
    settings: ReturnType<typeof settingsOf>;
    createdAt: string;
    lockedAt: string | null;
    completedAt: string | null;
  };
  pool: {
    activeParticipants: number;
    activeEntries: number;
  };
  verification: {
    randomness: string;
    commitmentAlgorithm: string;
    seedCommitment: string;
    seedCommitmentShort: string;
    participantsAtStart: number;
    entriesAtStart: number;
    selectionsRecorded: number;
  };
  winners: ReturnType<typeof toWinnerDTO>[];
  participants: {
    name: string;
    entryCount: number;
    status: string;
    selectionOrder: number | null;
    selectedAt: string | null;
  }[];
}

export function buildVerificationPayload(
  draw: Draw,
  participants: Participant[],
  winners: Winner[],
): VerificationPayload {
  const remainingActive = participants.filter((p) => p.status === "ACTIVE");
  return {
    draw: {
      id: draw.id,
      name: draw.name,
      eventName: draw.eventName,
      prize: draw.prize,
      status: draw.status,
      winnerCountTarget: draw.winnerCountTarget,
      winnersSelectedCount: draw.winnersSelectedCount,
      totalParticipants: draw.totalParticipants,
      totalEntries: draw.totalEntries,
      settings: settingsOf(draw),
      createdAt: draw.createdAt.toISOString(),
      lockedAt: draw.lockedAt ? draw.lockedAt.toISOString() : null,
      completedAt: draw.completedAt ? draw.completedAt.toISOString() : null,
    },
    pool: {
      activeParticipants: remainingActive.length,
      activeEntries: remainingActive.reduce((sum, p) => sum + p.entryCount, 0),
    },
    verification: {
      randomness: "Node.js crypto.randomInt (CSPRNG)",
      commitmentAlgorithm: "SHA-256",
      seedCommitment: draw.seedCommitment,
      seedCommitmentShort: shortHash(draw.seedCommitment),
      participantsAtStart: draw.totalParticipants,
      entriesAtStart: draw.totalEntries,
      selectionsRecorded: winners.length,
    },
    winners: winners.map(toWinnerDTO),
    participants: participants.map((p) => ({
      name: p.name,
      entryCount: p.entryCount,
      status: p.status,
      selectionOrder: p.selectionOrder,
      selectedAt: p.selectedAt ? p.selectedAt.toISOString() : null,
    })),
  };
}

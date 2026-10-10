import type {
  Draw,
  Participant,
  SavedRoster,
  Winner,
} from "@prisma/client";
import type {
  DrawDTO,
  DrawSettings,
  DrawSummaryDTO,
  ParticipantDTO,
  SavedRosterDTO,
  WinnerDTO,
} from "./types";
import { normalizeSettings } from "./draw";

export function settingsOf(draw: Draw): DrawSettings {
  return normalizeSettings({
    removeWinnersOnSelect: draw.removeWinnersOnSelect,
    animationStyle: draw.animationStyle as DrawSettings["animationStyle"],
    soundEnabled: draw.soundEnabled,
    privacy: draw.privacy as DrawSettings["privacy"],
  });
}

export function toParticipantDTO(p: Participant): ParticipantDTO {
  return {
    id: p.id,
    name: p.name,
    entryCount: p.entryCount,
    status: p.status as ParticipantDTO["status"],
    position: p.position,
    selectionOrder: p.selectionOrder,
    selectedAt: p.selectedAt ? p.selectedAt.toISOString() : null,
  };
}

export function toWinnerDTO(w: Winner): WinnerDTO {
  return {
    id: w.id,
    participantId: w.participantId,
    name: w.name,
    drawOrder: w.drawOrder,
    entryCountAtSelection: w.entryCountAtSelection,
    entropyFingerprint: w.entropyFingerprint,
    selectedAt: w.selectedAt.toISOString(),
  };
}

export function toDrawDTO(
  draw: Draw,
  extras?: { participants?: Participant[]; winners?: Winner[] },
): DrawDTO {
  return {
    id: draw.id,
    userId: draw.userId,
    name: draw.name,
    eventName: draw.eventName,
    prize: draw.prize,
    status: draw.status as DrawDTO["status"],
    totalParticipants: draw.totalParticipants,
    totalEntries: draw.totalEntries,
    winnerCountTarget: draw.winnerCountTarget,
    winnersSelectedCount: draw.winnersSelectedCount,
    settings: settingsOf(draw),
    seedCommitment: draw.seedCommitment,
    createdAt: draw.createdAt.toISOString(),
    lockedAt: draw.lockedAt ? draw.lockedAt.toISOString() : null,
    completedAt: draw.completedAt ? draw.completedAt.toISOString() : null,
    participants: extras?.participants?.map(toParticipantDTO),
    winners: extras?.winners?.map(toWinnerDTO),
  };
}

export function toDrawSummary(draw: Draw): DrawSummaryDTO {
  return {
    id: draw.id,
    name: draw.name,
    eventName: draw.eventName,
    prize: draw.prize,
    status: draw.status as DrawSummaryDTO["status"],
    totalParticipants: draw.totalParticipants,
    totalEntries: draw.totalEntries,
    winnerCountTarget: draw.winnerCountTarget,
    winnersSelectedCount: draw.winnersSelectedCount,
    animationStyle: settingsOf(draw).animationStyle,
    createdAt: draw.createdAt.toISOString(),
  };
}

export function toRosterDTO(roster: SavedRoster): SavedRosterDTO {
  let names: string[] = [];
  try {
    const parsed = JSON.parse(roster.names);
    if (Array.isArray(parsed)) names = parsed.filter((n) => typeof n === "string");
  } catch {
    names = [];
  }
  return {
    id: roster.id,
    userId: roster.userId,
    title: roster.title,
    names,
    createdAt: roster.createdAt.toISOString(),
    updatedAt: roster.updatedAt.toISOString(),
  };
}

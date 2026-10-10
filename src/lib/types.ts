export type AnimationStyle = "wheel" | "slot" | "shuffle" | "card";

export type DrawStatus =
  | "DRAFT"
  | "READY"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "ARCHIVED";

export type ParticipantStatus = "ACTIVE" | "SELECTED" | "REMOVED";

export type Privacy = "public" | "unlisted" | "private";

export interface DrawSettings {
  removeWinnersOnSelect: boolean;
  animationStyle: AnimationStyle;
  soundEnabled: boolean;
  privacy: Privacy;
}

export interface UserDTO {
  id: string;
  email: string;
  displayName: string;
  createdAt: string;
}

export interface SavedRosterDTO {
  id: string;
  userId: string | null;
  title: string;
  names: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ParticipantDTO {
  id: string;
  name: string;
  entryCount: number;
  status: ParticipantStatus;
  position: number;
  selectionOrder: number | null;
  selectedAt: string | null;
}

export interface WinnerDTO {
  id: string;
  participantId: string;
  name: string;
  drawOrder: number;
  entryCountAtSelection: number;
  entropyFingerprint: string;
  selectedAt: string;
}

export type DrawSettingsDTO = DrawSettings;

export interface DrawDTO {
  id: string;
  userId: string | null;
  name: string;
  eventName: string | null;
  prize: string | null;
  status: DrawStatus;
  totalParticipants: number;
  totalEntries: number;
  winnerCountTarget: number;
  winnersSelectedCount: number;
  settings: DrawSettingsDTO;
  seedCommitment: string;
  createdAt: string;
  lockedAt: string | null;
  completedAt: string | null;
  participants?: ParticipantDTO[];
  winners?: WinnerDTO[];
}

export interface DrawSummaryDTO {
  id: string;
  name: string;
  eventName: string | null;
  prize: string | null;
  status: DrawStatus;
  totalParticipants: number;
  totalEntries: number;
  winnerCountTarget: number;
  winnersSelectedCount: number;
  animationStyle: AnimationStyle;
  createdAt: string;
}

export interface AuthStateDTO {
  user: UserDTO | null;
}

export interface CreateDrawInput {
  name: string;
  eventName?: string;
  prize?: string;
  winnerCountTarget: number;
  settings: Partial<DrawSettings>;
  participants: { name: string; entryCount?: number }[];
}

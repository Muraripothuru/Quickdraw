export function buildWinnerRows(
  winners: {
    drawOrder: number;
    name: string;
    entryCountAtSelection: number;
    selectedAt: Date | string;
    entropyFingerprint: string;
  }[],
) {
  return winners.map((winner) => ({
    drawOrder: winner.drawOrder,
    name: winner.name,
    entryCountAtSelection: winner.entryCountAtSelection,
    selectedAt:
      typeof winner.selectedAt === "string"
        ? winner.selectedAt
        : winner.selectedAt.toISOString(),
    entropyFingerprint: winner.entropyFingerprint,
  }));
}

function csvEscape(value: string | number): string {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export interface CsvInput {
  drawId: string;
  drawName: string;
  eventName?: string | null;
  prize?: string | null;
  status: string;
  seedCommitment: string;
  createdAt: string;
  completedAt?: string | null;
  winners: {
    drawOrder: number;
    name: string;
    entryCountAtSelection: number;
    selectedAt: string;
    entropyFingerprint: string;
  }[];
}

export function winnersCsv(input: CsvInput): string {
  const header = [
    "draw_id",
    "draw_name",
    "event_name",
    "prize",
    "status",
    "seed_commitment",
    "created_at",
    "completed_at",
    "draw_order",
    "winner_name",
    "entries_at_selection",
    "selected_at",
    "entropy_fingerprint",
  ];
  const rows = input.winners.map((winner) =>
    [
      input.drawId,
      input.drawName,
      input.eventName ?? "",
      input.prize ?? "",
      input.status,
      input.seedCommitment,
      input.createdAt,
      input.completedAt ?? "",
      winner.drawOrder,
      winner.name,
      winner.entryCountAtSelection,
      winner.selectedAt,
      winner.entropyFingerprint,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [header.join(","), ...rows].join("\r\n");
}

export function downloadTextFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printReport() {
  window.print();
}

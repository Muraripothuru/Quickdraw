const MAX_NAMES = 5000;

export function sanitizeNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const item of raw) {
    if (typeof item !== "string") continue;
    const name = item.trim();
    if (!name) continue;
    out.push(name.slice(0, 200));
    if (out.length >= MAX_NAMES) break;
  }
  return out;
}

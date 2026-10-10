export interface NormalizedEntry {
  name: string;
  entryCount: number;
}

export function parseNameList(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((line) => line.slice(0, 200));
}

export function parseCsvNames(raw: string): string[] {
  const lines = raw.split(/\r?\n/);
  const names: string[] = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    if (!line.trim()) continue;
    const cells = line.split(",");
    const cell = (cells[0] ?? "").trim().replace(/^"(.*)"$/, "$1").trim();
    if (i === 0 && /^(name|participant|entry|full ?name|player)/i.test(cell)) continue;
    if (!cell) continue;
    names.push(cell.slice(0, 200));
  }
  return names;
}

export function dedupeNames(names: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

export function hasDuplicates(names: string[]): boolean {
  const seen = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) return true;
    seen.add(key);
  }
  return false;
}

export function duplicateNames(names: string[]): string[] {
  const seen = new Set<string>();
  const dupes = new Set<string>();
  for (const name of names) {
    const key = name.toLowerCase();
    if (seen.has(key)) dupes.add(name);
    seen.add(key);
  }
  return [...dupes];
}

export function normalizeEntries(
  names: string[],
  options: { dedupe: boolean },
): NormalizedEntry[] {
  if (options.dedupe) {
    return dedupeNames(names).map((name) => ({ name, entryCount: 1 }));
  }
  const map = new Map<string, NormalizedEntry>();
  const order: string[] = [];
  for (const name of names) {
    const existing = map.get(name);
    if (existing) {
      existing.entryCount += 1;
    } else {
      map.set(name, { name, entryCount: 1 });
      order.push(name);
    }
  }
  return order.map((name) => map.get(name)!);
}

export function uniqueNameCount(names: string[]): number {
  const seen = new Set<string>();
  for (const name of names) seen.add(name.toLowerCase());
  return seen.size;
}

type Listener = (payload: RealtimeEvent) => void;

export interface RealtimeEvent {
  type: "draw.updated" | "participant.selected" | "draw.locked";
  drawId: string;
  at: string;
}

const channels = new Map<string, Set<Listener>>();

export function subscribe(drawId: string, listener: Listener) {
  let set = channels.get(drawId);
  if (!set) {
    set = new Set();
    channels.set(drawId, set);
  }
  set.add(listener);
  return () => {
    const current = channels.get(drawId);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) channels.delete(drawId);
  };
}

export function publish(
  drawId: string,
  type: RealtimeEvent["type"],
): void {
  const event: RealtimeEvent = { type, drawId, at: new Date().toISOString() };
  const set = channels.get(drawId);
  if (!set) return;
  for (const listener of set) {
    try {
      listener(event);
    } catch {
      // ignore listener failures so one bad subscriber cannot break the bus
    }
  }
}

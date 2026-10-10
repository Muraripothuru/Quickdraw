"use client";

export function getGuestKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem("ld_guest_key");
    if (existing) return existing;
    const created =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem("ld_guest_key", created);
    return created;
  } catch {
    return "";
  }
}

export function resetGuestKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const created =
      typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    window.localStorage.setItem("ld_guest_key", created);
    return created;
  } catch {
    return "";
  }
}

export class ApiClientError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  const guestKey = getGuestKey();
  if (guestKey) headers.set("x-guest-key", guestKey);

  const body =
    init?.json !== undefined ? JSON.stringify(init.json) : init?.body;

  const res = await fetch(path, {
    ...init,
    headers,
    body: body ?? (init?.method && init.method !== "GET" ? "{}" : undefined),
    cache: "no-store",
  });

  let payload: unknown = null;
  try {
    payload = await res.json();
  } catch {
    payload = null;
  }

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String((payload as { error: unknown }).error)
        : `Request failed (${res.status})`;
    throw new ApiClientError(message, res.status);
  }
  return payload as T;
}

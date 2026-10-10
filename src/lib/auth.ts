import "server-only";

import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { cookies, headers } from "next/headers";
import { ApiError } from "./api";
import { prisma } from "./db";
import type { UserDTO } from "./types";

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const COOKIE_NAME = "ld_session";
const SESSION_DAYS = 30;
const GUEST_HEADER = "x-guest-key";

export interface OwnerScope {
  userId: string | null;
  guestKey: string | null;
}

export function toUserDTO(user: {
  id: string;
  email: string;
  displayName: string;
  createdAt: Date;
}): UserDTO {
  return {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    createdAt: user.createdAt.toISOString(),
  };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scryptAsync(password, salt, 64, {
    N: 16384,
    r: 8,
    p: 1,
  });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${derived.toString("base64")}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4], "base64");
  const expected = Buffer.from(parts[5], "base64");
  try {
    const derived = await scryptAsync(password, salt, expected.length, { N, r, p });
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { token } });
    cookieStore.delete(COOKIE_NAME);
  }
}

export async function getCurrentUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: true },
  });
  if (!session) return null;
  if (session.expiresAt.getTime() < Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => null);
    return null;
  }
  return session.user;
}

export async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "Sign in to continue.");
  return user;
}

function sanitizeGuestKey(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(trimmed)) return null;
  return trimmed;
}

export async function getOwnerScope(req?: Request): Promise<OwnerScope> {
  const user = await getCurrentUser();
  if (user) return { userId: user.id, guestKey: null };
  if (req) {
    const headerStore = await headers();
    const raw = req.headers.get(GUEST_HEADER) ?? headerStore.get(GUEST_HEADER);
    const guestKey = sanitizeGuestKey(raw);
    if (guestKey) return { userId: null, guestKey };
  }
  return { userId: null, guestKey: null };
}

export async function requireOwnerScope(req: Request): Promise<OwnerScope> {
  const scope = await getOwnerScope(req);
  if (!scope.userId && !scope.guestKey) {
    throw new ApiError(401, "Sign in or continue as a guest to manage draws.");
  }
  return scope;
}

export async function assertDrawAccess(
  drawId: string,
  scope: OwnerScope,
  allowPrivateView = false,
) {
  const draw = await prisma.draw.findUnique({ where: { id: drawId } });
  if (!draw) throw new ApiError(404, "Draw not found.");
  const isOwner =
    (scope.userId && draw.userId === scope.userId) ||
    (scope.guestKey && draw.guestKey === scope.guestKey);
  if (isOwner) return draw;
  if (allowPrivateView && draw.privacy === "public") return draw;
  if (!allowPrivateView && draw.privacy !== "private") return draw;
  if (allowPrivateView && draw.privacy === "unlisted") return draw;
  throw new ApiError(403, "You do not have access to this draw.");
}

export async function requireDrawOwner(drawId: string, scope: OwnerScope) {
  const draw = await prisma.draw.findUnique({ where: { id: drawId } });
  if (!draw) throw new ApiError(404, "Draw not found.");
  const isOwner =
    (scope.userId && draw.userId === scope.userId) ||
    (scope.guestKey && draw.guestKey === scope.guestKey && !draw.userId);
  if (!isOwner) throw new ApiError(403, "You do not have access to this draw.");
  if (
    !draw.userId &&
    draw.guestExpiresAt &&
    draw.guestExpiresAt.getTime() < Date.now()
  ) {
    throw new ApiError(410, "This guest draw has expired.");
  }
  return draw;
}

export const GUEST_TTL_MS = 24 * 60 * 60 * 1000;

export function guestExpiry(): Date {
  return new Date(Date.now() + GUEST_TTL_MS);
}

export async function pruneExpiredGuestData(scope: OwnerScope) {
  if (scope.userId || !scope.guestKey) return;
  const now = new Date();
  await prisma.draw.deleteMany({
    where: {
      guestKey: scope.guestKey,
      userId: null,
      guestExpiresAt: { lt: now },
    },
  });
  await prisma.savedRoster.deleteMany({
    where: {
      guestKey: scope.guestKey,
      userId: null,
      guestExpiresAt: { lt: now },
    },
  });
}

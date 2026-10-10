import {
  ApiError,
  errorResponse,
  ok,
  readJson,
  requireString,
} from "@/lib/api";
import {
  getOwnerScope,
  guestExpiry,
  pruneExpiredGuestData,
} from "@/lib/auth";
import {
  createSeedCommitment,
  newDrawId,
  normalizeSettings,
  validateWinnerTarget,
} from "@/lib/draw";
import { prisma } from "@/lib/db";
import { sanitizeNames } from "@/lib/names";
import { toDrawSummary } from "@/lib/serialize";
import type { CreateDrawInput } from "@/lib/types";

const MAX_PARTICIPANTS = 5000;

export async function GET(req: Request) {
  try {
    const scope = await getOwnerScope(req);
    if (!scope.userId && !scope.guestKey) return ok({ draws: [] });
    await pruneExpiredGuestData(scope);
    const draws = await prisma.draw.findMany({
      where: scope.userId
        ? { userId: scope.userId }
        : { guestKey: scope.guestKey, userId: null },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    return ok({ draws: draws.map(toDrawSummary) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const scope = await getOwnerScope(req);
    if (!scope.userId && !scope.guestKey) {
      return ok(
        { error: "Sign in or continue as a guest to create a draw." },
        { status: 401 },
      );
    }

    const body = await readJson<CreateDrawInput>(req);
    const name = requireString(body.name, "Draw title", 140);
    const eventName = body.eventName ? requireString(body.eventName, "Event name", 140) : null;
    const prize = body.prize ? requireString(body.prize, "Prize details", 240) : null;

    const rawNames = sanitizeNames(
      (body.participants ?? []).map((p) => p?.name ?? ""),
    );
    if (rawNames.length === 0) {
      throw new ApiError(400, "Add at least one participant.");
    }
    if (rawNames.length > MAX_PARTICIPANTS) {
      throw new ApiError(400, `Maximum ${MAX_PARTICIPANTS} participants per draw.`);
    }

    const participants = rawNames.map((entryName, index) => {
      const source = body.participants?.[index];
      const entryCountRaw =
        source && typeof source.entryCount === "number" ? source.entryCount : 1;
      const entryCount = Math.min(
        MAX_PARTICIPANTS,
        Math.max(1, Math.floor(entryCountRaw) || 1),
      );
      return { name: entryName, entryCount, position: index };
    });

    const totalParticipants = participants.length;
    const totalEntries = participants.reduce((sum, p) => sum + p.entryCount, 0);
    const target = validateWinnerTarget(
      Math.floor(Number(body.winnerCountTarget) || 1),
      totalParticipants,
    );
    const settings = normalizeSettings(body.settings);

    let drawId = newDrawId();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const clash = await prisma.draw.findUnique({ where: { id: drawId } });
      if (!clash) break;
      drawId = newDrawId();
    }

    const draw = await prisma.draw.create({
      data: {
        id: drawId,
        userId: scope.userId,
        guestKey: scope.userId ? null : scope.guestKey,
        guestExpiresAt: scope.userId ? null : guestExpiry(),
        name,
        eventName,
        prize,
        status: "READY",
        totalParticipants,
        totalEntries,
        winnerCountTarget: target,
        removeWinnersOnSelect: settings.removeWinnersOnSelect,
        animationStyle: settings.animationStyle,
        soundEnabled: settings.soundEnabled,
        privacy: settings.privacy,
        seedCommitment: createSeedCommitment(),
        participants: {
          create: participants.map((p) => ({
            name: p.name,
            entryCount: p.entryCount,
            position: p.position,
          })),
        },
      },
    });

    return ok({ drawId: draw.id }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

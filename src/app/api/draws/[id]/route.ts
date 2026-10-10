import { ApiError, errorResponse, ok, readJson, requireString } from "@/lib/api";
import { assertDrawAccess, getOwnerScope, requireDrawOwner } from "@/lib/auth";
import { normalizeSettings, validateWinnerTarget } from "@/lib/draw";
import { prisma } from "@/lib/db";
import { publish } from "@/lib/realtime";
import { toDrawDTO } from "@/lib/serialize";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const scope = await getOwnerScope(req);
    const draw = await assertDrawAccess(id, scope, true);
    const [participants, winners] = await Promise.all([
      prisma.participant.findMany({
        where: { drawId: draw.id },
        orderBy: { position: "asc" },
      }),
      prisma.winner.findMany({
        where: { drawId: draw.id },
        orderBy: { drawOrder: "asc" },
      }),
    ]);
    return ok(toDrawDTO(draw, { participants, winners }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const scope = await requireOwnerScopeSafe(req);
    const draw = await requireDrawOwner(id, scope);
    const locked = draw.status === "IN_PROGRESS" || draw.status === "COMPLETED";
    const body = await readJson<{
      name?: string;
      eventName?: string | null;
      prize?: string | null;
      winnerCountTarget?: number;
      settings?: Record<string, unknown>;
    }>(req);

    const data: Record<string, unknown> = {};

    if (typeof body.name === "string") data.name = requireString(body.name, "Draw title", 140);
    if (body.eventName !== undefined) {
      data.eventName = body.eventName
        ? requireString(body.eventName, "Event name", 140)
        : null;
    }
    if (body.prize !== undefined) {
      data.prize = body.prize ? requireString(body.prize, "Prize details", 240) : null;
    }

    if (body.winnerCountTarget !== undefined) {
      const nextTarget = validateWinnerTarget(
        Math.floor(Number(body.winnerCountTarget)),
        draw.totalParticipants,
      );
      // A completed draw may raise its target (never lower it) so the
      // presenter can keep drawing winners from the same page; re-opening
      // flips the status back to IN_PROGRESS for the next selection.
      const extending =
        draw.status === "COMPLETED" &&
        nextTarget > draw.winnerCountTarget &&
        nextTarget > draw.winnersSelectedCount;
      if (locked && !extending) {
        throw new ApiError(400, "The draw is locked. Winner count can no longer be changed.");
      }
      data.winnerCountTarget = nextTarget;
      if (extending) {
        data.status = "IN_PROGRESS";
        data.completedAt = null;
      }
    }

    if (body.settings) {
      const toggled =
        typeof body.settings.removeWinnersOnSelect === "boolean" &&
        body.settings.removeWinnersOnSelect !== draw.removeWinnersOnSelect;
      if (locked && draw.winnersSelectedCount > 0 && toggled) {
        throw new ApiError(
          400,
          "Winner elimination cannot be changed after the first selection.",
        );
      }
      const settings = normalizeSettings(
        {
          removeWinnersOnSelect: body.settings.removeWinnersOnSelect as boolean,
          animationStyle: body.settings.animationStyle as never,
          soundEnabled: body.settings.soundEnabled as boolean,
          privacy: body.settings.privacy as never,
        },
        {
          removeWinnersOnSelect: draw.removeWinnersOnSelect,
          animationStyle: draw.animationStyle as never,
          soundEnabled: draw.soundEnabled,
          privacy: draw.privacy as never,
        },
      );
      data.removeWinnersOnSelect = settings.removeWinnersOnSelect;
      data.animationStyle = settings.animationStyle;
      data.soundEnabled = settings.soundEnabled;
      data.privacy = settings.privacy;
    }

    if (Object.keys(data).length === 0) throw new ApiError(400, "Nothing to update.");

    const updated = await prisma.draw.update({ where: { id: draw.id }, data });
    publish(draw.id, "draw.updated");
    const [participants, winners] = await Promise.all([
      prisma.participant.findMany({
        where: { drawId: draw.id },
        orderBy: { position: "asc" },
      }),
      prisma.winner.findMany({
        where: { drawId: draw.id },
        orderBy: { drawOrder: "asc" },
      }),
    ]);
    return ok(toDrawDTO(updated, { participants, winners }));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const scope = await requireOwnerScopeSafe(req);
    await requireDrawOwner(id, scope);
    await prisma.draw.delete({ where: { id } });
    return ok({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

async function requireOwnerScopeSafe(req: Request) {
  const scope = await getOwnerScope(req);
  if (!scope.userId && !scope.guestKey) {
    throw new ApiError(401, "Sign in or continue as a guest to manage draws.");
  }
  return scope;
}

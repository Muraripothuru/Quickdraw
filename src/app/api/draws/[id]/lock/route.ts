import { ApiError, errorResponse, ok } from "@/lib/api";
import { getOwnerScope, requireDrawOwner } from "@/lib/auth";
import { validateWinnerTarget } from "@/lib/draw";
import { prisma } from "@/lib/db";
import { toDrawDTO } from "@/lib/serialize";
import { publish } from "@/lib/realtime";
import type { Draw } from "@prisma/client";

async function drawDTO(draw: Draw) {
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
  return toDrawDTO(draw, { participants, winners });
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const scope = await getOwnerScope(req);
    if (!scope.userId && !scope.guestKey) {
      throw new ApiError(401, "Sign in or continue as a guest.");
    }
    const { id } = await ctx.params;
    const draw = await requireDrawOwner(id, scope);

    if (draw.status === "COMPLETED" || draw.status === "ARCHIVED") {
      throw new ApiError(409, "This draw is already complete.");
    }
    if (draw.status === "IN_PROGRESS") {
      return ok(await drawDTO(draw));
    }

    const participants = await prisma.participant.count({ where: { drawId: draw.id } });
    if (participants === 0) throw new ApiError(400, "Add participants before locking the draw.");
    validateWinnerTarget(draw.winnerCountTarget, participants);

    const updated = await prisma.draw.update({
      where: { id: draw.id },
      data: { status: "IN_PROGRESS", lockedAt: new Date() },
    });
    publish(draw.id, "draw.locked");
    return ok(await drawDTO(updated));
  } catch (error) {
    return errorResponse(error);
  }
}

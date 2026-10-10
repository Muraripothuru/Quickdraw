import { ApiError, errorResponse, ok, readJson } from "@/lib/api";
import { getOwnerScope, requireDrawOwner } from "@/lib/auth";
import { validateWinnerTarget } from "@/lib/draw";
import { prisma } from "@/lib/db";
import { sanitizeNames } from "@/lib/names";
import { publish } from "@/lib/realtime";
import { toDrawDTO } from "@/lib/serialize";

const MAX_PARTICIPANTS = 5000;

export async function PUT(
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

    if (draw.status !== "DRAFT" && draw.status !== "READY") {
      throw new ApiError(400, "This draw is locked. Participants cannot be edited.");
    }

    const body = await readJson<{ participants?: { name?: string; entryCount?: number }[] }>(
      req,
    );
    const list = Array.isArray(body.participants) ? body.participants : [];
    const names = sanitizeNames(list.map((p) => p?.name ?? ""));
    if (names.length === 0) throw new ApiError(400, "Add at least one participant.");
    if (names.length > MAX_PARTICIPANTS) {
      throw new ApiError(400, `Maximum ${MAX_PARTICIPANTS} participants per draw.`);
    }

    const entries = names.map((name, index) => {
      const source = list[index];
      const raw = source && typeof source.entryCount === "number" ? source.entryCount : 1;
      return {
        name,
        entryCount: Math.min(MAX_PARTICIPANTS, Math.max(1, Math.floor(raw) || 1)),
        position: index,
      };
    });

    const totalParticipants = entries.length;
    const totalEntries = entries.reduce((sum, e) => sum + e.entryCount, 0);
    const target = validateWinnerTarget(draw.winnerCountTarget, totalParticipants);

    const updated = await prisma.$transaction(async (tx) => {
      await tx.participant.deleteMany({ where: { drawId: draw.id } });
      await tx.participant.createMany({
        data: entries.map((e) => ({ ...e, drawId: draw.id })),
      });
      return tx.draw.update({
        where: { id: draw.id },
        data: {
          totalParticipants,
          totalEntries,
          winnerCountTarget: target,
          status: "READY",
        },
      });
    });

    const participants = await prisma.participant.findMany({
      where: { drawId: draw.id },
      orderBy: { position: "asc" },
    });
    publish(draw.id, "draw.updated");
    return ok(toDrawDTO(updated, { participants }));
  } catch (error) {
    return errorResponse(error);
  }
}

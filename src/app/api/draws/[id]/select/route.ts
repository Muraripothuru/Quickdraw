import { randomBytes } from "node:crypto";
import { ApiError, errorResponse, ok } from "@/lib/api";
import { getOwnerScope, requireDrawOwner } from "@/lib/auth";
import { entropyFingerprint, pickWeightedIndex } from "@/lib/draw";
import { prisma } from "@/lib/db";
import { publish } from "@/lib/realtime";
import { toDrawDTO } from "@/lib/serialize";
import type { Draw, Participant, Winner } from "@prisma/client";

class PoolRaceError extends Error {}

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
    await requireDrawOwner(id, scope);

    let lastError: unknown = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const result = await selectOnce(id);
        publish(id, "participant.selected");
        return ok(result);
      } catch (error) {
        if (error instanceof PoolRaceError) {
          lastError = error;
          continue;
        }
        throw error;
      }
    }
    console.error(lastError);
    throw new ApiError(409, "The pool changed while selecting. Please try again.");
  } catch (error) {
    return errorResponse(error);
  }
}

async function selectOnce(drawId: string) {
  return prisma.$transaction(async (tx) => {
    const draw = (await tx.draw.findUnique({ where: { id: drawId } })) as Draw;
    if (!draw) throw new ApiError(404, "Draw not found.");
    if (draw.status === "COMPLETED" || draw.status === "ARCHIVED") {
      throw new ApiError(409, "All winners have been selected for this draw.");
    }
    if (draw.status !== "IN_PROGRESS") {
      // The pool can still change while the draw is DRAFT/READY. Locking
      // freezes participants before any selection is made.
      throw new ApiError(409, "Lock the draw before selecting winners.");
    }
    if (draw.winnersSelectedCount >= draw.winnerCountTarget) {
      await tx.draw.update({
        where: { id: drawId },
        data: { status: "COMPLETED", completedAt: new Date() },
      });
      throw new ApiError(409, "All winners have been selected for this draw.");
    }

    const pool = (await tx.participant.findMany({
      where: { drawId, status: "ACTIVE" },
      orderBy: { position: "asc" },
    })) as Participant[];

    if (pool.length === 0) {
      throw new ApiError(
        409,
        "No active participants remain in the pool.",
      );
    }

    const weights = pool.map((p) => Math.max(1, p.entryCount));
    const { index: pickIndex } = pickWeightedIndex(weights);
    const picked = pool[pickIndex];
    const drawOrder = draw.winnersSelectedCount + 1;
    const nonce = randomBytes(16).toString("hex");
    const fingerprint = entropyFingerprint(
      draw.seedCommitment,
      drawId,
      drawOrder,
      picked.id,
      nonce,
    );
    const now = new Date();

    if (draw.removeWinnersOnSelect) {
      const update = await tx.participant.updateMany({
        where: { id: picked.id, status: "ACTIVE" },
        data: {
          status: "SELECTED",
          selectionOrder: drawOrder,
          selectedAt: now,
          entropyFingerprint: fingerprint,
        },
      });
      if (update.count === 0) throw new PoolRaceError("participant already taken");
    }

    await tx.winner.create({
      data: {
        drawId,
        participantId: picked.id,
        name: picked.name,
        drawOrder,
        entryCountAtSelection: picked.entryCount,
        entropyFingerprint: fingerprint,
        selectedAt: now,
      },
    });

    const completed = drawOrder >= draw.winnerCountTarget;
    const updatedDraw = (await tx.draw.update({
      where: { id: drawId },
      data: {
        winnersSelectedCount: drawOrder,
        status: completed ? "COMPLETED" : "IN_PROGRESS",
        lockedAt: draw.lockedAt ?? now,
        completedAt: completed ? now : null,
      },
    })) as Draw;

    const participants = (await tx.participant.findMany({
      where: { drawId },
      orderBy: { position: "asc" },
    })) as Participant[];
    const winners = (await tx.winner.findMany({
      where: { drawId },
      orderBy: { drawOrder: "asc" },
    })) as Winner[];

    return toDrawDTO(updatedDraw, { participants, winners });
  });
}

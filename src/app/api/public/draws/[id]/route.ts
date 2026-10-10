import { getOwnerScope } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildVerificationPayload } from "@/lib/verify";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const draw = await prisma.draw.findUnique({
    where: { id },
    include: {
      participants: { orderBy: { position: "asc" } },
      winners: { orderBy: { drawOrder: "asc" } },
    },
  });

  if (!draw) {
    return Response.json({ error: "Draw not found." }, { status: 404 });
  }

  if (draw.privacy === "private") {
    const scope = await getOwnerScope(req);
    const isOwner =
      (scope.userId && draw.userId === scope.userId) ||
      (scope.guestKey && draw.guestKey === scope.guestKey);
    if (!isOwner) {
      return Response.json({ error: "This draw is private." }, { status: 403 });
    }
  }

  return Response.json(
    buildVerificationPayload(draw, draw.participants, draw.winners),
  );
}

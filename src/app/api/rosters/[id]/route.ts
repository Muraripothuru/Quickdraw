import { errorResponse, ok, readJson, requireString } from "@/lib/api";
import { getOwnerScope, guestExpiry } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeNames } from "@/lib/names";
import { toRosterDTO } from "@/lib/serialize";

async function findRoster(id: string, req: Request) {
  const scope = await getOwnerScope(req);
  const roster = await prisma.savedRoster.findUnique({ where: { id } });
  if (!roster) return { error: "Roster not found.", status: 404 as const };
  const owned = scope.userId
    ? roster.userId === scope.userId
    : roster.guestKey === scope.guestKey && roster.userId === null;
  if (!owned) {
    return { error: "You do not have access to this roster.", status: 403 as const };
  }
  return { roster, scope };
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await ctx.params;
    const result = await findRoster(id, req);
    if ("error" in result) return ok({ error: result.error }, { status: result.status });
    return ok({ roster: toRosterDTO(result.roster) });
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
    const result = await findRoster(id, req);
    if ("error" in result) return ok({ error: result.error }, { status: result.status });

    const body = await readJson<{ title?: string; names?: unknown }>(req);
    const data: {
      title?: string;
      names?: string;
      guestExpiresAt?: Date;
    } = {};
    if (typeof body.title === "string") {
      data.title = requireString(body.title, "List name", 120);
    }
    if (body.names !== undefined) {
      const names = sanitizeNames(body.names);
      if (names.length === 0) {
        return ok({ error: "Add at least one name to this list." }, { status: 400 });
      }
      data.names = JSON.stringify(names);
    }
    if (!result.scope.userId && result.scope.guestKey) {
      data.guestExpiresAt = guestExpiry();
    }

    const roster = await prisma.savedRoster.update({ where: { id }, data });
    return ok({ roster: toRosterDTO(roster) });
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
    const result = await findRoster(id, req);
    if ("error" in result) return ok({ error: result.error }, { status: result.status });
    await prisma.savedRoster.delete({ where: { id } });
    return ok({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

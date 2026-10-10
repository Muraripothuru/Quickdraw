import { errorResponse, ok, readJson, requireString } from "@/lib/api";
import {
  getOwnerScope,
  guestExpiry,
  pruneExpiredGuestData,
} from "@/lib/auth";
import { prisma } from "@/lib/db";
import { sanitizeNames } from "@/lib/names";
import { toRosterDTO } from "@/lib/serialize";

export async function GET(req: Request) {
  try {
    const scope = await getOwnerScope(req);
    if (!scope.userId && !scope.guestKey) return ok({ rosters: [] });
    await pruneExpiredGuestData(scope);
    const rosters = await prisma.savedRoster.findMany({
      where: scope.userId
        ? { userId: scope.userId }
        : { guestKey: scope.guestKey, userId: null },
      orderBy: { updatedAt: "desc" },
    });
    return ok({ rosters: rosters.map(toRosterDTO) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(req: Request) {
  try {
    const scope = await getOwnerScope(req);
    if (!scope.userId && !scope.guestKey) {
      return ok(
        { error: "Sign in or continue as a guest to save rosters." },
        { status: 401 },
      );
    }
    const body = await readJson<{ title?: string; names?: unknown }>(req);
    const title = requireString(body.title, "List name", 120);
    const names = sanitizeNames(body.names);
    if (names.length === 0) {
      return ok({ error: "Add at least one name to this list." }, { status: 400 });
    }

    const roster = await prisma.savedRoster.create({
      data: {
        title,
        names: JSON.stringify(names),
        userId: scope.userId,
        guestKey: scope.userId ? null : scope.guestKey,
        guestExpiresAt: scope.userId ? null : guestExpiry(),
      },
    });
    return ok({ roster: toRosterDTO(roster) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

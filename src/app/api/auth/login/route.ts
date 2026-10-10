import { errorResponse, ok, readJson, requireString } from "@/lib/api";
import { createSession, toUserDTO, verifyPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const body = await readJson<{ email?: string; password?: string }>(req);
    const email = requireString(body.email, "Email", 254).toLowerCase();
    const password = requireString(body.password, "Password", 200);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !(await verifyPassword(password, user.passwordHash))) {
      return ok(
        { error: "Invalid email or password." },
        { status: 401 },
      );
    }

    await createSession(user.id);
    return ok({ user: toUserDTO(user) });
  } catch (error) {
    return errorResponse(error);
  }
}

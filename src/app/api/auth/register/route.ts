import { errorResponse, ok, readJson, requireString } from "@/lib/api";
import { createSession, hashPassword } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { toUserDTO } from "@/lib/auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  try {
    const body = await readJson<{
      email?: string;
      password?: string;
      displayName?: string;
    }>(req);

    const email = requireString(body.email, "Email", 254).toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return ok({ error: "Enter a valid email address." }, { status: 400 });
    }
    const password = requireString(body.password, "Password", 200);
    if (password.length < 8) {
      return ok(
        { error: "Password must be at least 8 characters." },
        { status: 400 },
      );
    }
    const displayName = requireString(
      body.displayName ?? email.split("@")[0],
      "Name",
      80,
    );

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return ok(
        { error: "An account with this email already exists." },
        { status: 409 },
      );
    }

    const user = await prisma.user.create({
      data: {
        email,
        displayName,
        passwordHash: await hashPassword(password),
      },
    });
    await createSession(user.id);
    return ok({ user: toUserDTO(user) }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

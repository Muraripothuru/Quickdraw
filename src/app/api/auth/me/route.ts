import { ok } from "@/lib/api";
import { getCurrentUser, toUserDTO } from "@/lib/auth";
import type { AuthStateDTO } from "@/lib/types";

export async function GET() {
  const user = await getCurrentUser();
  const payload: AuthStateDTO = {
    user: user ? toUserDTO(user) : null,
  };
  return ok(payload);
}

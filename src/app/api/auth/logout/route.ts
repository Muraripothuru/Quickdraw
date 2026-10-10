import { errorResponse, ok } from "@/lib/api";
import { destroySession } from "@/lib/auth";

export async function POST() {
  try {
    await destroySession();
    return ok({ success: true });
  } catch (error) {
    return errorResponse(error);
  }
}

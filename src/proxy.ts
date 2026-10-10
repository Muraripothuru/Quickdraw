import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { prisma } from "@/lib/db";

// `/draw/[id]` is a public verification page. Under Cache Components the page
// streams from a prerendered shell, so a `notFound()` thrown while rendering
// can no longer change the HTTP status (it becomes a soft 404 with status 200).
// Checking existence in Proxy runs before the response starts, which is the
// documented way to return a real HTTP 404 for a missing draw.
const DRAW_PAGE = /^\/draw\/([^/]+)$/;

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const match = pathname.match(DRAW_PAGE);
  if (!match) return NextResponse.next();

  const slug = decodeURIComponent(match[1]);
  // `/draw/new` is the create-draw page, not a draw id.
  if (slug.toLowerCase() === "new") return NextResponse.next();

  try {
    const draw = await prisma.draw.findUnique({
      where: { id: slug.toUpperCase() },
      select: { id: true },
    });
    if (!draw) {
      return NextResponse.rewrite(new URL("/_not-found", request.url), {
        status: 404,
      });
    }
  } catch {
    // If the lookup fails, let the page render and surface its own error.
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/draw/:id"],
};

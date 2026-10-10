import { getOwnerScope } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { subscribe } from "@/lib/realtime";

export async function GET(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const { id } = await ctx.params;
  const scope = await getOwnerScope(req);
  const draw = await prisma.draw.findUnique({ where: { id } });

  if (!draw) {
    return new Response(JSON.stringify({ error: "Draw not found." }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isOwner =
    (scope.userId && draw.userId === scope.userId) ||
    (scope.guestKey && draw.guestKey === scope.guestKey);
  const isPublic = draw.privacy !== "private";
  if (!isOwner && !isPublic) {
    return new Response(JSON.stringify({ error: "Forbidden." }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const encoder = new TextEncoder();
  let cleanup = () => {};

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
        } catch {
          cleanup();
        }
      };

      send({ type: "connected", drawId: id, at: new Date().toISOString() });

      const unsubscribe = subscribe(id, (event) => send(event));
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          cleanup();
        }
      }, 20000);

      cleanup = () => {
        clearInterval(ping);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      };

      req.signal.addEventListener("abort", () => {
        cleanup();
      });
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { VerificationView } from "@/components/verify/VerificationView";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { buildVerificationPayload } from "@/lib/verify";
import { IconChevronLeft } from "@/components/ui/icons";

export const instant = false;

export default async function DrawResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const draw = await prisma.draw.findUnique({
    where: { id: id.toUpperCase() },
    include: {
      participants: { orderBy: { position: "asc" } },
      winners: { orderBy: { drawOrder: "asc" } },
    },
  });

  if (!draw) notFound();

  if (draw.privacy === "private") {
    const user = await getCurrentUser();
    const headerStore = await headers();
    const guestKey = headerStore.get("x-guest-key");
    const isOwner =
      (user && draw.userId === user.id) ||
      (!user && guestKey && draw.guestKey === guestKey);
    if (!isOwner) {
      return (
        <div className="card mx-auto max-w-xl p-8 text-center">
          <h1 className="text-xl font-bold text-white">This draw is private</h1>
          <p className="mt-2 text-sm text-slate-400">
            The owner has restricted result visibility for {draw.id}.
          </p>
          <Link href="/" className="btn btn-outline mt-5">
            Go home
          </Link>
        </div>
      );
    }
  }

  const payload = buildVerificationPayload(draw, draw.participants, draw.winners);

  return (
    <div className="space-y-5">
      <Link
        href="/dashboard"
        className="no-print inline-flex items-center gap-1 text-sm text-slate-500 transition hover:text-white"
      >
        <IconChevronLeft width={16} height={16} />
        Dashboard
      </Link>
      <VerificationView payload={payload} />
    </div>
  );
}

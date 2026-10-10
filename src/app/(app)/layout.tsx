import { connection } from "next/server";
import { AppShell } from "@/components/layout/AppShell";

// The app shell depends on the request (session cookie, active pathname), so
// this segment renders on every request instead of being prerendered. A
// layout-level Suspense would stream the whole page after the status header is
// sent, which would turn notFound() responses into HTTP 200.
export const instant = false;

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await connection(); // prerendering stops here
  return <AppShell>{children}</AppShell>;
}

import Link from "next/link";
import { Logo } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-md text-center">
        <div className="flex justify-center">
          <Logo />
        </div>
        <h1 className="mt-8 text-4xl font-bold text-white">404</h1>
        <p className="mt-2 text-slate-400">
          That page or draw code could not be found.
        </p>
        <div className="mt-7 flex flex-col gap-3">
          <Link href="/" className="btn btn-primary">
            Back to home
          </Link>
          <Link href="/verify" className="btn btn-outline">
            Verify a draw
          </Link>
        </div>
      </div>
    </div>
  );
}

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/components/providers/AppProvider";
import {
  IconGrid,
  IconPlus,
  IconSearch,
  IconSpark,
  Logo,
} from "@/components/ui/icons";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, reducedMotion, setReducedMotion } = useApp();
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);

  if (lastPath !== pathname) {
    setLastPath(pathname);
    setMenuOpen(false);
  }

  const navItems = [
    { href: "/dashboard", label: "Dashboard", icon: IconGrid },
    { href: "/draw/new", label: "New Draw", icon: IconPlus },
    { href: "/verify", label: "Verify", icon: IconSearch },
  ];

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="sticky top-0 z-40 border-b border-line bg-ink/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-[max(1rem,env(safe-area-inset-left))] sm:px-6">
          <Link href="/dashboard" aria-label="LuckyDraw home">
            <Logo />
          </Link>

          <nav className="hidden items-center gap-1 md:flex" aria-label="Primary">
            {navItems.map((item) => {
              const active = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                    active
                      ? "bg-accent/15 text-indigo-200"
                      : "text-slate-400 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setReducedMotion(!reducedMotion)}
              className="hidden h-11 w-11 items-center justify-center rounded-xl border border-line text-slate-400 transition hover:border-accent hover:text-white sm:inline-flex"
              aria-pressed={reducedMotion}
              title={reducedMotion ? "Animations are reduced" : "Reduce motion"}
            >
              <IconSpark className={reducedMotion ? "text-accent2" : ""} />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex h-11 items-center gap-2 rounded-xl border border-line bg-panel2/70 px-3 text-sm font-semibold text-slate-200 transition hover:border-accent"
                aria-expanded={menuOpen}
                aria-haspopup="menu"
              >
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-accent/20 text-xs font-bold text-indigo-200">
                  {user ? initials(user.displayName) : "G"}
                </span>
                <span className="hidden sm:inline">
                  {loading ? "..." : user ? user.displayName.split(" ")[0] : "Guest"}
                </span>
              </button>

              {menuOpen ? (
                <>
                  <button
                    type="button"
                    aria-label="Close menu"
                    className="fixed inset-0 z-10 cursor-default"
                    onClick={() => setMenuOpen(false)}
                  />
                  <div
                    role="menu"
                    className="absolute right-0 z-20 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-panel p-2 shadow-2xl"
                  >
                    <div className="px-3 py-2.5">
                      <p className="truncate text-sm font-semibold text-white">
                        {user ? user.displayName : "Guest session"}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        {user ? user.email : "Data stored for 24 hours"}
                      </p>
                    </div>
                    <div className="my-1 h-px bg-line" />
                    <Link
                      href="/dashboard"
                      className="block rounded-xl px-3 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                      role="menuitem"
                    >
                      Dashboard
                    </Link>
                    <Link
                      href="/dashboard?tab=rosters"
                      className="block rounded-xl px-3 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                      role="menuitem"
                    >
                      Saved rosters
                    </Link>
                    <button
                      type="button"
                      onClick={() => setReducedMotion(!reducedMotion)}
                      className="block w-full rounded-xl px-3 py-3 text-left text-sm text-slate-300 hover:bg-white/5 hover:text-white"
                      role="menuitem"
                    >
                      {reducedMotion ? "Animations: reduced" : "Animations: full"}
                    </button>
                    <div className="my-1 h-px bg-line" />
                    {user ? (
                      <button
                        type="button"
                        onClick={() => {
                          void signOut();
                          router.push("/");
                        }}
                        className="block w-full rounded-xl px-3 py-3 text-left text-sm text-red-300 hover:bg-red-500/10"
                        role="menuitem"
                      >
                        Sign out
                      </button>
                    ) : (
                      <Link
                        href="/auth"
                        className="block rounded-xl px-3 py-3 text-sm text-indigo-300 hover:bg-white/5"
                        role="menuitem"
                      >
                        Create an account
                      </Link>
                    )}
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-[max(1rem,env(safe-area-inset-left))] pb-[calc(8rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pb-16">
        {children}
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-ink/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
        aria-label="Primary mobile"
      >
        <div className="mx-auto grid max-w-md grid-cols-3">
          {navItems.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            const emphasize = item.href === "/draw/new";
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition ${
                  active ? "text-indigo-300" : "text-slate-500"
                }`}
              >
                <span
                  className={`grid h-9 w-9 place-items-center rounded-xl ${
                    emphasize
                      ? "bg-accent text-white shadow-[0_10px_26px_-12px_rgba(99,102,241,1)]"
                      : active
                        ? "bg-accent/15 text-indigo-200"
                        : ""
                  }`}
                >
                  <Icon width={18} height={18} />
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

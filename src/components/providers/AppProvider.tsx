"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { api, getGuestKey, resetGuestKey } from "@/lib/client";
import type { AuthStateDTO, UserDTO } from "@/lib/types";

const MOTION_KEY = "ld_reduced_motion";
const MOTION_EVENT = "ld-motion-change";

function readReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const stored = window.localStorage.getItem(MOTION_KEY);
    if (stored === "1") return true;
    if (stored === "0") return false;
  } catch {
    // storage may be unavailable
  }
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function subscribeMotion(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(MOTION_EVENT, callback);
  const media = window.matchMedia("(prefers-reduced-motion: reduce)");
  media.addEventListener("change", callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(MOTION_EVENT, callback);
    media.removeEventListener("change", callback);
  };
}

interface ToastMessage {
  id: number;
  message: string;
  tone: "success" | "error" | "info";
}

interface AppState {
  user: UserDTO | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
  continueAsGuest: () => void;
  toast: (message: string, tone?: ToastMessage["tone"]) => void;
  reducedMotion: boolean;
  setReducedMotion: (value: boolean) => void;
}

const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const toastId = useRef(0);

  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    readReducedMotion,
    () => false,
  );

  const refresh = useCallback(async () => {
    try {
      const data = await api<AuthStateDTO>("/api/auth/me");
      setUser(data.user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await api<AuthStateDTO>("/api/auth/me");
        if (cancelled) return;
        setUser(data.user);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const setReducedMotion = useCallback((value: boolean) => {
    try {
      window.localStorage.setItem(MOTION_KEY, value ? "1" : "0");
    } catch {
      // storage may be unavailable
    }
    window.dispatchEvent(new Event(MOTION_EVENT));
  }, []);

  const toast = useCallback((message: string, tone: ToastMessage["tone"] = "info") => {
    toastId.current += 1;
    const id = toastId.current;
    setToasts((prev) => [...prev, { id, message, tone }]);
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const signOut = useCallback(async () => {
    try {
      await api("/api/auth/logout", { method: "POST" });
    } finally {
      setUser(null);
      resetGuestKey();
      await refresh();
    }
  }, [refresh]);

  const continueAsGuest = useCallback(() => {
    getGuestKey();
  }, []);

  const value = useMemo<AppState>(
    () => ({
      user,
      loading,
      refresh,
      signOut,
      continueAsGuest,
      toast,
      reducedMotion,
      setReducedMotion,
    }),
    [
      user,
      loading,
      refresh,
      signOut,
      continueAsGuest,
      toast,
      reducedMotion,
      setReducedMotion,
    ],
  );

  const toneClass: Record<ToastMessage["tone"], string> = {
    success: "border-emerald-500/40 bg-emerald-950/90 text-emerald-100",
    error: "border-red-500/40 bg-red-950/90 text-red-100",
    info: "border-accent/50 bg-[#1b1f3a]/95 text-indigo-100",
  };

  return (
    <AppContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-0 bottom-24 z-[60] flex flex-col items-center gap-2 px-4 sm:bottom-6"
        aria-live="polite"
      >
        <AnimatePresence>
          {toasts.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 16, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.96 }}
              className={`pointer-events-auto max-w-md rounded-xl border px-4 py-3 text-sm font-medium shadow-xl ${toneClass[t.tone]}`}
            >
              {t.message}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </AppContext.Provider>
  );
}

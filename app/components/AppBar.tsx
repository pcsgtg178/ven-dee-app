"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Pill, RotateCw } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { subscribeToSyncState } from "../../lib/storage";

interface AppBarProps {
  /** Title shown in the center of the app bar */
  title?: string;

  hideTitle?: boolean;

  /** Whether to show the back button. Defaults to true on subpages and false on HomePage ("/") */
  showBack?: boolean;
  /** Custom destination for the back button. Defaults to HomePage ("/") */
  backHref?: string;
  /** Custom click handler for back button */
  onBack?: () => void;
  /** Optional element or buttons on the right side */
  rightAction?: React.ReactNode;
  /** Additional CSS classes for header container */
  className?: string;
  /** Force sync state or allow auto-detection via global sync subscription */
  isSyncing?: boolean;
}

export default function AppBar({
  title,
  hideTitle = false,
  showBack,
  backHref = "/",
  onBack,
  rightAction,
  className = "",
  isSyncing: propIsSyncing,
}: AppBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [globalIsSyncing, setGlobalIsSyncing] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSyncState((state) => {
      setGlobalIsSyncing(state.isSyncing);
    });
    return () => unsub();
  }, []);

  const isSyncing = propIsSyncing !== undefined ? propIsSyncing : globalIsSyncing;

  // If showBack is not explicitly provided, show back button when not on HomePage ("/")
  const isHome = pathname === "/";
  const shouldShowBack = showBack !== undefined ? showBack : !isHome;

  const handleBackClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (onBack) {
      e.preventDefault();
      onBack();
    } else if (backHref && backHref !== "/") {
      // Follow standard navigation to custom backHref
    } else if (typeof window !== "undefined" && window.history.length > 1) {
      e.preventDefault();
      router.back();
    }
  };

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-40 border-b border-surface-subtle bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 pt-safe ${className}`}
    >
      <div className="flex h-14 items-center justify-between px-3">
        {/* Left: Back Button */}
        <div className="flex min-w-11 shrink-0 items-center justify-start">
          {shouldShowBack && (
            <Link
              href={backHref}
              onClick={handleBackClick}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full text-text-muted transition-colors hover:bg-surface-subtle hover:text-text-main active:scale-95 touch-manipulation dark:text-zinc-300 dark:hover:bg-zinc-800"
              aria-label="ย้อนกลับ"
              title="ย้อนกลับ"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
          )}
        </div>

        {/* Center: Title */}
        {title && !hideTitle ? (
          <div className="flex-1 min-w-0 px-2 text-center flex items-center justify-center gap-1.5">
            <h1 className="truncate text-base font-semibold text-text-main dark:text-gray-100">
              {title}
            </h1>
            {isSyncing && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-sky-50 px-1.5 py-0.5 text-[9px] font-semibold text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200/60 dark:border-sky-800/60 animate-pulse">
                <RotateCw className="h-2 w-2 animate-spin text-sky-600 dark:text-sky-400" />
                <span>ซิงค์...</span>
              </span>
            )}
          </div>
        ) : (
          <div className="flex-1 pointer-events-none" />
        )}

        {/* Right: Actions + Pill icon link + ThemeToggle */}
        <div className="relative z-50 flex min-w-11 shrink-0 items-center justify-end gap-1">
          <Link
            href="/medications"
            className="flex h-8 w-8 items-center justify-center rounded-full text-text-muted hover:bg-emerald-50 hover:text-emerald-600 dark:hover:bg-zinc-800 dark:hover:text-emerald-300 transition-colors"
            title="จัดการรายการยา"
          >
            <Pill className="h-4 w-4" />
          </Link>
          <ThemeToggle size="sm" />
          {rightAction ?? null}
        </div>
      </div>

      {/* Animated bottom loading beam */}
      {isSyncing && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden bg-sky-100/40 dark:bg-sky-950/40">
          <div className="h-full w-full bg-gradient-to-r from-transparent via-sky-500 to-emerald-400 animate-sync-beam" />
        </div>
      )}
    </header>
  );
}

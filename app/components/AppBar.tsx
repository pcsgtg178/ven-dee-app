"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { subscribeToSyncState } from "../../lib/storage";

interface AppBarProps {
  /** Title shown in the center of the app bar */
  title?: string;

  hideTitle?: boolean;

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
  rightAction,
  className = "",
  isSyncing: propIsSyncing,
}: AppBarProps) {
  const [globalIsSyncing, setGlobalIsSyncing] = useState(false);

  useEffect(() => {
    const unsub = subscribeToSyncState((state) => {
      setGlobalIsSyncing(state.isSyncing);
    });
    return () => unsub();
  }, []);

  const isSyncing = propIsSyncing !== undefined ? propIsSyncing : globalIsSyncing;

  return (
    <header
      className={`sticky top-0 left-0 right-0 z-40 border-b border-surface-subtle bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/90 pt-safe ${className}`}
    >
      <div className="flex h-14 items-center justify-between px-3">
        {/* Left: Spacer to keep center title balanced if rightAction exists */}
        <div className="flex min-w-11 shrink-0 items-center justify-start" />

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

        {/* Right: Actions */}
        <div className="relative z-50 flex min-w-11 shrink-0 items-center justify-end gap-1">
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

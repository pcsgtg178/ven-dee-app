"use client";

import { useEffect, useState } from "react";
import { RotateCw } from "lucide-react";
import { subscribeToSyncState } from "../../lib/storage";

interface AppBarProps {
  /** Title shown in the center of the app bar */
  title?: string;

  hideTitle?: boolean;

  /** Optional element or buttons on the left side (e.g. Back button) */
  leftAction?: React.ReactNode;
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
  leftAction,
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
      className={`sticky top-0 left-0 right-0 z-40 border-b border-ds-border bg-ds-surface/90 backdrop-blur-md pt-safe ${className}`}
    >
      <div className="flex h-14 items-center justify-between px-3">
        {/* Left: Action or spacer */}
        <div className="relative z-50 flex min-w-11 shrink-0 items-center justify-start">
          {leftAction ?? null}
        </div>

        {/* Center: Title */}
        {title && !hideTitle ? (
          <div className="flex-1 min-w-0 px-2 text-center flex items-center justify-center gap-1.5">
            <h1 className="truncate text-base font-semibold text-ds-text">
              {title}
            </h1>
            {isSyncing && (
              <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-ds-primary-container px-1.5 py-0.5 text-[9px] font-semibold text-ds-primary border border-ds-primary/30 animate-pulse">
                <RotateCw className="h-2 w-2 animate-spin text-ds-primary" />
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
        <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden bg-ds-surface-variant">
          <div className="h-full w-full bg-ds-primary animate-sync-beam" />
        </div>
      )}
    </header>
  );
}

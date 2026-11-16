"use client";

import React, { useEffect, useState } from "react";
import { subscribeToSyncState } from "../../lib/storage";

/**
 * Global Top Sync Loading Bar
 * Automatically detects whenever any API sync is running (shifts, customers, services, medications)
 * and displays a sleek animated gradient loading beam along the top edge of the viewport.
 */
export default function SyncLoadingBar() {
  const [isSyncing, setIsSyncing] = useState(false);
  const [justCompleted, setJustCompleted] = useState(false);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    const unsubscribe = subscribeToSyncState((state) => {
      if (state.isSyncing) {
        setIsSyncing(true);
        setJustCompleted(false);
      } else {
        setIsSyncing(false);
        // Show brief completion highlight before fading
        setJustCompleted(true);
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setJustCompleted(false);
        }, 600);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(timeoutId);
    };
  }, []);

  if (!isSyncing && !justCompleted) {
    return null;
  }

  return (
    <div
      role="progressbar"
      aria-label="กำลังซิงค์ข้อมูลกับระบบ"
      className="fixed top-0 left-0 right-0 z-[9999] pointer-events-none h-1 overflow-hidden"
    >
      {isSyncing ? (
        <div className="relative h-full w-full bg-ds-surface-variant/60">
          <div className="absolute inset-y-0 w-full bg-ds-primary animate-sync-beam" />
        </div>
      ) : (
        <div className="h-full w-full bg-ds-success opacity-90 transition-opacity duration-500" />
      )}
    </div>
  );
}

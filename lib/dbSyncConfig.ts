/**
 * Configuration and helpers for controlling database synchronization with Supabase.
 * In development mode ('npm run dev') or when NEXT_PUBLIC_DISABLE_DB_SYNC is true,
 * database synchronization and server mutation actions are skipped to prevent
 * polluting the remote database with test data.
 */

export const SYNC_CONFIG_EVENT = "vendee_sync_config_changed";

export function isDbSyncDisabled(): boolean {
  // 1. Check client-side user override from localStorage if available
  if (typeof window !== "undefined") {
    try {
      const override = localStorage.getItem("vendee_disable_db_sync");
      if (override === "true") return true;
      if (override === "false") return false;
    } catch {
      // ignore storage access errors
    }
  }

  // 2. Check environment variable NEXT_PUBLIC_DISABLE_DB_SYNC
  if (process.env.NEXT_PUBLIC_DISABLE_DB_SYNC === "false") return false;
  if (process.env.NEXT_PUBLIC_DISABLE_DB_SYNC === "true") return true;

  // 3. Default to true in development mode ('npm run dev') so test runs never touch the remote DB
  return process.env.NODE_ENV === "development";
}

export function setDbSyncDisabledOverride(disabled: boolean | null): void {
  if (typeof window === "undefined") return;
  try {
    if (disabled === null) {
      localStorage.removeItem("vendee_disable_db_sync");
    } else {
      localStorage.setItem("vendee_disable_db_sync", disabled ? "true" : "false");
    }
    window.dispatchEvent(new Event(SYNC_CONFIG_EVENT));
  } catch {
    // ignore storage access errors
  }
}

/**
 * Date and timezone utilities for VenDee
 * Enforces Asia/Bangkok (UTC+7) timezone across client and server.
 * (DOMAIN_RULES.md §4.2, PROJECT_RULES.md §1, BACKLOG_ISSUE.md §9.4)
 */

export function getTodayDateStringBangkok(): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date()); // Formats as YYYY-MM-DD
  } catch {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const bkk = new Date(utc + 7 * 3600000);
    const y = bkk.getFullYear();
    const m = String(bkk.getMonth() + 1).padStart(2, "0");
    const d = String(bkk.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
}

/**
 * Checks whether a given YYYY-MM-DD date is strictly in the past relative to Asia/Bangkok current date.
 */
export function isDateInPast(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    const todayStr = getTodayDateStringBangkok();
    return dateStr < todayStr;
  } catch {
    return false;
  }
}

/**
 * Same as isDateInPast, used for shifts.
 */
export function isShiftInPast(dateStr: string): boolean {
  return isDateInPast(dateStr);
}

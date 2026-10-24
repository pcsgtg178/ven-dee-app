import type {
  ActivityItem,
  ClinicWorkRecord,
  CustomerServiceRecord,
  PersonalEventRecord,
  ShiftRecord,
  ShiftType,
} from "../types/vendee.ts";

/**
 * Event Ordering (DOMAIN_RULES.md §3.5)
 * - Sort by start time ascending within the same day.
 * - All-day / untimed items come first.
 * - `createdAt` is ONLY a tie-breaker.
 */

/** Start-of-shift minute offsets (used for sorting only) */
const SHIFT_START_MINUTES: Record<ShiftType, number | null> = {
  night: 0,
  r1: null, // Refer standby = all-day
  r2: null,
  off: null,
  ctm: 7 * 60 + 30,
  morning: 8 * 60,
  cta: 12 * 60,
  afternoon: 16 * 60,
};

function parseHHmm(value?: string): number | null {
  if (!value) return null;
  const m = /^(\d{1,2}):(\d{2})/.exec(value.trim());
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

/**
 * Returns start minute-of-day, or `null` for all-day / untimed items.
 */
export function getEventStartMinutes(item: ActivityItem): number | null {
  switch (item.type) {
    case "service":
      return parseHHmm((item as CustomerServiceRecord).time);
    case "clinic":
      return parseHHmm(((item as ClinicWorkRecord).presetShift || "").split(" - ")[0]);
    case "personal_event": {
      const ev = item as PersonalEventRecord;
      if (ev.isAllDay) return null;
      return parseHHmm(ev.startTime);
    }
    case "shift":
      return SHIFT_START_MINUTES[(item as ShiftRecord).shiftType] ?? null;
    default:
      return null;
  }
}

/** Single comparator for events on the same day (and across days). */
export function compareEventsByStartTime(a: ActivityItem, b: ActivityItem): number {
  const dateA = a.type === "personal_event" ? (a as PersonalEventRecord).eventDate || a.date : a.date;
  const dateB = b.type === "personal_event" ? (b as PersonalEventRecord).eventDate || b.date : b.date;
  const dateCmp = (dateA || "").localeCompare(dateB || "");
  if (dateCmp !== 0) return dateCmp;

  const ta = getEventStartMinutes(a);
  const tb = getEventStartMinutes(b);
  // all-day first
  if (ta === null && tb !== null) return -1;
  if (ta !== null && tb === null) return 1;
  if (ta !== null && tb !== null && ta !== tb) return ta - tb;

  // tie-breaker only
  return (a.createdAt || "").localeCompare(b.createdAt || "");
}

/** Returns a new array sorted ascending by date then start time. */
export function sortEventsByStartTime<T extends ActivityItem>(items: T[]): T[] {
  return [...items].sort(compareEventsByStartTime);
}

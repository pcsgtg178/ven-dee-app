/**
 * Date and timezone utilities for VenDee
 * Enforces Asia/Bangkok (UTC+7) timezone across client and server.
 * (DOMAIN_RULES.md §4.2, PROJECT_RULES.md §1, BACKLOG_ISSUE.md §9.4)
 */

/**
 * Date and timezone utilities for VenDee
 * Enforces Asia/Bangkok (UTC+7) timezone across client and server.
 * (DOMAIN_RULES.md §4.2, PROJECT_RULES.md §1, BACKLOG_ISSUE.md §9.4, BACKLOG.md Phase 12)
 */

export function getBangkokDateParts(d: Date = new Date()): {
  year: number;
  month: number;
  day: number;
  dateStr: string;
} {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const dateStr = formatter.format(d); // Formats as YYYY-MM-DD
    const [year, month, day] = dateStr.split("-").map(Number);
    return { year, month, day, dateStr };
  } catch {
    const utc = d.getTime() + d.getTimezoneOffset() * 60000;
    const bkk = new Date(utc + 7 * 3600000);
    const year = bkk.getFullYear();
    const month = bkk.getMonth() + 1;
    const day = bkk.getDate();
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return { year, month, day, dateStr };
  }
}

export function getTodayDateStringBangkok(): string {
  return getBangkokDateParts().dateStr;
}

/**
 * Checks whether a given YYYY-MM-DD date is strictly in the past relative to Asia/Bangkok current date.
 */
export function isDateInPast(dateStr: string, today?: Date): boolean {
  if (!dateStr) return false;
  try {
    const todayStr = getBangkokDateParts(today).dateStr;
    return dateStr < todayStr;
  } catch {
    return false;
  }
}

/**
 * Same as isDateInPast, used for shifts.
 */
export function isShiftInPast(dateStr: string, today?: Date): boolean {
  return isDateInPast(dateStr, today);
}

/**
 * Check if a shift is a Refer shift (r1, r2, or category green)
 * (DOMAIN_RULES.md §1 & §2.4)
 */
export function isReferShift(
  shift: { shiftType?: string; category?: string } | null | undefined
): boolean {
  if (!shift) return false;
  return (
    shift.shiftType === "r1" ||
    shift.shiftType === "r2" ||
    shift.category === "green"
  );
}

/**
 * Grace Period Calculation (BACKLOG.md Phase 12 & Phase 16)
 * - Rule 1 (Current Month): Date in same month as current date (YYYY-MM) -> Allowed
 * - Rule 2 (Previous Month Grace Window): If today is day 1-7, allow previous month (YYYY-MM) -> Allowed
 * - Rule 3 (Expired Months): Outside grace period
 */
export function isDateWithinGracePeriod(dateStr: string, today?: Date): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split("-");
  if (parts.length < 3) return false;
  const shiftYear = Number(parts[0]);
  const shiftMonth = Number(parts[1]);
  if (isNaN(shiftYear) || isNaN(shiftMonth)) return false;

  const { year: currentYear, month: currentMonth, day: currentDay } = getBangkokDateParts(today);

  // Rule 1 (Current Month): Date is in the same month as current date (YYYY-MM)
  if (shiftYear === currentYear && shiftMonth === currentMonth) {
    return true;
  }

  // Rule 2 (Previous Month Grace Window): If today is day 1-7 of the month, allow previous month (YYYY-MM)
  if (currentDay >= 1 && currentDay <= 7) {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    if (shiftYear === prevYear && shiftMonth === prevMonth) {
      return true;
    }
  }

  // Rule 3 (Expired Months): Outside grace period
  return false;
}

/**
 * Backward-compatible alias for Refer shifts (Phase 12)
 */
export const isReferShiftWithinGracePeriod = isDateWithinGracePeriod;

/**
 * Get the earliest selectable date (YYYY-MM-01) permitted under Grace Period rules.
 * Used for setting min on date pickers.
 */
export function getEarliestGracePeriodDate(today?: Date): string {
  const { year: currentYear, month: currentMonth, day: currentDay } = getBangkokDateParts(today);
  if (currentDay >= 1 && currentDay <= 7) {
    const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
    const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
    return `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
  }
  return `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
}

/**
 * Check if a shift is eligible to be swapped (Phase 16).
 * Any shift (normal or refer) within the Grace Period is eligible to be swapped.
 */
export function isShiftSwapEligible(
  shift: {
    date: string;
    isLocked?: boolean;
    swapMeta?: { isLocked?: boolean };
  } | null | undefined,
  today?: Date
): boolean {
  if (!shift) return false;
  if (shift.isLocked || shift.swapMeta?.isLocked) {
    return false;
  }
  if (!isShiftInPast(shift.date)) {
    return true;
  }
  return isDateWithinGracePeriod(shift.date, today);
}

/**
 * Check if a swap on this shift is eligible to be undone/restored (Phase 16).
 */
export function isShiftUndoSwapEligible(
  shift: {
    date: string;
    isLocked?: boolean;
    swapMeta?: { isLocked?: boolean };
  } | null | undefined,
  today?: Date
): boolean {
  return isShiftSwapEligible(shift, today);
}

/**
 * Unified check whether a shift is locked from editing, transferring, or deleting.
 * Refer shifts within grace period are exempt from historical date locking.
 */
export function isShiftLocked(
  shift: {
    date: string;
    shiftType?: string;
    category?: string;
    isLocked?: boolean;
    swapMeta?: { isLocked?: boolean };
  } | null | undefined,
  today?: Date
): boolean {
  if (!shift) return false;

  // Refer shift within grace period is unlocked for retroactive operations (editing, transferring)
  if (isReferShift(shift) && isReferShiftWithinGracePeriod(shift.date, today)) {
    return false;
  }

  // Non-refer shifts or refer shifts outside grace period:
  if (shift.isLocked || shift.swapMeta?.isLocked) {
    return true;
  }
  if (isShiftInPast(shift.date, today)) {
    return true;
  }
  return false;
}

/**
 * Customer Service Retroactive Grace Period (Phase 17 / DOMAIN_RULES.md §3.6)
 * Separate from Hospital Shift 1-7 day cutoff:
 * - Current Calendar Month (YYYY-MM) -> Allowed
 * - Full Previous Calendar Month (YYYY-MM) regardless of day-of-month -> Allowed
 * - Older months -> Expired
 */
export function isServiceDateWithinGracePeriod(dateStr: string, today?: Date): boolean {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [yearStr, monthStr, dayStr] = dateStr.split("-");
  const serviceYear = Number(yearStr);
  const serviceMonth = Number(monthStr);
  const serviceDay = Number(dayStr);
  if (
    isNaN(serviceYear) ||
    isNaN(serviceMonth) ||
    isNaN(serviceDay) ||
    serviceMonth < 1 ||
    serviceMonth > 12 ||
    serviceDay < 1 ||
    serviceDay > 31
  ) {
    return false;
  }

  const { year: currentYear, month: currentMonth } = getBangkokDateParts(today);

  // Current calendar month
  if (serviceYear === currentYear && serviceMonth === currentMonth) {
    return true;
  }

  // Full previous calendar month (handles Jan -> Dec year boundary)
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  if (serviceYear === prevYear && serviceMonth === prevMonth) {
    return true;
  }

  return false;
}

/**
 * Earliest selectable date (YYYY-MM-01) permitted when editing Customer Services
 * under the 1-calendar-month retroactive grace period.
 */
export function getEarliestServiceGracePeriodDate(today?: Date): string {
  const { year: currentYear, month: currentMonth } = getBangkokDateParts(today);
  const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
  const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;
  return `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
}

/**
 * Check whether a Customer Service record can be edited:
 * - Cancelled records remain locked.
 * - Today/future records are editable.
 * - Past records (both 'upcoming' and 'completed') are editable within the 1-month calendar grace period.
 */
export function isServiceEditable(
  service: { date?: string; status?: string } | null | undefined,
  today?: Date
): boolean {
  if (!service || !service.date) return false;
  if (service.status === "cancelled") return false;
  if (!isDateInPast(service.date, today)) return true;
  return isServiceDateWithinGracePeriod(service.date, today);
}

/**
 * Check whether a Customer Service record can be deleted:
 * - Today/future records are deletable.
 * - Past records are deletable within the 1-month calendar grace period.
 */
export function isServiceDeletable(
  service: { date?: string; status?: string } | null | undefined,
  today?: Date
): boolean {
  if (!service || !service.date) return false;
  if (!isDateInPast(service.date, today)) return true;
  return isServiceDateWithinGracePeriod(service.date, today);
}

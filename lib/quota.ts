import type { ShiftRecord } from "../types/vendee";

/**
 * Monthly Black Count Invariant (DOMAIN_RULES.md §1)
 * Single source of truth for black/red shift counts in a calendar month.
 *
 * Counts only shifts where:
 *  - status === "active"  (excludes swapped_out / sold_out / cancelled)
 *  - date within [monthStart, nextMonthStart)  i.e. date starts with "YYYY-MM"
 *  - category === "black" (red counted separately; other colors never counted)
 * Duplicate ids are counted once. Received swaps (black + active) are included.
 */
export function countMonthlyShifts(
  shifts: ShiftRecord[],
  yearMonth: string
): { blackCount: number; redCount: number } {
  const seen = new Set<string>();
  let blackCount = 0;
  let redCount = 0;

  for (const s of shifts) {
    if (!s || s.status !== "active") continue;
    if (typeof s.date !== "string" || s.date.slice(0, 7) !== yearMonth) continue;
    if (s.id) {
      if (seen.has(s.id)) continue;
      seen.add(s.id);
    }
    if (s.category === "black") blackCount++;
    else if (s.category === "red") redCount++;
  }

  return { blackCount, redCount };
}

/**
 * Monthly Black Shift Quota Calculation (DOMAIN_RULES.md §1)
 *
 * Rule:
 * 1. คำนวณชั่วโมงเวร จาก ชม.เวรดำ = จำนวนวันทำการ(จ-ศ)ในเดือนนั้น x 8 ชั่วโมง
 *    เช่น เดือนนี้มี จ-ศ 22 วัน x 8 = 176 ชม.
 * 2. แปลงชั่วโมงเวรเป็น "จำนวนเวร" = ชม.เวรดำ / ระบบเวร 8 ชั่วโมง
 *    เช่น ชม.เวรดำ = 176 จะได้ 176 / 8 = 22 เวร
 */
export interface MonthlyQuotaCalculation {
  yearMonth: string;
  weekdaysCount: number; // จำนวนวันทำการ (จันทร์-ศุกร์) ในเดือนนั้น
  standardDailyHours: number; // 8 ชม.
  blackShiftHours: number; // ชม.เวรดำ = จำนวนวันทำการ(จ-ศ) x 8
  shiftSystemHours: number; // ระบบเวร (ค่าเริ่มต้น 8 ชม.)
  quotaShifts: number; // จำนวนเวร = ชม.เวรดำ / ระบบเวร 8 ชม.
}

/**
 * Count the number of weekdays (จันทร์-ศุกร์, Mon-Fri) in a given month using timezone-safe UTC.
 * @param yearMonth Format: "YYYY-MM" (e.g. "2026-10")
 */
export function countWeekdaysInMonth(yearMonth: string): number {
  if (!yearMonth || typeof yearMonth !== "string" || !/^\d{4}-\d{2}$/.test(yearMonth)) {
    return 22; // Default fallback (standard 22 weekdays)
  }

  const [yearStr, monthStr] = yearMonth.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10); // 1-12

  if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
    return 22;
  }

  // Days in month: day 0 of month (1-indexed) in Date.UTC gives last day of previous month
  const totalDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
  let weekdaysCount = 0;

  for (let day = 1; day <= totalDays; day++) {
    // Note: month in Date.UTC is 0-indexed (month - 1)
    const dayOfWeek = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
    // 0 = Sunday, 1 = Monday, ..., 5 = Friday, 6 = Saturday
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      weekdaysCount++;
    }
  }

  return weekdaysCount;
}

/**
 * Calculate the monthly black shift quota in hours and shifts per DOMAIN_RULES.md §1.
 *
 * 1. คำนวณชั่วโมงเวร: ชม.เวรดำ = จำนวนวันทำการ(จ-ศ)ในเดือนนั้น x 8 ชั่วโมง
 * 2. แปลงชั่วโมงเวรเป็น "จำนวนเวร": จำนวนเวร = ชม.เวรดำ / ระบบเวร 8 ชั่วโมง
 */
export function calculateMonthlyBlackShiftQuota(
  yearMonth: string,
  shiftSystemHours: number = 8
): MonthlyQuotaCalculation {
  const weekdaysCount = countWeekdaysInMonth(yearMonth);
  const standardDailyHours = 8;
  const blackShiftHours = weekdaysCount * standardDailyHours;
  const safeShiftSystemHours = shiftSystemHours > 0 ? shiftSystemHours : 8;
  const quotaShifts = Math.round(blackShiftHours / safeShiftSystemHours);

  return {
    yearMonth,
    weekdaysCount,
    standardDailyHours,
    blackShiftHours,
    shiftSystemHours: safeShiftSystemHours,
    quotaShifts,
  };
}


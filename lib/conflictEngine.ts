/**
 * VenDee Domain Conflict Engine & Financial Ledger Standard
 * Adheres strictly to DOMAIN_RULES.md invariants
 */

import { ShiftRecord, CustomerServiceRecord, PersonalEventRecord, ShiftType } from "../types/vendee";

export interface ConflictCheckResult {
  hasConflict: boolean;
  code?: string;
  message?: string;
  isWarningOnly?: boolean;
}

/**
 * Check 1: Forbidden Combination: Night + Morning Same Day (FORBIDDEN_NIGHT_MORNING_SAME_DAY)
 * Rule: A nurse cannot hold both 'night' (00:00-08:00) and 'morning' (08:00-16:00) on the same date.
 */
export function checkNightMorningForbidden(
  targetDate: string,
  newShiftType: ShiftType,
  existingShifts: ShiftRecord[]
): ConflictCheckResult {
  if (newShiftType !== "night" && newShiftType !== "morning") {
    return { hasConflict: false };
  }

  const activeShiftsOnDate = existingShifts.filter(
    (s) => s.date === targetDate && s.status === "active"
  );

  const hasNight = activeShiftsOnDate.some((s) => s.shiftType === "night") || newShiftType === "night";
  const hasMorning = activeShiftsOnDate.some((s) => s.shiftType === "morning") || newShiftType === "morning";

  if (hasNight && hasMorning) {
    return {
      hasConflict: true,
      code: "INVALID_SHIFT_COMBINATION",
      message: "ห้ามขึ้นเวรดึก (00:00 - 08:00) และเวรเช้า (08:00 - 16:00) ในวันเดียวกัน เนื่องจากไม่มีช่วงเวลาพักผ่อน",
    };
  }

  return { hasConflict: false };
}

/**
 * Time Helpers: Convert HH:mm to minutes from midnight
 */
export function timeToMinutes(timeStr: string): number {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
}

/**
 * Get half-open interval [startMin, endMin) for shift types
 */
export function getShiftTimeRangeMinutes(shiftType: ShiftType): { start: number; end: number } | null {
  switch (shiftType) {
    case "night":
      return { start: 0, end: 480 }; // 00:00 - 08:00
    case "morning":
      return { start: 480, end: 960 }; // 08:00 - 16:00
    case "afternoon":
      return { start: 960, end: 1440 }; // 16:00 - 24:00
    case "ctm":
      return { start: 480, end: 720 }; // 08:00 - 12:00
    case "cta":
      return { start: 720, end: 960 }; // 12:00 - 16:00
    case "r1":
    case "r2":
    case "off":
      return null; // Refer shifts do NOT block private services
    default:
      return null;
  }
}

/**
 * Check 2: Hospital Shift vs Customer Service Overlap Check
 */
export function checkServiceShiftOverlap(
  serviceDate: string,
  serviceTime: string,
  existingShifts: ShiftRecord[]
): ConflictCheckResult {
  const activeShifts = existingShifts.filter(
    (s) => s.date === serviceDate && s.status === "active"
  );

  const serviceMinutes = timeToMinutes(serviceTime);

  for (const shift of activeShifts) {
    const range = getShiftTimeRangeMinutes(shift.shiftType);
    if (!range) continue; // Exempt Refer / Off

    if (serviceMinutes >= range.start && serviceMinutes < range.end) {
      return {
        hasConflict: true,
        code: "CONFLICT_WITH_SHIFT",
        message: `บริการเคหะบริบาลซ้อนทับกับช่วงเวลาปฏิบัติงาน (${shift.shiftType})`,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Check 3: Personal Event Overlap Warning (PERSONAL_EVENT_OVERLAP_WARNING)
 */
export function checkPersonalEventOverlap(
  eventDate: string,
  startTime: string,
  endTime: string,
  existingShifts: ShiftRecord[],
  existingServices: CustomerServiceRecord[]
): ConflictCheckResult {
  const eventStart = timeToMinutes(startTime);
  const eventEnd = timeToMinutes(endTime);

  // Check shift overlap
  const activeShifts = existingShifts.filter((s) => s.date === eventDate && s.status === "active");
  for (const shift of activeShifts) {
    const range = getShiftTimeRangeMinutes(shift.shiftType);
    if (!range) continue;

    if (Math.max(eventStart, range.start) < Math.min(eventEnd, range.end)) {
      return {
        hasConflict: true,
        isWarningOnly: true,
        code: "PERSONAL_EVENT_OVERLAP_WARNING",
        message: `มีธุระส่วนตัวซ้อนทับกับช่วงเวลาขึ้นเวร (${shift.shiftType})`,
      };
    }
  }

  // Check service overlap
  const activeServices = existingServices.filter((s) => s.date === eventDate && s.status !== "cancelled");
  for (const service of activeServices) {
    const sMin = timeToMinutes(service.time);
    // Assume service duration ~1 hour for overlap check if not specified
    const sEnd = sMin + 60;
    if (Math.max(eventStart, sMin) < Math.min(eventEnd, sEnd)) {
      return {
        hasConflict: true,
        isWarningOnly: true,
        code: "PERSONAL_EVENT_OVERLAP_WARNING",
        message: `มีธุระส่วนตัวซ้อนทับกับนัดหมายบริการเคหะบริบาล (${service.customerName})`,
      };
    }
  }

  return { hasConflict: false };
}

/**
 * Financial Ledger Utilities (Satang Standard: 1 THB = 100 Satang)
 */
export function calculateNetProfitSatang(
  serviceFeeSatang: number,
  medicationCostSatang: number,
  travelExpenseSatang = 0,
  otherExpensesSatang = 0
): number {
  const totalExpenses = medicationCostSatang + travelExpenseSatang + otherExpensesSatang;
  return serviceFeeSatang - totalExpenses;
}

export function calculateEffectiveHourlyRateSatang(
  netProfitSatang: number,
  durationHours?: number
): number | null {
  if (!durationHours || durationHours <= 0) return null;
  return Math.round(netProfitSatang / durationHours);
}

export function satangToThb(satang: number): number {
  return satang / 100;
}

export function thbToSatang(thb: number): number {
  return Math.round(thb * 100);
}

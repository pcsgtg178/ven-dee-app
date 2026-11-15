/**
 * VenDee Domain Conflict Engine & Financial Ledger Standard
 * Adheres strictly to DOMAIN_RULES.md invariants
 */

import type { ShiftRecord, CustomerServiceRecord, PersonalEventRecord, ShiftType } from "../types/vendee.ts";

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
export interface ServicePricingBreakdownSatang {
  grossFeeSatang: number;
  discountSatang: number;
  netRevenueSatang: number;
}

export interface ServicePricingBreakdown {
  grossFee: number;
  discount: number;
  netRevenue: number;
  hasDiscount: boolean;
}

export function calculateNetRevenueSatang(
  serviceFeeSatang: number,
  discountSatang = 0
): number {
  const fee = Number.isFinite(serviceFeeSatang) ? Math.max(0, Math.round(serviceFeeSatang)) : 0;
  const discount = Number.isFinite(discountSatang) ? Math.max(0, Math.round(discountSatang)) : 0;
  return Math.max(0, fee - discount);
}

export function getServicePricingBreakdownSatang(
  service: Pick<CustomerServiceRecord, "price" | "serviceFeeSatang" | "discount" | "discountSatang">
): ServicePricingBreakdownSatang {
  const grossFeeSatang =
    typeof service.serviceFeeSatang === "number" &&
    Number.isFinite(service.serviceFeeSatang) &&
    (service.serviceFeeSatang > 0 || service.price === undefined || service.price === null || service.price === 0)
      ? Math.max(0, Math.round(service.serviceFeeSatang))
      : thbToSatang(Math.max(0, Number(service.price) || 0));

  const discountSatang =
    typeof service.discountSatang === "number" &&
    Number.isFinite(service.discountSatang) &&
    (service.discountSatang > 0 || service.discount === undefined || service.discount === null || service.discount === 0)
      ? Math.max(0, Math.round(service.discountSatang))
      : thbToSatang(Math.max(0, Number(service.discount) || 0));

  return {
    grossFeeSatang,
    discountSatang,
    netRevenueSatang: calculateNetRevenueSatang(grossFeeSatang, discountSatang),
  };
}

export function getServicePricingBreakdown(
  service: Pick<CustomerServiceRecord, "price" | "serviceFeeSatang" | "discount" | "discountSatang">
): ServicePricingBreakdown {
  const satang = getServicePricingBreakdownSatang(service);
  return {
    grossFee: satangToThb(satang.grossFeeSatang),
    discount: satangToThb(satang.discountSatang),
    netRevenue: satangToThb(satang.netRevenueSatang),
    hasDiscount: satang.discountSatang > 0,
  };
}

export function calculateNetProfitSatang(
  serviceFeeSatang: number,
  medicationCostSatang: number,
  travelExpenseSatang = 0,
  otherExpensesSatang = 0,
  discountSatang = 0
): number {
  const netRevenueSatang = calculateNetRevenueSatang(serviceFeeSatang, discountSatang);
  const totalExpenses =
    (Number.isFinite(medicationCostSatang) ? medicationCostSatang : 0) +
    (Number.isFinite(travelExpenseSatang) ? travelExpenseSatang : 0) +
    (Number.isFinite(otherExpensesSatang) ? otherExpensesSatang : 0);
  return netRevenueSatang - totalExpenses;
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

/**
 * Medication usage costing (DOMAIN_RULES.md §3.1 item 3, Phase 14)
 * For FIFO costing: unit cost is derived from stock layers or reference pack cost.
 * calculateUnitCostSatang supports optional refCostPerPackSatang fallback when price is not used.
 */
export function calculateUnitCostSatang(
  price?: string | number,
  size?: string | number,
  refCostPerPackSatang?: number
): number {
  const sizeNum = parseFloat(String(size ?? ""));
  const divisor = Number.isFinite(sizeNum) && sizeNum > 0 ? sizeNum : 1;

  if (typeof refCostPerPackSatang === "number" && Number.isFinite(refCostPerPackSatang) && refCostPerPackSatang > 0) {
    return Math.round(refCostPerPackSatang / divisor);
  }

  const priceThb = Number(price);
  if (!Number.isFinite(priceThb) || priceThb <= 0) return 0;
  return (priceThb * 100) / divisor;
}

export function calculateMedicationLineCostSatang(quantity: number, unitCostSatang: number): number {
  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitCostSatang)) return 0;
  return Math.round(quantity * unitCostSatang);
}

export function calculateMedicationCostSatang(
  usages: Array<{ quantity: number; unitCostSatang: number }>
): number {
  return usages.reduce((sum, u) => sum + calculateMedicationLineCostSatang(u.quantity, u.unitCostSatang), 0);
}

/**
 * Aggregates gig net profit and paid shift sales per DOMAIN_RULES.md Section 3.3
 */
export function calculateTotalNetIncomeSatang(
  serviceNetProfitSatang: number,
  paidShiftSalesSatang: number
): number {
  return serviceNetProfitSatang + paidShiftSalesSatang;
}


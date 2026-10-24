import type { ShiftRecord } from "../types/vendee";

function isShiftInPast(dateStr: string): boolean {
  if (!dateStr) return false;
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Bangkok",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    const todayBangkok = formatter.format(new Date());
    return dateStr < todayBangkok;
  } catch {
    const now = new Date();
    const utc = now.getTime() + now.getTimezoneOffset() * 60000;
    const bkk = new Date(utc + 7 * 3600000);
    const y = bkk.getFullYear();
    const m = String(bkk.getMonth() + 1).padStart(2, "0");
    const d = String(bkk.getDate()).padStart(2, "0");
    return dateStr < `${y}-${m}-${d}`;
  }
}

/**
 * Check if a shift is eligible for transfer (Phase 11: Refer or OT shifts)
 * Shift must be active, not locked, not in past, and either Refer or OT.
 */
export function isShiftTransferrable(shift: ShiftRecord): boolean {
  if (shift.status !== "active") return false;
  if (shift.swapMeta?.isLocked || isShiftInPast(shift.date)) return false;
  const isRefer =
    shift.shiftType === "r1" ||
    shift.shiftType === "r2" ||
    shift.category === "green";
  const isOT = shift.category === "red";
  return isRefer || isOT;
}

/**
 * Validate that a shift is transferrable according to DOMAIN_RULES.md §2.4
 * Throws domain error message if invalid.
 */
export function validateShiftTransferrable(shift: {
  status: string;
  isLocked?: boolean;
  date: string;
  shiftType: string;
  category: string;
}): void {
  if (shift.status === "transferred" || shift.status === "sold_out") {
    throw new Error("เวรนี้ถูกทำรายการยกให้คนอื่นไปแล้ว");
  }
  if (shift.status !== "active") {
    throw new Error("เวรนี้ไม่ได้อยู่ในสถานะพร้อมยกให้คนอื่น");
  }
  if (shift.isLocked || isShiftInPast(shift.date)) {
    throw new Error("ไม่สามารถยกเวรในอดีตที่ถูกล็อกแล้วได้");
  }
  const isRefer =
    shift.shiftType === "r1" ||
    shift.shiftType === "r2" ||
    shift.category === "green";
  const isOT = shift.category === "red";

  if (!isRefer && !isOT) {
    throw new Error("อนุญาตให้ยกได้เฉพาะเวร Refer (R1, R2) หรือเวร OT (เวรแดง) เท่านั้น");
  }
}

// Aliases for backwards compatibility with Phase 6 / legacy sell Shift code
export const isShiftSellable = isShiftTransferrable;
export const validateShiftSellable = validateShiftTransferrable;

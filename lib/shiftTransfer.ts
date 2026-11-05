import type { ShiftRecord } from "../types/vendee";
import {
  isShiftInPast,
  isReferShift,
  isReferShiftWithinGracePeriod,
} from "./dateUtils.ts";

/**
 * Check if a shift is eligible for transfer (Phase 11: Refer or OT shifts, Phase 12: Grace Period for Refer)
 * Shift must be active, not locked, not in past (or within Refer Grace Period), and either Refer or OT.
 */
export function isShiftTransferrable(shift: ShiftRecord): boolean {
  if (shift.status !== "active") return false;

  const isRefer = isReferShift(shift);
  const isOT = shift.category === "red";

  if (!isRefer && !isOT) return false;

  // Refer shift within grace period is exempt from past/locked checks
  if (isRefer && isReferShiftWithinGracePeriod(shift.date)) {
    return true;
  }

  if (shift.swapMeta?.isLocked || isShiftInPast(shift.date)) return false;
  return true;
}

/**
 * Validate that a shift is transferrable according to DOMAIN_RULES.md §2.4 & §2.5
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

  const isRefer = isReferShift({ shiftType: shift.shiftType, category: shift.category });
  const isOT = shift.category === "red";

  if (!isRefer && !isOT) {
    throw new Error("อนุญาตให้ยกได้เฉพาะเวร Refer (R1, R2) หรือเวร OT (เวรแดง) เท่านั้น");
  }

  if (shift.isLocked || isShiftInPast(shift.date)) {
    if (!(isRefer && isReferShiftWithinGracePeriod(shift.date))) {
      throw new Error("ไม่สามารถยกเวรในอดีตที่ถูกล็อกแล้วได้");
    }
  }
}

// Aliases for backwards compatibility with Phase 6 / legacy sell Shift code
export const isShiftSellable = isShiftTransferrable;
export const validateShiftSellable = validateShiftTransferrable;

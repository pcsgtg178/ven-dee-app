import type { ShiftRecord, ShiftSwapRecord } from "../types/vendee.ts";

/**
 * Automatically clean up corrupted swap state in shift records (BACKLOG.md §9.5, BACKLOG_ISSUE.md §Data repair)
 * 1. Remove cancelled child shifts (from old incomplete undo swaps)
 * 2. Purge known corrupted Beam shift on 2026-11-03 afternoon
 * 3. Restore parent shifts stuck in 'swapped_out' if no active child exists
 * 4. Clear swapMeta on active parent shifts if no active child exists
 */
export function repairLocalSwapInconsistencies(shifts: ShiftRecord[]): { shifts: ShiftRecord[]; modified: boolean } {
  let modified = false;

  // 1. Purge corrupt Beam 2026-11-03 child shift and orphan cancelled child shifts
  const filtered = shifts.filter((s) => {
    // Purge corrupted Beam swap child on 2026-11-03 afternoon
    if (
      s.date === "2026-11-03" &&
      s.shiftType === "afternoon" &&
      (s.swapMeta?.swappedWith === "บีม" || s.swapMeta?.originalOwner === "บีม" || s.swapMeta?.parentShiftId)
    ) {
      modified = true;
      return false;
    }
    // Purge cancelled children that were left behind
    if (s.status === "cancelled" && s.swapMeta?.parentShiftId) {
      modified = true;
      return false;
    }
    return true;
  });

  // Active child parent IDs
  const activeParentIds = new Set(
    filtered
      .filter((s) => s.status === "active" && (s.swap?.givenShiftId || s.swapMeta?.parentShiftId))
      .map((s) => s.swap?.givenShiftId || s.swapMeta!.parentShiftId!)
  );

  // 2. Restore orphan swapped_out parents to active
  const repaired = filtered.map((s) => {
    if (s.status === "swapped_out" && !activeParentIds.has(s.id)) {
      modified = true;
      return {
        ...s,
        status: "active" as const,
        swapId: undefined,
        swap: undefined,
        swapMeta: undefined,
      };
    }
    if (
      s.status === "active" &&
      (s.swapMeta || s.swap || s.swapId) &&
      !activeParentIds.has(s.id) &&
      !s.swapMeta?.parentShiftId &&
      (!s.swap || s.swap.receivedShiftId !== s.id)
    ) {
      // Lingering swap metadata on parent shift when no active child references it
      modified = true;
      return {
        ...s,
        swapId: undefined,
        swap: undefined,
        swapMeta: undefined,
      };
    }
    return s;
  });

  return { shifts: repaired, modified };
}

/**
 * Upgrade legacy shifts (v2) to v3 by reconstructing ShiftSwapRecord pairs
 */
export function upgradeShiftsToV3(shifts: ShiftRecord[]): ShiftRecord[] {
  const byId = new Map<string, ShiftRecord>();
  shifts.forEach((s) => byId.set(s.id, { ...s }));

  for (const shift of shifts) {
    if (shift.swapMeta?.parentShiftId) {
      const parent = byId.get(shift.swapMeta.parentShiftId);
      if (parent) {
        const swapId = parent.swapId || `swap-${parent.id}-${shift.id}`;
        const swapRec: ShiftSwapRecord = {
          id: swapId,
          givenShiftId: parent.id,
          receivedShiftId: shift.id,
          swappedWith: shift.swapMeta.swappedWith || parent.swapMeta?.swappedWith || "คู่แลกเวร",
          originalOwner: shift.swapMeta.originalOwner,
          swapDate: shift.swapMeta.swapDate || "2026-10-24",
          swapReason: shift.swapMeta.swapReason,
          swapHistory: shift.swapMeta.swapHistory || [],
          createdAt: shift.createdAt,
        };
        parent.swapId = swapId;
        parent.swap = swapRec;
        const currentChild = byId.get(shift.id)!;
        currentChild.swap = swapRec;
      }
    }
  }

  const upgraded = Array.from(byId.values());
  const { shifts: repaired } = repairLocalSwapInconsistencies(upgraded);
  return repaired;
}

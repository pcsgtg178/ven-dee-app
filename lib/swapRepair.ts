import type { ShiftRecord, ShiftSwapRecord } from "../types/vendee.ts";

/**
 * Helper to extract parent shift ID from a child shift
 */
function getParentShiftId(shift: ShiftRecord): string | undefined {
  return shift.swap?.givenShiftId || shift.swapMeta?.parentShiftId;
}

/**
 * Collect all parent shift IDs that are part of a valid swap chain (BACKLOG_ISSUE.md ISSUE-3).
 * - Follows ancestor chains up from terminal shifts (status: active, sold_out, transferred)
 * - Includes any parent directly referenced by an existing non-cancelled child (active, swapped_out, sold_out, transferred)
 */
export function getValidSwapParentIds(shifts: ShiftRecord[]): Set<string> {
  const byId = new Map<string, ShiftRecord>();
  shifts.forEach((s) => byId.set(s.id, s));

  const validParentIds = new Set<string>();

  // 1. Traverse up from living terminal shifts (active, sold_out, transferred)
  const terminals = shifts.filter(
    (s) => s.status === "active" || s.status === "sold_out" || s.status === "transferred"
  );

  for (const terminal of terminals) {
    let current: ShiftRecord | undefined = terminal;
    const visited = new Set<string>();

    while (current) {
      const parentId = getParentShiftId(current);
      if (!parentId || visited.has(parentId)) {
        break;
      }
      visited.add(parentId);
      validParentIds.add(parentId);
      current = byId.get(parentId);
    }
  }

  // 2. Also include any parent directly referenced by an existing non-cancelled child
  // (e.g. child is swapped_out in a cascading swap)
  for (const shift of shifts) {
    if (shift.status !== "cancelled") {
      const parentId = getParentShiftId(shift);
      if (parentId) {
        validParentIds.add(parentId);
      }
    }
  }

  return validParentIds;
}

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

  // Valid child parent IDs in swap chains (including cascading swaps, ISSUE-3 fix)
  const validParentIds = getValidSwapParentIds(filtered);

  // 2. Restore orphan swapped_out parents to active
  const repaired = filtered.map((s) => {
    if (s.status === "swapped_out" && !validParentIds.has(s.id)) {
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
      !validParentIds.has(s.id) &&
      !s.swapMeta?.parentShiftId &&
      (!s.swap || s.swap.receivedShiftId !== s.id)
    ) {
      // Lingering swap metadata on parent shift when no child references it
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

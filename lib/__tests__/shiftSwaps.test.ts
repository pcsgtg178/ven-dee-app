import test from "node:test";
import assert from "node:assert/strict";
import type { ShiftRecord, ShiftSwapRecord } from "../../types/vendee.ts";
import { upgradeShiftsToV3 } from "../swapRepair.ts";

/**
 * Pure helper for simulating local shift swap execution (matching lib/storage.ts & perform_shift_swap RPC)
 */
function simulateSwap(
  shifts: ShiftRecord[],
  params: {
    givenShiftId: string;
    newShiftId: string;
    swappedWith: string;
    originalOwner?: string;
    newDate: string;
    newShiftType: ShiftRecord["shiftType"];
    newCategory: ShiftRecord["category"];
    swapReason?: string;
  }
): { updatedShifts: ShiftRecord[]; swap: ShiftSwapRecord } {
  const givenShift = shifts.find((s) => s.id === params.givenShiftId);
  if (!givenShift) throw new Error("SHIFT_NOT_FOUND");
  if (givenShift.status === "swapped_out" || givenShift.status === "sold_out") {
    throw new Error("SHIFT_ALREADY_SWAPPED");
  }

  const swapId = `swap-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const swapRecord: ShiftSwapRecord = {
    id: swapId,
    givenShiftId: givenShift.id,
    receivedShiftId: params.newShiftId,
    swappedWith: params.swappedWith,
    originalOwner: params.originalOwner,
    swapDate: "2026-10-24",
    swapReason: params.swapReason,
    swapHistory: [
      {
        id: `trail-${Date.now()}`,
        fromPerson: params.swappedWith,
        toPerson: "ฉัน",
        date: params.newDate,
        shiftLabel: params.newShiftType,
        note: params.swapReason,
      },
    ],
  };

  const updatedGiven: ShiftRecord = {
    ...givenShift,
    status: "swapped_out",
    swapId: swapId,
    swap: swapRecord,
    swapMeta: {
      swappedWith: params.swappedWith,
      originalOwner: params.originalOwner,
      swapDate: "2026-10-24",
      swapReason: params.swapReason,
      swapHistory: swapRecord.swapHistory,
    },
  };

  const newReceived: ShiftRecord = {
    id: params.newShiftId,
    type: "shift",
    date: params.newDate,
    shiftType: params.newShiftType,
    category: params.newCategory,
    status: "active",
    swap: swapRecord,
    swapMeta: {
      swappedWith: params.swappedWith,
      originalOwner: params.originalOwner,
      parentShiftId: givenShift.id,
      swapDate: "2026-10-24",
      swapReason: params.swapReason,
      swapHistory: swapRecord.swapHistory,
    },
    createdAt: new Date().toISOString(),
  };

  const updatedShifts = shifts.map((s) => (s.id === givenShift.id ? updatedGiven : s));
  updatedShifts.unshift(newReceived);

  return { updatedShifts, swap: swapRecord };
}

/**
 * Pure helper for simulating local undo swap (matching lib/storage.ts & undo_shift_swap RPC)
 */
function simulateUndoSwap(shifts: ShiftRecord[], targetShiftId: string): ShiftRecord[] {
  const targetShift = shifts.find((s) => s.id === targetShiftId);
  if (!targetShift) throw new Error("SWAP_NOT_FOUND");

  let parentShift: ShiftRecord | undefined;
  let childShift: ShiftRecord | undefined;

  if (targetShift.swap?.receivedShiftId === targetShift.id || targetShift.swapMeta?.parentShiftId) {
    childShift = targetShift;
    const parentId = targetShift.swap?.givenShiftId || targetShift.swapMeta?.parentShiftId;
    parentShift = shifts.find((s) => s.id === parentId);
  } else if (targetShift.status === "swapped_out" || targetShift.swapId || targetShift.swap?.givenShiftId === targetShift.id) {
    parentShift = targetShift;
    const childId = targetShift.swap?.receivedShiftId;
    childShift = shifts.find((s) => (childId && s.id === childId) || s.swapMeta?.parentShiftId === targetShift.id);
  }

  if (!parentShift || !childShift) throw new Error("SWAP_NOT_FOUND");

  // Downstream Chain Swap Guard (BACKLOG_MIGRATE.md §8 & DOMAIN_RULES.md §2.3)
  const isDownstreamSwapped = shifts.some(
    (s) =>
      s.status === "swapped_out" &&
      (s.id === childShift!.id || s.swap?.givenShiftId === childShift!.id || s.swapMeta?.parentShiftId === childShift!.id)
  );
  if (isDownstreamSwapped) {
    throw new Error("DOWNSTREAM_SWAP_ACTIVE: ไม่สามารถยกเลิกการแลกเวรนี้ได้ เนื่องจากเวรที่ได้รับมาถูกนำไปแลกเปลี่ยนต่อแล้ว กรุณายกเลิกการแลกขั้นหลังก่อน");
  }

  // Restore parent shift to active and delete child shift
  return shifts
    .filter((s) => s.id !== childShift!.id)
    .map((s) =>
      s.id === parentShift!.id
        ? {
            ...s,
            status: "active" as const,
            swapId: undefined,
            swap: undefined,
            swapMeta: undefined,
          }
        : s
    );
}

// ============================================================================
// TESTS
// ============================================================================

test("Direct swap: assigns swapId to given shift, links swap to both shifts, sets given to swapped_out", () => {
  const initial: ShiftRecord[] = [
    {
      id: "shift-orig-1",
      type: "shift",
      date: "2026-11-10",
      shiftType: "morning",
      category: "black",
      status: "active",
      createdAt: "2026-10-01T00:00:00Z",
    },
  ];

  const { updatedShifts, swap } = simulateSwap(initial, {
    givenShiftId: "shift-orig-1",
    newShiftId: "shift-recv-1",
    swappedWith: "พยาบาลเอ",
    newDate: "2026-11-12",
    newShiftType: "afternoon",
    newCategory: "black",
    swapReason: "ติดธุระ",
  });

  assert.equal(updatedShifts.length, 2);

  const given = updatedShifts.find((s) => s.id === "shift-orig-1")!;
  assert.equal(given.status, "swapped_out");
  assert.equal(given.swapId, swap.id);
  assert.equal(given.swap?.swappedWith, "พยาบาลเอ");

  const received = updatedShifts.find((s) => s.id === "shift-recv-1")!;
  assert.equal(received.status, "active");
  assert.equal(received.swapId, undefined); // swap_id is only on given shift
  assert.equal(received.swap?.id, swap.id);
  assert.equal(received.swap?.receivedShiftId, "shift-recv-1");
});

test("Bidirectional undo: undoing from received shift side restores given shift to active and deletes received shift", () => {
  const initial: ShiftRecord[] = [
    {
      id: "shift-orig-1",
      type: "shift",
      date: "2026-11-10",
      shiftType: "morning",
      category: "black",
      status: "active",
      createdAt: "2026-10-01T00:00:00Z",
    },
  ];

  const { updatedShifts } = simulateSwap(initial, {
    givenShiftId: "shift-orig-1",
    newShiftId: "shift-recv-1",
    swappedWith: "พยาบาลเอ",
    newDate: "2026-11-12",
    newShiftType: "afternoon",
    newCategory: "black",
  });

  // Undo using received shift ID
  const undone = simulateUndoSwap(updatedShifts, "shift-recv-1");
  assert.equal(undone.length, 1);
  assert.equal(undone[0].id, "shift-orig-1");
  assert.equal(undone[0].status, "active");
  assert.equal(undone[0].swapId, undefined);
  assert.equal(undone[0].swap, undefined);
  assert.equal(undone[0].swapMeta, undefined);
});

test("Bidirectional undo: undoing from given shift side restores given shift to active and deletes received shift", () => {
  const initial: ShiftRecord[] = [
    {
      id: "shift-orig-2",
      type: "shift",
      date: "2026-11-15",
      shiftType: "night",
      category: "black",
      status: "active",
      createdAt: "2026-10-01T00:00:00Z",
    },
  ];

  const { updatedShifts } = simulateSwap(initial, {
    givenShiftId: "shift-orig-2",
    newShiftId: "shift-recv-2",
    swappedWith: "พยาบาลบี",
    newDate: "2026-11-18",
    newShiftType: "morning",
    newCategory: "black",
  });

  // Undo using given shift ID
  const undone = simulateUndoSwap(updatedShifts, "shift-orig-2");
  assert.equal(undone.length, 1);
  assert.equal(undone[0].id, "shift-orig-2");
  assert.equal(undone[0].status, "active");
  assert.equal(undone[0].swapId, undefined);
});

test("Chain swap & safety guard: received shift can be swapped out in Swap 2; undoing Swap 1 is blocked while Swap 2 exists", () => {
  // Step 1: User has Shift 1
  const initial: ShiftRecord[] = [
    {
      id: "shift-1",
      type: "shift",
      date: "2026-11-01",
      shiftType: "morning",
      category: "black",
      status: "active",
      createdAt: "2026-10-01T00:00:00Z",
    },
  ];

  // Step 2: Swap 1 -> Gives Shift 1, receives Shift 2
  const afterSwap1 = simulateSwap(initial, {
    givenShiftId: "shift-1",
    newShiftId: "shift-2",
    swappedWith: "พยาบาลหนึ่ง",
    newDate: "2026-11-05",
    newShiftType: "afternoon",
    newCategory: "black",
  });

  // Step 3: Swap 2 (Chain swap) -> Gives Shift 2 (which is active), receives Shift 3
  const afterSwap2 = simulateSwap(afterSwap1.updatedShifts, {
    givenShiftId: "shift-2",
    newShiftId: "shift-3",
    swappedWith: "พยาบาลสอง",
    originalOwner: "พยาบาลหนึ่ง",
    newDate: "2026-11-08",
    newShiftType: "night",
    newCategory: "black",
  });

  assert.equal(afterSwap2.updatedShifts.length, 3);
  const s1 = afterSwap2.updatedShifts.find((s) => s.id === "shift-1")!;
  const s2 = afterSwap2.updatedShifts.find((s) => s.id === "shift-2")!;
  const s3 = afterSwap2.updatedShifts.find((s) => s.id === "shift-3")!;

  assert.equal(s1.status, "swapped_out");
  assert.equal(s2.status, "swapped_out"); // Shift 2 was given in Swap 2
  assert.equal(s3.status, "active");

  // Step 4: Guard check: Attempting to undo Swap 1 (target shift-1 or shift-2) must be BLOCKED
  assert.throws(
    () => {
      simulateUndoSwap(afterSwap2.updatedShifts, "shift-1");
    },
    (err: any) => err.message.includes("DOWNSTREAM_SWAP_ACTIVE")
  );

  // Step 5: Sequential undo: Undo Swap 2 first
  const afterUndoSwap2 = simulateUndoSwap(afterSwap2.updatedShifts, "shift-3");
  assert.equal(afterUndoSwap2.length, 2);
  const restoredS2 = afterUndoSwap2.find((s) => s.id === "shift-2")!;
  assert.equal(restoredS2.status, "active"); // Shift 2 is restored to active!
  assert.equal(afterUndoSwap2.find((s) => s.id === "shift-3"), undefined); // Shift 3 is deleted

  // Step 6: Now undo Swap 1 succeeds!
  const afterUndoSwap1 = simulateUndoSwap(afterUndoSwap2, "shift-1");
  assert.equal(afterUndoSwap1.length, 1);
  const restoredS1 = afterUndoSwap1.find((s) => s.id === "shift-1")!;
  assert.equal(restoredS1.status, "active"); // Shift 1 fully restored!
  assert.equal(afterUndoSwap1.find((s) => s.id === "shift-2"), undefined); // Shift 2 is deleted
});

test("upgradeShiftsToV3 upgrades legacy localStorage v2 parent_shift_id pairs to ShiftSwapRecord", () => {
  const legacyV2Shifts: ShiftRecord[] = [
    {
      id: "parent-v2",
      type: "shift",
      date: "2026-09-15",
      shiftType: "morning",
      category: "black",
      status: "swapped_out",
      swapMeta: {
        swappedWith: "พยาบาลเจน",
        swapDate: "2026-09-10",
      },
      createdAt: "2026-09-01T00:00:00Z",
    },
    {
      id: "child-v2",
      type: "shift",
      date: "2026-09-20",
      shiftType: "afternoon",
      category: "black",
      status: "active",
      swapMeta: {
        swappedWith: "พยาบาลเจน",
        parentShiftId: "parent-v2",
        swapDate: "2026-09-10",
      },
      createdAt: "2026-09-10T00:00:00Z",
    },
  ];

  const upgraded = upgradeShiftsToV3(legacyV2Shifts);
  assert.equal(upgraded.length, 2);

  const parent = upgraded.find((s) => s.id === "parent-v2")!;
  const child = upgraded.find((s) => s.id === "child-v2")!;

  assert.ok(parent.swapId);
  assert.equal(parent.swap?.id, parent.swapId);
  assert.equal(parent.swap?.givenShiftId, "parent-v2");
  assert.equal(parent.swap?.receivedShiftId, "child-v2");
  assert.equal(parent.swap?.swappedWith, "พยาบาลเจน");

  assert.equal(child.swap?.id, parent.swapId);
  assert.equal(child.swap?.receivedShiftId, "child-v2");
});

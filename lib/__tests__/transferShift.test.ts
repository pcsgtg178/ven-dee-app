import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isShiftTransferrable,
  validateShiftTransferrable,
  isShiftSellable,
  validateShiftSellable,
} from "../shiftTransfer.ts";
import { countMonthlyShifts } from "../quota.ts";
import type { ShiftRecord } from "../../types/vendee.ts";

const mkShift = (
  id: string,
  date: string,
  category: ShiftRecord["category"],
  shiftType: ShiftRecord["shiftType"] = "morning",
  status: ShiftRecord["status"] = "active",
  isLocked = false,
  receivedFrom?: string
): ShiftRecord => ({
  id,
  type: "shift",
  date,
  shiftType,
  category,
  status,
  receivedFrom,
  createdAt: "2026-10-01T00:00:00Z",
  swapMeta: isLocked ? { swappedWith: "", isLocked: true } : undefined,
});

test("isShiftTransferrable allows Refer and OT shifts, rejects Black, Gray, Purple", () => {
  const futureDate = "2026-12-01";

  // 1. Refer shifts (green / r1 / r2) -> transferrable
  const referGreen = mkShift("ref-1", futureDate, "green", "r1");
  const referR2 = mkShift("ref-2", futureDate, "green", "r2");
  assert.equal(isShiftTransferrable(referGreen), true, "Refer R1 should be transferrable");
  assert.equal(isShiftTransferrable(referR2), true, "Refer R2 should be transferrable");

  // 2. OT shift (red category) -> transferrable
  const otMorning = mkShift("ot-1", futureDate, "red", "morning");
  const otNight = mkShift("ot-2", futureDate, "red", "night");
  const otAfternoon = mkShift("ot-3", futureDate, "red", "afternoon");
  assert.equal(isShiftTransferrable(otMorning), true, "Morning OT should be transferrable");
  assert.equal(isShiftTransferrable(otNight), true, "Night OT should be transferrable");
  assert.equal(isShiftTransferrable(otAfternoon), true, "Afternoon OT should be transferrable");

  // 3. Black shifts (black category) -> NOT transferrable (must maintain monthly quota)
  const blackShift = mkShift("blk-1", futureDate, "black", "morning");
  assert.equal(isShiftTransferrable(blackShift), false, "Black shift must NOT be transferrable");

  // 4. Gray shifts (off duty) -> NOT transferrable
  const offShift = mkShift("off-1", futureDate, "gray", "off");
  assert.equal(isShiftTransferrable(offShift), false, "Off shift must NOT be transferrable");

  // 5. Purple shifts (CT duties) -> NOT transferrable
  const ctShift = mkShift("ct-1", futureDate, "purple", "ctm");
  assert.equal(isShiftTransferrable(ctShift), false, "CT shift must NOT be transferrable");
});

test("isShiftTransferrable rejects locked, past, or inactive shifts", () => {
  const futureDate = "2026-12-01";
  const pastDate = "2026-01-01";

  // Locked shift
  const lockedOT = mkShift("ot-locked", futureDate, "red", "morning", "active", true);
  assert.equal(isShiftTransferrable(lockedOT), false, "Locked shift must NOT be transferrable");

  // Past shift
  const pastOT = mkShift("ot-past", pastDate, "red", "morning", "active", false);
  assert.equal(isShiftTransferrable(pastOT), false, "Past shift must NOT be transferrable");

  // Inactive / already transferred
  const transferredOT = mkShift("ot-trans", futureDate, "red", "morning", "transferred", false);
  assert.equal(isShiftTransferrable(transferredOT), false, "Transferred shift must NOT be transferrable");

  // Inactive / swapped out
  const swappedOT = mkShift("ot-swapped", futureDate, "red", "morning", "swapped_out", false);
  assert.equal(isShiftTransferrable(swappedOT), false, "Swapped shift must NOT be transferrable");
});

test("validateShiftTransferrable enforces domain error rules", () => {
  const futureDate = "2026-12-01";

  // Valid Refer & OT passes without error
  assert.doesNotThrow(() => {
    validateShiftTransferrable({
      status: "active",
      date: futureDate,
      shiftType: "r1",
      category: "green",
    });
  });

  assert.doesNotThrow(() => {
    validateShiftTransferrable({
      status: "active",
      date: futureDate,
      shiftType: "morning",
      category: "red",
    });
  });

  // Black shift rejected
  assert.throws(
    () => {
      validateShiftTransferrable({
        status: "active",
        date: futureDate,
        shiftType: "morning",
        category: "black",
      });
    },
    /อนุญาตให้ยกได้เฉพาะเวร Refer \(R1, R2\) หรือเวร OT \(เวรแดง\) เท่านั้น/
  );

  // Already transferred
  assert.throws(
    () => {
      validateShiftTransferrable({
        status: "transferred",
        date: futureDate,
        shiftType: "r1",
        category: "green",
      });
    },
    /เวรนี้ถูกทำรายการยกให้คนอื่นไปแล้ว/
  );

  // Past shift
  assert.throws(
    () => {
      validateShiftTransferrable({
        status: "active",
        date: "2026-01-01",
        shiftType: "r1",
        category: "green",
      });
    },
    /ไม่สามารถยกเวรในอดีตที่ถูกล็อกแล้วได้/
  );
});

test("transferring OT shift does not affect mandatory black shift quota", () => {
  const activeBlackShifts = [
    mkShift("b1", "2026-10-01", "black"),
    mkShift("b2", "2026-10-02", "black"),
    mkShift("b3", "2026-10-05", "black"),
  ];
  const otShiftBefore = mkShift("ot1", "2026-10-06", "red", "morning", "active");

  const beforeStats = countMonthlyShifts([...activeBlackShifts, otShiftBefore], "2026-10");
  assert.equal(beforeStats.blackCount, 3);
  assert.equal(beforeStats.redCount, 1);

  // Transfer the OT shift: status becomes transferred
  const otShiftAfter: ShiftRecord = {
    ...otShiftBefore,
    status: "transferred",
    transferMeta: {
      recipientName: "พว.แนน",
      transferredDate: "2026-10-06",
      note: "ยกเวรให้แทน",
    },
  };

  const afterStats = countMonthlyShifts([...activeBlackShifts, otShiftAfter], "2026-10");
  // Black count remains completely unaffected!
  assert.equal(afterStats.blackCount, 3, "Black shift quota must remain intact after OT transfer");
  assert.equal(afterStats.redCount, 0, "Active red count excludes transferred");
});

test("recording received OT shift preserves black shift quota and increments red count", () => {
  const activeBlackShifts = [
    mkShift("b1", "2026-10-01", "black"),
    mkShift("b2", "2026-10-02", "black"),
    mkShift("b3", "2026-10-05", "black"),
  ];

  // Receive OT shift from a colleague (e.g. พี่เปิ้ล)
  const receivedOT = mkShift("ot-in-1", "2026-10-10", "red", "morning", "active", false, "พี่เปิ้ล");
  assert.equal(receivedOT.receivedFrom, "พี่เปิ้ล");

  const stats = countMonthlyShifts([...activeBlackShifts, receivedOT], "2026-10");
  assert.equal(stats.blackCount, 3, "Black count strictly unaffected by received OT");
  assert.equal(stats.redCount, 1, "Red count increments for active OT");
});

test("isShiftSellable alias remains backward compatible", () => {
  assert.equal(typeof isShiftSellable, "function");
  assert.equal(typeof validateShiftSellable, "function");
});

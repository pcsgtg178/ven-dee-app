import test from "node:test";
import assert from "node:assert/strict";
import { repairLocalSwapInconsistencies } from "../swapRepair.ts";
import type { ShiftRecord } from "../../types/vendee.ts";

test("repairLocalSwapInconsistencies purges orphan cancelled child shifts", () => {
  const shifts: ShiftRecord[] = [
    {
      id: "parent-1",
      type: "shift",
      date: "2026-11-01",
      shiftType: "morning",
      category: "black",
      status: "active",
      createdAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "child-cancelled-1",
      type: "shift",
      date: "2026-11-02",
      shiftType: "afternoon",
      category: "black",
      status: "cancelled",
      swapMeta: {
        swappedWith: "คนอื่น",
        parentShiftId: "parent-1",
      },
      createdAt: "2026-10-01T00:00:00Z",
    },
  ];

  const { shifts: repaired, modified } = repairLocalSwapInconsistencies(shifts);
  assert.equal(modified, true);
  assert.equal(repaired.length, 1);
  assert.equal(repaired[0].id, "parent-1");
  assert.equal(repaired[0].status, "active");
});

test("repairLocalSwapInconsistencies restores orphan swapped_out parent when no active child exists", () => {
  const shifts: ShiftRecord[] = [
    {
      id: "parent-orphan",
      type: "shift",
      date: "2026-11-03",
      shiftType: "morning",
      category: "black",
      status: "swapped_out",
      swapMeta: {
        swappedWith: "บีม",
      },
      createdAt: "2026-10-01T00:00:00Z",
    },
  ];

  const { shifts: repaired, modified } = repairLocalSwapInconsistencies(shifts);
  assert.equal(modified, true);
  assert.equal(repaired.length, 1);
  assert.equal(repaired[0].id, "parent-orphan");
  assert.equal(repaired[0].status, "active");
  assert.equal(repaired[0].swapMeta, undefined);
});

test("repairLocalSwapInconsistencies purges the known corrupt Beam 2026-11-03 afternoon child shift", () => {
  const shifts: ShiftRecord[] = [
    {
      id: "beam-child",
      type: "shift",
      date: "2026-11-03",
      shiftType: "afternoon",
      category: "black",
      status: "active",
      swapMeta: {
        swappedWith: "บีม",
        parentShiftId: "parent-beam",
      },
      createdAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "parent-beam",
      type: "shift",
      date: "2026-11-03",
      shiftType: "morning",
      category: "black",
      status: "swapped_out",
      swapMeta: {
        swappedWith: "บีม",
      },
      createdAt: "2026-10-01T00:00:00Z",
    },
  ];

  const { shifts: repaired, modified } = repairLocalSwapInconsistencies(shifts);
  assert.equal(modified, true);
  assert.equal(repaired.length, 1);
  assert.equal(repaired[0].id, "parent-beam");
  assert.equal(repaired[0].status, "active");
  assert.equal(repaired[0].swapMeta, undefined);
});

test("repairLocalSwapInconsistencies preserves valid active swaps intact", () => {
  const shifts: ShiftRecord[] = [
    {
      id: "parent-valid",
      type: "shift",
      date: "2026-11-05",
      shiftType: "morning",
      category: "black",
      status: "swapped_out",
      swapMeta: {
        swappedWith: "พี่เส",
      },
      createdAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "child-valid",
      type: "shift",
      date: "2026-11-06",
      shiftType: "afternoon",
      category: "black",
      status: "active",
      swapMeta: {
        swappedWith: "พี่เส",
        parentShiftId: "parent-valid",
      },
      createdAt: "2026-10-01T00:00:00Z",
    },
  ];

  const { shifts: repaired, modified } = repairLocalSwapInconsistencies(shifts);
  assert.equal(modified, false);
  assert.equal(repaired.length, 2);
  assert.equal(repaired[0].status, "swapped_out");
  assert.equal(repaired[1].status, "active");
});

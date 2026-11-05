import test from "node:test";
import assert from "node:assert/strict";
import { repairLocalSwapInconsistencies, getValidSwapParentIds } from "../swapRepair.ts";
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

test("repairLocalSwapInconsistencies preserves cascading swap chain A -> B -> C without false orphan restore (ISSUE-3)", () => {
  // Scenario matching live DB bug: Shift A (29 Nov) swapped to B (30 Nov), B swapped to C (12 Nov)
  const shiftA: ShiftRecord = {
    id: "shift-A-29Nov",
    type: "shift",
    date: "2026-11-29",
    shiftType: "afternoon",
    category: "black",
    status: "swapped_out",
    swapId: "swap-1",
    swap: {
      id: "swap-1",
      givenShiftId: "shift-A-29Nov",
      receivedShiftId: "shift-B-30Nov",
      swappedWith: "พี่ไกร",
      swapDate: "2026-11-03",
      swapHistory: [],
    },
    createdAt: "2026-10-24T00:00:00Z",
  };

  const shiftB: ShiftRecord = {
    id: "shift-B-30Nov",
    type: "shift",
    date: "2026-11-30",
    shiftType: "afternoon",
    category: "red",
    status: "swapped_out",
    swapId: "swap-2",
    swapMeta: {
      swappedWith: "พี่ไกร",
      parentShiftId: "shift-A-29Nov",
    },
    swap: {
      id: "swap-2",
      givenShiftId: "shift-B-30Nov",
      receivedShiftId: "shift-C-12Nov",
      swappedWith: "บีม",
      swapDate: "2026-11-03",
      swapHistory: [],
    },
    createdAt: "2026-11-03T11:55:38Z",
  };

  const shiftC: ShiftRecord = {
    id: "shift-C-12Nov",
    type: "shift",
    date: "2026-11-12",
    shiftType: "morning",
    category: "black",
    status: "active",
    swapMeta: {
      swappedWith: "บีม",
      parentShiftId: "shift-B-30Nov",
    },
    createdAt: "2026-11-03T11:56:01Z",
  };

  const shifts: ShiftRecord[] = [shiftA, shiftB, shiftC];

  const { shifts: repaired, modified } = repairLocalSwapInconsistencies(shifts);

  // Must NOT modify: Shift A and Shift B must remain swapped_out!
  assert.equal(modified, false, "Cascading chain must not trigger repair");
  assert.equal(repaired.length, 3);

  const repA = repaired.find((s) => s.id === "shift-A-29Nov")!;
  const repB = repaired.find((s) => s.id === "shift-B-30Nov")!;
  const repC = repaired.find((s) => s.id === "shift-C-12Nov")!;

  assert.equal(repA.status, "swapped_out", "Shift A must remain swapped_out");
  assert.equal(repB.status, "swapped_out", "Shift B must remain swapped_out");
  assert.equal(repC.status, "active", "Shift C must remain active");
});

test("repairLocalSwapInconsistencies preserves cascading swap chain when terminal is transferred or sold", () => {
  const shifts: ShiftRecord[] = [
    {
      id: "shift-root",
      type: "shift",
      date: "2026-11-10",
      shiftType: "morning",
      category: "black",
      status: "swapped_out",
      swapId: "swap-root",
      swap: {
        id: "swap-root",
        givenShiftId: "shift-root",
        receivedShiftId: "shift-mid",
        swappedWith: "เพื่อน",
        swapDate: "2026-11-01",
        swapHistory: [],
      },
      createdAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "shift-mid",
      type: "shift",
      date: "2026-11-15",
      shiftType: "afternoon",
      category: "red",
      status: "swapped_out",
      swapId: "swap-leaf",
      swapMeta: {
        parentShiftId: "shift-root",
        swappedWith: "เพื่อน",
      },
      createdAt: "2026-11-01T00:00:00Z",
    },
    {
      id: "shift-leaf-transferred",
      type: "shift",
      date: "2026-11-20",
      shiftType: "morning",
      category: "red",
      status: "transferred",
      swapMeta: {
        parentShiftId: "shift-mid",
        swappedWith: "คนอื่น",
      },
      transferMeta: {
        recipientName: "พี่นก",
        transferredDate: "2026-11-02",
      },
      createdAt: "2026-11-01T00:00:00Z",
    },
  ];

  const { shifts: repaired, modified } = repairLocalSwapInconsistencies(shifts);
  assert.equal(modified, false);
  assert.equal(repaired[0].status, "swapped_out");
  assert.equal(repaired[1].status, "swapped_out");
  assert.equal(repaired[2].status, "transferred");
});

test("repairLocalSwapInconsistencies preserves 4-level cascading chain A -> B -> C -> D", () => {
  const shifts: ShiftRecord[] = [
    {
      id: "s1",
      type: "shift",
      date: "2026-11-01",
      shiftType: "morning",
      category: "black",
      status: "swapped_out",
      createdAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "s2",
      type: "shift",
      date: "2026-11-02",
      shiftType: "afternoon",
      category: "black",
      status: "swapped_out",
      swapMeta: { parentShiftId: "s1", swappedWith: "p1" },
      createdAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "s3",
      type: "shift",
      date: "2026-11-03",
      shiftType: "night",
      category: "black",
      status: "swapped_out",
      swapMeta: { parentShiftId: "s2", swappedWith: "p2" },
      createdAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "s4",
      type: "shift",
      date: "2026-11-04",
      shiftType: "morning",
      category: "black",
      status: "active",
      swapMeta: { parentShiftId: "s3", swappedWith: "p3" },
      createdAt: "2026-10-01T00:00:00Z",
    },
  ];

  const { shifts: repaired, modified } = repairLocalSwapInconsistencies(shifts);
  assert.equal(modified, false);
  assert.equal(repaired.find((s) => s.id === "s1")!.status, "swapped_out");
  assert.equal(repaired.find((s) => s.id === "s2")!.status, "swapped_out");
  assert.equal(repaired.find((s) => s.id === "s3")!.status, "swapped_out");
  assert.equal(repaired.find((s) => s.id === "s4")!.status, "active");
});

test("getValidSwapParentIds identifies all ancestor parent IDs across chain", () => {
  const shifts: ShiftRecord[] = [
    {
      id: "a",
      type: "shift",
      date: "2026-11-01",
      shiftType: "morning",
      category: "black",
      status: "swapped_out",
      createdAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "b",
      type: "shift",
      date: "2026-11-02",
      shiftType: "afternoon",
      category: "black",
      status: "swapped_out",
      swapMeta: { parentShiftId: "a", swappedWith: "p1" },
      createdAt: "2026-10-01T00:00:00Z",
    },
    {
      id: "c",
      type: "shift",
      date: "2026-11-03",
      shiftType: "morning",
      category: "black",
      status: "active",
      swapMeta: { parentShiftId: "b", swappedWith: "p2" },
      createdAt: "2026-10-01T00:00:00Z",
    },
  ];

  const validParentIds = getValidSwapParentIds(shifts);
  assert.equal(validParentIds.has("a"), true);
  assert.equal(validParentIds.has("b"), true);
  assert.equal(validParentIds.has("c"), false);
});

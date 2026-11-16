import test from "node:test";
import assert from "node:assert/strict";
import {
  isShiftLocked,
  isShiftEditable,
  isShiftDeletable,
  isDateWithinGracePeriod,
  getEarliestGracePeriodDate,
} from "../dateUtils.ts";
import type { ShiftRecord } from "../../types/vendee.ts";

function createMockShift(overrides: Partial<ShiftRecord>): ShiftRecord {
  return {
    id: `mock-shift-${Date.now()}-${Math.random()}`,
    type: "shift",
    date: "2026-11-01",
    shiftType: "morning",
    category: "black",
    status: "active",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test("Phase 18: 1.1 isShiftEditable allows editing normal shifts in Grace Period (current month)", () => {
  const midNov = new Date("2026-11-15T10:00:00+07:00");
  const pastMorningShift = createMockShift({
    date: "2026-11-02",
    shiftType: "morning",
    category: "black",
    status: "active",
  });

  assert.equal(isShiftEditable(pastMorningShift, midNov), true);
  assert.equal(isShiftLocked(pastMorningShift, midNov), false);
});

test("Phase 18: 1.2 isShiftEditable allows editing normal shifts in previous month on days 1-7", () => {
  const earlyNov = new Date("2026-11-05T09:00:00+07:00");
  const octShift = createMockShift({
    date: "2026-10-28",
    shiftType: "night",
    category: "red",
    status: "active",
  });

  assert.equal(isShiftEditable(octShift, earlyNov), true);
  assert.equal(isShiftLocked(octShift, earlyNov), false);
});

test("Phase 18: 1.3 isShiftEditable locks normal shifts in previous month after day 7", () => {
  const midNov = new Date("2026-11-08T10:00:00+07:00");
  const octShift = createMockShift({
    date: "2026-10-28",
    shiftType: "afternoon",
    category: "black",
    status: "active",
  });

  assert.equal(isShiftEditable(octShift, midNov), false);
  assert.equal(isShiftLocked(octShift, midNov), true);
});

test("Phase 18: 1.4 isShiftEditable locks normal shifts from 2+ months ago", () => {
  const midNov = new Date("2026-11-15T10:00:00+07:00");
  const septShift = createMockShift({
    date: "2026-09-15",
    shiftType: "morning",
    category: "black",
    status: "active",
  });

  assert.equal(isShiftEditable(septShift, midNov), false);
  assert.equal(isShiftLocked(septShift, midNov), true);
});

test("Phase 18: 1.5 isShiftEditable rejects non-active or explicitly locked shifts", () => {
  const midNov = new Date("2026-11-15T10:00:00+07:00");
  const cancelledShift = createMockShift({
    date: "2026-11-10",
    status: "cancelled",
  });
  assert.equal(isShiftEditable(cancelledShift, midNov), false);

  const swappedOutShift = createMockShift({
    date: "2026-11-10",
    status: "swapped_out",
  });
  assert.equal(isShiftEditable(swappedOutShift, midNov), false);

  const manuallyLockedShift = createMockShift({
    date: "2026-11-20", // Future date
    isLocked: true,
  });
  assert.equal(isShiftEditable(manuallyLockedShift, midNov), false);
});

test("Phase 18: 2.1 isShiftDeletable allows deleting normal shifts in Grace Period", () => {
  const midNov = new Date("2026-11-15T10:00:00+07:00");
  const pastShift = createMockShift({
    date: "2026-11-03",
    shiftType: "morning",
    category: "black",
    status: "active",
  });

  assert.equal(isShiftDeletable(pastShift, midNov), true);
});

test("Phase 18: 2.2 isShiftDeletable rejects swapped_out or sold_out shifts (must use Undo)", () => {
  const midNov = new Date("2026-11-15T10:00:00+07:00");
  const swappedShift = createMockShift({
    date: "2026-11-03",
    status: "swapped_out",
  });
  assert.equal(isShiftDeletable(swappedShift, midNov), false);

  const soldShift = createMockShift({
    date: "2026-11-03",
    status: "sold_out",
  });
  assert.equal(isShiftDeletable(soldShift, midNov), false);
});

test("Phase 18: 2.3 isShiftDeletable rejects shifts outside Grace Period", () => {
  const midNov = new Date("2026-11-15T10:00:00+07:00");
  const oldShift = createMockShift({
    date: "2026-09-01",
    status: "active",
  });
  assert.equal(isShiftDeletable(oldShift, midNov), false);
});

test("Phase 18: 3.1 isShiftEditable and isShiftDeletable handle edge cases and today date parameter", () => {
  const activeShift = createMockShift({
    date: "2026-11-01",
    status: "active",
  });
  const nov10 = new Date("2026-11-10T12:00:00+07:00");
  assert.equal(isShiftEditable(activeShift, nov10), true);
  assert.equal(isShiftDeletable(activeShift, nov10), true);

  assert.equal(isShiftEditable(null), false);
  assert.equal(isShiftDeletable(undefined), false);
});

test("Phase 18: 4.1 getEarliestGracePeriodDate returns first day of permitted month", () => {
  const earlyNov = new Date("2026-11-04T12:00:00+07:00");
  assert.equal(getEarliestGracePeriodDate(earlyNov), "2026-10-01");

  const midNov = new Date("2026-11-15T12:00:00+07:00");
  assert.equal(getEarliestGracePeriodDate(midNov), "2026-11-01");
});

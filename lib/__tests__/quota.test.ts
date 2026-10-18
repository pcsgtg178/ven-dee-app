import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countMonthlyShifts,
  countWeekdaysInMonth,
  calculateMonthlyBlackShiftQuota,
} from "../quota.ts";

const mk = (id: string, date: string, category: string, status = "active") =>
  ({ id, type: "shift", date, shiftType: "morning", category, status, createdAt: "" }) as any;

test("counts only active black in month", () => {
  const r = countMonthlyShifts(
    [
      mk("1", "2026-10-01", "black"),
      mk("2", "2026-10-31", "black"),
      mk("3", "2026-10-05", "black", "swapped_out"),
      mk("4", "2026-10-06", "black", "sold_out"),
      mk("5", "2026-10-07", "black", "cancelled"),
      mk("6", "2026-10-08", "red"),
      mk("7", "2026-10-09", "green"),
    ],
    "2026-10"
  );
  assert.equal(r.blackCount, 2);
  assert.equal(r.redCount, 1);
});

test("month boundaries exclude neighbours", () => {
  const r = countMonthlyShifts(
    [mk("a", "2026-09-30", "black"), mk("b", "2026-10-01", "black"), mk("c", "2026-11-01", "black")],
    "2026-10"
  );
  assert.equal(r.blackCount, 1);
});

test("duplicates counted once, received swaps included", () => {
  const swapped = { ...mk("x", "2026-10-10", "black"), swapMeta: { swappedWith: "P" } };
  const r = countMonthlyShifts([swapped, swapped, mk("y", "2026-10-11", "black")], "2026-10");
  assert.equal(r.blackCount, 2);
});

test("countWeekdaysInMonth correctly counts Mon-Fri days", () => {
  // October 2026: 31 days, starts on Thursday, ends on Saturday -> 22 weekdays
  assert.equal(countWeekdaysInMonth("2026-10"), 22);

  // September 2026: 30 days, starts on Tuesday, ends on Wednesday -> 22 weekdays
  assert.equal(countWeekdaysInMonth("2026-09"), 22);

  // February 2026: 28 days, starts on Sunday, ends on Saturday -> 20 weekdays
  assert.equal(countWeekdaysInMonth("2026-02"), 20);

  // November 2026: 30 days, starts on Sunday, ends on Monday -> 21 weekdays
  assert.equal(countWeekdaysInMonth("2026-11"), 21);

  // Invalid strings fall back to standard 22
  assert.equal(countWeekdaysInMonth(""), 22);
  assert.equal(countWeekdaysInMonth("invalid"), 22);
});

test("calculateMonthlyBlackShiftQuota: 1. ชม.เวรดำ = จ-ศ x 8 ชม. 2. จำนวนเวร = ชม.เวรดำ / 8", () => {
  // Example from prompt:
  // เดือนนี้มี จ-ศ 22 วัน x 8 = 176 ชม
  // แปลงชั่วโมงเวรเป็น "จำนวนเวร" = 176 / 8 = 22 เวร
  const oct2026 = calculateMonthlyBlackShiftQuota("2026-10");
  assert.equal(oct2026.weekdaysCount, 22);
  assert.equal(oct2026.blackShiftHours, 176);
  assert.equal(oct2026.shiftSystemHours, 8);
  assert.equal(oct2026.quotaShifts, 22);

  // February 2026: 20 weekdays x 8 = 160 hrs / 8 = 20 shifts
  const feb2026 = calculateMonthlyBlackShiftQuota("2026-02");
  assert.equal(feb2026.weekdaysCount, 20);
  assert.equal(feb2026.blackShiftHours, 160);
  assert.equal(feb2026.quotaShifts, 20);

  // November 2026: 21 weekdays x 8 = 168 hrs / 8 = 21 shifts
  const nov2026 = calculateMonthlyBlackShiftQuota("2026-11");
  assert.equal(nov2026.weekdaysCount, 21);
  assert.equal(nov2026.blackShiftHours, 168);
  assert.equal(nov2026.quotaShifts, 21);
});


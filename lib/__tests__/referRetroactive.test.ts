import test from "node:test";
import assert from "node:assert/strict";
import {
  isReferShift,
  isReferShiftWithinGracePeriod,
  isShiftLocked,
  isShiftInPast,
} from "../dateUtils.ts";
import {
  isShiftTransferrable,
  validateShiftTransferrable,
} from "../shiftTransfer.ts";
import { generateIcsCalendar } from "../calendar/icsGenerator.ts";
import type { ShiftRecord } from "../../types/vendee.ts";

function createMockShift(overrides: Partial<ShiftRecord>): ShiftRecord {
  return {
    id: `mock-shift-${Date.now()}-${Math.random()}`,
    type: "shift",
    date: "2026-11-01",
    shiftType: "r1",
    category: "green",
    status: "active",
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test("1.1 isReferShift correctly identifies Refer shift types and green category", () => {
  assert.equal(isReferShift({ shiftType: "r1", category: "green" }), true);
  assert.equal(isReferShift({ shiftType: "r2", category: "green" }), true);
  assert.equal(isReferShift({ shiftType: "r1", category: "black" }), true);
  assert.equal(isReferShift({ shiftType: "morning", category: "green" }), true);
  assert.equal(isReferShift({ shiftType: "morning", category: "black" }), false);
  assert.equal(isReferShift({ shiftType: "afternoon", category: "red" }), false);
  assert.equal(isReferShift({ shiftType: "night", category: "black" }), false);
  assert.equal(isReferShift({ shiftType: "off", category: "gray" }), false);
  assert.equal(isReferShift(null), false);
  assert.equal(isReferShift(undefined), false);
});

test("1.2 isReferShiftWithinGracePeriod evaluates Rule 1 (Current Month)", () => {
  // Mock current date: 2026-11-15 (middle of November)
  const midNov = new Date("2026-11-15T10:00:00+07:00");

  // Shifts in November 2026
  assert.equal(isReferShiftWithinGracePeriod("2026-11-01", midNov), true);
  assert.equal(isReferShiftWithinGracePeriod("2026-11-10", midNov), true);
  assert.equal(isReferShiftWithinGracePeriod("2026-11-15", midNov), true);
  assert.equal(isReferShiftWithinGracePeriod("2026-11-30", midNov), true);

  // Shifts in October 2026 (day 15 is > 7, so previous month grace closed)
  assert.equal(isReferShiftWithinGracePeriod("2026-10-31", midNov), false);
  assert.equal(isReferShiftWithinGracePeriod("2026-10-15", midNov), false);
});

test("1.3 isReferShiftWithinGracePeriod evaluates Rule 2 (Days 1-7 Previous Month Grace Window)", () => {
  // Mock current date: 2026-11-05 (day <= 7)
  const earlyNov = new Date("2026-11-05T09:00:00+07:00");

  // Current month is always allowed
  assert.equal(isReferShiftWithinGracePeriod("2026-11-02", earlyNov), true);

  // Previous month (October 2026) is allowed during days 1-7
  assert.equal(isReferShiftWithinGracePeriod("2026-10-31", earlyNov), true);
  assert.equal(isReferShiftWithinGracePeriod("2026-10-15", earlyNov), true);
  assert.equal(isReferShiftWithinGracePeriod("2026-10-01", earlyNov), true);

  // Two months ago (September 2026) is NOT allowed
  assert.equal(isReferShiftWithinGracePeriod("2026-09-30", earlyNov), false);

  // Mock current date: 2026-11-07 (day 7: boundary test)
  const day7Nov = new Date("2026-11-07T23:59:59+07:00");
  assert.equal(isReferShiftWithinGracePeriod("2026-10-25", day7Nov), true);

  // Mock current date: 2026-11-08 (day 8: grace window closed)
  const day8Nov = new Date("2026-11-08T00:00:01+07:00");
  assert.equal(isReferShiftWithinGracePeriod("2026-10-25", day8Nov), false);
});

test("1.4 isReferShiftWithinGracePeriod handles year transitions (Jan 1-7 allows Dec)", () => {
  // Mock current date: 2027-01-04 (day 4 of January)
  const earlyJan = new Date("2027-01-04T12:00:00+07:00");

  // December 2026 shift is within previous month grace window
  assert.equal(isReferShiftWithinGracePeriod("2026-12-28", earlyJan), true);
  assert.equal(isReferShiftWithinGracePeriod("2026-12-01", earlyJan), true);

  // November 2026 is 2 months ago -> rejected
  assert.equal(isReferShiftWithinGracePeriod("2026-11-30", earlyJan), false);

  // Mock current date: 2027-01-10 (day > 7)
  const midJan = new Date("2027-01-10T12:00:00+07:00");
  assert.equal(isReferShiftWithinGracePeriod("2026-12-28", midJan), false);
});

test("2.1 isShiftLocked exempts Refer shifts in Grace Period but locks Non-Refer shifts", () => {
  // Mock current date: 2026-11-05
  const today = new Date("2026-11-05T12:00:00+07:00");

  const pastReferCurrentMonth = createMockShift({
    date: "2026-11-02",
    shiftType: "r1",
    category: "green",
  });
  // Refer in current month -> NOT locked
  assert.equal(isShiftLocked(pastReferCurrentMonth, today), false);

  const pastReferPrevMonth = createMockShift({
    date: "2026-10-28",
    shiftType: "r2",
    category: "green",
  });
  // Refer in prev month on day 5 -> NOT locked
  assert.equal(isShiftLocked(pastReferPrevMonth, today), false);

  const pastBlackShift = createMockShift({
    date: "2026-11-02",
    shiftType: "morning",
    category: "black",
  });
  // Black shift in past -> ALWAYS locked
  assert.equal(isShiftLocked(pastBlackShift, today), true);

  const pastOTShift = createMockShift({
    date: "2026-11-02",
    shiftType: "afternoon",
    category: "red",
  });
  // OT shift in past -> LOCKED (Grace period is strictly for Refer shifts)
  assert.equal(isShiftLocked(pastOTShift, today), true);
});

test("3.1 One-Way Shift Transfer allows retroactive Refer shift in Grace Period", () => {
  // Shift in current month (past relative to today's date if today is later in the month)
  // Let's create a Refer shift
  const referShift = createMockShift({
    date: "2026-11-01",
    shiftType: "r1",
    category: "green",
    status: "active",
  });

  // isShiftTransferrable passes for active Refer shift within grace period
  assert.equal(isShiftTransferrable(referShift), true);

  // validateShiftTransferrable does not throw
  assert.doesNotThrow(() => {
    validateShiftTransferrable({
      status: referShift.status,
      date: referShift.date,
      shiftType: referShift.shiftType,
      category: referShift.category,
      isLocked: false,
    });
  });
});

test("3.2 One-Way Shift Transfer rejects past Non-Refer shifts and expired Refer shifts", () => {
  // Black shift is not eligible for transfer regardless of date
  assert.throws(
    () => {
      validateShiftTransferrable({
        status: "active",
        date: "2026-11-20",
        shiftType: "morning",
        category: "black",
      });
    },
    /อนุญาตให้ยกได้เฉพาะเวร Refer/
  );

  // Two-month-old Refer shift (way past grace period)
  assert.throws(
    () => {
      validateShiftTransferrable({
        status: "active",
        date: "2026-08-15",
        shiftType: "r1",
        category: "green",
      });
    },
    /ไม่สามารถยกเวรในอดีตที่ถูกล็อกแล้วได้/
  );
});

test("4.1 Swap Retroactive allows Refer shifts within grace period and rejects expired / black shifts", () => {
  // Refer shift in current month: isShiftLocked is false -> can swap
  const referInGrace = createMockShift({
    date: "2026-11-01",
    shiftType: "r1",
    category: "green",
  });
  assert.equal(isShiftLocked(referInGrace), false);

  // Black shift in past: isShiftLocked is true -> cannot swap
  const blackInPast = createMockShift({
    date: "2026-11-01",
    shiftType: "morning",
    category: "black",
  });
  assert.equal(isShiftLocked(blackInPast), true);

  // Refer shift from 3 months ago: isShiftLocked is true -> cannot swap
  const referExpired = createMockShift({
    date: "2026-08-01",
    shiftType: "r1",
    category: "green",
  });
  assert.equal(isShiftLocked(referExpired), true);
});

test("5.1 Phase 13 ICS generation produces clean ER shift titles without department or hospital suffix", () => {
  const shifts: ShiftRecord[] = [
    createMockShift({ id: "s1", date: "2026-11-10", shiftType: "morning", category: "black" }),
    createMockShift({ id: "s2", date: "2026-11-11", shiftType: "morning", category: "red" }),
    createMockShift({ id: "s3", date: "2026-11-12", shiftType: "afternoon", category: "black" }),
    createMockShift({ id: "s4", date: "2026-11-13", shiftType: "afternoon", category: "red" }),
    createMockShift({ id: "s5", date: "2026-11-14", shiftType: "night", category: "black" }),
    createMockShift({ id: "s6", date: "2026-11-15", shiftType: "night", category: "red" }),
    createMockShift({ id: "s7", date: "2026-11-16", shiftType: "ctm", category: "purple" }),
    createMockShift({ id: "s8", date: "2026-11-17", shiftType: "cta", category: "purple" }),
  ];

  const ics = generateIcsCalendar({ shifts, options: { month: "2026-11" } });

  assert.ok(ics.includes("SUMMARY:☀️ [เวรเช้า]"), "Morning black shift summary matches");
  assert.ok(ics.includes("SUMMARY:🔴 [เวรแดง OT] เช้า"), "Morning red OT shift summary matches");
  assert.ok(ics.includes("SUMMARY:🌤️ [เวรบ่าย]"), "Afternoon black shift summary matches");
  assert.ok(ics.includes("SUMMARY:🔴 [เวรแดง OT] บ่าย"), "Afternoon red OT shift summary matches");
  assert.ok(ics.includes("SUMMARY:🌙 [เวรดึก]"), "Night black shift summary matches");
  assert.ok(ics.includes("SUMMARY:🔴 [เวรแดง OT] ดึก"), "Night red OT shift summary matches");
  assert.ok(ics.includes("SUMMARY:🩺 [เวร CT เช้า]"), "CT morning shift summary matches");
  assert.ok(ics.includes("SUMMARY:🩺 [เวร CT บ่าย]"), "CT afternoon shift summary matches");

  // Ensure no legacy suffixes like "รพ." or "ห้อง CT" in summaries
  assert.ok(!ics.includes("☀️ [เวรเช้า] รพ."));
  assert.ok(!ics.includes("SUMMARY:🩺 [เวร CT เช้า] ห้อง CT"));
  assert.ok(!ics.includes("SUMMARY:🩺 [เวร CT บ่าย] ห้อง CT"));
});

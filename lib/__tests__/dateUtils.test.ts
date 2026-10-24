import test from "node:test";
import assert from "node:assert/strict";
import { getTodayDateStringBangkok, isDateInPast, isShiftInPast } from "../dateUtils.ts";

test("getTodayDateStringBangkok returns valid YYYY-MM-DD string", () => {
  const dateStr = getTodayDateStringBangkok();
  assert.match(dateStr, /^\d{4}-\d{2}-\d{2}$/);
});

test("isDateInPast and isShiftInPast correctly evaluate past and future dates", () => {
  const today = getTodayDateStringBangkok();
  const [year, month, day] = today.split("-").map(Number);

  // Past date
  const pastYear = String(year - 1).padStart(4, "0");
  const pastDateStr = `${pastYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  assert.equal(isDateInPast(pastDateStr), true);
  assert.equal(isShiftInPast(pastDateStr), true);

  // Today is NOT strictly in the past
  assert.equal(isDateInPast(today), false);
  assert.equal(isShiftInPast(today), false);

  // Future date
  const futureYear = String(year + 1).padStart(4, "0");
  const futureDateStr = `${futureYear}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  assert.equal(isDateInPast(futureDateStr), false);
  assert.equal(isShiftInPast(futureDateStr), false);

  // Empty string returns false
  assert.equal(isDateInPast(""), false);
  assert.equal(isShiftInPast(""), false);
});

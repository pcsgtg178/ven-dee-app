import { test } from "node:test";
import assert from "node:assert/strict";
import {
  compareEventsByStartTime,
  getEventStartMinutes,
  sortEventsByStartTime,
} from "../sortEvents.ts";
import type {
  ActivityItem,
  ClinicWorkRecord,
  CustomerServiceRecord,
  PersonalEventRecord,
  ShiftRecord,
} from "../../types/vendee.ts";

const mkShift = (
  id: string,
  date: string,
  shiftType: any,
  createdAt = "2026-01-01T00:00:00Z"
): ShiftRecord => ({
  id,
  type: "shift",
  date,
  shiftType,
  category: "black",
  status: "active",
  createdAt,
});

const mkService = (
  id: string,
  date: string,
  time: string,
  createdAt = "2026-01-01T00:00:00Z"
): CustomerServiceRecord => ({
  id,
  type: "service",
  customerId: "cust-1",
  customerName: "คุณสมศรี",
  date,
  time,
  createdAt,
});

const mkClinic = (
  id: string,
  date: string,
  presetShift: any,
  createdAt = "2026-01-01T00:00:00Z"
): ClinicWorkRecord => ({
  id,
  type: "clinic",
  date,
  presetShift,
  createdAt,
});

const mkPersonal = (
  id: string,
  date: string,
  startTime: string,
  isAllDay = false,
  createdAt = "2026-01-01T00:00:00Z"
): PersonalEventRecord => ({
  id,
  type: "personal_event",
  title: "ธุระส่วนตัว",
  date,
  eventDate: date,
  startTime,
  endTime: startTime,
  isAllDay,
  createdAt,
});

test("getEventStartMinutes returns correct minute offsets or null for all-day", () => {
  // Shifts
  assert.equal(getEventStartMinutes(mkShift("1", "2026-10-10", "night")), 0);
  assert.equal(getEventStartMinutes(mkShift("2", "2026-10-10", "morning")), 480);
  assert.equal(getEventStartMinutes(mkShift("3", "2026-10-10", "afternoon")), 960);
  assert.equal(getEventStartMinutes(mkShift("4", "2026-10-10", "r1")), null); // Refer all-day
  assert.equal(getEventStartMinutes(mkShift("5", "2026-10-10", "off")), null);

  // Customer Service
  assert.equal(getEventStartMinutes(mkService("6", "2026-10-10", "09:30")), 570);
  assert.equal(getEventStartMinutes(mkService("7", "2026-10-10", "14:15")), 855);

  // Clinic
  assert.equal(getEventStartMinutes(mkClinic("8", "2026-10-10", "12:30 - 17:30")), 750);
  assert.equal(getEventStartMinutes(mkClinic("9", "2026-10-10", "17:00 - 19:30")), 1020);

  // Personal Event
  assert.equal(getEventStartMinutes(mkPersonal("10", "2026-10-10", "18:00", false)), 1080);
  assert.equal(getEventStartMinutes(mkPersonal("11", "2026-10-10", "08:00", true)), null); // all-day
});

test("all-day / untimed items come first within same day", () => {
  const referShift = mkShift("refer", "2026-10-10", "r1");
  const allDayPersonal = mkPersonal("allday", "2026-10-10", "00:00", true);
  const morningShift = mkShift("morning", "2026-10-10", "morning");
  const nightShift = mkShift("night", "2026-10-10", "night");

  const items: ActivityItem[] = [morningShift, referShift, nightShift, allDayPersonal];
  const sorted = sortEventsByStartTime(items);

  // The two all-day items must come before timed items
  assert.ok(sorted[0].id === "refer" || sorted[0].id === "allday");
  assert.ok(sorted[1].id === "refer" || sorted[1].id === "allday");
  assert.equal(sorted[2].id, "night"); // 00:00
  assert.equal(sorted[3].id, "morning"); // 08:00
});

test("timed events on same date sort ascending by start time regardless of createdAt", () => {
  // Afternoon created first, then morning, then clinic
  const afternoon = mkShift("aft", "2026-10-10", "afternoon", "2026-01-01T08:00:00Z");
  const morning = mkShift("mor", "2026-10-10", "morning", "2026-01-02T08:00:00Z");
  const clinic = mkClinic("cli", "2026-10-10", "12:30 - 17:30", "2026-01-03T08:00:00Z");
  const service = mkService("srv", "2026-10-10", "10:00", "2026-01-04T08:00:00Z");

  const items: ActivityItem[] = [afternoon, morning, clinic, service];
  const sorted = sortEventsByStartTime(items);

  // Expected chronological order: morning (08:00) -> service (10:00) -> clinic (12:30) -> afternoon (16:00)
  assert.deepEqual(
    sorted.map((i) => i.id),
    ["mor", "srv", "cli", "aft"]
  );
});

test("createdAt is used only as tie-breaker when startTime is identical", () => {
  const serviceEarlier = mkService("srv-1", "2026-10-10", "10:00", "2026-01-01T08:00:00Z");
  const serviceLater = mkService("srv-2", "2026-10-10", "10:00", "2026-01-02T08:00:00Z");

  const sorted1 = sortEventsByStartTime([serviceLater, serviceEarlier]);
  assert.deepEqual(
    sorted1.map((i) => i.id),
    ["srv-1", "srv-2"]
  );

  const sorted2 = sortEventsByStartTime([serviceEarlier, serviceLater]);
  assert.deepEqual(
    sorted2.map((i) => i.id),
    ["srv-1", "srv-2"]
  );
});

test("events across multiple dates are sorted primarily by date ascending", () => {
  const day2Morning = mkShift("d2-mor", "2026-10-12", "morning");
  const day1Afternoon = mkShift("d1-aft", "2026-10-11", "afternoon");

  const sorted = sortEventsByStartTime([day2Morning, day1Afternoon]);
  assert.deepEqual(
    sorted.map((i) => i.id),
    ["d1-aft", "d2-mor"]
  );
});

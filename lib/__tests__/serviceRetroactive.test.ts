import test from "node:test";
import assert from "node:assert/strict";
import {
  isDateInPast,
  isDateWithinGracePeriod,
  isServiceDateWithinGracePeriod,
  getEarliestServiceGracePeriodDate,
  isServiceEditable,
  isServiceDeletable,
} from "../dateUtils.ts";

test("1. isDateInPast evaluates dates accurately in Asia/Bangkok timezone", () => {
  // 2026-11-10T18:00:00Z is 2026-11-11 01:00:00 +07:00 in Bangkok
  const nov11Bkk = new Date("2026-11-10T18:00:00Z");

  assert.equal(isDateInPast("2026-11-10", nov11Bkk), true);
  assert.equal(isDateInPast("2026-11-11", nov11Bkk), false);
  assert.equal(isDateInPast("2026-11-12", nov11Bkk), false);
});

test("2. isServiceDateWithinGracePeriod allows current calendar month and full previous calendar month", () => {
  const nov11 = new Date("2026-11-11T10:00:00+07:00");
  const nov30EndOfMonth = new Date("2026-11-30T23:59:59+07:00");

  // Current calendar month (November 2026)
  assert.equal(isServiceDateWithinGracePeriod("2026-11-01", nov11), true);
  assert.equal(isServiceDateWithinGracePeriod("2026-11-10", nov11), true);
  assert.equal(isServiceDateWithinGracePeriod("2026-11-11", nov11), true);
  assert.equal(isServiceDateWithinGracePeriod("2026-11-30", nov11), true);

  // Full previous calendar month (October 2026) allowed even on day 11 and day 30
  assert.equal(isServiceDateWithinGracePeriod("2026-10-01", nov11), true);
  assert.equal(isServiceDateWithinGracePeriod("2026-10-15", nov11), true);
  assert.equal(isServiceDateWithinGracePeriod("2026-10-31", nov11), true);

  assert.equal(isServiceDateWithinGracePeriod("2026-10-01", nov30EndOfMonth), true);
  assert.equal(isServiceDateWithinGracePeriod("2026-10-31", nov30EndOfMonth), true);

  // Older than 1 calendar month (September 2026) is expired
  assert.equal(isServiceDateWithinGracePeriod("2026-09-30", nov11), false);
  assert.equal(isServiceDateWithinGracePeriod("2026-09-01", nov11), false);
  assert.equal(isServiceDateWithinGracePeriod("2026-09-30", nov30EndOfMonth), false);
});

test("3. isServiceDateWithinGracePeriod handles cross-year transition (Jan -> Dec) and invalid dates", () => {
  const jan25 = new Date("2027-01-25T09:00:00+07:00");

  // Current month (Jan 2027) and full previous month (Dec 2026)
  assert.equal(isServiceDateWithinGracePeriod("2027-01-01", jan25), true);
  assert.equal(isServiceDateWithinGracePeriod("2026-12-01", jan25), true);
  assert.equal(isServiceDateWithinGracePeriod("2026-12-31", jan25), true);

  // Two months ago (Nov 2026) or prior year same month (Jan 2026)
  assert.equal(isServiceDateWithinGracePeriod("2026-11-30", jan25), false);
  assert.equal(isServiceDateWithinGracePeriod("2026-01-25", jan25), false);

  // Malformed strings
  assert.equal(isServiceDateWithinGracePeriod("", jan25), false);
  assert.equal(isServiceDateWithinGracePeriod("2026-12", jan25), false);
  assert.equal(isServiceDateWithinGracePeriod("2026-13-01", jan25), false);
  assert.equal(isServiceDateWithinGracePeriod("2026-12-00", jan25), false);
  assert.equal(isServiceDateWithinGracePeriod("invalid", jan25), false);
});

test("4. getEarliestServiceGracePeriodDate returns first day of previous calendar month", () => {
  assert.equal(getEarliestServiceGracePeriodDate(new Date("2026-11-11T10:00:00+07:00")), "2026-10-01");
  assert.equal(getEarliestServiceGracePeriodDate(new Date("2026-11-30T23:59:59+07:00")), "2026-10-01");
  assert.equal(getEarliestServiceGracePeriodDate(new Date("2027-01-01T00:00:01+07:00")), "2026-12-01");
  assert.equal(getEarliestServiceGracePeriodDate(new Date("2027-01-31T12:00:00+07:00")), "2026-12-01");
});

test("5. isServiceEditable allows upcoming and completed within 1-month grace window, blocks cancelled and expired", () => {
  const nov11 = new Date("2026-11-11T10:00:00+07:00");
  const nov30 = new Date("2026-11-30T22:00:00+07:00");

  // Upcoming & completed in past within current month
  assert.equal(isServiceEditable({ date: "2026-11-01", status: "upcoming" }, nov11), true);
  assert.equal(isServiceEditable({ date: "2026-11-01", status: "completed" }, nov11), true);

  // Upcoming & completed in full previous month (even on Nov 30)
  assert.equal(isServiceEditable({ date: "2026-10-01", status: "upcoming" }, nov11), true);
  assert.equal(isServiceEditable({ date: "2026-10-15", status: "completed" }, nov11), true);
  assert.equal(isServiceEditable({ date: "2026-10-01", status: "completed" }, nov30), true);

  // Today & future
  assert.equal(isServiceEditable({ date: "2026-11-11", status: "completed" }, nov11), true);
  assert.equal(isServiceEditable({ date: "2026-12-20", status: "upcoming" }, nov11), true);

  // Missing status defaults to editable within grace period
  assert.equal(isServiceEditable({ date: "2026-10-20" }, nov11), true);
  assert.equal(isServiceEditable({ date: "2026-09-30" }, nov11), false);

  // Expired (> 1 calendar month ago)
  assert.equal(isServiceEditable({ date: "2026-09-30", status: "upcoming" }, nov11), false);
  assert.equal(isServiceEditable({ date: "2026-09-30", status: "completed" }, nov11), false);

  // Cancelled is ALWAYS locked
  assert.equal(isServiceEditable({ date: "2026-11-20", status: "cancelled" }, nov11), false);
  assert.equal(isServiceEditable({ date: "2026-11-11", status: "cancelled" }, nov11), false);
  assert.equal(isServiceEditable({ date: "2026-10-15", status: "cancelled" }, nov11), false);

  // Null / undefined / missing date
  assert.equal(isServiceEditable(null, nov11), false);
  assert.equal(isServiceEditable(undefined, nov11), false);
  assert.equal(isServiceEditable({}, nov11), false);
});

test("6. isServiceDeletable enforces 1-calendar-month retroactive grace period", () => {
  const nov11 = new Date("2026-11-11T10:00:00+07:00");
  const nov30 = new Date("2026-11-30T10:00:00+07:00");

  // Today / future
  assert.equal(isServiceDeletable({ date: "2026-11-11", status: "upcoming" }, nov11), true);
  assert.equal(isServiceDeletable({ date: "2026-12-05", status: "upcoming" }, nov11), true);

  // Past within current & full previous calendar month (upcoming, completed, cancelled)
  assert.equal(isServiceDeletable({ date: "2026-11-05", status: "completed" }, nov11), true);
  assert.equal(isServiceDeletable({ date: "2026-10-01", status: "completed" }, nov11), true);
  assert.equal(isServiceDeletable({ date: "2026-10-01", status: "completed" }, nov30), true);
  assert.equal(isServiceDeletable({ date: "2026-10-15", status: "cancelled" }, nov11), true);

  // Past > 1 calendar month ago is locked
  assert.equal(isServiceDeletable({ date: "2026-09-30", status: "upcoming" }, nov11), false);
  assert.equal(isServiceDeletable({ date: "2026-09-30", status: "completed" }, nov11), false);

  // Null / undefined
  assert.equal(isServiceDeletable(null, nov11), false);
  assert.equal(isServiceDeletable({}, nov11), false);
});

test("7. Customer service 1-month grace rule remains independent from Hospital Shift days 1-7 cutoff", () => {
  const nov11 = new Date("2026-11-11T10:00:00+07:00");

  // On Nov 11 (after day 7), Hospital Shift grace period for October is CLOSED
  assert.equal(isDateWithinGracePeriod("2026-10-15", nov11), false);

  // Whereas Customer Service 1-calendar-month grace period for October remains OPEN
  assert.equal(isServiceDateWithinGracePeriod("2026-10-15", nov11), true);
  assert.equal(isServiceEditable({ date: "2026-10-15", status: "completed" }, nov11), true);
  assert.equal(isServiceDeletable({ date: "2026-10-15", status: "completed" }, nov11), true);
});

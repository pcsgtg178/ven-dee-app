import test from "node:test";
import assert from "node:assert/strict";
import { packsToUnits, formatOnHand, isLowStock, isNegativeStock, estimateFifoCost, isPackSizeUnset, sortStockMovements, resolveReceiveOccurredAt } from "../stock.ts";
import { isWithinGracePeriod, canEditMedicationUsage } from "../dateUtils.ts";
import type { StockLayer } from "../../types/vendee.ts";

test("packsToUnits converts packs * packSize accurately", () => {
  assert.equal(packsToUnits(2, 200), 400);
  assert.equal(packsToUnits(1.5, 100), 150);
  assert.equal(packsToUnits(0, 200), 0);
});

test("formatOnHand formats multi-unit packs and single-unit packs", () => {
  assert.equal(formatOnHand(230, "ยูนิต", 100, "ขวด"), "230 ยูนิต ≈ 2.3 ขวด");
  assert.equal(formatOnHand(5, "เข็ม", 1, "เข็ม"), "5 เข็ม");
});

test("isLowStock and isNegativeStock respect reorderPointPacks and zero threshold", () => {
  assert.equal(isLowStock({ stockOnHand: 150, reorderPointPacks: 1, packSize: 200 }), true);
  assert.equal(isLowStock({ stockOnHand: 200, reorderPointPacks: 1, packSize: 200 }), false);
  assert.equal(isLowStock({ stockOnHand: 0, reorderPointPacks: 0, packSize: 200 }), false);
  assert.equal(isLowStock({ stockOnHand: -10, reorderPointPacks: 1, packSize: 200 }), false);
  assert.equal(isNegativeStock({ stockOnHand: -10 }), true);
  assert.equal(isNegativeStock({ stockOnHand: 0 }), false);
});

test("estimateFifoCost consumes oldest layers first and falls back to refUnitCostSatang", () => {
  const layers: StockLayer[] = [
    {
      id: "l2",
      medicationId: "m1",
      receivedAt: "2026-11-02T00:00:00Z",
      qtyReceived: 200,
      qtyRemaining: 200,
      unitCostSatang: 2000,
    },
    {
      id: "l1",
      medicationId: "m1",
      receivedAt: "2026-11-01T00:00:00Z",
      qtyReceived: 200,
      qtyRemaining: 100,
      unitCostSatang: 1000,
    },
  ];

  // 150u: 100 * 1000 + 50 * 2000 = 200,000 satang (not estimated)
  const res1 = estimateFifoCost(layers, 150, 1500);
  assert.equal(res1.costSatang, 200000);
  assert.equal(res1.isEstimated, false);

  // 350u: 100*1000 + 200*2000 + 50*1500 = 575,000 satang (estimated)
  const res2 = estimateFifoCost(layers, 350, 1500);
  assert.equal(res2.costSatang, 575000);
  assert.equal(res2.isEstimated, true);

  // Spec 14.8: 100u@20 THB (2000 satang) + 100u@25 THB (2500 satang), use 150u -> 3,250 THB (325,000 satang)
  const specLayers: StockLayer[] = [
    {
      id: "spec-1",
      medicationId: "m-spec",
      receivedAt: "2026-11-01T08:00:00Z",
      qtyReceived: 100,
      qtyRemaining: 100,
      unitCostSatang: 2000,
    },
    {
      id: "spec-2",
      medicationId: "m-spec",
      receivedAt: "2026-11-02T08:00:00Z",
      qtyReceived: 100,
      qtyRemaining: 100,
      unitCostSatang: 2500,
    },
  ];
  const specRes = estimateFifoCost(specLayers, 150, 2500);
  assert.equal(specRes.costSatang, 325000);
  assert.equal(specRes.isEstimated, false);
});

test("isWithinGracePeriod and canEditMedicationUsage", () => {
  const today = new Date("2026-11-05T10:00:00+07:00");
  assert.equal(isWithinGracePeriod("2026-10-15", today), true);
  assert.equal(isWithinGracePeriod("2026-09-15", today), false);

  // After day 7 (Nov 10), previous month hospital shift grace period expires
  const afterCutoff = new Date("2026-11-10T10:00:00+07:00");
  assert.equal(isWithinGracePeriod("2026-10-15", afterCutoff), false);

  assert.equal(canEditMedicationUsage({ date: "2026-10-15", status: "completed" }, today), true);
  assert.equal(canEditMedicationUsage({ date: "2026-10-15", status: "cancelled" }, today), false);
});

test("isPackSizeUnset flags 1 pack = 1 unit only when purchase unit differs from usage unit", () => {
  // 1 กล่อง = 1 ยูนิต -> likely unconfigured
  assert.equal(isPackSizeUnset({ packSize: 1, unit: "ยูนิต", packUnit: "กล่อง" }), true);
  assert.equal(isPackSizeUnset({ packSize: undefined, unit: "ยูนิต", packUnit: "ขวด" }), true);
  // 1 กล่อง = 200 ยูนิต -> configured
  assert.equal(isPackSizeUnset({ packSize: 200, unit: "ยูนิต", packUnit: "กล่อง" }), false);
  // 1 เข็ม = 1 เข็ม -> valid same-unit setup
  assert.equal(isPackSizeUnset({ packSize: 1, unit: "เข็ม", packUnit: "เข็ม" }), false);
});

test("sortStockMovements orders chronologically (desc default, asc optional) with createdAt and id tie-breakers", () => {
  const input = [
    { id: "m-old", occurredAt: "2026-11-10T03:00:00Z", createdAt: "2026-11-15T08:00:00Z" },
    { id: "m-same-1", occurredAt: "2026-11-16T02:00:00Z", createdAt: "2026-11-16T11:46:00Z" },
    { id: "m-same-2", occurredAt: "2026-11-16T02:00:00Z", createdAt: "2026-11-16T12:03:00Z" },
    { id: "m-new", occurredAt: "2026-11-16T12:35:00Z", createdAt: "2026-11-16T12:35:00Z" },
  ];
  const originalOrder = input.map((i) => i.id);

  const desc = sortStockMovements(input, "desc");
  assert.deepEqual(
    desc.map((i) => i.id),
    ["m-new", "m-same-2", "m-same-1", "m-old"]
  );

  const asc = sortStockMovements(input, "asc");
  assert.deepEqual(
    asc.map((i) => i.id),
    ["m-old", "m-same-1", "m-same-2", "m-new"]
  );

  // Does not mutate input
  assert.deepEqual(
    input.map((i) => i.id),
    originalOrder
  );
});

test("resolveReceiveOccurredAt uses real timestamp for today (Bangkok) and 09:00+07:00 for backdated dates", () => {
  // 2026-11-16 19:35:00+07:00 -> 2026-11-16T12:35:00.000Z
  const now = new Date("2026-11-16T12:35:00.000Z");
  assert.equal(resolveReceiveOccurredAt("2026-11-16", now), "2026-11-16T12:35:00.000Z");
  assert.equal(resolveReceiveOccurredAt("", now), "2026-11-16T12:35:00.000Z");
  assert.equal(resolveReceiveOccurredAt("2026-11-15", now), "2026-11-15T09:00:00+07:00");
});

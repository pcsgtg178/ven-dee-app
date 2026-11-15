import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateNetRevenueSatang,
  getServicePricingBreakdownSatang,
  getServicePricingBreakdown,
  calculateNetProfitSatang,
  thbToSatang,
  satangToThb,
} from "../conflictEngine.ts";

test("1. Satang conversion for discounts (thbToSatang & satangToThb)", () => {
  assert.equal(thbToSatang(0), 0);
  assert.equal(thbToSatang(100), 10000);
  assert.equal(thbToSatang(150.5), 15050);
  assert.equal(satangToThb(10000), 100);
  assert.equal(satangToThb(15050), 150.5);
});

test("2. calculateNetRevenueSatang computes Net Revenue = serviceFee - discount with zero bound", () => {
  // 1,000 THB (100,000 Satang) - 100 THB (10,000 Satang) = 900 THB (90,000 Satang)
  assert.equal(calculateNetRevenueSatang(100000, 10000), 90000);

  // No discount
  assert.equal(calculateNetRevenueSatang(50000, 0), 50000);
  assert.equal(calculateNetRevenueSatang(50000), 50000);

  // Discount exceeding fee clamps to 0
  assert.equal(calculateNetRevenueSatang(50000, 60000), 0);
});

test("3. getServicePricingBreakdown handles services with or without discount in THB and Satang", () => {
  // Service with discount in THB
  const srv1 = { price: 1000, discount: 100 };
  const breakdown1 = getServicePricingBreakdown(srv1);
  assert.equal(breakdown1.grossFee, 1000);
  assert.equal(breakdown1.discount, 100);
  assert.equal(breakdown1.netRevenue, 900);
  assert.equal(breakdown1.hasDiscount, true);

  // Service with discountSatang
  const srv2 = { serviceFeeSatang: 150000, discountSatang: 20000 };
  const breakdown2 = getServicePricingBreakdown(srv2);
  assert.equal(breakdown2.grossFee, 1500);
  assert.equal(breakdown2.discount, 200);
  assert.equal(breakdown2.netRevenue, 1300);
  assert.equal(breakdown2.hasDiscount, true);

  // Service without discount
  const srv3 = { price: 800 };
  const breakdown3 = getServicePricingBreakdown(srv3);
  assert.equal(breakdown3.grossFee, 800);
  assert.equal(breakdown3.discount, 0);
  assert.equal(breakdown3.netRevenue, 800);
  assert.equal(breakdown3.hasDiscount, false);
});

test("4. calculateNetProfitSatang computes Net Profit = Net Revenue - Expenses", () => {
  // Net Revenue = 1,000 THB (100,000 Satang) - 100 THB discount (10,000 Satang) = 90,000 Satang
  // Expenses = 350 THB medication (35,000 Satang) + 50 THB travel (5,000 Satang) = 40,000 Satang
  // Net Profit = 90,000 - 40,000 = 50,000 Satang (500 THB)
  const netProfit = calculateNetProfitSatang(100000, 35000, 5000, 0, 10000);
  assert.equal(netProfit, 50000);
  assert.equal(satangToThb(netProfit), 500);

  // Without discount: Net Profit = 100,000 - 40,000 = 60,000 Satang
  assert.equal(calculateNetProfitSatang(100000, 35000, 5000, 0, 0), 60000);
});

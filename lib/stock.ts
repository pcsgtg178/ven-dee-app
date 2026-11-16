import type { Medications, StockLayer, StockMovement } from "../types/vendee";
import { getBangkokDateParts } from "./dateUtils.ts";

/**
 * Converts pack count to usage units (e.g. 2 bottles × 200u = 400u).
 */
export function packsToUnits(packs: number, packSize: number): number {
  const p = Number(packs) || 0;
  const s = Number(packSize) || 1;
  if (p <= 0 || s <= 0) return 0;
  return Number((p * s).toFixed(4));
}

/**
 * Formats stock on hand in usage units plus approximate pack count when packSize > 1.
 * Example: formatOnHand(230, "ยูนิต", 100, "ขวด") -> "230 ยูนิต ≈ 2.3 ขวด"
 */
export function formatOnHand(
  onHand: number,
  unit = "ยูนิต",
  packSize = 1,
  packUnit = "ขวด"
): string {
  const qty = Number(onHand) || 0;
  const formattedQty = Number.isInteger(qty)
    ? qty.toLocaleString()
    : Number(qty.toFixed(2)).toLocaleString();

  const size = Number(packSize) || 1;
  if (size <= 1) {
    return `${formattedQty} ${unit}`;
  }

  const approxPacks = Number((qty / size).toFixed(2));
  return `${formattedQty} ${unit} ≈ ${approxPacks} ${packUnit || "ขวด"}`;
}

/**
 * Returns true when stock is strictly below the reorder threshold (and reorderPointPacks > 0).
 */
export function isLowStock(
  med: Pick<Medications, "stockOnHand" | "reorderPointPacks" | "packSize">
): boolean {
  const reorderPacks = Number(med.reorderPointPacks ?? 1);
  if (reorderPacks <= 0) return false;
  const packSize = Math.max(1, Number(med.packSize ?? 1));
  const onHand = Number(med.stockOnHand ?? 0);
  return onHand >= 0 && onHand < reorderPacks * packSize;
}

/**
 * Returns true when stock on hand is negative (< 0).
 */
export function isNegativeStock(med: Pick<Medications, "stockOnHand">): boolean {
  return Number(med.stockOnHand ?? 0) < 0;
}

/**
 * Returns true when the pack size looks unconfigured: 1 pack = 1 usage unit while the
 * purchase unit differs from the usage unit (e.g. "1 ขวด = 1 ยูนิต").
 * Same-unit setups (e.g. "1 เข็ม = 1 เข็ม") are considered valid.
 */
export function isPackSizeUnset(
  med: Pick<Medications, "packSize" | "unit" | "packUnit">
): boolean {
  const size = Number(med.packSize ?? 1);
  if (Number.isFinite(size) && size > 1) return false;
  const unit = (med.unit || "ยูนิต").trim();
  const packUnit = (med.packUnit || "ขวด").trim();
  return unit !== packUnit;
}

/**
 * Estimates FIFO cost in Satang from remaining layers, falling back to refUnitCostSatang
 * for any quantity exceeding available layers (D17).
 */
export function estimateFifoCost(
  layers: StockLayer[],
  qty: number,
  refUnitCostSatang = 0
): { costSatang: number; unitCostSatang: number; isEstimated: boolean } {
  const needed = Math.max(0, Number(qty) || 0);
  if (needed === 0) {
    return { costSatang: 0, unitCostSatang: 0, isEstimated: false };
  }

  const sorted = [...layers]
    .filter((l) => Number(l.qtyRemaining) > 0)
    .sort((a, b) => {
      const tDiff = new Date(a.receivedAt).getTime() - new Date(b.receivedAt).getTime();
      if (tDiff !== 0) return tDiff;
      return String(a.id).localeCompare(String(b.id));
    });

  let remaining = needed;
  let totalCost = 0;
  let isEstimated = false;

  for (const layer of sorted) {
    if (remaining <= 0) break;
    const avail = Number(layer.qtyRemaining) || 0;
    const take = Math.min(remaining, avail);
    totalCost += Math.round(take * (Number(layer.unitCostSatang) || 0));
    remaining -= take;
  }

  if (remaining > 0) {
    isEstimated = true;
    totalCost += Math.round(remaining * Math.max(0, Number(refUnitCostSatang) || 0));
  }

  return {
    costSatang: Math.round(totalCost),
    unitCostSatang: Math.round(totalCost / needed),
    isEstimated,
  };
}

export type StockHistorySortOrder = "desc" | "asc";

/**
 * Sorts stock movements chronologically by occurredAt, breaking ties by createdAt then id.
 */
export function sortStockMovements<
  T extends Pick<StockMovement, "id" | "occurredAt" | "createdAt">
>(movements: T[], order: StockHistorySortOrder = "desc"): T[] {
  const dir = order === "asc" ? 1 : -1;
  return [...movements].sort((a, b) => {
    const occA = Date.parse(a.occurredAt || "") || 0;
    const occB = Date.parse(b.occurredAt || "") || 0;
    if (occA !== occB) return (occA - occB) * dir;

    const crtA = Date.parse(a.createdAt || "") || 0;
    const crtB = Date.parse(b.createdAt || "") || 0;
    if (crtA !== crtB) return (crtA - crtB) * dir;

    return String(a.id).localeCompare(String(b.id)) * dir;
  });
}

/**
 * Resolves the occurredAt timestamp when receiving stock.
 * If the chosen date is today (Asia/Bangkok) or empty, uses the real current timestamp
 * so same-day movements stay in true chronological order; backdated entries default to 09:00 Bangkok time.
 */
export function resolveReceiveOccurredAt(dateStr?: string, now: Date = new Date()): string {
  const todayStr = getBangkokDateParts(now).dateStr;
  if (!dateStr || dateStr === todayStr) {
    return now.toISOString();
  }
  return `${dateStr}T09:00:00+07:00`;
}

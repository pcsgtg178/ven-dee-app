"use server";

import { createClient } from "../../lib/supabase/server";
import type {
  ActionResult,
  StockIssueReason,
  StockLayer,
  StockMovement,
  StockMovementType,
  StockWarning,
} from "../../types/vendee";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function ensureUuid(id: string): ActionResult<never> | null {
  if (!UUID_RE.test(id || "")) {
    return {
      success: false,
      error: {
        code: "LOCAL_ONLY_MEDICATION",
        message: "กรุณาซิงค์ตัวยานี้กับฐานข้อมูลก่อนจัดการสต็อก (ต้องมี UUID ในระบบ)",
      },
    };
  }
  return null;
}

function parseRpcError(err: { message?: string; code?: string }): { code: string; message: string } {
  const raw = err?.message || "เกิดข้อผิดพลาดในการจัดการสต็อก";
  const match = raw.match(/^([A-Z0-9_]+):\s*(.+)$/);
  if (match) {
    return { code: match[1], message: match[2] };
  }
  return { code: err?.code || "STOCK_RPC_ERROR", message: raw };
}

function mapRowToMovement(row: any): StockMovement {
  return {
    id: row.id,
    medicationId: row.medication_id,
    type: row.type as StockMovementType,
    quantity: Number(row.quantity) || 0,
    costSatang: Number(row.cost_satang) || 0,
    isEstimatedCost: Boolean(row.is_estimated_cost),
    packs: row.packs !== null && row.packs !== undefined ? Number(row.packs) : null,
    packCostSatang:
      row.pack_cost_satang !== null && row.pack_cost_satang !== undefined
        ? Number(row.pack_cost_satang)
        : null,
    supplier: row.supplier || null,
    reason: (row.reason as StockIssueReason) || null,
    serviceId: row.service_id || null,
    reversesMovementId: row.reverses_movement_id || null,
    reversed: Boolean(row.reversed),
    occurredAt: row.occurred_at,
    note: row.note || null,
    createdAt: row.created_at,
  };
}

function mapRowToLayer(row: any): StockLayer {
  return {
    id: row.id,
    medicationId: row.medication_id,
    receiveMovementId: row.receive_movement_id || null,
    receivedAt: row.received_at,
    qtyReceived: Number(row.qty_received) || 0,
    qtyRemaining: Number(row.qty_remaining) || 0,
    unitCostSatang: Number(row.unit_cost_satang) || 0,
    createdAt: row.created_at,
  };
}

export async function receiveStockAction(input: {
  medId: string;
  packs: number;
  packCostSatang: number;
  supplier?: string;
  occurredAt?: string;
  note?: string;
}): Promise<ActionResult<{ movementId: string; layerId: string; quantity: number; costSatang: number; stockOnHand: number }>> {
  const invalid = ensureUuid(input.medId);
  if (invalid) return invalid;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("receive_stock", {
      p_med_id: input.medId,
      p_packs: input.packs,
      p_pack_cost_satang: input.packCostSatang,
      p_supplier: input.supplier ?? null,
      p_occurred_at: input.occurredAt ?? new Date().toISOString(),
      p_note: input.note ?? null,
    });
    if (error) {
      return { success: false, error: parseRpcError(error) };
    }
    return {
      success: true,
      data: {
        movementId: data.movement_id,
        layerId: data.layer_id,
        quantity: Number(data.quantity) || 0,
        costSatang: Number(data.cost_satang) || 0,
        stockOnHand: Number(data.stock_on_hand) || 0,
      },
      warnings: (data.warnings as StockWarning[]) || [],
    };
  } catch (err: any) {
    return { success: false, error: { code: "UNKNOWN_ERROR", message: err.message || "Unexpected error" } };
  }
}

export async function issueStockAction(input: {
  medId: string;
  qty: number;
  type: "waste" | "giveaway";
  reason?: StockIssueReason;
  note?: string;
  occurredAt?: string;
}): Promise<ActionResult<{ movementId: string; quantity: number; costSatang: number; isEstimatedCost: boolean; stockOnHand: number }>> {
  const invalid = ensureUuid(input.medId);
  if (invalid) return invalid;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("issue_stock", {
      p_med_id: input.medId,
      p_qty: input.qty,
      p_type: input.type,
      p_reason: input.reason ?? "other",
      p_note: input.note ?? null,
      p_occurred_at: input.occurredAt ?? new Date().toISOString(),
    });
    if (error) {
      return { success: false, error: parseRpcError(error) };
    }
    return {
      success: true,
      data: {
        movementId: data.movement_id,
        quantity: Number(data.quantity) || 0,
        costSatang: Number(data.cost_satang) || 0,
        isEstimatedCost: Boolean(data.is_estimated_cost),
        stockOnHand: Number(data.stock_on_hand) || 0,
      },
      warnings: (data.warnings as StockWarning[]) || [],
    };
  } catch (err: any) {
    return { success: false, error: { code: "UNKNOWN_ERROR", message: err.message || "Unexpected error" } };
  }
}

export async function adjustStockToCountAction(input: {
  medId: string;
  countedQty: number;
  note?: string;
  occurredAt?: string;
}): Promise<ActionResult<{ changed: boolean; movementId?: string; diff?: number; costSatang?: number; stockOnHand: number }>> {
  const invalid = ensureUuid(input.medId);
  if (invalid) return invalid;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("adjust_stock_to_count", {
      p_med_id: input.medId,
      p_counted_qty: input.countedQty,
      p_note: input.note ?? null,
      p_occurred_at: input.occurredAt ?? new Date().toISOString(),
    });
    if (error) {
      return { success: false, error: parseRpcError(error) };
    }
    return {
      success: true,
      data: {
        changed: Boolean(data.changed),
        movementId: data.movement_id,
        diff: data.diff !== undefined ? Number(data.diff) : undefined,
        costSatang: data.cost_satang !== undefined ? Number(data.cost_satang) : undefined,
        stockOnHand: Number(data.stock_on_hand) || 0,
      },
      warnings: (data.warnings as StockWarning[]) || [],
    };
  } catch (err: any) {
    return { success: false, error: { code: "UNKNOWN_ERROR", message: err.message || "Unexpected error" } };
  }
}

export async function reverseStockMovementAction(
  movementId: string,
  note?: string
): Promise<ActionResult<{ reversedMovementId: string; reversalMovementId: string; stockOnHand: number }>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("reverse_stock_movement", {
      p_movement_id: movementId,
      p_note: note ?? null,
    });
    if (error) {
      return { success: false, error: parseRpcError(error) };
    }
    return {
      success: true,
      data: {
        reversedMovementId: data.reversed_movement_id,
        reversalMovementId: data.reversal_movement_id,
        stockOnHand: Number(data.stock_on_hand) || 0,
      },
    };
  } catch (err: any) {
    return { success: false, error: { code: "UNKNOWN_ERROR", message: err.message || "Unexpected error" } };
  }
}

export async function getStockMovementsAction(
  medId?: string,
  range?: { from?: string; to?: string; limit?: number }
): Promise<ActionResult<StockMovement[]>> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("stock_movements")
      .select("*")
      .order("occurred_at", { ascending: false })
      .order("created_at", { ascending: false });

    if (medId) {
      query = query.eq("medication_id", medId);
    }
    if (range?.from) {
      query = query.gte("occurred_at", range.from);
    }
    if (range?.to) {
      query = query.lte("occurred_at", range.to);
    }
    query = query.limit(range?.limit ?? 200);

    const { data, error } = await query;
    if (error) {
      return { success: false, error: parseRpcError(error) };
    }
    return {
      success: true,
      data: (data || []).map(mapRowToMovement),
    };
  } catch (err: any) {
    return { success: false, error: { code: "UNKNOWN_ERROR", message: err.message || "Unexpected error" } };
  }
}

export async function getStockLayersAction(medId?: string): Promise<ActionResult<StockLayer[]>> {
  try {
    const supabase = await createClient();
    let query = supabase
      .from("stock_layers")
      .select("*")
      .gt("qty_remaining", 0)
      .order("received_at", { ascending: true })
      .order("created_at", { ascending: true });

    if (medId) {
      query = query.eq("medication_id", medId);
    }

    const { data, error } = await query;
    if (error) {
      return { success: false, error: parseRpcError(error) };
    }
    return {
      success: true,
      data: (data || []).map(mapRowToLayer),
    };
  } catch (err: any) {
    return { success: false, error: { code: "UNKNOWN_ERROR", message: err.message || "Unexpected error" } };
  }
}

export interface StockSummaryData {
  inventoryValueSatang: number;
  lowStockCount: number;
  negativeStockCount: number;
  receivedCostSatang: number;
  usedCostSatang: number;
  wasteCostSatang: number;
  giveawayCostSatang: number;
}

export async function getStockSummaryAction(range?: {
  from?: string;
  to?: string;
}): Promise<ActionResult<StockSummaryData>> {
  try {
    const supabase = await createClient();

    const [{ data: meds, error: medsErr }, { data: layers, error: layersErr }] = await Promise.all([
      supabase.from("medications").select("id, pack_size, stock_on_hand, reorder_point_packs, is_archived"),
      supabase.from("stock_layers").select("qty_remaining, unit_cost_satang").gt("qty_remaining", 0),
    ]);

    if (medsErr) return { success: false, error: parseRpcError(medsErr) };
    if (layersErr) return { success: false, error: parseRpcError(layersErr) };

    let movQuery = supabase
      .from("stock_movements")
      .select("type, cost_satang, reversed")
      .eq("reversed", false);

    if (range?.from) movQuery = movQuery.gte("occurred_at", range.from);
    if (range?.to) movQuery = movQuery.lte("occurred_at", range.to);

    const { data: movements, error: movErr } = await movQuery;
    if (movErr) return { success: false, error: parseRpcError(movErr) };

    const inventoryValueSatang = (layers || []).reduce(
      (sum, l) => sum + Math.round((Number(l.qty_remaining) || 0) * (Number(l.unit_cost_satang) || 0)),
      0
    );

    let lowStockCount = 0;
    let negativeStockCount = 0;
    for (const m of meds || []) {
      if (m.is_archived) continue;
      const onHand = Number(m.stock_on_hand) || 0;
      const packSize = Math.max(1, Number(m.pack_size) || 1);
      const reorder = Number(m.reorder_point_packs ?? 1);
      if (onHand < 0) {
        negativeStockCount++;
      } else if (reorder > 0 && onHand < reorder * packSize) {
        lowStockCount++;
      }
    }

    let receivedCostSatang = 0;
    let usedCostSatang = 0;
    let wasteCostSatang = 0;
    let giveawayCostSatang = 0;
    for (const mv of movements || []) {
      const cost = Number(mv.cost_satang) || 0;
      if (mv.type === "receive") receivedCostSatang += cost;
      else if (mv.type === "use") usedCostSatang += cost;
      else if (mv.type === "waste") wasteCostSatang += cost;
      else if (mv.type === "giveaway") giveawayCostSatang += cost;
    }

    return {
      success: true,
      data: {
        inventoryValueSatang,
        lowStockCount,
        negativeStockCount,
        receivedCostSatang,
        usedCostSatang,
        wasteCostSatang,
        giveawayCostSatang,
      },
    };
  } catch (err: any) {
    return { success: false, error: { code: "UNKNOWN_ERROR", message: err.message || "Unexpected error" } };
  }
}

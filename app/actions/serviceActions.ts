"use server";

import { createClient } from "../../lib/supabase/server";
import { CustomerServiceRecord, ServiceType, ActionResult, MedicationUsageLine, StockWarning } from "../../types/vendee";
import {
  checkServiceShiftOverlap,
  calculateMedicationCostSatang,
  calculateMedicationLineCostSatang,
  thbToSatang,
  satangToThb,
} from "../../lib/conflictEngine";
import {
  isDateInPast,
  isServiceDateWithinGracePeriod,
  isServiceEditable,
  isServiceDeletable,
} from "../../lib/dateUtils";
import { getShiftsAction } from "./shiftActions";

/** Sanitize usage lines and recompute line cost server-side (never trust client totals). */
function normalizeUsages(usages?: MedicationUsageLine[]): MedicationUsageLine[] {
  return (usages || [])
    .filter((u) => u && u.medicationId && Number(u.quantity) > 0)
    .map((u) => ({
      medicationId: u.medicationId,
      name: u.name,
      category: u.category,
      quantity: Number(u.quantity),
      unit: u.unit || "",
      unitCostSatang: Number(u.unitCostSatang) || 0,
      lineCostSatang: calculateMedicationLineCostSatang(Number(u.quantity), Number(u.unitCostSatang) || 0),
    }));
}

function parseUsages(raw: any): MedicationUsageLine[] {
  return Array.isArray(raw) ? (raw as MedicationUsageLine[]) : [];
}

function mapRowToServiceRecord(row: any, fallbackTime = "09:00"): CustomerServiceRecord {
  const rawDiscount = row.discount !== undefined && row.discount !== null ? Number(row.discount) : undefined;
  const rawDiscountSatang =
    row.discount_satang !== undefined && row.discount_satang !== null ? Number(row.discount_satang) : undefined;

  const discountSatang =
    rawDiscountSatang !== undefined && Number.isFinite(rawDiscountSatang)
      ? Math.max(0, Math.round(rawDiscountSatang))
      : thbToSatang(Math.max(0, rawDiscount ?? 0));
  const discountThb =
    rawDiscount !== undefined && Number.isFinite(rawDiscount) && (rawDiscount > 0 || discountSatang === 0)
      ? Math.max(0, rawDiscount)
      : satangToThb(discountSatang);

  return {
    id: row.id,
    type: "service",
    customerId: row.customer_id || "",
    customerName: row.customer_name,
    date: row.service_date,
    time: (row.service_time || fallbackTime).slice(0, 5),
    services: (row.services || ["injection"]) as ServiceType[],
    otherServiceText: row.other_service_text || "",
    medications: Array.isArray(row.medications) ? row.medications.filter(Boolean) : [],
    medicationUsages: parseUsages(row.medication_usages),
    note: row.note || "",
    price: row.price || 0,
    serviceFeeSatang: row.service_fee_satang || 0,
    discount: discountThb,
    discountSatang,
    medicationCostSatang: row.medication_cost_satang || 0,
    medicationCostSatangLegacy:
      row.medication_cost_satang_legacy !== undefined && row.medication_cost_satang_legacy !== null
        ? Number(row.medication_cost_satang_legacy)
        : undefined,
    durationHours: row.duration_hours,
    travelExpenseSatang: row.travel_expense_satang || 0,
    otherExpensesSatang: row.other_expenses_satang || 0,
    status: row.status || "upcoming",
    stockConsumed: Boolean(row.stock_consumed),
    autoCompleteOptOut: Boolean(row.auto_complete_opt_out),
    createdAt: row.created_at,
  };
}

/**
 * Fetch all customer services
 */
export async function getServicesAction(params?: {
  date?: string;
  customerId?: string;
  month?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ActionResult<CustomerServiceRecord[]>> {
  try {
    const supabase = await createClient();
    let query = supabase.from("customer_services").select("*");

    if (params?.date) query = query.eq("service_date", params.date);
    if (params?.customerId) query = query.eq("customer_id", params.customerId);
    if (params?.startDate && params?.endDate) {
      query = query.gte("service_date", params.startDate).lte("service_date", params.endDate);
    } else if (params?.month) {
      query = query
        .gte("service_date", `${params.month}-01`)
        .lte("service_date", `${params.month}-31`);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    const services: CustomerServiceRecord[] = (data || []).map((row: any) => mapRowToServiceRecord(row));

    return { success: true, data: services };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to fetch services" },
    };
  }
}

/**
 * Create a new customer service with shift conflict check and Satang financial calculations
 */
export async function createServiceAction(data: {
  customerId?: string;
  customerName: string;
  date: string;
  time: string;
  services: ServiceType[];
  otherServiceText?: string;
  medications?: string[];
  medicationUsages?: MedicationUsageLine[];
  note?: string;
  price?: number; // In THB from UI
  discount?: number; // In THB from UI
  medicationCost?: number; // In THB from UI
  durationHours?: number;
  travelExpense?: number; // In THB from UI
  otherExpenses?: number; // In THB from UI
  status?: "upcoming" | "completed" | "cancelled";
}): Promise<ActionResult<CustomerServiceRecord>> {
  try {
    const supabase = await createClient();

    // Fetch shifts to validate blocking windows
    const shiftsRes = await getShiftsAction({ startDate: data.date, endDate: data.date });
    const existingShifts = shiftsRes.success ? shiftsRes.data : [];

    // Invariant Check 2: Shift Blocking Window Validation
    const overlapCheck = checkServiceShiftOverlap(data.date, data.time, existingShifts);
    if (overlapCheck.hasConflict) {
      return {
        success: false,
        error: {
          code: overlapCheck.code!,
          message: overlapCheck.message!,
        },
      };
    }

    // Satang Financial Ledger Standard Conversions
    const priceThb = Math.max(0, Number(data.price) || 0);
    const serviceFeeSatang = thbToSatang(priceThb);
    const discountThb = Math.max(0, Number(data.discount) || 0);
    const discountSatang = thbToSatang(discountThb);
    const usages = normalizeUsages(data.medicationUsages);
    const medicationCostSatang =
      usages.length > 0 ? calculateMedicationCostSatang(usages) : thbToSatang(data.medicationCost || 0);
    const travelExpenseSatang = thbToSatang(data.travelExpense || 0);
    const otherExpensesSatang = thbToSatang(data.otherExpenses || 0);

    const formattedTime = (data.time || "09:00").slice(0, 5);

    const insertPayload: Record<string, any> = {
      customer_id: data.customerId || null,
      customer_name: data.customerName,
      service_date: data.date,
      service_time: `${formattedTime}:00`,
      services: data.services,
      other_service_text: data.otherServiceText || "",
      medications: (data.medications || []).map((m) => m.trim()).filter(Boolean),
      note: data.note || "",
      price: priceThb,
      service_fee_satang: serviceFeeSatang,
      discount: discountThb,
      discount_satang: discountSatang,
      medication_cost_satang: medicationCostSatang,
      duration_hours: data.durationHours || null,
      travel_expense_satang: travelExpenseSatang,
      other_expenses_satang: otherExpensesSatang,
      ...(usages.length > 0 ? { medication_usages: usages } : {}),
      status: data.status || "upcoming",
    };

    let { data: inserted, error } = await supabase
      .from("customer_services")
      .insert(insertPayload)
      .select()
      .single();

    // Fallback if optional migration columns (discount / medication_usages) are not applied yet
    if (error && /(discount|medication_usages)/i.test(error.message || "")) {
      const legacyPayload = { ...insertPayload };
      if (/discount/i.test(error.message || "")) {
        delete legacyPayload.discount;
        delete legacyPayload.discount_satang;
      }
      if (/medication_usages/i.test(error.message || "")) {
        delete legacyPayload.medication_usages;
      }
      ({ data: inserted, error } = await supabase
        .from("customer_services")
        .insert(legacyPayload)
        .select()
        .single());
    }

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    let serviceRecord = mapRowToServiceRecord(inserted, formattedTime);
    let warnings: StockWarning[] = [];

    if (serviceRecord.status === "completed") {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("consume_stock_for_service", {
        p_service_id: serviceRecord.id,
      });
      if (!rpcErr && rpcData) {
        warnings = (rpcData.warnings as StockWarning[]) || [];
        const { data: refreshed } = await supabase
          .from("customer_services")
          .select("*")
          .eq("id", serviceRecord.id)
          .single();
        if (refreshed) {
          serviceRecord = mapRowToServiceRecord(refreshed, formattedTime);
        }
      }
    }

    return {
      success: true,
      data: serviceRecord,
      warnings,
      message: "บันทึกการให้บริการเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to create service" },
    };
  }
}

/**
 * Update existing customer service details without creating duplicates
 */
export async function updateServiceAction(
  id: string,
  data: {
    customerId?: string;
    customerName: string;
    date: string;
    time: string;
    services?: ServiceType[];
    otherServiceText?: string;
    medications?: string[];
    medicationUsages?: MedicationUsageLine[];
    note?: string;
    price?: number;
    discount?: number;
    medicationCost?: number;
    durationHours?: number;
    travelExpense?: number;
    otherExpenses?: number;
    status?: "upcoming" | "completed" | "cancelled";
  }
): Promise<ActionResult<CustomerServiceRecord>> {
  try {
    const supabase = await createClient();

    // Fetch existing record to enforce status & 1-calendar-month retroactive lock (DOMAIN_RULES.md §3.6)
    const { data: existingRow, error: fetchError } = await supabase
      .from("customer_services")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !existingRow) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลบริการที่ต้องการแก้ไข" },
      };
    }

    if (!isServiceEditable({ date: existingRow.service_date, status: existingRow.status })) {
      return {
        success: false,
        error: {
          code: "SERVICE_IS_LOCKED",
          message:
            existingRow.status === "cancelled"
              ? "ไม่สามารถแก้ไขบริการที่ถูกยกเลิกแล้วได้"
              : "ไม่สามารถแก้ไขบริการย้อนหลังที่เกินระยะเวลา 1 เดือนปฏิทินได้",
        },
      };
    }

    if (isDateInPast(data.date) && !isServiceDateWithinGracePeriod(data.date)) {
      return {
        success: false,
        error: {
          code: "SERVICE_IS_LOCKED",
          message: "ไม่สามารถย้ายวันที่บริการไปเกินระยะเวลาย้อนหลัง 1 เดือนปฏิทินได้",
        },
      };
    }

    const formattedTime = (data.time || "09:00").slice(0, 5);

    // Validate blocking windows against active shifts on target date
    const shiftsRes = await getShiftsAction({ startDate: data.date, endDate: data.date });
    const existingShifts = shiftsRes.success ? shiftsRes.data : [];
    const overlapCheck = checkServiceShiftOverlap(data.date, formattedTime, existingShifts);
    if (overlapCheck.hasConflict) {
      return {
        success: false,
        error: {
          code: overlapCheck.code!,
          message: overlapCheck.message!,
        },
      };
    }

    const priceThb = Math.max(0, Number(data.price) || 0);
    const serviceFeeSatang = thbToSatang(priceThb);
    // Medication usage lines (when provided) are the source of truth for medicationCost.
    // Never overwrite a legacy manual cost when neither usages nor medicationCost are supplied.
    const usages = data.medicationUsages !== undefined ? normalizeUsages(data.medicationUsages) : undefined;
    const medicationCostSatang: number | undefined =
      usages && usages.length > 0
        ? calculateMedicationCostSatang(usages)
        : data.medicationCost !== undefined
          ? thbToSatang(data.medicationCost)
          : usages !== undefined
            ? 0
            : undefined;

    const updatePayload: Record<string, any> = {
      customer_id: data.customerId !== undefined ? data.customerId || null : existingRow.customer_id,
      customer_name: data.customerName,
      service_date: data.date,
      service_time: `${formattedTime}:00`,
      other_service_text:
        data.otherServiceText !== undefined ? data.otherServiceText || "" : existingRow.other_service_text || "",
      medications:
        data.medications !== undefined
          ? (data.medications || []).map((m) => m.trim()).filter(Boolean)
          : existingRow.medications,
      note: data.note || "",
      price: priceThb,
      service_fee_satang: serviceFeeSatang,
    };
    if (data.discount !== undefined) {
      const discountThb = Math.max(0, Number(data.discount) || 0);
      updatePayload.discount = discountThb;
      updatePayload.discount_satang = thbToSatang(discountThb);
    }
    if (data.durationHours !== undefined) {
      updatePayload.duration_hours = data.durationHours || null;
    }
    if (data.travelExpense !== undefined) {
      updatePayload.travel_expense_satang = thbToSatang(data.travelExpense);
    }
    if (data.otherExpenses !== undefined) {
      updatePayload.other_expenses_satang = thbToSatang(data.otherExpenses);
    }
    if (data.status !== undefined) {
      updatePayload.status = data.status;
    }
    if (medicationCostSatang !== undefined) {
      updatePayload.medication_cost_satang = medicationCostSatang;
    }
    if (usages !== undefined) {
      updatePayload.medication_usages = usages;
    }
    if (data.services && data.services.length > 0) {
      updatePayload.services = data.services;
    }

    let { data: updated, error } = await supabase
      .from("customer_services")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    // Fallback: migration 20261018 (medication_usages) or discount not applied yet
    if (error && /(medication_usages|discount)/i.test(error.message || "")) {
      const legacyPayload = { ...updatePayload };
      if (/medication_usages/i.test(error.message || "")) {
        delete legacyPayload.medication_usages;
      }
      if (/discount/i.test(error.message || "")) {
        delete legacyPayload.discount;
        delete legacyPayload.discount_satang;
      }
      ({ data: updated, error } = await supabase
        .from("customer_services")
        .update(legacyPayload)
        .eq("id", id)
        .select()
        .single());
    }

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    let serviceRecord = mapRowToServiceRecord(updated, formattedTime);
    let warnings: StockWarning[] = [];

    const nextStatus = data.status ?? existingRow.status ?? "upcoming";
    const wasConsumed = Boolean(existingRow.stock_consumed);

    if (wasConsumed && (nextStatus === "upcoming" || nextStatus === "cancelled")) {
      await supabase.rpc("restore_stock_for_service", { p_service_id: id });
      if (nextStatus === "upcoming") {
        await supabase
          .from("customer_services")
          .update({ auto_complete_opt_out: true })
          .eq("id", id);
      }
      const { data: refreshed } = await supabase
        .from("customer_services")
        .select("*")
        .eq("id", id)
        .single();
      if (refreshed) serviceRecord = mapRowToServiceRecord(refreshed, formattedTime);
    } else if (wasConsumed && nextStatus === "completed" && usages !== undefined) {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("reconsume_stock_for_service", {
        p_service_id: id,
        p_new_usages: usages,
      });
      if (!rpcErr && rpcData) {
        warnings = (rpcData.warnings as StockWarning[]) || [];
        const { data: refreshed } = await supabase
          .from("customer_services")
          .select("*")
          .eq("id", id)
          .single();
        if (refreshed) serviceRecord = mapRowToServiceRecord(refreshed, formattedTime);
      }
    } else if (!wasConsumed && nextStatus === "completed") {
      const { data: rpcData, error: rpcErr } = await supabase.rpc("consume_stock_for_service", {
        p_service_id: id,
      });
      if (!rpcErr && rpcData) {
        warnings = (rpcData.warnings as StockWarning[]) || [];
        const { data: refreshed } = await supabase
          .from("customer_services")
          .select("*")
          .eq("id", id)
          .single();
        if (refreshed) serviceRecord = mapRowToServiceRecord(refreshed, formattedTime);
      }
    }

    return {
      success: true,
      data: serviceRecord,
      warnings,
      message: "อัปเดตข้อมูลบริการเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to update service" },
    };
  }
}

/**
 * Update service status
 */
export async function updateServiceStatusAction(
  id: string,
  status: "upcoming" | "completed" | "cancelled"
): Promise<ActionResult<{ updatedId: string; status: string }>> {
  try {
    const supabase = await createClient();

    const { data: existingRow, error: fetchError } = await supabase
      .from("customer_services")
      .select("id, service_date, status, stock_consumed")
      .eq("id", id)
      .single();

    if (fetchError || !existingRow) {
      return { success: false, error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลบริการที่ต้องการอัปเดตสถานะ" } };
    }

    if (isDateInPast(existingRow.service_date) && !isServiceDateWithinGracePeriod(existingRow.service_date)) {
      return {
        success: false,
        error: {
          code: "SERVICE_IS_LOCKED",
          message: "ไม่สามารถเปลี่ยนสถานะบริการย้อนหลังที่เกินระยะเวลา 1 เดือนปฏิทินได้",
        },
      };
    }

    const wasConsumed = Boolean(existingRow.stock_consumed);
    let warnings: StockWarning[] = [];

    if (wasConsumed && (status === "upcoming" || status === "cancelled")) {
      const { error: restoreErr } = await supabase.rpc("restore_stock_for_service", {
        p_service_id: id,
      });
      if (restoreErr) {
        return { success: false, error: { code: "STOCK_RPC_ERROR", message: restoreErr.message } };
      }
    }

    const updateFields: Record<string, any> = { status };
    if (status === "upcoming" && existingRow.status === "completed") {
      updateFields.auto_complete_opt_out = true;
    } else if (status === "completed") {
      updateFields.auto_complete_opt_out = false;
    }

    const { error } = await supabase
      .from("customer_services")
      .update(updateFields)
      .eq("id", id);

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    if (status === "completed" && !wasConsumed) {
      const { data: rpcData, error: consumeErr } = await supabase.rpc("consume_stock_for_service", {
        p_service_id: id,
      });
      if (!consumeErr && rpcData) {
        warnings = (rpcData.warnings as StockWarning[]) || [];
      }
    }

    return {
      success: true,
      data: { updatedId: id, status },
      warnings,
      message: "อัปเดตสถานะบริการเรียบร้อยแล้ว",
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to update service status";
    return {
      success: false,
      error: { code: "SERVER_ERROR", message },
    };
  }
}

/**
 * Delete customer service
 */
export async function deleteServiceAction(id: string): Promise<ActionResult<{ deletedId: string }>> {
  try {
    const supabase = await createClient();

    const { data: existingRow, error: fetchError } = await supabase
      .from("customer_services")
      .select("id, service_date, stock_consumed")
      .eq("id", id)
      .single();

    if (fetchError || !existingRow) {
      return { success: false, error: { code: "NOT_FOUND", message: "ไม่พบข้อมูลบริการที่ต้องการลบ" } };
    }

    if (!isServiceDeletable({ date: existingRow.service_date })) {
      return {
        success: false,
        error: {
          code: "SERVICE_IS_LOCKED",
          message: "ไม่สามารถลบบริการย้อนหลังที่เกินระยะเวลา 1 เดือนปฏิทินได้",
        },
      };
    }

    if (existingRow.stock_consumed) {
      const { error: restoreErr } = await supabase.rpc("restore_stock_for_service", {
        p_service_id: id,
      });
      if (restoreErr) {
        return { success: false, error: { code: "STOCK_RPC_ERROR", message: restoreErr.message } };
      }
    }

    const { error } = await supabase.from("customer_services").delete().eq("id", id);

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    return { success: true, data: { deletedId: id }, message: "ลบนัดหมายบริการเรียบร้อยแล้ว" };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to delete service";
    return {
      success: false,
      error: { code: "SERVER_ERROR", message },
    };
  }
}

/**
 * Delete all services for a specific customer (cascade delete on customer deletion)
 */
export async function deleteServicesByCustomerIdAction(
  customerId: string
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    const supabase = await createClient();

    const { data: consumedRows } = await supabase
      .from("customer_services")
      .select("id")
      .eq("customer_id", customerId)
      .eq("stock_consumed", true);

    for (const row of consumedRows || []) {
      await supabase.rpc("restore_stock_for_service", { p_service_id: row.id });
    }

    const { data, error } = await supabase
      .from("customer_services")
      .delete()
      .eq("customer_id", customerId)
      .select("id");

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    return {
      success: true,
      data: { deletedCount: data?.length || 0 },
      message: "ลบประวัติบริการของลูกค้าเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to delete customer services" },
    };
  }
}

/**
 * Auto-complete all due upcoming services (Asia/Bangkok) and consume FIFO stock
 */
export async function autoCompleteDueServicesAction(
  nowIso?: string
): Promise<ActionResult<{ completedCount: number; completedIds: string[] }>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("complete_due_services", {
      p_now: nowIso || new Date().toISOString(),
    });
    if (error) {
      return { success: false, error: { code: "STOCK_RPC_ERROR", message: error.message } };
    }
    return {
      success: true,
      data: {
        completedCount: Number(data?.completed_count) || 0,
        completedIds: Array.isArray(data?.completed_ids) ? data.completed_ids : [],
      },
      warnings: (data?.warnings as StockWarning[]) || [],
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to auto-complete due services" },
    };
  }
}




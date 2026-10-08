"use server";

import { createClient } from "../../lib/supabase/server";
import { CustomerServiceRecord, ServiceType, ActionResult } from "../../types/vendee";
import {
  checkServiceShiftOverlap,
  calculateNetProfitSatang,
  calculateEffectiveHourlyRateSatang,
  thbToSatang,
} from "../../lib/conflictEngine";
import { getShiftsAction } from "./shiftActions";

/**
 * Fetch all customer services
 */
export async function getServicesAction(params?: {
  date?: string;
  customerId?: string;
}): Promise<ActionResult<CustomerServiceRecord[]>> {
  try {
    const supabase = await createClient();
    let query = supabase.from("customer_services").select("*");

    if (params?.date) query = query.eq("service_date", params.date);
    if (params?.customerId) query = query.eq("customer_id", params.customerId);

    const { data, error } = await query;

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    const services: CustomerServiceRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      type: "service",
      customerId: row.customer_id || "",
      customerName: row.customer_name,
      date: row.service_date,
      time: row.service_time,
      services: row.services as ServiceType[],
      otherServiceText: row.other_service_text,
      medications: row.medications,
      note: row.note,
      price: row.price,
      serviceFeeSatang: row.service_fee_satang,
      medicationCostSatang: row.medication_cost_satang,
      durationHours: row.duration_hours,
      travelExpenseSatang: row.travel_expense_satang,
      otherExpensesSatang: row.other_expenses_satang,
      status: row.status,
      createdAt: row.created_at,
    }));

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
  note?: string;
  price?: number; // In THB from UI
  medicationCost?: number; // In THB from UI
  durationHours?: number;
  travelExpense?: number; // In THB from UI
  otherExpenses?: number; // In THB from UI
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
    const serviceFeeSatang = thbToSatang(data.price || 0);
    const medicationCostSatang = thbToSatang(data.medicationCost || 0);
    const travelExpenseSatang = thbToSatang(data.travelExpense || 0);
    const otherExpensesSatang = thbToSatang(data.otherExpenses || 0);

    const { data: inserted, error } = await supabase
      .from("customer_services")
      .insert({
        customer_id: data.customerId || null,
        customer_name: data.customerName,
        service_date: data.date,
        service_time: data.time,
        services: data.services,
        other_service_text: data.otherServiceText || "",
        medications: data.medications || [],
        note: data.note || "",
        price: data.price || 0,
        service_fee_satang: serviceFeeSatang,
        medication_cost_satang: medicationCostSatang,
        duration_hours: data.durationHours || null,
        travel_expense_satang: travelExpenseSatang,
        other_expenses_satang: otherExpensesSatang,
        status: "upcoming",
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    const serviceRecord: CustomerServiceRecord = {
      id: inserted.id,
      type: "service",
      customerId: inserted.customer_id || "",
      customerName: inserted.customer_name,
      date: inserted.service_date,
      time: inserted.service_time,
      services: inserted.services as ServiceType[],
      otherServiceText: inserted.other_service_text,
      medications: inserted.medications,
      note: inserted.note,
      price: inserted.price,
      serviceFeeSatang: inserted.service_fee_satang,
      medicationCostSatang: inserted.medication_cost_satang,
      durationHours: inserted.duration_hours,
      travelExpenseSatang: inserted.travel_expense_satang,
      otherExpensesSatang: inserted.other_expenses_satang,
      status: inserted.status,
      createdAt: inserted.created_at,
    };

    return { success: true, data: serviceRecord, message: "บันทึกการให้บริการเรียบร้อยแล้ว" };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to create service" },
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
    const { error } = await supabase
      .from("customer_services")
      .update({ status })
      .eq("id", id);

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    return { success: true, data: { updatedId: id, status }, message: "อัปเดตสถานะบริการเรียบร้อยแล้ว" };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to update service status" },
    };
  }
}

/**
 * Delete customer service
 */
export async function deleteServiceAction(id: string): Promise<ActionResult<{ deletedId: string }>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("customer_services").delete().eq("id", id);

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    return { success: true, data: { deletedId: id }, message: "ลบนัดหมายบริการเรียบร้อยแล้ว" };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to delete service" },
    };
  }
}


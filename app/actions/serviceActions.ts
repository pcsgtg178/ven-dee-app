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

    const services: CustomerServiceRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      type: "service",
      customerId: row.customer_id || "",
      customerName: row.customer_name,
      date: row.service_date,
      time: (row.service_time || "09:00").slice(0, 5),
      services: (row.services || ["injection"]) as ServiceType[],
      otherServiceText: row.other_service_text || "",
      medications: Array.isArray(row.medications) ? row.medications.filter(Boolean) : [],
      note: row.note || "",
      price: row.price || 0,
      serviceFeeSatang: row.service_fee_satang || 0,
      medicationCostSatang: row.medication_cost_satang || 0,
      durationHours: row.duration_hours,
      travelExpenseSatang: row.travel_expense_satang || 0,
      otherExpensesSatang: row.other_expenses_satang || 0,
      status: row.status || "upcoming",
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

    const formattedTime = (data.time || "09:00").slice(0, 5);

    const { data: inserted, error } = await supabase
      .from("customer_services")
      .insert({
        customer_id: data.customerId || null,
        customer_name: data.customerName,
        service_date: data.date,
        service_time: `${formattedTime}:00`,
        services: data.services,
        other_service_text: data.otherServiceText || "",
        medications: (data.medications || []).map((m) => m.trim()).filter(Boolean),
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
      time: (inserted.service_time || formattedTime).slice(0, 5),
      services: inserted.services as ServiceType[],
      otherServiceText: inserted.other_service_text,
      medications: Array.isArray(inserted.medications) ? inserted.medications.filter(Boolean) : [],
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
    note?: string;
    price?: number;
    medicationCost?: number;
    durationHours?: number;
    travelExpense?: number;
    otherExpenses?: number;
  }
): Promise<ActionResult<CustomerServiceRecord>> {
  try {
    const supabase = await createClient();

    const serviceFeeSatang = thbToSatang(data.price || 0);
    const medicationCostSatang = thbToSatang(data.medicationCost || 0);
    const travelExpenseSatang = thbToSatang(data.travelExpense || 0);
    const otherExpensesSatang = thbToSatang(data.otherExpenses || 0);
    const formattedTime = (data.time || "09:00").slice(0, 5);

    const updatePayload: Record<string, any> = {
      customer_id: data.customerId || null,
      customer_name: data.customerName,
      service_date: data.date,
      service_time: `${formattedTime}:00`,
      other_service_text: data.otherServiceText || "",
      medications: (data.medications || []).map((m) => m.trim()).filter(Boolean),
      note: data.note || "",
      price: data.price || 0,
      service_fee_satang: serviceFeeSatang,
      medication_cost_satang: medicationCostSatang,
      duration_hours: data.durationHours || null,
      travel_expense_satang: travelExpenseSatang,
      other_expenses_satang: otherExpensesSatang,
    };
    if (data.services && data.services.length > 0) {
      updatePayload.services = data.services;
    }

    const { data: updated, error } = await supabase
      .from("customer_services")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    const serviceRecord: CustomerServiceRecord = {
      id: updated.id,
      type: "service",
      customerId: updated.customer_id || "",
      customerName: updated.customer_name,
      date: updated.service_date,
      time: (updated.service_time || formattedTime).slice(0, 5),
      services: updated.services as ServiceType[],
      otherServiceText: updated.other_service_text,
      medications: Array.isArray(updated.medications) ? updated.medications.filter(Boolean) : [],
      note: updated.note,
      price: updated.price,
      serviceFeeSatang: updated.service_fee_satang,
      medicationCostSatang: updated.medication_cost_satang,
      durationHours: updated.duration_hours,
      travelExpenseSatang: updated.travel_expense_satang,
      otherExpensesSatang: updated.other_expenses_satang,
      status: updated.status,
      createdAt: updated.created_at,
    };

    return { success: true, data: serviceRecord, message: "อัปเดตข้อมูลบริการเรียบร้อยแล้ว" };
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

/**
 * Delete all services for a specific customer (cascade delete on customer deletion)
 */
export async function deleteServicesByCustomerIdAction(
  customerId: string
): Promise<ActionResult<{ deletedCount: number }>> {
  try {
    const supabase = await createClient();
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




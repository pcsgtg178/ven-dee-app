"use server";

import { createClient } from "../../lib/supabase/server";
import { ClinicWorkRecord, ClinicPresetShift, ActionResult } from "../../types/vendee";

const VALID_PRESETS: ClinicPresetShift[] = ["12:30 - 17:30", "17:00 - 19:30", "12:30 - 19:30"];

function mapRowToClinicRecord(row: any): ClinicWorkRecord {
  return {
    id: row.id,
    type: "clinic",
    date: row.work_date,
    presetShift: row.preset_shift as ClinicPresetShift,
    note: row.note || undefined,
    createdAt: row.created_at,
  };
}

/**
 * Fetch all clinic work logs from database
 */
export async function getClinicLogsAction(params?: {
  month?: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ActionResult<ClinicWorkRecord[]>> {
  try {
    const supabase = await createClient();
    let query = supabase.from("clinic_work_logs").select("*").order("work_date", { ascending: true });

    if (params?.date) query = query.eq("work_date", params.date);
    if (params?.month) {
      query = query.gte("work_date", `${params.month}-01`).lte("work_date", `${params.month}-31`);
    }
    if (params?.startDate && params?.endDate) {
      query = query.gte("work_date", params.startDate).lte("work_date", params.endDate);
    } else if (params?.startDate) {
      query = query.gte("work_date", params.startDate);
    } else if (params?.endDate) {
      query = query.lte("work_date", params.endDate);
    }

    const { data, error } = await query;

    if (error) {
      // Graceful fallback if migration not yet applied
      if (error.code === "42P01" || error.message?.includes("does not exist")) {
        console.warn("[clinicActions] Table clinic_work_logs does not exist yet.");
        return { success: true, data: [] };
      }
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    const logs = (data || []).map(mapRowToClinicRecord);
    return { success: true, data: logs };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to fetch clinic logs" },
    };
  }
}

/**
 * Create a new clinic work log
 */
export async function createClinicLogAction(data: {
  id?: string;
  date: string;
  presetShift: ClinicPresetShift;
  note?: string;
}): Promise<ActionResult<ClinicWorkRecord>> {
  try {
    if (!data.date) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "กรุณาระบุวันที่ปฏิบัติงานคลินิก" },
      };
    }

    if (!VALID_PRESETS.includes(data.presetShift)) {
      return {
        success: false,
        error: { code: "INVALID_PRESET", message: `ช่วงเวลาไม่ถูกต้อง: ${data.presetShift}` },
      };
    }

    const supabase = await createClient();
    const insertPayload: Record<string, any> = {
      work_date: data.date,
      preset_shift: data.presetShift,
      note: data.note?.trim() || null,
    };

    // If an existing valid UUID is provided, preserve it
    if (data.id && !data.id.startsWith("clinic-")) {
      insertPayload.id = data.id;
    }

    const { data: created, error } = await supabase
      .from("clinic_work_logs")
      .insert(insertPayload)
      .select()
      .single();

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    return {
      success: true,
      data: mapRowToClinicRecord(created),
      message: "บันทึกงานคลินิกเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to create clinic log" },
    };
  }
}

/**
 * Update an existing clinic work log
 */
export async function updateClinicLogAction(
  id: string,
  data: {
    date: string;
    presetShift: ClinicPresetShift;
    note?: string;
  }
): Promise<ActionResult<ClinicWorkRecord>> {
  try {
    if (!id) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Missing clinic log ID" },
      };
    }

    if (!VALID_PRESETS.includes(data.presetShift)) {
      return {
        success: false,
        error: { code: "INVALID_PRESET", message: `ช่วงเวลาไม่ถูกต้อง: ${data.presetShift}` },
      };
    }

    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("clinic_work_logs")
      .update({
        work_date: data.date,
        preset_shift: data.presetShift,
        note: data.note?.trim() || null,
      })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    if (!updated) {
      return {
        success: false,
        error: { code: "NOT_FOUND", message: "ไม่พบรายการงานคลินิกที่ต้องการแก้ไข" },
      };
    }

    return {
      success: true,
      data: mapRowToClinicRecord(updated),
      message: "อัปเดตงานคลินิกเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to update clinic log" },
    };
  }
}

/**
 * Delete a clinic work log
 */
export async function deleteClinicLogAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    if (!id) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Missing clinic log ID" },
      };
    }

    const supabase = await createClient();
    const { error } = await supabase.from("clinic_work_logs").delete().eq("id", id);

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    return {
      success: true,
      data: { id },
      message: "ลบรายการงานคลินิกเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to delete clinic log" },
    };
  }
}

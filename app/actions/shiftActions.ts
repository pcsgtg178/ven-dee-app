"use server";

import { createClient } from "../../lib/supabase/server";
import { ShiftRecord, ShiftType, ShiftCategory, ActionResult } from "../../types/vendee";
import { checkNightMorningForbidden } from "../../lib/conflictEngine";

/**
 * Fetch all shifts
 */
export async function getShiftsAction(params?: {
  month?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ActionResult<ShiftRecord[]>> {
  try {
    const supabase = await createClient();
    let query = supabase.from("shifts").select("*");

    if (params?.startDate && params?.endDate) {
      query = query.gte("shift_date", params.startDate).lte("shift_date", params.endDate);
    }

    const { data, error } = await query;

    if (error) {
      // Fallback or error return
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: error.message },
      };
    }

    // Map database rows to ShiftRecord
    const shifts: ShiftRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      type: "shift",
      date: row.shift_date,
      shiftType: row.shift_type as ShiftType,
      category: row.category as ShiftCategory,
      status: row.status,
      department: row.department,
      note: row.note,
      swapMeta: row.swapped_with
        ? {
            swappedWith: row.swapped_with,
            originalOwner: row.original_owner,
            parentShiftId: row.parent_shift_id,
            isLocked: row.is_locked,
            swapDate: row.swap_date,
            swapReason: row.swap_reason,
            swapHistory: row.swap_history || [],
          }
        : undefined,
      createdAt: row.created_at,
    }));

    return { success: true, data: shifts };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to fetch shifts" },
    };
  }
}

/**
 * Create a new shift with Night+Morning safety validation
 */
export async function createShiftAction(data: {
  date: string;
  shiftType: ShiftType;
  category?: ShiftCategory;
  department?: string;
  note?: string;
}): Promise<ActionResult<ShiftRecord>> {
  try {
    const supabase = await createClient();

    // Fetch existing shifts on target date to validate FORBIDDEN_NIGHT_MORNING_SAME_DAY
    const { data: existingRows } = await supabase
      .from("shifts")
      .select("*")
      .eq("shift_date", data.date)
      .eq("status", "active");

    const existingShifts: ShiftRecord[] = (existingRows || []).map((row: any) => ({
      id: row.id,
      type: "shift",
      date: row.shift_date,
      shiftType: row.shift_type as ShiftType,
      category: row.category as ShiftCategory,
      status: row.status,
      createdAt: row.created_at,
    }));

    // Invariant Check 1: FORBIDDEN_NIGHT_MORNING_SAME_DAY
    const nightMorningCheck = checkNightMorningForbidden(data.date, data.shiftType, existingShifts);
    if (nightMorningCheck.hasConflict) {
      return {
        success: false,
        error: {
          code: nightMorningCheck.code!,
          message: nightMorningCheck.message!,
        },
      };
    }

    // Insert shift into Supabase
    const { data: inserted, error } = await supabase
      .from("shifts")
      .insert({
        shift_date: data.date,
        shift_type: data.shiftType,
        category: data.category || "black",
        department: data.department || "",
        note: data.note || "",
        status: "active",
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: error.message },
      };
    }

    const shiftRecord: ShiftRecord = {
      id: inserted.id,
      type: "shift",
      date: inserted.shift_date,
      shiftType: inserted.shift_type as ShiftType,
      category: inserted.category as ShiftCategory,
      status: inserted.status,
      department: inserted.department,
      note: inserted.note,
      createdAt: inserted.created_at,
    };

    return { success: true, data: shiftRecord, message: "สร้างเวรเรียบร้อยแล้ว" };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to create shift" },
    };
  }
}

/**
 * Delete shift (Prevent deleting swapped_out shifts with parent references)
 */
export async function deleteShiftAction(id: string): Promise<ActionResult<{ deletedShiftId: string }>> {
  try {
    const supabase = await createClient();

    // Check if shift is swapped_out or locked
    const { data: shift } = await supabase.from("shifts").select("*").eq("id", id).single();

    if (!shift) {
      return {
        success: false,
        error: { code: "SHIFT_NOT_FOUND", message: "ไม่พบเวรที่ต้องการลบ" },
      };
    }

    if (shift.status === "swapped_out" || shift.parent_shift_id) {
      return {
        success: false,
        error: {
          code: "DELETION_RESTRICTED",
          message: "ไม่สามารถลบเวรที่ผ่านการแลกเปลี่ยนได้ (โปรดใช้ฟีเจอร์ Rollback / ยกเลิกการแลกเวร)",
        },
      };
    }

    if (shift.is_locked) {
      return {
        success: false,
        error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถลบเวรในอดีตที่ถูกล็อกแล้วได้" },
      };
    }

    const { error } = await supabase.from("shifts").delete().eq("id", id);

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    return { success: true, data: { deletedShiftId: id }, message: "ลบเวรเรียบร้อยแล้ว" };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to delete shift" },
    };
  }
}

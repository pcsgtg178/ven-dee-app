"use server";

import { createClient } from "../../lib/supabase/server";
import { ShiftRecord, ShiftType, ShiftCategory, ShiftStatus, ActionResult, SwapTrailNode } from "../../types/vendee";
import { checkNightMorningForbidden } from "../../lib/conflictEngine";

function mapRowToShiftRecord(row: any): ShiftRecord {
  return {
    id: row.id,
    type: "shift",
    date: row.shift_date,
    shiftType: row.shift_type as ShiftType,
    category: row.category as ShiftCategory,
    status: row.status as ShiftStatus,
    department: row.department || undefined,
    note: row.note || undefined,
    swapMeta: row.swapped_with
      ? {
          swappedWith: row.swapped_with,
          originalOwner: row.original_owner || undefined,
          parentShiftId: row.parent_shift_id || undefined,
          isLocked: Boolean(row.is_locked),
          swapDate: row.swap_date || undefined,
          swapReason: row.swap_reason || undefined,
          swapHistory: (row.swap_history as SwapTrailNode[]) || [],
        }
      : undefined,
    createdAt: row.created_at,
  };
}

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
    } else if (params?.month) {
      query = query
        .gte("shift_date", `${params.month}-01`)
        .lte("shift_date", `${params.month}-31`);
    }

    const { data, error } = await query.order("shift_date", { ascending: true });

    if (error) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: error.message },
      };
    }

    const shifts: ShiftRecord[] = (data || []).map(mapRowToShiftRecord);
    return { success: true, data: shifts };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to fetch shifts" },
    };
  }
}

/**
 * Create a new shift with safety validation
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

    // Fetch existing active shifts on target date
    const { data: existingRows } = await supabase
      .from("shifts")
      .select("*")
      .eq("shift_date", data.date)
      .eq("status", "active");

    const existingShifts: ShiftRecord[] = (existingRows || []).map(mapRowToShiftRecord);

    // Duplicate Check: Same date, same shiftType, same category
    const isDuplicate = existingShifts.some(
      (s) => s.shiftType === data.shiftType && s.category === (data.category || "black")
    );
    if (isDuplicate) {
      return {
        success: false,
        error: {
          code: "DUPLICATE_SHIFT",
          message: `มีเวรประเภทนี้ในวันที่ ${data.date} อยู่แล้ว`,
        },
      };
    }

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

    return {
      success: true,
      data: mapRowToShiftRecord(inserted),
      message: "สร้างเวรเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to create shift" },
    };
  }
}

/**
 * Update an existing shift
 */
export async function updateShiftAction(
  id: string,
  data: {
    shiftType?: ShiftType;
    category?: ShiftCategory;
    department?: string;
    note?: string;
    status?: ShiftStatus;
  }
): Promise<ActionResult<ShiftRecord>> {
  try {
    const supabase = await createClient();

    const updatePayload: Record<string, any> = {};
    if (data.shiftType !== undefined) updatePayload.shift_type = data.shiftType;
    if (data.category !== undefined) updatePayload.category = data.category;
    if (data.department !== undefined) updatePayload.department = data.department;
    if (data.note !== undefined) updatePayload.note = data.note;
    if (data.status !== undefined) updatePayload.status = data.status;

    const { data: updated, error } = await supabase
      .from("shifts")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: error.message },
      };
    }

    return {
      success: true,
      data: mapRowToShiftRecord(updated),
      message: "แก้ไขเวรเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to update shift" },
    };
  }
}

/**
 * Swap a shift
 */
export async function swapShiftAction(data: {
  shiftId: string;
  swappedWith: string;
  originalOwner?: string;
  newDate: string;
  newShiftType: ShiftType;
  newCategory?: ShiftCategory;
  swapReason?: string;
  swapHistory?: SwapTrailNode[];
}): Promise<ActionResult<{ newShift: ShiftRecord; oldShift: ShiftRecord }>> {
  try {
    const supabase = await createClient();

    // Fetch old shift
    const { data: oldShiftRow, error: oldErr } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", data.shiftId)
      .single();

    if (oldErr || !oldShiftRow) {
      return {
        success: false,
        error: { code: "SHIFT_NOT_FOUND", message: "ไม่พบเวรที่ต้องการแลก" },
      };
    }

    if (oldShiftRow.is_locked) {
      return {
        success: false,
        error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถแลกเวรในอดีตที่ถูกล็อกแล้วได้" },
      };
    }

    // 1. Mark old shift as swapped_out
    const { data: updatedOld, error: updateErr } = await supabase
      .from("shifts")
      .update({ status: "swapped_out" })
      .eq("id", data.shiftId)
      .select()
      .single();

    if (updateErr) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: updateErr.message },
      };
    }

    // 2. Insert new received shift
    const swapDateStr = new Date().toISOString().split("T")[0];
    const { data: newShiftRow, error: insertErr } = await supabase
      .from("shifts")
      .insert({
        shift_date: data.newDate,
        shift_type: data.newShiftType,
        category: data.newCategory || "black",
        status: "active",
        department: oldShiftRow.department || "",
        note: `เวรที่ได้รับจากการแลกกับ ${data.swappedWith}${data.swapReason ? ` (${data.swapReason})` : ""}`,
        swapped_with: data.swappedWith,
        original_owner: data.originalOwner || null,
        parent_shift_id: data.shiftId,
        swap_date: swapDateStr,
        swap_reason: data.swapReason || null,
        swap_history: data.swapHistory || [],
      })
      .select()
      .single();

    if (insertErr) {
      // Revert old shift back to active
      await supabase.from("shifts").update({ status: "active" }).eq("id", data.shiftId);
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: insertErr.message },
      };
    }

    return {
      success: true,
      data: {
        oldShift: mapRowToShiftRecord(updatedOld),
        newShift: mapRowToShiftRecord(newShiftRow),
      },
      message: "บันทึกการแลกเวรเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to swap shift" },
    };
  }
}

/**
 * Undo / Rollback shift swap
 */
export async function undoSwapShiftAction(
  shiftId: string,
  reason?: string
): Promise<ActionResult<{ cancelledShiftId: string; restoredParentId?: string }>> {
  try {
    const supabase = await createClient();

    const { data: shift, error: fetchErr } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", shiftId)
      .single();

    if (fetchErr || !shift) {
      return {
        success: false,
        error: { code: "SHIFT_NOT_FOUND", message: "ไม่พบเวรที่ต้องการยกเลิกการแลก" },
      };
    }

    let parentId = shift.parent_shift_id;

    if (parentId) {
      // Restore parent shift
      await supabase.from("shifts").update({ status: "active" }).eq("id", parentId);
      // Cancel the received shift
      await supabase
        .from("shifts")
        .update({ status: "cancelled", swap_reason: reason || "ยกเลิกการแลกเวร" })
        .eq("id", shiftId);
    } else if (shift.status === "swapped_out") {
      // If user passed the swapped_out shift, restore it and cancel child
      await supabase.from("shifts").update({ status: "active" }).eq("id", shiftId);
      const { data: child } = await supabase
        .from("shifts")
        .select("id")
        .eq("parent_shift_id", shiftId)
        .single();
      if (child) {
        await supabase
          .from("shifts")
          .update({ status: "cancelled", swap_reason: reason || "ยกเลิกการแลกเวร" })
          .eq("id", child.id);
        parentId = shiftId;
      }
    }

    return {
      success: true,
      data: { cancelledShiftId: shiftId, restoredParentId: parentId || undefined },
      message: "ยกเลิกการแลกเวรและคืนสถานะเวรเดิมเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to undo swap" },
    };
  }
}

/**
 * Restore an inactive / cancelled shift
 */
export async function restoreShiftAction(id: string): Promise<ActionResult<ShiftRecord>> {
  try {
    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("shifts")
      .update({ status: "active" })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    return {
      success: true,
      data: mapRowToShiftRecord(updated),
      message: "กู้คืนสถานะเวรเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to restore shift" },
    };
  }
}

/**
 * Delete shift (Prevent deleting swapped_out shifts that act as active parents)
 */
export async function deleteShiftAction(id: string): Promise<ActionResult<{ deletedShiftId: string; restoredParentId?: string }>> {
  try {
    const supabase = await createClient();

    // Check shift details
    const { data: shift } = await supabase.from("shifts").select("*").eq("id", id).single();

    if (!shift) {
      return {
        success: false,
        error: { code: "SHIFT_NOT_FOUND", message: "ไม่พบเวรที่ต้องการลบ" },
      };
    }

    if (shift.is_locked) {
      return {
        success: false,
        error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถลบเวรในอดีตที่ถูกล็อกแล้วได้" },
      };
    }

    // Check if this shift has active child shifts referencing it as parent
    const { data: childShifts } = await supabase
      .from("shifts")
      .select("id")
      .eq("parent_shift_id", id)
      .eq("status", "active");

    if (childShifts && childShifts.length > 0) {
      return {
        success: false,
        error: {
          code: "DELETION_RESTRICTED",
          message: "ไม่สามารถลบเวรที่มีการแลกเปลี่ยนต่อเนื่องได้ (โปรดใช้ฟีเจอร์ Rollback / ยกเลิกการแลกเวร)",
        },
      };
    }

    let restoredParentId: string | undefined = undefined;

    // If deleting a received shift that has a parent, restore parent shift to active
    if (shift.parent_shift_id) {
      const { data: parent } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", shift.parent_shift_id)
        .single();

      if (parent && parent.status === "swapped_out") {
        await supabase
          .from("shifts")
          .update({ status: "active" })
          .eq("id", shift.parent_shift_id);
        restoredParentId = shift.parent_shift_id;
      }
    }

    const { error } = await supabase.from("shifts").delete().eq("id", id);

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    return {
      success: true,
      data: { deletedShiftId: id, restoredParentId },
      message: "ลบเวรเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to delete shift" },
    };
  }
}

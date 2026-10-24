"use server";

import { createClient } from "../../lib/supabase/server";
import { ShiftRecord, ShiftType, ShiftCategory, ShiftStatus, ActionResult, SwapTrailNode, ShiftSwapRecord } from "../../types/vendee";
import { checkNightMorningForbidden } from "../../lib/conflictEngine";
import { isShiftInPast, getTodayDateStringBangkok } from "../../lib/dateUtils";

function mapRowToShiftRecord(row: any, swapRecord?: ShiftSwapRecord | number): ShiftRecord {
  const resolvedSwapRec = typeof swapRecord === "object" && swapRecord !== null ? swapRecord : undefined;
  const swap: ShiftSwapRecord | undefined = resolvedSwapRec || (row.shift_swaps ? {
    id: row.shift_swaps.id,
    givenShiftId: row.shift_swaps.given_shift_id,
    receivedShiftId: row.shift_swaps.received_shift_id,
    swappedWith: row.shift_swaps.swapped_with,
    originalOwner: row.shift_swaps.original_owner || undefined,
    swapDate: row.shift_swaps.swap_date,
    swapReason: row.shift_swaps.swap_reason || undefined,
    swapHistory: (row.shift_swaps.swap_history as SwapTrailNode[]) || [],
    createdAt: row.shift_swaps.created_at,
  } : undefined);

  let swapMeta = undefined;
  if (swap) {
    swapMeta = {
      swappedWith: swap.swappedWith,
      originalOwner: swap.originalOwner,
      parentShiftId: swap.givenShiftId,
      isLocked: Boolean(row.is_locked),
      swapDate: swap.swapDate,
      swapReason: swap.swapReason,
      swapHistory: swap.swapHistory,
    };
  } else if (row.swapped_with || row.parent_shift_id || row.swap_date) {
    swapMeta = {
      swappedWith: row.swapped_with || "",
      originalOwner: row.original_owner || undefined,
      parentShiftId: row.parent_shift_id || undefined,
      isLocked: Boolean(row.is_locked),
      swapDate: row.swap_date || undefined,
      swapReason: row.swap_reason || undefined,
      swapHistory: (row.swap_history as SwapTrailNode[]) || [],
    };
  }

  return {
    id: row.id,
    type: "shift",
    date: row.shift_date,
    shiftType: row.shift_type as ShiftType,
    category: row.category as ShiftCategory,
    status: row.status as ShiftStatus,
    swapId: row.swap_id || (swap?.id) || undefined,
    swap,
    swapMeta,
    saleMeta: (row.sale_meta || row.buyer_name || row.sale_price_satang || row.sold_date)
      ? {
        buyerName: row.sale_meta?.buyerName || row.buyer_name || "",
        salePriceSatang: Number(row.sale_meta?.salePriceSatang ?? row.sale_price_satang ?? 0),
        soldDate: row.sale_meta?.soldDate || row.sold_date || "",
        paymentStatus: (row.sale_meta?.paymentStatus || row.payment_status || "unpaid") as "unpaid" | "paid",
        note: row.sale_meta?.note || row.sale_note || undefined,
      }
      : undefined,
    department: row.department || undefined,
    note: row.note || undefined,
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

    const { data: shiftRows, error } = await query.order("shift_date", { ascending: true });

    if (error) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: error.message },
      };
    }

    // Attach shift_swaps records if table exists
    const swapsMapById = new Map<string, ShiftSwapRecord>();
    const swapsMapByGiven = new Map<string, ShiftSwapRecord>();
    const swapsMapByReceived = new Map<string, ShiftSwapRecord>();

    try {
      const { data: swapRows, error: swapErr } = await supabase.from("shift_swaps").select("*");
      if (!swapErr && Array.isArray(swapRows)) {
        for (const sr of swapRows) {
          const rec: ShiftSwapRecord = {
            id: sr.id,
            givenShiftId: sr.given_shift_id,
            receivedShiftId: sr.received_shift_id,
            swappedWith: sr.swapped_with,
            originalOwner: sr.original_owner || undefined,
            swapDate: sr.swap_date,
            swapReason: sr.swap_reason || undefined,
            swapHistory: (sr.swap_history as SwapTrailNode[]) || [],
            createdAt: sr.created_at,
          };
          swapsMapById.set(rec.id, rec);
          swapsMapByGiven.set(rec.givenShiftId, rec);
          swapsMapByReceived.set(rec.receivedShiftId, rec);
        }
      }
    } catch {
      // Table may not exist yet during incremental migrations
    }

    const shifts: ShiftRecord[] = (shiftRows || []).map((row) => {
      const swapRec =
        (row.swap_id ? swapsMapById.get(row.swap_id) : undefined) ||
        swapsMapByGiven.get(row.id) ||
        swapsMapByReceived.get(row.id);
      return mapRowToShiftRecord(row, swapRec);
    });

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

    const existingShifts: ShiftRecord[] = (existingRows || []).map((row) => mapRowToShiftRecord(row));

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

    const { data: shiftRow } = await supabase
      .from("shifts")
      .select("is_locked, shift_date")
      .eq("id", id)
      .single();

    if (shiftRow && (shiftRow.is_locked || isShiftInPast(shiftRow.shift_date))) {
      return {
        success: false,
        error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถแก้ไขเวรในอดีตที่ถูกล็อกแล้วได้" },
      };
    }

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
 * Swap a shift (Phase 10: PostgreSQL Transactional RPC perform_shift_swap with fallback)
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

    // 1. Transactional RPC perform_shift_swap (BACKLOG_MIGRATE.md §3)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("perform_shift_swap", {
      p_given_shift_id: data.shiftId,
      p_swapped_with: data.swappedWith,
      p_original_owner: data.originalOwner || null,
      p_new_date: data.newDate,
      p_new_shift_type: data.newShiftType,
      p_new_category: data.newCategory || "black",
      p_swap_reason: data.swapReason || null,
      p_swap_history: data.swapHistory || [],
    });

    if (!rpcErr && rpcResult) {
      const givenShiftId = rpcResult.given_shift_id || data.shiftId;
      const receivedShiftId = rpcResult.received_shift_id;
      const swapId = rpcResult.swap_id;

      const [{ data: givenRow }, { data: receivedRow }, { data: swapRow }] = await Promise.all([
        supabase.from("shifts").select("*").eq("id", givenShiftId).single(),
        supabase.from("shifts").select("*").eq("id", receivedShiftId).single(),
        supabase.from("shift_swaps").select("*").eq("id", swapId).single(),
      ]);

      const swapRec: ShiftSwapRecord | undefined = swapRow
        ? {
            id: swapRow.id,
            givenShiftId: swapRow.given_shift_id,
            receivedShiftId: swapRow.received_shift_id,
            swappedWith: swapRow.swapped_with,
            originalOwner: swapRow.original_owner || undefined,
            swapDate: swapRow.swap_date,
            swapReason: swapRow.swap_reason || undefined,
            swapHistory: (swapRow.swap_history as SwapTrailNode[]) || [],
            createdAt: swapRow.created_at,
          }
        : undefined;

      return {
        success: true,
        data: {
          oldShift: mapRowToShiftRecord(givenRow, swapRec),
          newShift: mapRowToShiftRecord(receivedRow, swapRec),
        },
        message: "บันทึกการแลกเวรเรียบร้อยแล้ว",
      };
    }

    if (rpcErr) {
      const errMsg = rpcErr.message || "";
      if (errMsg.includes("SHIFT_NOT_FOUND")) {
        return { success: false, error: { code: "SHIFT_NOT_FOUND", message: "ไม่พบเวรที่ต้องการแลก" } };
      }
      if (errMsg.includes("SHIFT_ALREADY_SWAPPED")) {
        return { success: false, error: { code: "SHIFT_ALREADY_SWAPPED", message: "เวรนี้ถูกแลกหรือส่งต่อออกไปแล้ว ไม่สามารถแลกซ้ำได้" } };
      }
      if (errMsg.includes("SHIFT_IS_LOCKED")) {
        return { success: false, error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถแลกเวรในอดีตที่ถูกล็อกแล้วได้" } };
      }
      console.warn("[VenDee swapShiftAction] RPC perform_shift_swap failed, attempting fallback:", errMsg);
    }

    // --- Direct Fallback ---
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

    if (oldShiftRow.status === "swapped_out" || oldShiftRow.status === "sold_out") {
      return {
        success: false,
        error: { code: "SHIFT_ALREADY_SWAPPED", message: "เวรนี้ถูกแลกหรือส่งต่อออกไปแล้ว ไม่สามารถแลกซ้ำได้" },
      };
    }

    if (oldShiftRow.is_locked || isShiftInPast(oldShiftRow.shift_date)) {
      return {
        success: false,
        error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถแลกเวรในอดีตที่ถูกล็อกแล้วได้" },
      };
    }

    const swapDateStr = getTodayDateStringBangkok();

    // 1. Insert new received shift
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

    if (insertErr || !newShiftRow) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: insertErr?.message || "Failed to create received shift" },
      };
    }

    // 2. Try inserting into shift_swaps table
    let createdSwapId: string | undefined = undefined;
    try {
      const { data: insertedSwap } = await supabase
        .from("shift_swaps")
        .insert({
          given_shift_id: data.shiftId,
          received_shift_id: newShiftRow.id,
          swapped_with: data.swappedWith,
          original_owner: data.originalOwner || null,
          swap_date: swapDateStr,
          swap_reason: data.swapReason || null,
          swap_history: data.swapHistory || [],
        })
        .select()
        .single();
      if (insertedSwap?.id) {
        createdSwapId = insertedSwap.id;
      }
    } catch {
      // shift_swaps table might not exist yet
    }

    // 3. Update old shift to swapped_out
    const updatePayload: any = {
      status: "swapped_out",
      swapped_with: data.swappedWith,
      swap_date: swapDateStr,
      swap_reason: data.swapReason || null,
    };
    if (createdSwapId) {
      updatePayload.swap_id = createdSwapId;
    }

    const { data: updatedOld, error: updateErr } = await supabase
      .from("shifts")
      .update(updatePayload)
      .eq("id", data.shiftId)
      .select()
      .single();

    if (updateErr) {
      await supabase.from("shifts").delete().eq("id", newShiftRow.id);
      if (createdSwapId) {
        await supabase.from("shift_swaps").delete().eq("id", createdSwapId);
      }
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: updateErr.message },
      };
    }

    const fallbackSwapRec: ShiftSwapRecord = {
      id: createdSwapId || `swap-${Date.now()}`,
      givenShiftId: data.shiftId,
      receivedShiftId: newShiftRow.id,
      swappedWith: data.swappedWith,
      originalOwner: data.originalOwner,
      swapDate: swapDateStr,
      swapReason: data.swapReason,
      swapHistory: data.swapHistory || [],
    };

    return {
      success: true,
      data: {
        oldShift: mapRowToShiftRecord(updatedOld, fallbackSwapRec),
        newShift: mapRowToShiftRecord(newShiftRow, fallbackSwapRec),
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
 * Undo / Rollback shift swap (Phase 10: Transactional RPC undo_shift_swap with DOWNSTREAM_SWAP_ACTIVE guard)
 */
export async function undoSwapShiftAction(
  shiftId: string,
  reason?: string
): Promise<ActionResult<{ cancelledShiftId: string; restoredParentId?: string }>> {
  try {
    const supabase = await createClient();

    // 1. Transactional RPC undo_shift_swap (BACKLOG_MIGRATE.md §3)
    const { data: rpcResult, error: rpcErr } = await supabase.rpc("undo_shift_swap", {
      p_target_shift_id: shiftId,
    });

    if (!rpcErr && rpcResult) {
      return {
        success: true,
        data: {
          cancelledShiftId: rpcResult.deleted_shift_id || shiftId,
          restoredParentId: rpcResult.restored_shift_id,
        },
        message: "ยกเลิกการแลกเวรและคืนสถานะเวรเดิมเรียบร้อยแล้ว",
      };
    }

    if (rpcErr) {
      const errMsg = rpcErr.message || "";
      if (errMsg.includes("DOWNSTREAM_SWAP_ACTIVE")) {
        return {
          success: false,
          error: {
            code: "DOWNSTREAM_SWAP_ACTIVE",
            message: "ไม่สามารถยกเลิกการแลกเวรนี้ได้ เนื่องจากเวรที่ได้รับมาถูกนำไปแลกเปลี่ยนต่อแล้ว กรุณายกเลิกการแลกขั้นหลังก่อน",
          },
        };
      }
      if (errMsg.includes("SHIFT_IS_LOCKED")) {
        return {
          success: false,
          error: {
            code: "SHIFT_IS_LOCKED",
            message: "ไม่สามารถยกเลิกได้เนื่องจากเวรผ่านเวลาไปแล้ว (เวรถูกล็อกอยู่)",
          },
        };
      }
      if (errMsg.includes("SWAP_NOT_FOUND")) {
        // Fallback to legacy check below
      } else {
        console.warn("[VenDee undoSwapShiftAction] RPC undo_shift_swap returned error, running fallback:", errMsg);
      }
    }

    // --- Direct Fallback ---
    // Check shift_swaps table first if available
    try {
      const { data: swapRows } = await supabase
        .from("shift_swaps")
        .select("*")
        .or(`given_shift_id.eq.${shiftId},received_shift_id.eq.${shiftId}`);

      if (swapRows && swapRows.length > 0) {
        const swap = swapRows[0];

        // Downstream chain swap guard
        const { count: downstreamCount } = await supabase
          .from("shift_swaps")
          .select("id", { count: "exact", head: true })
          .eq("given_shift_id", swap.received_shift_id);

        if (downstreamCount && downstreamCount > 0) {
          return {
            success: false,
            error: {
              code: "DOWNSTREAM_SWAP_ACTIVE",
              message: "ไม่สามารถยกเลิกการแลกเวรนี้ได้ เนื่องจากเวรที่ได้รับมาถูกนำไปแลกเปลี่ยนต่อแล้ว กรุณายกเลิกการแลกขั้นหลังก่อน",
            },
          };
        }

        // Restore given shift
        await supabase
          .from("shifts")
          .update({
            status: "active",
            swap_id: null,
            swapped_with: null,
            swap_date: null,
            swap_reason: null,
            original_owner: null,
            swap_history: [],
          })
          .eq("id", swap.given_shift_id);

        // Delete swap record
        await supabase.from("shift_swaps").delete().eq("id", swap.id);

        // Delete received shift
        await supabase.from("shifts").delete().eq("id", swap.received_shift_id);
        await supabase.from("shifts").delete().eq("parent_shift_id", swap.given_shift_id);

        return {
          success: true,
          data: {
            cancelledShiftId: swap.received_shift_id,
            restoredParentId: swap.given_shift_id,
          },
          message: "ยกเลิกการแลกเวรและคืนสถานะเวรเดิมเรียบร้อยแล้ว",
        };
      }
    } catch {
      // Table might not exist yet
    }

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

    if (shift.is_locked || isShiftInPast(shift.shift_date)) {
      return {
        success: false,
        error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถยกเลิกได้เนื่องจากเวรผ่านเวลาไปแล้ว (เวรถูกล็อกอยู่)" },
      };
    }

    let parentId = shift.parent_shift_id;
    let childId: string | undefined = undefined;

    if (parentId) {
      // shift is the child / received shift
      childId = shift.id;

      // Verify parent shift
      const { data: parentShift, error: parentErr } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", parentId)
        .single();

      if (parentErr || !parentShift) {
        return {
          success: false,
          error: { code: "PARENT_SHIFT_NOT_FOUND", message: "ไม่พบเวรเดิมตั้งต้นก่อนแลก" },
        };
      }

      if (parentShift.is_locked || isShiftInPast(parentShift.shift_date)) {
        return {
          success: false,
          error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถยกเลิกได้เนื่องจากเวรเดิมผ่านเวลาไปแล้ว (เวรถูกล็อกอยู่)" },
        };
      }
    } else if (shift.status === "swapped_out") {
      // shift is the parent / swapped_out shift
      parentId = shift.id;

      // Find children without using .single() to avoid failure when multiple rows exist
      const { data: children, error: childErr } = await supabase
        .from("shifts")
        .select("id, status, is_locked, shift_date")
        .eq("parent_shift_id", parentId);

      if (childErr) {
        return { success: false, error: { code: "DATABASE_ERROR", message: childErr.message } };
      }

      const activeChild = (children || []).find((c) => c.status === "active") || (children || [])[0];
      if (activeChild) {
        if (activeChild.is_locked || isShiftInPast(activeChild.shift_date)) {
          return {
            success: false,
            error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถยกเลิกได้เนื่องจากเวรที่ได้รับมาผ่านเวลาไปแล้ว" },
          };
        }
        childId = activeChild.id;
      }
    } else {
      // Check if any child references this shift as parent
      const { data: children } = await supabase
        .from("shifts")
        .select("id, status, is_locked, shift_date")
        .eq("parent_shift_id", shift.id);

      const activeChild = (children || []).find((c) => c.status === "active") || (children || [])[0];
      if (activeChild) {
        parentId = shift.id;
        childId = activeChild.id;
      }
    }

    if (!parentId) {
      return {
        success: false,
        error: { code: "INVALID_SWAP_STATE", message: "ไม่พบข้อมูลความสัมพันธ์ของการแลกเวรนี้" },
      };
    }

    // 1. Restore parent shift to active and clear all swap fields (ISSUE-2 Fix D)
    const { error: restoreErr } = await supabase
      .from("shifts")
      .update({
        status: "active",
        swap_id: null,
        swapped_with: null,
        swap_date: null,
        swap_reason: null,
        original_owner: null,
        swap_history: [],
      })
      .eq("id", parentId);

    if (restoreErr) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: `ล้มเหลวในการคืนสถานะเวรเดิม: ${restoreErr.message}` },
      };
    }

    // 2. Delete (not cancel) the received child shift and all children referencing parentId from DB (ISSUE-2 Fix A)
    if (childId) {
      await supabase.from("shifts").delete().eq("id", childId);
    }
    const { error: deleteChildErr } = await supabase
      .from("shifts")
      .delete()
      .eq("parent_shift_id", parentId);

    if (deleteChildErr) {
      // Rollback parent back to swapped_out if child delete fails (Atomic rollback safety)
      await supabase
        .from("shifts")
        .update({
          status: "swapped_out",
          swapped_with: shift.swapped_with || "คู่แลกเวร",
        })
        .eq("id", parentId);

      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: `ล้มเหลวในการลบเวรที่แลกมา: ${deleteChildErr.message}` },
      };
    }

    return {
      success: true,
      data: { cancelledShiftId: childId || shiftId, restoredParentId: parentId },
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
 * Delete shift (Prevent deleting swapped_out shifts that act as active parents or downstream chain items)
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

    if (shift.is_locked || isShiftInPast(shift.shift_date)) {
      return {
        success: false,
        error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถลบเวรในอดีตที่ถูกล็อกแล้วได้" },
      };
    }

    if (shift.status === "sold_out") {
      return {
        success: false,
        error: {
          code: "DELETION_RESTRICTED",
          message: "ไม่สามารถลบเวรที่ขายออกไปแล้วได้ (โปรดใช้ฟีเจอร์ยกเลิกการขายเวร เพื่อคืนสถานะเวร)",
        },
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

    // Check if this shift is given in an active swap in shift_swaps
    try {
      const { data: downstreamSwap } = await supabase
        .from("shift_swaps")
        .select("id")
        .eq("given_shift_id", id);
      if (downstreamSwap && downstreamSwap.length > 0) {
        return {
          success: false,
          error: {
            code: "DELETION_RESTRICTED",
            message: "ไม่สามารถลบเวรที่มีการแลกเปลี่ยนต่อเนื่องได้ (โปรดใช้ฟีเจอร์ Rollback / ยกเลิกการแลกเวร)",
          },
        };
      }
    } catch {
      // Table check ignored if table not present
    }

    let restoredParentId: string | undefined = undefined;

    // Check if deleting a received shift from shift_swaps
    try {
      const { data: swapRows } = await supabase
        .from("shift_swaps")
        .select("*")
        .eq("received_shift_id", id);

      if (swapRows && swapRows.length > 0) {
        const swap = swapRows[0];
        restoredParentId = swap.given_shift_id;

        await supabase
          .from("shifts")
          .update({
            status: "active",
            swap_id: null,
            swapped_with: null,
            swap_date: null,
            swap_reason: null,
            original_owner: null,
            swap_history: [],
          })
          .eq("id", swap.given_shift_id);

        await supabase.from("shift_swaps").delete().eq("id", swap.id);
      }
    } catch {
      // Table check ignored if table not present
    }

    // Fallback: If deleting a received shift that has a parent, restore parent shift to active
    if (!restoredParentId && shift.parent_shift_id) {
      const { data: parent } = await supabase
        .from("shifts")
        .select("*")
        .eq("id", shift.parent_shift_id)
        .single();

      if (parent && parent.status === "swapped_out") {
        const { error: restoreErr } = await supabase
          .from("shifts")
          .update({
            status: "active",
            swap_id: null,
            swapped_with: null,
            swap_date: null,
            swap_reason: null,
            original_owner: null,
            swap_history: [],
          })
          .eq("id", shift.parent_shift_id);

        if (restoreErr) {
          return { success: false, error: { code: "DATABASE_ERROR", message: restoreErr.message } };
        }
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

/**
 * Sell a Refer shift (One-way transfer, status: "sold_out", Satang standard)
 * Adheres to DOMAIN_RULES.md Section 2.4 & PROJECT_RULES.md Section 4
 */
export async function sellShiftAction(data: {
  shiftId: string;
  buyerName: string;
  salePriceSatang: number;
  soldDate: string;
  paymentStatus: "unpaid" | "paid";
  note?: string;
}): Promise<ActionResult<ShiftRecord>> {
  try {
    const supabase = await createClient();

    // 1. Fetch target shift
    const { data: shiftRow, error: fetchErr } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", data.shiftId)
      .single();

    if (fetchErr || !shiftRow) {
      return {
        success: false,
        error: { code: "SHIFT_NOT_FOUND", message: "ไม่พบเวรที่ต้องการขาย" },
      };
    }

    if (shiftRow.status === "sold_out") {
      return {
        success: false,
        error: { code: "SHIFT_ALREADY_SOLD", message: "เวรนี้ถูกทำรายการขายไปแล้ว" },
      };
    }

    if (shiftRow.status !== "active") {
      return {
        success: false,
        error: { code: "INVALID_SALE_OPERATION", message: "เวรนี้ไม่ได้อยู่ในสถานะพร้อมขาย" },
      };
    }

    if (shiftRow.is_locked || isShiftInPast(shiftRow.shift_date)) {
      return {
        success: false,
        error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถขายเวรในอดีตที่ถูกล็อกแล้วได้" },
      };
    }

    // Domain Invariant: Only Refer shifts (r1, r2 or green category) are permitted for selling
    const isRefer =
      shiftRow.shift_type === "r1" ||
      shiftRow.shift_type === "r2" ||
      shiftRow.category === "green";

    if (!isRefer) {
      return {
        success: false,
        error: {
          code: "INVALID_SALE_OPERATION",
          message: "อนุญาตให้ขายได้เฉพาะเวร Refer (R1, R2) เท่านั้น",
        },
      };
    }

    const saleMetaObj = {
      buyerName: data.buyerName.trim(),
      salePriceSatang: data.salePriceSatang,
      soldDate: data.soldDate,
      paymentStatus: data.paymentStatus,
      note: data.note?.trim() || undefined,
    };

    const { data: updated, error: updateErr } = await supabase
      .from("shifts")
      .update({
        status: "sold_out",
        buyer_name: data.buyerName.trim(),
        sale_price_satang: data.salePriceSatang,
        sold_date: data.soldDate,
        payment_status: data.paymentStatus,
        sale_note: data.note?.trim() || null,
        sale_meta: saleMetaObj,
      })
      .eq("id", data.shiftId)
      .select()
      .single();

    if (updateErr) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: updateErr.message },
      };
    }

    return {
      success: true,
      data: mapRowToShiftRecord(updated),
      message: "บันทึกการขายเวร Refer เรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to sell shift" },
    };
  }
}

/**
 * Undo / Rollback Refer shift sale
 * Restores status to active and purges sale metadata
 */
export async function undoSellShiftAction(shiftId: string): Promise<ActionResult<ShiftRecord>> {
  try {
    const supabase = await createClient();

    const { data: shiftRow, error: fetchErr } = await supabase
      .from("shifts")
      .select("*")
      .eq("id", shiftId)
      .single();

    if (fetchErr || !shiftRow) {
      return {
        success: false,
        error: { code: "SHIFT_NOT_FOUND", message: "ไม่พบเวรที่ต้องการยกเลิกการขาย" },
      };
    }

    if (shiftRow.status !== "sold_out") {
      return {
        success: false,
        error: { code: "INVALID_SALE_OPERATION", message: "เวรนี้ไม่ได้อยู่ในสถานะขายแล้ว" },
      };
    }

    if (shiftRow.is_locked || isShiftInPast(shiftRow.shift_date)) {
      return {
        success: false,
        error: { code: "SHIFT_IS_LOCKED", message: "ไม่สามารถยกเลิกการขายเวรในอดีตที่ถูกล็อกแล้วได้" },
      };
    }

    const { data: updated, error: updateErr } = await supabase
      .from("shifts")
      .update({
        status: "active",
        buyer_name: null,
        sale_price_satang: 0,
        sold_date: null,
        payment_status: null,
        sale_note: null,
        sale_meta: null,
      })
      .eq("id", shiftId)
      .select()
      .single();

    if (updateErr) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: updateErr.message },
      };
    }

    return {
      success: true,
      data: mapRowToShiftRecord(updated),
      message: "ยกเลิกการขายเวรและคืนสถานะเวรปกติเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to undo shift sale" },
    };
  }
}

/**
 * Detect corrupted swap records in the database (BACKLOG.md §9.5, BACKLOG_ISSUE.md §Data repair)
 * 1. Cancelled children that still have parent_shift_id
 * 2. Shifts stuck in 'swapped_out' without an active child
 * 3. The known corrupt Beam shift on 2026-11-03
 * 4. Active parent shifts that still have lingering swap metadata without active swap
 */
export async function detectCorruptedSwapDataAction(): Promise<
  ActionResult<{
    orphanCancelledChildren: any[];
    orphanSwappedOutParents: any[];
    corruptBeamShifts: any[];
    lingeringSwapMetadata: any[];
  }>
> {
  try {
    const supabase = await createClient();

    // 1. Cancelled children
    const { data: cancelledChildren } = await supabase
      .from("shifts")
      .select("id, shift_date, shift_type, swapped_with, parent_shift_id")
      .eq("status", "cancelled")
      .not("parent_shift_id", "is", null);

    // 2. Corrupt Beam shift
    const { data: beamShifts } = await supabase
      .from("shifts")
      .select("id, shift_date, shift_type, status, swapped_with, parent_shift_id")
      .eq("shift_date", "2026-11-03")
      .eq("shift_type", "afternoon")
      .or("swapped_with.eq.บีม,original_owner.eq.บีม,parent_shift_id.not.is.null");

    // 3. Swapped out parents
    const { data: swappedOutParents } = await supabase
      .from("shifts")
      .select("id, shift_date, shift_type, status, swapped_with")
      .eq("status", "swapped_out");

    const { data: activeChildren } = await supabase
      .from("shifts")
      .select("parent_shift_id")
      .eq("status", "active")
      .not("parent_shift_id", "is", null);

    const activeParentIds = new Set((activeChildren || []).map((c) => c.parent_shift_id));
    const orphanParents = (swappedOutParents || []).filter((p) => !activeParentIds.has(p.id));

    // 4. Lingering swap metadata on active shifts
    const { data: activeWithSwapMeta } = await supabase
      .from("shifts")
      .select("id, shift_date, shift_type, swapped_with, original_owner")
      .eq("status", "active")
      .or("swapped_with.not.is.null,original_owner.not.is.null");

    const lingering = (activeWithSwapMeta || []).filter((s) => !activeParentIds.has(s.id));

    return {
      success: true,
      data: {
        orphanCancelledChildren: cancelledChildren || [],
        orphanSwappedOutParents: orphanParents,
        corruptBeamShifts: beamShifts || [],
        lingeringSwapMetadata: lingering,
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to detect corrupted swap data" },
    };
  }
}

/**
 * Execute repair of corrupted swap data in the database (BACKLOG.md §9.5)
 */
export async function repairCorruptedSwapDataAction(): Promise<
  ActionResult<{
    purgedBeamCount: number;
    purgedCancelledCount: number;
    restoredParentCount: number;
    clearedLingeringCount: number;
  }>
> {
  try {
    const supabase = await createClient();

    // 1. Purge Beam corrupt child
    const { data: deletedBeam, error: errBeam } = await supabase
      .from("shifts")
      .delete()
      .eq("shift_date", "2026-11-03")
      .eq("shift_type", "afternoon")
      .or("swapped_with.eq.บีม,original_owner.eq.บีม,parent_shift_id.not.is.null")
      .select("id");

    if (errBeam) {
      return { success: false, error: { code: "DATABASE_ERROR", message: errBeam.message } };
    }

    // 2. Delete all child shifts marked as 'cancelled'
    const { data: deletedCancelled, error: errCancelled } = await supabase
      .from("shifts")
      .delete()
      .eq("status", "cancelled")
      .not("parent_shift_id", "is", null)
      .select("id");

    if (errCancelled) {
      return { success: false, error: { code: "DATABASE_ERROR", message: errCancelled.message } };
    }

    // 3. Find parent shifts that remain swapped_out without active children
    const { data: activeChildren } = await supabase
      .from("shifts")
      .select("parent_shift_id")
      .eq("status", "active")
      .not("parent_shift_id", "is", null);

    const activeParentIds = new Set((activeChildren || []).map((c) => c.parent_shift_id));

    const { data: allSwappedOut } = await supabase
      .from("shifts")
      .select("id")
      .eq("status", "swapped_out");

    const parentsToRestore = (allSwappedOut || [])
      .map((p) => p.id)
      .filter((id) => !activeParentIds.has(id));

    let restoredCount = 0;
    if (parentsToRestore.length > 0) {
      const { data: restored, error: errRestore } = await supabase
        .from("shifts")
        .update({
          status: "active",
          swapped_with: null,
          swap_date: null,
          swap_reason: null,
          original_owner: null,
          swap_history: [],
        })
        .in("id", parentsToRestore)
        .select("id");

      if (errRestore) {
        return { success: false, error: { code: "DATABASE_ERROR", message: errRestore.message } };
      }
      restoredCount = restored?.length || 0;
    }

    // 4. Clear lingering swap metadata on active shifts without active child
    const { data: activeWithMeta } = await supabase
      .from("shifts")
      .select("id")
      .eq("status", "active")
      .or("swapped_with.not.is.null,original_owner.not.is.null");

    const lingeringToClear = (activeWithMeta || [])
      .map((s) => s.id)
      .filter((id) => !activeParentIds.has(id));

    let clearedCount = 0;
    if (lingeringToClear.length > 0) {
      const { data: cleared, error: errClear } = await supabase
        .from("shifts")
        .update({
          swapped_with: null,
          swap_date: null,
          swap_reason: null,
          original_owner: null,
          swap_history: [],
        })
        .in("id", lingeringToClear)
        .select("id");

      if (errClear) {
        return { success: false, error: { code: "DATABASE_ERROR", message: errClear.message } };
      }
      clearedCount = cleared?.length || 0;
    }

    return {
      success: true,
      data: {
        purgedBeamCount: deletedBeam?.length || 0,
        purgedCancelledCount: deletedCancelled?.length || 0,
        restoredParentCount: restoredCount,
        clearedLingeringCount: clearedCount,
      },
      message: "ดำเนินการซ่อมแซมข้อมูลการแลกเวรเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to repair swap data" },
    };
  }
}

"use server";

import { createClient } from "../../lib/supabase/server";
import { Medications, ActionResult } from "../../types/vendee";

function mapRowToMedication(row: any): Medications {
  return {
    id: row.id,
    name: row.name,
    size: row.size || undefined,
    unit: row.unit || "ยูนิต",
    price: row.price !== null && row.price !== undefined ? String(row.price) : undefined,
    priceSatang: row.price_satang ? Number(row.price_satang) : undefined,
    description: row.description || undefined,
    note: row.description || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Fetch all medications from Supabase
 */
export async function getMedicationsAction(): Promise<ActionResult<Medications[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("medications")
      .select("*")
      .order("name", { ascending: true });

    if (error) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: error.message },
      };
    }

    const list = (data || []).map(mapRowToMedication);
    return { success: true, data: list };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to fetch medications" },
    };
  }
}

/**
 * Create a new medication record in Supabase
 */
export async function createMedicationAction(data: {
  name: string;
  size?: string;
  unit?: string;
  price?: string | number;
  description?: string;
}): Promise<ActionResult<Medications>> {
  try {
    const supabase = await createClient();

    const priceNum = data.price !== undefined && data.price !== "" ? Number(data.price) : 0;
    const priceSatang = Math.round(priceNum * 100);

    const insertPayload = {
      name: data.name.trim(),
      size: data.size?.trim() || null,
      unit: data.unit?.trim() || "ยูนิต",
      price: priceNum,
      price_satang: priceSatang,
      description: data.description?.trim() || null,
    };

    const { data: created, error } = await supabase
      .from("medications")
      .insert(insertPayload)
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
      data: mapRowToMedication(created),
      message: `เพิ่มข้อมูลยา "${data.name}" เรียบร้อยแล้ว`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to create medication" },
    };
  }
}

/**
 * Update an existing medication record in Supabase
 */
export async function updateMedicationAction(
  id: string,
  data: {
    name?: string;
    size?: string;
    unit?: string;
    price?: string | number;
    description?: string;
  }
): Promise<ActionResult<Medications>> {
  try {
    const supabase = await createClient();

    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) updatePayload.name = data.name.trim();
    if (data.size !== undefined) updatePayload.size = data.size.trim() || null;
    if (data.unit !== undefined) updatePayload.unit = data.unit.trim() || "ยูนิต";
    if (data.description !== undefined) updatePayload.description = data.description.trim() || null;

    if (data.price !== undefined && data.price !== "") {
      const priceNum = Number(data.price);
      updatePayload.price = priceNum;
      updatePayload.price_satang = Math.round(priceNum * 100);
    }

    const { data: updated, error } = await supabase
      .from("medications")
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
      data: mapRowToMedication(updated),
      message: `อัปเดตข้อมูลยาเรียบร้อยแล้ว`,
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to update medication" },
    };
  }
}

/**
 * Delete a medication record from Supabase
 */
export async function deleteMedicationAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("medications").delete().eq("id", id);

    if (error) {
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: error.message },
      };
    }

    return {
      success: true,
      data: { id },
      message: "ลบข้อมูลยาเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to delete medication" },
    };
  }
}

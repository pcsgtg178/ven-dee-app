"use server";

import { createClient } from "../../lib/supabase/server";
import { Customer, ActionResult } from "../../types/vendee";

function mapRowToCustomer(row: any): Customer {
  return {
    id: row.id,
    name: row.name,
    avatarColor: row.avatar_color || "bg-teal-500",
    createdAt: row.created_at,
  };
}

/**
 * Fetch all customers from Supabase
 */
export async function getCustomersAction(): Promise<ActionResult<Customer[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("customers")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[customerActions] Fetch customers DB error:", error);
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: error.message },
      };
    }

    const list = (data || []).map(mapRowToCustomer);
    return { success: true, data: list };
  } catch (err: any) {
    console.error("[customerActions] Fetch customers server error:", err);
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to fetch customers" },
    };
  }
}

/**
 * Create a new customer in Supabase
 */
export async function createCustomerAction(data: {
  id?: string;
  name: string;
  avatarColor?: string;
  createdAt?: string;
}): Promise<ActionResult<Customer>> {
  try {
    const name = data.name.trim();
    if (!name) {
      return {
        success: false,
        error: { code: "VALIDATION_ERROR", message: "กรุณากรอกชื่อลูกค้า" },
      };
    }

    const customerId = data.id || `cust-${Date.now()}`;
    const avatarColor = data.avatarColor || "bg-teal-500";
    const supabase = await createClient();

    const { data: inserted, error } = await supabase
      .from("customers")
      .insert({
        id: customerId,
        name,
        avatar_color: avatarColor,
        created_at: data.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      console.error("[customerActions] Insert customer DB error:", error);
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: error.message },
      };
    }

    return { success: true, data: mapRowToCustomer(inserted) };
  } catch (err: any) {
    console.error("[customerActions] Create customer server error:", err);
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to create customer" },
    };
  }
}

/**
 * Update an existing customer in Supabase
 */
export async function updateCustomerAction(
  id: string,
  data: {
    name?: string;
    avatarColor?: string;
  }
): Promise<ActionResult<Customer>> {
  try {
    const supabase = await createClient();
    const updatePayload: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (data.name !== undefined) {
      const trimmed = data.name.trim();
      if (!trimmed) {
        return {
          success: false,
          error: { code: "VALIDATION_ERROR", message: "กรุณากรอกชื่อลูกค้า" },
        };
      }
      updatePayload.name = trimmed;
    }

    if (data.avatarColor !== undefined) {
      updatePayload.avatar_color = data.avatarColor;
    }

    const { data: updated, error } = await supabase
      .from("customers")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      console.error("[customerActions] Update customer DB error:", error);
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: error.message },
      };
    }

    return { success: true, data: mapRowToCustomer(updated) };
  } catch (err: any) {
    console.error("[customerActions] Update customer server error:", err);
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to update customer" },
    };
  }
}

/**
 * Delete a customer from Supabase
 */
export async function deleteCustomerAction(id: string): Promise<ActionResult<{ id: string }>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("customers").delete().eq("id", id);

    if (error) {
      console.error("[customerActions] Delete customer DB error:", error);
      return {
        success: false,
        error: { code: "DATABASE_ERROR", message: error.message },
      };
    }

    return { success: true, data: { id } };
  } catch (err: any) {
    console.error("[customerActions] Delete customer server error:", err);
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to delete customer" },
    };
  }
}

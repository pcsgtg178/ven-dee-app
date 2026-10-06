"use server";

import { createClient } from "../../lib/supabase/server";
import { ActionResult } from "../../types/vendee";

export interface TodoRecord {
  id: string;
  title: string;
  completed: boolean;
  priceSatang?: number;
  note?: string;
  extraFields?: Record<string, any>;
  createdAt: string;
}

/**
 * Fetch all todos
 */
export async function getTodosAction(): Promise<ActionResult<TodoRecord[]>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("todos").select("*").order("created_at", { ascending: false });

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    const todos: TodoRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      title: row.title,
      completed: row.completed,
      priceSatang: row.price_satang,
      note: row.note,
      extraFields: row.extra_fields || {},
      createdAt: row.created_at,
    }));

    return { success: true, data: todos };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to fetch todos" },
    };
  }
}

/**
 * Create a new todo item
 */
export async function createTodoAction(data: {
  title: string;
  priceSatang?: number;
  note?: string;
  extraFields?: Record<string, any>;
}): Promise<ActionResult<TodoRecord>> {
  try {
    const supabase = await createClient();
    const { data: inserted, error } = await supabase
      .from("todos")
      .insert({
        title: data.title,
        completed: false,
        price_satang: data.priceSatang || 0,
        note: data.note || "",
        extra_fields: data.extraFields || {},
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    const todo: TodoRecord = {
      id: inserted.id,
      title: inserted.title,
      completed: inserted.completed,
      priceSatang: inserted.price_satang,
      note: inserted.note,
      extraFields: inserted.extra_fields,
      createdAt: inserted.created_at,
    };

    return { success: true, data: todo, message: "สร้างรายการ Todo เรียบร้อยแล้ว" };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to create todo" },
    };
  }
}

/**
 * Toggle todo completed status
 */
export async function toggleTodoAction(id: string, completed: boolean): Promise<ActionResult<TodoRecord>> {
  try {
    const supabase = await createClient();
    const { data: updated, error } = await supabase
      .from("todos")
      .update({ completed })
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    const todo: TodoRecord = {
      id: updated.id,
      title: updated.title,
      completed: updated.completed,
      priceSatang: updated.price_satang,
      note: updated.note,
      extraFields: updated.extra_fields,
      createdAt: updated.created_at,
    };

    return { success: true, data: todo };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to toggle todo" },
    };
  }
}

/**
 * Delete a todo
 */
export async function deleteTodoAction(id: string): Promise<ActionResult<{ deletedId: string }>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("todos").delete().eq("id", id);

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    return { success: true, data: { deletedId: id }, message: "ลบ Todo เรียบร้อยแล้ว" };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to delete todo" },
    };
  }
}

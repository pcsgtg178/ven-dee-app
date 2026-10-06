"use server";

import { createClient } from "../../lib/supabase/server";
import { PersonalEventRecord, RelationshipTag, ActionResult } from "../../types/vendee";
import { checkPersonalEventOverlap } from "../../lib/conflictEngine";
import { getShiftsAction } from "./shiftActions";
import { getServicesAction } from "./serviceActions";

/**
 * Fetch all personal events
 */
export async function getPersonalEventsAction(params?: {
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<ActionResult<PersonalEventRecord[]>> {
  try {
    const supabase = await createClient();
    let query = supabase.from("personal_events").select("*");

    if (params?.date) query = query.eq("event_date", params.date);
    if (params?.startDate && params?.endDate) {
      query = query.gte("event_date", params.startDate).lte("event_date", params.endDate);
    }

    const { data, error } = await query;

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    const events: PersonalEventRecord[] = (data || []).map((row: any) => ({
      id: row.id,
      type: "personal_event",
      title: row.title,
      date: row.event_date,
      eventDate: row.event_date,
      startTime: row.start_time,
      endTime: row.end_time,
      isAllDay: row.is_all_day,
      relationshipTag: row.relationship_tag as RelationshipTag,
      location: row.location,
      notes: row.notes,
      createdAt: row.created_at,
    }));

    return { success: true, data: events };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to fetch personal events" },
    };
  }
}

/**
 * Create a new personal event with overlap warning check
 */
export async function createPersonalEventAction(data: {
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  relationshipTag?: RelationshipTag;
  location?: string;
  notes?: string;
}): Promise<ActionResult<{ event: PersonalEventRecord; warning?: string }>> {
  try {
    const supabase = await createClient();

    // Fetch existing shifts & services to check for PERSONAL_EVENT_OVERLAP_WARNING
    const shiftsRes = await getShiftsAction({ startDate: data.eventDate, endDate: data.eventDate });
    const servicesRes = await getServicesAction({ date: data.eventDate });

    const existingShifts = shiftsRes.success ? shiftsRes.data : [];
    const existingServices = servicesRes.success ? servicesRes.data : [];

    const overlapWarning = checkPersonalEventOverlap(
      data.eventDate,
      data.startTime,
      data.endTime,
      existingShifts,
      existingServices
    );

    const { data: inserted, error } = await supabase
      .from("personal_events")
      .insert({
        title: data.title,
        event_date: data.eventDate,
        start_time: data.startTime,
        end_time: data.endTime,
        is_all_day: data.isAllDay || false,
        relationship_tag: data.relationshipTag || "other",
        location: data.location || "",
        notes: data.notes || "",
      })
      .select()
      .single();

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    const eventRecord: PersonalEventRecord = {
      id: inserted.id,
      type: "personal_event",
      title: inserted.title,
      date: inserted.event_date,
      eventDate: inserted.event_date,
      startTime: inserted.start_time,
      endTime: inserted.end_time,
      isAllDay: inserted.is_all_day,
      relationshipTag: inserted.relationship_tag as RelationshipTag,
      location: inserted.location,
      notes: inserted.notes,
      createdAt: inserted.created_at,
    };

    return {
      success: true,
      data: {
        event: eventRecord,
        warning: overlapWarning.isWarningOnly ? overlapWarning.message : undefined,
      },
      message: "บันทึกธุระส่วนตัวเรียบร้อยแล้ว",
    };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to create personal event" },
    };
  }
}

/**
 * Delete personal event
 */
export async function deletePersonalEventAction(id: string): Promise<ActionResult<{ deletedId: string }>> {
  try {
    const supabase = await createClient();
    const { error } = await supabase.from("personal_events").delete().eq("id", id);

    if (error) {
      return { success: false, error: { code: "DATABASE_ERROR", message: error.message } };
    }

    return { success: true, data: { deletedId: id }, message: "ลบธุระส่วนตัวเรียบร้อยแล้ว" };
  } catch (err: any) {
    return {
      success: false,
      error: { code: "SERVER_ERROR", message: err.message || "Failed to delete personal event" },
    };
  }
}

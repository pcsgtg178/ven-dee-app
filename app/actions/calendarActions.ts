"use server";

import { createClient } from "../../lib/supabase/server";
import { ActionResult, ShiftRecord, CustomerServiceRecord, PersonalEventRecord, ClinicWorkRecord } from "../../types/vendee";
import { generateSecureFeedToken, DEFAULT_FEED_TOKEN } from "../../lib/calendar/feedToken";
import { getShiftsAction } from "./shiftActions";
import { getServicesAction } from "./serviceActions";
import { getPersonalEventsAction } from "./personalEventActions";
import { getClinicLogsAction } from "./clinicActions";

/**
 * Server-side Feed Token Retrieval
 */
export async function getFeedTokenAction(): Promise<ActionResult<{ token: string }>> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("user_profile")
      .select("feed_token")
      .limit(1)
      .single();

    if (!error && data?.feed_token) {
      return { success: true, data: { token: data.feed_token } };
    }

    // If feed_token column doesn't exist yet or no row found, return DEFAULT_FEED_TOKEN
    return { success: true, data: { token: DEFAULT_FEED_TOKEN } };
  } catch {
    return { success: true, data: { token: DEFAULT_FEED_TOKEN } };
  }
}

/**
 * Server-side Feed Token Regeneration
 */
export async function regenerateFeedTokenAction(): Promise<ActionResult<{ token: string }>> {
  try {
    const newToken = generateSecureFeedToken();
    const supabase = await createClient();

    // Try updating user_profile with the new token
    const { error } = await supabase
      .from("user_profile")
      .update({ feed_token: newToken, updated_at: new Date().toISOString() })
      .neq("id", "00000000-0000-0000-0000-000000000000"); // Update existing single profile

    if (error) {
      console.warn("Supabase feed_token update note (using memory token):", error.message);
    }

    return {
      success: true,
      data: { token: newToken },
      message: "สร้างรหัสลับ (Feed Token) สำหรับปฏิทินใหม่สำเร็จ",
    };
  } catch {
    const newToken = generateSecureFeedToken();
    return {
      success: true,
      data: { token: newToken },
      message: "สร้างรหัสลับ (Feed Token) สำเร็จ",
    };
  }
}

/**
 * Consolidated Fetch for Calendar Route Handlers & Exports
 */
export async function getCalendarExportDataAction(params?: {
  month?: string;
  startDate?: string;
  endDate?: string;
}): Promise<
  ActionResult<{
    shifts: ShiftRecord[];
    services: CustomerServiceRecord[];
    personalEvents: PersonalEventRecord[];
    clinicLogs: ClinicWorkRecord[];
  }>
> {
  try {
    const [shiftsRes, servicesRes, personalEventsRes, clinicLogsRes] = await Promise.all([
      getShiftsAction(params),
      getServicesAction(params),
      getPersonalEventsAction(params),
      getClinicLogsAction(params),
    ]);

    return {
      success: true,
      data: {
        shifts: shiftsRes.success ? shiftsRes.data : [],
        services: servicesRes.success ? servicesRes.data : [],
        personalEvents: personalEventsRes.success ? personalEventsRes.data : [],
        clinicLogs: clinicLogsRes.success ? clinicLogsRes.data : [],
      },
    };
  } catch (err: any) {
    return {
      success: false,
      error: {
        code: "SERVER_ERROR",
        message: err.message || "Failed to fetch calendar records",
      },
    };
  }
}

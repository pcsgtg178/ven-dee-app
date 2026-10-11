import { NextRequest, NextResponse } from "next/server";
import { generateIcsCalendar } from "../../../../lib/calendar/icsGenerator";
import { getCalendarExportDataAction } from "../../../actions/calendarActions";
import { initialShifts, initialServices, initialClinicLogs } from "../../../../lib/storage";
import { ShiftCategory } from "../../../../types/vendee";

/**
 * On-demand iCalendar (.ics) File Export Handler
 *
 * Adheres to:
 * - PROJECT_RULES.md Section 5.1 & 5.2
 * - DOMAIN_RULES.md Section 4
 *
 * Query Parameters:
 * - month (YYYY-MM)
 * - startDate (YYYY-MM-DD)
 * - endDate (YYYY-MM-DD)
 * - includeOff ("true" | "false", default: false)
 * - includeShifts ("true" | "false", default: true)
 * - includeServices ("true" | "false", default: true)
 * - includePersonalEvents ("true" | "false", default: true)
 * - includeClinic ("true" | "false", default: true)
 * - categories (comma-separated: "black,red,green")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const month = searchParams.get("month") || undefined;
    const startDate = searchParams.get("startDate") || undefined;
    const endDate = searchParams.get("endDate") || undefined;

    const includeOff = searchParams.get("includeOff") === "true";
    const includeShifts = searchParams.get("includeShifts") !== "false";
    const includeServices = searchParams.get("includeServices") !== "false";
    const includePersonalEvents = searchParams.get("includePersonalEvents") !== "false";
    const includeClinic = searchParams.get("includeClinic") !== "false";

    const categoriesParam = searchParams.get("categories");
    const categories = categoriesParam
      ? (categoriesParam.split(",").map((c) => c.trim()) as ShiftCategory[])
      : undefined;

    // Fetch database records
    const res = await getCalendarExportDataAction({ month, startDate, endDate });

    let shifts = res.success && res.data.shifts.length > 0 ? res.data.shifts : initialShifts;
    let services = res.success && res.data.services.length > 0 ? res.data.services : initialServices;
    let personalEvents = res.success ? res.data.personalEvents : [];
    let clinicLogs = initialClinicLogs;

    const icsContent = generateIcsCalendar({
      shifts,
      services,
      clinicLogs,
      personalEvents,
      options: {
        month,
        startDate,
        endDate,
        includeOffDays: includeOff,
        includeShifts,
        includeServices,
        includePersonalEvents,
        includeClinic,
        categories,
      },
      calendarName: month ? `ตารางเวร VenDee (${month})` : "ตารางเวร VenDee",
    });

    const filenameMonth = month || new Date().toISOString().slice(0, 7);

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="vendee-${filenameMonth}.ics"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "EXPORT_FAILED",
          message: err.message || "Failed to generate iCalendar file",
        },
      },
      { status: 500 }
    );
  }
}

/**
 * POST handler allowing clients to pass direct active state payload for instant export
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      shifts = initialShifts,
      services = initialServices,
      clinicLogs = initialClinicLogs,
      personalEvents = [],
      options = {},
      calendarName = "ตารางเวร VenDee",
    } = body;

    const icsContent = generateIcsCalendar({
      shifts,
      services,
      clinicLogs,
      personalEvents,
      options,
      calendarName,
    });

    const monthStr = options.month || new Date().toISOString().slice(0, 7);

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": `attachment; filename="vendee-${monthStr}.ics"`,
        "Cache-Control": "private, max-age=0, must-revalidate",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "EXPORT_FAILED",
          message: err.message || "Failed to process iCalendar export",
        },
      },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { generateIcsCalendar } from "../../../../lib/calendar/icsGenerator";
import { getCalendarExportDataAction, getFeedTokenAction } from "../../../actions/calendarActions";
import { isValidFeedToken, DEFAULT_FEED_TOKEN } from "../../../../lib/calendar/feedToken";
import { initialShifts, initialServices, initialClinicLogs } from "../../../../lib/storage";

/**
 * Continuous WebCal Live Feed Subscription Route Handler
 *
 * Adheres to:
 * - PROJECT_RULES.md Section 5.1 & 5.2 (iCalendar RFC 5545 & WebCal feed sync)
 * - DOMAIN_RULES.md Section 4 (Security, privacy, and token validation)
 *
 * iOS Calendar Integration:
 * - Direct HTTP GET request executed by iOS Calendar background synchronization daemon
 * - URL scheme: webcal://<domain>/api/calendar/feed?token=<secure_token>
 * - Content-Disposition: inline; filename="vendee-feed.ics"
 * - Cache-Control: no-cache, no-store, max-age=0, must-revalidate
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const token = searchParams.get("token");

    // 1. Authenticate token
    const tokenRes = await getFeedTokenAction();
    const validToken = tokenRes.success && tokenRes.data.token ? tokenRes.data.token : DEFAULT_FEED_TOKEN;

    if (!isValidFeedToken(token, validToken)) {
      return NextResponse.json(
        {
          success: false,
          error: {
            code: "UNAUTHORIZED",
            message: "รหัสเข้าถึงปฏิทิน (Feed Token) ไม่ถูกต้อง หรือยังไม่ได้ระบุโทเค็น",
          },
        },
        { status: 401 }
      );
    }

    // 2. Fetch live database records
    const res = await getCalendarExportDataAction();

    let shifts = res.success && res.data.shifts.length > 0 ? res.data.shifts : initialShifts;
    let services = res.success && res.data.services.length > 0 ? res.data.services : initialServices;
    let personalEvents = res.success ? res.data.personalEvents : [];
    let clinicLogs = res.success && res.data.clinicLogs.length > 0 ? res.data.clinicLogs : initialClinicLogs;

    // Optional query overrides (e.g. ?includeOff=true)
    const includeOff = searchParams.get("includeOff") === "true";

    // 3. Generate RFC 5545 calendar stream
    const icsContent = generateIcsCalendar({
      shifts,
      services,
      clinicLogs,
      personalEvents,
      options: {
        includeOffDays: includeOff,
        includeShifts: true,
        includeServices: true,
        includePersonalEvents: true,
        includeClinic: true,
      },
      calendarName: "ตารางเวร VenDee (Live Feed)",
    });

    return new NextResponse(icsContent, {
      status: 200,
      headers: {
        "Content-Type": "text/calendar; charset=utf-8",
        "Content-Disposition": 'inline; filename="vendee-feed.ics"',
        "Cache-Control": "no-cache, no-store, max-age=0, must-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: "FEED_ERROR",
          message: err.message || "Failed to process WebCal subscription feed",
        },
      },
      { status: 500 }
    );
  }
}

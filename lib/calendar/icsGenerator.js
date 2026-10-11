"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.escapeIcsText = escapeIcsText;
exports.foldLine = foldLine;
exports.getNextDayDateString = getNextDayDateString;
exports.formatIcsDate = formatIcsDate;
exports.formatIcsTime = formatIcsTime;
exports.getUtcTimestamp = getUtcTimestamp;
exports.generateIcsCalendar = generateIcsCalendar;
const vendee_1 = require("../../types/vendee");
/**
 * RFC 5545 Compliant iCalendar Generator Engine for VenDee
 *
 * Strict Compliance Standards:
 * - Line Terminators: CRLF (\r\n) strictly enforced. Bare LF (\n) is prohibited.
 * - Line Folding: Lines exceeding 75 octets are folded with CRLF + space (\r\n ).
 * - Text Escaping: Backslashes, semicolons, commas, and newlines are properly escaped.
 * - Timezone: Embedded Asia/Bangkok (UTC+07:00, no DST) VTIMEZONE block.
 * - Deterministic UIDs: vendee-{type}-{id}@vendee.app prevents duplication.
 * - Glanceable UX & Emojis: Tailored for iOS Dynamic Island, Lock Screen, and Apple Watch.
 * - VALARM Triggers: Pre-shift and pre-appointment alerts.
 */
const CRLF = "\r\n";
/**
 * Escape text according to RFC 5545 section 3.3.11
 */
function escapeIcsText(text) {
    if (!text)
        return "";
    return text
        .replace(/\\/g, "\\\\")
        .replace(/;/g, "\\;")
        .replace(/,/g, "\\,")
        .replace(/\r\n|\r|\n/g, "\\n");
}
/**
 * Fold lines longer than 75 octets according to RFC 5545 section 3.1
 * UTF-8 byte-length aware to avoid splitting multibyte characters.
 */
function foldLine(line) {
    const MAX_BYTES = 75;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(line);
    if (bytes.length <= MAX_BYTES) {
        return line;
    }
    let result = "";
    let currentChunk = "";
    let currentBytes = 0;
    for (const char of line) {
        const charBytes = encoder.encode(char).length;
        // Continuation lines start with a space (\r\n ), leaving 74 bytes for content
        const maxLimit = result.length === 0 ? MAX_BYTES : MAX_BYTES - 1;
        if (currentBytes + charBytes > maxLimit) {
            if (result.length === 0) {
                result = currentChunk;
            }
            else {
                result += CRLF + " " + currentChunk;
            }
            currentChunk = char;
            currentBytes = charBytes;
        }
        else {
            currentChunk += char;
            currentBytes += charBytes;
        }
    }
    if (currentChunk.length > 0) {
        if (result.length === 0) {
            result = currentChunk;
        }
        else {
            result += CRLF + " " + currentChunk;
        }
    }
    return result;
}
/**
 * Helper to calculate the next day in YYYYMMDD format
 * (Required because RFC 5545 DTEND for VALUE=DATE all-day events is non-inclusive)
 */
function getNextDayDateString(dateStr) {
    const parts = dateStr.split("-");
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1;
    const day = parseInt(parts[2], 10);
    const date = new Date(Date.UTC(year, month, day));
    date.setUTCDate(date.getUTCDate() + 1);
    const nextY = date.getUTCFullYear();
    const nextM = String(date.getUTCMonth() + 1).padStart(2, "0");
    const nextD = String(date.getUTCDate()).padStart(2, "0");
    return `${nextY}${nextM}${nextD}`;
}
/**
 * Helper to format date into YYYYMMDD
 */
function formatIcsDate(dateStr) {
    return dateStr.replace(/-/g, "");
}
/**
 * Helper to format local time (HH:mm) into HHMMSS
 */
function formatIcsTime(timeStr) {
    const clean = timeStr.trim().slice(0, 5);
    const [hh, mm] = clean.split(":");
    const h = (hh || "00").padStart(2, "0");
    const m = (mm || "00").padStart(2, "0");
    return `${h}${m}00`;
}
/**
 * Generate current UTC timestamp in YYYYMMDDTHHMMSSZ for DTSTAMP
 */
function getUtcTimestamp() {
    const now = new Date();
    const y = now.getUTCFullYear();
    const m = String(now.getUTCMonth() + 1).padStart(2, "0");
    const d = String(now.getUTCDate()).padStart(2, "0");
    const h = String(now.getUTCHours()).padStart(2, "0");
    const min = String(now.getUTCMinutes()).padStart(2, "0");
    const s = String(now.getUTCSeconds()).padStart(2, "0");
    return `${y}${m}${d}T${h}${min}${s}Z`;
}
/**
 * Main function to generate RFC 5545 compliant iCalendar string
 */
function generateIcsCalendar(input) {
    const { shifts = [], services = [], clinicLogs = [], personalEvents = [], options = {}, calendarName = "ตารางเวร VenDee", } = input;
    const dtstamp = getUtcTimestamp();
    const lines = [];
    // VCALENDAR Header
    lines.push("BEGIN:VCALENDAR");
    lines.push("VERSION:2.0");
    lines.push("PRODID:-//VenDee App//VenDee Nurse Schedule//TH");
    lines.push("CALSCALE:GREGORIAN");
    lines.push("METHOD:PUBLISH");
    lines.push(`X-WR-CALNAME:${escapeIcsText(calendarName)}`);
    lines.push("X-WR-TIMEZONE:Asia/Bangkok");
    // VTIMEZONE Block for Asia/Bangkok (+07:00 Standard Time, No DST)
    lines.push("BEGIN:VTIMEZONE");
    lines.push("TZID:Asia/Bangkok");
    lines.push("LAST-MODIFIED:20240101T000000Z");
    lines.push("TZURL:http://tzurl.org/zoneinfo-outlook/Asia/Bangkok");
    lines.push("X-LIC-LOCATION:Asia/Bangkok");
    lines.push("BEGIN:STANDARD");
    lines.push("TZNAME:ICT");
    lines.push("TZOFFSETFROM:+0700");
    lines.push("TZOFFSETTO:+0700");
    lines.push("DTSTART:19700101T000000");
    lines.push("END:STANDARD");
    lines.push("END:VTIMEZONE");
    // Filter criteria
    const { month, startDate, endDate, includeShifts = true, includeServices = true, includePersonalEvents = true, includeClinic = true, includeOffDays = false, // Default false per DOMAIN_RULES 4.1.2
    categories, } = options;
    const isDateInRange = (dateStr) => {
        if (month && !dateStr.startsWith(month)) {
            return false;
        }
        if (startDate && dateStr < startDate) {
            return false;
        }
        if (endDate && dateStr > endDate) {
            return false;
        }
        return true;
    };
    // 1. HOSPITAL SHIFTS (ShiftRecord)
    if (includeShifts) {
        shifts.forEach((shift) => {
            // Invariant: Only 'active' shifts are exported as regular events (DOMAIN_RULES 4.1.1)
            if (shift.status !== "active") {
                return;
            }
            // Filter off-duty days if not explicitly included
            if (shift.shiftType === "off" && !includeOffDays) {
                return;
            }
            // Date range filter
            if (!isDateInRange(shift.date)) {
                return;
            }
            // Category filter if specified
            if (categories && categories.length > 0 && !categories.includes(shift.category)) {
                return;
            }
            const uid = `vendee-shift-${shift.id}@vendee.app`;
            const dateIcs = formatIcsDate(shift.date);
            const dept = shift.department ? shift.department.trim() : "รพ.";
            lines.push("BEGIN:VEVENT");
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${dtstamp}`);
            lines.push("STATUS:CONFIRMED");
            // Shift Time Boundaries & Summaries per DOMAIN_RULES 4.2 & 4.3
            if (shift.shiftType === "morning") {
                // Morning: 08:00 - 16:00
                const isRed = shift.category === "red";
                const summary = isRed ? `🔴 [เวรแดง OT] เช้า ${dept}` : `☀️ [เวรเช้า] ${dept}`;
                lines.push(`DTSTART;TZID=Asia/Bangkok:${dateIcs}T080000`);
                lines.push(`DTEND;TZID=Asia/Bangkok:${dateIcs}T160000`);
                lines.push(`SUMMARY:${escapeIcsText(summary)}`);
                // Description
                const descParts = [
                    `หมวดเวร: ${isRed ? "เวรแดง (OT/เวรช่วย)" : "เวรดำ (เวรประจำ)"}`,
                    `เวลาปฏิบัติงาน: 08:00 - 16:00 น.`,
                ];
                if (shift.swapMeta?.swappedWith) {
                    descParts.push(`แลกมาจาก: ${shift.swapMeta.swappedWith}`);
                }
                if (shift.swapMeta?.originalOwner) {
                    descParts.push(`เจ้าของเดิม: ${shift.swapMeta.originalOwner}`);
                }
                if (shift.note) {
                    descParts.push(`หมายเหตุ: ${shift.note}`);
                }
                lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
                // VALARM: 90 minutes before
                lines.push("BEGIN:VALARM");
                lines.push("ACTION:DISPLAY");
                lines.push("DESCRIPTION:เตือนเตรียมตัวเข้าเวรเช้า (08:00 - 16:00)");
                lines.push("TRIGGER:-PT90M");
                lines.push("END:VALARM");
            }
            else if (shift.shiftType === "afternoon") {
                // Afternoon: 16:00 - 24:00 (ends next day 00:00:00)
                const isRed = shift.category === "red";
                const nextDayIcs = getNextDayDateString(shift.date);
                const summary = isRed ? `🔴 [เวรแดง OT] บ่าย ${dept}` : `🌤️ [เวรบ่าย] ${dept}`;
                lines.push(`DTSTART;TZID=Asia/Bangkok:${dateIcs}T160000`);
                lines.push(`DTEND;TZID=Asia/Bangkok:${nextDayIcs}T000000`);
                lines.push(`SUMMARY:${escapeIcsText(summary)}`);
                // Description
                const descParts = [
                    `หมวดเวร: ${isRed ? "เวรแดง (OT/เวรช่วย)" : "เวรดำ (เวรประจำ)"}`,
                    `เวลาปฏิบัติงาน: 16:00 - 24:00 น.`,
                ];
                if (shift.swapMeta?.swappedWith) {
                    descParts.push(`แลกมาจาก: ${shift.swapMeta.swappedWith}`);
                }
                if (shift.swapMeta?.originalOwner) {
                    descParts.push(`เจ้าของเดิม: ${shift.swapMeta.originalOwner}`);
                }
                if (shift.note) {
                    descParts.push(`หมายเหตุ: ${shift.note}`);
                }
                lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
                // VALARM: 2 hours before
                lines.push("BEGIN:VALARM");
                lines.push("ACTION:DISPLAY");
                lines.push("DESCRIPTION:เตือนเตรียมตัวเข้าเวรบ่าย (16:00 - 24:00)");
                lines.push("TRIGGER:-PT2H");
                lines.push("END:VALARM");
            }
            else if (shift.shiftType === "night") {
                // Night: 00:00 - 08:00
                const isRed = shift.category === "red";
                const summary = isRed ? `🔴 [เวรแดง OT] ดึก ${dept}` : `🌙 [เวรดึก] ${dept}`;
                lines.push(`DTSTART;TZID=Asia/Bangkok:${dateIcs}T000000`);
                lines.push(`DTEND;TZID=Asia/Bangkok:${dateIcs}T080000`);
                lines.push(`SUMMARY:${escapeIcsText(summary)}`);
                // Description
                const descParts = [
                    `หมวดเวร: ${isRed ? "เวรแดง (OT/เวรช่วย)" : "เวรดำ (เวรประจำ)"}`,
                    `เวลาปฏิบัติงาน: 00:00 - 08:00 น.`,
                ];
                if (shift.swapMeta?.swappedWith) {
                    descParts.push(`แลกมาจาก: ${shift.swapMeta.swappedWith}`);
                }
                if (shift.swapMeta?.originalOwner) {
                    descParts.push(`เจ้าของเดิม: ${shift.swapMeta.originalOwner}`);
                }
                if (shift.note) {
                    descParts.push(`หมายเหตุ: ${shift.note}`);
                }
                lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
                // VALARM: 2 alarms (Evening 20:00 sleep reminder = -PT4H, and 2 hours before = -PT2H)
                lines.push("BEGIN:VALARM");
                lines.push("ACTION:DISPLAY");
                lines.push("DESCRIPTION:เตือนพักผ่อนก่อนเข้าเวรดึกคืนนี้");
                lines.push("TRIGGER:-PT4H");
                lines.push("END:VALARM");
                lines.push("BEGIN:VALARM");
                lines.push("ACTION:DISPLAY");
                lines.push("DESCRIPTION:เตือนเตรียมตัวเข้าเวรดึก (00:00 - 08:00)");
                lines.push("TRIGGER:-PT2H");
                lines.push("END:VALARM");
            }
            else if (shift.shiftType === "r1" || shift.shiftType === "r2") {
                // Refer Standby 24 hrs: All-Day Event
                const teamNum = shift.shiftType === "r1" ? "1" : "2";
                const summary = `🚑 [เวร Refer] ทีม ${teamNum} (Standby 24 ชม.)`;
                const nextDayIcs = getNextDayDateString(shift.date);
                lines.push(`DTSTART;VALUE=DATE:${dateIcs}`);
                lines.push(`DTEND;VALUE=DATE:${nextDayIcs}`);
                lines.push(`SUMMARY:${escapeIcsText(summary)}`);
                const descParts = [
                    `เวร Refer ฉุกเฉิน (สแตนด์บายเตรียมพร้อมส่งต่อผู้ป่วย 24 ชม.)`,
                    `ทีม: ทีม ${teamNum}`,
                ];
                if (shift.swapMeta?.swappedWith) {
                    descParts.push(`แลกมาจาก: ${shift.swapMeta.swappedWith}`);
                }
                if (shift.note) {
                    descParts.push(`หมายเหตุ: ${shift.note}`);
                }
                lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
                // Morning reminder at start of standby day
                lines.push("BEGIN:VALARM");
                lines.push("ACTION:DISPLAY");
                lines.push(`DESCRIPTION:เตือนเวร Refer ทีม ${teamNum} สแตนด์บาย 24 ชม.`);
                lines.push("TRIGGER:-PT0M");
                lines.push("END:VALARM");
            }
            else if (shift.shiftType === "ctm" || shift.shiftType === "cta") {
                // CT Scan Slots
                const isMorning = shift.shiftType === "ctm";
                const summary = isMorning
                    ? `🩺 [เวร CT เช้า] ${shift.department || "ห้อง CT"}`
                    : `🩺 [เวร CT บ่าย] ${shift.department || "ห้อง CT"}`;
                const startTime = isMorning ? "080000" : "120000";
                const endTime = isMorning ? "160000" : "200000";
                lines.push(`DTSTART;TZID=Asia/Bangkok:${dateIcs}T${startTime}`);
                lines.push(`DTEND;TZID=Asia/Bangkok:${dateIcs}T${endTime}`);
                lines.push(`SUMMARY:${escapeIcsText(summary)}`);
                const descParts = [
                    `เวรห้อง CT Scan (${isMorning ? "ช่วงเช้า" : "ช่วงบ่าย"})`,
                ];
                if (shift.note)
                    descParts.push(`หมายเหตุ: ${shift.note}`);
                lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
                lines.push("BEGIN:VALARM");
                lines.push("ACTION:DISPLAY");
                lines.push(`DESCRIPTION:เตือนเวร CT (${isMorning ? "เช้า" : "บ่าย"})`);
                lines.push(isMorning ? "TRIGGER:-PT90M" : "TRIGGER:-PT2H");
                lines.push("END:VALARM");
            }
            else if (shift.shiftType === "off") {
                // Off Day: All-Day Event
                const summary = `☕ [เวรออฟ] วันหยุด`;
                const nextDayIcs = getNextDayDateString(shift.date);
                lines.push(`DTSTART;VALUE=DATE:${dateIcs}`);
                lines.push(`DTEND;VALUE=DATE:${nextDayIcs}`);
                lines.push(`SUMMARY:${escapeIcsText(summary)}`);
                lines.push(`DESCRIPTION:${escapeIcsText("วันหยุดพักผ่อน (Off Duty)")}`);
            }
            lines.push("END:VEVENT");
        });
    }
    // 2. CUSTOMER SERVICES (CustomerServiceRecord)
    if (includeServices) {
        services.forEach((service) => {
            // Invariant: Only 'upcoming' and 'completed' exported (DOMAIN_RULES 4.1.3)
            if (service.status === "cancelled") {
                return;
            }
            if (!isDateInRange(service.date)) {
                return;
            }
            const uid = `vendee-service-${service.id}@vendee.app`;
            const dateIcs = formatIcsDate(service.date);
            const startTimeFormatted = formatIcsTime(service.time || "09:00");
            // Calculate end time = time + durationHours (default 1 hour)
            const duration = service.durationHours && service.durationHours > 0 ? service.durationHours : 1;
            const [startHour, startMin] = (service.time || "09:00").split(":").map((v) => parseInt(v, 10));
            const endTotalMinutes = (startHour || 9) * 60 + (startMin || 0) + Math.round(duration * 60);
            const endHour = Math.floor(endTotalMinutes / 60) % 24;
            const endMin = endTotalMinutes % 60;
            const endTimeFormatted = `${String(endHour).padStart(2, "0")}${String(endMin).padStart(2, "0")}00`;
            // Glanceable Summary: 💉 เคหะ: คุณ{customerName} ({serviceLabels})
            const serviceLabels = (service.services || [])
                .map((st) => vendee_1.SERVICE_CONFIG[st]?.label || st)
                .join(", ");
            const summary = `💉 เคหะ: คุณ${service.customerName} (${serviceLabels || "บริการเคหะบริบาล"})`;
            lines.push("BEGIN:VEVENT");
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${dtstamp}`);
            lines.push("STATUS:CONFIRMED");
            lines.push(`DTSTART;TZID=Asia/Bangkok:${dateIcs}T${startTimeFormatted}`);
            lines.push(`DTEND;TZID=Asia/Bangkok:${dateIcs}T${endTimeFormatted}`);
            lines.push(`SUMMARY:${escapeIcsText(summary)}`);
            // Patient Privacy Guard: Only general nickname and medical labels, NO sensitive IDs
            const descParts = [
                `ผู้รับบริการ: คุณ${service.customerName}`,
                `หัตถการ/บริการ: ${serviceLabels || "เคหะบริบาล"}`,
            ];
            if (service.medications && service.medications.length > 0) {
                descParts.push(`รายการยา/เวชภัณฑ์: ${service.medications.join(", ")}`);
            }
            if (service.note) {
                descParts.push(`บันทึกอาการ/เคส: ${service.note}`);
            }
            if (service.price) {
                descParts.push(`ค่าบริการ: ${service.price.toLocaleString()} บาท`);
            }
            lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
            // VALARM: 60 minutes before appointment
            lines.push("BEGIN:VALARM");
            lines.push("ACTION:DISPLAY");
            lines.push(`DESCRIPTION:เตือนนัดหมายเคหะบริบาล คุณ${service.customerName} เวลา ${service.time} น.`);
            lines.push("TRIGGER:-PT60M");
            lines.push("END:VALARM");
            lines.push("END:VEVENT");
        });
    }
    // 3. PERSONAL EVENTS (PersonalEventRecord)
    if (includePersonalEvents) {
        personalEvents.forEach((pe) => {
            const eventDate = pe.eventDate || pe.date;
            if (!isDateInRange(eventDate)) {
                return;
            }
            const uid = `vendee-event-${pe.id}@vendee.app`;
            const dateIcs = formatIcsDate(eventDate);
            const summary = `🌸 ธุระ: ${pe.title}`;
            lines.push("BEGIN:VEVENT");
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${dtstamp}`);
            lines.push("STATUS:CONFIRMED");
            if (pe.isAllDay) {
                const nextDayIcs = getNextDayDateString(eventDate);
                lines.push(`DTSTART;VALUE=DATE:${dateIcs}`);
                lines.push(`DTEND;VALUE=DATE:${nextDayIcs}`);
            }
            else {
                const startFormatted = formatIcsTime(pe.startTime || "09:00");
                const endFormatted = formatIcsTime(pe.endTime || "10:00");
                lines.push(`DTSTART;TZID=Asia/Bangkok:${dateIcs}T${startFormatted}`);
                lines.push(`DTEND;TZID=Asia/Bangkok:${dateIcs}T${endFormatted}`);
            }
            lines.push(`SUMMARY:${escapeIcsText(summary)}`);
            const descParts = [`ธุระส่วนตัว: ${pe.title}`];
            if (pe.relationshipTag) {
                const relLabel = vendee_1.RELATIONSHIP_CONFIG[pe.relationshipTag]?.label || pe.relationshipTag;
                descParts.push(`หมวดหมู่: ${relLabel}`);
            }
            if (pe.notes) {
                descParts.push(`รายละเอียด: ${pe.notes}`);
            }
            lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
            if (pe.location) {
                lines.push(`LOCATION:${escapeIcsText(pe.location)}`);
            }
            // VALARM: 30 minutes before
            lines.push("BEGIN:VALARM");
            lines.push("ACTION:DISPLAY");
            lines.push(`DESCRIPTION:เตือนธุระส่วนตัว: ${pe.title}`);
            lines.push("TRIGGER:-PT30M");
            lines.push("END:VALARM");
            lines.push("END:VEVENT");
        });
    }
    // 4. CLINIC DUTIES (ClinicWorkRecord)
    if (includeClinic) {
        clinicLogs.forEach((cl) => {
            if (!isDateInRange(cl.date)) {
                return;
            }
            const uid = `vendee-clinic-${cl.id}@vendee.app`;
            const dateIcs = formatIcsDate(cl.date);
            const summary = `🏥 คลินิก: ${cl.presetShift}`;
            const [startRaw, endRaw] = cl.presetShift.split(" - ");
            const startFormatted = formatIcsTime(startRaw || "12:30");
            const endFormatted = formatIcsTime(endRaw || "17:30");
            lines.push("BEGIN:VEVENT");
            lines.push(`UID:${uid}`);
            lines.push(`DTSTAMP:${dtstamp}`);
            lines.push("STATUS:CONFIRMED");
            lines.push(`DTSTART;TZID=Asia/Bangkok:${dateIcs}T${startFormatted}`);
            lines.push(`DTEND;TZID=Asia/Bangkok:${dateIcs}T${endFormatted}`);
            lines.push(`SUMMARY:${escapeIcsText(summary)}`);
            const descParts = [`กะทำงานคลินิก: ${cl.presetShift} น.`];
            if (cl.note) {
                descParts.push(`บันทึก: ${cl.note}`);
            }
            lines.push(`DESCRIPTION:${escapeIcsText(descParts.join("\n"))}`);
            // VALARM: 60 minutes before
            lines.push("BEGIN:VALARM");
            lines.push("ACTION:DISPLAY");
            lines.push(`DESCRIPTION:เตือนกะคลินิก (${cl.presetShift})`);
            lines.push("TRIGGER:-PT60M");
            lines.push("END:VALARM");
            lines.push("END:VEVENT");
        });
    }
    lines.push("END:VCALENDAR");
    // Apply line folding and CRLF joining
    return lines.map((l) => foldLine(l)).join(CRLF) + CRLF;
}

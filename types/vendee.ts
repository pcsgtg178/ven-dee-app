export type ShiftType = "morning" | "afternoon" | "night" | "r1" | "r2" | "off" | "ctm" | "cta";

export type ShiftCategory = "black" | "red" | "green" | "gray" | "purple"; // ดำ = ปกติแลกได้ขึ้นครบ, แดง = OT, เขียว = เวร R (Refer)

export type ShiftStatus = "active" | "swapped_out" | "cancelled";

export interface SwapTrailNode {
  id: string;
  fromPerson: string;
  toPerson: string;
  date: string;
  shiftLabel: string;
  note?: string;
}

export interface SwapMetadata {
  swappedWith: string; // คนที่ตกลงแลกด้วย (Direct Partner) [Required]
  originalOwner?: string; // เจ้าของเวรเดิมตามตาราง (Original Owner ถ้ามี)
  parentShiftId?: string; // ID ของเวรเดิมก่อนแลก
  isLocked: boolean; // ล็อกหรือไม่ (เวรผ่านไปแล้ว = true)
  swapDate?: string;
  swapReason?: string;
  swapHistory?: SwapTrailNode[]; // ประวัติการแลกต่อยอดสำหรับ Timeline
}

export interface ShiftRecord {
  id: string;
  type: "shift";
  date: string; // YYYY-MM-DD
  shiftType: ShiftType;
  category: ShiftCategory;
  status: ShiftStatus;
  swapMeta?: SwapMetadata;
  department?: string;
  note?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  name: string;
  avatarColor?: string;
  createdAt?: string;
}

export interface Medications {
  id: string;
  name: string;
  price?: string; // ราคาต้นทุน / ราคา
  unit?: string;
  note?: string;
  createdAt?: string;
}

export interface MedicationsRecord {
  id: string;
  name: string;
  price?: string; // ราคาขาย
  unitAmt?: string;   // จำนวน unit ที่ใช้
  createdAt?: string;
}

export type ServiceType = "injection" | "dressing" | "consult" | "vital_signs" | "other";

export const SERVICE_CONFIG: Record<ServiceType, { label: string; icon: string; bg: string }> = {
  injection: { label: "ฉีดยา", icon: "💉", bg: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300" },
  dressing: { label: "ทำแผล", icon: "🩹", bg: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300" },
  consult: { label: "ปรึกษา", icon: "💬", bg: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-300" },
  vital_signs: { label: "วัดสัญญาณชีพ", icon: "🫀", bg: "bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300" },
  other: { label: "บริการอื่น", icon: "✨", bg: "bg-slate-100 text-slate-800 dark:bg-zinc-800 dark:text-zinc-300" },
};

export interface CustomerServiceRecord {
  id: string;
  type: "service";
  customerId: string;
  customerName: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  services?: ServiceType[];
  otherServiceText?: string;
  medications?: string[]; // รายการยา (เพิ่ม/ลบได้หลายตัว โผล่เมื่อเลือกฉีดยา)
  note?: string;
  price?: number;
  status?: "upcoming" | "completed" | "cancelled";
  createdAt: string;
}

export type ClinicPresetShift = "12:30 - 17:30" | "17:00 - 19:30" | "12:30 - 19:30";

export interface ClinicWorkRecord {
  id: string;
  type: "clinic";
  date: string; // YYYY-MM-DD
  presetShift: ClinicPresetShift;
  note?: string;
  createdAt: string;
}

export type ActivityItem = ShiftRecord | CustomerServiceRecord | ClinicWorkRecord;

export const DEFAULT_BLACK_SHIFT_QUOTA = 14; // กฎเวรดำ x วันต่อเดือน

export const SHIFT_CODE_MAP: Record<ShiftType, string> = {
  night: "1", // 1 = เวรดึก
  morning: "2", // 2 = เวรเช้า
  afternoon: "3", // 3 = เวรบ่าย
  r1: "R1", // Refer
  r2: "R2", // Refer
  off: "0", // 0 = เวรหยุด
  ctm: "CTM", // CT
  cta: "CTA", // CT
};

export const SHIFT_CONFIG: Record<
  ShiftType,
  { label: string; shortLabel: string; period: string; color: string; badgeBg: string; textBg: string; borderBg: string }
> = {
  night: {
    label: "เวรดึก",
    shortLabel: "ดึก",
    period: "00:00 - 08:00",
    color: "#6366f1", // indigo
    badgeBg: "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300",
    textBg: "text-indigo-600 dark:text-indigo-400",
    borderBg: "border-indigo-200 dark:border-indigo-800",
  },
  morning: {
    label: "เวรเช้า",
    shortLabel: "เช้า",
    period: "08:00 - 16:00",
    color: "#f59e0b", // amber
    badgeBg: "bg-amber-50 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    textBg: "text-amber-600 dark:text-amber-400",
    borderBg: "border-amber-200 dark:border-amber-800",
  },
  afternoon: {
    label: "เวรบ่าย",
    shortLabel: "บ่าย",
    period: "16:00 - 00:00",
    color: "#0284c7", // sky
    badgeBg: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
    textBg: "text-sky-600 dark:text-sky-400",
    borderBg: "border-sky-200 dark:border-sky-800",
  },
  r1: {
    label: "Refer ทีม 1",
    shortLabel: "R1",
    period: "ทั้งวัน",
    color: "#198f13", // emerald
    badgeBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    textBg: "text-emerald-600 dark:text-emerald-400",
    borderBg: "border-emerald-200 dark:border-emerald-800",
  },
  r2: {
    label: "Refer ทีม 2",
    shortLabel: "R2",
    period: "ทั้งวัน",
    color: "#198f13", // emeraldd
    badgeBg: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    textBg: "text-emerald-600 dark:text-emerald-400",
    borderBg: "border-emerald-200 dark:border-emerald-800",
  },
  off: {
    label: "เวรหยุด",
    shortLabel: "หยุด",
    period: "ทั้งวัน",
    color: "#6b7280", // gray
    badgeBg: "bg-gray-50 text-gray-700 dark:bg-gray-950/60 dark:text-gray-300",
    textBg: "text-gray-600 dark:text-gray-400",
    borderBg: "border-gray-200 dark:border-gray-800",
  },
  ctm: {
    label: "เวร CT เช้า",
    shortLabel: "CT เช้า",
    period: "กำหนดช่วงเวลาเอง",
    color: "#8b5cf6", // purple
    badgeBg: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
    textBg: "text-purple-600 dark:text-purple-400",
    borderBg: "border-purple-200 dark:border-purple-800",
  },
  cta: {
    label: "เวร CT บ่าย",
    shortLabel: "CT บ่าย",
    period: "กำหนดช่วงเวลาเอง",
    color: "#8b5cf6", // purple
    badgeBg: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
    textBg: "text-purple-600 dark:text-purple-400",
    borderBg: "border-purple-200 dark:border-purple-800",
  },
};

export const SHIFT_CATEGORY_CONFIG: Record<
  ShiftCategory,
  { label: string; subLabel: string; desc: string; badge: string; pill: string }
> = {
  black: {
    label: "เวรดำ",
    subLabel: "เวรประจำ",
    desc: "วันทำงานปกติ แลกได้แต่ต้องขึ้นให้ครบตามเกณฑ์",
    // เวรดำ (เวรประจำ): ป้ายสีเข้ม/ทึบ (shift-black: #1E293B)
    badge: "bg-shift-black text-white dark:bg-slate-100 dark:text-slate-900 font-bold shadow-xs",
    pill: "bg-shift-black text-white border-transparent dark:bg-slate-100 dark:text-slate-900",
  },
  red: {
    label: "เวรแดง",
    subLabel: "OT/เวรช่วย",
    desc: "เวร OT แลกได้เพื่อไม่ต้องขึ้นก็ได้และจ่ายค่า OT",
    // เวรแดง (OT/เวรช่วย): ป้ายสีกรอบแดง/สีแดงเด่นชัด (shift-red-badge: #FEE2E2, text: #B91C1C, border: #EF4444)
    badge: "bg-shift-red-badge text-shift-red-text border-2 border-shift-red dark:bg-rose-950/80 dark:text-rose-200 dark:border-rose-400 font-bold shadow-xs",
    pill: "bg-shift-red-badge text-shift-red-text border-shift-red dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-700",
  },
  green: {
    label: "เวร R",
    subLabel: "Refer ส่งต่อ",
    desc: "เวรส่งต่อผู้ป่วยฉุกเฉิน (ทั้งวัน แลกได้ ลงงานอื่นทับเวลาได้)",
    badge: "bg-emerald-600 text-white dark:bg-emerald-600 dark:text-white font-bold shadow-xs",
    pill: "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  gray: {
    label: "เวรออฟ",
    subLabel: "วันหยุด",
    desc: "เวรออฟ วันหยุด",
    badge: "bg-gray-600 text-white dark:bg-gray-600 dark:text-white font-bold shadow-xs",
    pill: "bg-gray-50 text-gray-700 border-gray-300 dark:bg-gray-950/60 dark:text-gray-300",
  },
  purple: {
    label: "เวร CT",
    subLabel: "CT Scan",
    desc: "เวรห้อง CT Scan",
    badge: "bg-purple-600 text-white dark:bg-purple-600 dark:text-white font-bold shadow-xs",
    pill: "bg-purple-50 text-purple-700 border-purple-300 dark:bg-purple-950/60 dark:text-purple-300",
  },
};


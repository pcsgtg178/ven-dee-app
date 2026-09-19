export type ShiftType = "morning" | "afternoon" | "night" | "r1" | "r2";

export type ShiftCategory = "black" | "red" | "green"; // ดำ = ปกติแลกได้ขึ้นครบ, แดง = OT, เขียว = เวร R (Refer)

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
  phone: string;
  note: string; // โน้ตจำแนก เช่น "บ้านสวน ซ.5 (แม่น้องพลอย)", "คอนโดลุมพินี ชั้น 12"
  address?: string;
  avatarColor?: string;
  createdAt?: string;
}

export type ServiceType = "injection" | "drip" | "delivery" | "other";

export interface CustomerServiceRecord {
  id: string;
  type: "service";
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerNote: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  services: ServiceType[];
  otherServiceText?: string;
  medications?: string[]; // รายการยา (เพิ่ม/ลบได้หลายตัว โผล่เมื่อเลือกฉีดยา)
  note?: string;
  status: "upcoming" | "completed" | "cancelled";
  price?: number;
  createdAt: string;
}

export type ActivityItem = ShiftRecord | CustomerServiceRecord;

export const DEFAULT_BLACK_SHIFT_QUOTA = 14; // กฎเวรดำ x วันต่อเดือน

export const SHIFT_CODE_MAP: Record<ShiftType, string> = {
  night: "1", // 1 = เวรดึก
  morning: "2", // 2 = เวรเช้า
  afternoon: "3", // 3 = เวรบ่าย
  r1: "R1", // R1 = เวร Refer ทีม 1
  r2: "R2", // R2 = เวร Refer ทีม 2
};

export const SHIFT_CONFIG: Record<
  ShiftType,
  { label: string; shortLabel: string; period: string; color: string; badgeBg: string; textBg: string; borderBg: string }
> = {
  night: {
    label: "เวรดึก",
    shortLabel: "ดึก",
    period: "24:00 - 08:00",
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
    period: "16:00 - 24:00",
    color: "#0284c7", // sky
    badgeBg: "bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
    textBg: "text-sky-600 dark:text-sky-400",
    borderBg: "border-sky-200 dark:border-sky-800",
  },
  r1: {
    label: "เวร R1 (Refer ทีม 1)",
    shortLabel: "R1",
    period: "ทั้งวัน",
    color: "#8b5cf6", // violet
    badgeBg: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
    textBg: "text-purple-600 dark:text-purple-400",
    borderBg: "border-purple-200 dark:border-purple-800",
  },
  r2: {
    label: "เวร R2 (Refer ทีม 2)",
    shortLabel: "R2",
    period: "ทั้งวัน",
    color: "#a855f7", // fuchsia
    badgeBg: "bg-fuchsia-50 text-fuchsia-700 dark:bg-fuchsia-950/60 dark:text-fuchsia-300",
    textBg: "text-fuchsia-600 dark:text-fuchsia-400",
    borderBg: "border-fuchsia-200 dark:border-fuchsia-800",
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
};

export const SERVICE_CONFIG: Record<
  ServiceType,
  { label: string; color: string; bg: string }
> = {
  injection: {
    label: "ฉีดยา",
    color: "#16A34A", // Primary green
    bg: "bg-primary-light text-primary-dark dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  drip: {
    label: "ดริปผิว",
    color: "#0284C7", // Secondary sea blue
    bg: "bg-secondary-light text-secondary-dark dark:bg-sky-950/60 dark:text-sky-300",
  },
  delivery: {
    label: "ส่งของ",
    color: "#8B5CF6", // Violet
    bg: "bg-purple-50 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300",
  },
  other: {
    label: "อื่นๆ",
    color: "#64748B", // Slate
    bg: "bg-surface-subtle text-text-main dark:bg-zinc-800 dark:text-zinc-300",
  },
};


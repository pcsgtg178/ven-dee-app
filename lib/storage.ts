"use client";

import {
  Customer,
  CustomerServiceRecord,
  ShiftRecord,
  ShiftCategory,
  ShiftType,
  DEFAULT_BLACK_SHIFT_QUOTA,
  SwapTrailNode,
  SHIFT_CONFIG,
} from "../types/vendee";

const STORAGE_KEYS = {
  SHIFTS: "vendee_shifts_v2", // bumped to v2 for swap schema
  SERVICES: "vendee_services_v1",
  CUSTOMERS: "vendee_customers_v1",
};

const SYNC_EVENT = "vendee_storage_updated";

export const initialCustomers: Customer[] = [
  {
    id: "cust-1",
    name: "คุณยายสมศรี สุขเกษม",
    phone: "081-234-5678",
    note: "บ้านสวน ซ.ร่วมใจ (คนไข้เบาหวาน เจาะน้ำตาล/ฉีดอินซูลิน)",
    address: "99/12 ซอยร่วมใจ 3 ถนนสุขุมวิท กรุงเทพฯ",
    avatarColor: "bg-emerald-500",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "cust-2",
    name: "คุณแพรวพรรณ โสภณ",
    phone: "089-876-5432",
    note: "คอนโด Ashton อโศก ชั้น 18 (นัดดริปวิตามินผิวประจำสัปดาห์)",
    address: "Ashton Asoke ห้อง 1804 สุขุมวิท 21 กรุงเทพฯ",
    avatarColor: "bg-sky-500",
    createdAt: "2026-09-03T10:00:00Z",
  },
  {
    id: "cust-3",
    name: "คุณเอกชัย วัฒนกุล",
    phone: "084-555-1234",
    note: "หมู่บ้านพฤกษา 3 บางใหญ่ (ฉีดยาปฏิชีวนะตามคำสั่งแพทย์)",
    address: "45/88 หมู่บ้านพฤกษา 3 ซอย 5 นนทบุรี",
    avatarColor: "bg-amber-500",
    createdAt: "2026-09-05T12:00:00Z",
  },
  {
    id: "cust-4",
    name: "คุณหมอนิ่ม นิมิตรา",
    phone: "086-777-9890",
    note: "รพ.จุฬาฯ ตึก ภปร (ฝากนำส่งอุปกรณ์เวชภัณฑ์ปลอดเชื้อ)",
    address: "อาคาร ภปร ชั้น 5 รพ.จุฬาลงกรณ์",
    avatarColor: "bg-purple-500",
    createdAt: "2026-09-07T09:30:00Z",
  },
  {
    id: "cust-5",
    name: "คุณสมศรี วรรณดี",
    phone: "092-333-4455",
    note: "ร้านขายยาหน้าหมู่บ้าน (คนละคนกับคุณยายสมศรี ซ.ร่วมใจ)",
    address: "12/4 หน้าปากซอยมิตรภาพ",
    avatarColor: "bg-rose-500",
    createdAt: "2026-09-10T14:00:00Z",
  },
];

// Helper to determine if date is in past (locked)
export function isShiftInPast(dateStr: string): boolean {
  try {
    const todayStr = "2026-09-19"; // Current app mock reference date
    return dateStr < todayStr;
  } catch {
    return false;
  }
}

export const initialShifts: ShiftRecord[] = [
  // 1. เวรดำปกติ (ยังไม่แลก, active, isLocked false)
  {
    id: "shift-1",
    type: "shift",
    date: "2026-09-19",
    shiftType: "night",
    category: "black",
    status: "active",
    department: "วอร์ด ICU ผู้ใหญ่",
    note: "เวรดึกหลัก ดูแลเคส Post-Op",
    createdAt: "2026-09-18T20:00:00Z",
  },
  // 2. เวรแดง (OT) ที่มาจากการแลกกับ พว.ก้อย (isLocked false)
  {
    id: "shift-2",
    type: "shift",
    date: "2026-09-20",
    shiftType: "afternoon",
    category: "red",
    status: "active",
    department: "ห้องฉุกเฉิน (ER)",
    note: "ขึ้นเวร OT แทน ได้รับค่า OT",
    swapMeta: {
      swappedWith: "พว.ก้อย สุดา",
      isLocked: false,
      swapDate: "2026-09-18",
      swapReason: "ขึ้นเวรแทนเพื่อรับค่าตอบแทน OT",
    },
    createdAt: "2026-09-18T20:30:00Z",
  },
  // 3. เวรดำที่แลกต่อยอด (Top-up): แลกกับ พว.กานดา โดยเวรเดิมเป็นของ พว.วิภา (มี Swap Trail Timeline)
  {
    id: "shift-3",
    type: "shift",
    date: "2026-09-21",
    shiftType: "morning",
    category: "black",
    status: "active",
    department: "อายุรกรรมหญิง ช.6",
    note: "เวรเช้า (รับแลกต่อยอดมา)",
    swapMeta: {
      swappedWith: "พว.กานดา สุวรรณ",
      originalOwner: "พว.วิภา มณีรัตน์",
      isLocked: false,
      swapDate: "2026-09-17",
      swapReason: "พว.กานดาติดธุระด่วน จึงส่งต่อเวรให้ขึ้นแทน",
      swapHistory: [
        {
          id: "trail-1",
          fromPerson: "พว.วิภา มณีรัตน์ (เจ้าของเดิมตามตาราง)",
          toPerson: "พว.กานดา สุวรรณ (คนกลาง)",
          date: "2026-09-16",
          shiftLabel: "เวรเช้า (08:00 - 16:00)",
          note: "แลกเปลี่ยนเวรตามตารางประจำสัปดาห์",
        },
        {
          id: "trail-2",
          fromPerson: "พว.กานดา สุวรรณ",
          toPerson: "ฉัน (พยาบาลผู้ใช้งาน)",
          date: "2026-09-17",
          shiftLabel: "เวรเช้า (08:00 - 16:00)",
          note: "ส่งต่อแลกเวรต่อยอด (Top-up Swap)",
        },
      ],
    },
    createdAt: "2026-09-17T11:00:00Z",
  },
  // 4. เวรในอดีตที่ผ่านไปแล้ว (isLocked: true) -> ปุ่มยกเลิกถูก disable พร้อม tooltip
  {
    id: "shift-4",
    type: "shift",
    date: "2026-09-15",
    shiftType: "morning",
    category: "black",
    status: "active",
    department: "วอร์ด ICU ผู้ใหญ่",
    note: "เวรเช้าที่ผ่านมาแล้วในอดีต",
    swapMeta: {
      swappedWith: "พว.สมใจ อิ่มเอม",
      isLocked: true,
      swapDate: "2026-09-13",
      swapReason: "แลกเวรล่วงหน้าเพื่อไปทำธุระ",
    },
    createdAt: "2026-09-13T15:00:00Z",
  },
  // 5. เวรแดง (OT) ปกติ
  {
    id: "shift-5",
    type: "shift",
    date: "2026-09-23",
    shiftType: "night",
    category: "red",
    status: "active",
    department: "วอร์ดกึ่งวิกฤต (Step Down)",
    note: "เวร OT เพิ่มเติม",
    createdAt: "2026-09-18T10:00:00Z",
  },
  // 6-15. เวรดำอื่นๆ ในเดือนกันยายน 2026 (รวมทั้งหมด 12 วันจากเป้าหมาย 14 วัน เพื่อจำลองสถานการณ์ขาด 2 วัน)
  {
    id: "shift-6",
    type: "shift",
    date: "2026-09-01",
    shiftType: "morning",
    category: "black",
    status: "active",
    department: "วอร์ด ICU",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "shift-7",
    type: "shift",
    date: "2026-09-03",
    shiftType: "afternoon",
    category: "black",
    status: "active",
    department: "วอร์ด ICU",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "shift-8",
    type: "shift",
    date: "2026-09-05",
    shiftType: "night",
    category: "black",
    status: "active",
    department: "วอร์ด ICU",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "shift-9",
    type: "shift",
    date: "2026-09-07",
    shiftType: "morning",
    category: "black",
    status: "active",
    department: "วอร์ด ICU",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "shift-10",
    type: "shift",
    date: "2026-09-09",
    shiftType: "afternoon",
    category: "black",
    status: "active",
    department: "วอร์ด ICU",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "shift-11",
    type: "shift",
    date: "2026-09-11",
    shiftType: "night",
    category: "black",
    status: "active",
    department: "วอร์ด ICU",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "shift-12",
    type: "shift",
    date: "2026-09-13",
    shiftType: "morning",
    category: "black",
    status: "active",
    department: "วอร์ด ICU",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "shift-13",
    type: "shift",
    date: "2026-09-17",
    shiftType: "morning",
    category: "black",
    status: "active",
    department: "วอร์ด ICU",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "shift-14",
    type: "shift",
    date: "2026-09-25",
    shiftType: "r1",
    category: "green",
    status: "active",
    department: "ทีม Refer (Ambulance)",
    note: "เวร R1 (ทีม 1) ทั้งวัน",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "shift-15",
    type: "shift",
    date: "2026-09-27",
    shiftType: "morning",
    category: "black",
    status: "active",
    department: "วอร์ด ICU",
    createdAt: "2026-09-01T08:00:00Z",
  },
];

export const initialServices: CustomerServiceRecord[] = [
  {
    id: "srv-1",
    type: "service",
    customerId: "cust-1",
    customerName: "คุณยายสมศรี สุขเกษม",
    customerPhone: "081-234-5678",
    customerNote: "บ้านสวน ซ.ร่วมใจ (คนไข้เบาหวาน เจาะน้ำตาล/ฉีดอินซูลิน)",
    date: "2026-09-19",
    time: "14:00",
    services: ["injection"],
    medications: ["Insulin Glargine 14 Units SC", "Vitamin B1-6-12 1 Amp IM"],
    note: "เจาะน้ำตาลปลายนิ้วก่อนฉีด (เป้าหมาย < 140 mg/dL)",
    status: "upcoming",
    price: 450,
    createdAt: "2026-09-18T09:00:00Z",
  },
  {
    id: "srv-2",
    type: "service",
    customerId: "cust-2",
    customerName: "คุณแพรวพรรณ โสภณ",
    customerPhone: "089-876-5432",
    customerNote: "คอนโด Ashton อโศก ชั้น 18 (นัดดริปวิตามินผิวประจำสัปดาห์)",
    date: "2026-09-20",
    time: "10:30",
    services: ["drip"],
    note: "สูตร Aura Mega Bright + วิตามินซีเข้มข้น 500mg 1 ขวด",
    status: "upcoming",
    price: 1500,
    createdAt: "2026-09-18T11:20:00Z",
  },
  {
    id: "srv-3",
    type: "service",
    customerId: "cust-3",
    customerName: "คุณเอกชัย วัฒนกุล",
    customerPhone: "084-555-1234",
    customerNote: "หมู่บ้านพฤกษา 3 บางใหญ่ (ฉีดยาปฏิชีวนะตามคำสั่งแพทย์)",
    date: "2026-09-18",
    time: "16:00",
    services: ["injection"],
    medications: ["Ceftriaxone 1g IV Pushช้าๆ 5 นาที"],
    note: "เข็มที่ 4 จากคอร์ส 5 วัน คนไข้ไม่มีอาการแพ้",
    status: "completed",
    price: 500,
    createdAt: "2026-09-17T08:15:00Z",
  },
  {
    id: "srv-4",
    type: "service",
    customerId: "cust-1",
    customerName: "คุณยายสมศรี สุขเกษม",
    customerPhone: "081-234-5678",
    customerNote: "บ้านสวน ซ.ร่วมใจ (คนไข้เบาหวาน เจาะน้ำตาล/ฉีดอินซูลิน)",
    date: "2026-09-15",
    time: "16:30",
    services: ["injection"],
    medications: ["Insulin Glargine 14 Units SC"],
    note: "เรียบร้อยดี ค่าน้ำตาล 124 mg/dL",
    status: "completed",
    price: 450,
    createdAt: "2026-09-15T09:00:00Z",
  },
  {
    id: "srv-5",
    type: "service",
    customerId: "cust-4",
    customerName: "คุณหมอนิ่ม นิมิตรา",
    customerPhone: "086-777-9890",
    customerNote: "รพ.จุฬาฯ ตึก ภปร (ฝากนำส่งอุปกรณ์เวชภัณฑ์ปลอดเชื้อ)",
    date: "2026-09-22",
    time: "09:00",
    services: ["delivery"],
    note: "นำส่งกล่อง Sterile Dressings Set จำนวน 5 เซต",
    status: "upcoming",
    price: 300,
    createdAt: "2026-09-18T14:30:00Z",
  },
];

export function triggerSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYNC_EVENT));
  }
}

export function subscribeToStorage(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(SYNC_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(SYNC_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

// Customers
export function getCustomers(): Customer[] {
  if (typeof window === "undefined") return initialCustomers;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(initialCustomers));
      return initialCustomers;
    }
    return JSON.parse(raw);
  } catch {
    return initialCustomers;
  }
}

export function saveCustomer(customer: Omit<Customer, "id"> & { id?: string }): Customer {
  const current = getCustomers();
  const id = customer.id || `cust-${Date.now()}`;
  const newCustomer: Customer = {
    ...customer,
    id,
    createdAt: customer.createdAt || new Date().toISOString(),
    avatarColor: customer.avatarColor || "bg-teal-500",
  };

  const existingIdx = current.findIndex((c) => c.id === id);
  let updated: Customer[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = newCustomer;
  } else {
    updated = [newCustomer, ...current];
  }

  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updated));
  triggerSync();
  return newCustomer;
}

export function getCustomerById(id: string): Customer | undefined {
  const customers = getCustomers();
  return customers.find((c) => c.id === id);
}

// Shifts
export function getShifts(): ShiftRecord[] {
  if (typeof window === "undefined") return initialShifts;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(initialShifts));
      return initialShifts;
    }
    return JSON.parse(raw);
  } catch {
    return initialShifts;
  }
}

export function saveShift(
  shift: Omit<ShiftRecord, "id" | "type" | "createdAt" | "status"> & {
    id?: string;
    status?: ShiftRecord["status"];
  }
): ShiftRecord {
  const current = getShifts();
  const id = shift.id || `shift-${Date.now()}`;
  const targetStatus = shift.status || "active";

  // Prevent duplicate active shift on the same date and same shift type
  if (targetStatus === "active") {
    const isDuplicate = current.some(
      (s) =>
        s.id !== id &&
        s.date === shift.date &&
        s.shiftType === shift.shiftType &&
        s.status === "active"
    );
    if (isDuplicate) {
      const label = SHIFT_CONFIG[shift.shiftType].label;
      throw new Error(`มี${label}ในวันที่ ${shift.date} อยู่แล้ว ไม่สามารถบันทึกซ้ำช่วงเวลาเดียวกันได้`);
    }

    // Check conflict with customer services on the same date (เวร R / Refer สามารถเพิ่มเข้ามาได้แม้มีงานอื่นอยู่แล้ว)
    if (shift.shiftType !== "r1" && shift.shiftType !== "r2") {
      const conflictingServices = findConflictingServices(shift.date, shift.shiftType);
      if (conflictingServices.length > 0) {
        const shiftInfo = SHIFT_CONFIG[shift.shiftType];
        const firstConf = conflictingServices[0];
        throw new Error(
          `ไม่สามารถบันทึก${shiftInfo.label} (${shiftInfo.period}) ได้ เนื่องจากมีนัดหมายบริการ "${firstConf.customerName}" เวลา ${firstConf.time} น. อยู่ในช่วงเวลานี้`
        );
      }
    }
  }

  const resolvedCategory =
    shift.shiftType === "r1" || shift.shiftType === "r2"
      ? "green"
      : shift.category || "black";

  const newShift: ShiftRecord = {
    ...shift,
    category: resolvedCategory,
    id,
    type: "shift",
    status: targetStatus,
    createdAt: new Date().toISOString(),
  };

  const existingIdx = current.findIndex((s) => s.id === id);
  let updated: ShiftRecord[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = newShift;
  } else {
    updated = [newShift, ...current];
  }

  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(updated));
  triggerSync();
  return newShift;
}

export function deleteShift(id: string): { restoredParentId?: string } {
  const current = getShifts();
  const target = current.find((s) => s.id === id);
  let restoredParentId: string | undefined = undefined;

  const updated = current.filter((s) => s.id !== id);

  // If the deleted shift was a swapped shift that originated from a parent shift:
  // Automatically restore the original parent shift back to 'active' status!
  if (target?.swapMeta?.parentShiftId) {
    const parent = updated.find((s) => s.id === target.swapMeta?.parentShiftId);
    if (parent && parent.status === "swapped_out") {
      parent.status = "active";
      restoredParentId = parent.id;
    }
  }

  // Also detach parentShiftId link if any remaining shifts referenced this id
  updated.forEach((s) => {
    if (s.swapMeta && s.swapMeta.parentShiftId === id) {
      delete s.swapMeta.parentShiftId;
    }
  });

  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(updated));
  triggerSync();
  return { restoredParentId };
}

/**
 * Manually reactivate a swapped_out or inactive shift
 */
export function restoreShift(shiftId: string): ShiftRecord {
  const current = getShifts();
  const target = current.find((s) => s.id === shiftId);
  if (!target) {
    throw new Error("ไม่พบเวรที่ต้องการกู้คืน");
  }

  target.status = "active";
  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(current));
  triggerSync();
  return target;
}

/**
 * Perform a Complex Shift Swap
 * - Marks old shift as 'swapped_out'
 * - Creates a new shift with the received date, type, and category
 * - Populates swapMeta including direct partner, optional original owner, and trail
 */
export function swapShift(params: {
  shiftId: string;
  swappedWith: string; // Direct Partner
  originalOwner?: string; // Original Owner (if top-up)
  newDate: string;
  newShiftType: ShiftType;
  newCategory: ShiftCategory;
  swapReason?: string;
}): { newShift: ShiftRecord; oldShift: ShiftRecord } {
  const current = getShifts();
  const oldShift = current.find((s) => s.id === params.shiftId);
  if (!oldShift) {
    throw new Error("ไม่พบเวรที่ต้องการแลก");
  }

  // Prevent duplicate active shift on newDate and newShiftType
  const duplicate = current.find(
    (s) =>
      s.id !== params.shiftId &&
      s.date === params.newDate &&
      s.shiftType === params.newShiftType &&
      s.status === "active"
  );
  if (duplicate) {
    const label = SHIFT_CONFIG[params.newShiftType].label;
    throw new Error(`คุณมี${label}ในวันที่ ${params.newDate} อยู่แล้ว ไม่สามารถแลกมารับเวรซ้ำช่วงเวลาเดียวกันได้`);
  }

  // Check conflict with customer services on newDate (เวร R / Refer สามารถรับแลกเข้ามาได้แม้มีงานอื่นอยู่แล้ว)
  if (params.newShiftType !== "r1" && params.newShiftType !== "r2") {
    const conflictingServices = findConflictingServices(params.newDate, params.newShiftType);
    if (conflictingServices.length > 0) {
      const shiftInfo = SHIFT_CONFIG[params.newShiftType];
      const firstConf = conflictingServices[0];
      throw new Error(
        `ไม่สามารถแลกมารับ${shiftInfo.label} (${shiftInfo.period}) ในวันที่ ${params.newDate} ได้ เนื่องจากมีนัดหมายบริการ "${firstConf.customerName}" เวลา ${firstConf.time} น. อยู่แล้ว`
      );
    }
  }

  // Update old shift status to swapped_out
  oldShift.status = "swapped_out";

  // Build swap trail
  const swapDateStr = new Date().toISOString().split("T")[0];
  const trail: SwapTrailNode[] = [];

  if (params.originalOwner) {
    trail.push({
      id: `trail-init-${Date.now()}`,
      fromPerson: `${params.originalOwner} (เจ้าของเดิมตามตาราง)`,
      toPerson: `${params.swappedWith} (คนกลาง)`,
      date: oldShift.date,
      shiftLabel: SHIFT_CONFIG[oldShift.shiftType]?.label || "เวรเดิม",
      note: "แลกเปลี่ยนเวรตามตารางงานเดิม",
    });
  }

  trail.push({
    id: `trail-step-${Date.now()}`,
    fromPerson: params.originalOwner ? `${params.swappedWith} (คนกลาง)` : `${params.swappedWith}`,
    toPerson: "ฉัน (พยาบาลผู้ใช้งาน)",
    date: params.newDate,
    shiftLabel: SHIFT_CONFIG[params.newShiftType]?.label || "เวรใหม่",
    note: params.swapReason || "ตกลงแลกเปลี่ยนเวร",
  });

  const resolvedCategory =
    params.newShiftType === "r1" || params.newShiftType === "r2"
      ? "green"
      : params.newCategory;

  const newShiftId = `shift-${Date.now()}`;
  const newShift: ShiftRecord = {
    id: newShiftId,
    type: "shift",
    date: params.newDate,
    shiftType: params.newShiftType,
    category: resolvedCategory,
    status: "active",
    department: oldShift.department,
    note: `เวรที่ได้รับจากการแลกกับ ${params.swappedWith}${params.swapReason ? ` (${params.swapReason})` : ""}`,
    swapMeta: {
      swappedWith: params.swappedWith,
      originalOwner: params.originalOwner || undefined,
      parentShiftId: oldShift.id,
      isLocked: isShiftInPast(params.newDate),
      swapDate: swapDateStr,
      swapReason: params.swapReason,
      swapHistory: trail,
    },
    createdAt: new Date().toISOString(),
  };

  const updated = [newShift, ...current];
  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(updated));
  triggerSync();

  return { newShift, oldShift };
}

/**
 * Undo / Rollback a shift swap
 * - Only permitted if isLocked === false
 * - Restores parentShift to 'active'
 * - Removes or cancels the received shift
 */
export function undoSwapShift(shiftId: string): boolean {
  const current = getShifts();
  const targetShift = current.find((s) => s.id === shiftId);
  if (!targetShift || !targetShift.swapMeta) {
    return false;
  }

  if (targetShift.swapMeta.isLocked) {
    throw new Error("ไม่สามารถยกเลิกได้เนื่องจากเวรผ่านเวลาไปแล้ว");
  }

  const updated = current.filter((s) => s.id !== shiftId);

  // If there is a parentShiftId, restore it to active
  if (targetShift.swapMeta.parentShiftId) {
    const parent = updated.find((s) => s.id === targetShift.swapMeta?.parentShiftId);
    if (parent) {
      parent.status = "active";
    }
  }

  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(updated));
  triggerSync();
  return true;
}

/**
 * Helper to calculate active black shifts for a given yearMonth (e.g. "2026-09")
 */
export function getMonthlyBlackShiftStats(yearMonth: string = "2026-09"): {
  blackCount: number;
  redCount: number;
  quota: number;
  remaining: number;
  isMet: boolean;
} {
  const shifts = getShifts();
  const monthShifts = shifts.filter(
    (s) => s.status === "active" && s.date.startsWith(yearMonth)
  );

  const blackCount = monthShifts.filter((s) => s.category === "black").length;
  const redCount = monthShifts.filter((s) => s.category === "red").length;
  const quota = DEFAULT_BLACK_SHIFT_QUOTA;
  const remaining = Math.max(0, quota - blackCount);
  const isMet = blackCount >= quota;

  return {
    blackCount,
    redCount,
    quota,
    remaining,
    isMet,
  };
}

// Helper to check if a time (HH:mm) falls into a shift's working hours
export function isTimeInShift(time: string, shiftType: ShiftType): boolean {
  if (!time) return false;
  const t = time.trim();
  switch (shiftType) {
    case "morning":
      return t >= "08:00" && t < "16:00";
    case "afternoon":
      return t >= "16:00" && t <= "23:59";
    case "night":
      return (t >= "00:00" && t < "08:00") || t === "24:00";
    case "r1":
    case "r2":
      // เวร R หรือ Refer สามารถเลือกเพิ่มงานอื่นมาทับเวลาเวร Refer ได้ (ไม่บล็อกเวลาทำงานอื่น)
      return false;
    default:
      return false;
  }
}

// Find an active shift that overlaps with the given date and time (ยกเว้นเวร R/Refer ที่ยอมให้มีงานอื่นทับเวลาได้)
export function findConflictingShift(date: string, time: string): ShiftRecord | undefined {
  const shifts = getShifts();
  return shifts.find(
    (s) =>
      s.status === "active" &&
      s.date === date &&
      s.shiftType !== "r1" &&
      s.shiftType !== "r2" &&
      isTimeInShift(time, s.shiftType)
  );
}

// Find active customer services that overlap with the given date and shiftType (ยกเว้นเวร R/Refer ที่ยอมให้มีงานอื่นทับเวลาได้)
export function findConflictingServices(date: string, shiftType: ShiftType): CustomerServiceRecord[] {
  if (shiftType === "r1" || shiftType === "r2") {
    return [];
  }
  const services = getServices();
  return services.filter(
    (srv) => srv.status !== "cancelled" && srv.date === date && isTimeInShift(srv.time, shiftType)
  );
}

// Services
export function getServices(): CustomerServiceRecord[] {
  if (typeof window === "undefined") return initialServices;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.SERVICES);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(initialServices));
      return initialServices;
    }
    return JSON.parse(raw);
  } catch {
    return initialServices;
  }
}

export function saveService(
  service: Omit<CustomerServiceRecord, "id" | "type" | "createdAt"> & { id?: string }
): CustomerServiceRecord {
  // Prevent booking service during an active shift's working hours
  const conflictingShift = findConflictingShift(service.date, service.time);
  if (conflictingShift) {
    const shiftInfo = SHIFT_CONFIG[conflictingShift.shiftType];
    throw new Error(
      `เวลา ${service.time} น. ตรงกับช่วงเวลา${shiftInfo.label} (${shiftInfo.period}) ที่ขึ้นเวรอยู่ ไม่สามารถนัดหมายทับเวลาเวรได้`
    );
  }

  const current = getServices();
  const id = service.id || `srv-${Date.now()}`;
  const newService: CustomerServiceRecord = {
    ...service,
    id,
    type: "service",
    createdAt: new Date().toISOString(),
  };

  const existingIdx = current.findIndex((s) => s.id === id);
  let updated: CustomerServiceRecord[];
  if (existingIdx >= 0) {
    updated = [...current];
    updated[existingIdx] = newService;
  } else {
    updated = [newService, ...current];
  }

  localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(updated));
  triggerSync();
  return newService;
}

export function deleteService(id: string): void {
  const current = getServices();
  const updated = current.filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(updated));
  triggerSync();
}

// All Activities combined sorted latest first
export function getAllActivities() {
  const shifts = getShifts();
  // Filter only active shifts or show swapped with badge
  const visibleShifts = shifts.filter((s) => s.status !== "cancelled");
  const services = getServices();
  const combined = [...visibleShifts, ...services];

  return combined.sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;
    const timeA = (a as CustomerServiceRecord).time || "00:00";
    const timeB = (b as CustomerServiceRecord).time || "00:00";
    return timeB.localeCompare(timeA);
  });
}

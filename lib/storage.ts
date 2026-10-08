"use client";

import moment from "moment";
import "moment/locale/th";
import {
  getShiftsAction,
  createShiftAction,
  updateShiftAction,
  swapShiftAction,
  undoSwapShiftAction,
  restoreShiftAction,
  deleteShiftAction,
} from "../app/actions/shiftActions";
import {
  getServicesAction,
  createServiceAction,
  deleteServiceAction,
} from "../app/actions/serviceActions";
import {
  getPersonalEventsAction,
  createPersonalEventAction,
  deletePersonalEventAction,
} from "../app/actions/personalEventActions";

import {
  Customer,
  CustomerServiceRecord,
  ShiftRecord,
  ShiftCategory,
  ShiftType,
  DEFAULT_BLACK_SHIFT_QUOTA,
  SwapTrailNode,
  SHIFT_CONFIG,
  SHIFT_CATEGORY_CONFIG,
  Medications,
  ClinicWorkRecord,
  ClinicPresetShift,
  PersonalEventRecord,
  ActivityItem,
} from "../types/vendee";

const STORAGE_KEYS = {
  SHIFTS: "vendee_shifts_v2", // bumped to v2 for swap schema
  SERVICES: "vendee_services_v1",
  CUSTOMERS: "vendee_customers_v1",
  MEDICATIONS: "vendee_medications_v1",
  CLINIC_LOGS: "vendee_clinic_logs_v1",
  PERSONAL_EVENTS: "vendee_personal_events_v1",
};

const SYNC_EVENT = "vendee_storage_updated";

export const initialCustomers: Customer[] = [
  // 1. ลูกค้าที่มีการใช้บริการแล้ว และเวรยังไม่หมดอายุ (สถานะ active)
  {
    id: "cust-001",
    name: "พี่สมหญิง",
    avatarColor: "bg-sky-500",
    createdAt: "2026-09-18T08:00:00Z",
  },

  // 2. ลูกค้าที่ยกเลิกบริการแล้ว (สถานะ cancelled)
  {
    id: "cust-002",
    name: "คุณสมหญิง สวยเสมอ",
    avatarColor: "bg-rose-500",
    createdAt: "2026-09-15T10:00:00Z",
  },

  // 3. ลูกค้าที่มีข้อมูลค้างชำระ (สถานะ pending)
  {
    id: "cust-003",
    name: "พี่กานดา",
    avatarColor: "bg-amber-500",
    createdAt: "2026-09-17T11:00:00Z",
  },

  // 4. ลูกค้าปกติที่เพิ่งเพิ่ม (สถานะ active)
  {
    id: "cust-004",
    name: "พี่ก้อย",
    avatarColor: "bg-emerald-500",
    createdAt: "2026-09-18T12:00:00Z",
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

export function isDateInPast(dateStr: string): boolean {
  try {
    const todayStr = "2026-09-19";
    return dateStr < todayStr;
  } catch {
    return false;
  }
}

/**
 * Conditional Visibility Rule for Shift Editing:
 * - Hide completely if shift cannot be edited.
 * - Do NOT display if:
 *   1. Shift is already past/locked (isLocked === true or historical date).
 *   2. Shift has been swapped out (status === 'swapped_out').
 *   3. Shift is cancelled (status === 'cancelled').
 * - Only shifts with status === 'active' and future/unlocked dates (today or future) can be edited.
 */
export function canEditShift(shift: ShiftRecord): boolean {
  if (shift.status !== "active") return false;
  if (shift.swapMeta?.isLocked) return false;
  if (isShiftInPast(shift.date)) return false;
  return true;
}

/**
 * Conditional Visibility Rule for Customer Service / Appointment Editing:
 * - Hide the edit button if service record is already completed or locked in the past.
 * - Show edit button for pending/upcoming appointments and editable today's service entries.
 */
export function canEditService(service: CustomerServiceRecord): boolean {
  if (service.status === "completed" || service.status === "cancelled") return false;
  if (isDateInPast(service.date)) return false;
  return true;
}

export const initialShifts: ShiftRecord[] = [

];

export const initialServices: CustomerServiceRecord[] = [];


/**
 * Synchronize local storage with Supabase database via Next.js Server Actions
 */
export async function syncAllDataFromApi(): Promise<{
  shifts: ShiftRecord[];
  customers: Customer[];
  services: CustomerServiceRecord[];
  personalEvents: PersonalEventRecord[];
  isOnline: boolean;
}> {
  if (typeof window === "undefined") {
    return {
      shifts: initialShifts,
      customers: initialCustomers,
      services: initialServices,
      personalEvents: [],
      isOnline: false,
    };
  }

  try {
    const [shiftsRes, servicesRes, personalEventsRes] = await Promise.allSettled([
      getShiftsAction(),
      getServicesAction(),
      getPersonalEventsAction(),
    ]);

    let shifts = getShifts();
    let services = getServices();
    let personalEvents = getPersonalEvents();
    let isOnline = false;

    if (shiftsRes.status === "fulfilled" && shiftsRes.value.success && Array.isArray(shiftsRes.value.data)) {
      if (shiftsRes.value.data.length > 0) {
        shifts = shiftsRes.value.data;
        localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
      } else if (shifts.length > 0) {
        // Automatically migrate any unpersisted local shifts to Supabase
        for (const localShift of shifts) {
          try {
            await createShiftAction({
              date: localShift.date,
              shiftType: localShift.shiftType,
              category: localShift.category,
              department: localShift.department,
              note: localShift.note,
            });
          } catch (_) {}
        }
        const refreshed = await getShiftsAction();
        if (refreshed.success && refreshed.data.length > 0) {
          shifts = refreshed.data;
          localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
        }
      }
      isOnline = true;
    }

    if (servicesRes.status === "fulfilled" && servicesRes.value.success && Array.isArray(servicesRes.value.data)) {
      if (servicesRes.value.data.length > 0) {
        services = servicesRes.value.data;
        localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
      }
      isOnline = true;
    }

    if (personalEventsRes.status === "fulfilled" && personalEventsRes.value.success && Array.isArray(personalEventsRes.value.data)) {
      personalEvents = personalEventsRes.value.data;
      localStorage.setItem(STORAGE_KEYS.PERSONAL_EVENTS, JSON.stringify(personalEvents));
      isOnline = true;
    }

    triggerSync();
    return {
      shifts,
      customers: getCustomers(),
      services,
      personalEvents,
      isOnline,
    };
  } catch (err) {
    console.warn("[VenDee Storage] Failed to sync with Supabase:", err);
    return {
      shifts: getShifts(),
      customers: getCustomers(),
      services: getServices(),
      personalEvents: getPersonalEvents(),
      isOnline: false,
    };
  }
}

export async function fetchMonthlyQuotaFromApi(yearMonth: string = "2026-09") {
  return getMonthlyBlackShiftStats(yearMonth);
}

export function triggerSync() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(SYNC_EVENT));
  }
}

export function subscribeToStorage(callback: () => void) {
  if (typeof window === "undefined") return () => { };
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

export async function saveCustomer(customer: Omit<Customer, "id"> & { id?: string }): Promise<Customer> {
  const current = getCustomers();
  const id = customer.id || `cust-${Date.now()}`;
  let newCustomer: Customer = {
    ...customer,
    id,
    createdAt: customer.createdAt || new Date().toISOString(),
    avatarColor: customer.avatarColor || "bg-teal-500",
  };

  const existingIdx = current.findIndex((c) => c.id === id);

  // 1. Local Customer Storage (Customers are managed locally and referenced by services)

  // 2. Save locally
  const latestList = getCustomers();
  const idx = latestList.findIndex((c) => c.id === id || c.id === newCustomer.id);
  let updated: Customer[];
  if (idx >= 0) {
    updated = [...latestList];
    updated[idx] = newCustomer;
  } else {
    updated = [newCustomer, ...latestList];
  }

  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updated));

  // Sync updated customer details to any services referencing this customerId
  try {
    const rawServices = localStorage.getItem(STORAGE_KEYS.SERVICES);
    if (rawServices) {
      const servicesList: CustomerServiceRecord[] = JSON.parse(rawServices);
      let anyChanged = false;
      const updatedServices = servicesList.map((srv) => {
        if (srv.customerId === id || srv.customerId === newCustomer.id) {
          anyChanged = true;
          return {
            ...srv,
            customerId: newCustomer.id,
            customerName: newCustomer.name,
          };
        }
        return srv;
      });
      if (anyChanged) {
        localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(updatedServices));
      }
    }
  } catch (_) { }

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

export async function saveShift(
  shift: Omit<ShiftRecord, "id" | "type" | "createdAt" | "status"> & {
    id?: string;
    status?: ShiftRecord["status"];
    createdAt?: string;
    swapMeta?: any;
    department?: string;
  }
): Promise<ShiftRecord> {
  const current = getShifts();
  const targetStatus = shift.status || "active";

  // Prevent duplicate active shift on the same date and same shift type
  if (targetStatus === "active") {
    const isDuplicate = current.some(
      (s) =>
        s.id !== shift.id &&
        s.date === shift.date &&
        s.shiftType === shift.shiftType &&
        s.status === "active"
    );
    if (isDuplicate) {
      const label = SHIFT_CONFIG[shift.shiftType]?.label || "เวร";
      throw new Error(`มี${label}ในวันที่ ${shift.date} อยู่แล้ว ไม่สามารถบันทึกซ้ำช่วงเวลาเดียวกันได้`);
    }

    // Check conflict with customer services on the same date
    if (shift.shiftType !== "r1" && shift.shiftType !== "r2") {
      const conflictingServices = findConflictingServices(shift.date, shift.shiftType);
      if (conflictingServices.length > 0) {
        const shiftInfo = SHIFT_CONFIG[shift.shiftType];
        const firstConf = conflictingServices[0];
        throw new Error(
          `ไม่สามารถบันทึก${shiftInfo?.label} (${shiftInfo?.period}) ได้ เนื่องจากมีนัดหมายบริการ "${firstConf.customerName}" เวลา ${firstConf.time} น. อยู่ในช่วงเวลานี้`
        );
      }
    }
  }

  const resolvedCategory =
    shift.shiftType === "r1" || shift.shiftType === "r2"
      ? "green"
      : shift.category || "black";

  let createdOrUpdatedShift: ShiftRecord | null = null;

  // 1. Sync with Supabase via Server Action
  const isExistingInDb = Boolean(shift.id && !shift.id.startsWith("shift-"));
  try {
    if (isExistingInDb) {
      const res = await updateShiftAction(shift.id!, {
        shiftType: shift.shiftType,
        category: resolvedCategory,
        department: shift.department,
        note: shift.note,
        status: targetStatus,
      });
      if (res.success && res.data) {
        createdOrUpdatedShift = res.data;
      } else if (!res.success) {
        throw new Error(res.error.message);
      }
    } else {
      const res = await createShiftAction({
        date: shift.date,
        shiftType: shift.shiftType,
        category: resolvedCategory,
        department: shift.department,
        note: shift.note,
      });
      if (res.success && res.data) {
        createdOrUpdatedShift = res.data;
      } else if (!res.success) {
        throw new Error(res.error.message);
      }
    }
  } catch (err: any) {
    if (err.message && !err.message.includes("fetch")) {
      throw err;
    }
    console.warn("Supabase saveShift warning:", err);
  }

  const finalId = createdOrUpdatedShift?.id || shift.id || `shift-${Date.now()}`;
  const existingIdx = current.findIndex((s) => s.id === finalId || s.id === shift.id);
  const existingShift = existingIdx >= 0 ? current[existingIdx] : undefined;

  const newShift: ShiftRecord = createdOrUpdatedShift || {
    ...existingShift,
    ...shift,
    category: resolvedCategory,
    id: finalId,
    type: "shift",
    status: targetStatus,
    createdAt: existingShift?.createdAt || shift.createdAt || new Date().toISOString(),
  };

  // 2. Save locally
  let updatedList: ShiftRecord[];
  if (existingIdx >= 0) {
    updatedList = [...current];
    updatedList[existingIdx] = newShift;
  } else {
    updatedList = [newShift, ...current];
  }

  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(updatedList));
  triggerSync();

  return newShift;
}

export async function deleteShift(id: string): Promise<{ restoredParentId?: string }> {
  const current = getShifts();
  const target = current.find((s) => s.id === id);

  if (!target) return {};

  // 1. Check if shift is in the past or locked (DOMAIN_RULES.md 2.3.1)
  if (target.swapMeta?.isLocked || isShiftInPast(target.date)) {
    throw new Error("ไม่สามารถลบเวรที่ผ่านเวลาไปแล้วได้ (เวรถูกล็อกอยู่)");
  }

  // 2. Check if shift is swapped_out OR acts as parentShiftId to another shift (DOMAIN_RULES.md 2.3.2)
  const hasChildShift = current.some((s) => s.swapMeta?.parentShiftId === id);
  if (target.status === "swapped_out" || hasChildShift) {
    throw new Error(
      "ไม่สามารถลบเวรที่ถูกแลกออกไปแล้วได้ กรุณาใช้ปุ่ม 'กู้คืนเวร (ยกเลิกการแลก)' แทนการลบเพื่อป้องกันประวัติการแลกสูญหาย"
    );
  }

  // 3. Call Supabase Server Action if online
  let restoredParentId: string | undefined = undefined;
  if (!id.startsWith("shift-")) {
    try {
      const res = await deleteShiftAction(id);
      if (!res.success) {
        throw new Error(res.error.message);
      }
      restoredParentId = res.data?.restoredParentId;
    } catch (err: any) {
      if (err.message && !err.message.includes("fetch")) {
        throw err;
      }
      console.warn("Supabase deleteShift warning:", err);
    }
  }

  // 4. Perform local delete & restore parent if applicable (for a received shift)
  const updated = current.filter((s) => s.id !== id);

  if (target.swapMeta?.parentShiftId) {
    const parent = updated.find((s) => s.id === target.swapMeta?.parentShiftId);
    if (parent && parent.status === "swapped_out") {
      parent.status = "active";
      restoredParentId = parent.id;
    }
  }

  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(updated));
  triggerSync();

  return { restoredParentId };
}

/**
 * Manually reactivate a swapped_out or inactive shift
 */
export async function restoreShift(shiftId: string): Promise<ShiftRecord> {
  const current = getShifts();
  const target = current.find((s) => s.id === shiftId);
  if (!target) {
    throw new Error("ไม่พบเวรที่ต้องการกู้คืน");
  }

  target.status = "active";
  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(current));
  triggerSync();

  // Supabase restore
  if (!shiftId.startsWith("shift-")) {
    try {
      await restoreShiftAction(shiftId);
    } catch (e) {
      console.warn("restoreShiftAction error:", e);
    }
  }

  return target;
}

/**
 * Perform a Complex Shift Swap
 * - Marks old shift as 'swapped_out'
 * - Creates a new shift with the received date, type, and category
 * - Populates swapMeta including direct partner, optional original owner, and trail
 */
export async function swapShift(params: {
  shiftId: string;
  swappedWith: string; // Direct Partner
  originalOwner?: string; // Original Owner (if top-up)
  newDate: string;
  newShiftType: ShiftType;
  newCategory: ShiftCategory;
  swapReason?: string;
}): Promise<{ newShift: ShiftRecord; oldShift: ShiftRecord }> {
  const current = getShifts();
  const oldShift = current.find((s) => s.id === params.shiftId);
  if (!oldShift) {
    throw new Error("ไม่พบเวรที่ต้องการแลก");
  }

  const targetCategory =
    params.newShiftType === "r1" || params.newShiftType === "r2"
      ? "green"
      : params.newCategory;

  // Same Shift Type & Date Category Swap Exception (DOMAIN_RULES.md 2.2.3):
  // Permit same date + same shiftType swap IF AND ONLY IF changing between Black and Red categories
  if (oldShift.date === params.newDate && oldShift.shiftType === params.newShiftType) {
    const isBlackRedSwap =
      (oldShift.category === "black" && targetCategory === "red") ||
      (oldShift.category === "red" && targetCategory === "black");

    if (!isBlackRedSwap) {
      const label = SHIFT_CONFIG[params.newShiftType]?.label || "เวรเดิม";
      const dateFormatted = moment(params.newDate).locale("th").format("D MMMM YYYY");
      throw new Error(
        `การแลก${label}ในวันเดียวกัน (${dateFormatted}) สามารถแลกได้เฉพาะกรณีเปลี่ยนหมวดระหว่างเวรดำและเวรแดงเท่านั้น (เช่น เช้าดำ ↔ เช้าแดง)`
      );
    }
  }

  // Prevent duplicate active shift on newDate, newShiftType, AND targetCategory
  const duplicate = current.find(
    (s) =>
      s.id !== params.shiftId &&
      s.date === params.newDate &&
      s.shiftType === params.newShiftType &&
      s.category === targetCategory &&
      s.status === "active"
  );
  if (duplicate) {
    const label = SHIFT_CONFIG[params.newShiftType]?.label || "เวร";
    const catLabel = SHIFT_CATEGORY_CONFIG[targetCategory]?.label || "";
    throw new Error(`คุณมี${label} (${catLabel}) ในวันที่ ${params.newDate} อยู่แล้ว ไม่สามารถแลกมารับเวรซ้ำช่วงเวลาและหมวดเดียวกันได้`);
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

  let dbResult: { newShift: ShiftRecord; oldShift: ShiftRecord } | null = null;
  if (!oldShift.id.startsWith("shift-")) {
    try {
      const res = await swapShiftAction({
        shiftId: oldShift.id,
        swappedWith: params.swappedWith,
        originalOwner: params.originalOwner,
        newDate: params.newDate,
        newShiftType: params.newShiftType,
        newCategory: resolvedCategory,
        swapReason: params.swapReason,
        swapHistory: trail,
      });
      if (res.success && res.data) {
        dbResult = res.data;
      }
    } catch (err) {
      console.warn("swapShiftAction warning:", err);
    }
  }

  // Update old shift status to swapped_out
  oldShift.status = "swapped_out";

  const newShift: ShiftRecord = dbResult?.newShift || {
    id: `shift-${Date.now()}`,
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

  return { newShift, oldShift: dbResult?.oldShift || oldShift };
}

/**
 * Undo / Rollback a shift swap (DOMAIN_RULES.md 2.3.3 Bidirectional Rollback)
 * - Restores parentShift to 'active'
 * - Removes/cancels the shift received during the swap
 * - Only permitted if isLocked === false
 */
export async function undoSwapShift(shiftId: string): Promise<boolean> {
  const current = getShifts();
  const targetShift = current.find((s) => s.id === shiftId);
  if (!targetShift) {
    return false;
  }

  if (targetShift.swapMeta?.isLocked || isShiftInPast(targetShift.date)) {
    throw new Error("ไม่สามารถยกเลิกได้เนื่องจากเวรผ่านเวลาไปแล้ว (เวรถูกล็อกอยู่)");
  }

  let parentShift: ShiftRecord | undefined;
  let childShift: ShiftRecord | undefined;

  if (targetShift.swapMeta?.parentShiftId) {
    // targetShift is the received shift
    childShift = targetShift;
    parentShift = current.find((s) => s.id === targetShift.swapMeta?.parentShiftId);
  } else if (targetShift.status === "swapped_out") {
    // targetShift is the original shift that was swapped out
    parentShift = targetShift;
    childShift = current.find((s) => s.swapMeta?.parentShiftId === targetShift.id);
  } else {
    childShift = current.find((s) => s.swapMeta?.parentShiftId === targetShift.id);
    if (childShift) {
      parentShift = targetShift;
    }
  }

  // 1. Restore parent shift to active
  if (parentShift) {
    parentShift.status = "active";
  }

  // 2. Remove/Cancel the received child shift
  const childIdToRemove = childShift?.id || (targetShift.swapMeta?.parentShiftId ? targetShift.id : undefined);
  const updated = current.filter((s) => s.id !== childIdToRemove);

  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(updated));
  triggerSync();

  // Supabase rollback
  try {
    const apiTargetId = childIdToRemove || shiftId;
    if (!apiTargetId.startsWith("shift-")) {
      await undoSwapShiftAction(apiTargetId);
    }
  } catch (e) {
    console.warn("undoSwapShiftAction warning:", e);
  }

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
      return (t >= "00:00" && t < "08:00") || t === "00:00";
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

export async function saveService(
  service: Omit<CustomerServiceRecord, "id" | "type" | "createdAt"> & {
    id?: string;
    createdAt?: string;
  }
): Promise<CustomerServiceRecord> {
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
  const existingIdx = current.findIndex((s) => s.id === id);
  const existingService = existingIdx >= 0 ? current[existingIdx] : undefined;

  let createdService: CustomerServiceRecord | null = null;
  if (!id.startsWith("srv-") || existingIdx < 0) {
    try {
      const res = await createServiceAction({
        customerId: service.customerId,
        customerName: service.customerName,
        date: service.date,
        time: service.time,
        services: service.services || ["injection"],
        otherServiceText: service.otherServiceText,
        medications: service.medications,
        note: service.note,
        price: service.price,
      });
      if (res.success && res.data) {
        createdService = res.data;
      }
    } catch (e) {
      console.warn("createServiceAction warning:", e);
    }
  }

  const finalId = createdService?.id || id;
  const newService: CustomerServiceRecord = createdService || {
    ...existingService,
    ...service,
    id: finalId,
    type: "service",
    createdAt: existingService?.createdAt || service.createdAt || new Date().toISOString(),
  };

  // 2. Save locally
  const latestList = getServices();
  const idx = latestList.findIndex((s) => s.id === finalId || s.id === id);
  let updated: CustomerServiceRecord[];
  if (idx >= 0) {
    updated = [...latestList];
    updated[idx] = newService;
  } else {
    updated = [newService, ...latestList];
  }

  localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(updated));
  triggerSync();

  return newService;
}

export async function deleteService(id: string): Promise<void> {
  const current = getServices();
  const target = current.find((s) => s.id === id);

  // 1. Check if service date is in the past
  if (target && isDateInPast(target.date)) {
    throw new Error("ไม่สามารถลบบริการย้อนหลังหรือที่ผ่านเวลาไปแล้วได้ (Overtime / Past service)");
  }

  // 2. Call Supabase delete action
  if (!id.startsWith("srv-")) {
    try {
      await deleteServiceAction(id);
    } catch (err: any) {
      console.warn("deleteServiceAction warning:", err);
    }
  }

  // 3. Perform local delete
  const updated = current.filter((s) => s.id !== id);
  localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(updated));
  triggerSync();
}

// Medications Storage Management
export const initialMedications: Medications[] = [
  { id: "med-1", name: "Vitamin B12", price: "200", unit: "เข็ม" },
  { id: "med-2", name: "NSS 100ml", price: "150", unit: "ขวด" },
  { id: "med-3", name: "Fat Burner", price: "500", unit: "เข็ม" },
  { id: "med-4", name: "Collagen IV Drip", price: "800", unit: "ชุด" },
  { id: "med-5", name: "Paracetamol", price: "50", unit: "แผง" },
];

export function getMedications(): Medications[] {
  if (typeof window === "undefined") return initialMedications;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEDICATIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(initialMedications));
      return initialMedications;
    }
    return JSON.parse(raw);
  } catch {
    return initialMedications;
  }
}

export function saveMedication(med: Omit<Medications, "id"> & { id?: string }): Medications {
  const current = getMedications();
  const id = med.id || `med-${Date.now()}`;
  const newMed: Medications = {
    ...med,
    id,
    createdAt: med.createdAt || new Date().toISOString(),
  };

  const idx = current.findIndex((m) => m.id === id);
  let updated: Medications[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = newMed;
  } else {
    updated = [newMed, ...current];
  }

  localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(updated));
  triggerSync();
  return newMed;
}

export function deleteMedication(id: string): void {
  const current = getMedications();
  const updated = current.filter((m) => m.id !== id);
  localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(updated));
  triggerSync();
}

export function getMedicationById(id: string): Medications | undefined {
  return getMedications().find((m) => m.id === id);
}

// Clinic Work Logs Storage Management
export const initialClinicLogs: ClinicWorkRecord[] = [];

export function getClinicLogs(): ClinicWorkRecord[] {
  if (typeof window === "undefined") return initialClinicLogs;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CLINIC_LOGS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CLINIC_LOGS, JSON.stringify(initialClinicLogs));
      return initialClinicLogs;
    }
    return JSON.parse(raw);
  } catch {
    return initialClinicLogs;
  }
}

export function canEditClinicLog(log: ClinicWorkRecord): boolean {
  if (isDateInPast(log.date)) return false;
  return true;
}

export function saveClinicLog(
  log: Omit<ClinicWorkRecord, "id" | "type" | "createdAt"> & { id?: string; createdAt?: string }
): ClinicWorkRecord {
  const current = getClinicLogs();
  const id = log.id || `clinic-${Date.now()}`;
  const idx = current.findIndex((c) => c.id === id);
  const existing = idx >= 0 ? current[idx] : undefined;

  const newLog: ClinicWorkRecord = {
    ...existing,
    ...log,
    id,
    type: "clinic",
    createdAt: existing?.createdAt || log.createdAt || new Date().toISOString(),
  };

  let updated: ClinicWorkRecord[];
  if (idx >= 0) {
    updated = [...current];
    updated[idx] = newLog;
  } else {
    updated = [newLog, ...current];
  }

  localStorage.setItem(STORAGE_KEYS.CLINIC_LOGS, JSON.stringify(updated));
  triggerSync();
  return newLog;
}

export function deleteClinicLog(id: string): void {
  const current = getClinicLogs();
  const target = current.find((c) => c.id === id);
  if (target && isDateInPast(target.date)) {
    throw new Error("ไม่สามารถลบบันทึกงานคลินิกย้อนหลังได้");
  }

  const updated = current.filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.CLINIC_LOGS, JSON.stringify(updated));
  triggerSync();
}

export function getPersonalEvents(): PersonalEventRecord[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.PERSONAL_EVENTS);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export async function savePersonalEvent(data: {
  title: string;
  eventDate: string;
  startTime: string;
  endTime: string;
  isAllDay?: boolean;
  relationshipTag?: any;
  location?: string;
  notes?: string;
}): Promise<PersonalEventRecord> {
  let createdRecord: PersonalEventRecord | null = null;

  try {
    const res = await createPersonalEventAction({
      title: data.title,
      eventDate: data.eventDate,
      startTime: data.startTime,
      endTime: data.endTime,
      isAllDay: data.isAllDay,
      relationshipTag: data.relationshipTag,
      location: data.location,
      notes: data.notes,
    });
    if (res.success && res.data?.event) {
      createdRecord = res.data.event;
    }
  } catch (err) {
    console.warn("createPersonalEventAction warning:", err);
  }

  if (!createdRecord) {
    createdRecord = {
      id: `pevent-${Date.now()}`,
      type: "personal_event",
      title: data.title,
      date: data.eventDate,
      eventDate: data.eventDate,
      startTime: data.startTime,
      endTime: data.endTime,
      isAllDay: data.isAllDay,
      relationshipTag: data.relationshipTag,
      location: data.location,
      notes: data.notes,
      createdAt: new Date().toISOString(),
    };
  }

  const events = getPersonalEvents();
  const existingIdx = events.findIndex((e) => e.id === createdRecord!.id);
  if (existingIdx >= 0) {
    events[existingIdx] = createdRecord;
  } else {
    events.unshift(createdRecord);
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.PERSONAL_EVENTS, JSON.stringify(events));
    triggerSync();
  }

  return createdRecord;
}

export async function deletePersonalEvent(id: string): Promise<void> {
  const events = getPersonalEvents().filter((e) => e.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.PERSONAL_EVENTS, JSON.stringify(events));
    triggerSync();
  }

  if (!id.startsWith("pevent-")) {
    try {
      await deletePersonalEventAction(id);
    } catch (e) {
      console.warn("deletePersonalEventAction warning:", e);
    }
  }
}

// All Activities combined sorted latest first
export function getAllActivities(): ActivityItem[] {
  const shifts = getShifts();
  const visibleShifts = shifts.filter((s) => s.status !== "cancelled");
  const services = getServices();
  const clinicLogs = getClinicLogs();
  const personalEvents = getPersonalEvents();

  const combined: ActivityItem[] = [...visibleShifts, ...services, ...clinicLogs, ...personalEvents];

  return combined.sort((a, b) => {
    const dateA = a.type === "personal_event" ? (a as PersonalEventRecord).eventDate : a.date;
    const dateB = b.type === "personal_event" ? (b as PersonalEventRecord).eventDate : b.date;
    const dateComp = dateB.localeCompare(dateA);
    if (dateComp !== 0) return dateComp;

    const getTimeStr = (item: ActivityItem) => {
      if (item.type === "service") return (item as CustomerServiceRecord).time || "00:00";
      if (item.type === "clinic") return (item as ClinicWorkRecord).presetShift.split(" - ")[0] || "00:00";
      if (item.type === "personal_event") return (item as PersonalEventRecord).startTime || "00:00";
      const shift = item as ShiftRecord;
      const conf = SHIFT_CONFIG[shift.shiftType];
      return conf?.period ? conf.period.split(" - ")[0] : "00:00";
    };

    return getTimeStr(b).localeCompare(getTimeStr(a));
  });
}

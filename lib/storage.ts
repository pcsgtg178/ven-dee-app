"use client";

import { shiftsApi, customersApi, servicesApi, analyticsApi } from "./api";

import {
  Customer,
  CustomerServiceRecord,
  ShiftRecord,
  ShiftCategory,
  ShiftType,
  DEFAULT_BLACK_SHIFT_QUOTA,
  SwapTrailNode,
  SHIFT_CONFIG,
  Medications,
  ClinicWorkRecord,
  ClinicPresetShift,
  ActivityItem,
} from "../types/vendee";

const STORAGE_KEYS = {
  SHIFTS: "vendee_shifts_v2", // bumped to v2 for swap schema
  SERVICES: "vendee_services_v1",
  CUSTOMERS: "vendee_customers_v1",
  MEDICATIONS: "vendee_medications_v1",
  CLINIC_LOGS: "vendee_clinic_logs_v1",
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
 * Synchronize local storage with live backend REST API (http://localhost:8080/api/v1)
 */
export async function syncAllDataFromApi(): Promise<{
  shifts: ShiftRecord[];
  customers: Customer[];
  services: CustomerServiceRecord[];
  isOnline: boolean;
}> {
  if (typeof window === "undefined") {
    return { shifts: initialShifts, customers: initialCustomers, services: initialServices, isOnline: false };
  }

  try {
    const [shiftsRes, customersRes, servicesRes] = await Promise.allSettled([
      shiftsApi.getAll(),
      customersApi.getAll(),
      servicesApi.getAll(),
    ]);

    let shifts = getShifts();
    let customers = getCustomers();
    let services = getServices();
    let isOnline = false;

    if (shiftsRes.status === "fulfilled" && Array.isArray(shiftsRes.value) && shiftsRes.value.length > 0) {
      shifts = shiftsRes.value;
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
      isOnline = true;
    }

    if (customersRes.status === "fulfilled" && Array.isArray(customersRes.value) && customersRes.value.length > 0) {
      customers = customersRes.value;
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
      isOnline = true;
    }

    if (servicesRes.status === "fulfilled" && Array.isArray(servicesRes.value) && servicesRes.value.length > 0) {
      services = servicesRes.value;
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
      isOnline = true;
    }

    triggerSync();
    return { shifts, customers, services, isOnline };
  } catch (err) {
    console.warn("[VenDee Storage] Failed to sync with backend API:", err);
    return { shifts: getShifts(), customers: getCustomers(), services: getServices(), isOnline: false };
  }
}

export async function fetchMonthlyQuotaFromApi(yearMonth: string = "2026-09") {
  try {
    const data = await analyticsApi.getMonthlyQuota(yearMonth);
    return data;
  } catch (err) {
    console.warn("[VenDee Storage] Failed to fetch quota from API:", err);
    return null;
  }
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

  // 1. Sync with API if online
  if (typeof window !== "undefined") {
    try {
      if (existingIdx >= 0) {
        const res = await customersApi.update(newCustomer.id, {
          name: newCustomer.name,
          avatarColor: newCustomer.avatarColor,
        });
        if (res) newCustomer = { ...newCustomer, ...res };
      } else {
        const created = await customersApi.create({
          name: newCustomer.name,
          avatarColor: newCustomer.avatarColor,
        });
        if (created?.id) {
          newCustomer = { ...newCustomer, ...created };
        }
      }
    } catch (e) {
      console.warn("API saveCustomer warning:", e);
    }
  }

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
  }
): Promise<ShiftRecord> {
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

  const existingIdx = current.findIndex((s) => s.id === id);
  const existingShift = existingIdx >= 0 ? current[existingIdx] : undefined;

  let newShift: ShiftRecord = {
    ...existingShift,
    ...shift,
    category: resolvedCategory,
    id,
    type: "shift",
    status: targetStatus,
    createdAt: existingShift?.createdAt || shift.createdAt || new Date().toISOString(),
  };

  // 1. Sync with API if online
  if (typeof window !== "undefined") {
    try {
      if (existingIdx >= 0) {
        const res = await shiftsApi.update(newShift.id, {
          department: newShift.department || undefined,
          note: newShift.note || undefined,
        });
        if (res) newShift = { ...newShift, ...res };
      } else {
        const created = await shiftsApi.create({
          date: newShift.date,
          shiftType: newShift.shiftType,
          category: newShift.category,
          department: newShift.department || undefined,
          note: newShift.note || undefined,
        });
        if (created?.id) {
          newShift = { ...newShift, ...created };
        }
      }
    } catch (e) {
      console.warn("API saveShift warning:", e);
    }
  }

  // 2. Save locally
  const latestList = getShifts();
  const idx = latestList.findIndex((s) => s.id === id || s.id === newShift.id);
  let updated: ShiftRecord[];
  if (idx >= 0) {
    updated = [...latestList];
    updated[idx] = newShift;
  } else {
    updated = [newShift, ...latestList];
  }

  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(updated));
  triggerSync();

  return newShift;
}

export async function deleteShift(id: string): Promise<{ restoredParentId?: string }> {
  const current = getShifts();
  const target = current.find((s) => s.id === id);

  // 1. Check if shift is in the past
  if (target && isShiftInPast(target.date)) {
    throw new Error("ไม่สามารถลบเวรที่ผ่านเวลาไปแล้วได้ (Overtime / Past shift)");
  }

  // 2. Call backend API if online
  if (typeof window !== "undefined") {
    try {
      await shiftsApi.delete(id);
    } catch (err: any) {
      if (err?.status && err.status >= 400) {
        throw new Error(err.message || "ไม่สามารถลบเวรที่ผ่านเวลาไปแล้วได้");
      }
      console.warn("Backend API offline during deleteShift, performing local delete:", err);
    }
  }

  // 3. Perform local delete & restore parent if applicable
  let restoredParentId: string | undefined = undefined;
  const updated = current.filter((s) => s.id !== id);

  if (target?.swapMeta?.parentShiftId) {
    const parent = updated.find((s) => s.id === target.swapMeta?.parentShiftId);
    if (parent && parent.status === "swapped_out") {
      parent.status = "active";
      restoredParentId = parent.id;
    }
  }

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

  // API Async Sync: restoreShift
  if (typeof window !== "undefined") {
    shiftsApi.restore(shiftId).catch((e) => console.warn("shiftsApi.restore error:", e));
  }

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

  // API Async Sync: swapShift
  if (typeof window !== "undefined") {
    shiftsApi.swap(oldShift.id, {
      newDate: params.newDate,
      newShiftType: params.newShiftType,
      newCategory: params.newCategory,
      swappedWith: params.swappedWith,
      originalOwner: params.originalOwner || undefined,
      swapReason: params.swapReason || undefined,
    }).then((res) => {
      if (res?.newShift?.id && res.newShift.id !== newShift.id) {
        const list = getShifts();
        const sIdx = list.findIndex((s) => s.id === newShift.id);
        if (sIdx >= 0) {
          list[sIdx] = { ...list[sIdx], id: res.newShift.id };
          localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(list));
          triggerSync();
        }
      }
    }).catch((e) => console.warn("shiftsApi.swap error:", e));
  }

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

  // API Async Sync: undoSwapShift
  if (typeof window !== "undefined") {
    shiftsApi.undoSwap(shiftId).catch((e) => console.warn("shiftsApi.undoSwap error:", e));
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

  let newService: CustomerServiceRecord = {
    ...existingService,
    ...service,
    id,
    type: "service",
    createdAt: existingService?.createdAt || service.createdAt || new Date().toISOString(),
  };

  // 1. Sync with API if online
  if (typeof window !== "undefined") {
    try {
      if (existingIdx >= 0) {
        if (newService.status) {
          const res = await servicesApi.updateStatus(newService.id, newService.status);
          if (res) newService = { ...newService, ...res };
        }
      } else {
        const created = await servicesApi.create({
          customerId: newService.customerId,
          customerName: newService.customerName,
          date: newService.date,
          time: newService.time,
          services: newService.services || ["injection"],
          otherServiceText: newService.otherServiceText,
          medications: newService.medications,
          note: newService.note,
          price: newService.price,
          status: newService.status,
        });
        if (created?.id) {
          newService = { ...newService, ...created };
        }
      }
    } catch (e) {
      console.warn("API saveService warning:", e);
    }
  }

  // 2. Save locally
  const latestList = getServices();
  const idx = latestList.findIndex((s) => s.id === id || s.id === newService.id);
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

  // 2. Call backend API if online
  if (typeof window !== "undefined") {
    try {
      await servicesApi.delete(id);
    } catch (err: any) {
      if (err?.status && err.status >= 400) {
        throw new Error(err.message || "ไม่สามารถลบบริการย้อนหลังหรือที่ผ่านเวลาไปแล้วได้");
      }
      console.warn("Backend API offline during deleteService, performing local delete:", err);
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

// All Activities combined sorted latest first
export function getAllActivities(): ActivityItem[] {
  const shifts = getShifts();
  const visibleShifts = shifts.filter((s) => s.status !== "cancelled");
  const services = getServices();
  const clinicLogs = getClinicLogs();

  const combined: ActivityItem[] = [...visibleShifts, ...services, ...clinicLogs];

  return combined.sort((a, b) => {
    const dateComp = b.date.localeCompare(a.date);
    if (dateComp !== 0) return dateComp;

    const getTimeStr = (item: ActivityItem) => {
      if (item.type === "service") return (item as CustomerServiceRecord).time || "00:00";
      if (item.type === "clinic") return (item as ClinicWorkRecord).presetShift.split(" - ")[0] || "00:00";
      const shift = item as ShiftRecord;
      const conf = SHIFT_CONFIG[shift.shiftType];
      return conf?.period ? conf.period.split(" - ")[0] : "00:00";
    };

    return getTimeStr(b).localeCompare(getTimeStr(a));
  });
}

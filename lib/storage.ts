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
  updateServiceAction,
  deleteServiceAction,
  deleteServicesByCustomerIdAction,
} from "../app/actions/serviceActions";
import {
  getPersonalEventsAction,
  createPersonalEventAction,
  deletePersonalEventAction,
} from "../app/actions/personalEventActions";
import {
  getMedicationsAction,
  createMedicationAction,
  updateMedicationAction,
  deleteMedicationAction,
} from "../app/actions/medicationActions";

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
  CalendarFeedConfig,
} from "../types/vendee";
import { generateSecureFeedToken, DEFAULT_FEED_TOKEN } from "./calendar/feedToken";
import { regenerateFeedTokenAction } from "../app/actions/calendarActions";

const STORAGE_KEYS = {
  SHIFTS: "vendee_shifts_v2", // bumped to v2 for swap schema
  SERVICES: "vendee_services_v1",
  CUSTOMERS: "vendee_customers_v1",
  MEDICATIONS: "vendee_medications_v1",
  CLINIC_LOGS: "vendee_clinic_logs_v1",
  PERSONAL_EVENTS: "vendee_personal_events_v1",
  CALENDAR_FEED: "vendee_calendar_feed_v1",
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
  {
    id: "shift-sample-1",
    type: "shift",
    date: "2026-09-18",
    shiftType: "morning",
    category: "black",
    status: "active",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "shift-sample-2",
    type: "shift",
    date: "2026-09-19",
    shiftType: "night",
    category: "black",
    status: "active",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "shift-sample-swap-1",
    type: "shift",
    date: "2026-09-21",
    shiftType: "morning",
    category: "black",
    status: "active",
    swapMeta: {
      swappedWith: "พี่เซ",
      isLocked: false,
      swapDate: "2026-09-15",
      swapReason: "แลกเวรเช้าแทนพี่เซ",
    },
    createdAt: "2026-09-15T08:00:00Z",
  },
  {
    id: "shift-sample-swap-2",
    type: "shift",
    date: "2026-09-21",
    shiftType: "afternoon",
    category: "red",
    status: "active",
    swapMeta: {
      swappedWith: "ดรีม",
      isLocked: false,
      swapDate: "2026-09-16",
      swapReason: "รับเวรบ่ายต่อจากดรีม",
    },
    createdAt: "2026-09-16T12:00:00Z",
  },
  {
    id: "shift-sample-5",
    type: "shift",
    date: "2026-09-23",
    shiftType: "r1",
    category: "green",
    status: "active",
    createdAt: "2026-09-01T08:00:00Z",
  },
];

export const initialServices: CustomerServiceRecord[] = [
  {
    id: "srv-001",
    type: "service",
    customerId: "cust-001",
    customerName: "พี่สมหญิง",
    date: "2026-09-18",
    time: "17:30",
    services: ["injection"],
    medications: ["Vitamin B12", "NSS 100ml"],
    price: 800,
    serviceFeeSatang: 80000,
    medicationCostSatang: 35000,
    status: "completed",
    note: "ฉีดวิตามินและให้น้ำเกลือ อาการสดชื่นดี",
    createdAt: "2026-09-18T08:00:00Z",
  },
  {
    id: "srv-002",
    type: "service",
    customerId: "cust-004",
    customerName: "พี่ก้อย",
    date: "2026-09-19",
    time: "10:30",
    services: ["injection"],
    medications: ["Collagen IV Drip"],
    price: 1500,
    serviceFeeSatang: 150000,
    medicationCostSatang: 80000,
    status: "upcoming",
    note: "ดริปคอลลาเจนสูตรเข้มข้น นัดที่บ้าน",
    createdAt: "2026-09-18T10:00:00Z",
  },
  {
    id: "srv-003",
    type: "service",
    customerId: "cust-003",
    customerName: "พี่กานดา",
    date: "2026-09-22",
    time: "14:00",
    services: ["injection"],
    medications: ["Fat Burner", "Vitamin B12"],
    price: 1800,
    serviceFeeSatang: 180000,
    medicationCostSatang: 70000,
    status: "upcoming",
    note: "ฉีด Fat Burner ร่วมกับวิตามิน บี12",
    createdAt: "2026-09-18T11:00:00Z",
  },
  {
    id: "srv-004",
    type: "service",
    customerId: "cust-002",
    customerName: "คุณสมหญิง สวยเสมอ",
    date: "2026-09-25",
    time: "11:00",
    services: ["injection"],
    medications: ["Vitamin B12"],
    price: 600,
    serviceFeeSatang: 60000,
    medicationCostSatang: 20000,
    status: "upcoming",
    note: "นัดฉีดวิตามินต่อเนื่องสัปดาห์ละครั้ง",
    createdAt: "2026-09-18T12:00:00Z",
  },
];


/**
 * Synchronize local storage with Supabase database via Next.js Server Actions
 */
export async function syncAllDataFromApi(): Promise<{
  shifts: ShiftRecord[];
  customers: Customer[];
  services: CustomerServiceRecord[];
  personalEvents: PersonalEventRecord[];
  medications: Medications[];
  isOnline: boolean;
}> {
  if (typeof window === "undefined") {
    return {
      shifts: initialShifts,
      customers: initialCustomers,
      services: initialServices,
      personalEvents: [],
      medications: initialMedications,
      isOnline: false,
    };
  }

  try {
    const [shiftsRes, servicesRes, personalEventsRes, medicationsRes] = await Promise.allSettled([
      getShiftsAction(),
      getServicesAction(),
      getPersonalEventsAction(),
      getMedicationsAction(),
    ]);

    let shifts = getShifts();
    let services = getServices();
    let personalEvents = getPersonalEvents();
    let medications = getMedications();
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
        const remoteServices = servicesRes.value.data.map((s) => ({
          ...s,
          time: (s.time || "09:00").slice(0, 5),
          medications: Array.isArray(s.medications) ? s.medications.filter(Boolean) : [],
        }));
        const remoteIds = new Set(remoteServices.map((s) => s.id));
        const localOnly = services.filter((s) => !remoteIds.has(s.id) && s.id.startsWith("srv-"));
        services = [...remoteServices, ...localOnly];
        localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(services));
      }
      isOnline = true;
    }

    if (personalEventsRes.status === "fulfilled" && personalEventsRes.value.success && Array.isArray(personalEventsRes.value.data)) {
      personalEvents = personalEventsRes.value.data;
      localStorage.setItem(STORAGE_KEYS.PERSONAL_EVENTS, JSON.stringify(personalEvents));
      isOnline = true;
    }

    if (medicationsRes.status === "fulfilled" && medicationsRes.value.success && Array.isArray(medicationsRes.value.data)) {
      if (medicationsRes.value.data.length > 0) {
        const remoteMeds = medicationsRes.value.data;
        const remoteIds = new Set(remoteMeds.map((m) => m.id));
        const localOnly = medications.filter(
          (m) => !remoteIds.has(m.id) && m.id.startsWith("med-")
        );
        medications = [...remoteMeds, ...localOnly];
        localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(medications));
      } else if (medications.length > 0) {
        // Automatically migrate / seed initial local medications to Supabase
        for (const localMed of medications) {
          try {
            await createMedicationAction({
              name: localMed.name,
              size: localMed.size,
              unit: localMed.unit,
              price: localMed.price,
              description: localMed.description || localMed.note,
            });
          } catch (_) {}
        }
        const refreshed = await getMedicationsAction();
        if (refreshed.success && refreshed.data.length > 0) {
          medications = refreshed.data;
          localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(medications));
        }
      }
      isOnline = true;
    }

    triggerSync();
    return {
      shifts,
      customers: getCustomers(),
      services,
      personalEvents,
      medications,
      isOnline,
    };
  } catch (err) {
    console.warn("[VenDee Storage] Failed to sync with Supabase:", err);
    return {
      shifts: getShifts(),
      customers: getCustomers(),
      services: getServices(),
      personalEvents: getPersonalEvents(),
      medications: getMedications(),
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

export async function deleteCustomer(id: string): Promise<void> {
  const currentCustomers = getCustomers();
  const target = currentCustomers.find((c) => c.id === id);
  if (!target) return;

  // 1. Remove customer
  const updatedCustomers = currentCustomers.filter((c) => c.id !== id);
  localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(updatedCustomers));

  // 2. Remove all services and history linked to this customer
  const currentServices = getServices();
  const servicesToDelete = currentServices.filter((s) => s.customerId === id);
  const remainingServices = currentServices.filter((s) => s.customerId !== id);
  localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(remainingServices));

  // 3. Supabase sync
  try {
    await deleteServicesByCustomerIdAction(id);
    for (const srv of servicesToDelete) {
      if (!srv.id.startsWith("srv-")) {
        await deleteServiceAction(srv.id);
      }
    }
  } catch (err) {
    console.warn("deleteCustomer remote services warning:", err);
  }

  // 4. Trigger UI sync
  triggerSync();
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
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(initialShifts));
      return initialShifts;
    }
    return parsed;
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
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      localStorage.setItem(STORAGE_KEYS.SERVICES, JSON.stringify(initialServices));
      return initialServices;
    }
    return parsed;
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
  const isUpdate = Boolean(service.id && current.some((s) => s.id === service.id));
  const id = service.id || `srv-${Date.now()}`;
  const existingIdx = current.findIndex((s) => s.id === id);
  const existingService = existingIdx >= 0 ? current[existingIdx] : undefined;
  const normalizedTime = (service.time || "09:00").slice(0, 5);
  const cleanMeds = (service.medications || []).map((m) => m.trim()).filter(Boolean);

  let remoteService: CustomerServiceRecord | null = null;

  if (isUpdate) {
    // If updating a record that exists in Supabase (UUID), use updateServiceAction
    if (!id.startsWith("srv-")) {
      try {
        const res = await updateServiceAction(id, {
          customerId: service.customerId,
          customerName: service.customerName,
          date: service.date,
          time: normalizedTime,
          services: service.services || ["injection"],
          otherServiceText: service.otherServiceText,
          medications: cleanMeds,
          note: service.note,
          price: service.price,
        });
        if (res.success && res.data) {
          remoteService = res.data;
        }
      } catch (e) {
        console.warn("updateServiceAction warning:", e);
      }
    }
  } else {
    // Creating a brand new service record
    try {
      const res = await createServiceAction({
        customerId: service.customerId,
        customerName: service.customerName,
        date: service.date,
        time: normalizedTime,
        services: service.services || ["injection"],
        otherServiceText: service.otherServiceText,
        medications: cleanMeds,
        note: service.note,
        price: service.price,
      });
      if (res.success && res.data) {
        remoteService = res.data;
      }
    } catch (e) {
      console.warn("createServiceAction warning:", e);
    }
  }

  const finalId = remoteService?.id || id;
  const newService: CustomerServiceRecord = remoteService || {
    ...existingService,
    ...service,
    id: finalId,
    type: "service",
    time: normalizedTime,
    medications: cleanMeds,
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
  {
    id: "med-botox-100",
    name: "Botox",
    size: "100",
    unit: "ยูนิต",
    price: "2500",
    priceSatang: 250000,
    description: "นาบูตะ *นำเข้า",
    note: "นาบูตะ *นำเข้า",
    createdAt: "2026-10-11T08:00:00Z",
  },
  {
    id: "med-botox-50",
    name: "Botox",
    size: "50",
    unit: "ยูนิต",
    price: "1500",
    priceSatang: 150000,
    description: "นาบูตะ *นำเข้า",
    note: "นาบูตะ *นำเข้า",
    createdAt: "2026-10-11T08:00:00Z",
  },
  {
    id: "med-1",
    name: "Vitamin B12",
    size: "1",
    unit: "เข็ม",
    price: "200",
    priceSatang: 20000,
    description: "วิตามินบำรุงประสาทและร่างกาย",
    note: "วิตามินบำรุงประสาทและร่างกาย",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "med-2",
    name: "NSS 100ml",
    size: "100",
    unit: "ขวด",
    price: "150",
    priceSatang: 15000,
    description: "น้ำเกลือ 0.9% Normal Saline Solution",
    note: "น้ำเกลือ 0.9% Normal Saline Solution",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "med-3",
    name: "Fat Burner",
    size: "1",
    unit: "เข็ม",
    price: "500",
    priceSatang: 50000,
    description: "สูตรเร่งเผาผลาญไขมันเฉพาะจุด",
    note: "สูตรเร่งเผาผลาญไขมันเฉพาะจุด",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "med-4",
    name: "Collagen IV Drip",
    size: "1",
    unit: "ชุด",
    price: "800",
    priceSatang: 80000,
    description: "ดริปวิตามินผิวเข้มข้น",
    note: "ดริปวิตามินผิวเข้มข้น",
    createdAt: "2026-09-01T08:00:00Z",
  },
  {
    id: "med-5",
    name: "Paracetamol",
    size: "10",
    unit: "แผง",
    price: "50",
    priceSatang: 5000,
    description: "ยาลดไข้ บรรเทาปวด 500mg",
    note: "ยาลดไข้ บรรเทาปวด 500mg",
    createdAt: "2026-09-01T08:00:00Z",
  },
];

export function getMedications(): Medications[] {
  if (typeof window === "undefined") return initialMedications;
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEDICATIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(initialMedications));
      return initialMedications;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(initialMedications));
      return initialMedications;
    }
    return parsed;
  } catch {
    return initialMedications;
  }
}

/**
 * Synchronize medications with Supabase database via Server Actions
 */
export async function syncMedicationsFromApi(): Promise<{
  medications: Medications[];
  isOnline: boolean;
}> {
  if (typeof window === "undefined") {
    return {
      medications: initialMedications,
      isOnline: false,
    };
  }

  let medications = getMedications();
  try {
    const res = await getMedicationsAction();
    if (res.success && Array.isArray(res.data)) {
      if (res.data.length > 0) {
        const remoteMeds = res.data;
        const remoteIds = new Set(remoteMeds.map((m) => m.id));
        const localOnly = medications.filter(
          (m) => !remoteIds.has(m.id) && m.id.startsWith("med-")
        );
        medications = [...remoteMeds, ...localOnly];
        localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(medications));
        triggerSync();
        return { medications, isOnline: true };
      } else if (medications.length > 0) {
        // Automatically migrate / seed initial local medications to Supabase
        for (const localMed of medications) {
          try {
            await createMedicationAction({
              name: localMed.name,
              size: localMed.size,
              unit: localMed.unit,
              price: localMed.price,
              description: localMed.description || localMed.note,
            });
          } catch (_) {}
        }
        const refreshed = await getMedicationsAction();
        if (refreshed.success && refreshed.data.length > 0) {
          medications = refreshed.data;
          localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(medications));
          triggerSync();
          return { medications, isOnline: true };
        }
      }
      return { medications, isOnline: true };
    }
    return { medications, isOnline: false };
  } catch (err) {
    console.warn("[VenDee Storage] Failed to sync medications from Supabase:", err);
    return { medications, isOnline: false };
  }
}

export async function saveMedication(
  med: Omit<Medications, "id"> & { id?: string }
): Promise<Medications> {
  const current = getMedications();
  const id = med.id || `med-${Date.now()}`;
  const priceVal = med.price !== undefined ? String(med.price) : undefined;
  const priceNum = priceVal ? Number(priceVal) : 0;
  const priceSatang = med.priceSatang || Math.round(priceNum * 100);

  let remoteMed: Medications | null = null;
  const isDbId = med.id && !med.id.startsWith("med-");

  try {
    if (isDbId) {
      const res = await updateMedicationAction(med.id!, {
        name: med.name,
        size: med.size,
        unit: med.unit,
        price: priceVal,
        description: med.description || med.note,
      });
      if (res.success && res.data) remoteMed = res.data;
    } else {
      const res = await createMedicationAction({
        name: med.name,
        size: med.size,
        unit: med.unit,
        price: priceVal,
        description: med.description || med.note,
      });
      if (res.success && res.data) remoteMed = res.data;
    }
  } catch (err) {
    console.warn("Supabase saveMedication warning:", err);
  }

  const finalId = remoteMed?.id || id;
  const newMed: Medications = remoteMed || {
    ...med,
    id: finalId,
    price: priceVal,
    priceSatang,
    description: med.description || med.note,
    note: med.description || med.note,
    createdAt: med.createdAt || new Date().toISOString(),
  };

  const idx = current.findIndex((m) => m.id === finalId || m.id === id);
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

export async function deleteMedication(id: string): Promise<void> {
  const current = getMedications();
  const target = current.find((m) => m.id === id);

  if (!id.startsWith("med-")) {
    try {
      await deleteMedicationAction(id);
    } catch (err) {
      console.warn("deleteMedicationAction warning:", err);
    }
  } else if (target) {
    try {
      const res = await getMedicationsAction();
      if (res.success && res.data) {
        const matched = res.data.find(
          (m) =>
            m.name.toLowerCase() === target.name.toLowerCase() &&
            (m.size || "") === (target.size || "")
        );
        if (matched) {
          await deleteMedicationAction(matched.id);
        }
      }
    } catch (_) {}
  }

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

// ─── Calendar Feed Management (WebCal / iPhone Sync) ──────────────────────────

export function getCalendarFeedConfig(): CalendarFeedConfig {
  const defaultConfig: CalendarFeedConfig = {
    feedToken: DEFAULT_FEED_TOKEN,
    isEnabled: true,
    calendarName: "ตารางเวร VenDee",
    lastSyncedAt: undefined,
  };

  if (typeof window === "undefined") return defaultConfig;

  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CALENDAR_FEED);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CALENDAR_FEED, JSON.stringify(defaultConfig));
      return defaultConfig;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.feedToken) {
      localStorage.setItem(STORAGE_KEYS.CALENDAR_FEED, JSON.stringify(defaultConfig));
      return defaultConfig;
    }
    return parsed;
  } catch {
    return defaultConfig;
  }
}

export function saveCalendarFeedConfig(config: CalendarFeedConfig): CalendarFeedConfig {
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.CALENDAR_FEED, JSON.stringify(config));
    triggerSync();
  }
  return config;
}

export async function regenerateCalendarFeedToken(): Promise<string> {
  let newToken = generateSecureFeedToken();

  try {
    const res = await regenerateFeedTokenAction();
    if (res.success && res.data?.token) {
      newToken = res.data.token;
    }
  } catch (err) {
    console.warn("regenerateFeedTokenAction warning:", err);
  }

  const current = getCalendarFeedConfig();
  const updated: CalendarFeedConfig = {
    ...current,
    feedToken: newToken,
  };

  saveCalendarFeedConfig(updated);
  return newToken;
}


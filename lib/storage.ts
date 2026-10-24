"use client";

import moment from "moment";
import "moment/locale/th.js";
import {
  getShiftsAction,
  createShiftAction,
  updateShiftAction,
  swapShiftAction,
  undoSwapShiftAction,
  transferShiftAction,
  undoTransferShiftAction,
  sellShiftAction,
  undoSellShiftAction,
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
import { calculateMedicationCostSatang, calculateMedicationLineCostSatang } from "./conflictEngine";
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
  getCustomersAction,
  createCustomerAction,
  updateCustomerAction,
  deleteCustomerAction,
} from "../app/actions/customerActions";
import {
  getClinicLogsAction,
  createClinicLogAction,
  updateClinicLogAction,
  deleteClinicLogAction,
} from "../app/actions/clinicActions";
import { unwrap } from "./actionHelper";
import { isShiftInPast, isDateInPast, getTodayDateStringBangkok } from "./dateUtils";
import { repairLocalSwapInconsistencies, upgradeShiftsToV3 } from "./swapRepair";
import { isShiftTransferrable, validateShiftTransferrable, isShiftSellable, validateShiftSellable } from "./shiftTransfer";

export { isShiftTransferrable, validateShiftTransferrable, isShiftSellable, validateShiftSellable };

import {
  Customer,
  CustomerServiceRecord,
  ShiftRecord,
  ShiftCategory,
  ShiftType,
  SwapTrailNode,
  ShiftSwapRecord,
  SaleMetadata,
  TransferMetadata,
  SHIFT_CONFIG,
  SHIFT_CATEGORY_CONFIG,
  Medications,
  resolveMedicationCategory,
  MedicationUsageLine,
  ClinicWorkRecord,
  ClinicPresetShift,
  PersonalEventRecord,
  ActivityItem,
  CalendarFeedConfig,
} from "../types/vendee";
import { generateSecureFeedToken, DEFAULT_FEED_TOKEN } from "./calendar/feedToken";
import { countMonthlyShifts, calculateMonthlyBlackShiftQuota } from "./quota";
import { sortEventsByStartTime } from "./sortEvents";
import { regenerateFeedTokenAction } from "../app/actions/calendarActions";

const STORAGE_KEYS = {
  SHIFTS: "vendee_shifts_v3", // bumped to v3 for shift_swaps schema separation (BACKLOG_MIGRATE.md §5)
  SERVICES: "vendee_services_v1",
  CUSTOMERS: "vendee_customers_v1",
  MEDICATIONS: "vendee_medications_v1",
  CLINIC_LOGS: "vendee_clinic_logs_v1",
  PERSONAL_EVENTS: "vendee_personal_events_v1",
  CALENDAR_FEED: "vendee_calendar_feed_v1",
};

const SYNC_EVENT = "vendee_storage_updated";
export const SYNC_STATE_EVENT = "vendee_sync_state_changed";

let activeSyncCount = 0;
let lastKnownOnlineState: boolean | null = null;

export function notifySyncStart() {
  activeSyncCount++;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SYNC_STATE_EVENT, {
        detail: {
          isSyncing: true,
          count: activeSyncCount,
          isOnline: lastKnownOnlineState,
        },
      })
    );
  }
}

export function notifySyncEnd(isOnline?: boolean) {
  activeSyncCount = Math.max(0, activeSyncCount - 1);
  if (typeof isOnline === "boolean") {
    lastKnownOnlineState = isOnline;
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(SYNC_STATE_EVENT, {
        detail: {
          isSyncing: activeSyncCount > 0,
          count: activeSyncCount,
          isOnline: lastKnownOnlineState,
        },
      })
    );
  }
}

export function subscribeToSyncState(
  callback: (state: { isSyncing: boolean; isOnline: boolean | null; count: number }) => void
) {
  if (typeof window === "undefined") return () => { };
  const handler = (e: Event) => {
    const custom = e as CustomEvent<{
      isSyncing: boolean;
      isOnline: boolean | null;
      count: number;
    }>;
    if (custom.detail) {
      callback(custom.detail);
    }
  };
  window.addEventListener(SYNC_STATE_EVENT, handler);
  return () => {
    window.removeEventListener(SYNC_STATE_EVENT, handler);
  };
}


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

// Re-export dynamic Bangkok timezone date utilities (DOMAIN_RULES.md §4.2, PROJECT_RULES.md §1)
export { isShiftInPast, isDateInPast, getTodayDateStringBangkok };

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
    swap: {
      id: "swap-sample-1",
      givenShiftId: "shift-sample-swap-0",
      receivedShiftId: "shift-sample-swap-1",
      swappedWith: "พี่เซ",
      swapDate: "2026-09-15",
      swapReason: "แลกเวรเช้าแทนพี่เซ",
      swapHistory: [],
    },
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
    swap: {
      id: "swap-sample-2",
      givenShiftId: "shift-sample-swap-0b",
      receivedShiftId: "shift-sample-swap-2",
      swappedWith: "ดรีม",
      swapDate: "2026-09-16",
      swapReason: "รับเวรบ่ายต่อจากดรีม",
      swapHistory: [],
    },
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
  clinicLogs: ClinicWorkRecord[];
  isOnline: boolean;
}> {
  if (typeof window === "undefined") {
    return {
      shifts: initialShifts,
      customers: initialCustomers,
      services: initialServices,
      personalEvents: [],
      medications: initialMedications,
      clinicLogs: initialClinicLogs,
      isOnline: false,
    };
  }

  let isOnline = false;
  notifySyncStart();
  try {
    const [shiftsRes, customersRes, servicesRes, personalEventsRes, medicationsRes, clinicLogsRes] = await Promise.allSettled([
      getShiftsAction(),
      getCustomersAction(),
      getServicesAction(),
      getPersonalEventsAction(),
      getMedicationsAction(),
      getClinicLogsAction(),
    ]);

    let shifts = getShifts();
    let customers = getCustomers();
    let services = getServices();
    let personalEvents = getPersonalEvents();
    let medications = getMedications();
    let clinicLogs = getClinicLogs();

    if (shiftsRes.status === "fulfilled" && shiftsRes.value.success && Array.isArray(shiftsRes.value.data)) {
      if (shiftsRes.value.data.length > 0) {
        const { shifts: repaired } = repairLocalSwapInconsistencies(shiftsRes.value.data);
        shifts = repaired;
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
          } catch (_) { }
        }
        const refreshed = await getShiftsAction();
        if (refreshed.success && refreshed.data.length > 0) {
          shifts = refreshed.data;
          localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(shifts));
        }
      }
      isOnline = true;
    }

    if (customersRes.status === "fulfilled" && customersRes.value.success && Array.isArray(customersRes.value.data)) {
      if (customersRes.value.data.length > 0) {
        const remoteCusts = customersRes.value.data;
        const remoteIds = new Set(remoteCusts.map((c) => c.id));
        const localOnly = customers.filter((c) => !remoteIds.has(c.id));
        // Automatically persist local-only customers to database
        for (const localCust of localOnly) {
          try {
            await createCustomerAction({
              id: localCust.id,
              name: localCust.name,
              avatarColor: localCust.avatarColor,
              createdAt: localCust.createdAt,
            });
          } catch (_) { }
        }
        customers = [...remoteCusts, ...localOnly];
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
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
        if (localOnly.length > 0) {
          for (const localMed of localOnly) {
            try {
              const res = await createMedicationAction({
                name: localMed.name,
                size: localMed.size,
                unit: localMed.unit,
                price: localMed.price,
                description: localMed.description || localMed.note,
              });
              if (res.success && res.data) {
                remoteMeds.push(res.data);
              }
            } catch (_) { }
          }
        }
        medications = [...remoteMeds];
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
          } catch (_) { }
        }
        const refreshed = await getMedicationsAction();
        if (refreshed.success && refreshed.data.length > 0) {
          medications = refreshed.data;
          localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(medications));
        }
      }
      isOnline = true;
    }

    if (clinicLogsRes.status === "fulfilled" && clinicLogsRes.value.success && Array.isArray(clinicLogsRes.value.data)) {
      if (clinicLogsRes.value.data.length > 0) {
        const remoteLogs = clinicLogsRes.value.data;
        const remoteIds = new Set(remoteLogs.map((l) => l.id));
        const localOnly = clinicLogs.filter((l) => !remoteIds.has(l.id) && l.id.startsWith("clinic-"));
        if (localOnly.length > 0) {
          for (const localLog of localOnly) {
            try {
              const res = await createClinicLogAction({
                date: localLog.date,
                presetShift: localLog.presetShift,
                note: localLog.note,
              });
              if (res.success && res.data) {
                remoteLogs.push(res.data);
              }
            } catch (_) { }
          }
        }
        clinicLogs = [...remoteLogs];
        localStorage.setItem(STORAGE_KEYS.CLINIC_LOGS, JSON.stringify(clinicLogs));
      } else if (clinicLogs.length > 0) {
        // Automatically migrate / seed initial local clinic logs to Supabase
        for (const localLog of clinicLogs) {
          try {
            await createClinicLogAction({
              date: localLog.date,
              presetShift: localLog.presetShift,
              note: localLog.note,
            });
          } catch (_) { }
        }
        const refreshed = await getClinicLogsAction();
        if (refreshed.success && refreshed.data.length > 0) {
          clinicLogs = refreshed.data;
          localStorage.setItem(STORAGE_KEYS.CLINIC_LOGS, JSON.stringify(clinicLogs));
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
      clinicLogs,
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
      clinicLogs: getClinicLogs(),
      isOnline: false,
    };
  } finally {
    notifySyncEnd(isOnline);
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
  if (typeof window === "undefined") {
    return [...initialCustomers].sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.CUSTOMERS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(initialCustomers));
      return [...initialCustomers].sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
    }
    const parsed = JSON.parse(raw);
    const list = Array.isArray(parsed) ? parsed : initialCustomers;
    return [...list].sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
  } catch {
    return [...initialCustomers].sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
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

  const isUpdate = Boolean(customer.id && current.some((c) => c.id === customer.id));

  // 1. Supabase Sync via Server Actions
  try {
    if (isUpdate) {
      const updateRes = await updateCustomerAction(id, {
        name: newCustomer.name,
        avatarColor: newCustomer.avatarColor,
      });
      if (updateRes.success && updateRes.data) {
        newCustomer = updateRes.data;
      }
    } else {
      const createRes = await createCustomerAction({
        id: newCustomer.id,
        name: newCustomer.name,
        avatarColor: newCustomer.avatarColor,
        createdAt: newCustomer.createdAt,
      });
      if (createRes.success && createRes.data) {
        newCustomer = createRes.data;
      }
    }
  } catch (err) {
    console.warn("saveCustomer remote warning:", err);
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
    await deleteCustomerAction(id);
    await deleteServicesByCustomerIdAction(id);
    for (const srv of servicesToDelete) {
      if (!srv.id.startsWith("srv-")) {
        await deleteServiceAction(srv.id);
      }
    }
  } catch (err) {
    console.warn("deleteCustomer remote warning:", err);
  }

  // 4. Trigger UI sync
  triggerSync();
}

/**
 * Synchronize customers with Supabase database via Next.js Server Actions
 */
export async function syncCustomersFromApi(): Promise<{
  customers: Customer[];
  isOnline: boolean;
}> {
  if (typeof window === "undefined") {
    return {
      customers: initialCustomers,
      isOnline: false,
    };
  }

  notifySyncStart();
  let isOnline = false;
  let customers = getCustomers();
  try {
    const res = await getCustomersAction();
    if (res.success && Array.isArray(res.data)) {
      if (res.data.length > 0) {
        const remoteCusts = res.data;
        const remoteIds = new Set(remoteCusts.map((c) => c.id));
        const localOnly = customers.filter((c) => !remoteIds.has(c.id));
        if (localOnly.length > 0) {
          for (const localCust of localOnly) {
            try {
              await createCustomerAction({
                id: localCust.id,
                name: localCust.name,
                avatarColor: localCust.avatarColor,
                createdAt: localCust.createdAt,
              });
            } catch (_) { }
          }
        }
        customers = [...remoteCusts, ...localOnly].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "th", { numeric: true })
        );
        localStorage.setItem(STORAGE_KEYS.CUSTOMERS, JSON.stringify(customers));
        triggerSync();
      }
      isOnline = true;
      return { customers, isOnline: true };
    }
    return { customers, isOnline: false };
  } catch (err) {
    console.warn("syncCustomersFromApi warning:", err);
    return { customers, isOnline: false };
  } finally {
    notifySyncEnd(isOnline);
  }
}

// Re-export swap repair & upgrade helpers (BACKLOG.md §9.5, §10.4)
export { repairLocalSwapInconsistencies, upgradeShiftsToV3 };

// Shifts
export function getShifts(): ShiftRecord[] {
  if (typeof window === "undefined") return initialShifts;
  try {
    let raw = localStorage.getItem(STORAGE_KEYS.SHIFTS);
    if (!raw) {
      const legacyRaw = localStorage.getItem("vendee_shifts_v2");
      if (legacyRaw) {
        try {
          const parsedLegacy = JSON.parse(legacyRaw);
          if (Array.isArray(parsedLegacy) && parsedLegacy.length > 0) {
            const upgraded = upgradeShiftsToV3(parsedLegacy);
            localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(upgraded));
            return upgraded;
          }
        } catch { }
      }

      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(initialShifts));
      return initialShifts;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(initialShifts));
      return initialShifts;
    }
    const { shifts: repaired, modified } = repairLocalSwapInconsistencies(parsed);
    if (modified) {
      localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(repaired));
    }
    return repaired;
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
    receivedFrom?: string;
  }
): Promise<ShiftRecord> {
  const current = getShifts();
  const targetStatus = shift.status || "active";
  const isExistingInDb = Boolean(shift.id && !shift.id.startsWith("shift-"));
  const existingShift = shift.id ? current.find((s) => s.id === shift.id) : undefined;

  // Check if trying to edit locked / past shift
  if (existingShift && (existingShift.swapMeta?.isLocked || isShiftInPast(existingShift.date))) {
    throw new Error("ไม่สามารถแก้ไขเวรในอดีตที่ถูกล็อกแล้วได้");
  }

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

  // 1. Sync with Supabase via Server Action FIRST (Server-First pattern with unwrap)
  if (isExistingInDb) {
    const res = await updateShiftAction(shift.id!, {
      shiftType: shift.shiftType,
      category: resolvedCategory,
      department: shift.department,
      note: shift.note,
      status: targetStatus,
      receivedFrom: resolvedCategory === "red" ? shift.receivedFrom : undefined,
    });
    createdOrUpdatedShift = unwrap(res);
  } else {
    const res = await createShiftAction({
      date: shift.date,
      shiftType: shift.shiftType,
      category: resolvedCategory,
      department: shift.department,
      note: shift.note,
      receivedFrom: resolvedCategory === "red" ? shift.receivedFrom : undefined,
    });
    createdOrUpdatedShift = unwrap(res);
  }

  // 2. Save locally only after server success
  const finalId = createdOrUpdatedShift?.id || shift.id || `shift-${Date.now()}`;
  const existingIdx = current.findIndex((s) => s.id === finalId || (shift.id && s.id === shift.id));
  const existing = existingIdx >= 0 ? current[existingIdx] : undefined;

  const newShift: ShiftRecord = createdOrUpdatedShift || {
    ...existing,
    ...shift,
    category: resolvedCategory,
    receivedFrom: resolvedCategory === "red" ? shift.receivedFrom : undefined,
    id: finalId,
    type: "shift",
    status: targetStatus,
    createdAt: existing?.createdAt || shift.createdAt || new Date().toISOString(),
  };

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

  // 2. Check if shift acts as given shift in active swap (DOMAIN_RULES.md 2.3.2)
  const isGivenInActiveSwap = current.some(
    (s) => s.swap?.givenShiftId === id || s.swapMeta?.parentShiftId === id
  );
  if (target.status === "swapped_out" || target.swapId || isGivenInActiveSwap) {
    throw new Error(
      "ไม่สามารถลบเวรที่ถูกแลกออกไปแล้วได้ กรุณาใช้ปุ่ม 'กู้คืนเวร (ยกเลิกการแลก)' แทนการลบเพื่อป้องกันประวัติการแลกสูญหาย"
    );
  }

  if (target.status === "sold_out") {
    throw new Error("ไม่สามารถลบเวรที่ขายออกไปแล้วได้ (โปรดใช้ฟีเจอร์ยกเลิกการขายเวร เพื่อคืนสถานะเวร)");
  }

  // 3. Call Supabase Server Action FIRST (Server-First with unwrap)
  let restoredParentId: string | undefined = undefined;
  if (!id.startsWith("shift-")) {
    const res = await deleteShiftAction(id);
    const data = unwrap(res);
    restoredParentId = data.restoredParentId;
  }

  // 4. Perform local delete & restore parent if applicable (for a received shift)
  const updated = current.filter((s) => s.id !== id);

  const parentShiftId = target.swap?.givenShiftId || target.swapMeta?.parentShiftId;
  if (parentShiftId) {
    const parent = updated.find((s) => s.id === parentShiftId);
    if (parent && parent.status === "swapped_out") {
      parent.status = "active";
      parent.swapId = undefined;
      parent.swap = undefined;
      parent.swapMeta = undefined;
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

  if (target.swapMeta?.isLocked || isShiftInPast(target.date)) {
    throw new Error("ไม่สามารถกู้คืนเวรในอดีตที่ถูกล็อกแล้วได้");
  }

  // 1. Supabase restore FIRST (Server-First with unwrap)
  let restoredRemote: ShiftRecord | null = null;
  if (!shiftId.startsWith("shift-")) {
    const res = await restoreShiftAction(shiftId);
    restoredRemote = unwrap(res);
  }

  // 2. Update local storage only after server success
  const updatedShift: ShiftRecord = restoredRemote || {
    ...target,
    status: "active",
  };
  const targetIdx = current.findIndex((s) => s.id === shiftId);
  if (targetIdx >= 0) {
    current[targetIdx] = updatedShift;
  }

  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(current));
  triggerSync();

  return updatedShift;
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
  if (oldShift.status === "swapped_out" || oldShift.status === "sold_out") {
    throw new Error("เวรนี้ถูกแลกหรือส่งต่อออกไปแล้ว");
  }
  if (oldShift.swapMeta?.isLocked || isShiftInPast(oldShift.date)) {
    throw new Error("ไม่สามารถแลกเวรในอดีตที่ถูกล็อกแล้วได้");
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

  // Build swap trail
  const swapDateStr = getTodayDateStringBangkok();
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

  // 1. Supabase Server Action FIRST (Server-First pattern with unwrap)
  let dbResult: { newShift: ShiftRecord; oldShift: ShiftRecord } | null = null;
  if (!oldShift.id.startsWith("shift-")) {
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
    dbResult = unwrap(res);
  }

  // 2. Only after server success, update local state
  const newShiftId = dbResult?.newShift?.id || `shift-${Date.now()}`;
  const swapId = dbResult?.oldShift?.swapId || `swap-${Date.now()}`;
  const swapRecord: ShiftSwapRecord = dbResult?.oldShift?.swap || {
    id: swapId,
    givenShiftId: oldShift.id,
    receivedShiftId: newShiftId,
    swappedWith: params.swappedWith,
    originalOwner: params.originalOwner || undefined,
    swapDate: swapDateStr,
    swapReason: params.swapReason,
    swapHistory: trail,
    createdAt: new Date().toISOString(),
  };

  const updatedOldShift: ShiftRecord = dbResult?.oldShift || {
    ...oldShift,
    status: "swapped_out",
    swapId: swapId,
    swap: swapRecord,
    swapMeta: {
      ...oldShift.swapMeta,
      swappedWith: params.swappedWith,
      originalOwner: params.originalOwner || undefined,
      swapDate: swapDateStr,
      swapReason: params.swapReason,
      swapHistory: trail,
      isLocked: oldShift.swapMeta?.isLocked ?? isShiftInPast(oldShift.date),
    },
  };

  const newShift: ShiftRecord = dbResult?.newShift || {
    id: newShiftId,
    type: "shift",
    date: params.newDate,
    shiftType: params.newShiftType,
    category: resolvedCategory,
    status: "active",
    department: oldShift.department,
    note: `เวรที่ได้รับจากการแลกกับ ${params.swappedWith}${params.swapReason ? ` (${params.swapReason})` : ""}`,
    swap: swapRecord,
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

  const oldIdx = current.findIndex((s) => s.id === oldShift.id);
  let updatedList = [...current];
  if (oldIdx >= 0) {
    updatedList[oldIdx] = updatedOldShift;
  }
  updatedList = [newShift, ...updatedList];

  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(updatedList));
  triggerSync();

  return { newShift, oldShift: updatedOldShift };
}

/**
 * Undo / Rollback a shift swap (DOMAIN_RULES.md 2.3.3 Bidirectional Rollback)
 * - Restores parentShift to 'active' and clears swapId, swap, swapMeta
 * - Removes the shift received during the swap
 * - Only permitted if isLocked === false, shifts are not in the past, and no downstream swap is active
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

  // Determine parent (given) and child (received) shift
  if (targetShift.swap?.receivedShiftId === targetShift.id || targetShift.swapMeta?.parentShiftId) {
    // targetShift is the received shift
    childShift = targetShift;
    const parentId = targetShift.swap?.givenShiftId || targetShift.swapMeta?.parentShiftId;
    parentShift = current.find((s) => s.id === parentId);
  } else if (targetShift.status === "swapped_out" || targetShift.swapId || targetShift.swap?.givenShiftId === targetShift.id) {
    // targetShift is the original shift that was swapped out
    parentShift = targetShift;
    const childId = targetShift.swap?.receivedShiftId;
    childShift = current.find((s) => (childId && s.id === childId) || s.swapMeta?.parentShiftId === targetShift.id);
  } else {
    childShift = current.find((s) => s.swapMeta?.parentShiftId === targetShift.id || s.swap?.givenShiftId === targetShift.id);
    if (childShift) {
      parentShift = targetShift;
    }
  }

  if (parentShift && (parentShift.swapMeta?.isLocked || isShiftInPast(parentShift.date))) {
    throw new Error("ไม่สามารถยกเลิกได้เนื่องจากเวรเดิมผ่านเวลาไปแล้ว (เวรถูกล็อกอยู่)");
  }
  if (childShift && (childShift.swapMeta?.isLocked || isShiftInPast(childShift.date))) {
    throw new Error("ไม่สามารถยกเลิกได้เนื่องจากเวรที่ได้รับมาผ่านเวลาไปแล้ว");
  }

  // Downstream Chain Swap Guard (BACKLOG_MIGRATE.md §8 & DOMAIN_RULES.md §2.3)
  // If the received shift has been swapped out in another downstream swap, block undoing this swap!
  if (childShift) {
    const isDownstreamSwapped = current.some(
      (s) =>
        s.status === "swapped_out" &&
        (s.id === childShift!.id || s.swap?.givenShiftId === childShift!.id || s.swapMeta?.parentShiftId === childShift!.id)
    );
    if (isDownstreamSwapped) {
      throw new Error(
        "ไม่สามารถยกเลิกการแลกเวรนี้ได้ เนื่องจากเวรที่ได้รับมาถูกนำไปแลกเปลี่ยนต่อแล้ว กรุณายกเลิกการแลกขั้นหลังก่อน"
      );
    }
  }

  // 1. Supabase Server Action FIRST (Server-First pattern with unwrap)
  const apiTargetId = childShift?.id || targetShift.id;
  if (!apiTargetId.startsWith("shift-")) {
    const res = await undoSwapShiftAction(apiTargetId);
    unwrap(res);
  }

  // 2. Only after server success, update local state
  const childIdToRemove = childShift?.id || (targetShift.swapMeta?.parentShiftId ? targetShift.id : undefined);
  let updated = current.filter((s) => s.id !== childIdToRemove);

  // Restore parent shift to active and clear swap fields (Phase 10 & ISSUE-2 fix)
  if (parentShift) {
    updated = updated.map((s) =>
      s.id === parentShift!.id
        ? {
            ...s,
            status: "active" as const,
            swapId: undefined,
            swap: undefined,
            swapMeta: undefined,
          }
        : s
    );
  }

  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(updated));
  triggerSync();

  return true;
}

/**
 * Transfer a Refer or OT shift to another person (DOMAIN_RULES.md §2.4 Phase 11)
 * - One-way transfer (status: "transferred")
 * - Does not impact black shift quota
 * - Records recipientName, transferredDate, and optional note (No Satang or financial ledger)
 */
export async function transferShift(params: {
  shiftId: string;
  recipientName: string;
  transferredDate?: string;
  note?: string;
}): Promise<ShiftRecord> {
  const current = getShifts();
  const shiftIndex = current.findIndex((s) => s.id === params.shiftId);

  if (shiftIndex === -1) {
    throw new Error("ไม่พบเวรที่ต้องการยกให้คนอื่น");
  }

  const targetShift = current[shiftIndex];

  validateShiftTransferrable({
    status: targetShift.status,
    isLocked: targetShift.swapMeta?.isLocked,
    date: targetShift.date,
    shiftType: targetShift.shiftType,
    category: targetShift.category,
  });

  const transferredDate = params.transferredDate || getTodayDateStringBangkok();

  const transferMeta: TransferMetadata = {
    recipientName: params.recipientName.trim(),
    transferredDate,
    note: params.note?.trim() || undefined,
  };

  // 1. Supabase update FIRST (Server-First with unwrap)
  let updatedShift: ShiftRecord = {
    ...targetShift,
    status: "transferred",
    transferMeta,
    saleMeta: undefined,
  };

  if (!params.shiftId.startsWith("shift-")) {
    const res = await transferShiftAction({
      shiftId: params.shiftId,
      recipientName: params.recipientName.trim(),
      transferredDate,
      note: params.note?.trim(),
    });
    updatedShift = unwrap(res);
  }

  // 2. Only after server success, update local storage
  current[shiftIndex] = updatedShift;
  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(current));
  triggerSync();

  return updatedShift;
}

/**
 * Undo / Rollback a shift transfer (DOMAIN_RULES.md §2.4.5 & §2.5.4)
 * - Restores status to 'active'
 * - Clears transferMeta
 * - Permitted only if isLocked === false and shiftDate >= CURRENT_DATE
 */
export async function undoTransferShift(shiftId: string): Promise<ShiftRecord> {
  const current = getShifts();
  const shiftIndex = current.findIndex((s) => s.id === shiftId);

  if (shiftIndex === -1) {
    throw new Error("ไม่พบเวรที่ต้องการยกเลิกการยกเวร");
  }

  const targetShift = current[shiftIndex];

  if (targetShift.status !== "transferred" && targetShift.status !== "sold_out") {
    throw new Error("เวรนี้ไม่ได้อยู่ในสถานะที่ยกให้ผู้อื่น");
  }

  if (targetShift.swapMeta?.isLocked || isShiftInPast(targetShift.date)) {
    throw new Error("ไม่สามารถยกเลิกการยกเวรในอดีตที่ถูกล็อกแล้วได้");
  }

  // 1. Supabase rollback FIRST (Server-First with unwrap)
  let restoredShift: ShiftRecord = {
    ...targetShift,
    status: "active",
    transferMeta: undefined,
    saleMeta: undefined,
  };

  if (!shiftId.startsWith("shift-")) {
    const res = await undoTransferShiftAction(shiftId);
    restoredShift = unwrap(res);
  }

  // 2. Only after server success, update local storage
  current[shiftIndex] = restoredShift;
  localStorage.setItem(STORAGE_KEYS.SHIFTS, JSON.stringify(current));
  triggerSync();

  return restoredShift;
}

/**
 * Legacy sellShift wrapper delegating to transferShift for backwards compatibility
 */
export async function sellShift(params: {
  shiftId: string;
  buyerName: string;
  salePriceSatang?: number;
  soldDate?: string;
  paymentStatus?: "unpaid" | "paid";
  note?: string;
}): Promise<ShiftRecord> {
  return transferShift({
    shiftId: params.shiftId,
    recipientName: params.buyerName,
    transferredDate: params.soldDate,
    note: params.note,
  });
}

/**
 * Legacy undoSellShift wrapper delegating to undoTransferShift for backwards compatibility
 */
export async function undoSellShift(shiftId: string): Promise<ShiftRecord> {
  return undoTransferShift(shiftId);
}

/**
 * Retrieve all shifts that have been sold (status === "sold_out")
 */
export function getSoldShifts(): ShiftRecord[] {
  const shifts = getShifts();
  return shifts.filter((s) => s.status === "sold_out");
}

/**
 * Monthly Shift Sales statistics
 */
export function getMonthlyShiftSalesStats(yearMonth: string = "2026-09"): {
  totalSold: number;
  paidCount: number;
  unpaidCount: number;
  paidTotalSatang: number;
  unpaidTotalSatang: number;
  paidTotalBaht: number;
  unpaidTotalBaht: number;
  soldShifts: ShiftRecord[];
} {
  const shifts = getShifts();
  const soldShifts = shifts.filter(
    (s) => s.status === "sold_out" && s.date.startsWith(yearMonth)
  );

  let paidCount = 0;
  let unpaidCount = 0;
  let paidTotalSatang = 0;
  let unpaidTotalSatang = 0;

  soldShifts.forEach((s) => {
    const priceSatang = s.saleMeta?.salePriceSatang || 0;
    if (s.saleMeta?.paymentStatus === "paid") {
      paidCount++;
      paidTotalSatang += priceSatang;
    } else {
      unpaidCount++;
      unpaidTotalSatang += priceSatang;
    }
  });

  return {
    totalSold: soldShifts.length,
    paidCount,
    unpaidCount,
    paidTotalSatang,
    unpaidTotalSatang,
    paidTotalBaht: paidTotalSatang / 100,
    unpaidTotalBaht: unpaidTotalSatang / 100,
    soldShifts,
  };
}

/**
 * Helper to calculate active black shifts for a given yearMonth (e.g. "2026-09")
 */
export function getMonthlyBlackShiftStats(
  yearMonth: string = "2026-09",
  shiftsList?: ShiftRecord[],
  customQuota?: number
): {
  blackCount: number;
  redCount: number;
  quota: number;
  remaining: number;
  isMet: boolean;
  quotaHours: number;
  weekdaysCount: number;
} {
  const shifts = shiftsList ?? getShifts();
  const { blackCount, redCount } = countMonthlyShifts(shifts, yearMonth);
  const quotaCalc = calculateMonthlyBlackShiftQuota(yearMonth);
  const quota = customQuota !== undefined && customQuota > 0 ? customQuota : quotaCalc.quotaShifts;
  const remaining = Math.max(0, quota - blackCount);
  const isMet = blackCount >= quota;

  return {
    blackCount,
    redCount,
    quota,
    remaining,
    isMet,
    quotaHours: quotaCalc.blackShiftHours,
    weekdaysCount: quotaCalc.weekdaysCount,
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
  // Medication usage lines: auto-calc line cost; total cost = Σ line cost (DOMAIN_RULES §3.1.3)
  const usages: MedicationUsageLine[] = (service.medicationUsages || [])
    .filter((u) => u.quantity > 0)
    .map((u) => ({ ...u, lineCostSatang: calculateMedicationLineCostSatang(u.quantity, u.unitCostSatang) }));
  const usageCostSatang = usages.length > 0 ? calculateMedicationCostSatang(usages) : undefined;
  // Legacy records (no usage lines) keep their manually-entered cost; records that had usages reset to 0 when cleared.
  const legacyMedicationCostThb =
    usages.length === 0 && !(existingService?.medicationUsages && existingService.medicationUsages.length > 0)
      ? (existingService?.medicationCostSatang ?? service.medicationCostSatang ?? 0) / 100
      : 0;

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
          services: service.services || existingService?.services || ["injection"],
          otherServiceText:
            service.otherServiceText !== undefined
              ? service.otherServiceText
              : existingService?.otherServiceText,
          medications: cleanMeds,
          medicationUsages: usages,
          medicationCost: legacyMedicationCostThb,
          note: service.note,
          price: service.price,
        });
        if (res.success && res.data) {
          remoteService = res.data;
        }
      } catch (e) {
        console.warn("updateServiceAction warning:", e);
      }
    } else {
      // Local record updating online, push to Supabase as new record
      try {
        const res = await createServiceAction({
          customerId: service.customerId,
          customerName: service.customerName,
          date: service.date,
          time: normalizedTime,
          services: service.services || existingService?.services || ["injection"],
          otherServiceText:
            service.otherServiceText !== undefined
              ? service.otherServiceText
              : existingService?.otherServiceText,
          medications: cleanMeds,
          medicationUsages: usages,
          medicationCost: legacyMedicationCostThb,
          note: service.note,
          price: service.price,
        });
        if (res.success && res.data) {
          remoteService = res.data;
        }
      } catch (e) {
        console.warn("createServiceAction for local service warning:", e);
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
        medicationUsages: usages,
        medicationCost: legacyMedicationCostThb,
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
    medicationUsages: usages,
    medicationCostSatang: usageCostSatang ?? Math.round(legacyMedicationCostThb * 100),
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
    description: "ยาลดไข้ บรรเทาปวด 500mg",
    note: "ยาลดไข้ บรรเทาปวด 500mg",
    createdAt: "2026-09-01T08:00:00Z",
  },
];

export function getMedications(): Medications[] {
  if (typeof window === "undefined") {
    return [...initialMedications].sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.MEDICATIONS);
    if (!raw) {
      localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(initialMedications));
      return [...initialMedications].sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      localStorage.setItem(STORAGE_KEYS.MEDICATIONS, JSON.stringify(initialMedications));
      return [...initialMedications].sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
    }
    return parsed
      .map((m: Medications) => ({
        ...m,
        category: resolveMedicationCategory(m.name, m.category),
      }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
  } catch {
    return [...initialMedications].sort((a, b) => (a.name || "").localeCompare(b.name || "", "th", { numeric: true }));
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

  notifySyncStart();
  let isOnline = false;
  let medications = getMedications();
  try {
    const res = await getMedicationsAction();
    if (res.success && Array.isArray(res.data)) {
      isOnline = true;
      if (res.data.length > 0) {
        const remoteMeds = res.data;
        const remoteIds = new Set(remoteMeds.map((m) => m.id));
        const localOnly = medications.filter(
          (m) => !remoteIds.has(m.id) && m.id.startsWith("med-")
        );
        if (localOnly.length > 0) {
          for (const localMed of localOnly) {
            try {
              const createRes = await createMedicationAction({
                name: localMed.name,
                size: localMed.size,
                category: localMed.category,
                unit: localMed.unit,
                price: localMed.price,
                description: localMed.description || localMed.note,
              });
              if (createRes.success && createRes.data) {
                remoteMeds.push(createRes.data);
              }
            } catch (err) {
              console.warn("Failed to migrate local medication to DB:", err);
            }
          }
        }
        medications = [...remoteMeds].sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", "th", { numeric: true })
        );
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
              category: localMed.category,
              unit: localMed.unit,
              price: localMed.price,
              description: localMed.description || localMed.note,
            });
          } catch (_) { }
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
  } finally {
    notifySyncEnd(isOnline);
  }
}

export async function saveMedication(
  med: Omit<Medications, "id"> & { id?: string }
): Promise<Medications> {
  const current = getMedications();
  const id = med.id || `med-${Date.now()}`;
  const priceVal = med.price !== undefined ? String(med.price) : undefined;

  let remoteMed: Medications | null = null;
  const isDbId = med.id && !med.id.startsWith("med-");

  try {
    if (isDbId) {
      const res = await updateMedicationAction(med.id!, {
        name: med.name,
        size: med.size,
        category: med.category,
        unit: med.unit,
        price: priceVal,
        description: med.description || med.note,
      });
      if (res.success && res.data) {
        remoteMed = res.data;
      } else if (!res.success) {
        console.error("Supabase updateMedicationAction error:", res.error);
        throw new Error(res.error?.message || "ไม่สามารถอัปเดตข้อมูลยาในฐานข้อมูลได้");
      }
    } else {
      const res = await createMedicationAction({
        name: med.name,
        size: med.size,
        category: med.category,
        unit: med.unit,
        price: priceVal,
        description: med.description || med.note,
      });
      if (res.success && res.data) {
        remoteMed = res.data;
      } else if (!res.success) {
        console.error("Supabase createMedicationAction error:", res.error);
        throw new Error(res.error?.message || "ไม่สามารถบันทึกข้อมูลยาลงฐานข้อมูลได้");
      }
    }
  } catch (err: any) {
    console.warn("Supabase saveMedication warning:", err);
    const isOffline = typeof navigator !== "undefined" && !navigator.onLine;
    if (!isOffline && !err.message?.includes("fetch")) {
      throw err;
    }
  }

  const finalId = remoteMed?.id || id;
  const newMed: Medications = remoteMed || {
    ...med,
    category: resolveMedicationCategory(med.name, med.category),
    id: finalId,
    price: priceVal,
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
    } catch (_) { }
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

export async function saveClinicLog(
  log: Omit<ClinicWorkRecord, "id" | "type" | "createdAt"> & { id?: string; createdAt?: string }
): Promise<ClinicWorkRecord> {
  const isExistingInDb = Boolean(log.id && !log.id.startsWith("clinic-"));
  let remoteRecord: ClinicWorkRecord | null = null;

  // 1. Supabase action FIRST (Server-First with unwrap)
  if (isExistingInDb) {
    const res = await updateClinicLogAction(log.id!, {
      date: log.date,
      presetShift: log.presetShift,
      note: log.note,
    });
    remoteRecord = unwrap(res);
  } else {
    const res = await createClinicLogAction({
      id: log.id,
      date: log.date,
      presetShift: log.presetShift,
      note: log.note,
    });
    remoteRecord = unwrap(res);
  }

  // 2. Only after server success, update local storage
  const current = getClinicLogs();
  const finalId = remoteRecord?.id || log.id || `clinic-${Date.now()}`;
  const idx = current.findIndex((c) => c.id === finalId || (log.id && c.id === log.id));
  const existing = idx >= 0 ? current[idx] : undefined;

  const newLog: ClinicWorkRecord = remoteRecord || {
    ...existing,
    ...log,
    id: finalId,
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

export async function deleteClinicLog(id: string): Promise<void> {
  const current = getClinicLogs();
  const target = current.find((c) => c.id === id);
  if (target && isDateInPast(target.date)) {
    throw new Error("ไม่สามารถลบบันทึกงานคลินิกย้อนหลังได้");
  }

  // 1. Supabase action FIRST (Server-First with unwrap)
  if (!id.startsWith("clinic-")) {
    const res = await deleteClinicLogAction(id);
    unwrap(res);
  }

  // 2. Only after server success, update local storage
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
  if (!id.startsWith("pevent-")) {
    const res = await deletePersonalEventAction(id);
    unwrap(res);
  }

  const events = getPersonalEvents().filter((e) => e.id !== id);
  if (typeof window !== "undefined") {
    localStorage.setItem(STORAGE_KEYS.PERSONAL_EVENTS, JSON.stringify(events));
    triggerSync();
  }
}

// All Activities combined sorted latest first
export function getAllActivities(): ActivityItem[] {
  const shifts = getShifts();
  const visibleShifts = shifts.filter(
    (s) => s.status !== "cancelled" && s.status !== "swapped_out" && s.status !== "sold_out"
  );
  const services = getServices();
  const clinicLogs = getClinicLogs();
  const personalEvents = getPersonalEvents();

  const combined: ActivityItem[] = [...visibleShifts, ...services, ...clinicLogs, ...personalEvents];

  return sortEventsByStartTime(combined);
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


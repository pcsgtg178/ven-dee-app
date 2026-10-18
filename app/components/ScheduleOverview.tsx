"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";

import moment from "moment";
import "moment/locale/th";

import ActivityCard from "./ActivityCard";
import ScheduleCalendarView from "./ScheduleCalendarView";
import ScheduleTodoListView from "./ScheduleTodoListView";
import {
  List,
  Calendar as CalendarIcon,
  Plus,
  CalendarDays,
} from "lucide-react";

import {
  ActivityItem,
  CustomerServiceRecord,
  ShiftRecord,
  ClinicWorkRecord,
  PersonalEventRecord,
  SHIFT_CONFIG,
  SHIFT_CATEGORY_CONFIG,
  SHIFT_CODE_MAP,
} from "../../types/vendee";
import {
  getAllActivities,
  subscribeToStorage,
  deleteShift,
  deleteService,
  deleteClinicLog,
  deletePersonalEvent,
  undoSwapShift,
  undoSellShift,
  restoreShift,
  getMonthlyBlackShiftStats,
  syncAllDataFromApi,
  subscribeToSyncState,
} from "../../lib/storage";
import ModalAddTodo from "./ModalAddTodo";
import ModalAddPersonalEvent from "./ModalAddPersonalEvent";
import ModalShiftSwap from "./ModalShiftSwap";
import ModalSwapTrail from "./ModalSwapTrail";
import ModalSellShift from "./ModalSellShift";
import ModalEditShift from "./ModalEditShift";
import ModalEditService from "./ModalEditService";
import ModalEditClinicLog from "./ModalEditClinicLog";
import BottomSheet from "./BottomModalSheet";
import BottomNav from "./BottomNav";
import ThemeToggle from "./ThemeToggle";
import ModalConfirmAction, { ConfirmVariant } from "./ModalConfirmAction";
import ModalExportCalendar from "./ModalExportCalendar";
import { compareEventsByStartTime } from "../../lib/sortEvents";

type ConfirmModalState =
  | {
      type: "restore";
      shift: ShiftRecord;
    }
  | {
      type: "undoSwap";
      shift: ShiftRecord;
    }
  | {
      type: "delete";
      item: ActivityItem;
    }
  | null;

export default function ScheduleOverview() {
  const [viewMode, setViewMode] = useState<"list" | "calendar">("list");
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [filterType, setFilterType] = useState<"all" | "shift" | "service" | "clinic" | "personal_event">(
    "all",
  );

  // Add Todo / Personal Event Modal states
  const [openAddModal, setOpenAddModal] = useState(false);
  const [openAddPersonalEventModal, setOpenAddPersonalEventModal] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<string | undefined>(
    undefined,
  );
  const [modalInitialTab, setModalInitialTab] = useState<"shift" | "service" | "clinic">(
    "shift",
  );

  // Shift Swap Modal states
  const [openSwapModal, setOpenSwapModal] = useState(false);
  const [targetSwapShift, setTargetSwapShift] = useState<ShiftRecord | null>(
    null,
  );

  // Swap Trail Modal states
  const [openTrailModal, setOpenTrailModal] = useState(false);
  const [targetTrailShift, setTargetTrailShift] = useState<ShiftRecord | null>(
    null,
  );

  // Shift Sell Modal states
  const [openSellModal, setOpenSellModal] = useState(false);
  const [targetSellShift, setTargetSellShift] = useState<ShiftRecord | null>(
    null,
  );

  // Date detail bottom sheet state
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [openDateDetailSheet, setOpenDateDetailSheet] = useState(false);

  // Edit Shift, Service, Clinic state
  const [editingShift, setEditingShift] = useState<ShiftRecord | null>(null);
  const [openEditShiftModal, setOpenEditShiftModal] = useState(false);

  const [editingService, setEditingService] = useState<CustomerServiceRecord | null>(null);
  const [openEditServiceModal, setOpenEditServiceModal] = useState(false);

  const [editingClinicLog, setEditingClinicLog] = useState<ClinicWorkRecord | null>(null);
  const [openEditClinicLogModal, setOpenEditClinicLogModal] = useState(false);

  // Calendar Export Modal state
  const [openExportCalendarModal, setOpenExportCalendarModal] = useState(false);

  const handleEditShift = useCallback((shift: ShiftRecord) => {
    setEditingShift(shift);
    setOpenEditShiftModal(true);
  }, []);

  const handleEditService = useCallback((service: CustomerServiceRecord) => {
    setEditingService(service);
    setOpenEditServiceModal(true);
  }, []);

  const handleEditClinicLog = useCallback((clinicLog: ClinicWorkRecord) => {
    setEditingClinicLog(clinicLog);
    setOpenEditClinicLogModal(true);
  }, []);

  // Alert/Notification banner state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Action Confirmation Modal state (Restore, Undo Swap, Delete)
  const [confirmActionState, setConfirmActionState] =
    useState<ConfirmModalState>(null);

  // Live API Sync states
  const [isSyncing, setIsSyncing] = useState(false);

  const [isMounted, setIsMounted] = useState(false);
  const [customQuota, setCustomQuota] = useState<number | undefined>(undefined);

  // Reference month for Quota Widget (current calendar month, e.g. 2026-10)
  const currentMonthKey = moment().format("YYYY-MM");

  // Load activities from local storage only (fast, no network side-effects)
  const loadLocalData = useCallback(() => {
    setActivities(getAllActivities());
  }, []);

  // Background sync with backend API (http://localhost:8080/api/v1)
  const syncApiData = useCallback(async () => {
    try {
      setIsSyncing(true);
      await syncAllDataFromApi();
      setActivities(getAllActivities());
    } catch (err) {
      console.warn("API sync warning:", err);
    } finally {
      setIsSyncing(false);
    }
  }, []);

  const reloadData = useCallback(() => {
    loadLocalData();
    syncApiData();
  }, [loadLocalData, syncApiData]);

  useEffect(() => {
    setIsMounted(true);
    loadLocalData();
    syncApiData();
    const unsubscribe = subscribeToStorage(loadLocalData);
    const unsubSync = subscribeToSyncState((state) => {
      setIsSyncing(state.isSyncing);
    });

    const handleOpenAddEvent = (e: Event) => {
      const customEvent = e as CustomEvent<{
        tab?: "shift" | "service";
        date?: string;
      }>;
      if (customEvent.detail?.tab) {
        setModalInitialTab(customEvent.detail.tab);
      }
      if (customEvent.detail?.date) {
        setModalDefaultDate(customEvent.detail.date);
      } else {
        setModalDefaultDate(new Date().toISOString().split("T")[0]);
      }
      setOpenAddModal(true);
    };

    window.addEventListener("vendee_open_add_modal", handleOpenAddEvent);

    return () => {
      unsubscribe();
      unsubSync();
      window.removeEventListener("vendee_open_add_modal", handleOpenAddEvent);
    };
  }, [loadLocalData, syncApiData]);

  // Quota statistics for current month (single shared pure function per DOMAIN_RULES.md §1)
  const quotaStats = useMemo(() => {
    const currentShifts = isMounted
      ? activities.filter((a): a is ShiftRecord => a.type === "shift")
      : [];
    return getMonthlyBlackShiftStats(currentMonthKey, currentShifts, customQuota);
  }, [isMounted, activities, currentMonthKey, customQuota]);

  // Filtered activities for list view
  const filteredActivities = useMemo(() => {
    const activeActivities = activities.filter((item) => {
      if (item.type === "shift") {
        return item.status !== "swapped_out" && item.status !== "cancelled" && item.status !== "sold_out";
      }
      return true;
    });

    if (filterType === "all") return activeActivities;
    return activeActivities.filter((item) => item.type === filterType);
  }, [activities, filterType]);

  // Split into:
  // 1. วันนี้หรือวันถัดไปที่ใกล้มาก่อน (Upcoming: Ascending by date)
  // 2. วันที่เลยไปแล้ว (Past: Descending by date - เรียงจากล่าสุดไว้บนสุด)
  const { upcomingActivities, pastActivities } = useMemo(() => {
    const todayStr = moment().format("YYYY-MM-DD");

    // วันนี้หรือวันถัดไปที่ใกล้มาก่อน (Nearest date first - Ascending)
    const upcoming = filteredActivities
      .filter((item) => item.date >= todayStr)
      .sort(compareEventsByStartTime);

    // วันที่เลยไปแล้ว (Past: วันล่าสุดไว้บนสุด แต่ภายในวันเดียวกันเรียงตามเวลาเริ่มจากน้อยไปมาก)
    const past = filteredActivities
      .filter((item) => item.date < todayStr)
      .sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return compareEventsByStartTime(a, b);
      });

    return { upcomingActivities: upcoming, pastActivities: past };
  }, [filteredActivities]);

  // Activities for the selected calendar date (hide swapped-out shifts)
  const activitiesForSelectedDate = useMemo(() => {
    if (!selectedDateStr) return [];
    return activities
      .filter((item) => item.date === selectedDateStr)
      .filter((item) => {
        if (item.type === "shift") {
          return item.status !== "swapped_out" && item.status !== "cancelled" && item.status !== "sold_out";
        }
        return true;
      })
      .sort(compareEventsByStartTime);
  }, [activities, selectedDateStr]);

  // Calendar events transformation (hide swapped-out shifts from calendar & group shifts per day)
  const calendarEvents = useMemo(() => {
    const activeItems = activities.filter((item) => {
      // ซ่อนเวรเก่าที่ถูกแลกออกแล้ว (swapped_out), เวรที่ขาย (sold_out) และเวรที่ถูกยกเลิก (cancelled) ออกจากปฏิทิน
      if (item.type === "shift") {
        return item.status !== "swapped_out" && item.status !== "cancelled" && item.status !== "sold_out";
      }
      return true;
    });

    const shifts = activeItems.filter((item) => item.type === "shift") as ShiftRecord[];
    const nonShifts = activeItems.filter((item) => item.type !== "shift");

    // จัดกลุ่มเวรตามวันที่ (Group active shifts by date)
    const shiftsByDate: Record<string, ShiftRecord[]> = {};
    shifts.forEach((shift) => {
      if (!shiftsByDate[shift.date]) {
        shiftsByDate[shift.date] = [];
      }
      shiftsByDate[shift.date].push(shift);
    });

    const shiftSortOrder: Record<string, number> = {
      night: 1,     // เวรดึก (00:00)
      r1: 2,        // Refer 1
      r2: 2,        // Refer 2
      off: 3,       // เวรหยุด
      ctm: 4,       // CT เช้า (07:30)
      morning: 5,   // เวรเช้า (08:00)
      cta: 6,       // CT บ่าย (12:00)
      afternoon: 7, // เวรบ่าย (16:00)
    };

    const eventsResult: any[] = [];

    // แปลงเวรที่จัดกลุ่มแล้ว (เรียงตามลำดับเวลา: ดึก -> เช้า -> บ่าย)
    Object.entries(shiftsByDate).forEach(([date, dateShifts]) => {
      // เรียงลำดับเวรในวันเดียวกันตามเวลาที่เกิดก่อน (Chronological order)
      dateShifts.sort((a, b) => {
        const orderA = shiftSortOrder[a.shiftType] ?? 99;
        const orderB = shiftSortOrder[b.shiftType] ?? 99;
        return orderA - orderB;
      });

      const shiftDetails = dateShifts.map((shift) => {
        const code = SHIFT_CODE_MAP[shift.shiftType] || shift.shiftType;
        const isRed = shift.category === "red";
        const isRefer =
          shift.shiftType === "r1" ||
          shift.shiftType === "r2" ||
          shift.category === "green";
        const isSwapped = Boolean(shift.swapMeta);
        const swappedWith = shift.swapMeta?.swappedWith;

        return {
          code,
          isRed,
          isRefer,
          isSwapped,
          swappedWith,
          shiftType: shift.shiftType,
          category: shift.category,
        };
      });

      // หากมีหลายเวรในวันเดียวกัน ให้รวมเป็น <code> / <code> เช่น 2 / 3
      const titleText = shiftDetails
        .map((d) => `${d.code}${d.swappedWith ? `(${d.swappedWith})` : ""}`)
        .join(" / ");

      eventsResult.push({
        id: `shift-group-${date}`,
        title: titleText,
        date: date,
        start: `${date}T00:00:00`,
        allDay: true,
        color: "#ffffff",
        textColor: "#0f172a",
        contrastColor: "#0f172a",
        order: 1,
        extendedProps: {
          items: dateShifts,
          item: dateShifts[0],
          order: 1,
          shiftDetails,
        },
      });
    });

    // Helper สำหรับจัดรูปแบบเวลาบริการนัดหมายลูกค้า (14:00 -> 14, 14:30 -> 14:30)
    const formatServiceTime = (timeStr?: string) => {
      if (!timeStr) return "";
      const clean = timeStr.slice(0, 5);
      const parts = clean.split(":");
      if (parts.length < 2) return clean;
      const hours = parseInt(parts[0], 10).toString();
      const minutes = parts[1];
      if (minutes === "00") {
        return hours;
      }
      return `${hours}:${minutes}`;
    };

    // แปลงรายการอื่นๆ (คลินิก, นัดหมายบริการ, ธุระส่วนตัว)
    nonShifts.forEach((item) => {
      if (item.type === "clinic") {
        const clinicLog = item as ClinicWorkRecord;
        const startTime = (clinicLog.presetShift.split(" - ")[0] || "12:30").slice(0, 5);
        const clinicTitle = `🏥 ${clinicLog.presetShift}`;
        eventsResult.push({
          id: item.id,
          title: clinicTitle,
          date: item.date,
          start: `${item.date}T${startTime}:00`,
          allDay: true,
          color: "#8b5cf6",
          textColor: "#ffffff",
          contrastColor: "#ffffff",
          order: 3,
          extendedProps: { item, order: 3 },
        });
      } else if (item.type === "personal_event") {
        const pEvent = item as PersonalEventRecord;
        const cleanStartTime = (pEvent.startTime || "18:00").slice(0, 5);
        const timeDisplay = pEvent.isAllDay ? "ทั้งวัน" : cleanStartTime;
        const eventTitle = `🎈 ${timeDisplay} ${pEvent.title}`;
        const eventDate = pEvent.eventDate || pEvent.date;
        eventsResult.push({
          id: item.id,
          title: eventTitle,
          date: eventDate,
          start: `${eventDate}T${cleanStartTime}:00`,
          allDay: Boolean(pEvent.isAllDay),
          color: "#f43f5e",
          textColor: "#ffffff",
          contrastColor: "#ffffff",
          order: 4,
          extendedProps: { item, order: 4, isPersonalEvent: true },
        });
      } else {
        const service = item as CustomerServiceRecord;
        const cleanTime = (service.time || "12:00").slice(0, 5);
        const formattedTime = formatServiceTime(cleanTime);
        const serviceTitle = `${formattedTime ? `${formattedTime}น. ` : ""} ${service.customerName}`;
        eventsResult.push({
          id: item.id,
          title: serviceTitle,
          date: item.date,
          start: `${item.date}T${cleanTime}:00`,
          allDay: true,
          color: "#0284c7",
          textColor: "#ffffff",
          contrastColor: "#ffffff",
          order: 2,
          extendedProps: { item, order: 2, isService: true },
        });
      }
    });

    return eventsResult;
  }, [activities]);

  // Calendar date click handler
  const handleDateClick = (info: { dateStr: string }) => {
    setSelectedDateStr(info.dateStr);
    setOpenDateDetailSheet(true);
  };

  // Calendar event click handler
  const handleEventClick = (info: any) => {
    const item = info.event.extendedProps?.item as ActivityItem | undefined;
    const items = info.event.extendedProps?.items as ActivityItem[] | undefined;
    const dateStr =
      info.event.startStr?.split("T")[0] || item?.date || items?.[0]?.date;
    if (dateStr) {
      setSelectedDateStr(dateStr);
      setOpenDateDetailSheet(true);
    }
  };

  // Swap action handler
  const handleInitiateSwap = (shift: ShiftRecord) => {
    setTargetSwapShift(shift);
    setOpenSwapModal(true);
  };

  // Refer Shift Sell handler
  const handleInitiateSell = (shift: ShiftRecord) => {
    setTargetSellShift(shift);
    setOpenSellModal(true);
  };

  // Undo Shift Sell handler
  const handleUndoSell = async (shift: ShiftRecord) => {
    try {
      await undoSellShift(shift.id);
      setToastMessage("ยกเลิกการขายเวรและคืนสถานะเวรปกติเรียบร้อยแล้ว");
      setTimeout(() => setToastMessage(null), 3500);
      reloadData();
    } catch (err: any) {
      setToastMessage(err.message || "เกิดข้อผิดพลาดในการยกเลิกการขายเวร");
      setTimeout(() => setToastMessage(null), 3500);
    }
  };

  // Swap trail modal handler
  const handleViewTrail = (shift: ShiftRecord) => {
    setTargetTrailShift(shift);
    setOpenTrailModal(true);
  };

  const formatThaiDate = (dateStr: string) => {
    try {
      return moment(dateStr).locale("th").format("ddddที่ D MMMM YYYY");
    } catch {
      return dateStr;
    }
  };

  const formatBottomSheetTitle = (dateStr: string) => {
    const formatted = formatThaiDate(dateStr);
    const todayStr = moment().format("YYYY-MM-DD");
    const tomorrowStr = moment().add(1, "day").format("YYYY-MM-DD");
    const yesterdayStr = moment().subtract(1, "day").format("YYYY-MM-DD");

    if (dateStr === todayStr) {
      return `${formatted} (วันนี้)`;
    }
    if (dateStr === tomorrowStr) {
      return `${formatted} (พรุ่งนี้)`;
    }
    if (dateStr === yesterdayStr) {
      return `${formatted} (เมื่อวาน)`;
    }
    return formatted;
  };

  const formatShortThaiDate = (dateStr: string) => {
    try {
      return moment(dateStr).locale("th").format("D MMM YYYY");
    } catch {
      return dateStr;
    }
  };

  // Open add modal for a specific date
  const handleOpenAddForDate = (date: string) => {
    setModalDefaultDate(date);
    setOpenDateDetailSheet(false);
    setOpenAddModal(true);
  };

  // =========================================================================
  // CONFIRMATION HANDLERS (Modal Confirm เพื่อป้องกัน User Error)
  // =========================================================================

  // 1. Request Undo Swap -> Show modal
  const handleRequestUndoSwap = (shift: ShiftRecord) => {
    if (shift.swapMeta?.isLocked) return;
    setConfirmActionState({ type: "undoSwap", shift });
  };

  // Execute Undo Swap
  const handleExecuteUndoSwap = (shift: ShiftRecord) => {
    try {
      undoSwapShift(shift.id);
      setToastMessage("ยกเลิกการแลกเวรและคืนค่าสถานะเวรเดิมเรียบร้อยแล้ว");
      setTimeout(() => setToastMessage(null), 3500);
      setConfirmActionState(null);
      reloadData();
    } catch (err: any) {
      alert(err.message || "ไม่สามารถยกเลิกการแลกได้");
    }
  };

  // 2. Request Restore Shift -> Show modal
  const handleRequestRestore = (shift: ShiftRecord) => {
    setConfirmActionState({ type: "restore", shift });
  };

  // Execute Restore Shift
  const handleExecuteRestore = (shift: ShiftRecord) => {
    try {
      restoreShift(shift.id);
      setToastMessage("กู้คืนสถานะเวรเดิมกลับมาพร้อมใช้งานเรียบร้อยแล้ว");
      setTimeout(() => setToastMessage(null), 3500);
      setConfirmActionState(null);
      reloadData();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการกู้คืนเวร");
    }
  };

  // 3. Request Delete Shift / Service -> Show modal
  const handleRequestDelete = (item: ActivityItem) => {
    setConfirmActionState({ type: "delete", item });
  };

  // Execute Delete
  const handleExecuteDelete = async (item: ActivityItem) => {
    try {
      if (item.type === "shift") {
        const res = await deleteShift(item.id);
        if (res?.restoredParentId) {
          setToastMessage(
            "ลบเวรที่แลกมา และคืนสถานะเวรเดิมให้กลับมาพร้อมใช้งานเรียบร้อยแล้ว",
          );
          setTimeout(() => setToastMessage(null), 3500);
        } else {
          setToastMessage("ลบเวรออกจากตารางเรียบร้อยแล้ว");
          setTimeout(() => setToastMessage(null), 3000);
        }
      } else if (item.type === "clinic") {
        deleteClinicLog(item.id);
        setToastMessage("ลบบันทึกกะคลินิกเรียบร้อยแล้ว");
        setTimeout(() => setToastMessage(null), 3000);
      } else if (item.type === "personal_event") {
        await deletePersonalEvent(item.id);
        setToastMessage("ลบธุระส่วนตัวเรียบร้อยแล้ว");
        setTimeout(() => setToastMessage(null), 3000);
      } else {
        await deleteService(item.id);
        setToastMessage("ลบนัดหมายบริการลูกค้าเรียบร้อยแล้ว");
        setTimeout(() => setToastMessage(null), 3000);
      }
      setConfirmActionState(null);
      reloadData();
    } catch (err: any) {
      alert(err.message || "เกิดข้อผิดพลาดในการลบรายการ");
    }
  };

  // Dynamically compute modal properties based on confirmActionState
  const confirmModalProps = useMemo(() => {
    if (!confirmActionState) return null;

    if (confirmActionState.type === "restore") {
      const shift = confirmActionState.shift;
      const shiftInfo = SHIFT_CONFIG[shift.shiftType];
      const catInfo = SHIFT_CATEGORY_CONFIG[shift.category];
      const isRefer =
        shift.category === "green" ||
        shift.shiftType === "r1" ||
        shift.shiftType === "r2";

      return {
        title: "ยืนยันการกู้คืนเวรเดิม",
        subtitle: "นำเวรเดิมที่เคยแลกออกไปกลับมาปฏิบัติงานตามปกติ",
        variant: "primary" as ConfirmVariant,
        iconType: "restore" as const,
        confirmText: "ยืนยันกู้คืนเวร",
        cancelText: "ยกเลิก",
        items: [
          {
            label: "วันที่เวรเดิม",
            value: formatThaiDate(shift.date),
          },
          {
            label: "ช่วงเวลาเวร",
            value: `${shiftInfo?.label || "เวร"} (${shiftInfo?.period || ""})`,
          },
          {
            label: "หมวดเวร",
            value: isRefer ? "เวร R (สีเขียว)" : catInfo?.label || "-",
          },
        ],
        warningNotice: (
          <span>
            เวรนี้จะถูกเปลี่ยนสถานะกลับเป็น{" "}
            <strong>&quot;พร้อมปฏิบัติงาน (Active)&quot;</strong>{" "}
            ในตารางเวรของคุณตามเดิม
          </span>
        ),
        onConfirm: () => handleExecuteRestore(shift),
      };
    }

    if (confirmActionState.type === "undoSwap") {
      const shift = confirmActionState.shift;
      const shiftInfo = SHIFT_CONFIG[shift.shiftType];
      const partner = shift.swapMeta?.swappedWith;

      return {
        title: "ยืนยันการยกเลิกการแลกเวร",
        subtitle: `ยกเลิกการแลกเวรกับ ${partner || "เพื่อนร่วมงาน"}`,
        variant: "warning" as ConfirmVariant,
        iconType: "undo" as const,
        confirmText: "ยืนยันยกเลิกการแลก",
        cancelText: "ไม่ยกเลิก",
        items: [
          {
            label: "เวรที่ได้รับมา",
            value: `${formatThaiDate(shift.date)} • ${shiftInfo?.label || "เวร"}`,
          },
          {
            label: "แลกกับ",
            value: partner || "-",
          },
          ...(shift.swapMeta?.originalOwner
            ? [
                {
                  label: "เจ้าของเดิม",
                  value: shift.swapMeta.originalOwner,
                },
              ]
            : []),
        ],
        warningNotice: (
          <span>
            ⚠️ เวรนี้จะถูกลบออกจากตาราง และ
            <strong>
              ระบบจะคืนสถานะเวรเดิมที่คุณเคยแลกออกไปให้กลับมาพร้อมใช้งานโดยอัตโนมัติ
            </strong>
          </span>
        ),
        onConfirm: () => handleExecuteUndoSwap(shift),
      };
    }

    if (confirmActionState.type === "delete") {
      const item = confirmActionState.item;

      if (item.type === "shift") {
        const shift = item;
        const shiftInfo = SHIFT_CONFIG[shift.shiftType];
        const catInfo = SHIFT_CATEGORY_CONFIG[shift.category];
        const isSwappedIn = !!shift.swapMeta;
        const isSwappedOut = shift.status === "swapped_out";
        const partner = shift.swapMeta?.swappedWith;

        if (isSwappedIn) {
          return {
            title: "ยืนยันการลบเวรที่ได้จากการแลก",
            subtitle: `เวรนี้มาจากการแลกเวรกับ ${partner || "เพื่อนร่วมงาน"}`,
            variant: "danger" as ConfirmVariant,
            iconType: "trash" as const,
            confirmText: "ยืนยันลบเวรนี้",
            cancelText: "ยกเลิก",
            items: [
              {
                label: "วันที่เวร",
                value: formatThaiDate(shift.date),
              },
              {
                label: "ประเภทเวร",
                value: `${shiftInfo?.label || "เวร"} (${shiftInfo?.period || ""})`,
              },
              {
                label: "แลกมาจาก",
                value: partner || "-",
              },
            ],
            warningNotice: (
              <span className="block text-rose-800 dark:text-rose-200">
                ⚠️ <strong>ข้อควรระวังสำคัญ (มีการแลกเวร):</strong>{" "}
                เนื่องจากเวรนี้ได้มาจากการแลก หากลบเวรนี้{" "}
                <strong>
                  ระบบจะกู้คืนสถานะเวรเดิมของคุณให้กลับมาพร้อมใช้งานตามปกติโดยอัตโนมัติ
                </strong>
              </span>
            ),
            onConfirm: () => handleExecuteDelete(item),
          };
        }

        if (isSwappedOut) {
          return {
            title: "ไม่สามารถลบเวรที่แลกออกแล้วได้",
            subtitle: "เพื่อป้องกันประวัติการแลกสูญหาย คุณสามารถกู้คืนเวรเดิมกลับมาได้",
            variant: "warning" as ConfirmVariant,
            iconType: "undo" as const,
            confirmText: "กู้คืนเวร (ยกเลิกการแลก)",
            cancelText: "ยกเลิก",
            items: [
              {
                label: "วันที่เวร",
                value: formatThaiDate(shift.date),
              },
              {
                label: "ประเภทเวร",
                value: `${shiftInfo?.label || "เวร"} (${shiftInfo?.period || ""})`,
              },
              {
                label: "สถานะปัจจุบัน",
                value: "แลกออกแล้ว (Swapped Out)",
              },
            ],
            warningNotice: (
              <span>
                ⚠️ ตามกฎ <strong>DOMAIN_RULES.md (ข้อ 2.3.2)</strong> เวรที่ถูกแลกออกไปแล้วจะไม่สามารถลบถาวรได้{" "}
                การกดปุ่มด้านล่างจะดำเนินการ <strong>กู้คืนเวรเดิมของคุณ และยกเลิกเวรที่ได้รับมาจากการแลกให้อัตโนมัติ</strong>
              </span>
            ),
            onConfirm: () => handleExecuteUndoSwap(shift),
          };
        }

        // Regular Shift
        return {
          title: "ยืนยันการลบเวร",
          subtitle: "ต้องการลบเวรนี้ออกจากตารางใช่หรือไม่",
          variant: "danger" as ConfirmVariant,
          iconType: "trash" as const,
          confirmText: "ยืนยันลบเวร",
          cancelText: "ยกเลิก",
          items: [
            {
              label: "วันที่เวร",
              value: formatThaiDate(shift.date),
            },
            {
              label: "ประเภทเวร",
              value: `${shiftInfo?.label || "เวร"} (${shiftInfo?.period || ""})`,
            },
            {
              label: "หมวดหมู่",
              value:
                shift.category === "green"
                  ? "เวร R (สีเขียว)"
                  : catInfo?.label || "-",
            },
          ],
          warningNotice: (
            <span>
              คุณต้องการลบเวรนี้ออกจากตารางใช่หรือไม่?
              การกระทำนี้ไม่สามารถเรียกคืนได้
            </span>
          ),
          onConfirm: () => handleExecuteDelete(item),
        };
      }

      if (item.type === "clinic") {
        const clinicLog = item as ClinicWorkRecord;
        return {
          title: "ยืนยันการลบบันทึกกะคลินิก",
          subtitle: `วันที่: ${formatThaiDate(clinicLog.date)} (${clinicLog.presetShift} น.)`,
          variant: "danger" as ConfirmVariant,
          iconType: "trash" as const,
          confirmText: "ยืนยันลบบันทึก",
          cancelText: "ยกเลิก",
          items: [
            {
              label: "วันที่ปฏิบัติงาน",
              value: formatThaiDate(clinicLog.date),
            },
            {
              label: "ช่วงเวลาทำงาน",
              value: `${clinicLog.presetShift} น.`,
            },
          ],
          warningNotice: (
            <span>
              คุณต้องการลบบันทึกกะคลินิกนี้ใช่หรือไม่?
            </span>
          ),
          onConfirm: () => handleExecuteDelete(item),
        };
      }

      if (item.type === "personal_event") {
        const pEvent = item as PersonalEventRecord;
        return {
          title: "ยืนยันการลบธุระส่วนตัว",
          subtitle: `กิจกรรม: ${pEvent.title}`,
          variant: "danger" as ConfirmVariant,
          iconType: "trash" as const,
          confirmText: "ยืนยันลบธุระ",
          cancelText: "ยกเลิก",
          items: [
            {
              label: "กิจกรรม",
              value: pEvent.title,
            },
            {
              label: "วันที่",
              value: formatThaiDate(pEvent.eventDate || pEvent.date),
            },
            {
              label: "เวลา",
              value: pEvent.isAllDay ? "ไปทั้งวัน" : `${pEvent.startTime} - ${pEvent.endTime} น.`,
            },
            ...(pEvent.location
              ? [
                  {
                    label: "สถานที่",
                    value: pEvent.location,
                  },
                ]
              : []),
            ...(pEvent.notes
              ? [
                  {
                    label: "บันทึกเพิ่มเติม",
                    value: pEvent.notes,
                  },
                ]
              : []),
          ],
          warningNotice: <span>คุณต้องการลบธุระส่วนตัวนี้ใช่หรือไม่?</span>,
          onConfirm: () => handleExecuteDelete(item),
        };
      }

      // Customer Service
      const service = item as CustomerServiceRecord;
      return {
        title: "ยืนยันการลบนัดหมายบริการ",
        subtitle: `ลูกค้านัดหมาย: ${service.customerName}`,
        variant: "danger" as ConfirmVariant,
        iconType: "trash" as const,
        confirmText: "ยืนยันลบนัดหมาย",
        cancelText: "ยกเลิก",
        items: [
          {
            label: "ลูกค้า",
            value: service.customerName,
          },
          {
            label: "วันที่นัดหมาย",
            value: formatThaiDate(service.date),
          },
          {
            label: "เวลา",
            value: `${service.time} น.`,
          },
        ],
        warningNotice: (
          <span>
            คุณต้องการลบนัดหมายบริการลูกค้ารายนี้ใช่หรือไม่?
            ข้อมูลจะถูกลบออกจากระบบ
          </span>
        ),
        onConfirm: () => handleExecuteDelete(item),
      };
    }

    return null;
  }, [confirmActionState]);

  return (
    <div
      className={`flex min-h-screen flex-col bg-app-bg text-text-main dark:bg-zinc-950 dark:text-zinc-100 ${
        viewMode === "calendar" ? "h-screen overflow-hidden" : ""
      }`}
    >
      {/* Top Header */}
      <header className="sticky top-0 z-30 border-b border-surface-subtle bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-900/90 pt-safe">
        <div className="mx-auto flex h-14 max-w-lg items-center justify-between px-4">
          {/* Brand */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-600 text-white shadow-xs">
              <CalendarDays className="h-4 w-4" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight text-text-main dark:text-white leading-tight">
                VenDee{" "}
                <span className="text-xs font-semibold text-primary dark:text-emerald-400">
                  Care
                </span>
              </h1>
              <div className="flex items-center gap-1.5 pt-0.5">
                <p className="text-[10px] text-text-muted dark:text-zinc-400 leading-none">
                  บันทึกเวรและบริการลูกค้า
                </p>
              </div>
            </div>
          </div>

          {/* Right Controls: [ Theme Toggle ] & Segmented Control: [ รายการ | ปฏิทิน ] */}
          <div className="flex items-center gap-1.5">
            <ThemeToggle size="sm" />
            <div className="flex items-center rounded-full bg-surface-subtle p-1 dark:bg-zinc-800 shadow-inner">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all cursor-pointer touch-manipulation active:scale-95 ${
                  viewMode === "list"
                    ? "bg-card-bg text-secondary shadow-xs dark:bg-zinc-700 dark:text-white"
                    : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white"
                }`}
                aria-label="มุมมองรายการ"
              >
                <List className="h-3.5 w-3.5" />
                <span>รายการ</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("calendar")}
                className={`flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-semibold transition-all cursor-pointer touch-manipulation active:scale-95 ${
                  viewMode === "calendar"
                    ? "bg-card-bg text-secondary shadow-xs dark:bg-zinc-700 dark:text-white"
                    : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-white"
                }`}
                aria-label="มุมมองปฏิทิน"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span>ปฏิทิน</span>
              </button>
            </div>
          </div>
        </div>

        {/* Animated header bottom loading bar */}
        {isSyncing && (
          <div className="absolute bottom-0 left-0 right-0 h-0.5 overflow-hidden bg-sky-100/40 dark:bg-sky-950/40">
            <div className="h-full w-full bg-gradient-to-r from-transparent via-sky-500 to-emerald-400 animate-sync-beam" />
          </div>
        )}
      </header>

      {/* Main Body */}
      <main
        className={`w-full flex-1 ${
          viewMode === "calendar"
            ? "flex flex-col h-[calc(100dvh-7.5rem)] sm:h-[calc(100dvh-8rem)] pb-safe overflow-hidden p-1 sm:p-2.5 max-w-5xl mx-auto"
            : "max-w-lg mx-auto p-3 sm:p-4 space-y-3.5"
        }`}
      >
        {/* Toast feedback */}
        {toastMessage && (
          <div className="rounded-2xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-lg animate-in fade-in flex items-center justify-between mb-1.5 shrink-0">
            <span>{toastMessage}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="text-white/80 hover:text-white"
            >
              ✕
            </button>
          </div>
        )}

        {/* MONTHLY QUOTA WIDGET (Full on List view, Compact bar on Calendar view) */}
        {viewMode === "list" ? (
          <ScheduleTodoListView
            quotaStats={quotaStats}
            currentMonthKey={currentMonthKey}
            activities={activities}
            filteredActivities={filteredActivities}
            upcomingActivities={upcomingActivities}
            pastActivities={pastActivities}
            filterType={filterType}
            onFilterChange={setFilterType}
            onOpenAddModal={(date) => {
              if (date) setModalDefaultDate(date);
              setOpenAddModal(true);
            }}
            onRequestDelete={handleRequestDelete}
            onInitiateSwap={handleInitiateSwap}
            onViewTrail={handleViewTrail}
            onRequestUndoSwap={handleRequestUndoSwap}
            onRequestRestore={handleRequestRestore}
            onSellShift={handleInitiateSell}
            onUndoSellShift={handleUndoSell}
            onEditShift={handleEditShift}
            onEditService={handleEditService}
            onEditClinicLog={handleEditClinicLog}
            onQuotaChange={setCustomQuota}
          />
        ) : (
          <ScheduleCalendarView
            events={calendarEvents}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
            onOpenExportModal={() => setOpenExportCalendarModal(true)}
          />
        )}
      </main>

      {/* Bottom Sheet: แสดงรายละเอียดของวันที่เลือกบนปฏิทิน */}
      <BottomSheet
        isOpen={openDateDetailSheet}
        onClose={() => setOpenDateDetailSheet(false)}
        title={
          selectedDateStr
            ? formatBottomSheetTitle(selectedDateStr)
            : "รายละเอียดกิจกรรม"
        }
        subtitle={`กิจกรรมทั้งหมด ${activitiesForSelectedDate.length} รายการ`}
      >
        <div className="space-y-3 py-2">
          {activitiesForSelectedDate.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500 dark:text-zinc-400">
              ไม่มีกิจกรรมหรือเวรในวันนี้
            </div>
          ) : (
            activitiesForSelectedDate.map((item) => (
              <ActivityCard
                key={item.id}
                item={item}
                onDelete={() => handleRequestDelete(item)}
                onSwapShift={(shift) => handleInitiateSwap(shift)}
                onViewTrail={(shift) => handleViewTrail(shift)}
                onUndoSwap={(shift) => handleRequestUndoSwap(shift)}
                onRestoreShift={(shift) => handleRequestRestore(shift)}
                onSellShift={handleInitiateSell}
                onUndoSellShift={handleUndoSell}
                onEditShift={handleEditShift}
                onEditService={handleEditService}
                onEditClinicLog={handleEditClinicLog}
              />
            ))
          )}

          {/* Quick Add button for this specific date */}
          {selectedDateStr && (
            <button
              type="button"
              onClick={() => handleOpenAddForDate(selectedDateStr)}
              className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 py-3 text-xs font-bold text-slate-700 hover:border-blue-500 hover:text-blue-600 dark:border-zinc-700 dark:text-zinc-300 dark:hover:border-blue-400 transition-colors"
            >
              <Plus className="h-4 w-4" />
              <span>
                เพิ่มเวรหรือนัดหมายในวันที่{" "}
                {formatShortThaiDate(selectedDateStr)}
              </span>
            </button>
          )}
        </div>
      </BottomSheet>

      {/* Modal Add Todo */}
      <ModalAddTodo
        openModal={openAddModal}
        toggleModal={() => setOpenAddModal(false)}
        initialTab={modalInitialTab}
        defaultDate={modalDefaultDate}
        onSuccess={reloadData}
        onOpenPersonalEvent={() => setOpenAddPersonalEventModal(true)}
      />

      {/* Modal Shift Swap (การแลกเวร) */}
      <ModalShiftSwap
        isOpen={openSwapModal}
        onClose={() => {
          setOpenSwapModal(false);
          setTargetSwapShift(null);
        }}
        shift={targetSwapShift}
        onSuccess={() => {
          setToastMessage("บันทึกการแลกเวรเรียบร้อยแล้ว");
          setTimeout(() => setToastMessage(null), 3500);
          reloadData();
        }}
      />

      {/* Modal Swap Trail (ดูลำดับการแลก) */}
      <ModalSwapTrail
        isOpen={openTrailModal}
        onClose={() => {
          setOpenTrailModal(false);
          setTargetTrailShift(null);
        }}
        shift={targetTrailShift}
      />

      {/* Modal Sell Refer Shift (การขายเวร Refer) */}
      <ModalSellShift
        isOpen={openSellModal}
        onClose={() => {
          setOpenSellModal(false);
          setTargetSellShift(null);
        }}
        shift={targetSellShift}
        onSuccess={() => {
          setToastMessage("บันทึกการขายเวร Refer เรียบร้อยแล้ว 🚑");
          setTimeout(() => setToastMessage(null), 3500);
          reloadData();
        }}
      />

      {/* Modal Edit Shift */}
      <ModalEditShift
        shift={editingShift}
        isOpen={openEditShiftModal}
        onClose={() => {
          setOpenEditShiftModal(false);
          setEditingShift(null);
        }}
        onSuccess={() => {
          setToastMessage("บันทึกการแก้ไขเวรเรียบร้อยแล้ว");
          setTimeout(() => setToastMessage(null), 3500);
          reloadData();
        }}
      />

      {/* Modal Edit Customer Service */}
      <ModalEditService
        service={editingService}
        isOpen={openEditServiceModal}
        onClose={() => {
          setOpenEditServiceModal(false);
          setEditingService(null);
        }}
        onSuccess={() => {
          setToastMessage("บันทึกการแก้ไขนัดหมายเรียบร้อยแล้ว");
          setTimeout(() => setToastMessage(null), 3500);
          reloadData();
        }}
      />

      {/* Modal Edit Clinic Work Log */}
      <ModalEditClinicLog
        clinicLog={editingClinicLog}
        isOpen={openEditClinicLogModal}
        onClose={() => {
          setOpenEditClinicLogModal(false);
          setEditingClinicLog(null);
        }}
        onSuccess={() => {
          setToastMessage("บันทึกการแก้ไขกะคลินิกเรียบร้อยแล้ว");
          setTimeout(() => setToastMessage(null), 3500);
          reloadData();
        }}
      />

      {/* Modal Add Personal Event (ธุระส่วนตัว) */}
      <ModalAddPersonalEvent
        isOpen={openAddPersonalEventModal}
        defaultDate={modalDefaultDate}
        onClose={() => setOpenAddPersonalEventModal(false)}
        onSwitchToOtherWork={() => {
          setOpenAddPersonalEventModal(false);
          setOpenAddModal(true);
        }}
        onSuccess={(_, warning) => {
          setToastMessage(warning || "บันทึกธุระส่วนตัวเรียบร้อยแล้ว 🎈");
          setTimeout(() => setToastMessage(null), 3500);
          reloadData();
        }}
      />

      {/* Bottom Navigation */}
      <BottomNav
        hideSpacer={viewMode === "calendar"}
        onOpenAdd={() => {
          setModalDefaultDate(new Date().toISOString().split("T")[0]);
          setOpenAddModal(true);
        }}
      />

      {/* Confirmation Modal for Restore, Swap, Delete, Undo actions */}
      {confirmModalProps && (
        <ModalConfirmAction
          isOpen={!!confirmActionState}
          onClose={() => setConfirmActionState(null)}
          onConfirm={confirmModalProps.onConfirm}
          title={confirmModalProps.title}
          subtitle={confirmModalProps.subtitle}
          variant={confirmModalProps.variant}
          iconType={confirmModalProps.iconType}
          confirmText={confirmModalProps.confirmText}
          cancelText={confirmModalProps.cancelText}
          items={confirmModalProps.items}
          warningNotice={confirmModalProps.warningNotice}
        />
      )}

      {/* iPhone / Apple Calendar Export Modal */}
      <ModalExportCalendar
        isOpen={openExportCalendarModal}
        onClose={() => setOpenExportCalendarModal(false)}
        defaultMonth={currentMonthKey}
      />
    </div>
  );
}

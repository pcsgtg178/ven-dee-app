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
  Phone,
  Clock,
  MapPin,
  Syringe,
  Sparkles,
  Package,
  MoreHorizontal,
  Moon,
  Sun,
  Sunset,
  ShieldCheck,
  CheckCircle2,
  Trash2,
  CalendarDays,
  ArrowLeftRight,
  GitCommit,
  RotateCcw,
  Lock,
  Flame,
  Ambulance,
} from "lucide-react";

import {
  ActivityItem,
  CustomerServiceRecord,
  ShiftRecord,
  SHIFT_CONFIG,
  SHIFT_CATEGORY_CONFIG,
  SERVICE_CONFIG,
  SHIFT_CODE_MAP,
} from "../../types/vendee";
import {
  getAllActivities,
  subscribeToStorage,
  deleteShift,
  deleteService,
  saveService,
  undoSwapShift,
  restoreShift,
  getMonthlyBlackShiftStats,
} from "../../lib/storage";
import ModalAddTodo from "./ModalAddTodo";
import ModalShiftSwap from "./ModalShiftSwap";
import ModalSwapTrail from "./ModalSwapTrail";
import BottomSheet from "./BottomModalSheet";
import BottomNav from "./BottomNav";
import ThemeToggle from "./ThemeToggle";
import ModalConfirmAction, { ConfirmVariant } from "./ModalConfirmAction";

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
  const [filterType, setFilterType] = useState<"all" | "shift" | "service">(
    "all",
  );

  // Add Todo Modal states
  const [openAddModal, setOpenAddModal] = useState(false);
  const [modalDefaultDate, setModalDefaultDate] = useState<string | undefined>(
    undefined,
  );
  const [modalInitialTab, setModalInitialTab] = useState<"shift" | "service">(
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

  // Date detail bottom sheet state
  const [selectedDateStr, setSelectedDateStr] = useState<string | null>(null);
  const [openDateDetailSheet, setOpenDateDetailSheet] = useState(false);

  // Alert/Notification banner state
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Action Confirmation Modal state (Restore, Undo Swap, Delete)
  const [confirmActionState, setConfirmActionState] =
    useState<ConfirmModalState>(null);

  // Reference month for Quota Widget (e.g. 2026-09)
  const currentMonthKey = "2026-09";

  // Load activities
  const reloadData = useCallback(() => {
    setActivities(getAllActivities());
  }, []);

  useEffect(() => {
    reloadData();
    const unsubscribe = subscribeToStorage(reloadData);

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
      window.removeEventListener("vendee_open_add_modal", handleOpenAddEvent);
    };
  }, [reloadData]);

  // Quota statistics for current month
  const quotaStats = useMemo(() => {
    return getMonthlyBlackShiftStats(currentMonthKey);
  }, [activities, currentMonthKey]);

  // Filtered activities for list view
  const filteredActivities = useMemo(() => {
    if (filterType === "all") return activities;
    return activities.filter((item) => item.type === filterType);
  }, [activities, filterType]);

  // Split into:
  // 1. วันนี้หรือวันถัดไปที่ใกล้มาก่อน (Upcoming: Ascending by date)
  // 2. วันที่เลยไปแล้ว (Past: Descending by date - เรียงจากล่าสุดไว้บนสุด)
  const { upcomingActivities, pastActivities } = useMemo(() => {
    const todayStr = moment().format("YYYY-MM-DD");

    const getTimeVal = (item: ActivityItem) => {
      if (item.type === "shift") {
        switch (item.shiftType) {
          case "night":
            return "00:00";
          case "r1":
          case "r2":
            return "00:01";
          case "morning":
            return "08:00";
          case "afternoon":
            return "16:00";
          default:
            return "00:00";
        }
      }
      return item.time || "12:00";
    };

    // วันนี้หรือวันถัดไปที่ใกล้มาก่อน (Nearest date first - Ascending)
    const upcoming = filteredActivities
      .filter((item) => item.date >= todayStr)
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return getTimeVal(a).localeCompare(getTimeVal(b));
      });

    // วันที่เลยไปแล้ว (Past: เรียงจากล่าสุดไว้บนสุด - Descending)
    const past = filteredActivities
      .filter((item) => item.date < todayStr)
      .sort((a, b) => {
        const dateCmp = b.date.localeCompare(a.date);
        if (dateCmp !== 0) return dateCmp;
        return getTimeVal(b).localeCompare(getTimeVal(a));
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
          return item.status !== "swapped_out" && item.status !== "cancelled";
        }
        return true;
      });
  }, [activities, selectedDateStr]);

  // Calendar events transformation (hide swapped-out shifts from calendar)
  const calendarEvents = useMemo(() => {
    return activities
      .filter((item) => {
        // ซ่อนเวรเก่าที่ถูกแลกออกแล้ว (swapped_out) และเวรที่ถูกยกเลิก (cancelled) ออกจากปฏิทิน
        if (item.type === "shift") {
          return item.status !== "swapped_out" && item.status !== "cancelled";
        }
        return true;
      })
      .map((item) => {
        if (item.type === "shift") {
          const code = SHIFT_CODE_MAP[item.shiftType]; // "1" = เวรดึก, "2" = เวรเช้า, "3" = เวรบ่าย, "R1", "R2"
          const isRed = item.category === "red";
          const isRefer = item.shiftType === "r1" || item.shiftType === "r2" || item.category === "green";
          const isSwapped = Boolean(item.swapMeta);
          const swapPrefix = isSwapped ? "🔄" : "";
          const titleText = `${swapPrefix}${code}`;

          // เวรดำ: พื้นหลังสีดำ (#000000), เวรแดง: พื้นหลังสีแดง (#dc2626), เวร R: พื้นหลังสีเขียว (#16a34a)
          const eventColor = isRefer ? "#16a34a" : isRed ? "#dc2626" : "#000000";

          return {
            id: item.id,
            title: titleText,
            date: item.date,
            color: eventColor,
            textColor: "#ffffff",
            order: 1, // SHIFTS ALWAYS FIRST!
            extendedProps: { item, order: 1 },
          };
        } else {
          // Customer Service: ชื่อลูกค้าและเวลา
          const serviceTitle = `${item.customerName} ${item.time} น.`;

          return {
            id: item.id,
            title: serviceTitle,
            date: item.date,
            color: "#0284c7", // Sea blue for customer service to contrast with green Refer
            textColor: "#ffffff",
            order: 2, // SERVICES AFTER SHIFTS
            extendedProps: { item, order: 2 },
          };
        }
      });
  }, [activities]);

  // Calendar date click handler
  const handleDateClick = (info: { dateStr: string }) => {
    setSelectedDateStr(info.dateStr);
    setOpenDateDetailSheet(true);
  };

  // Calendar event click handler
  const handleEventClick = (info: any) => {
    const item = info.event.extendedProps.item as ActivityItem;
    setSelectedDateStr(item.date);
    setOpenDateDetailSheet(true);
  };

  // Quick toggle service status
  const handleToggleServiceStatus = (service: CustomerServiceRecord) => {
    const nextStatus =
      service.status === "completed" ? "upcoming" : "completed";
    saveService({
      ...service,
      status: nextStatus,
    });
  };

  // Swap action handler
  const handleInitiateSwap = (shift: ShiftRecord) => {
    setTargetSwapShift(shift);
    setOpenSwapModal(true);
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
  const handleExecuteDelete = (item: ActivityItem) => {
    try {
      if (item.type === "shift") {
        const res = deleteShift(item.id);
        if (res?.restoredParentId) {
          setToastMessage(
            "ลบเวรที่แลกมา และคืนสถานะเวรเดิมให้กลับมาพร้อมใช้งานเรียบร้อยแล้ว",
          );
          setTimeout(() => setToastMessage(null), 3500);
        } else {
          setToastMessage("ลบเวรออกจากตารางเรียบร้อยแล้ว");
          setTimeout(() => setToastMessage(null), 3000);
        }
      } else {
        deleteService(item.id);
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
            title: "ยืนยันการลบเวรที่แลกออกแล้ว",
            subtitle: "เวรนี้อยู่ในสถานะถูกแลกออกไปแล้ว",
            variant: "danger" as ConfirmVariant,
            iconType: "trash" as const,
            confirmText: "ยืนยันลบถาวร",
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
                label: "สถานะ",
                value: "แลกออกแล้ว (Swapped Out)",
              },
            ],
            warningNotice: (
              <span>
                ⚠️ การลบจะนำเวรนี้ออกจากประวัติตารางเวรอย่างถาวร
                หากต้องการนำเวรกลับมาทำงาน ให้กดปุ่ม{" "}
                <strong>&quot;กู้คืนเวรนี้&quot;</strong> แทน
              </span>
            ),
            onConfirm: () => handleExecuteDelete(item),
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

      // Customer Service
      const service = item;
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
          ...(service.customerNote
            ? [
                {
                  label: "บันทึก",
                  value: service.customerNote,
                },
              ]
            : []),
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
    <div className="flex min-h-screen flex-col bg-app-bg text-text-main dark:bg-zinc-950 dark:text-zinc-100 pb-28">
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
              <p className="text-[10px] text-text-muted dark:text-zinc-400 leading-none">
                บันทึกเวรและบริการลูกค้า
              </p>
            </div>
          </div>

          {/* Right Controls: [ Theme Toggle ] & Segmented Control: [ รายการ | ปฏิทิน ] */}
          <div className="flex items-center gap-2">
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
      </header>

      {/* Main Body */}
      <main
        className={`w-full flex-1 ${
          viewMode === "calendar"
            ? "flex flex-col h-[calc(100dvh-3.5rem)] overflow-hidden p-1 sm:p-2.5 max-w-5xl mx-auto"
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
            onToggleServiceStatus={handleToggleServiceStatus}
            onInitiateSwap={handleInitiateSwap}
            onViewTrail={handleViewTrail}
            onRequestUndoSwap={handleRequestUndoSwap}
            onRequestRestore={handleRequestRestore}
          />
        ) : (
          <ScheduleCalendarView
            events={calendarEvents}
            onDateClick={handleDateClick}
            onEventClick={handleEventClick}
          />
        )}
      </main>

      {/* Floating Action Button (FAB) at Bottom-Right */}
      {/* <div className="fixed bottom-20 right-4 z-40">
        <button
          type="button"
          onClick={() => {
            setModalDefaultDate(new Date().toISOString().split("T")[0]);
            setModalInitialTab("shift");
            setOpenAddModal(true);
          }}
          className="group flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-emerald-600 text-white shadow-xl shadow-emerald-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
          aria-label="บันทึกงานใหม่"
          title="บันทึกงานใหม่"
        >
          <Plus className="h-7 w-7 transition-transform group-hover:rotate-90 duration-200" />
        </button>
      </div> */}

      {/* Bottom Sheet: แสดงรายละเอียดของวันที่เลือกบนปฏิทิน */}
      <BottomSheet
        isOpen={openDateDetailSheet}
        onClose={() => setOpenDateDetailSheet(false)}
        title={
          selectedDateStr
            ? formatThaiDate(selectedDateStr)
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
                onToggleStatus={() => {
                  if (item.type === "service") {
                    handleToggleServiceStatus(item);
                  }
                }}
                onSwapShift={(shift) => handleInitiateSwap(shift)}
                onViewTrail={(shift) => handleViewTrail(shift)}
                onUndoSwap={(shift) => handleRequestUndoSwap(shift)}
                onRestoreShift={(shift) => handleRequestRestore(shift)}
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

      {/* Bottom Navigation */}
      <BottomNav
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
    </div>
  );
}

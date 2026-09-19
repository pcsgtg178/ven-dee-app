"use client";

import React, { useState, useMemo } from "react";
import {
  Moon,
  Syringe,
  CalendarDays,
  Plus,
  Clock,
  LayoutGrid,
  List,
  Pencil,
} from "lucide-react";
import moment from "moment";
import "moment/locale/th";
import {
  ActivityItem,
  CustomerServiceRecord,
  ShiftRecord,
  SHIFT_CONFIG,
  SHIFT_CATEGORY_CONFIG,
  SERVICE_CONFIG,
} from "../../types/vendee";
import ActivityCard from "./ActivityCard";
import { canEditShift, canEditService } from "../../lib/storage";
import MonthlyQuotaWidget from "./MonthlyQuotaWidget";

// ─── Types ───────────────────────────────────────────────────────────

export interface QuotaStats {
  blackCount: number;
  redCount: number;
  quota: number;
  remaining: number;
  isMet: boolean;
}

type SubViewMode = "card" | "timeline";

export interface ScheduleTodoListViewProps {
  /** สถิติโควตาเวรดำ/เวรแดงของเดือนนี้ */
  quotaStats: QuotaStats;
  /** เดือนปัจจุบัน e.g. "2026-09" */
  currentMonthKey: string;
  /** All raw activities for count display */
  activities: ActivityItem[];
  /** Filtered activities based on current filter tab */
  filteredActivities: ActivityItem[];
  /** Activities for today or upcoming, sorted ascending */
  upcomingActivities: ActivityItem[];
  /** Past activities, sorted descending */
  pastActivities: ActivityItem[];
  /** Currently active filter tab */
  filterType: "all" | "shift" | "service";
  /** Callback to change active filter */
  onFilterChange: (filter: "all" | "shift" | "service") => void;
  /** Callback to open add modal when empty */
  onOpenAddModal: (defaultDate?: string) => void;
  /** ActivityCard action callbacks */
  onRequestDelete: (item: ActivityItem) => void;
  onToggleServiceStatus: (service: CustomerServiceRecord) => void;
  onInitiateSwap: (shift: ShiftRecord) => void;
  onViewTrail: (shift: ShiftRecord) => void;
  onRequestUndoSwap: (shift: ShiftRecord) => void;
  onRequestRestore: (shift: ShiftRecord) => void;
  /** Optional: callback when user edits quota from MonthlyQuotaWidget */
  onQuotaChange?: (newQuota: number) => void;
  /** Edit callbacks */
  onEditShift?: (shift: ShiftRecord) => void;
  onEditService?: (service: CustomerServiceRecord) => void;
}

// ─── Helper: Group activities by date ────────────────────────────────

interface DateGroup {
  dateStr: string; // YYYY-MM-DD
  items: ActivityItem[];
}

function groupByDate(activities: ActivityItem[]): DateGroup[] {
  const map = new Map<string, ActivityItem[]>();
  for (const act of activities) {
    const d = act.date;
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(act);
  }
  // Sort dates ascending
  const sorted = Array.from(map.entries()).sort(([a], [b]) =>
    a.localeCompare(b),
  );
  return sorted.map(([dateStr, items]) => ({ dateStr, items }));
}

// ─── Helper: get event time for sorting ──────────────────────────────

function getEventTime(item: ActivityItem): string {
  if (item.type === "service") {
    return (item as CustomerServiceRecord).time || "00:00";
  }
  // Shift: use period start time
  const shift = item as ShiftRecord;
  const config = SHIFT_CONFIG[shift.shiftType];
  if (config?.period) {
    return config.period.split(" - ")[0] || "00:00";
  }
  return "00:00";
}

// ─── Timeline Row Component ──────────────────────────────────────────

function TimelineRow({
  item,
  onEditShift,
  onEditService,
}: {
  item: ActivityItem;
  onEditShift?: (shift: ShiftRecord) => void;
  onEditService?: (service: CustomerServiceRecord) => void;
}) {
  if (item.type === "shift") {
    const shift = item as ShiftRecord;
    const shiftConf = SHIFT_CONFIG[shift.shiftType];
    const catConf = SHIFT_CATEGORY_CONFIG[shift.category];
    const isSwapped = shift.status === "swapped_out";

    return (
      <div
        className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs transition-colors ${
          isSwapped
            ? "opacity-50 bg-surface-subtle/50 dark:bg-zinc-800/30"
            : "bg-card-bg dark:bg-zinc-900"
        }`}
      >
        {/* Color dot for category */}
        <span
          className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            shift.category === "black"
              ? "bg-shift-black dark:bg-slate-300"
              : shift.category === "red"
                ? "bg-shift-red"
                : "bg-emerald-500"
          }`}
        />
        {/* Shift label */}
        <span
          className={`font-bold ${shiftConf?.textBg || "text-text-main dark:text-white"}`}
        >
          {shiftConf?.shortLabel || shift.shiftType}
        </span>
        <span className="text-text-muted dark:text-zinc-400">
          {shiftConf?.period || "ทั้งวัน"}
        </span>
        {/* Category badge */}
        <span
          className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${catConf?.badge || ""}`}
        >
          {catConf?.label || shift.category}
        </span>
        {isSwapped && (
          <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-900/60 dark:text-amber-200">
            แลกแล้ว
          </span>
        )}
        {canEditShift(shift) && onEditShift && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEditShift(shift);
            }}
            className="ml-auto rounded-lg p-1 text-text-muted hover:bg-sky-50 hover:text-secondary active:scale-95 dark:hover:bg-zinc-800 dark:hover:text-sky-300 transition-all"
            title="แก้ไขเวรนี้"
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  }

  // Service
  const service = item as CustomerServiceRecord;
  const isCompleted = service.status === "completed";

  return (
    <div
      className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 text-xs ${
        isCompleted
          ? "bg-primary-light/20 dark:bg-emerald-950/20"
          : "bg-card-bg dark:bg-zinc-900"
      }`}
    >
      {/* Green dot for service */}
      <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" />
      <span className="font-bold text-primary-dark dark:text-primary-light">
        {service.time} น.
      </span>
      <span className="font-semibold text-text-main dark:text-white truncate">
        {service.customerName}
      </span>
      {/* Service type badges */}
      {service.services.slice(0, 2).map((srv) => {
        const conf = SERVICE_CONFIG[srv];
        return (
          <span
            key={srv}
            className={`hidden sm:inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-bold ${conf?.bg || ""}`}
          >
            {conf?.label || srv}
          </span>
        );
      })}
      {isCompleted && (
        <span className="rounded-md bg-primary-light px-1.5 py-0.5 text-[10px] font-bold text-primary-dark dark:bg-emerald-950/70 dark:text-emerald-300">
          ✓
        </span>
      )}
      {canEditService(service) && onEditService && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEditService(service);
          }}
          className="ml-auto rounded-lg p-1 text-text-muted hover:bg-emerald-50 hover:text-primary active:scale-95 dark:hover:bg-zinc-800 dark:hover:text-emerald-300 transition-all"
          title="แก้ไขนัดหมายนี้"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────

export default function ScheduleTodoListView({
  activities,
  filteredActivities,
  upcomingActivities,
  pastActivities,
  filterType,
  onFilterChange,
  onOpenAddModal,
  onRequestDelete,
  onToggleServiceStatus,
  onInitiateSwap,
  onViewTrail,
  onRequestUndoSwap,
  onRequestRestore,
  quotaStats,
  currentMonthKey,
  onQuotaChange,
  onEditShift,
  onEditService,
}: ScheduleTodoListViewProps) {
  const [subView, setSubView] = useState<SubViewMode>("card");

  // ─── Timeline grouped data: split into upcoming + past like Card view ──
  const upcomingTimelineGroups = useMemo(() => {
    const groups = groupByDate(upcomingActivities);
    for (const g of groups) {
      g.items.sort((a, b) => getEventTime(a).localeCompare(getEventTime(b)));
    }
    return groups;
  }, [upcomingActivities]);

  const pastTimelineGroups = useMemo(() => {
    const groups = groupByDate(pastActivities);
    // Past: sort dates descending (latest first) to match Card view
    groups.reverse();
    for (const g of groups) {
      g.items.sort((a, b) => getEventTime(a).localeCompare(getEventTime(b)));
    }
    return groups;
  }, [pastActivities]);

  const todayStr = moment().format("YYYY-MM-DD");

  return (
    <div className="space-y-3.5 pb-16 sm:pb-20">
      {/* MONTHLY QUOTA WIDGET */}
      <MonthlyQuotaWidget
        currentMonthStr={currentMonthKey}
        blackCount={quotaStats.blackCount}
        redCount={quotaStats.redCount}
        quota={quotaStats.quota}
        remaining={quotaStats.remaining}
        isMet={quotaStats.isMet}
        onQuotaChange={onQuotaChange}
      />

      {/* Filter Pills + Sub-view Toggle */}
      <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1 text-xs">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onFilterChange("all")}
            className={`rounded-full px-3 py-1.5 font-medium transition-all ${
              filterType === "all"
                ? "bg-text-main text-white dark:bg-white dark:text-text-main font-bold shadow-2xs"
                : "bg-surface-subtle text-text-muted hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            ทั้งหมด ({activities.length})
          </button>
          <button
            type="button"
            onClick={() => onFilterChange("shift")}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 font-medium transition-all ${
              filterType === "shift"
                ? "bg-secondary text-white font-bold shadow-2xs"
                : "bg-secondary-light text-secondary-dark hover:bg-sky-100 dark:bg-secondary-dark/30 dark:text-secondary-light"
            }`}
          >
            <Moon className="h-3 w-3" />
            <span>
              เวร ({activities.filter((a) => a.type === "shift").length})
            </span>
          </button>
          <button
            type="button"
            onClick={() => onFilterChange("service")}
            className={`flex items-center gap-1 rounded-full px-3 py-1.5 font-medium transition-all ${
              filterType === "service"
                ? "bg-primary text-white font-bold shadow-2xs"
                : "bg-primary-light text-primary-dark hover:bg-emerald-100 dark:bg-primary-dark/30 dark:text-primary-light"
            }`}
          >
            <Syringe className="h-3 w-3" />
            <span>
              บริการลูกค้า (
              {activities.filter((a) => a.type === "service").length})
            </span>
          </button>
        </div>

        {/* Sub-view Toggle: Card / Timeline */}
        <div className="flex items-center gap-0.5 rounded-lg border border-surface-subtle bg-surface-subtle/50 p-0.5 dark:border-zinc-700 dark:bg-zinc-800/50 shrink-0">
          <button
            type="button"
            onClick={() => setSubView("card")}
            className={`rounded-md p-1.5 transition-all ${
              subView === "card"
                ? "bg-white text-text-main shadow-xs dark:bg-zinc-700 dark:text-white"
                : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
            title="มุมมองการ์ด"
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setSubView("timeline")}
            className={`rounded-md p-1.5 transition-all ${
              subView === "timeline"
                ? "bg-white text-text-main shadow-xs dark:bg-zinc-700 dark:text-white"
                : "text-text-muted hover:text-text-main dark:text-zinc-400 dark:hover:text-zinc-200"
            }`}
            title="มุมมองไทม์ไลน์"
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* ─── Activities Content ─── */}
      {filteredActivities.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-surface-subtle bg-card-bg/60 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-subtle text-text-muted dark:bg-zinc-800 dark:text-zinc-500 mb-3">
            <CalendarDays className="h-6 w-6" />
          </div>
          <h3 className="font-semibold text-text-main dark:text-zinc-300">
            ยังไม่มีกิจกรรมในรายการนี้
          </h3>
          <p className="text-xs text-text-muted dark:text-zinc-400 mt-1 max-w-xs">
            แตะปุ่ม + ด้านล่างเพื่อเพิ่มการขึ้นเวร หรือนัดหมายบริการลูกค้า
          </p>
          <button
            type="button"
            onClick={() => {
              onOpenAddModal(new Date().toISOString().split("T")[0]);
            }}
            className="mt-4 flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-600 px-4 py-2 text-xs font-bold text-white shadow-xs hover:brightness-105"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>บันทึกงานใหม่</span>
          </button>
        </div>
      ) : subView === "card" ? (
        /* ─── CARD VIEW (original) ─── */
        <div className="space-y-6">
          {/* SECTION 1: Upcoming & Today */}
          {upcomingActivities.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-xs font-bold text-text-main dark:text-white uppercase tracking-wider">
                    วันนี้และเร็วๆ นี้
                  </h3>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                    {upcomingActivities.length} รายการ
                  </span>
                </div>
                <span className="text-[10px] text-text-muted dark:text-zinc-400">
                  เรียงจากวันที่ใกล้ที่สุด
                </span>
              </div>

              <div className="space-y-3">
                {upcomingActivities.map((item) => (
                  <ActivityCard
                    key={item.id}
                    item={item}
                    onDelete={() => onRequestDelete(item)}
                    onToggleStatus={() => {
                      if (item.type === "service") {
                        onToggleServiceStatus(item as CustomerServiceRecord);
                      }
                    }}
                    onSwapShift={(shift) => onInitiateSwap(shift)}
                    onViewTrail={(shift) => onViewTrail(shift)}
                    onUndoSwap={(shift) => onRequestUndoSwap(shift)}
                    onRestoreShift={(shift) => onRequestRestore(shift)}
                    onEditShift={onEditShift}
                    onEditService={onEditService}
                  />
                ))}
              </div>
            </div>
          )}

          {/* SECTION 2: Past Activities */}
          {pastActivities.length > 0 && (
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between px-1 border-t border-surface-subtle pt-3 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5 text-text-muted dark:text-zinc-400" />
                  <h3 className="text-xs font-bold text-text-muted dark:text-zinc-400 uppercase tracking-wider">
                    กิจกรรมที่ผ่านมาแล้ว
                  </h3>
                  <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-text-muted dark:bg-zinc-800 dark:text-zinc-400">
                    {pastActivities.length} รายการ
                  </span>
                </div>
                <span className="text-[10px] text-text-muted dark:text-zinc-400">
                  เรียงจากล่าสุดย้อนหลัง
                </span>
              </div>

              <div className="space-y-3">
                {pastActivities.map((item) => (
                  <ActivityCard
                    key={item.id}
                    item={item}
                    onDelete={() => onRequestDelete(item)}
                    onToggleStatus={() => {
                      if (item.type === "service") {
                        onToggleServiceStatus(item as CustomerServiceRecord);
                      }
                    }}
                    onSwapShift={(shift) => onInitiateSwap(shift)}
                    onViewTrail={(shift) => onViewTrail(shift)}
                    onUndoSwap={(shift) => onRequestUndoSwap(shift)}
                    onRestoreShift={(shift) => onRequestRestore(shift)}
                    onEditShift={onEditShift}
                    onEditService={onEditService}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        /* ─── TIMELINE VIEW (new) ─── */
        <div className="space-y-0">
          {/* SECTION 1: Upcoming & Today */}
          {upcomingTimelineGroups.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-1 pb-2">
                <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h3 className="text-xs font-bold text-text-main dark:text-white uppercase tracking-wider">
                  วันนี้และเร็วๆ นี้
                </h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300">
                  {upcomingActivities.length} รายการ
                </span>
              </div>
              {upcomingTimelineGroups.map((group) => {
                const m = moment(group.dateStr);
                const isToday = group.dateStr === todayStr;

                return (
                  <div
                    key={group.dateStr}
                    className="flex gap-3 border-b border-surface-subtle/70 last:border-b-0 dark:border-zinc-800/70"
                  >
                    {/* Left Column: Date */}
                    <div
                      className={`flex flex-col items-center justify-start pt-3 pb-3 w-16 shrink-0 ${
                        isToday ? "relative" : ""
                      }`}
                    >
                      {isToday && (
                        <div className="absolute inset-0 rounded-xl bg-secondary/10 dark:bg-secondary/20" />
                      )}
                      <span
                        className={`relative z-10 text-lg font-extrabold leading-none ${
                          isToday
                            ? "text-secondary dark:text-sky-400"
                            : "text-text-main dark:text-zinc-200"
                        }`}
                      >
                        {m.format("D")}
                      </span>
                      <span
                        className={`relative z-10 text-[10px] font-semibold mt-0.5 ${
                          isToday
                            ? "text-secondary dark:text-sky-400"
                            : "text-text-muted dark:text-zinc-400"
                        }`}
                      >
                        {m.locale("th").format("ddd")}
                      </span>
                      <span
                        className={`relative z-10 text-[9px] mt-0.5 ${
                          isToday
                            ? "text-secondary/80 dark:text-sky-400/80"
                            : "text-text-muted/60 dark:text-zinc-500"
                        }`}
                      >
                        {m.locale("th").format("MMM")}
                      </span>
                      {isToday && (
                        <span className="relative z-10 mt-1 rounded-sm bg-secondary px-1 py-px text-[8px] font-bold text-white leading-none">
                          วันนี้
                        </span>
                      )}
                    </div>

                    {/* Right Column: Events */}
                    <div className="flex-1 py-2.5 space-y-1.5 min-w-0">
                      {group.items.map((item) => (
                        <TimelineRow key={item.id} item={item} onEditShift={onEditShift} onEditService={onEditService} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* SECTION 2: Past Activities */}
          {pastTimelineGroups.length > 0 && (
            <>
              <div className="flex items-center gap-2 px-1 pt-3 pb-2 border-t border-surface-subtle dark:border-zinc-800">
                <Clock className="h-3.5 w-3.5 text-text-muted dark:text-zinc-400" />
                <h3 className="text-xs font-bold text-text-muted dark:text-zinc-400 uppercase tracking-wider">
                  กิจกรรมที่ผ่านมาแล้ว
                </h3>
                <span className="rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-text-muted dark:bg-zinc-800 dark:text-zinc-400">
                  {pastActivities.length} รายการ
                </span>
              </div>
              {pastTimelineGroups.map((group) => {
                const m = moment(group.dateStr);

                return (
                  <div
                    key={group.dateStr}
                    className="flex gap-3 border-b border-surface-subtle/70 last:border-b-0 dark:border-zinc-800/70 opacity-60"
                  >
                    {/* Left Column: Date */}
                    <div className="flex flex-col items-center justify-start pt-3 pb-3 w-16 shrink-0">
                      <span className="text-lg font-extrabold leading-none text-text-main dark:text-zinc-200">
                        {m.format("D")}
                      </span>
                      <span className="text-[10px] font-semibold mt-0.5 text-text-muted dark:text-zinc-400">
                        {m.locale("th").format("ddd")}
                      </span>
                      <span className="text-[9px] mt-0.5 text-text-muted/60 dark:text-zinc-500">
                        {m.locale("th").format("MMM")}
                      </span>
                    </div>

                    {/* Right Column: Events */}
                    <div className="flex-1 py-2.5 space-y-1.5 min-w-0">
                      {group.items.map((item) => (
                        <TimelineRow key={item.id} item={item} onEditShift={onEditShift} onEditService={onEditService} />
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Bottom Navigation Spacer - ensures all cards and action buttons scroll comfortably above BottomNav & FAB */}
      <div className="h-24 sm:h-28 pb-safe pointer-events-none" aria-hidden="true" />
    </div>
  );
}

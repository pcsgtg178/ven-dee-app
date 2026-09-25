"use client";

import moment from "moment";
import "moment/locale/th";
import {
  Moon,
  Sun,
  Sunset,
  Ambulance,
  MapPin,
  ArrowLeftRight,
  Lock,
  GitCommit,
  RotateCcw,
  Trash2,
  Clock,
  Syringe,
  Pencil,
  Building2,
  ScanSquare,
  Bed,
} from "lucide-react";
import { canEditShift, canEditService, canEditClinicLog } from "../../lib/storage";
import {
  ActivityItem,
  CustomerServiceRecord,
  ShiftRecord,
  ClinicWorkRecord,
  SHIFT_CONFIG,
  SHIFT_CATEGORY_CONFIG,
  SHIFT_CODE_MAP,
} from "../../types/vendee";

export interface ActivityCardProps {
  item: ActivityItem;
  hideDateHeader?: boolean;
  onDelete: () => void;
  onToggleStatus?: () => void;
  onSwapShift?: (shift: ShiftRecord) => void;
  onViewTrail?: (shift: ShiftRecord) => void;
  onUndoSwap?: (shift: ShiftRecord) => void;
  onRestoreShift?: (shift: ShiftRecord) => void;
  onEditShift?: (shift: ShiftRecord) => void;
  onEditService?: (service: CustomerServiceRecord) => void;
  onEditClinicLog?: (clinicLog: ClinicWorkRecord) => void;
}

export default function ActivityCard({
  item,
  hideDateHeader = false,
  onDelete,
  onSwapShift,
  onViewTrail,
  onUndoSwap,
  onRestoreShift,
  onEditShift,
  onEditService,
  onEditClinicLog,
}: ActivityCardProps) {
  // ─── CLINIC WORK LOG CARD ───
  if (item.type === "clinic") {
    const clinicLog = item as ClinicWorkRecord;
    const canEdit = canEditClinicLog(clinicLog);
    const todayStr = moment().format("YYYY-MM-DD");
    const isToday = clinicLog.date === todayStr;

    return (
      <div className="relative overflow-hidden rounded-2xl border border-purple-200 bg-card-bg p-3.5 shadow-xs transition-all hover:shadow-md dark:border-purple-900/60 dark:bg-zinc-900">
        {/* Purple color stripe left */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-600" />

        <div className="flex items-start justify-between gap-2 pl-2">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {!hideDateHeader && (
                <span className="text-xs font-bold text-text-main dark:text-white">
                  {moment(clinicLog.date).locale("th").format("ddd D MMM YYYY")}
                </span>
              )}
              {isToday && (
                <span className="rounded-md bg-purple-100 px-1.5 py-0.5 text-[10px] font-extrabold text-purple-800 dark:bg-purple-950/70 dark:text-purple-300">
                  วันนี้
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-lg bg-purple-100 px-2 py-0.5 text-[11px] font-bold text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                <Building2 className="h-3 w-3" />
                <span>กะคลินิก: {clinicLog.presetShift} น.</span>
              </span>
            </div>

            {clinicLog.note && (
              <div className="text-xs text-text-muted dark:text-zinc-400">
                <span>📝 {clinicLog.note}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canEdit && onEditClinicLog && (
              <button
                type="button"
                onClick={() => onEditClinicLog(clinicLog)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-purple-50 hover:text-purple-600 active:scale-95 dark:hover:bg-purple-950/40 dark:hover:text-purple-300 transition-all"
                title="แก้ไขงานคลินิก"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-shift-red active:scale-95 dark:hover:bg-rose-950/40 transition-colors"
              title="ลบบันทึกคลินิก"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── SHIFT RECORD CARD ───
  if (item.type === "shift") {
    const shift = item as ShiftRecord;
    const shiftInfo = SHIFT_CONFIG[shift.shiftType];
    const catInfo = SHIFT_CATEGORY_CONFIG[shift.category];
    const isSwapped = Boolean(shift.swapMeta);
    const isSwappedOut = shift.status === "swapped_out";
    const canEdit = canEditShift(shift);
    const code = SHIFT_CODE_MAP[shift.shiftType] || shift.shiftType;

    const ShiftIcon =
      shift.shiftType === "night"
        ? Moon
        : shift.shiftType === "morning"
          ? Sun
          : shift.shiftType === "afternoon"
            ? Sunset
            : shift.shiftType === "off"
              ? Bed
              : shift.shiftType === "ctm" || shift.shiftType === "cta"
                ? ScanSquare
                : Ambulance;

    const todayStr = moment().format("YYYY-MM-DD");
    const tomorrowStr = moment().add(1, "day").format("YYYY-MM-DD");
    const isToday = shift.date === todayStr;
    const isTomorrow = shift.date === tomorrowStr;

    return (
      <div
        className={`relative overflow-hidden rounded-2xl border p-3.5 shadow-xs transition-all hover:shadow-md ${
          isSwappedOut
            ? "border-surface-subtle bg-surface-subtle/50 opacity-60 dark:border-zinc-800 dark:bg-zinc-900/50"
            : isSwapped
              ? "border-secondary/30 bg-card-bg dark:border-secondary/40 dark:bg-zinc-900"
              : "border-surface-subtle bg-card-bg dark:border-zinc-800 dark:bg-zinc-900"
        }`}
      >
        {/* Color stripe left */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            shift.category === "green" || shift.shiftType === "r1" || shift.shiftType === "r2"
              ? "bg-emerald-600"
              : shift.category === "purple" || shift.shiftType === "ctm" || shift.shiftType === "cta"
                ? "bg-purple-600"
                : shift.category === "gray" || shift.shiftType === "off"
                  ? "bg-gray-500"
                  : shift.category === "red"
                    ? "bg-shift-red"
                    : "bg-secondary"
          }`}
        />

        <div className="flex items-start justify-between gap-2 pl-2">
          {/* Main Info */}
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              {!hideDateHeader && (
                <span className="text-xs font-bold text-text-main dark:text-white">
                  {moment(shift.date).locale("th").format("ddd D MMM YYYY")}
                </span>
              )}

              {isToday && !hideDateHeader && (
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 shadow-2xs">
                  วันนี้
                </span>
              )}
              {isTomorrow && !hideDateHeader && (
                <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950/70 dark:text-sky-300">
                  พรุ่งนี้
                </span>
              )}

              {/* Concise Shift Code Badge */}
              <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold bg-secondary-light text-secondary-dark dark:bg-secondary-dark/30 dark:text-secondary-light">
                <ShiftIcon className="h-3 w-3" />
                <span>[{code}] {shiftInfo.label} ({shiftInfo.period})</span>
              </span>

              {isSwappedOut && (
                <span className="rounded-md bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-text-muted dark:bg-zinc-800 dark:text-zinc-400">
                  แลกออกแล้ว
                </span>
              )}
            </div>

            {/* Department / Ward */}
            {shift.department && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted dark:text-zinc-400">
                <MapPin className="h-3.5 w-3.5 text-text-muted shrink-0" />
                <span>{shift.department}</span>
              </div>
            )}

            {/* Swap Details */}
            {isSwapped && shift.swapMeta && (
              <div className="rounded-xl bg-secondary-light/60 p-2 text-xs dark:bg-secondary-dark/20 border border-secondary/25 space-y-1">
                <div className="flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1.5 font-bold text-secondary-dark dark:text-secondary-light text-[11px]">
                    <ArrowLeftRight className="h-3.5 w-3.5 text-secondary shrink-0" />
                    <span>แลกกับ: <strong>{shift.swapMeta.swappedWith}</strong></span>
                  </div>
                  {onViewTrail && (
                    <button
                      type="button"
                      onClick={() => onViewTrail(shift)}
                      className="text-[10px] font-bold text-secondary hover:underline"
                    >
                      ประวัติ
                    </button>
                  )}
                </div>
              </div>
            )}

            {isSwappedOut && onRestoreShift && (
              <div className="pt-1 flex items-center justify-between">
                <span className="text-[10px] text-text-muted">แลกออกแล้ว</span>
                <button
                  type="button"
                  onClick={() => onRestoreShift(shift)}
                  className="rounded-lg bg-primary-light px-2 py-0.5 text-[10px] font-bold text-primary-dark"
                >
                  กู้คืน
                </button>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {canEdit && onEditShift && (
              <button
                type="button"
                onClick={() => onEditShift(shift)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-sky-50 hover:text-secondary active:scale-95 transition-all dark:hover:bg-zinc-800"
                title="แก้ไข"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-shift-red transition-colors dark:hover:bg-zinc-800"
              title="ลบ"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── CUSTOMER SERVICE CARD ───
  const service = item as CustomerServiceRecord;
  const canEdit = canEditService(service);

  return (
    <div className="relative overflow-hidden rounded-2xl border p-3.5 shadow-xs transition-all hover:shadow-md border-surface-subtle bg-card-bg dark:border-zinc-800 dark:bg-zinc-900">
      {/* Primary health green stripe */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />

      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="space-y-1.5 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {!hideDateHeader && (
              <span className="text-xs font-bold text-text-main dark:text-white">
                {moment(service.date).locale("th").format("ddd D MMM YYYY")}
              </span>
            )}
            <span className="flex items-center gap-1 rounded-md bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-text-main dark:bg-zinc-800 dark:text-zinc-200">
              <Clock className="h-3 w-3 text-primary" />
              {service.time} น.
            </span>
          </div>

          <div className="font-bold text-sm text-text-main dark:text-white">
            {service.customerName}
          </div>

          {/* Medications list */}
          {service.medications && service.medications.length > 0 && (
            <div className="rounded-xl bg-primary-light/35 p-2 text-xs text-primary-dark dark:bg-emerald-950/40 dark:text-emerald-200 border border-primary/20">
              <span className="font-bold flex items-center gap-1 text-[11px] text-primary-dark dark:text-emerald-300 mb-0.5">
                <Syringe className="h-3 w-3 text-primary" /> ยาที่ใช้:
              </span>
              <div className="text-[11px] font-medium text-text-main dark:text-zinc-200">
                {service.medications.join(", ")}
              </div>
            </div>
          )}

          {/* Note / Price */}
          {(service.note || service.price) && (
            <div className="flex items-center justify-between text-[11px] text-text-muted dark:text-zinc-400">
              {service.note && <span>📝 {service.note}</span>}
              {service.price && (
                <span className="font-bold text-primary-dark dark:text-primary-light">
                  ฿{service.price.toLocaleString()}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {canEdit && onEditService && (
            <button
              type="button"
              onClick={() => onEditService(service)}
              className="rounded-lg p-1.5 text-text-muted hover:bg-emerald-50 hover:text-primary active:scale-95 transition-all dark:hover:bg-zinc-800"
              title="แก้ไข"
            >
              <Pencil className="h-4 w-4" />
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-shift-red transition-colors dark:hover:bg-zinc-800"
            title="ลบ"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

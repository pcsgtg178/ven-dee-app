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
  RotateCcw,
  Trash2,
  Clock,
  Syringe,
  Pencil,
  Building2,
  ScanSquare,
  Bed,
} from "lucide-react";
import {
  canEditShift,
  canEditService,
  canEditClinicLog,
} from "../../lib/storage";
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

    return (
      <div className="relative overflow-hidden rounded-2xl border border-purple-200 bg-card-bg p-3.5 shadow-xs transition-all hover:shadow-md dark:border-purple-900/60 dark:bg-zinc-900">
        {/* Purple color stripe left */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-purple-600" />

        <div className="flex items-start justify-between gap-2 pl-2">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-purple-100 px-2.5 py-1 text-xs sm:text-sm font-bold text-purple-800 dark:bg-purple-950/60 dark:text-purple-300">
                <Building2 className="h-4 w-4" />
                <span>กะคลินิก: {clinicLog.presetShift} น.</span>
              </span>
            </div>

            {clinicLog.note && (
              <div className="text-xs text-text-muted dark:text-zinc-400 pl-1">
                <span>📝 {clinicLog.note}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {canEdit && onEditClinicLog && (
              <button
                type="button"
                onClick={() => onEditClinicLog(clinicLog)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-purple-50 hover:text-purple-600 active:scale-95 dark:hover:bg-purple-950/40 dark:hover:text-purple-300 transition-all cursor-pointer"
                title="แก้ไขงานคลินิก"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-shift-red active:scale-95 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
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
    const isSwapped = Boolean(shift.swapMeta);
    const isLocked = shift.swapMeta?.isLocked ?? false;
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
            shift.category === "green" ||
            shift.shiftType === "r1" ||
            shift.shiftType === "r2"
              ? "bg-emerald-600"
              : shift.category === "purple" ||
                  shift.shiftType === "ctm" ||
                  shift.shiftType === "cta"
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
          <div className="space-y-2.5 flex-1">
            {/* Enlarged Concise Shift Code Badge Header */}
            <div className="flex items-center gap-3">
              {/* Big Code Pill */}
              <span
                className={`flex h-11 min-w-[48px] items-center justify-center rounded-xl font-black text-xl sm:text-2xl shadow-xs px-2.5 ${
                  shift.category === "red"
                    ? "bg-shift-red text-white"
                    : shift.category === "green" ||
                        shift.shiftType === "r1" ||
                        shift.shiftType === "r2"
                      ? "bg-emerald-600 text-white"
                      : shift.category === "purple" ||
                          shift.shiftType === "ctm" ||
                          shift.shiftType === "cta"
                        ? "bg-purple-600 text-white"
                        : shift.category === "gray" || shift.shiftType === "off"
                          ? "bg-gray-600 text-white"
                          : "bg-shift-black text-white dark:bg-slate-100 dark:text-slate-900"
                }`}
              >
                {code}
              </span>

              {/* Shift Label & Time Period */}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-text-main dark:text-white leading-snug">
                  <ShiftIcon className="h-4 w-4 text-secondary shrink-0" />
                  <span>{shiftInfo?.label || "เวร"}</span>
                  {isSwappedOut && (
                    <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300">
                      แลกออกแล้ว
                    </span>
                  )}
                </div>
                <div className="text-xs text-text-muted dark:text-zinc-400 font-medium">
                  {shiftInfo?.period || "ทั้งวัน"}
                </div>
              </div>
            </div>

            {/* Department / Ward */}
            {shift.department && (
              <div className="flex items-center gap-1.5 text-xs text-text-muted dark:text-zinc-400 pl-1">
                <MapPin className="h-3.5 w-3.5 text-text-muted shrink-0" />
                <span>{shift.department}</span>
              </div>
            )}

            {/* Swap Details Box (ข้อความบอกแลกเวร) */}
            {isSwapped && shift.swapMeta && (
              <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 p-2.5 text-xs border border-sky-200 dark:border-sky-800/80 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 font-bold text-sky-900 dark:text-sky-200 text-xs">
                    <ArrowLeftRight className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                    <span>
                      🔄 แลกมาจาก:{" "}
                      <strong className="text-text-main dark:text-white font-extrabold">
                        {shift.swapMeta.swappedWith}
                      </strong>
                      {shift.swapMeta.originalOwner && (
                        <span className="ml-1 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
                          (เจ้าของเดิม: {shift.swapMeta.originalOwner})
                        </span>
                      )}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5">
                    {onViewTrail && (
                      <button
                        type="button"
                        onClick={() => onViewTrail(shift)}
                        className="text-[11px] font-bold text-secondary hover:underline cursor-pointer"
                      >
                        ประวัติ
                      </button>
                    )}
                    {onUndoSwap && (
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => !isLocked && onUndoSwap(shift)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${
                          isLocked
                            ? "cursor-not-allowed bg-surface-subtle text-text-muted opacity-60"
                            : "cursor-pointer bg-card-bg text-shift-red hover:bg-rose-50 border border-rose-200 dark:bg-zinc-800 dark:text-rose-400 dark:border-rose-900"
                        }`}
                        title={
                          isLocked
                            ? "ไม่สามารถยกเลิกได้เนื่องจากเวรผ่านเวลาไปแล้ว"
                            : "ยกเลิกการแลกเวรและคืนค่าเดิม"
                        }
                      >
                        {isLocked ? (
                          <Lock className="h-3 w-3" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span>ยกเลิกการแลก</span>
                      </button>
                    )}
                  </div>
                </div>

                {shift.swapMeta.swapReason && (
                  <p className="text-[11px] text-text-muted dark:text-zinc-300 pl-5">
                    📝 เหตุผล: {shift.swapMeta.swapReason}
                  </p>
                )}
              </div>
            )}

            {/* Shift Note */}
            {shift.note && (
              <div className="text-xs text-text-muted dark:text-zinc-400 pl-1">
                <span>📝 {shift.note}</span>
              </div>
            )}

            {/* Action: กู้คืนเวรที่แลกออกไปแล้ว */}
            {isSwappedOut && (
              <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs border border-amber-200 dark:border-amber-800/60 flex items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-amber-900 dark:text-amber-200">
                  ⚠️ เวรนี้ถูกแลกออกไปแล้ว
                </span>
                {onRestoreShift && (
                  <button
                    type="button"
                    onClick={() => onRestoreShift(shift)}
                    className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 active:scale-95 transition-all shadow-2xs cursor-pointer"
                  >
                    <RotateCcw className="h-3 w-3" />
                    <span>กู้คืนเวรนี้</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {!isSwappedOut && onSwapShift && (
              <button
                type="button"
                onClick={() => onSwapShift(shift)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-sky-50 hover:text-secondary active:scale-95 transition-all dark:hover:bg-zinc-800 cursor-pointer"
                title="แลกเวรนี้"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            )}
            {canEdit && onEditShift && (
              <button
                type="button"
                onClick={() => onEditShift(shift)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-sky-50 hover:text-secondary active:scale-95 transition-all dark:hover:bg-zinc-800 cursor-pointer"
                title="แก้ไข"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-shift-red transition-colors dark:hover:bg-zinc-800 cursor-pointer"
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

"use client";

import React from "react";
import moment from "moment";
import "moment/locale/th";
import {
  Moon,
  Sun,
  Sunset,
  Ambulance,
  ShieldCheck,
  Flame,
  MapPin,
  ArrowLeftRight,
  Lock,
  GitCommit,
  RotateCcw,
  Trash2,
  Clock,
  CheckCircle2,
  Phone,
  Syringe,
  Sparkles,
  Package,
  MoreHorizontal,
} from "lucide-react";
import {
  ActivityItem,
  CustomerServiceRecord,
  ShiftRecord,
  SHIFT_CONFIG,
  SHIFT_CATEGORY_CONFIG,
  SERVICE_CONFIG,
} from "../../types/vendee";

export interface ActivityCardProps {
  item: ActivityItem;
  onDelete: () => void;
  onToggleStatus?: () => void;
  onSwapShift?: (shift: ShiftRecord) => void;
  onViewTrail?: (shift: ShiftRecord) => void;
  onUndoSwap?: (shift: ShiftRecord) => void;
  onRestoreShift?: (shift: ShiftRecord) => void;
}

export default function ActivityCard({
  item,
  onDelete,
  onToggleStatus,
  onSwapShift,
  onViewTrail,
  onUndoSwap,
  onRestoreShift,
}: ActivityCardProps) {
  const isShift = item.type === "shift";

  if (isShift) {
    const shift = item as ShiftRecord;
    const shiftInfo = SHIFT_CONFIG[shift.shiftType];
    const catInfo = SHIFT_CATEGORY_CONFIG[shift.category];
    const isSwapped = Boolean(shift.swapMeta);
    const isLocked = shift.swapMeta?.isLocked ?? false;
    const isSwappedOut = shift.status === "swapped_out";

    const ShiftIcon =
      shift.shiftType === "night"
        ? Moon
        : shift.shiftType === "morning"
          ? Sun
          : shift.shiftType === "afternoon"
            ? Sunset
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
        {/* Color stripe left: Secondary sea blue for normal shift, Shift-red for OT, Emerald for Refer */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            shift.category === "green" || shift.shiftType === "r1" || shift.shiftType === "r2"
              ? "bg-emerald-600"
              : shift.category === "red"
                ? "bg-shift-red"
                : "bg-secondary"
          }`}
        />

        <div className="flex items-start justify-between gap-2 pl-2">
          {/* Main Info */}
          <div className="space-y-2 flex-1">
            {/* Header: Date + Today/Tomorrow Badge + Shift Type Badge + Black/Red/Green Badge */}
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-bold text-text-main dark:text-white">
                {moment(shift.date).locale("th").format("ddd D MMM YYYY")}
              </span>

              {isToday && (
                <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 shadow-2xs">
                  วันนี้
                </span>
              )}
              {isTomorrow && (
                <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950/70 dark:text-sky-300">
                  พรุ่งนี้
                </span>
              )}

              {/* Shift type badge (Secondary Sea Blue) */}
              <span className="inline-flex items-center gap-1 rounded-lg px-2 py-0.5 text-[11px] font-bold bg-secondary-light text-secondary-dark dark:bg-secondary-dark/30 dark:text-secondary-light">
                <ShiftIcon className="h-3 w-3" />
                {shiftInfo.label} ({shiftInfo.period})
              </span>

              {/* ป้ายกำกับประเภทเวร:
                  - เวรดำ (เวรประจำ): ป้ายสีเข้ม/ทึบ (shift-black: #1E293B)
                  - เวรแดง (OT/เวรช่วย): ป้ายสีกรอบแดง/สีแดงเด่นชัด (shift-red-badge: #FEE2E2)
                  - เวร R (Refer): ป้ายสีเขียว (bg-emerald-600) */}
              <span
                className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-0.5 text-[10px] font-bold ${
                  shift.category === "green" || shift.shiftType === "r1" || shift.shiftType === "r2"
                    ? "bg-emerald-600 text-white shadow-xs"
                    : catInfo.badge
                }`}
              >
                {shift.category === "green" || shift.shiftType === "r1" || shift.shiftType === "r2" ? (
                  <Ambulance className="h-3 w-3" />
                ) : shift.category === "black" ? (
                  <ShieldCheck className="h-3 w-3" />
                ) : (
                  <Flame className="h-3 w-3 text-shift-red" />
                )}
                <span>
                  {shift.category === "green" || shift.shiftType === "r1" || shift.shiftType === "r2"
                    ? "เวร R (สีเขียว)"
                    : `${catInfo.label} (${catInfo.subLabel})`}
                </span>
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

            {/* =========================================================
                สถานะการแลกเวรบนการ์ด (Swap Status Box)
                ========================================================= */}
            {isSwapped && shift.swapMeta && (
              <div className="rounded-xl bg-secondary-light/60 p-2.5 text-xs dark:bg-secondary-dark/20 border border-secondary/25 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-1">
                  {/* ไอคอน 🔄 พร้อมระบุ: แลกกับ [ชื่อคนแลก] (เวรเดิม: [ชื่อเจ้าของเดิม ถ้ามี]) */}
                  <div className="flex items-center gap-1.5 font-bold text-secondary-dark dark:text-secondary-light text-[11px]">
                    <ArrowLeftRight className="h-3.5 w-3.5 text-secondary shrink-0" />
                    <span>
                      แลกกับ:{" "}
                      <strong className="text-text-main dark:text-white">
                        {shift.swapMeta.swappedWith}
                      </strong>
                      {shift.swapMeta.originalOwner && (
                        <span className="ml-1 font-semibold text-primary dark:text-primary-light">
                          (เวรเดิม: {shift.swapMeta.originalOwner})
                        </span>
                      )}
                    </span>
                  </div>

                  {/* Lock Indicator */}
                  {isLocked && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-surface-subtle px-1.5 py-0.5 text-[10px] font-semibold text-text-muted dark:bg-zinc-800 dark:text-zinc-400">
                      <Lock className="h-2.5 w-2.5" /> ล็อกแล้ว
                    </span>
                  )}
                </div>

                {shift.swapMeta.swapReason && (
                  <p className="text-[11px] text-text-muted dark:text-zinc-400">
                    📝 {shift.swapMeta.swapReason}
                  </p>
                )}

                {/* Swap Actions: ดูลำดับการแลก (Swap Trail) & ยกเลิกการแลก (Undo) */}
                <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-secondary/20 dark:border-secondary-dark/40">
                  {/* ปุ่ม "ดูลำดับการแลก (Swap Trail)" */}
                  {onViewTrail &&
                    (shift.swapMeta.originalOwner ||
                      (shift.swapMeta.swapHistory &&
                        shift.swapMeta.swapHistory.length > 0)) && (
                      <button
                        type="button"
                        onClick={() => onViewTrail(shift)}
                        className="inline-flex items-center gap-1 rounded-lg bg-secondary px-2.5 py-1 text-[10px] font-bold text-white shadow-2xs hover:bg-secondary-dark active:scale-95 transition-all"
                      >
                        <GitCommit className="h-3 w-3" />
                        <span>ดูลำดับการแลก (Swap Trail)</span>
                      </button>
                    )}

                  {/* ระบบ Undo/Rollback */}
                  {onUndoSwap && (
                    <div className="relative group inline-block">
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => !isLocked && onUndoSwap(shift)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all ${
                          isLocked
                            ? "cursor-not-allowed bg-surface-subtle text-text-muted border border-surface-subtle dark:bg-zinc-800 dark:text-zinc-500"
                            : "cursor-pointer bg-card-bg text-shift-red border border-rose-200 hover:bg-shift-red-badge active:scale-95 shadow-2xs dark:bg-zinc-800 dark:text-rose-400 dark:border-rose-900"
                        }`}
                        title={
                          isLocked
                            ? "ไม่สามารถยกเลิกได้เนื่องจากเวรผ่านเวลาไปแล้ว"
                            : "ยกเลิกการแลกเวรและคืนค่าเดิม"
                        }
                      >
                        {isLocked ? (
                          <Lock className="h-2.5 w-2.5" />
                        ) : (
                          <RotateCcw className="h-2.5 w-2.5" />
                        )}
                        <span>ยกเลิกการแลก</span>
                      </button>

                      {isLocked && (
                        <div className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden w-48 rounded-lg bg-shift-black p-2 text-center text-[10px] text-white shadow-lg group-hover:block z-50">
                          ไม่สามารถยกเลิกได้เนื่องจากเวรผ่านเวลาไปแล้ว
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Note & Category description */}
            <div className="text-[11px] text-text-muted dark:text-zinc-400 space-y-0.5">
              {shift.note && !isSwapped && (
                <p className="font-medium text-text-main dark:text-zinc-300">
                  📝 {shift.note}
                </p>
              )}
              <p className="text-[10px] text-text-muted dark:text-zinc-500">
                *{catInfo.desc}
              </p>
            </div>

            {/* Action: ปุ่ม "แลกเวร" (เปิด Shift Swap Modal) */}
            {!isSwappedOut && onSwapShift && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => onSwapShift(shift)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-surface-subtle px-3 py-1.5 text-xs font-semibold text-secondary-dark hover:bg-secondary-light hover:text-secondary active:scale-95 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-secondary-dark/40 dark:hover:text-secondary-light transition-all shadow-2xs"
                >
                  <ArrowLeftRight className="h-3.5 w-3.5 text-secondary" />
                  <span>แลกเวรนี้</span>
                </button>
              </div>
            )}

            {/* Action: ปุ่ม "กู้คืนเวรนี้" เมื่อเวรถูกแลกออกไปแล้ว */}
            {isSwappedOut && onRestoreShift && (
              <div className="pt-2 flex items-center justify-between border-t border-surface-subtle dark:border-zinc-800">
                <span className="text-[11px] text-text-muted dark:text-zinc-400">
                  เวรนี้ถูกแลกออกไปแล้ว
                </span>
                <button
                  type="button"
                  onClick={() => onRestoreShift(shift)}
                  className="inline-flex items-center gap-1 rounded-xl bg-primary-light px-2.5 py-1 text-xs font-bold text-primary-dark hover:bg-emerald-100 dark:bg-primary-dark/40 dark:text-primary-light border border-primary/20 active:scale-95 transition-all shadow-2xs"
                >
                  <RotateCcw className="h-3 w-3" />
                  <span>กู้คืนเวรนี้</span>
                </button>
              </div>
            )}
          </div>

          {/* Delete Button */}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-shift-red dark:hover:bg-rose-950/40 transition-colors"
            title="ลบเวรนี้"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  /* Customer Service Card */
  const service = item as CustomerServiceRecord;
  const isCompleted = service.status === "completed";

  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-3.5 shadow-xs transition-all hover:shadow-md ${
        isCompleted
          ? "border-primary/40 bg-primary-light/15 dark:border-emerald-900/50 dark:bg-emerald-950/20"
          : "border-surface-subtle bg-card-bg dark:border-zinc-800 dark:bg-zinc-900"
      }`}
    >
      {/* Color stripe left: Primary health green */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-primary" />

      <div className="flex items-start justify-between gap-2 pl-2">
        <div className="space-y-2 flex-1">
          {/* Header: Date + Time + Status */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold text-text-main dark:text-white">
              {moment(service.date).locale("th").format("ddd D MMM YYYY")}
            </span>
            {(() => {
              const todayStr = moment().format("YYYY-MM-DD");
              const tomorrowStr = moment().add(1, "day").format("YYYY-MM-DD");
              if (service.date === todayStr) {
                return (
                  <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-extrabold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 shadow-2xs">
                    วันนี้
                  </span>
                );
              }
              if (service.date === tomorrowStr) {
                return (
                  <span className="rounded-md bg-sky-100 px-1.5 py-0.5 text-[10px] font-bold text-sky-800 dark:bg-sky-950/70 dark:text-sky-300">
                    พรุ่งนี้
                  </span>
                );
              }
              return null;
            })()}
            <span className="flex items-center gap-1 rounded-md bg-surface-subtle px-2 py-0.5 text-[11px] font-semibold text-text-main dark:bg-zinc-800 dark:text-zinc-200">
              <Clock className="h-3 w-3 text-primary" />
              {service.time} น.
            </span>
            <button
              type="button"
              onClick={onToggleStatus}
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold cursor-pointer transition-colors ${
                isCompleted
                  ? "bg-primary-light text-primary-dark dark:bg-emerald-950/80 dark:text-emerald-300"
                  : "bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-200"
              }`}
            >
              <CheckCircle2 className="h-3 w-3" />
              {isCompleted ? "เสร็จสิ้นแล้ว" : "รอดำเนินการ"}
            </button>
          </div>

          {/* Customer Name & Distinguishing Note Tag */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-bold text-sm text-text-main dark:text-white">
              {service.customerName}
            </span>
            {service.customerNote && (
              <span className="rounded-lg bg-primary-light/80 px-2 py-0.5 text-[10px] font-medium text-primary-dark dark:bg-primary-dark/30 dark:text-primary-light border border-primary/20">
                🏷️ {service.customerNote}
              </span>
            )}
            {/* Quick Call Button */}
            {service.customerPhone && service.customerPhone !== "-" && (
              <a
                href={`tel:${service.customerPhone}`}
                className="inline-flex items-center gap-1 rounded-full bg-surface-subtle px-2 py-0.5 text-[10px] font-semibold text-text-main hover:bg-primary-light hover:text-primary-dark dark:bg-zinc-800 dark:text-zinc-300 transition-colors"
                title={`โทร ${service.customerPhone}`}
              >
                <Phone className="h-2.5 w-2.5 text-primary" />
                <span>{service.customerPhone}</span>
              </a>
            )}
          </div>

          {/* Services Badges */}
          <div className="flex flex-wrap items-center gap-1">
            {service.services.map((srv) => {
              const conf = SERVICE_CONFIG[srv];
              return (
                <span
                  key={srv}
                  className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-bold ${conf.bg}`}
                >
                  {srv === "injection" && <Syringe className="h-3 w-3" />}
                  {srv === "drip" && <Sparkles className="h-3 w-3" />}
                  {srv === "delivery" && <Package className="h-3 w-3" />}
                  {srv === "other" && <MoreHorizontal className="h-3 w-3" />}
                  {conf.label}
                </span>
              );
            })}
            {service.otherServiceText && (
              <span className="text-[11px] text-text-muted">
                ({service.otherServiceText})
              </span>
            )}
          </div>

          {/* Medications (Dynamic List if Injection) */}
          {service.medications && service.medications.length > 0 && (
            <div className="rounded-xl bg-primary-light/35 p-2 text-xs text-primary-dark dark:bg-emerald-950/40 dark:text-emerald-200 border border-primary/20">
              <span className="font-bold flex items-center gap-1 text-[11px] text-primary-dark dark:text-emerald-300 mb-1">
                <Syringe className="h-3 w-3 text-primary" /> ตัวยาที่ใช้:
              </span>
              <ul className="list-inside list-disc space-y-0.5 text-[11px]">
                {service.medications.map((med, idx) => (
                  <li key={idx} className="font-medium">
                    {med}
                  </li>
                ))}
              </ul>
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

        {/* Delete */}
        <button
          type="button"
          onClick={onDelete}
          className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-shift-red dark:hover:bg-rose-950/40 transition-colors"
          title="ลบนัดหมายนี้"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
;

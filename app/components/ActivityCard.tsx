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
  Flame,
} from "lucide-react";
import {
  canEditShift,
  canEditService,
  canEditClinicLog,
  isShiftInPast,
  getShiftById,
} from "../../lib/storage";
import {
  ActivityItem,
  CustomerServiceRecord,
  ShiftRecord,
  ClinicWorkRecord,
  SHIFT_CONFIG,
  SHIFT_CODE_MAP,
} from "../../types/vendee";

import {
  PersonalEventRecord,
  RELATIONSHIP_CONFIG,
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
  onSellShift?: (shift: ShiftRecord) => void;
  onUndoSellShift?: (shift: ShiftRecord) => void;
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
  onSellShift,
  onUndoSellShift,
  onEditShift,
  onEditService,
  onEditClinicLog,
}: ActivityCardProps) {
  // ─── PERSONAL EVENT CARD (ธุระส่วนตัว) ───
  if (item.type === "personal_event") {
    const pEvent = item as PersonalEventRecord;
    const relConf = pEvent.relationshipTag ? (RELATIONSHIP_CONFIG[pEvent.relationshipTag] || RELATIONSHIP_CONFIG.other) : null;

    return (
      <div className="relative overflow-hidden rounded-2xl border border-rose-200 bg-card-bg p-3.5 shadow-xs transition-all hover:shadow-md dark:border-rose-900/60 dark:bg-zinc-900">
        {/* Rose color stripe left */}
        <div className="absolute left-0 top-0 bottom-0 w-1.5 bg-rose-500" />

        <div className="flex items-start justify-between gap-2 pl-2">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="inline-flex items-center gap-1.5 rounded-xl bg-rose-100 px-2.5 py-1 text-xs sm:text-sm font-bold text-rose-800 dark:bg-rose-950/60 dark:text-rose-300">
                <span>🎈 ธุระส่วนตัว: {pEvent.title}</span>
              </span>
              {relConf && (
                <span className={`rounded-xl px-2 py-0.5 text-[11px] font-semibold ${relConf.bg}`}>
                  {relConf.label}
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-3 text-xs text-text-muted dark:text-zinc-400">
              <div className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-rose-500" />
                <span>
                  {pEvent.isAllDay
                    ? "ไปทั้งวัน"
                    : `${pEvent.startTime || "18:00"} - ${pEvent.endTime || "21:00"} น.`}
                </span>
              </div>
              {pEvent.location && (
                <div className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5 text-rose-500" />
                  <span>{pEvent.location}</span>
                </div>
              )}
            </div>

            {pEvent.notes && (
              <div className="text-xs text-text-muted dark:text-zinc-400 pl-1">
                <span>📝 {pEvent.notes}</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-shift-red active:scale-95 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="ลบธุระส่วนตัว"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

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
    const isSwapped = Boolean(shift.swapMeta || shift.swap);
    const isLocked = (shift.swapMeta?.isLocked ?? false) || isShiftInPast(shift.date);
    const isSwappedOut = shift.status === "swapped_out";
    const isSoldOut = shift.status === "sold_out" || shift.status === "transferred";
    const isGivenAway = isSwappedOut || isSoldOut;
    const isOT = shift.category === "red";
    const isRefer =
      shift.shiftType === "r1" ||
      shift.shiftType === "r2" ||
      shift.category === "green";
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
          isGivenAway
            ? isOT
              ? "border-rose-200/80 bg-rose-50/20 opacity-70 dark:border-rose-900/40 dark:bg-rose-950/20"
              : isRefer
                ? "border-emerald-200/80 bg-emerald-50/20 opacity-70 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                : "border-surface-subtle bg-surface-subtle/50 opacity-70 dark:border-zinc-800 dark:bg-zinc-900/50"
            : isSwapped
              ? "border-secondary/30 bg-card-bg dark:border-secondary/40 dark:bg-zinc-900"
              : "border-surface-subtle bg-card-bg dark:border-zinc-800 dark:bg-zinc-900"
        }`}
      >
        {/* Color stripe left */}
        <div
          className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            isGivenAway ? "opacity-40" : ""
          } ${
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
                } ${
                  isGivenAway
                    ? "line-through decoration-white/90 decoration-[3px] opacity-60"
                    : ""
                }`}
              >
                {code}
              </span>

              {/* Shift Label & Time Period */}
              <div className="flex flex-col">
                <div className="flex items-center gap-1.5 text-sm sm:text-base font-bold text-text-main dark:text-white leading-snug">
                  <ShiftIcon className={`h-4 w-4 shrink-0 ${isGivenAway ? "text-text-muted" : "text-secondary"}`} />
                  <span className={isGivenAway ? "line-through text-text-muted dark:text-zinc-400" : ""}>
                    {shiftInfo?.label || "เวร"}
                  </span>
                  {isSwappedOut && (() => {
                    const swapInfo = shift.swap || shift.swapMeta;
                    const partner = swapInfo?.swappedWith;
                    return (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        แลกออกแล้ว{partner ? `: ${partner}` : ""}
                      </span>
                    );
                  })()}
                  {isSoldOut && (
                    <span className="rounded-md bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                      ยกให้: {shift.transferMeta?.recipientName || shift.saleMeta?.buyerName || "ผู้อื่น"}
                    </span>
                  )}
                  {shift.category === "red" && shift.receivedFrom && !isGivenAway && (
                    <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[10px] font-bold text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                      OT (รับจาก: {shift.receivedFrom})
                    </span>
                  )}
                  {/* กรณีเป็นเวรที่แลกคนอื่นมา (isSwapped is true && !isSwappedOut) ให้แสดงชื่อเจ้าของเวร */}
                  {isSwapped && !isSwappedOut && (() => {
                    const swapInfo = shift.swap || shift.swapMeta!;
                    const ownerName = swapInfo.originalOwner || swapInfo.swappedWith;
                    return (
                      <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 border border-amber-300 dark:border-amber-700">
                        {ownerName}
                      </span>
                    );
                  })()}


                </div>
                <div className={`text-xs text-text-muted dark:text-zinc-400 font-medium ${isGivenAway ? "line-through" : ""}`}>
                  {shiftInfo?.period || "ทั้งวัน"}
                </div>
              </div>
            </div>

            {/* Department / Ward */}
            {shift.department && (
              <div className={`flex items-center gap-1.5 text-xs text-text-muted dark:text-zinc-400 pl-1 ${isGivenAway ? "line-through" : ""}`}>
                <MapPin className="h-3.5 w-3.5 text-text-muted shrink-0" />
                <span>{shift.department}</span>
              </div>
            )}

            {/* Transferred Details Box */}
            {isSoldOut && (shift.transferMeta || shift.saleMeta) && (() => {
              const recipient = shift.transferMeta?.recipientName || shift.saleMeta?.buyerName || "ผู้อื่น";
              const transferredDate = shift.transferMeta?.transferredDate || shift.saleMeta?.soldDate;
              const note = shift.transferMeta?.note || shift.saleMeta?.note;

              return (
                <div
                  className={`rounded-xl p-2.5 text-xs border space-y-1.5 ${
                    isOT
                      ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800/80"
                      : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/80"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div
                      className={`flex items-center gap-1.5 font-bold text-xs ${
                        isOT
                          ? "text-rose-900 dark:text-rose-200"
                          : "text-emerald-900 dark:text-emerald-200"
                      }`}
                    >
                      {isOT ? (
                        <Flame className="h-4 w-4 text-rose-600 dark:text-rose-400 shrink-0" />
                      ) : (
                        <Ambulance className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                      )}
                      <span>
                        {isOT ? "ยกเวร OT ให้: " : "ยกเวร Refer ให้: "}
                        <strong className="text-text-main dark:text-white font-extrabold">
                          {recipient}
                        </strong>
                      </span>
                    </div>

                    {onUndoSellShift && (
                      <button
                        type="button"
                        disabled={isLocked}
                        onClick={() => !isLocked && onUndoSellShift(shift)}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-bold transition-all ${
                          isLocked
                            ? "cursor-not-allowed bg-surface-subtle text-text-muted opacity-60"
                            : "cursor-pointer bg-card-bg text-shift-red hover:bg-rose-50 border border-rose-200 dark:bg-zinc-800 dark:text-rose-400 dark:border-rose-900"
                        }`}
                        title={
                          isLocked
                            ? "ไม่สามารถยกเลิกได้เนื่องจากเวรผ่านเวลาไปแล้ว"
                            : "ยกเลิกการยกเวรและคืนสถานะเวรปกติ"
                        }
                      >
                        {isLocked ? (
                          <Lock className="h-3 w-3" />
                        ) : (
                          <RotateCcw className="h-3 w-3" />
                        )}
                        <span>ยกเลิกการยกเวร</span>
                      </button>
                    )}
                  </div>

                  {transferredDate && (
                    <div className="text-[11px] text-text-muted dark:text-zinc-400 pl-5">
                      ยกให้เมื่อ: {transferredDate}
                    </div>
                  )}

                  {note && (
                    <p className="text-[11px] text-text-muted dark:text-zinc-300 pl-5">
                      📝 {note}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Swap Details Box (ข้อความบอกแลกเวร สำหรับเวรที่ได้รับมาจากการแลก) */}
            {isSwapped && !isSwappedOut && (shift.swap || shift.swapMeta) && (() => {
              const swapInfo = shift.swap || shift.swapMeta!;
              const parentShiftId = shift.swap?.givenShiftId || shift.swapMeta?.parentShiftId;
              const parentShift = parentShiftId ? getShiftById(parentShiftId) : undefined;
              const rawGivenDate =
                parentShift?.date ||
                shift.swapMeta?.givenShiftDate ||
                (swapInfo.swapHistory && swapInfo.swapHistory.find((n) => n.date !== shift.date)?.date);
              const formattedGivenDate = rawGivenDate
                ? moment(rawGivenDate).locale("th").format("D MMMM YYYY")
                : null;
              const givenShiftLabel = parentShift?.shiftType
                ? SHIFT_CONFIG[parentShift.shiftType]?.label
                : shift.swapMeta?.givenShiftType
                  ? SHIFT_CONFIG[shift.swapMeta.givenShiftType]?.label
                  : undefined;
              const partnerName = swapInfo.originalOwner || swapInfo.swappedWith || "เพื่อนร่วมงาน";

              return (
                <div className="rounded-xl bg-sky-50 dark:bg-sky-950/40 p-2.5 text-xs border border-sky-200 dark:border-sky-800/80 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <div className="flex items-center gap-1.5 font-bold text-sky-900 dark:text-sky-200 text-xs">
                      <ArrowLeftRight className="h-4 w-4 text-sky-600 dark:text-sky-400 shrink-0" />
                      <span>
                        {formattedGivenDate ? (
                          <span>
                            แลกมาจาก วันที่ {formattedGivenDate}
                            {givenShiftLabel ? ` (${givenShiftLabel})` : ""}
                          </span>
                        ) : (
                          <span>
                            แลกมาจาก: {partnerName}
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

                  {swapInfo.swapReason && (
                    <p className="text-[11px] text-text-muted dark:text-zinc-300 pl-5">
                      📝 เหตุผล: {swapInfo.swapReason}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* Shift Note */}
            {shift.note && (
              <div className="text-xs text-text-muted dark:text-zinc-400 pl-1">
                <span>📝 {shift.note}</span>
              </div>
            )}

            {/* Action: กู้คืนเวรที่แลกออกไปแล้ว */}
            {isSwappedOut && (() => {
              const swapInfo = shift.swap || shift.swapMeta;
              const targetShiftId = shift.swap?.receivedShiftId;
              const targetShift = targetShiftId ? getShiftById(targetShiftId) : undefined;
              const rawTargetDate =
                targetShift?.date ||
                shift.swapMeta?.targetShiftDate ||
                (swapInfo?.swapHistory && swapInfo.swapHistory.find((n) => n.date !== shift.date)?.date);
              const formattedTargetDate = rawTargetDate
                ? moment(rawTargetDate).locale("th").format("D MMMM YYYY")
                : null;
              const targetShiftLabel = targetShift?.shiftType
                ? SHIFT_CONFIG[targetShift.shiftType]?.label
                : undefined;
              const partner = swapInfo?.swappedWith;

              return (
                <div className="rounded-xl bg-amber-50 dark:bg-amber-950/30 p-2.5 text-xs border border-amber-200 dark:border-amber-800/60 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 font-bold text-amber-900 dark:text-amber-200 text-xs">
                      <ArrowLeftRight className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                      <span>
                        ⚠️ เวรนี้ถูกแลกออกไปแล้ว{partner ? ` (ให้ ${partner})` : ""}
                        {formattedTargetDate && (
                          <span className="font-normal block sm:inline text-amber-800 dark:text-amber-300 sm:ml-1 text-[11px]">
                            • แลกเป็นเวรวันที่ {formattedTargetDate}
                            {targetShiftLabel ? ` (${targetShiftLabel})` : ""}
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
                      {(onUndoSwap || onRestoreShift) && (
                        <button
                          type="button"
                          disabled={isLocked}
                          onClick={() => {
                            if (isLocked) return;
                            if (onUndoSwap) {
                              onUndoSwap(shift);
                            } else if (onRestoreShift) {
                              onRestoreShift(shift);
                            }
                          }}
                          className={`inline-flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-bold transition-all shadow-2xs ${
                            isLocked
                              ? "cursor-not-allowed bg-slate-300 text-slate-500 dark:bg-zinc-800 dark:text-zinc-500 opacity-60"
                              : "cursor-pointer bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
                          }`}
                          title={
                            isLocked
                              ? "ไม่สามารถยกเลิกได้เนื่องจากเวรผ่านเวลาไปแล้ว"
                              : "กู้คืนเวรนี้และยกเลิกเวรที่ได้รับจากการแลก"
                          }
                        >
                          {isLocked ? <Lock className="h-3 w-3" /> : <RotateCcw className="h-3 w-3" />}
                          <span>{isLocked ? "เวรล็อกอยู่" : "กู้คืนเวร (ยกเลิกการแลก)"}</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {swapInfo?.swapReason && (
                    <p className="text-[11px] text-text-muted dark:text-zinc-300 pl-5">
                      📝 เหตุผล: {swapInfo.swapReason}
                    </p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* Action Button: ขายเวร (สำหรับเวร Refer หรือ OT ที่ active) */}
            {(isRefer || isOT) && !isGivenAway && onSellShift && (
              <button
                type="button"
                disabled={isLocked}
                onClick={() => !isLocked && onSellShift(shift)}
                className={`inline-flex items-center gap-1 rounded-xl px-2.5 py-1.5 text-xs font-bold transition-all shadow-2xs cursor-pointer ${
                  isLocked
                    ? "cursor-not-allowed bg-slate-200 text-slate-400 dark:bg-zinc-800 dark:text-zinc-500 opacity-60"
                    : isOT
                      ? "bg-shift-red text-white hover:bg-rose-700 active:scale-95"
                      : "bg-emerald-600 text-white hover:bg-emerald-700 active:scale-95"
                }`}
                title={isLocked ? "เวรล็อกอยู่" : isOT ? "ยกเวร OT นี้ให้คนอื่น" : "ยกเวร Refer นี้ให้คนอื่น"}
              >
                {isOT ? <Flame className="h-3.5 w-3.5" /> : <Ambulance className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">ยกให้คนอื่น</span>
                <span className="sm:hidden">ยกให้</span>
              </button>
            )}

            {!isGivenAway && onSwapShift && (
              <button
                type="button"
                onClick={() => onSwapShift(shift)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-sky-50 hover:text-secondary active:scale-95 transition-all dark:hover:bg-zinc-800 cursor-pointer"
                title="แลกเวรนี้"
              >
                <ArrowLeftRight className="h-4 w-4" />
              </button>
            )}

            {canEdit && !isGivenAway && onEditShift && (
              <button
                type="button"
                onClick={() => onEditShift(shift)}
                className="rounded-lg p-1.5 text-text-muted hover:bg-sky-50 hover:text-secondary active:scale-95 transition-all dark:hover:bg-zinc-800 cursor-pointer"
                title="แก้ไข"
              >
                <Pencil className="h-4 w-4" />
              </button>
            )}

            {!isGivenAway && (
              <button
                type="button"
                onClick={onDelete}
                className="rounded-lg p-1.5 text-text-muted hover:bg-rose-50 hover:text-shift-red transition-colors dark:hover:bg-zinc-800 cursor-pointer"
                title="ลบ"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
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
              {(service.time || "09:00").slice(0, 5)} น.
            </span>
          </div>

          <div className="font-bold text-sm text-text-main dark:text-white">
            {service.customerName}
          </div>

          <div className="flex items-center justify-between gap-2">
            {/* Medications list */}
            {service.medicationUsages && service.medicationUsages.filter(Boolean).length > 0 && (
              <div className="rounded-xl w-full bg-primary-light/35 p-2 text-xs text-primary-dark dark:bg-emerald-950/40 dark:text-emerald-200 border border-primary/20">
                <span className="font-bold flex items-center gap-1 text-[11px] text-primary-dark dark:text-emerald-300 mb-0.5">
                  <Syringe className="h-3 w-3 text-primary" /> ยาที่ใช้:
                </span>
                <div className="text-[11px] font-semibold text-emerald-900 dark:text-emerald-200">
                  {/* ยา (จำนวน/หน่วย) */}
                  {service.medicationUsages?.map((med, idx) => (
                    <div key={idx} className="flex items-center gap-1">
                      {med.name} ({med.quantity} {med.unit})
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Price */}
            {service.price !== undefined && service.price !== null && (
              <div className="flex items-center justify-between text-[11px] text-text-muted dark:text-zinc-400">
                <span className="font-bold text-primary-dark dark:text-primary-light">
                  {service.price === 0 ? (
                    "ยังไม่ได้กำหนดราคา"
                  ) : (
                    <span>฿{service.price.toLocaleString()}</span>
                  )}
                </span>
              </div>
            )}

          </div>

          {/* Note */}
          {service.note && (
            <div className="flex items-center justify-between text-[11px] text-text-muted dark:text-zinc-400">
              <span>📝 {service.note}</span>
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

"use client";

import React from "react";
import { X, ArrowRight, Calendar, GitCommit } from "lucide-react";
import { ShiftRecord } from "../../types/vendee";
import moment from "moment";
import "moment/locale/th";

interface ModalSwapTrailProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftRecord | null;
}

export default function ModalSwapTrail({
  isOpen,
  onClose,
  shift,
}: ModalSwapTrailProps) {
  if (!isOpen || !shift || !shift.swapMeta) return null;

  const { swapMeta } = shift;
  const history = swapMeta.swapHistory || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-50 w-full max-w-md rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-50 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400">
              <GitCommit className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white">
                ลำดับการแลกเวร (Swap Trail)
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-zinc-400">
                ประวัติเส้นทางการแลกเปลี่ยนเวรแบบต่อเนื่อง
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Current Shift Summary */}
        <div className="mt-3.5 rounded-2xl bg-slate-50 p-3 text-xs dark:bg-zinc-800/60 border border-slate-200/70 dark:border-zinc-700/60">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-800 dark:text-white">
              เวรปัจจุบันที่ถือครอง
            </span>
            <span className="rounded-md bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800 dark:bg-blue-950 dark:text-blue-300">
              {moment(shift.date).locale("th").format("D MMM YYYY")}
            </span>
          </div>
          <p className="mt-1 text-slate-600 dark:text-zinc-300">
            {shift.shiftType === "night" ? "เวรดึก" : shift.shiftType === "morning" ? "เวรเช้า" : "เวรบ่าย"} • {shift.department || "วอร์ดหลัก"}
          </p>
          <div className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
            แลกกับ: <strong className="text-slate-700 dark:text-zinc-200">{swapMeta.swappedWith}</strong>
            {swapMeta.originalOwner && (
              <> (เจ้าของเวรเดิม: <strong className="text-teal-600 dark:text-teal-400">{swapMeta.originalOwner}</strong>)</>
            )}
          </div>
        </div>

        {/* Timeline Sequence */}
        <div className="mt-4 space-y-4 py-1">
          <h3 className="text-xs font-bold text-slate-700 dark:text-zinc-300">
            เส้นทางการแลกเปลี่ยน (Timeline Steps)
          </h3>

          <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-blue-200 dark:before:bg-zinc-700">
            {history.length > 0 ? (
              history.map((node, index) => (
                <div key={node.id} className="relative space-y-1">
                  {/* Timeline Dot */}
                  <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                    <span className="text-[10px] font-bold">{index + 1}</span>
                  </div>

                  <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-850">
                    <div className="flex items-center justify-between text-[11px] text-slate-500 dark:text-zinc-400 mb-1">
                      <span className="flex items-center gap-1 font-semibold text-blue-600 dark:text-blue-400">
                        <Calendar className="h-3 w-3" />
                        {moment(node.date).locale("th").format("D MMM YYYY")}
                      </span>
                      <span>{node.shiftLabel}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                      <span className="truncate">{node.fromPerson}</span>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                      <span className="truncate text-teal-600 dark:text-teal-400">{node.toPerson}</span>
                    </div>

                    {node.note && (
                      <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                        📝 {node.note}
                      </p>
                    )}
                  </div>
                </div>
              ))
            ) : (
              // Default fallback single step if history array is empty
              <div className="relative space-y-1">
                <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-600 text-white shadow-xs">
                  <span className="text-[10px] font-bold">1</span>
                </div>
                <div className="rounded-xl border border-slate-200/80 bg-white p-2.5 shadow-2xs dark:border-zinc-800 dark:bg-zinc-850">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800 dark:text-white">
                    <span>{swapMeta.originalOwner || swapMeta.swappedWith}</span>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-teal-600 dark:text-teal-400">ฉัน (คุณ)</span>
                  </div>
                  <p className="mt-1 text-[11px] text-slate-500 dark:text-zinc-400">
                    แลกเปลี่ยนเวรโดยตรง
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer Button */}
        <div className="mt-4 border-t border-slate-100 pt-3 dark:border-zinc-800 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-slate-100 px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 dark:bg-zinc-800 dark:text-zinc-200 transition-colors"
          >
            ปิดหน้าต่าง
          </button>
        </div>
      </div>
    </div>
  );
}

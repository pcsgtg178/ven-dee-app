"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Calendar,
  Clock,
  Moon,
  Sun,
  Sunset,
  Ambulance,
  Check,
  AlertCircle,
  ShieldCheck,
  Flame,
  FileText,
  MapPin,
} from "lucide-react";
import { ShiftCategory, ShiftRecord, ShiftType, SHIFT_CONFIG, SHIFT_CATEGORY_CONFIG } from "../../types/vendee";
import { saveShift } from "../../lib/storage";

interface ModalEditShiftProps {
  shift: ShiftRecord | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (updated: ShiftRecord) => void;
}

export default function ModalEditShift({
  shift,
  isOpen,
  onClose,
  onSuccess,
}: ModalEditShiftProps) {
  const [shiftDate, setShiftDate] = useState("");
  const [shiftType, setShiftType] = useState<ShiftType>("morning");
  const [shiftCategory, setShiftCategory] = useState<ShiftCategory>("black");
  const [shiftDepartment, setShiftDepartment] = useState("");
  const [shiftNote, setShiftNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (shift && isOpen) {
      setShiftDate(shift.date || "");
      setShiftType(shift.shiftType || "morning");
      setShiftCategory(shift.category || "black");
      setShiftDepartment(shift.department || "");
      setShiftNote(shift.note || "");
      setErrorMsg("");
    }
  }, [shift, isOpen]);

  if (!isOpen || !shift) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!shiftDate) {
      setErrorMsg("กรุณาเลือกวันที่ขึ้นเวร");
      return;
    }

    const categoryToSave: ShiftCategory =
      shiftType === "r1" || shiftType === "r2" ? "green" : shiftCategory;

    try {
      const updated = await saveShift({
        id: shift.id,
        date: shiftDate,
        shiftType,
        category: categoryToSave,
        department: shiftDepartment.trim() || undefined,
        note: shiftNote.trim() || undefined,
        status: shift.status,
        createdAt: shift.createdAt,
        swapMeta: shift.swapMeta,
      });

      if (onSuccess) onSuccess(updated);
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการแก้ไขเวร");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-card-bg p-5 sm:p-6 shadow-2xl border border-surface-subtle dark:bg-zinc-900 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-subtle pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-secondary-light text-secondary dark:bg-sky-950/60 dark:text-sky-300">
              <Calendar className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main dark:text-white">
                แก้ไขตารางเวร
              </h2>
              <p className="text-[11px] text-text-muted dark:text-zinc-400">
                รหัสเวร: {shift.id}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-main dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Shift Date */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <Calendar className="h-3.5 w-3.5 text-secondary" />
              <span>วันที่ขึ้นเวร <strong className="text-rose-500">*</strong></span>
            </label>
            <input
              type="date"
              required
              value={shiftDate}
              onChange={(e) => setShiftDate(e.target.value)}
              className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3.5 py-2.5 text-sm text-text-main outline-none focus:border-secondary focus:ring-2 focus:ring-secondary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
            />
          </div>

          {/* Shift Period (Morning, Afternoon, Night, Refer) */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <Clock className="h-3.5 w-3.5 text-secondary" />
              <span>ช่วงเวลาเวร (Shift Period)</span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setShiftType("morning")}
                className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition-all ${
                  shiftType === "morning"
                    ? "border-amber-400 bg-amber-50 text-amber-900 ring-2 ring-amber-400/40 dark:bg-amber-950/50 dark:text-amber-200 dark:border-amber-500"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-amber-300 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                }`}
              >
                <Sun className="h-5 w-5 text-amber-500 mb-1" />
                <span className="text-xs font-bold">เวรเช้า</span>
                <span className="text-[10px] text-text-muted dark:text-zinc-400">08:00 - 16:00</span>
              </button>

              <button
                type="button"
                onClick={() => setShiftType("afternoon")}
                className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition-all ${
                  shiftType === "afternoon"
                    ? "border-sky-400 bg-sky-50 text-sky-900 ring-2 ring-sky-400/40 dark:bg-sky-950/50 dark:text-sky-200 dark:border-sky-500"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-sky-300 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                }`}
              >
                <Sunset className="h-5 w-5 text-sky-500 mb-1" />
                <span className="text-xs font-bold">เวรบ่าย</span>
                <span className="text-[10px] text-text-muted dark:text-zinc-400">16:00 - 00:00</span>
              </button>

              <button
                type="button"
                onClick={() => setShiftType("night")}
                className={`flex flex-col items-center justify-center rounded-2xl border p-2.5 text-center transition-all ${
                  shiftType === "night"
                    ? "border-indigo-400 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-400/40 dark:bg-indigo-950/50 dark:text-indigo-200 dark:border-indigo-500"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-indigo-300 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                }`}
              >
                <Moon className="h-5 w-5 text-indigo-500 mb-1" />
                <span className="text-xs font-bold">เวรดึก</span>
                <span className="text-[10px] text-text-muted dark:text-zinc-400">00:00 - 08:00</span>
              </button>
            </div>

            {/* Refer, Off, CT Shifts */}
            <div className="grid grid-cols-3 gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShiftType("r1")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all ${
                  shiftType === "r1"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/40 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-500"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-emerald-300 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                }`}
              >
                <Ambulance className="h-3.5 w-3.5 text-emerald-600" />
                <span>R1</span>
              </button>

              <button
                type="button"
                onClick={() => setShiftType("r2")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all ${
                  shiftType === "r2"
                    ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/40 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-500"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-emerald-300 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                }`}
              >
                <Ambulance className="h-3.5 w-3.5 text-emerald-600" />
                <span>R2</span>
              </button>

              <button
                type="button"
                onClick={() => setShiftType("off")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all ${
                  shiftType === "off"
                    ? "border-slate-800 bg-slate-100 text-slate-900 ring-2 ring-slate-400 dark:bg-zinc-800 dark:text-white"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-slate-400 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                }`}
              >
                <span>Off (0)</span>
              </button>

              <button
                type="button"
                onClick={() => setShiftType("ctm")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all ${
                  shiftType === "ctm"
                    ? "border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-400/40 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-500"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-purple-300 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                }`}
              >
                <span>CTM</span>
              </button>

              <button
                type="button"
                onClick={() => setShiftType("cta")}
                className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all col-span-2 ${
                  shiftType === "cta"
                    ? "border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-400/40 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-500"
                    : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-purple-300 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                }`}
              >
                <span>CTA</span>
              </button>
            </div>
          </div>

          {/* Shift Category (Black vs Red OT) */}
          {shiftType !== "r1" && shiftType !== "r2" && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-text-main dark:text-zinc-200">
                ประเภทเวร (Category)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setShiftCategory("black")}
                  className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all ${
                    shiftCategory === "black"
                      ? "border-shift-black bg-slate-100 ring-2 ring-slate-400/40 dark:bg-zinc-800 dark:border-zinc-600"
                      : "border-surface-subtle bg-surface-subtle/30 dark:border-zinc-800 dark:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-shift-black text-white dark:bg-slate-200 dark:text-slate-900">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-text-main dark:text-white">
                      เวรดำ
                    </div>
                    <div className="text-[10px] text-text-muted dark:text-zinc-400">
                      เวรหลักในโควต้า
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setShiftCategory("red")}
                  className={`flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-all ${
                    shiftCategory === "red"
                      ? "border-shift-red bg-rose-50 ring-2 ring-rose-400/40 dark:bg-rose-950/40 dark:border-rose-700"
                      : "border-surface-subtle bg-surface-subtle/30 dark:border-zinc-800 dark:bg-zinc-800/40"
                  }`}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-shift-red text-white">
                    <Flame className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-shift-red-text dark:text-rose-300">
                      เวรแดง (OT)
                    </div>
                    <div className="text-[10px] text-rose-600/80 dark:text-rose-400/80">
                      เวรนอก/ขึ้นเสริม
                    </div>
                  </div>
                </button>
              </div>
            </div>
          )}

          {/* Department */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <MapPin className="h-3.5 w-3.5 text-secondary" />
              <span>วอร์ด / แผนกที่ขึ้นเวร (ไม่บังคับ)</span>
            </label>
            <input
              type="text"
              value={shiftDepartment}
              onChange={(e) => setShiftDepartment(e.target.value)}
              placeholder="เช่น วอร์ด ICU, แผนก ER, ตึกผู้ป่วยใน 6"
              className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3.5 py-2.5 text-sm text-text-main outline-none focus:border-secondary focus:ring-2 focus:ring-secondary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
            />
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <FileText className="h-3.5 w-3.5 text-secondary" />
              <span>บันทึกเพิ่มเติม (Note)</span>
            </label>
            <textarea
              rows={2}
              value={shiftNote}
              onChange={(e) => setShiftNote(e.target.value)}
              placeholder="บันทึกข้อความช่วยจำ เช่น ส่งต่อเวร หรือ รายละเอียดเคส"
              className="w-full rounded-xl border border-surface-subtle bg-surface-subtle/40 px-3.5 py-2 text-sm text-text-main outline-none focus:border-secondary focus:ring-2 focus:ring-secondary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 pt-2 border-t border-surface-subtle dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-surface-subtle bg-surface-subtle py-2.5 text-xs font-bold text-text-main hover:bg-slate-200 active:scale-95 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 transition-all"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-600 py-2.5 text-xs font-bold text-white shadow-xs hover:brightness-105 active:scale-95 transition-all"
            >
              <Check className="h-4 w-4" />
              <span>บันทึกการแก้ไขเวร</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

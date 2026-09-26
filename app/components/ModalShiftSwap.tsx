"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  ArrowLeftRight,
  AlertTriangle,
  Calendar,
  User,
  Moon,
  Sun,
  Sunset,
  Ambulance,
  Check,
} from "lucide-react";
import {
  ShiftRecord,
  ShiftCategory,
  ShiftType,
  SHIFT_CONFIG,
  SHIFT_CATEGORY_CONFIG,
} from "../../types/vendee";
import { swapShift, getMonthlyBlackShiftStats } from "../../lib/storage";
import moment from "moment";
import "moment/locale/th";
import ModalConfirmAction from "./ModalConfirmAction";

interface ModalShiftSwapProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftRecord | null;
  onSuccess?: () => void;
}

export default function ModalShiftSwap({
  isOpen,
  onClose,
  shift,
  onSuccess,
}: ModalShiftSwapProps) {
  // Form fields
  const [swappedWith, setSwappedWith] = useState("");
  const [isTopUp, setIsTopUp] = useState(false);
  const [originalOwner, setOriginalOwner] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newShiftType, setNewShiftType] = useState<ShiftType>("morning");
  const [newCategory, setNewCategory] = useState<ShiftCategory>("black");
  const [swapReason, setSwapReason] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Initialize form when opened
  useEffect(() => {
    if (isOpen && shift) {
      setSwappedWith("");
      setIsTopUp(false);
      setOriginalOwner("");
      setShowConfirmModal(false);
      // Default new date: next day or same date
      const nextDay = moment(shift.date).add(1, "day").format("YYYY-MM-DD");
      setNewDate(nextDay);
      setNewShiftType(shift.shiftType === "night" ? "morning" : "night");
      setNewCategory("black");
      setSwapReason("");
      setErrorMsg("");
    }
  }, [isOpen, shift]);

  // Quota simulation: Check if swapping black -> red will make monthly black quota < quota
  const quotaWarning = useMemo(() => {
    if (!shift || !newDate) return null;

    // Check if the current shift is black
    const isCurrentBlack = shift.category === "black";
    // Check if the new shift is red
    const isNewRed = newCategory === "red";

    if (!isCurrentBlack || !isNewRed) {
      return null;
    }

    // Shift's month e.g. "2026-09"
    const shiftMonth = shift.date.substring(0, 7);
    const stats = getMonthlyBlackShiftStats(shiftMonth);

    // If current shift was black, removing it reduces black count by 1 (since new shift is red)
    const simulatedBlackCount = stats.blackCount - 1;
    const quota = stats.quota;

    if (simulatedBlackCount < quota) {
      const remainingNeeded = quota - simulatedBlackCount;
      return {
        currentCount: stats.blackCount,
        simulatedCount: simulatedBlackCount,
        quota,
        remainingNeeded,
        monthName: moment(shift.date).locale("th").format("MMMM YYYY"),
      };
    }

    return null;
  }, [shift, newCategory, newDate]);

  if (!isOpen || !shift) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!swappedWith.trim()) {
      setErrorMsg("กรุณาระบุคนที่ตกลงแลกด้วย");
      return;
    }
    if (isTopUp && !originalOwner.trim()) {
      setErrorMsg("กรุณาระบุเจ้าของเวรเดิมตามตาราง");
      return;
    }
    if (!newDate) {
      setErrorMsg("กรุณาระบุวันที่เวรใหม่ที่ได้รับ");
      return;
    }

    // Clear error and open confirmation modal
    setErrorMsg("");
    setShowConfirmModal(true);
  };

  const handleExecuteSwap = () => {
    if (!shift) return;

    const categoryToSave: ShiftCategory =
      newShiftType === "r1" || newShiftType === "r2" ? "green" : newCategory;

    try {
      swapShift({
        shiftId: shift.id,
        swappedWith: swappedWith.trim(),
        originalOwner: isTopUp ? originalOwner.trim() : undefined,
        newDate,
        newShiftType,
        newCategory: categoryToSave,
        swapReason: swapReason.trim() || undefined,
      });

      setShowConfirmModal(false);
      onClose();
      if (onSuccess) onSuccess();
    } catch (err: any) {
      setShowConfirmModal(false);
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการแลกเวร");
    }
  };

  const shiftInfo = SHIFT_CONFIG[shift.shiftType];
  const catInfo = SHIFT_CATEGORY_CONFIG[shift.category];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
        onClick={onClose}
      />

      {/* Modal Card */}
      <div className="relative z-50 flex max-h-[92vh] w-full max-w-lg flex-col rounded-3xl bg-white shadow-2xl transition-all dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-sky-500 to-emerald-600 text-white shadow-xs">
              <ArrowLeftRight className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-text-main dark:text-white">
                บันทึกการแลกเวร (Shift Swap)
              </h2>
              <p className="text-[11px] text-text-muted dark:text-zinc-400">
                แลกเปลี่ยนเวรและบันทึกประวัติการส่งต่อ
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

        {/* Scrollable Form Content */}
        <form
          id="shift-swap-form"
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto px-5 py-4 space-y-4"
        >
          {/* Error Message */}
          {errorMsg && (
            <div className="rounded-xl bg-rose-50 p-2.5 text-xs text-rose-700 dark:bg-rose-950/50 dark:text-rose-300 border border-rose-200">
              {errorMsg}
            </div>
          )}

          {/* Current Shift being swapped out */}
          <div className="rounded-2xl border border-blue-200/80 bg-blue-50/50 p-3.5 dark:border-blue-900/50 dark:bg-blue-950/30">
            <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300 flex items-center gap-1.5 mb-1.5">
              <span>เวรเดิมที่จะนำไปแลกออก:</span>
            </span>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900 dark:text-white">
                  {moment(shift.date)
                    .locale("th")
                    .format("ddddที่ D MMMM YYYY")}
                </p>
                <p className="text-xs text-slate-600 dark:text-zinc-300 mt-0.5">
                  {shiftInfo.label} ({shiftInfo.period}) •{" "}
                  {shift.department || "วอร์ดหลัก"}
                </p>
              </div>
              <span
                className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] ${catInfo.badge}`}
              >
                {catInfo.label}
              </span>
            </div>
          </div>

          {/* Field 1: คนที่ตกลงแลกด้วย (Direct Partner) [Required] */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              คนที่ตกลงแลกด้วย (Direct Partner){" "}
              <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type="text"
                required
                placeholder="เช่น พว.สมใจ อิ่มเอม, พว.ก้อย"
                value={swappedWith}
                onChange={(e) => setSwappedWith(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <User className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
            </div>
          </div>

          {/* Field 2: Checkbox "เวรนี้รับต่อมาจากผู้อื่น" */}
          <div className="rounded-2xl border border-slate-200 p-3.5 dark:border-zinc-800 bg-slate-50/30 dark:bg-zinc-850/40">
            <label className="flex items-center gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={isTopUp}
                onChange={(e) => setIsTopUp(e.target.checked)}
                className="h-4 w-4 rounded text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-bold text-slate-800 dark:text-white">
                เวรนี้รับต่อมาจากผู้อื่น (แลกต่อยอด / Top-up)
              </span>
            </label>

            {/* If checked: แสดงช่องกรอก "เจ้าของเวรเดิมตามตาราง" (Original Owner) */}
            {isTopUp && (
              <div className="mt-3 pt-2.5 border-t border-slate-200/80 dark:border-zinc-700/80 animate-in fade-in duration-150">
                <label className="block text-xs font-semibold text-teal-800 dark:text-teal-300 mb-1">
                  เจ้าของเวรเดิมตามตาราง (Original Owner){" "}
                  <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required={isTopUp}
                  placeholder="เช่น พว.วิภา มณีรัตน์ (เจ้าของเวรตามตารางต้นฉบับ)"
                  value={originalOwner}
                  onChange={(e) => setOriginalOwner(e.target.value)}
                  className="w-full rounded-xl border border-teal-300 bg-white px-3.5 py-2 text-xs sm:text-sm text-slate-800 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 dark:border-teal-700 dark:bg-zinc-800 dark:text-white"
                />
                <p className="mt-1 text-[10px] text-slate-500 dark:text-zinc-400">
                  *ระบุชื่อเจ้าของเวรดั้งเดิมตามตารางเวรหลักเพื่อสร้างประวัติ
                  Swap Trail
                </p>
              </div>
            )}
          </div>

          {/* Field 3: วันที่และประเภทเวรใหม่ที่ได้รับ */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                วันที่ของเวรใหม่ที่ได้รับ{" "}
                <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type="date"
                  required
                  value={newDate}
                  onChange={(e) => setNewDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                />
                <Calendar className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-slate-400" />
              </div>
            </div>

            {/* ช่วงเวลาเวรใหม่ */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                ประเภทเวรใหม่ที่ได้รับ <span className="text-rose-500">*</span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setNewShiftType("night")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all ${
                    newShiftType === "night"
                      ? "border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-200"
                      : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                  }`}
                >
                  <Moon className="h-4 w-4 mb-1 text-indigo-600 dark:text-indigo-400" />
                  <span className="text-xs font-bold">เวรดึก</span>
                  <span className="text-[10px] opacity-70">00:00 - 08:00</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewShiftType("morning")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all ${
                    newShiftType === "morning"
                      ? "border-amber-500 bg-amber-50 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200"
                      : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                  }`}
                >
                  <Sun className="h-4 w-4 mb-1 text-amber-500 dark:text-amber-400" />
                  <span className="text-xs font-bold">เวรเช้า</span>
                  <span className="text-[10px] opacity-70">08:00 - 16:00</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewShiftType("afternoon")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded-xl border-2 transition-all ${
                    newShiftType === "afternoon"
                      ? "border-sky-600 bg-sky-50 text-sky-900 dark:bg-sky-950/60 dark:text-sky-200"
                      : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                  }`}
                >
                  <Sunset className="h-4 w-4 mb-1 text-sky-600 dark:text-sky-400" />
                  <span className="text-xs font-bold">เวรบ่าย</span>
                  <span className="text-[10px] opacity-70">16:00 - 00:00</span>
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNewShiftType("r1")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all ${
                    newShiftType === "r1"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/40 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-500"
                      : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-emerald-300 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                  }`}
                >
                  <Ambulance className="h-3.5 w-3.5 text-emerald-600" />
                  <span>R1</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewShiftType("r2")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all ${
                    newShiftType === "r2"
                      ? "border-emerald-500 bg-emerald-50 text-emerald-900 ring-2 ring-emerald-400/40 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-500"
                      : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-emerald-300 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                  }`}
                >
                  <Ambulance className="h-3.5 w-3.5 text-emerald-600" />
                  <span>R2</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewShiftType("off")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all ${
                    newShiftType === "off"
                      ? "border-slate-800 bg-slate-100 text-slate-900 ring-2 ring-slate-400 dark:bg-zinc-800 dark:text-white"
                      : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-slate-400 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                  }`}
                >
                  <span>Off (0)</span>
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setNewShiftType("ctm")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all ${
                    newShiftType === "ctm"
                      ? "border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-400/40 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-500"
                      : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-purple-300 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                  }`}
                >
                  <span>CT เช้า</span>
                </button>

                <button
                  type="button"
                  onClick={() => setNewShiftType("cta")}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border p-2 text-xs font-bold transition-all ${
                    newShiftType === "cta"
                      ? "border-purple-500 bg-purple-50 text-purple-900 ring-2 ring-purple-400/40 dark:bg-purple-950/50 dark:text-purple-200 dark:border-purple-500"
                      : "border-surface-subtle bg-surface-subtle/30 text-text-muted hover:border-purple-300 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-400"
                  }`}
                >
                  <span>CT บ่าย</span>
                </button>
              </div>
            </div>

            {/* หมวดเวรใหม่: เวรดำ vs เวรแดง (ไม่ต้องเลือกกรณีเวร R เพราะเวร R ให้ใช้สีเขียว) */}
            {(newShiftType === "morning" ||
              newShiftType === "afternoon" ||
              newShiftType === "night") && (
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
                  หมวดเวรใหม่ที่ได้รับ <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCategory("black")}
                    className={`flex flex-col items-start p-2.5 rounded-xl border-2 text-left transition-all ${
                      newCategory === "black"
                        ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-zinc-800"
                        : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-slate-400" />
                      เวรดำ (เวรประจำ)
                    </span>
                    <span className="text-[10px] opacity-80 mt-0.5">
                      นับรวมในโควต้าเวรประจำ
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewCategory("red")}
                    className={`flex flex-col items-start p-2.5 rounded-xl border-2 text-left transition-all ${
                      newCategory === "red"
                        ? "border-rose-600 bg-rose-50 text-rose-950 dark:border-rose-500 dark:bg-rose-950/60 dark:text-rose-100"
                        : "border-slate-200 bg-white text-slate-700 dark:border-zinc-800 dark:bg-zinc-850 dark:text-zinc-300"
                    }`}
                  >
                    <span className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                      <span className="h-2 w-2 rounded-full bg-rose-600" />
                      เวรแดง (OT/เวรช่วย)
                    </span>
                    <span className="text-[10px] text-rose-700 dark:text-rose-300 mt-0.5">
                      เวร OT ได้รับค่าตอบแทน
                    </span>
                  </button>
                </div>
              </div>
            )}

            {/* หมวดเวรใหม่: เวร R (ไม่ต้องเลือกเวรดำ/แดง เพราะเวร R ให้ใช้สีเขียว) */}
            {(newShiftType === "r1" || newShiftType === "r2") && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 dark:border-emerald-900/50 dark:bg-emerald-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-800 dark:text-emerald-300">
                    หมวดเวรใหม่:
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-white" />
                    เวร Refer ทีม {newShiftType === "r1" ? "1" : "2"} (สีเขียว •
                    ทั้งวัน)
                  </span>
                </div>
              </div>
            )}

            {/* หมวดเวรใหม่: เวร Off */}
            {newShiftType === "off" && (
              <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-3 dark:border-gray-900/50 dark:bg-gray-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-800 dark:text-gray-300">
                    หมวดเวรใหม่:
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-white" />
                    เวร Off (สีดำ • ทั้งวัน)
                  </span>
                </div>
              </div>
            )}

            {/* หมวดเวรใหม่: เวร CTA */}
            {(newShiftType === "cta" || newShiftType === "ctm") && (
              <div className="rounded-2xl border border-purple-200 bg-purple-50/70 p-3 dark:border-purple-900/50 dark:bg-purple-950/30">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-800 dark:text-purple-300">
                    หมวดเวรใหม่:
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-purple-600 px-2.5 py-1 text-xs font-bold text-white shadow-2xs">
                    <span className="h-2 w-2 rounded-full bg-white" />
                    เวร Off (สีดำ • ทั้งวัน)
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ALERT CONFIRMATION (กล่องสีส้มแจ้งเตือนผลกระทบกฎเวรดำ) */}
          {quotaWarning && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50/90 p-3.5 text-xs text-amber-950 dark:border-amber-500 dark:bg-amber-950/60 dark:text-amber-100 animate-in fade-in duration-200 shadow-sm">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <h4 className="font-bold text-amber-900 dark:text-amber-200">
                    ⚠️ คำเตือน: ยอดเวรดำไม่ครบเกณฑ์ประจำเดือน
                  </h4>
                  <p className="text-[11px] leading-relaxed text-amber-800 dark:text-amber-300">
                    การแลก <strong>เวรดำ</strong> ออกไปแล้วได้รับ{" "}
                    <strong>เวรแดง (OT)</strong> กลับมา จะทำให้ยอดเวรดำในเดือน{" "}
                    {quotaWarning.monthName} ลดลงเหลือ{" "}
                    <strong className="underline text-rose-700 dark:text-rose-300">
                      {quotaWarning.simulatedCount}/{quotaWarning.quota} วัน
                    </strong>{" "}
                    (ขาดอีก {quotaWarning.remainingNeeded} วัน จึงจะครบเกณฑ์{" "}
                    {quotaWarning.quota} วัน)
                  </p>
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 font-semibold pt-1">
                    *กรุณาตรวจสอบว่าท่านมีเวรดำอื่นมาชดเชย
                    หรือได้รับอนุญาตจากหัวหน้าเวรแล้วก่อนยืนยัน
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* หมายเหตุ / เหตุผลการแลกเวร */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              เหตุผลหรือบันทึกการแลกเวร (ถ้ามี)
            </label>
            <input
              type="text"
              placeholder="เช่น ติดธุระครอบครัว, ขึ้นเวรช่วยแทนเพื่อนร่วมงาน"
              value={swapReason}
              onChange={(e) => setSwapReason(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3.5 py-2 text-xs text-slate-800 outline-none focus:border-blue-500 focus:bg-white dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
        </form>

        {/* Modal Footer */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3 dark:border-zinc-800 dark:bg-zinc-900/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors"
          >
            ยกเลิก
          </button>
          <button
            type="submit"
            form="shift-swap-form"
            className={`rounded-xl px-5 py-2.5 text-xs font-bold text-white shadow-md active:scale-95 transition-all ${
              quotaWarning
                ? "bg-gradient-to-r from-amber-600 to-shift-red hover:from-amber-700 hover:to-red-600 shadow-amber-500/20"
                : "bg-gradient-to-r from-sky-500 to-emerald-600 hover:brightness-105 shadow-emerald-600/20"
            }`}
          >
            {quotaWarning ? "ดำเนินการแลกเวร (มีคำเตือน)" : "ดำเนินการแลกเวร"}
          </button>
        </div>
      </div>

      {/* Confirmation Modal before finalizing swap */}
      <ModalConfirmAction
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        onConfirm={handleExecuteSwap}
        title="ยืนยันการแลกเวร (Shift Swap)"
        subtitle="กรุณาตรวจสอบข้อมูลก่อนยืนยันเพื่อป้องกันความผิดพลาด"
        variant={quotaWarning ? "warning" : "info"}
        iconType="swap"
        confirmText="ยืนยันแลกเวร"
        cancelText="กลับไปแก้ไข"
        items={[
          {
            label: "เวรเดิมที่จะแลกออก",
            value: (
              <span className="font-bold text-text-main dark:text-white">
                {moment(shift.date).locale("th").format("D MMM YYYY")} •{" "}
                {shiftInfo.label} ({catInfo.label})
              </span>
            ),
          },
          {
            label: "แลกกับ",
            value: isTopUp
              ? `${swappedWith.trim()} (เจ้าของเดิม: ${originalOwner.trim()})`
              : swappedWith.trim(),
          },
          {
            label: "เวรใหม่ที่จะได้รับ",
            value: (
              <span className="font-bold text-sky-600 dark:text-sky-400">
                {moment(newDate).locale("th").format("D MMM YYYY")} •{" "}
                {SHIFT_CONFIG[newShiftType].label} (
                {
                  SHIFT_CATEGORY_CONFIG[
                    newShiftType === "r1" || newShiftType === "r2"
                      ? "green"
                      : newCategory
                  ].label
                }
                )
              </span>
            ),
          },
          ...(swapReason.trim()
            ? [
                {
                  label: "หมายเหตุ/เหตุผล",
                  value: swapReason.trim(),
                },
              ]
            : []),
        ]}
        warningNotice={
          quotaWarning ? (
            <span className="text-amber-900 dark:text-amber-200">
              ⚠️ <strong>คำเตือนโควตา:</strong> การแลกนี้จะทำให้ยอดเวรดำในเดือน{" "}
              {quotaWarning.monthName} ลดเหลือ {quotaWarning.simulatedCount}/
              {quotaWarning.quota} วัน (ขาดอีก {quotaWarning.remainingNeeded}{" "}
              วัน)
            </span>
          ) : (
            <span>
              เมื่อยืนยันแล้ว เวรเดิมของท่านจะถูกเปลี่ยนสถานะเป็น{" "}
              <strong>&quot;แลกออกแล้ว&quot;</strong>{" "}
              และระบบจะเพิ่มเวรใหม่ลงในตารางโดยอัตโนมัติ
            </span>
          )
        }
      />
    </div>
  );
}

"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  Ambulance,
  User,
  Calendar,
  FileText,
  AlertCircle,
  Flame,
} from "lucide-react";
import moment from "moment";
import "moment/locale/th";
import { ShiftRecord, SHIFT_CONFIG } from "../../types/vendee";
import { transferShift } from "../../lib/storage";

export interface ModalTransferShiftProps {
  isOpen: boolean;
  onClose: () => void;
  shift: ShiftRecord | null;
  onSuccess?: (updatedShift: ShiftRecord) => void;
}

export default function ModalTransferShift({
  isOpen,
  onClose,
  shift,
  onSuccess,
}: ModalTransferShiftProps) {
  // Form fields adhere to PROJECT_RULES.md (Form State Reset Policy: empty defaults)
  const [recipientName, setRecipientName] = useState("");
  const [transferredDate, setTransferredDate] = useState("");
  const [note, setNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Form State Reset Policy: Reset all inputs whenever modal opens or shift changes
  useEffect(() => {
    if (isOpen && shift) {
      setRecipientName("");
      setTransferredDate(new Date().toISOString().split("T")[0]);
      setNote("");
      setErrorMsg("");
      setLoading(false);
    }
  }, [isOpen, shift]);

  if (!isOpen || !shift) return null;

  const isOT = shift.category === "red";
  const shiftInfo = SHIFT_CONFIG[shift.shiftType];
  const formattedShiftDate = moment(shift.date).isValid()
    ? moment(shift.date).locale("th").format("ddddที่ D MMMM YYYY")
    : shift.date;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!recipientName.trim()) {
      setErrorMsg("กรุณาระบุชื่อพยาบาลผู้รับเวรแทน");
      return;
    }

    setLoading(true);
    setErrorMsg("");

    try {
      const updated = await transferShift({
        shiftId: shift.id,
        recipientName: recipientName.trim(),
        transferredDate: transferredDate || new Date().toISOString().split("T")[0],
        note: note.trim() || undefined,
      });

      // Post-submission clean-up
      setRecipientName("");
      setNote("");
      setErrorMsg("");

      if (onSuccess) {
        onSuccess(updated);
      }
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || "เกิดข้อผิดพลาดในการบันทึกการยกเวร");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="relative w-full max-w-md rounded-3xl bg-card-bg p-5 sm:p-6 shadow-2xl border border-surface-subtle dark:bg-zinc-900 dark:border-zinc-800 space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-surface-subtle pb-3 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div
              className={`flex h-10 w-10 items-center justify-center rounded-2xl ${
                isOT
                  ? "bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300"
              }`}
            >
              {isOT ? (
                <Flame className="h-5 w-5" />
              ) : (
                <Ambulance className="h-5 w-5" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-text-main dark:text-white flex items-center gap-1.5">
                <span>{isOT ? "ยกเวร OT ให้คนอื่น" : "ยกเวร Refer ให้คนอื่น"}</span>
              </h2>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-1.5 text-text-muted hover:bg-surface-subtle hover:text-text-main dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Shift Details Box */}
        <div
          className={`rounded-2xl p-3.5 border ${
            isOT
              ? "bg-rose-50/60 border-rose-200/80 dark:bg-rose-950/20 dark:border-rose-900/50"
              : "bg-emerald-50/60 border-emerald-200/80 dark:bg-emerald-950/20 dark:border-emerald-900/50"
          }`}
        >
          <div className="flex items-center justify-between">
            <span
              className={`font-extrabold text-sm ${
                isOT
                  ? "text-rose-900 dark:text-rose-200"
                  : "text-emerald-900 dark:text-emerald-200"
              }`}
            >
              {shiftInfo?.label || "เวร"}
            </span>
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                isOT
                  ? "bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300"
              }`}
            >
              {isOT ? "เวรแดง (OT)" : "เวร Refer"}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-text-muted dark:text-zinc-400">
            <span>📅 {formattedShiftDate}</span>
            <span>⏱️ {shiftInfo?.period || "ทั้งวัน"}</span>
          </div>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="flex items-center gap-2 rounded-2xl bg-rose-50 p-3 text-xs font-semibold text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-900">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Transfer Form */}
        <form onSubmit={handleSubmit} className="space-y-3.5">
          {/* Recipient Name */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <User className="h-3.5 w-3.5 text-secondary" />
              <span>
                ชื่อผู้รับเวรแทน <span className="text-rose-500">*</span>
              </span>
            </label>
            <input
              type="text"
              required
              placeholder="ระบุชื่อพยาบาลผู้รับเวร เช่น พี่เปิ้ล, น้องแนน"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full rounded-2xl border border-surface-subtle bg-surface-subtle/40 px-3.5 py-2.5 text-xs text-text-main outline-hidden focus:border-secondary focus:ring-2 focus:ring-secondary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
            />
          </div>

          {/* Transferred Date */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <Calendar className="h-3.5 w-3.5 text-secondary" />
              <span>
                วันที่ยกเวร <span className="text-rose-500">*</span>
              </span>
            </label>
            <input
              type="date"
              required
              value={transferredDate}
              onChange={(e) => setTransferredDate(e.target.value)}
              className="w-full rounded-2xl border border-surface-subtle bg-surface-subtle/40 px-3.5 py-2.5 text-xs text-text-main outline-hidden focus:border-secondary focus:ring-2 focus:ring-secondary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white"
            />
          </div>

          {/* Note */}
          <div className="space-y-1">
            <label className="flex items-center gap-1.5 text-xs font-bold text-text-main dark:text-zinc-200">
              <FileText className="h-3.5 w-3.5 text-secondary" />
              <span>หมายเหตุ</span>
            </label>
            <textarea
              rows={2}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="บันทึกข้อความช่วยจำ (ถ้ามี)"
              className="w-full rounded-2xl border border-surface-subtle bg-surface-subtle/40 px-3.5 py-2 text-xs text-text-main outline-hidden focus:border-secondary focus:ring-2 focus:ring-secondary-light dark:border-zinc-700 dark:bg-zinc-800/80 dark:text-white resize-none"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-2 border-t border-surface-subtle dark:border-zinc-800">
            <button
              type="button"
              disabled={loading}
              onClick={onClose}
              className="flex-1 rounded-2xl border border-surface-subtle py-2.5 text-xs font-bold text-text-muted hover:bg-surface-subtle hover:text-text-main dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`flex-1 rounded-2xl py-2.5 text-xs font-bold text-white shadow-md active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                isOT
                  ? "bg-shift-red hover:bg-rose-700 shadow-rose-900/20"
                  : "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-900/20"
              }`}
            >
              {isOT ? (
                <Flame className="h-4 w-4" />
              ) : (
                <Ambulance className="h-4 w-4" />
              )}
              <span>{loading ? "กำลังบันทึก..." : isOT ? "ยืนยันยกเวร OT" : "ยืนยันยกเวร Refer"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

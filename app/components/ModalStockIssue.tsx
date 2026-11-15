"use client";

import React, { useState, useEffect } from "react";
import { X, PackageMinus } from "lucide-react";
import type { Medications, StockIssueReason } from "../../types/vendee";
import { issueStockAction } from "../actions/stockActions";
import { unwrap } from "../../lib/actionHelper";
import { updateLocalMedicationStock } from "../../lib/storage";

interface Props {
  isOpen: boolean;
  medication: Medications | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

const REASON_OPTIONS: { value: StockIssueReason; label: string }[] = [
  { value: "expired", label: "หมดอายุ" },
  { value: "damaged", label: "ชำรุด / แตกเสียหาย" },
  { value: "personal", label: "ใช้ส่วนตัว" },
  { value: "free", label: "แจกฟรี / แถมลูกค้า" },
  { value: "sample", label: "ตัวอย่าง / ทดลอง" },
  { value: "other", label: "อื่นๆ" },
];

export default function ModalStockIssue({ isOpen, medication, onClose, onSuccess }: Props) {
  const [type, setType] = useState<"waste" | "giveaway">("waste");
  const [qty, setQty] = useState("");
  const [reason, setReason] = useState<StockIssueReason>("expired");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setType("waste");
    setQty("");
    setReason("expired");
    setNote("");
    setErrorMsg("");
  };

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen, medication?.id]);

  if (!isOpen || !medication) return null;

  const unit = medication.unit || "ยูนิต";
  const qtyNum = Number(qty) || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (qtyNum <= 0) {
      setErrorMsg("กรุณาระบุปริมาณที่ตัดออกมากกว่า 0");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await issueStockAction({
        medId: medication.id,
        qty: qtyNum,
        type,
        reason,
        note: note.trim() || undefined,
      });
      const data = unwrap(res);
      updateLocalMedicationStock(medication.id, data.stockOnHand);
      const warnText =
        res.success && res.warnings && res.warnings.length > 0
          ? " (คำเตือน: สต็อกติดลบ)"
          : "";
      resetForm();
      onSuccess(`ตัดออก ${medication.name} -${qtyNum.toLocaleString()} ${unit}${warnText}`);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "ไม่สามารถตัดสต็อกออกได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
        <div className="flex shrink-0 items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <PackageMinus className="h-5 w-5 text-amber-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              ตัดสต็อกออก: {medication.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-zinc-800"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex-1 overflow-y-auto space-y-3 pr-1">
          {errorMsg && (
            <div className="rounded-xl bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1.5">
              ประเภทการตัดออก
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  setType("waste");
                  setReason("expired");
                }}
                className={`rounded-xl px-3 py-2 text-xs font-bold border ${
                  type === "waste"
                    ? "border-rose-500 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
                    : "border-slate-200 text-slate-600 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                ทิ้ง / เสีย / หมดอายุ
              </button>
              <button
                type="button"
                onClick={() => {
                  setType("giveaway");
                  setReason("free");
                }}
                className={`rounded-xl px-3 py-2 text-xs font-bold border ${
                  type === "giveaway"
                    ? "border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300"
                    : "border-slate-200 text-slate-600 dark:border-zinc-700 dark:text-zinc-300"
                }`}
              >
                ใช้ส่วนตัว / แจกฟรี
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                ปริมาณ ({unit}) <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                placeholder={`เช่น 10`}
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
                เหตุผล
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value as StockIssueReason)}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {REASON_OPTIONS.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              หมายเหตุ
            </label>
            <input
              type="text"
              placeholder="รายละเอียดเพิ่มเติม"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-amber-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-700 disabled:opacity-50"
            >
              {isSubmitting ? "กำลังบันทึก..." : "ยืนยันตัดออก"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

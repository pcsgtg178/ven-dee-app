"use client";

import React, { useState, useEffect } from "react";
import { X, ClipboardCheck } from "lucide-react";
import type { Medications } from "../../types/vendee";
import { adjustStockToCountAction } from "../actions/stockActions";
import { unwrap } from "../../lib/actionHelper";
import { formatOnHand } from "../../lib/stock";
import { updateLocalMedicationStock } from "../../lib/storage";

interface Props {
  isOpen: boolean;
  medication: Medications | null;
  onClose: () => void;
  onSuccess: (msg: string) => void;
}

export default function ModalStockCount({ isOpen, medication, onClose, onSuccess }: Props) {
  const [countedQty, setCountedQty] = useState("");
  const [note, setNote] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setCountedQty("");
    setNote("");
    setErrorMsg("");
  };

  useEffect(() => {
    if (isOpen) resetForm();
  }, [isOpen, medication?.id]);

  if (!isOpen || !medication) return null;

  const systemQty = Number(medication.stockOnHand ?? 0);
  const unit = medication.unit || "ยูนิต";
  const packSize = Number(medication.packSize ?? 1);
  const packUnit = medication.packUnit || "ขวด";

  const hasInput = countedQty !== "" && Number.isFinite(Number(countedQty));
  const countedNum = hasInput ? Number(countedQty) : systemQty;
  const diff = countedNum - systemQty;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    if (!hasInput) {
      setErrorMsg("กรุณาระบุยอดที่นับได้จริง");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = unwrap(
        await adjustStockToCountAction({
          medId: medication.id,
          countedQty: countedNum,
          note: note.trim() || undefined,
        })
      );
      updateLocalMedicationStock(medication.id, res.stockOnHand);
      resetForm();
      onSuccess(
        res.changed
          ? `ปรับยอด ${medication.name} เป็น ${countedNum.toLocaleString()} ${unit} (${diff > 0 ? "+" : ""}${diff.toLocaleString()})`
          : `ยอด ${medication.name} ตรงกับระบบแล้ว`
      );
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || "ไม่สามารถปรับยอดสต็อกได้");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-white p-5 shadow-2xl dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800">
        <div className="flex shrink-0 items-center justify-between pb-3 border-b border-slate-100 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <ClipboardCheck className="h-5 w-5 text-sky-600" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">
              นับสต็อกจริง: {medication.name}
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

          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-xs dark:bg-zinc-800">
            <span className="text-slate-500 dark:text-zinc-400">ยอดในระบบปัจจุบัน: </span>
            <strong className="font-bold text-slate-900 dark:text-white">
              {formatOnHand(systemQty, unit, packSize, packUnit)}
            </strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              ยอดที่นับได้จริง ({unit}) <span className="text-rose-500">*</span>
            </label>
            <input
              type="number"
              step="any"
              placeholder={`ระบุจำนวน (${unit})`}
              value={countedQty}
              onChange={(e) => setCountedQty(e.target.value)}
              required
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>

          {hasInput && (
            <div
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                diff === 0
                  ? "bg-slate-100 text-slate-700 dark:bg-zinc-800 dark:text-zinc-300"
                  : diff > 0
                    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                    : "bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300"
              }`}
            >
              ส่วนต่าง: {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()} {unit}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-zinc-300 mb-1">
              หมายเหตุ
            </label>
            <input
              type="text"
              placeholder="เหตุผลในการปรับยอด (ถ้ามี)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs outline-none focus:border-sky-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
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
              className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-bold text-white hover:bg-sky-700 disabled:opacity-50"
            >
              {isSubmitting ? "กำลังบันทึก..." : "ยืนยันปรับยอด"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

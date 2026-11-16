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
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="stock-count-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ds-overlay p-4 backdrop-blur-xs animate-in fade-in duration-150"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-3xl bg-ds-surface-elevated p-5 shadow-ds-popover border border-ds-border">
        <div className="flex shrink-0 items-center justify-between pb-3 border-b border-ds-divider">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-ds-surface-variant text-ds-icon-primary">
              <ClipboardCheck className="h-4 w-4" />
            </div>
            <h3 id="stock-count-title" className="text-sm font-bold text-ds-text">
              นับสต็อกจริง: {medication.name}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิดหน้าต่าง"
            className="rounded-lg p-1 text-ds-icon-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 flex-1 overflow-y-auto overscroll-contain space-y-3 pr-1">
          {errorMsg && (
            <div className="rounded-xl bg-ds-error-container px-3 py-2 text-xs font-semibold text-ds-error">
              {errorMsg}
            </div>
          )}

          <div className="rounded-xl border border-ds-border bg-ds-surface px-3 py-2.5 text-xs">
            <span className="text-ds-text-secondary">ยอดในระบบปัจจุบัน: </span>
            <strong className="font-bold text-ds-text">
              {formatOnHand(systemQty, unit, packSize, packUnit)}
            </strong>
          </div>

          <div>
            <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
              ยอดที่นับได้จริง ({unit}) <span className="text-ds-error">*</span>
            </label>
            <input
              type="number"
              step="any"
              placeholder={`ระบุจำนวน (${unit})`}
              value={countedQty}
              onChange={(e) => setCountedQty(e.target.value)}
              required
              className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
            />
          </div>

          {hasInput && (
            <div
              className={`rounded-xl px-3 py-2 text-xs font-semibold ${
                diff === 0
                  ? "bg-ds-surface-variant text-ds-text-secondary"
                  : diff > 0
                    ? "bg-ds-success-container text-ds-success"
                    : "bg-ds-error-container text-ds-error"
              }`}
            >
              ส่วนต่าง: {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()} {unit}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-ds-text-secondary mb-1">
              หมายเหตุ
            </label>
            <input
              type="text"
              placeholder="เหตุผลในการปรับยอด (ถ้ามี)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full rounded-xl border border-ds-border bg-ds-surface px-3 py-2 text-xs text-ds-text placeholder:text-ds-text-tertiary outline-none focus:border-ds-primary"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-ds-border bg-ds-surface px-4 py-2 text-xs font-semibold text-ds-text-secondary hover:bg-ds-surface-variant hover:text-ds-text cursor-pointer transition-colors"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-xl bg-ds-primary px-4 py-2 text-xs font-bold text-ds-on-primary hover:bg-ds-primary-hover active:bg-ds-primary-pressed disabled:opacity-50 cursor-pointer transition-colors"
            >
              {isSubmitting ? "กำลังบันทึก..." : "ยืนยันปรับยอด"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
